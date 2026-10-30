# Phase 1 progress (executor notes, resume point after compaction)
Structure: index.html (shell+CSS+tg script), js/data.js (consts, ING catalog w/ nutrition), js/recipes*.js, js/app.js, img/r/<recipeId>.webp, img/i/<name>.webp
Image gen: cursor GenerateImage -> assets dir hash.jpg; record "name hash" lines in tools/imgmap.txt; tools/convert.py makes webp.
Photo prompt style: overhead top-down, white ceramic plate/bowl, light warm-grey linen background, soft natural daylight, home plating, no text.
Illustration style: soft 3D clay render, pastel, single object centered, plain white bg, no text.
Steps: [ ] data+recipes  [ ] app refactor/design  [ ] illustrations  [ ] recipe photos  [ ] QA  [ ] push+verify  [ ] screenshots

## Phase 1 (Oct 30, 2026) — content + design
- 199 recipes (КБЖУ per 100 g calculated from ingredients), categories via rcat().
- 60 GenerateImage jobs: 30 clay illustrations (welcome/loading/empty, meals, equipment, diets, styles; 1 discarded), 30 recipe photos (top of tools/rank.txt) + syrniki = 31 photos.
- Remaining recipes use a gradient + category illustration fallback; pantry tiles use emoji.
- Telegram: theme, safe areas, BackButton, HapticFeedback, disableVerticalSwipes; works in a normal browser.
- QA: tools/qa.mjs (browser|tg), screenshots in /workspace/sytoplan-screens/.
- Next: real prices, then the server.

## Фаза 2 — реальные цены + сытные порции (30.10.2026)
- Сытность: js/data.js `normalizePortion()` — гарнир/хлеб + масштаб до минимумов (завтрак ≥420, основное ≥560, суп ≥350, салат ≥330 ккал);
  app.js `topUpKcal()` — авто-перекус, если день < 1700 ккал на взрослого (подсказка «добавлено для сытости»);
  неделя показывает «ккал на взрослого · на семью». 9 профилей: среднее 1274 → ~1870 ккал/взрослый/день (tools/profiles.mjs).
- Цены: tools/update_prices.py → data/prices.json (Росстат: еженедельные цены РФ на 26.10.2026 + ежемесячные за 09.2026),
  × коэффициент сети (STORE_COEF, источники в коде). 96/117 ингредиентов (82%) — от Росстата (66 прямо, 30 производно), 21 — запасные.
  Сайты сетей (5ka, Перекрёсток, Магнит, Лента, Ашан) анонимно не отдают каталоги — прямых цен магазинов нет.
- Бюджет по умолчанию: медиана стоимости порции по приёму пищи × 1,2 (упаковки), + авто-перекусы.

## Phase 3 — QA fixes + meat recipes + КБЖУ targets (2026-10-30)
- QA items 1–27 addressed (edit→rebuild, Сохранить/edit mode, budget from trial plan, portion cap 1.3, sides only for mains, variety ≤2 repeats, honest low-meal texts, specific spices, rest time, fallback photos, caret, В план modal, 360px, tap targets, allergens incl. mustard, contrast, price note, aisles fish/canned, swap sheet+undo, dedupe, servings, budget cap 200 000, empty search, copy unbought, ~1.5s rebuild, plurals).
- js/recipes_meat.js: 50 meat (chicken 15, turkey 10, beef 12, pork 13) + 10 lean/no-stove + 2 protein snacks. New ingredients priced via Rosstat mapping.
- New optional step q2b «Параметры для расчёта КБЖУ» (Mifflin-St Jeor × activity, goal, protein g/kg floor, kids by age MR 2.3.1.0253-21); per-person portion factor vs 2200 kcal standard portion; protein floor hard (swap/protein snack), kcal ±10%, fiber/added sugar tracked.
- 9 profiles: avg 2076 kcal/adult/day; protein ≥1.0 g/kg 56/63 days, ≥target 52/63, kcal ±10% 57/63; meat share 64% in unrestricted profiles.

## Phase 4 — stores, +recipes, photos
### (a) Stores
- Дикси removed; saved state with store 'dixy' migrates to Пятёрочка (STORE_ALIAS in js/data.js).
- Added Самокат (×1.14), Яндекс Лавка (×1.18), ВкусВилл (×1.20) — estimates from public basket comparisons (sources in tools/update_prices.py).
- Store logos (by user request, the user accepted the trademark risk): official app icons from the App Store (itunes search API, 160px WebP) for
  p5, magnit, perek, auchan, samokat, lavka, vkusvill; Лента — official sunflower mark (Wikimedia Commons «New logo of Lenta.svg») on brand blue.
  Files: img/stores/<id>.webp|svg; single config = STORES[].logo in js/data.js. If logo is empty or fails to load, a brand-coloured tile (bg/color/ini) is shown.
  To replace with licensed artwork: drop a file into img/stores/ and change the path in STORES.
### (b) +39 recipes → 300 total (js/recipes_more5.js)
- 9 fish (минтай ×5, хек, скумбрия, сельдь ×2, тунец, сайра), 14 veg/lean high-protein (чечевица, нут, фасоль, яйца, творог), 10 budget GF dishes (сосиски, фарш, голени, печень), 4 no-stove.
- 9 profiles after: avg 2107 kcal; protein ≥1.0 g/kg 61/63 days, ≥target 55/63; kcal ±10% 55/63; veg+gluten maxRep 3→2, lean kcal 7/7.
### (c) Recipe photos — 300/300
- Generated food photos (one consistent style: top-down, white plate, light linen), tools/imgmap.txt → tools/convert.py →
  img/r/<id>.webp 800×600 + img/r/s/<id>.webp 320×240 thumbnails, lazy-loaded; list in js/images.js (IMG_R). Fallback = clay illustration / emoji.
- Spot-check of 30 random thumbnails: no obvious mismatches (known minor: beef_azu potatoes look pasta-like, turkey_steam — accepted).
### (d) Pantry tiles — 27 clay illustrations
- p_<key> in img/i/ (256px WebP, same clay style as eq_*/diet_*), 57 illustrations total; q10 tiles use ill('p_'+key) with emoji fallback.
- To redo one image: generate, replace hash in tools/imgmap.txt, run `python3 tools/convert.py`.
### Final checks (30.10.2026)
- 9 profiles: avg 2107 kcal/adult/day, errors 0, maxRep 2, protein ≥1.0 g/kg 61/63 days, kcal ±10% 55/63.
- logic.mjs: 13 scenarios, 0 violations, 0 page errors, 0 empty slots.
- Known/left: auto bread side can add gluten to gluten-free plans (veg+gluten profile 1846 kcal, kOk 1/7); store prices = Rosstat × chain multiplier (estimates);
  logos are App Store icons; qa/flow.mjs needs update for the swap picker sheet (selector clicks after swap).
### Allergy-aware sides (30.10.2026)
- Sides are baked into recipes at load; the bread side made 36 soups/salads/no-stove mains count as gluten+sesame, so GF/sesame users lost them
  (no leak — over-filtering → low kcal). Now js/app.js applySides(): when the side's flags hit a user allergy, it swaps to a safe alt
  (SIDE_ALT: bread → rice_cakes «Хлебцы рисовые (без глютена)», 0.6× weight ≈ same kcal), recomputes r.al/КБЖУ and the serving step;
  reverts when the allergy is removed. Snacks/top-ups/protein snacks already come from candidates() → whyNot() (all filters).
- Assertions: tools/profiles.mjs and tools/qa_logic.mjs (copy of qa logic.mjs, `node tools/qa_logic.mjs [url]`) check every plan ingredient
  incl. sides/auto-snacks and every shopping-list item against allergies + veg/lean; exit 1 on violation.
- Results: veg+GF+dairy 1846 → 2120 kcal/adult/day (kcal ±10% 1/7 → 7/7); «все аллергии» 1764 → 2040; 11 profiles + 16 scenarios, 0 violations.

## Фаза 5: реальные цены магазинов (30.10.2026)
Правило: не обходим блокировки (без капчи, поддельных токенов, приватных API и смены прокси). Цена всегда обычная, без акций и карт лояльности.
- **Официальные открытые API (автоматически, `tools/store_prices.py`):**
  - ВкусВилл: MCP-сервер `mcp.vkusvill.ru/mcp`, публичный инструмент `vkusvill_products_search`, общий каталог; берётся `price.old`, если идёт акция.
  - Лента: Integration API `integration.api.lenta.com`, спецификация `lenta.com/llms.txt`, «аутентификация не используется»; ближайший к центру Москвы гипермаркет, канал lo; берётся `priceRegular`.
- **Сайты остальных сетей недоступны с box:** 5ka и Перекрёсток (JS-проверка «бот»), Магнит и Самокат (403), Лента и Ашан (сайт 401/403, Qrator), Лавка (403 «много запросов с IP» и адрес через /api/), Едадил (SSO).
  Проверено обычным headless Chrome без маскировки. Выход box в интернет идёт через не-российский IP 104.28.x, поэтому часть блоков, вероятно, по IP. В обычном браузере пользователя в РФ цены, скорее всего, видны, но с box это не проверить.
- **Ежемесячные снимки (`tools/store_csv.py`, `data/store_prices/README.md`):**
  - полный снимок Пятёрочки `p5_YYYY-MM.csv` и корзина `basket_YYYY-MM.csv` (25 продуктов × 8 сетей);
  - индекс сети к Пятёрочке считается по категориям, с общим индексом как запасным вариантом;
  - слои цен: цена магазина → Пятёрочка × индекс → Росстат × коэффициент.
  - Шаблоны с поисковыми запросами лежат в `data/store_prices/_template/`.
- **Приложение:** метки «цена магазина · дата», «оценка · индекс» и «оценка»; доля позиций с ценой магазина в списке покупок; метка у стоимости порции; честный текст priceNote.

## Phase 6 — Домашний фастфуд (30.10.2026)
- js/recipes_fastfood.js: 50 рецептов (кухня `ff`, тег `fastfood`): бургеры ×8, хот-доги ×4 (вкл. французский), шаурма ×5 (курица/свинина/говядина/на тарелке/овощная), фри духовка/аэрогриль/фритюрница, по-деревенски ×2, хашбрауны, наггетсы ×2, стрипсы ×2, крылышки ×2, рыбные палочки, пицца ×5, кесадилья ×2, буррито ×3, сэндвичи ×2, сосиски в тесте ×2, чебуреки, беляши, луковые кольца, соусы ×3 (сырный, чесночный, BBQ — тег `sauce`, в план не попадают).
- КБЖУ из ингредиентов (масло фритюра — впитавшееся ~10–15%); новые ингредиенты: булочки для бургеров/хот-догов, багет, дрожжи; оборудование «Фритюрница» (eq_fryer).
- Фото 800×600 + превью 320×240 WebP для всех 50 (350/350 рецептов с фото).
- Анкета q7: «Домашний фастфуд: не нужен / иногда (до 2) / часто (до 4)», по умолчанию «иногда». Лимит соблюдается в generatePlan, balanceDays, fitBudget (ручная замена — без лимита).
- Рецепты: чип «Фастфуд». Кухня `ff` скрыта из «Любимых кухонь».
- QA: tools/qa_fastfood.mjs — 180 планов (3 режима × 10 профилей × 6 сидов): max фастфуда 0/2/4, белок ≥ цели 1260/1260 дней, ккал ±10% 1213/1260, аллергий 0.

## Phase 7 — Корзина Ашан/Лавка, индексы к Ленте (30.10.2026)
- data/store_prices/basket_2026-10_auchan_lavka.csv: 24+24 обычные цены (Москва, 30.10.2026).
- store_csv.py: база индексов = Пятёрочка, а если её снимка нет — Лента (API). Несопоставимые пары и выбросы (больше чем в 2,5 раза от медианы) не идут в индекс. Для оценок по индексу та же проверка правдоподобия, что для снимков (0,4–2,5 × Росстата). Корзина может лежать в нескольких файлах; английские единицы; банан поштучно (0,18 кг).
- Индексы к Ленте: Ашан 0,914 (овощи/фрукты 0,902, молочка 0,888, бакалея 0,986, мясо — общий); Лавка 1,423 (1,701 / 1,132 / 1,498, мясо — общий); ВкусВилл 1,36.
- Покрытие (цена магазина + индекс): Лента 83,3 %, Ашан 18,2 + 65,9 = 84,1 %, Лавка 18,2 + 62,1 = 80,3 %, ВкусВилл 85,6 + 6,8 = 92,4 %; Пятёрочка, Магнит, Перекрёсток, Самокат — Росстат × коэффициент (STORE_COEF не меняли: нет данных по этим сетям).
- Новое фото клаб-сэндвича (без бекона).

## Phase 8 — отзывы и удержание (30 окт 2026; в задаче пользователя — «Phase 6»)
**Отзывы (без сервера).** На карточке блюда в неделе — «👎 Не моё», на странице рецепта — 👍/👎. Причины: невкусно / долго / дорого / нет ингредиентов / не ем такое.
👎 скрывает блюдо из подбора (`S.A.bad`, фильтр в `candidates()`), предлагает «Заменить в плане» и «Написать в бот». Вернуть — Профиль → «Скрытые блюда». 👍 (`S.A.likes`) даёт +1.2 к баллу рецепта.
Профиль → «Оставить отзыв» (`fb_gen`). Доставка: `Telegram.WebApp.openTelegramLink('https://t.me/sytoplan_bot?start=<код>')`, вне Telegram — копирование текста + ссылка на бота.
Код: `fb_<d|l><индекс рецепта base36>[_<t|l|e|n|x>]`, напр. `fb_d9p_t`; индекс → `data/recipe_index.json` (`node tools/recipe_index.mjs` — перегенерировать при изменении порядка рецептов!).
**Бот** (`/workspace/sytoplan-bot/bot.py`): `/start fb_*` и `/feedback` → «спасибо» + «Напиши пару слов, что улучшить (или /skip)»; следующий текст (или /skip, или 20 мин тишины) → строка в `feedback.jsonl` (chat_id, username, code, decoded, text, time) и короткая сводка владельцу 230360927. Остальное — прежнее приветствие с кнопкой. Ожидания хранятся в `pending.json`. Отчёт: `python3 tools/feedback_report.py`.
**Удержание.**
- «Сегодня лень» — кнопка у каждого дня: блюда дня → ≤20 мин или без плиты/духовки и ≤30 мин (`isLazy`), подбор по близким ккал/белку + `balanceDays(cands,day,isLazy)`; «вчерашнее» не трогаем; отмена — снимок слотов (`plan.lazyPrev`).
- «Где дешевле» — карточка в «Покупках» + шторка: та же корзина (те же упаковки) в 8 сетях, сортировка, «цена магазина N/M» и «индекс K», выбор сети одним нажатием.
- «Готовим на 2 дня» (`A.cook2`, шаг q7 и профиль): ужин готовится двойной порцией → обед завтра «🍲 вчерашнее» (если в плане только обед или только ужин — тот же приём через день). Только `c2Ok` (основное/суп, не фастфуд). В списке покупок — обе порции (каждый слот считается); повтор «приготовлено» ≤3. Белковая замена источника разрешена, если день-получатель остаётся в норме.
- «Из остатков» — Рецепты → «🧊 Из остатков»: чипы продуктов (≥3 рецепта), ранжирование: всё есть → доля совпадений → меньше докупать; «В план».
- Экспорт: «✈️ Отправить в Telegram» (`t.me/share/url?url=&text=`, обрезка ~1400 знаков по строкам + «… и ещё N позиций»), список — чек-лист ☐/☑ по отделам; «Скопировать» как раньше.
**Тесты:** `node tools/qa_retention.mjs` — остатки, 2 дня (кол-ва в покупках = сумма по слотам, вчерашнее = вчерашний источник), лень (всё быстрое, аллергены/диета, белок 72/72, ккал ±10 % 67/72 vs 60/72 до), сравнение сетей, коды отзывов, 360px и кнопки ≥44px. Логика 16/0, профили, цены, фастфуд — без регрессий.

## QA-фиксы по 3 персонам (roles/REPORT.md)
- P0: чипсы «не люблю» в анкете (дубль `case 'dislike'`) — 👎 блюда теперь `dislikedish`; qa.mjs проверяет выбор чипсов.
- P1: 👎 заменяет все вхождения блюда в плане (`replaceAllOf`); недельные цели по каждому едоку (без «на семью» для одного); «Орехи» ⊃ арахис (`allergyIds`);
  набор массы — fitBudget не режет ккал ниже 90 %, до 3 авто-перекусов, честное предупреждение «Не добираем калории»; фастфуд «часто» — hp-порог 0.15 для FF + `ensureFF`;
  стиль «быстро» — жёстко ≤25 мин без настаивания (ослабление 35 → все с пометкой ⏱); текст бюджета «Даже самый экономный план ≈ X (бюджет Y)»;
  «на 2 дня» — блюдо ≤2 дней подряд; стейплы (гречка/рис/макароны…) ≤3–4 раз (картофель ≤5–6); дети — бонус kids на обед/ужин, малышам <7 — без острого / пометка «детям без чеснока»;
  «Где дешевле» — 🏆 только среди сетей с ≥50 % цен магазина, остальные «оценка ±15 %».
- P2: аллергия «Лактоза» (безлактозные молоко/кефир/йогурт/сливки/сметана/творог ×1.5 оценка; сыр/масло/фета ок); дельта корзины в тосте «лень»; тост на 360px;
  логотипы в сравнении; «Собрать корзину» → «Отправить список покупок»; назад из «Из остатков»; сортировка остатков по совпадениям; минимум бюджета = min(оценка, корзина).
- Бот не трогали (по указанию). Порядок рецептов не менялся.

## Фаза 9A — «Готовое из магазина» (js/recipes_ready.js)
- 17 позиций (тег ready, prep 0): скир, протеиновые йогурт/пудинг/коктейль, зернёный творог, творог с ягодами, кефир, протеиновый батончик,
  курица гриль ¼, запечённая грудка, буженина, варёные яйца, сырные палочки, тунец с хлебцами, хумус с хлебцами, «Цезарь», сэндвич.
- Новые ING добавляются в самом файле (data.js ING_RAW не трогали). КБЖУ — типичные значения с упаковок популярных марок; цены — оценка
  полочной цены (в приложении помечаются «оценка»); кефир/творог/тунец — реальные цены магазинов.
- Фото: READY_IMG → существующие фото рецептов (r:) или иллюстрации (i:) + бейдж «🛒 готовое». Генерации нет.
- Планировщик: S.A.ready (по умолчанию true) — анкета q7 + профиль; ≤1 готового в день (rdOk в balanceDays, −25 в recipeScore);
  ~половина дней с добором ккал берёт готовый перекус; аллергии/лактоза — через флаги ингредиентов. Чип «Готовое» в рецептах.

## Фаза 9B — подробные шаги (js/steps_detail.js)
- STEPS_DETAIL[id] заменяет шаги после normalizePortion (масштаб r.scaled учтён, шаг гарнира сохраняется); ингредиенты/КБЖУ не меняются.
- Рендер stepsHTML: количества в шагах пересчитываются на выбранные порции (scaleStepText), для старых рецептов — чипы ингредиентов шага
  с количеством, кнопки ⏱ таймера по «N минут», «Совет:» отдельной плашкой.
- Порядок по tools/rank.txt (частота в планах). Партии 1–4: топ-240 (из 350 своих рецептов; готовое не требует). Осталось 110 — следующий id с позиции 241 (node tools/_dump.mjs 240 300; после 300-й позиции _dump выдаёт неранжированные рецепты, _dump/_chk — локальные утилиты, в .gitignore).
- Проверка tools/_chk.mjs: техника в шагах ↔ eq рецепта; числа г/мл ↔ количества ингредиентов (вода/части соли — норм).
