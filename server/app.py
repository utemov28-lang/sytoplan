"""Кастрюлька — сервер оплаты (ЮKassa) и доступа на 30 дней.

Эндпоинты:
  POST /api/pay/create        — создать платёж ЮKassa (590.00 RUB, capture=true, чек 54-ФЗ), вернуть confirmation_url
  POST /api/yookassa/webhook  — уведомления ЮKassa; платёж перепроверяется запросом к API; доступ +30 дней (идемпотентно)
  GET  /api/access            — до какого числа открыт доступ
  GET  /api/health
  POST /api/login/request     — magic-link на почту (одноразовый, 15 мин), с лимитами
  POST /api/login/confirm     — обмен magic-токена на долгий токен доступа
  POST /api/link/create       — ссылка «Связать с Telegram» (t.me/<bot>?start=link_<token>)
  POST /api/link/confirm      — внутри Mini App (initData) привязать Telegram к аккаунту по почте
  GET/PUT /api/state          — синхронизация состояния приложения (last-write-wins по updated_at)

Аккаунты: tg:<id> (Telegram), email:<почта> (сайт, создаётся после оплаты), web:<random> (временный id до оплаты).
Таблица aliases сводит web:/tg: к основному аккаунту (после оплаты по почте или привязки Telegram).

Пользователь определяется по заголовку Authorization:
  "tma <initData>"   — Telegram Mini App, подпись initData проверяется по TG_BOT_TOKEN (HMAC-SHA256);
  "Bearer <token>"   — сайт; токен подписан ACCESS_TOKEN_SECRET (выдаётся в /api/pay/create и /api/access;
                       пользователю Telegram — чтобы перенести доступ в Safari/Chrome ссылкой #t=<token>).
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
import secrets
import smtplib
import sqlite3
import time
import uuid
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
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
    bot_name: str = field(default_factory=lambda: os.environ.get("BOT_NAME", "sytoplan_bot"))
    smtp_host: str = field(default_factory=lambda: os.environ.get("SMTP_HOST", ""))
    smtp_port: int = field(default_factory=lambda: int(os.environ.get("SMTP_PORT", "465")))
    smtp_user: str = field(default_factory=lambda: os.environ.get("SMTP_USER", ""))
    smtp_pass: str = field(default_factory=lambda: os.environ.get("SMTP_PASS", ""))
    smtp_from: str = field(default_factory=lambda: os.environ.get("SMTP_FROM", ""))
    smtp_starttls: bool = field(default_factory=lambda: _env_bool("SMTP_STARTTLS", False))


# ---------------- БД ----------------
SCHEMA = """
CREATE TABLE IF NOT EXISTS users(
  uid TEXT PRIMARY KEY, paid_until TEXT, email TEXT, tg_chat_id INTEGER,
  reminded_for TEXT, created TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS payments(
  id TEXT PRIMARY KEY, uid TEXT NOT NULL, status TEXT NOT NULL, amount TEXT,
  created TEXT DEFAULT CURRENT_TIMESTAMP, processed_at TEXT);
CREATE TABLE IF NOT EXISTS aliases(uid TEXT PRIMARY KEY, account TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS otps(hash TEXT PRIMARY KEY, kind TEXT NOT NULL, account TEXT NOT NULL, expires TEXT NOT NULL, used INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS state(account TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS hits(key TEXT NOT NULL, ts REAL NOT NULL);
CREATE INDEX IF NOT EXISTS hits_key ON hits(key, ts);
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
    return uid if uid.startswith(("web:", "tg:", "email:")) else None


def resolve(con: sqlite3.Connection, uid: str) -> str:
    """web:/tg: id → основной аккаунт (если был связан)."""
    for _ in range(3):
        r = con.execute("SELECT account FROM aliases WHERE uid=?", (uid,)).fetchone()
        if not r or r["account"] == uid:
            return uid
        uid = r["account"]
    return uid


def email_uid(email: str) -> str:
    return "email:" + email.strip().lower()


def otp_new(con, kind: str, account: str, ttl: timedelta) -> str:
    tok = secrets.token_urlsafe(24)
    con.execute("INSERT INTO otps(hash,kind,account,expires) VALUES(?,?,?,?)",
                (hashlib.sha256(tok.encode()).hexdigest(), kind, account, iso(now_utc() + ttl)))
    return tok


def otp_use(con, kind: str, tok: str) -> str | None:
    h = hashlib.sha256((tok or "").encode()).hexdigest()
    con.execute("BEGIN IMMEDIATE")
    r = con.execute("SELECT account,expires,used FROM otps WHERE hash=? AND kind=?", (h, kind)).fetchone()
    if not r or r["used"] or parse_iso(r["expires"]) < now_utc():
        con.execute("COMMIT")
        return None
    con.execute("UPDATE otps SET used=1 WHERE hash=?", (h,))
    con.execute("COMMIT")
    return r["account"]


def rate_ok(con, key: str, limit: int, window: int) -> bool:
    t = time.time()
    con.execute("DELETE FROM hits WHERE ts < ?", (t - 86400,))
    n = con.execute("SELECT COUNT(*) FROM hits WHERE key=? AND ts > ?", (key, t - window)).fetchone()[0]
    if n >= limit:
        return False
    con.execute("INSERT INTO hits(key,ts) VALUES(?,?)", (key, t))
    return True


def merge_into(con, src: str, dst: str, now: datetime) -> None:
    """Слить аккаунт src в dst: оставшиеся дни суммируются, состояние — более новое, src становится алиасом dst."""
    if src == dst:
        return
    a = con.execute("SELECT * FROM users WHERE uid=?", (src,)).fetchone()
    b = con.execute("SELECT * FROM users WHERE uid=?", (dst,)).fetchone()
    rem = sum((max(timedelta(0), parse_iso(r["paid_until"]) - now) for r in (a, b) if r and r["paid_until"]), timedelta(0))
    until = iso(now + rem) if rem > timedelta(0) else (b["paid_until"] if b else None)
    chat = (b["tg_chat_id"] if b else None) or (a["tg_chat_id"] if a else None)
    con.execute("INSERT INTO users(uid,paid_until,tg_chat_id) VALUES(?,?,?) ON CONFLICT(uid) DO UPDATE SET "
                "paid_until=excluded.paid_until, tg_chat_id=excluded.tg_chat_id", (dst, until, chat))
    sa = con.execute("SELECT * FROM state WHERE account=?", (src,)).fetchone()
    sb = con.execute("SELECT * FROM state WHERE account=?", (dst,)).fetchone()
    if sa and (not sb or sa["updated_at"] > sb["updated_at"]):
        con.execute("INSERT OR REPLACE INTO state(account,data,updated_at) VALUES(?,?,?)", (dst, sa["data"], sa["updated_at"]))
    con.execute("INSERT OR REPLACE INTO aliases(uid,account) VALUES(?,?)", (src, dst))
    con.execute("UPDATE aliases SET account=? WHERE account=?", (dst, src))


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


class Mailer:
    """SMTP (SMTP_HOST/PORT/USER/PASS/FROM). В тестах подменяется."""
    def __init__(self, s: Settings):
        self.s = s

    async def send(self, to: str, subject: str, text: str) -> bool:
        s = self.s
        if not (s.smtp_host and s.smtp_from):
            log.warning("SMTP не настроен — письмо не отправлено")
            return False
        msg = EmailMessage()
        msg["From"], msg["To"], msg["Subject"] = s.smtp_from, to, subject
        msg.set_content(text)

        def _send():
            cls = smtplib.SMTP if s.smtp_starttls else smtplib.SMTP_SSL
            with cls(s.smtp_host, s.smtp_port, timeout=20) as m:
                if s.smtp_starttls:
                    m.starttls()
                if s.smtp_user:
                    m.login(s.smtp_user, s.smtp_pass)
                m.send_message(msg)
        try:
            await asyncio.to_thread(_send)
            return True
        except Exception as e:  # noqa: BLE001
            log.warning("smtp failed: %s", type(e).__name__)
            return False


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


class EmailIn(BaseModel):
    email: str


class TokenIn(BaseModel):
    token: str


class StateIn(BaseModel):
    state: dict
    updated_at: int


class PayIn(BaseModel):
    email: str | None = None
    phone: str | None = None
    return_url: str | None = None


def create_app(settings: Settings | None = None, yk_transport=None, tg_transport=None, mailer=None) -> FastAPI:
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
    app.state.mailer = mailer or Mailer(s)
    app.add_middleware(CORSMiddleware, allow_origins=s.allowed_origins, allow_methods=["GET", "POST", "PUT"],
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
        con = app.state.db
        if who is not None:
            who = Who(resolve(con, who.uid), who.chat_id)
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
        con.execute("INSERT INTO users(uid,email,tg_chat_id) VALUES(?,?,?) ON CONFLICT(uid) DO UPDATE SET "
                    "email=COALESCE(excluded.email,users.email), tg_chat_id=COALESCE(excluded.tg_chat_id,users.tg_chat_id)",
                    (who.uid, email or None, who.chat_id))
        amount = {"value": f"{Decimal(s.price):.2f}", "currency": "RUB"}
        req = {
            "amount": amount, "capture": True,
            "confirmation": {"type": "redirect", "return_url": safe_return(body.return_url)},
            "description": f"Кастрюлька — полный доступ на {s.days} дней",
            "metadata": {"uid": who.uid, **({"email": email.lower()} if EMAIL_RE.match(email) else {})},
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
        account = resolve(con, uid)
        email = (p.get("metadata") or {}).get("email") or ""
        welcome = account.startswith("web:") and bool(EMAIL_RE.match(email))
        if welcome:  # веб-оплата: аккаунт = почта; временный web-id становится алиасом
            dst = email_uid(email)
            merge_into(con, account, dst, now_utc())
            con.execute("UPDATE users SET email=? WHERE uid=?", (email, dst))
            account = dst
        until = grant(con, pid, account, amt["value"], s.days, now_utc())
        if until:
            row = con.execute("SELECT tg_chat_id FROM users WHERE uid=?", (account,)).fetchone()
            chat = (row and row["tg_chat_id"]) or (int(account[3:]) if account.startswith("tg:") else None)
            if chat:
                await tg_send(s, chat, f"✅ Оплата прошла! Полный доступ к Кастрюльке открыт до {fmt_date(until)}.",
                              app.state.tg_transport)
            if welcome:
                tok = otp_new(con, "login", account, timedelta(days=7))
                await app.state.mailer.send(email, "Ваш доступ в Кастрюльку",
                    f"Оплата прошла — полный доступ открыт до {fmt_date(until)}.\n\n"
                    f"Войти на любом устройстве (ссылка одноразовая, действует 7 дней):\n{s.app_url}?login={tok}\n\n"
                    f"Позже: «Уже оплачивали? Войти» → эта почта → новая ссылка придёт сюда.\n— Кастрюлька")
        return {"ok": True, "granted": bool(until)}

    @app.get("/api/access")
    def access(request: Request):
        who = identify(request, s)
        if who is None:
            raise HTTPException(401, "unauthorized")
        acc = resolve(app.state.db, who.uid)
        row = app.state.db.execute("SELECT paid_until,email FROM users WHERE uid=?", (acc,)).fetchone()
        pu = parse_iso(row["paid_until"]) if row and row["paid_until"] else None
        out = {"paid_until": iso(pu) if pu else None, "active": bool(pu and pu > now_utc())}
        if s.token_secret:  # токен-ссылка: открыть доступ в другом браузере (Safari/Chrome) по ссылке #t=
            out["token"] = make_token(acc, s.token_secret)
        out["email"] = row["email"] if row else None
        return out

    def need(request: Request) -> tuple[Who, str]:
        who = identify(request, s)
        if who is None:
            raise HTTPException(401, "unauthorized")
        return who, resolve(app.state.db, who.uid)

    @app.post("/api/login/request")
    async def login_request(body: EmailIn, request: Request):
        email = body.email.strip().lower()
        if not EMAIL_RE.match(email):
            raise HTTPException(422, "Проверьте почту")
        con = app.state.db
        ip = request.client.host if request.client else "?"
        if not (rate_ok(con, "ip:" + ip, 20, 3600) and rate_ok(con, "em:" + email, 1, 60)
                and rate_ok(con, "emh:" + email, 5, 3600)):
            raise HTTPException(429, "Слишком часто — попробуйте через минуту")
        acc = email_uid(email)
        if con.execute("SELECT 1 FROM users WHERE uid=?", (acc,)).fetchone():
            tok = otp_new(con, "login", acc, timedelta(minutes=15))
            await app.state.mailer.send(email, "Вход в Кастрюльку",
                f"Ссылка для входа (одноразовая, действует 15 минут):\n{s.app_url}?login={tok}\n\n"
                f"Если вы не запрашивали вход — просто проигнорируйте письмо.\n— Кастрюлька")
        return {"ok": True}  # одинаковый ответ — не раскрываем, есть ли аккаунт

    @app.post("/api/login/confirm")
    def login_confirm(body: TokenIn):
        acc = otp_use(app.state.db, "login", body.token)
        if not acc or not s.token_secret:
            raise HTTPException(400, "Ссылка устарела или уже использована — запросите новую")
        return {"access_token": make_token(acc, s.token_secret)}

    @app.post("/api/link/create")
    def link_create(request: Request):
        _, acc = need(request)
        tok = otp_new(app.state.db, "link", acc, timedelta(minutes=15))
        return {"url": f"https://t.me/{s.bot_name}?start=link_{tok}", "token": tok}

    @app.post("/api/link/confirm")
    def link_confirm(body: TokenIn, request: Request):
        who, cur = need(request)
        if not who.uid.startswith("tg:"):
            raise HTTPException(400, "Откройте ссылку в Telegram")
        con = app.state.db
        acc = otp_use(con, "link", body.token)
        if not acc:
            raise HTTPException(400, "Ссылка устарела — создайте новую")
        merge_into(con, cur, acc, now_utc())
        con.execute("UPDATE users SET tg_chat_id=? WHERE uid=?", (who.chat_id, acc))
        return {"ok": True}

    @app.get("/api/state")
    def state_get(request: Request):
        _, acc = need(request)
        r = app.state.db.execute("SELECT data,updated_at FROM state WHERE account=?", (acc,)).fetchone()
        return {"state": json.loads(r["data"]) if r else None, "updated_at": r["updated_at"] if r else 0}

    @app.put("/api/state")
    def state_put(body: StateIn, request: Request):
        _, acc = need(request)
        data = json.dumps(body.state, ensure_ascii=False, separators=(",", ":"))
        if len(data) > 512_000:
            raise HTTPException(413, "state too large")
        con = app.state.db
        con.execute("BEGIN IMMEDIATE")
        r = con.execute("SELECT updated_at FROM state WHERE account=?", (acc,)).fetchone()
        if r and r["updated_at"] > body.updated_at:
            con.execute("COMMIT")
            return {"saved": False, "updated_at": r["updated_at"]}
        con.execute("INSERT OR REPLACE INTO state(account,data,updated_at) VALUES(?,?,?)", (acc, data, body.updated_at))
        con.execute("COMMIT")
        return {"saved": True, "updated_at": body.updated_at}

    return app


app = create_app() if os.environ.get("KASTR_NO_AUTOAPP") != "1" else None
