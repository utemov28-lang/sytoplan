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
