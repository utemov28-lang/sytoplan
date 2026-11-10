// Paywall QA: node tools/qa_paywall.mjs [url] [outdir]
import { createRequire } from 'module'; const require=createRequire(import.meta.url); const { chromium }=require('playwright-core');
const url=process.argv[2]||'http://127.0.0.1:8765/', SD=process.argv[3]||'/workspace/sytoplan-qa/paywall';
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
const errs=[]; const b2=async()=>browser.newContext(); let fails=0; const ok=(c,m)=>{ console.log((c?'OK   ':'FAIL ')+m); if(!c) fails++; };
async function run(w,h,tag){
  const page=await (await browser.newContext({viewport:{width:w,height:h},deviceScaleFactor:2})).newPage();
  page.on('pageerror',e=>errs.push(tag+' '+e.message));
  await page.goto(url); await page.waitForTimeout(800);
  await page.click('[data-act=go]'); await page.click('[data-act=store][data-id=p5]');
  for(let i=0;i<14;i++){ if(await page.$('[data-act=build]')){ await page.click('[data-act=build]'); break; } if(await page.$('[data-act=pskip]')) await page.click('[data-act=pskip]'); else await page.click('[data-act=next]'); await page.waitForTimeout(60); }
  await page.waitForSelector('.nav',{timeout:15000}); await page.waitForTimeout(400);
  const fit=async lbl=>{ const f=await page.evaluate(()=>{ const sh=document.querySelector('#pwsheet'), inn=sh&&sh.querySelector('.pws-in'), btn=sh&&sh.querySelector('[data-act=pay]'); if(!sh) return null; const r=btn.getBoundingClientRect();
      const lis=[...sh.querySelectorAll('.pws-list li')]; return {sh:inn.scrollHeight,ch:inn.clientHeight,btnBottom:r.bottom,btnH:r.height,vh:innerHeight,n:lis.length,clipped:lis.filter(l=>l.scrollWidth>l.clientWidth+1).length,x:!!sh.querySelector('[data-act=pwclose]'),txt:sh.innerText}; });
    ok(!!f,`${tag} ${lbl} sheet shown`); if(!f) return;
    ok(f.sh<=f.ch,`${tag} ${lbl} no scroll ${f.sh}<=${f.ch}`); ok(f.vh-f.btnBottom<=120&&f.btnBottom<=f.vh,`${tag} ${lbl} button near bottom (gap ${Math.round(f.vh-f.btnBottom)}px)`);
    ok(f.btnH>=52,`${tag} ${lbl} button ${Math.round(f.btnH)}px`); ok(f.n<=6&&f.clipped===0,`${tag} ${lbl} ${f.n} benefits, clipped ${f.clipped}`); ok(f.x,`${tag} ${lbl} close ✕`);
    ok(/Первый день — бесплатно/.test(f.txt)&&/590\s₽ за 30 дней/.test(f.txt)&&/меньше 20/.test(f.txt)&&/Оплатить 590/.test(f.txt)&&/без автосписаний/.test(f.txt),`${tag} ${lbl} copy`); };
  await fit('initial'); await page.screenshot({path:`${SD}/paywall_v3_${tag}.png`});
  ok(await page.evaluate(()=>document.querySelectorAll('.dayh:not(.lockin .dayh)').length)===1,`${tag} exactly 1 free day`);
  await page.click('[data-act=pwclose]'); await page.waitForTimeout(150); ok(!(await page.$('#pwsheet'))&&!!(await page.$('.lockwrap')),`${tag} ✕ closes -> preview with locked days`);
  { const o=await page.evaluate(()=>[document.documentElement.scrollWidth,document.documentElement.clientWidth]); ok(o[0]<=o[1],`${tag} no h-overflow ${o}`); }
  await page.click('.nav [data-id=shop]'); await page.waitForTimeout(200); await fit('from-locked-tab');
  ok(await page.evaluate(()=>S.tab)==='week',`${tag} stays on week`); await page.click('[data-act=pwclose]');
  await page.click('.lockwrap'); await page.waitForTimeout(150); ok(!!(await page.$('#pwsheet')),`${tag} locked day -> paywall`);
  await page.click('#pwsheet [data-act=pay]'); await page.waitForTimeout(150); ok(!!(await page.$('#modal .pw-test')),`${tag} test-payment confirm labeled`);
  
  await page.click('[data-act=paytest]'); await page.waitForTimeout(300);
  const after=await page.evaluate(()=>({pw:!!document.querySelector('#pwsheet'),lw:!!document.querySelector('.lockwrap'),acc:hasAccess(),until:JSON.parse(localStorage.getItem('kastr_access_v1')).until}));
  const dd=(new Date(after.until)-Date.now())/864e5; ok(after.acc&&!after.pw&&!after.lw&&dd>29.9&&dd<30.1,`${tag} access granted ~30d (${dd.toFixed(2)})`);
  { const o=await page.evaluate(()=>{ const sh=document.querySelector('#oksheet'); if(!sh) return null; const inn=sh.querySelector('.pws-in'), b=sh.querySelector('.pws-btn').getBoundingClientRect(); return {sh:inn.scrollHeight,ch:inn.clientHeight,gap:innerHeight-b.bottom,h:b.height,t:sh.innerText,seg:sh.querySelectorAll('.seg button').length}; });
    ok(!!o&&/Доступ открыт до \d\d\.\d\d/.test(o.t)&&o.seg===2,`${tag} success sheet «Доступ открыт до» + iPhone/Android`);
    if(o){ ok(o.sh<=o.ch,`${tag} success no scroll ${o.sh}<=${o.ch}`); ok(o.gap<=120&&o.h>=52,`${tag} success button near bottom (gap ${Math.round(o.gap)})`); ok(/Перейти к меню/.test(o.t),`${tag} success CTA`); }
    if(tag==='360x640') await page.screenshot({path:`${SD}/success_360.png`});
    await page.click('#oksheet [data-act=instos][data-id=android]'); await page.waitForTimeout(80); ok(/Chrome/.test(await page.evaluate(()=>document.querySelector('#oksheet').innerText)),`${tag} android steps`);
    { const f=await page.evaluate(()=>{ const i=document.querySelector('#oksheet .pws-in'); return i.scrollHeight<=i.clientHeight; }); ok(f,`${tag} android no scroll`); }
    await page.click('#oksheet .pws-btn'); await page.waitForTimeout(150); ok(!(await page.$('#oksheet')),`${tag} «Перейти к меню» closes`); }
  await page.click('.nav [data-id=shop]'); await page.waitForTimeout(150); ok(await page.evaluate(()=>S.tab)==='shop'&&!(await page.$('#modal')),`${tag} shop opens after pay`);
  await page.click('.nav [data-id=profile]'); await page.waitForTimeout(150); const t=await page.evaluate(()=>document.querySelector('.accrow').innerText); ok(/до \d\d\.\d\d/.test(t),`${tag} profile shows «${t.split('\n').slice(0,2).join(' ')}»`);
  
  await page.click('[data-act=install]'); await page.waitForTimeout(120); ok(!!(await page.$('#oksheet')),`${tag} profile «Добавить на экран» opens instructions`); await page.click('#oksheet [data-act=okclose]');
  // persistence across restart
  await page.reload(); await page.waitForTimeout(600); ok(await page.evaluate(()=>hasAccess()),`${tag} access persists after reload`);
  await page.close();
}
await run(360,640,'360x640'); await run(390,844,'390x844'); await run(1280,800,'desktop');
{ const r=await (await b2()).request.get(url+'manifest.webmanifest'); const m=await r.json(); ok(m.short_name==='Кастрюлька'&&m.display==='standalone'&&m.icons.some(i=>i.sizes==='512x512'),'manifest ok'); }
// pay=off override
{ const page=await (await browser.newContext()).newPage(); await page.goto(url+'?pay=off'); await page.waitForTimeout(500); ok(await page.evaluate(()=>hasAccess()),'?pay=off grants (non-live only)'); await page.close(); }
ok(!errs.length,'no page errors '+errs.join(' | ')); await browser.close(); console.log(fails?`${fails} FAIL`:'ALL OK'); process.exit(fails?1:0);
