// проверка меток цен в списке покупок: node tools/qa_prices.mjs [url]
import { chromium } from 'playwright-core';
const url=process.argv[2]||'http://127.0.0.1:8765/';
const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
const p=await b.newPage({viewport:{width:390,height:844}}); p.on('pageerror',e=>console.log('PAGEERR',e.message));
await p.goto(url+'?v='+Date.now()); await p.waitForTimeout(2000);
for(const st of ['vkusvill','lenta','p5']){
const r=await p.evaluate((st)=>{ S=fresh(); S.A.store=st; S.A.budget=defaultBudget(); generatePlan('seed1'); S.screen='app'; S.tab='shop'; render();
 function process_screen(){ return 'main'; }
 const t=[...document.querySelectorAll('.ptag')].map(x=>x.textContent); return {screen:S.screen,n:t.length, real:t.filter(x=>x.startsWith('цена магазина')).length, sample:t.slice(0,3), sum:[...document.querySelectorAll('.sumcard .small')].map(x=>x.textContent).join(' | '), foot:[...document.querySelectorAll('.foot')].map(x=>x.textContent).join('').slice(0,260)}; },st);
console.log(st, JSON.stringify(r)); await p.screenshot({path:`/tmp/probe/shop_${st}.png`}); }
await b.close();
