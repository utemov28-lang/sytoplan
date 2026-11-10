# Кастрюлька API — оплата ЮKassa и доступ на 30 дней

Небольшой сервер на FastAPI + SQLite. Сайт остаётся на GitHub Pages; сервер нужен только для оплаты и проверки доступа.

| Метод | Путь | Что делает |
|---|---|---|
| POST | `/api/pay/create` | создаёт платёж в ЮKassa (REST API v3): 590.00 RUB, `capture: true`, чек 54-ФЗ (почта/телефон), `Idempotence-Key`, `return_url`; отдаёт `confirmation_url` |
| POST | `/api/yookassa/webhook` | уведомления `payment.succeeded` / `payment.canceled`; платёж **перепроверяется запросом к API**, затем доступ +30 дней (повторное уведомление ничего не меняет) |
| GET | `/api/access` | `{paid_until, active}` |
| GET | `/api/health` | проверка |

Кто пользователь — по заголовку `Authorization`:
* `tma <initData>` — внутри Telegram; подпись initData проверяется по `TG_BOT_TOKEN` (HMAC-SHA256);
* `Bearer <token>` — на сайте; токен выдаётся при первом `/api/pay/create` и подписан `ACCESS_TOKEN_SECRET`.

После оплаты бот пишет «✅ Доступ открыт до ДД.ММ.ГГГГ», за 3 дня до конца — напоминание (только пользователям из Telegram).
Бот для этого не нужен — сообщения отправляет сервер через Bot API.

## Аккаунты и вход на любом устройстве
| Метод | Путь | Что делает |
|---|---|---|
| POST | `/api/login/request` | `{email}` → письмо с одноразовой ссылкой `APP_URL?login=<token>` (15 мин). Лимиты: 1/мин и 5/час на почту, 20/час на IP. Ответ всегда `{ok:true}` |
| POST | `/api/login/confirm` | `{token}` → `{access_token}` (долгий, хранится в браузере) |
| POST | `/api/link/create` | (Bearer) → `t.me/<bot>?start=link_<token>` — привязать Telegram (15 мин) |
| POST | `/api/link/confirm` | (tma initData) `{token}` → Telegram-аккаунт сливается с аккаунтом по почте |
| GET/PUT | `/api/state` | состояние приложения (ответы анкеты, план, избранное, 👎); last-write-wins по `updated_at` (мс) |

* **Telegram:** никаких шагов — пользователь = проверенный `initData`, доступ и меню хранятся на сервере.
* **Сайт:** без регистрации. Единственное поле — почта в оплате (нужна для чека 54-ФЗ). После `payment.succeeded`
  сервер создаёт аккаунт `email:<почта>`, временный id браузера становится его алиасом, на почту уходит
  «Ваш доступ в Кастрюльку» со ссылкой входа (одноразовая, 7 дней).
* **Новое устройство / VPN:** «Уже оплачивали? Войти» (пейвол и Профиль) → почта → ссылка (15 мин) → доступ и меню восстановлены.
* **Связать с Telegram:** Профиль → «Связать с Telegram» → бот. Боту нужен обработчик `/start link_<token>`,
  который отвечает кнопкой Mini App на `APP_URL?link=<token>` (пример ниже); приложение внутри Telegram само вызывает `/api/link/confirm`.
  Вариант без правки бота: включить Main Mini App в @BotFather и использовать `t.me/<bot>?startapp=link_<token>` — приложение читает `start_param`.

```python
# в обработчике /start бота:
if arg.startswith("link_"):
    send(chat_id, "Нажмите, чтобы связать Telegram с вашим доступом:",
         reply_markup={"inline_keyboard": [[{"text": "🔗 Связать", "web_app": {"url": APP_URL + "?link=" + arg[5:]}}]]})
```

## Тесты
```bash
cd server && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python -m pytest -q tests      # ЮKassa и Telegram замоканы
```

## Деплой на VPS (Ubuntu 22.04/24.04)
1. DNS: A-запись `api.ваш-домен.ru` → IP сервера (без домена HTTPS не получить, а ЮKassa шлёт уведомления только на HTTPS).
2. Пакеты и пользователь:
   ```bash
   sudo apt update && sudo apt install -y python3-venv nginx certbot python3-certbot-nginx git
   sudo useradd -r -m -d /opt/kastryulka kastr
   sudo -u kastr git clone https://github.com/utemov28-lang/sytoplan /opt/kastryulka
   cd /opt/kastryulka/server && sudo -u kastr python3 -m venv .venv && sudo -u kastr .venv/bin/pip install -r requirements.txt
   sudo -u kastr mkdir -p /opt/kastryulka/data
   sudo -u kastr cp .env.example .env && sudo -u kastr nano .env && sudo chmod 600 .env
   ```
3. systemd:
   ```bash
   sudo cp kastryulka-api.service /etc/systemd/system/ && sudo systemctl daemon-reload
   sudo systemctl enable --now kastryulka-api && curl -s 127.0.0.1:8090/api/health
   ```
4. nginx + HTTPS:
   ```bash
   sudo cp nginx.conf.example /etc/nginx/sites-available/kastryulka-api   # поменяйте server_name
   sudo ln -s /etc/nginx/sites-available/kastryulka-api /etc/nginx/sites-enabled/
   sudo nginx -t && sudo systemctl reload nginx
   sudo certbot --nginx -d api.ваш-домен.ru      # сертификат и автопродление
   ```
5. Кабинет ЮKassa → **Интеграция → HTTP-уведомления**: URL `https://api.ваш-домен.ru/api/yookassa/webhook`,
   события `payment.succeeded` и `payment.canceled`.
6. Сайт: в `js/data.js` поставить
   `PAYMENT = { mode: 'live', price: 590, days: 30, apiBase: 'https://api.ваш-домен.ru' }`, закоммитить и запушить.
7. Проверка: сначала тестовый магазин ЮKassa (ключ `test_...`, тестовая карта `5555 5555 5555 4477`, любой срок/CVC),
   потом заменить ключи на боевые (`live_...`) и `systemctl restart kastryulka-api`.

Обновление: `cd /opt/kastryulka && sudo -u kastr git pull && sudo systemctl restart kastryulka-api`.
Бэкап: файл `DB_PATH` (SQLite) — копировать раз в сутки (`sqlite3 kastr.sqlite ".backup /backup/kastr-$(date +%F).sqlite"`).

## Безопасность
* Ключи только в `.env` (chmod 600), не в git и не в чате.
* Уведомлениям ЮKassa не доверяем — статус и сумма берутся из API. Дополнительно можно ограничить
  `/api/yookassa/webhook` в nginx IP-адресами ЮKassa (список в документации ЮKassa → «Входящие уведомления»).
* `return_url` принимается только с доменов из `ALLOWED_ORIGINS`.
* Важно: сайт статический — фронтенд скрывает платные разделы, но не шифрует их. Для MVP это нормально;
  при росте можно отдавать полный план с сервера только при активном доступе.
