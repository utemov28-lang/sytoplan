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
