import { chromium } from 'playwright-core';
const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']}); const p=await b.newPage();
await p.goto('http://127.0.0.1:8765/'); await p.waitForTimeout(800);
const r=await p.evaluate(()=>{ const cnt={}; RECIPES.forEach(r=>cnt[r.id]=0);
 const profs=[{},{diets:['lean']},{diets:['veg']},{diets:['hp']},{diets:['pp']},{diets:['kids'],kids:2},{equip:['stove','oven','micro','multi','air','blender','toaster']},{styles:['fast']},{styles:['batch','family']},{budget:3000},{budget:15000},{cuisines:['asia','it']},{cuisines:['cau','med']},{allergies:['dairy']},{allergies:['gluten']}];
 const base={store:'p5',adults:2,kids:0,meals:['b','l','d','s'],days:[0,1,2,3,4,5,6],equip:['stove','oven','micro'],diets:['none'],cuisines:[],styles:[],allergies:['none'],dislikes:[],pantry:[],budget:null};
 profs.forEach((pr,pi)=>{ for(let s=0;s<6;s++){ S.A=Object.assign(JSON.parse(JSON.stringify(base)),pr); if(S.A.budget==null) S.A.budget=defaultBudget(); generatePlan('r'+pi+'_'+s); S.plan.slots.forEach(x=>{ if(x.r) cnt[x.r]++; }); } });
 return Object.entries(cnt).sort((a,b)=>b[1]-a[1]).map(([id,n])=>id+' '+n+' '+RMAP[id].t+' |'+rcat(RMAP[id])); });
console.log(r.join('\n')); await b.close();
