// Фастфуд: лимит в плане (none 0 / some ≤2 / often ≤4), белок/ккал, аллергии, UI q7 и чип «Фастфуд». node tools/qa_fastfood.mjs [url]
import { chromium } from 'playwright-core';
const url=process.argv[2]||'http://127.0.0.1:8765/';
const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
const page=await b.newPage({viewport:{width:390,height:844}});
const errs=[]; page.on('pageerror',e=>errs.push(e.message));
await page.route('**/telegram-web-app.js',r=>r.fulfill({body:'',contentType:'application/javascript'}));
await page.goto(url); await page.waitForTimeout(1000);
const res=await page.evaluate(()=>{
 const out={rows:[],fails:[]};
 const ff=RECIPES.filter(r=>r.tags.includes('fastfood'));
 out.nFF=ff.length; out.nAll=RECIPES.length; out.noImg=ff.filter(r=>!HAS_R.has(r.id)).map(r=>r.id);
 const P=[['base',{}],['kids',{kids:2,diets:['kids']}],['gluten',{allergies:['gluten']}],['dairy',{allergies:['dairy']}],['sesame',{allergies:['sesame']}],['hp',{diets:['hp']}],['veg',{diets:['veg']}],['air',{equip:['stove','oven','air']}],['tight',{budget:3500}],['4ad',{adults:4}]];
 const CAP={none:0,some:2,often:4};
 for(const mode of ['none','some','often']) for(const [nm,patch] of P) for(let k=0;k<6;k++){
  S=fresh(); S.A.store='p5'; Object.assign(S.A,{ff:mode},patch); if(S.A.budget==null) S.A.budget=defaultBudget();
  let err=null; try{ generatePlan('ff'+mode+nm+k); }catch(e){ err=e.message; }
  if(err){ out.fails.push(mode+'/'+nm+'/'+k+' ERR '+err); continue; }
  const sl=S.plan.slots.filter(s=>s.r&&!s.hidden); const n=sl.filter(s=>isFF(RMAP[s.r])).length;
  const AL=S.A.allergies.filter(x=>x!=='none'); let alv=0; sl.forEach(s=>recipeIngs(RMAP[s.r]).forEach(i=>{ if(AL.some(a=>ING[i.k].flags.includes(a))) alv++; }));
  const viol=sl.filter(s=>whyNot(RMAP[s.r])).length; const sauce=sl.filter(s=>RMAP[s.r].tags.includes('sauce')).length;
  const T=targets(), days=dayOrder(); const pOk=days.filter(d=>dayTotals(d).p>=T.ref.pmin-0.5).length, kOk=days.filter(d=>Math.abs(dayTotals(d).k-T.ref.k)<=T.ref.k*0.1).length;
  out.rows.push({mode,nm,k,n,pOk,kOk,nd:days.length});
  if(n>CAP[mode]) out.fails.push(`${mode}/${nm}/${k}: fastfood ${n}>${CAP[mode]}`);
  if(alv||viol) out.fails.push(`${mode}/${nm}/${k}: allergy ${alv} viol ${viol}`);
  if(sauce) out.fails.push(`${mode}/${nm}/${k}: sauce in plan`);
 }
 // UI: q7 group + фильтр «Фастфуд»
 S=fresh(); S.screen='q7'; try{ render(); }catch(e){}
 out.q7=[...document.querySelectorAll('[data-act="ffm"]')].map(x=>x.textContent.trim()+(x.classList.contains('sel')?'*':''));
 return out; });
const by={}; res.rows.forEach(r=>{ const k=r.mode; by[k]=by[k]||{plans:0,maxFF:0,sumFF:0,pOk:0,kOk:0,nd:0}; const o=by[k]; o.plans++; o.maxFF=Math.max(o.maxFF,r.n); o.sumFF+=r.n; o.pOk+=r.pOk; o.kOk+=r.kOk; o.nd+=r.nd; });
console.log('recipes',res.nAll,'fastfood',res.nFF,'ff without image',res.noImg.length);
Object.entries(by).forEach(([m,o])=>console.log(`mode=${m} plans=${o.plans} maxFF=${o.maxFF} avgFF=${(o.sumFF/o.plans).toFixed(2)} proteinDaysOK=${o.pOk}/${o.nd} kcalDaysOK(±10%)=${o.kOk}/${o.nd}`));
console.log('q7 chips',JSON.stringify(res.q7));
console.log('pageerrors',errs.length, errs.slice(0,3).join(' | '));
console.log('SUMMARY fastfood fails',res.fails.length, res.fails.slice(0,10).join(' ; '));
if(res.fails.length||errs.length||res.noImg.length||res.q7.length!==3) process.exitCode=1;
await b.close();
