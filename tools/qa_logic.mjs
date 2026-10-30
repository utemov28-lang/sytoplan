import { createRequire } from 'module'; import fs from 'fs';
const require=createRequire(import.meta.url); const { chromium }=require('playwright-core');
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
const page=await (await browser.newContext({viewport:{width:390,height:844}})).newPage();
page.on('pageerror',e=>console.log('PAGEERR',e.message));
await page.goto(process.argv[2]||'https://utemov28-lang.github.io/sytoplan/'); await page.waitForTimeout(1500);
const res=await page.evaluate(()=>{
 const out={profiles:[]};
 const P=[
  {name:'2 взр, всё',A:{}},
  {name:'1 взр + 3 дет',A:{adults:1,kids:3}},
  {name:'только перекусы',A:{meals:['s']}},
  {name:'1 день',A:{days:[2]}},
  {name:'все аллергии',A:{allergies:['nuts','peanut','dairy','eggs','gluten','fish','seafood','soy','sesame','honey']}},
  {name:'много нелюбимого',A:{dislikes:DISLIKES.slice(0,25).map(d=>d[0])}},
  {name:'крошечный бюджет 500',A:{budget:500}},
  {name:'огромный бюджет 100000',A:{budget:100000}},
  {name:'только микроволновка',A:{equip:['micro']}},
  {name:'вег+постное',A:{diets:['veg','lean']}},
  {name:'яйца+молоко аллергия, дети',A:{allergies:['eggs','dairy'],kids:2,adults:2}},
  {name:'ПП+белковое',A:{diets:['pp','hp']}},
  {name:'детское',A:{diets:['kids'],kids:2}},
  {name:'без глютена',A:{allergies:['gluten']}},
  {name:'вег + без глютена и молока',A:{diets:['veg'],allergies:['gluten','dairy']}},
  {name:'пантри много',A:{pantry:['eggs','milk','butter','oil','salt','sugar','flour','rice','buckwheat','pasta','onion','potato','carrot']}},
 ];
 P.forEach(p=>{ S=fresh(); S.A.store='p5'; Object.assign(S.A,p.A); if(S.A.budget==null) S.A.budget=defaultBudget();
   let err=null; try{ generatePlan('seed1'); }catch(e){ err=e.message; }
   const o={name:p.name,budget:S.A.budget,err};
   if(S.plan){ const sl=S.plan.slots; o.slots=sl.length; o.empty=sl.filter(s=>!s.r).length; o.auto=sl.filter(s=>s.auto).length;
     o.viol=sl.filter(s=>s.r&&whyNot(RMAP[s.r])).map(s=>s.r+':'+whyNot(RMAP[s.r]));
     /* Ингредиентная проверка: ни один ингредиент (включая гарниры и авто-перекусы) и ни одна позиция списка покупок не нарушает аллергии/диету */
     const AL=S.A.allergies.filter(x=>x!=='none'), D=S.A.diets, badF=fl=>AL.filter(a=>fl.includes(a)).concat(((D.includes('veg')||D.includes('lean'))&&(fl.includes('meat')||fl.includes('fish')||fl.includes('seafood')))?['diet']:[]).concat((D.includes('lean')&&(fl.includes('dairy')||fl.includes('eggs')))?['lean']:[]);
     o.ingViol=[]; sl.forEach(s=>{ if(!s.r) return; recipeIngs(RMAP[s.r]).forEach(i=>{ const b=badF(ING[i.k].flags); if(b.length) o.ingViol.push(s.r+':'+i.k+(i.side?'(гарнир)':'')+(s.auto?'(авто)':'')+':'+b.join('/')); }); });
     shopping().items.forEach(x=>{ const b=badF(ING[x.k].flags); if(b.length) o.ingViol.push('список:'+x.k+':'+b.join('/')); });
     const sh=shopping(); o.total=sh.total; o.sumItems=sh.items.reduce((a,x)=>a+x.price,0);
     o.pantryInList=sh.items.filter(x=>S.A.pantry.includes(x.k)).map(x=>x.k);
     o.uniq=new Set(sl.map(s=>s.r)).size; const cnt={}; sl.forEach(s=>{if(s.r)cnt[s.r]=(cnt[s.r]||0)+1}); o.maxRepeat=Object.entries(cnt).sort((a,b)=>b[1]-a[1]).slice(0,3);
     o.avgK=Math.round(dayOrder().reduce((a,d)=>a+dayTotals(d).k,0)/dayOrder().length);
     o.cands=Object.fromEntries(MEALS.map(m=>[m.id,candidates(m.id).length]));
     o.typical=Math.round(typicalCost()); o.status=budgetStatus(S.A.budget).title;
     o.meals=sl.slice(0,8).map(s=>s.m+':'+(s.r?RMAP[s.r].t:'—'));
   }
   out.profiles.push(o); });
 // kids scaling check: compare need with 1 adult vs 1 adult + 2 kids for same plan
 S=fresh(); S.A.store='p5'; S.A.budget=99999; generatePlan('k'); const n1=shopping().items.reduce((a,x)=>a+(x.k==='potato'?x.q:0),0);
 const t1=shopping(); S.A.kids=2; const t2=shopping(); out.kids={adults2:t1.items.map(x=>x.k+':'+Math.round(x.q)).slice(0,5), with2kids:t2.items.map(x=>x.k+':'+Math.round(x.q)).slice(0,5)};
 // dump recipes
 out.recipes=RECIPES.map(r=>({id:r.id,t:r.t,m:r.m.join(''),c:r.c,tags:r.tags.join(','),eq:r.eq.join(','),prep:r.prep,cook:r.cook,sv:r.sv,k:r.k,p:r.p,f:r.f,cb:r.cb,al:r.al.join(','),side:r.side||'',scaled:r.scaled||'',
   veg:DIETCHK.veg(r),lean:DIETCHK.lean(r),kids:DIETCHK.kids(r),cost:Math.round(portionCost(r)),
   ing:r.ing.map(i=>ING[i.k].name+' '+Math.round(i.q/r.sv*10)/10+ING[i.k].unit).join('; '),steps:r.steps}));
 return out; });
fs.writeFileSync('/tmp/logic.json',JSON.stringify(res,null,1));
res.profiles.forEach(p=>console.log(JSON.stringify(p)));
console.log('KIDS',JSON.stringify(res.kids));
const nV=res.profiles.reduce((a,p)=>a+(p.viol||[]).length+(p.ingViol||[]).length,0), nE=res.profiles.filter(p=>p.err||p.empty).length;
console.log('SUMMARY scenarios',res.profiles.length,'violations',nV,'errors/empty',nE);
if(nV) { console.log('ASSERTION FAILED', JSON.stringify(res.profiles.filter(p=>(p.ingViol||[]).length).map(p=>[p.name,p.ingViol.slice(0,5)]))); process.exitCode=1; }
await browser.close();
