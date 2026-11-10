"""Кастрюлька — сервер оплаты (ЮKassa) и доступа на 30 дней.

Эндпоинты:
  POST /api/pay/create        — создать платёж ЮKassa (590.00 RUB, capture=true, чек 54-ФЗ), вернуть confirmation_url
  POST /api/yookassa/webhook  — уведомления ЮKassa; платёж перепроверяется запросом к API; доступ +30 дней (идемпотентно)
  GET  /api/access            — до какого числа открыт доступ
  GET  /api/health

Пользователь определяется по заголовку Authorization:
  "tma <initData>"   — Telegram Mini App, подпись initData проверяется по TG_BOT_TOKEN (HMAC-SHA256);
  "Bearer <token>"   — веб-пользователь, токен подписан ACCESS_TOKEN_SECRET (выдаётся при первом /api/pay/create).
"""
from __future__ import annotations

import asyncio
import base64
import hashlib
import hmac
import json
import logging
import os
import re
import sqlite3
import time
import uuid
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from urllib.parse import parse_qsl
from zoneinfo import ZoneInfo

import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

log = logging.getLogger("kastr")
MSK = ZoneInfo("Europe/Moscow")
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _env_bool(name: str, default: bool) -> bool:
    v = os.environ.get(name)
    return default if v is None else v.strip().lower() in ("1", "true", "yes", "on")


@dataclass
class Settings:
    shop_id: str = field(default_factory=lambda: os.environ.get("YOOKASSA_SHOP_ID", ""))
    secret_key: str = field(default_factory=lambda: os.environ.get("YOOKASSA_SECRET_KEY", ""))
    bot_token: str = field(default_factory=lambda: os.environ.get("TG_BOT_TOKEN", ""))
    token_secret: str = field(default_factory=lambda: os.environ.get("ACCESS_TOKEN_SECRET", ""))
    db_path: str = field(default_factory=lambda: os.environ.get("DB_PATH", "kastr.sqlite"))
    price: str = field(default_factory=lambda: os.environ.get("PRICE_RUB", "590.00"))
    days: int = field(default_factory=lambda: int(os.environ.get("ACCESS_DAYS", "30")))
    app_url: str = field(default_factory=lambda: os.environ.get("APP_URL", "https://utemov28-lang.github.io/sytoplan/"))
    allowed_origins: list = field(default_factory=lambda: [o.strip() for o in os.environ.get(
        "ALLOWED_ORIGINS", "https://utemov28-lang.github.io").split(",") if o.strip()])
    send_receipt: bool = field(default_factory=lambda: _env_bool("SEND_RECEIPT", True))
    vat_code: int = field(default_factory=lambda: int(os.environ.get("VAT_CODE", "1")))  # 1 = без НДС
    tax_system_code: str = field(default_factory=lambda: os.environ.get("TAX_SYSTEM_CODE", ""))
    reminders: bool = field(default_factory=lambda: _env_bool("REMINDERS", True))
    initdata_max_age: int = field(default_factory=lambda: int(os.environ.get("INITDATA_MAX_AGE", str(7 * 86400))))
    yk_api: str = field(default_factory=lambda: os.environ.get("YOOKASSA_API", "https://api.yookassa.ru/v3"))
    tg_api: str = "https://api.telegram.org"


# ---------------- БД ----------------
SCHEMA = """
CREATE TABLE IF NOT EXISTS users(
  uid TEXT PRIMARY KEY, paid_until TEXT, email TEXT, tg_chat_id INTEGER,
  reminded_for TEXT, created TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS payments(
  id TEXT PRIMARY KEY, uid TEXT NOT NULL, status TEXT NOT NULL, amount TEXT,
  created TEXT DEFAULT CURRENT_TIMESTAMP, processed_at TEXT);
"""


def db_connect(path: str) -> sqlite3.Connection:
    con = sqlite3.connect(path, isolation_level=None, check_same_thread=False)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA journal_mode=WAL")
    con.executescript(SCHEMA)
    return con


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def parse_iso(s: str | None) -> datetime | None:
    if not s:
        return None
    return datetime.fromisoformat(s.replace("Z", "+00:00"))


# ---------------- Авторизация ----------------
def validate_init_data(init_data: str, bot_token: str, max_age: int, now: float | None = None) -> dict:
    """Проверка Telegram WebApp initData (https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app)."""
    if not bot_token:
        raise ValueError("no bot token")
    pairs = dict(parse_qsl(init_data, keep_blank_values=True, strict_parsing=True))
    got = pairs.pop("hash", "")
    dcs = "\n".join(f"{k}={pairs[k]}" for k in sorted(pairs))
    secret = hmac.new(b"WebAppData", bot_token.encode(), hashlib.sha256).digest()
    calc = hmac.new(secret, dcs.encode(), hashlib.sha256).hexdigest()
    if not got or not hmac.compare_digest(calc, got):
        raise ValueError("bad hash")
    auth_date = int(pairs.get("auth_date", "0"))
    if (now or time.time()) - auth_date > max_age:
        raise ValueError("initData expired")
    user = json.loads(pairs.get("user", "{}"))
    if not user.get("id"):
        raise ValueError("no user")
    return user


def make_token(uid: str, secret: str) -> str:
    body = base64.urlsafe_b64encode(uid.encode()).decode().rstrip("=")
    sig = hmac.new(secret.encode(), body.encode(), hashlib.sha256).hexdigest()[:32]
    return f"{body}.{sig}"


def read_token(token: str, secret: str) -> str | None:
    try:
        body, sig = token.split(".", 1)
    except ValueError:
        return None
    calc = hmac.new(secret.encode(), body.encode(), hashlib.sha256).hexdigest()[:32]
    if not hmac.compare_digest(calc, sig):
        return None
    uid = base64.urlsafe_b64decode(body + "=" * (-len(body) % 4)).decode()
    return uid if uid.startswith("web:") else None


@dataclass
class Who:
    uid: str
    chat_id: int | None = None


def identify(request: Request, s: Settings) -> Who | None:
    h = request.headers.get("authorization", "")
    if h.startswith("tma "):
        try:
            user = validate_init_data(h[4:], s.bot_token, s.initdata_max_age)
        except Exception as e:  # noqa: BLE001
            raise HTTPException(401, f"initData: {e}")
        return Who(f"tg:{int(user['id'])}", int(user["id"]))
    if h.startswith("Bearer ") and s.token_secret:
        uid = read_token(h[7:], s.token_secret)
        if not uid:
            raise HTTPException(401, "bad token")
        return Who(uid)
    return None


# ---------------- ЮKassa / Telegram ----------------
class YooKassa:
    def __init__(self, s: Settings, transport: httpx.BaseTransport | None = None):
        self.s, self.transport = s, transport

    def _client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(base_url=self.s.yk_api, auth=(self.s.shop_id, self.s.secret_key),
                                 timeout=20, transport=self.transport)

    async def create_payment(self, body: dict, idem_key: str) -> dict:
        async with self._client() as c:
            r = await c.post("/payments", json=body, headers={"Idempotence-Key": idem_key})
        if r.status_code >= 300:
            log.error("yookassa create %s: %s", r.status_code, r.text[:500])
            raise HTTPException(502, "Платёжный сервис временно недоступен")
        return r.json()

    async def get_payment(self, pid: str) -> dict:
        async with self._client() as c:
            r = await c.get(f"/payments/{pid}")
        r.raise_for_status()
        return r.json()


async def tg_send(s: Settings, chat_id: int, text: str, transport=None) -> None:
    if not s.bot_token or not chat_id:
        return
    payload = {"chat_id": chat_id, "text": text,
               "reply_markup": {"inline_keyboard": [[{"text": "Открыть Кастрюльку", "web_app": {"url": s.app_url}}]]}}
    try:
        async with httpx.AsyncClient(timeout=15, transport=transport) as c:
            await c.post(f"{s.tg_api}/bot{s.bot_token}/sendMessage", json=payload)
    except Exception as e:  # noqa: BLE001 — уведомление не должно ломать оплату
        log.warning("telegram send failed: %s", type(e).__name__)


def fmt_date(dt: datetime) -> str:
    return dt.astimezone(MSK).strftime("%d.%m.%Y")


# ---------------- Бизнес-логика ----------------
def grant(con: sqlite3.Connection, pid: str, uid: str, amount: str, days: int, now: datetime) -> datetime | None:
    """Продлить доступ на days за платёж pid. Повторный вызов с тем же pid ничего не меняет (возвращает None)."""
    con.execute("BEGIN IMMEDIATE")
    try:
        row = con.execute("SELECT processed_at FROM payments WHERE id=?", (pid,)).fetchone()
        if row and row["processed_at"]:
            con.execute("COMMIT")
            return None
        if not row:
            con.execute("INSERT INTO payments(id,uid,status,amount) VALUES(?,?,?,?)", (pid, uid, "succeeded", amount))
        u = con.execute("SELECT paid_until FROM users WHERE uid=?", (uid,)).fetchone()
        cur = parse_iso(u["paid_until"]) if u else None
        until = max(now, cur or now) + timedelta(days=days)
        if u:
            con.execute("UPDATE users SET paid_until=? WHERE uid=?", (iso(until), uid))
        else:
            con.execute("INSERT INTO users(uid,paid_until) VALUES(?,?)", (uid, iso(until)))
        con.execute("UPDATE payments SET status='succeeded', processed_at=? WHERE id=?", (iso(now), pid))
        con.execute("COMMIT")
        return until
    except Exception:
        con.execute("ROLLBACK")
        raise


async def run_reminders(app: FastAPI, now: datetime | None = None) -> int:
    """Напоминание в Telegram за 3 дня до окончания доступа (один раз на каждый срок)."""
    s: Settings = app.state.settings
    con: sqlite3.Connection = app.state.db
    now = now or now_utc()
    rows = con.execute("SELECT uid,paid_until,tg_chat_id,reminded_for FROM users WHERE tg_chat_id IS NOT NULL "
                       "AND paid_until > ? AND paid_until <= ?", (iso(now), iso(now + timedelta(days=3)))).fetchall()
    n = 0
    for r in rows:
        if r["reminded_for"] == r["paid_until"]:
            continue
        until = parse_iso(r["paid_until"])
        await tg_send(s, r["tg_chat_id"], f"⏰ Доступ к Кастрюльке заканчивается {fmt_date(until)}. "
                      f"Продлить на {s.days} дней — {Decimal(s.price):.0f} ₽: откройте приложение → Профиль → «Продлить».",
                      app.state.tg_transport)
        con.execute("UPDATE users SET reminded_for=? WHERE uid=?", (r["paid_until"], r["uid"]))
        n += 1
    return n


class PayIn(BaseModel):
    email: str | None = None
    phone: str | None = None
    return_url: str | None = None


def create_app(settings: Settings | None = None, yk_transport=None, tg_transport=None) -> FastAPI:
    s = settings or Settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        task = None
        if s.reminders and s.bot_token:
            async def loop():
                while True:
                    try:
                        await run_reminders(app)
                    except Exception:  # noqa: BLE001
                        log.exception("reminders")
                    await asyncio.sleep(3600)
            task = asyncio.create_task(loop())
        yield
        if task:
            task.cancel()

    app = FastAPI(title="Kastryulka API", lifespan=lifespan, docs_url=None, redoc_url=None)
    app.state.settings, app.state.db = s, db_connect(s.db_path)
    app.state.yk, app.state.tg_transport = YooKassa(s, yk_transport), tg_transport
    app.add_middleware(CORSMiddleware, allow_origins=s.allowed_origins, allow_methods=["GET", "POST"],
                       allow_headers=["Authorization", "Content-Type"])

    def safe_return(url: str | None) -> str:
        ok = url and any(url.startswith(o.rstrip("/") + "/") for o in s.allowed_origins) and len(url) < 500
        return url if ok else s.app_url + "?paid=1"

    @app.get("/api/health")
    def health():
        return {"ok": True}

    @app.post("/api/pay/create")
    async def pay_create(body: PayIn, request: Request):
        if not (s.shop_id and s.secret_key):
            raise HTTPException(503, "Оплата не настроена")
        who = identify(request, s)
        new_token = None
        if who is None:
            if not s.token_secret:
                raise HTTPException(401, "Нужен вход через Telegram")
            who = Who(f"web:{uuid.uuid4().hex}")
            new_token = make_token(who.uid, s.token_secret)
        email = (body.email or "").strip()
        phone = re.sub(r"\D", "", body.phone or "")
        if s.send_receipt and not (EMAIL_RE.match(email) or len(phone) >= 11):
            raise HTTPException(422, "Укажите почту для чека")
        con = app.state.db
        con.execute("INSERT INTO users(uid,email,tg_chat_id) VALUES(?,?,?) ON CONFLICT(uid) DO UPDATE SET "
                    "email=COALESCE(excluded.email,users.email), tg_chat_id=COALESCE(excluded.tg_chat_id,users.tg_chat_id)",
                    (who.uid, email or None, who.chat_id))
        amount = {"value": f"{Decimal(s.price):.2f}", "currency": "RUB"}
        req = {
            "amount": amount, "capture": True,
            "confirmation": {"type": "redirect", "return_url": safe_return(body.return_url)},
            "description": f"Кастрюлька — полный доступ на {s.days} дней",
            "metadata": {"uid": who.uid},
        }
        if s.send_receipt:
            customer = {"email": email} if EMAIL_RE.match(email) else {"phone": phone}
            receipt = {"customer": customer, "items": [{
                "description": f"Доступ к сервису «Кастрюлька» на {s.days} дней", "quantity": "1.00",
                "amount": amount, "vat_code": s.vat_code, "payment_mode": "full_payment", "payment_subject": "service"}]}
            if s.tax_system_code:
                receipt["tax_system_code"] = int(s.tax_system_code)
            req["receipt"] = receipt
        p = await app.state.yk.create_payment(req, str(uuid.uuid4()))
        con.execute("INSERT OR IGNORE INTO payments(id,uid,status,amount) VALUES(?,?,?,?)",
                    (p["id"], who.uid, p.get("status", "pending"), amount["value"]))
        out = {"payment_id": p["id"], "confirmation_url": p["confirmation"]["confirmation_url"]}
        if new_token:
            out["access_token"] = new_token
        return out

    @app.post("/api/yookassa/webhook")
    async def webhook(request: Request):
        try:
            ev = await request.json()
            pid = ev["object"]["id"]
            event = ev.get("event", "")
        except Exception:  # noqa: BLE001
            raise HTTPException(400, "bad notification")
        if event not in ("payment.succeeded", "payment.canceled"):
            return {"ok": True, "ignored": event}
        # Не доверяем телу уведомления: перепроверяем платёж по API ЮKassa.
        try:
            p = await app.state.yk.get_payment(pid)
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                return {"ok": True, "ignored": "unknown payment"}
            raise HTTPException(502, "yookassa unavailable")  # ЮKassa повторит уведомление
        except httpx.HTTPError:
            raise HTTPException(502, "yookassa unavailable")
        con = app.state.db
        if p.get("status") == "canceled":
            con.execute("UPDATE payments SET status='canceled' WHERE id=? AND processed_at IS NULL", (pid,))
            return {"ok": True}
        uid = (p.get("metadata") or {}).get("uid")
        amt = p.get("amount") or {}
        if p.get("status") != "succeeded" or not p.get("paid") or not uid:
            return {"ok": True, "ignored": "not succeeded"}
        if amt.get("currency") != "RUB" or Decimal(amt.get("value", "0")) < Decimal(s.price):
            log.warning("payment %s amount mismatch: %s", pid, amt)
            return {"ok": True, "ignored": "amount"}
        until = grant(con, pid, uid, amt["value"], s.days, now_utc())
        if until and uid.startswith("tg:"):
            await tg_send(s, int(uid[3:]), f"✅ Оплата прошла! Полный доступ к Кастрюльке открыт до {fmt_date(until)}.",
                          app.state.tg_transport)
        return {"ok": True, "granted": bool(until)}

    @app.get("/api/access")
    def access(request: Request):
        who = identify(request, s)
        if who is None:
            raise HTTPException(401, "unauthorized")
        row = app.state.db.execute("SELECT paid_until FROM users WHERE uid=?", (who.uid,)).fetchone()
        pu = parse_iso(row["paid_until"]) if row and row["paid_until"] else None
        return {"paid_until": iso(pu) if pu else None, "active": bool(pu and pu > now_utc())}

    return app


app = create_app() if os.environ.get("KASTR_NO_AUTOAPP") != "1" else None
