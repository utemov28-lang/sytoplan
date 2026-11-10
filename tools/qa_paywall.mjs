// Paywall QA: node tools/qa_paywall.mjs [url] [outdir]
import { createRequire } from 'module'; const require=createRequire(import.meta.url); const { chromium }=require('playwright-core');
const url=process.argv[2]||'http://127.0.0.1:8765/', SD=process.argv[3]||'/workspace/sytoplan-qa/paywall';
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
const errs=[]; let fails=0; const ok=(c,m)=>{ console.log((c?'OK   ':'FAIL ')+m); if(!c) fails++; };
async function run(w,h,tag){
  const page=await (await browser.newContext({viewport:{width:w,height:h},deviceScaleFactor:2})).newPage();
  page.on('pageerror',e=>errs.push(tag+' '+e.message));
  await page.goto(url); await page.waitForTimeout(800);
  await page.click('[data-act=go]'); await page.click('[data-act=store][data-id=p5]');
  for(let i=0;i<14;i++){ if(await page.$('[data-act=build]')){ await page.click('[data-act=build]'); break; } if(await page.$('[data-act=pskip]')) await page.click('[data-act=pskip]'); else await page.click('[data-act=next]'); await page.waitForTimeout(60); }
  await page.waitForSelector('.nav',{timeout:15000}); await page.waitForTimeout(400);
  const st=await page.evaluate(()=>({pw:!!document.querySelector('.paywall'),lw:!!document.querySelector('.lockwrap'),days:document.querySelectorAll('.dayh').length,free:document.querySelectorAll('.dayh:not(.lockin .dayh)').length,sw:document.documentElement.scrollWidth,cw:document.documentElement.clientWidth,mode:PAYMENT.mode}));
  ok(st.mode==='test','mode test'); ok(st.pw&&st.lw,`${tag} paywall+locked days shown`); ok(st.free===1,`${tag} exactly 1 free day (${st.free}/${st.days})`); ok(st.sw<=st.cw,`${tag} no overflow ${st.sw}/${st.cw}`);
  await page.screenshot({path:`${SD}/paywall_${tag}.png`});
  if(tag==='360'){ const h=await page.evaluate(()=>{ const p=document.querySelector('.paywall'); return p.getBoundingClientRect().bottom+window.scrollY+20; }); await page.addStyleTag({content:'.nav,.navaction,.hdr{visibility:hidden}'}); await page.screenshot({path:`${SD}/paywall_v2_360.png`,clip:{x:0,y:0,width:360,height:Math.ceil(h)},fullPage:true}); await page.addStyleTag({content:'.nav,.navaction,.hdr{visibility:visible}'}); }
  ok(!!(await page.$('.navaction [data-act=pay]')),`${tag} sticky CTA`);
  { const t=await page.evaluate(()=>document.querySelector('.paywall').innerText); ok(/меньше 20/.test(t)&&/Бонусы/.test(t)&&/без автосписаний/.test(t),`${tag} paywall copy`); }
  await page.evaluate(()=>document.querySelector('.lockwrap').scrollIntoView({block:'start'})); await page.evaluate(()=>window.scrollBy(0,-120)); await page.waitForTimeout(200);
  await page.screenshot({path:`${SD}/preview_${tag}.png`});
  await page.click('.nav [data-id=shop]'); await page.waitForTimeout(200); ok(!!(await page.$('#modal .pw-groups')),`${tag} shop tab -> paywall modal`); if(tag==='360') await page.screenshot({path:`${SD}/paywall_v2_sheet_360.png`});
  ok(await page.evaluate(()=>S.tab)==='week',`${tag} stays on week`); await page.click('#modal [data-act=closemodal]');
  await page.click('.lockwrap'); await page.waitForTimeout(150); ok(!!(await page.$('#modal .pw-groups')),`${tag} locked day -> paywall`); await page.click('#modal [data-act=closemodal]');
  await page.click('.paywall [data-act=pay]'); await page.waitForTimeout(150); ok(!!(await page.$('#modal .pw-test')),`${tag} test-payment confirm labeled`);
  if(tag==='360') await page.screenshot({path:`${SD}/testpay_${tag}.png`});
  await page.click('[data-act=paytest]'); await page.waitForTimeout(300);
  const after=await page.evaluate(()=>({pw:!!document.querySelector('.paywall'),lw:!!document.querySelector('.lockwrap'),acc:hasAccess(),until:JSON.parse(localStorage.getItem('kastr_access_v1')).until}));
  const dd=(new Date(after.until)-Date.now())/864e5; ok(after.acc&&!after.pw&&!after.lw&&dd>29.9&&dd<30.1,`${tag} access granted ~30d (${dd.toFixed(2)})`);
  await page.click('.nav [data-id=shop]'); await page.waitForTimeout(150); ok(await page.evaluate(()=>S.tab)==='shop'&&!(await page.$('#modal')),`${tag} shop opens after pay`);
  await page.click('.nav [data-id=profile]'); await page.waitForTimeout(150); const t=await page.evaluate(()=>document.querySelector('.accrow').innerText); ok(/до \d\d\.\d\d/.test(t),`${tag} profile shows «${t.split('\n').slice(0,2).join(' ')}»`);
  if(tag==='360') await page.screenshot({path:`${SD}/profile_${tag}.png`});
  // persistence across restart
  await page.reload(); await page.waitForTimeout(600); ok(await page.evaluate(()=>hasAccess()),`${tag} access persists after reload`);
  await page.close();
}
await run(360,780,'360'); await run(1280,860,'desktop');
// pay=off override
{ const page=await (await browser.newContext()).newPage(); await page.goto(url+'?pay=off'); await page.waitForTimeout(500); ok(await page.evaluate(()=>hasAccess()),'?pay=off grants (non-live only)'); await page.close(); }
ok(!errs.length,'no page errors '+errs.join(' | ')); await browser.close(); console.log(fails?`${fails} FAIL`:'ALL OK'); process.exit(fails?1:0);
