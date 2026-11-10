import hashlib, hmac, json, os, time
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

os.environ["KASTR_NO_AUTOAPP"] = "1"
import httpx, pytest
from fastapi.testclient import TestClient
import app as srv

BOT = "123456:TEST_TOKEN_NOT_REAL"


def init_data(uid=777, age=0, token=BOT):
    d = {"auth_date": str(int(time.time()) - age), "query_id": "AAH", "user": json.dumps({"id": uid, "first_name": "Катя"})}
    dcs = "\n".join(f"{k}={d[k]}" for k in sorted(d))
    sec = hmac.new(b"WebAppData", token.encode(), hashlib.sha256).digest()
    d["hash"] = hmac.new(sec, dcs.encode(), hashlib.sha256).hexdigest()
    return urlencode(d)


class FakeYK:
    """Мок REST API ЮKassa v3 + Telegram sendMessage."""
    def __init__(self):
        self.payments, self.created, self.tg = {}, [], []
        self.fail_get = False

    def yk(self, req: httpx.Request):
        assert req.headers["authorization"].startswith("Basic ")
        if req.method == "POST" and req.url.path.endswith("/payments"):
            assert req.headers.get("Idempotence-Key")
            body = json.loads(req.content)
            pid = f"2f{len(self.payments):06d}-000f-5000-9000-1b68e7b15f3f"
            p = {"id": pid, "status": "pending", "paid": False, "amount": body["amount"], "metadata": body["metadata"],
                 "confirmation": {"type": "redirect", "confirmation_url": f"https://yoomoney.ru/checkout/payments/v2/contract?orderId={pid}"}}
            self.payments[pid] = p; self.created.append(body)
            return httpx.Response(200, json=p)
        if req.method == "GET":
            if self.fail_get:
                return httpx.Response(500, json={"type": "error"})
            pid = req.url.path.rsplit("/", 1)[-1]
            return httpx.Response(200, json=self.payments[pid]) if pid in self.payments else httpx.Response(404, json={"type": "error", "code": "not_found"})
        return httpx.Response(400)

    def tgh(self, req: httpx.Request):
        self.tg.append(json.loads(req.content)); return httpx.Response(200, json={"ok": True})

    def succeed(self, pid):
        self.payments[pid].update(status="succeeded", paid=True)


@pytest.fixture
def env(tmp_path):
    s = srv.Settings(shop_id="100500", secret_key="test_secret", bot_token=BOT, token_secret="tok_secret",
                     db_path=str(tmp_path / "t.sqlite"), reminders=False)
    fk = FakeYK()
    app = srv.create_app(s, httpx.MockTransport(fk.yk), httpx.MockTransport(fk.tgh))
    return TestClient(app), fk, app


def hook(c, pid, event="payment.succeeded"):
    return c.post("/api/yookassa/webhook", json={"type": "notification", "event": event, "object": {"id": pid, "status": "succeeded"}})


def test_initdata_validation():
    assert srv.validate_init_data(init_data(5), BOT, 3600)["id"] == 5
    for bad in (init_data(5, token="999:OTHER"), init_data(5).replace("%3A+5%2C", "%3A+6%2C"), init_data(5)[:-2] + "00"):
        with pytest.raises(ValueError):
            srv.validate_init_data(bad, BOT, 3600)
    with pytest.raises(ValueError):
        srv.validate_init_data(init_data(5, age=10_000), BOT, 3600)


def test_tg_full_flow(env):
    c, fk, app = env
    H = {"Authorization": "tma " + init_data(777)}
    assert c.get("/api/access", headers=H).json() == {"paid_until": None, "active": False}
    r = c.post("/api/pay/create", headers=H, json={"email": "katya@mail.ru", "return_url": "https://utemov28-lang.github.io/sytoplan/?paid=1"})
    assert r.status_code == 200, r.text
    j = r.json(); pid = j["payment_id"]
    assert j["confirmation_url"].startswith("https://yoomoney.ru/") and "access_token" not in j
    body = fk.created[0]
    assert body["amount"] == {"value": "590.00", "currency": "RUB"} and body["capture"] is True
    assert body["metadata"]["uid"] == "tg:777"
    assert body["confirmation"]["return_url"] == "https://utemov28-lang.github.io/sytoplan/?paid=1"
    it = body["receipt"]["items"][0]
    assert body["receipt"]["customer"] == {"email": "katya@mail.ru"} and it["amount"]["value"] == "590.00"
    assert it["vat_code"] == 1 and it["payment_subject"] == "service" and it["payment_mode"] == "full_payment"
    # уведомление пришло, но платёж ещё pending -> доступа нет (перепроверка по API)
    assert hook(c, pid).json()["ignored"] == "not succeeded"
    assert c.get("/api/access", headers=H).json()["active"] is False
    fk.succeed(pid)
    assert hook(c, pid).json()["granted"] is True
    a = c.get("/api/access", headers=H).json()
    until = datetime.fromisoformat(a["paid_until"].replace("Z", "+00:00"))
    assert a["active"] and abs((until - datetime.now(timezone.utc)) - timedelta(days=30)) < timedelta(minutes=1)
    # идемпотентность: повторное уведомление не продлевает
    assert hook(c, pid).json()["granted"] is False
    assert c.get("/api/access", headers=H).json()["paid_until"] == a["paid_until"]
    assert len(fk.tg) == 1 and fk.tg[0]["chat_id"] == 777 and "открыт до" in fk.tg[0]["text"]
    # второй платёж продлевает от текущей даты окончания
    pid2 = c.post("/api/pay/create", headers=H, json={"email": "katya@mail.ru"}).json()["payment_id"]
    fk.succeed(pid2); hook(c, pid2)
    u2 = datetime.fromisoformat(c.get("/api/access", headers=H).json()["paid_until"].replace("Z", "+00:00"))
    assert abs((u2 - until) - timedelta(days=30)) < timedelta(seconds=5)


def test_web_flow_token_and_bad_return(env):
    c, fk, _ = env
    r = c.post("/api/pay/create", json={"email": "a@b.ru", "return_url": "https://evil.example/x"}).json()
    tok = r["access_token"]; H = {"Authorization": "Bearer " + tok}
    assert fk.created[0]["confirmation"]["return_url"].startswith("https://utemov28-lang.github.io/sytoplan/")
    assert fk.created[0]["metadata"]["uid"].startswith("web:")
    fk.succeed(r["payment_id"]); hook(c, r["payment_id"])
    assert c.get("/api/access", headers=H).json()["active"] is True
    assert fk.tg == []  # веб-пользователю в Telegram не пишем
    assert c.get("/api/access", headers={"Authorization": "Bearer " + tok[:-1] + ("0" if tok[-1] != "0" else "1")}).status_code == 401
    assert c.get("/api/access").status_code == 401


def test_validation_and_errors(env):
    c, fk, _ = env
    H = {"Authorization": "tma " + init_data(1)}
    assert c.post("/api/pay/create", headers=H, json={}).status_code == 422          # нет почты для чека
    assert c.post("/api/pay/create", headers={"Authorization": "tma " + init_data(1, token="1:X")}, json={"email": "a@b.ru"}).status_code == 401
    assert hook(c, "nonexistent").json()["ignored"] == "unknown payment"
    assert c.post("/api/yookassa/webhook", content=b"not json").status_code == 400
    assert c.post("/api/yookassa/webhook", json={"event": "refund.succeeded", "object": {"id": "x"}}).json()["ignored"] == "refund.succeeded"
    pid = c.post("/api/pay/create", headers=H, json={"email": "a@b.ru"}).json()["payment_id"]
    fk.succeed(pid); fk.fail_get = True
    assert hook(c, pid).status_code == 502   # ЮKassa недоступна -> 5xx, уведомление повторится
    fk.fail_get = False
    fk.payments[pid]["amount"] = {"value": "1.00", "currency": "RUB"}
    assert hook(c, pid).json()["ignored"] == "amount"
    assert c.get("/api/access", headers=H).json()["active"] is False


def test_canceled_and_unconfigured(env, tmp_path):
    c, fk, _ = env
    H = {"Authorization": "tma " + init_data(2)}
    pid = c.post("/api/pay/create", headers=H, json={"email": "a@b.ru"}).json()["payment_id"]
    fk.payments[pid]["status"] = "canceled"
    assert hook(c, pid, "payment.canceled").json() == {"ok": True}
    c2 = TestClient(srv.create_app(srv.Settings(shop_id="", secret_key="", db_path=str(tmp_path / "u.sqlite"), reminders=False)))
    assert c2.post("/api/pay/create", json={"email": "a@b.ru"}).status_code == 503


def test_reminders(env):
    import asyncio
    c, fk, app = env
    H = {"Authorization": "tma " + init_data(42)}
    pid = c.post("/api/pay/create", headers=H, json={"email": "a@b.ru"}).json()["payment_id"]
    fk.succeed(pid); hook(c, pid); fk.tg.clear()
    now = datetime.now(timezone.utc)
    assert asyncio.run(srv.run_reminders(app, now)) == 0                       # до конца 30 дней — рано
    later = now + timedelta(days=28)
    assert asyncio.run(srv.run_reminders(app, later)) == 1
    assert fk.tg[0]["chat_id"] == 42 and "заканчивается" in fk.tg[0]["text"]
    assert asyncio.run(srv.run_reminders(app, later + timedelta(hours=5))) == 0  # только один раз
