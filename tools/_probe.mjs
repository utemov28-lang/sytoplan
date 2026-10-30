import { createRequire } from 'module'; const require=createRequire(import.meta.url); const { chromium }=require('playwright-core');
const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
const p=await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message)); p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
await p.goto('http://127.0.0.1:8765/'); await p.waitForTimeout(1500);
const out=await p.evaluate(()=>{ const rd=RECIPES.filter(isReady); const info=rd.map(r=>`${r.id} k${r.k} p${r.p} ${Math.round(portionCost(r))}₽ al:${r.al.join('/')} kind:${r.kind}`);
  const runs={}; const prof=[['def',{}],['lact',{allergies:['lactose']}],['gain',{goal:'gain'}],['off',{ready:false}],['snack',{meals:['b','l','d','s']}]];
  for(const [n,o] of prof){ S=fresh(); Object.assign(S.A,{store:'p5',adults:2,kids:0},o); try{ if(n==="snack") fitBudget=()=>{}; generatePlan(n+"s7"); }catch(e){ runs[n]="ERR "+e.message; continue; }
    const sl=S.plan.slots.filter(x=>x.r&&!x.hidden); const per={}; sl.forEach(x=>{ if(isReady(RMAP[x.r])) per[x.d]=(per[x.d]||[]).concat(x.r); });
    runs[n]=JSON.stringify(per)+' bad:'+sl.filter(x=>isReady(RMAP[x.r])&&RMAP[x.r].al.some(a=>allergyIds().includes(a))).length; }
  return {info,runs}; });
console.log(out.info.join('\n')); console.log(out.runs); console.log('ERR',errs.slice(0,5)); await b.close();
