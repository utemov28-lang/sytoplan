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
  Сайты сетей (5ka, Перекрёсток, Магнит, Лента, Ашан, Дикси) анонимно не отдают каталоги — прямых цен магазинов нет.
- Бюджет по умолчанию: медиана стоимости порции по приёму пищи × 1,2 (упаковки), + авто-перекусы.
