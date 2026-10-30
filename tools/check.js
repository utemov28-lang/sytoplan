const fs=require('fs');const vm=require('vm');const d='/workspace/sytoplan/js/';
const code=['data.js','recipes_base.js','recipes_more1.js','recipes_more2.js','recipes_more3.js','recipes_more4.js'].filter(f=>fs.existsSync(d+f)).map(f=>fs.readFileSync(d+f,'utf8').replace(/'use strict';/g,'')).join('\n')+'\n;globalThis.RECIPES=RECIPES;globalThis.ING=ING;globalThis.calcNutrition=calcNutrition;';
vm.runInThisContext(code);
let bad=[];RECIPES.forEach(r=>{r.ing.forEach(x=>{if(!ING[x.k]||!(x.q>0))bad.push(r.id+':'+x.k)});if(r.steps.length<4||r.steps.length>8)bad.push(r.id+' steps '+r.steps.length);calcNutrition(r)});
const ids=RECIPES.map(r=>r.id);console.log('dupes',ids.filter((x,i)=>ids.indexOf(x)!=i));
console.log(RECIPES.length,'bad',bad);
if(process.argv[2])RECIPES.slice().sort((a,b)=>a.k-b.k).forEach(r=>console.log(r.k,r.p,r.f,r.cb,r.m.join(''),r.id));
