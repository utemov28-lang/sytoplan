// Индекс рецептов для расшифровки кодов отзывов (fb_d<base36>_<причина>): data/recipe_index.json. node tools/recipe_index.mjs [url]
import { chromium } from 'playwright-core'; import fs from 'fs';
const url=process.argv[2]||'http://127.0.0.1:8765/';
const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']}); const p=await b.newPage();
await p.route('**/telegram-web-app.js',r=>r.fulfill({body:'',contentType:'application/javascript'})); await p.goto(url); await p.waitForTimeout(800);
const idx=await p.evaluate(()=>RECIPES.map((r,i)=>[i.toString(36),r.id,r.t]));
fs.writeFileSync(new URL('../data/recipe_index.json',import.meta.url),JSON.stringify({generated:new Date().toISOString().slice(0,10),recipes:idx},null,0));
console.log('recipes',idx.length); await b.close();
