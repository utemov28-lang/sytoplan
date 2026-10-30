// анализ калорийности рецептов: node tools/kcal.js
const fs=require('fs'),vm=require('vm');const ctx={console};vm.createContext(ctx);
for(const f of ['data','recipes_base','recipes_more1','recipes_more2','recipes_more3']) vm.runInContext(fs.readFileSync('js/'+f+'.js','utf8').replace(/^const /gm,'var '),ctx);
vm.runInContext('RECIPES.forEach(r=>{normalizePortion(r);calcNutrition(r)})',ctx);
const R=ctx.RECIPES;const SOUP=/суп|борщ|(^|\s)щи(\s|$)|окрошка|солянка|рассольник|^уха(\s|$)|харчо|шурпа|свекольник|гаспачо|минестроне|бульон/i;
const cat=r=>r.kind;
const g={};R.forEach(r=>{(g[cat(r)]=g[cat(r)]||[]).push(r)});
for(const k in g){const a=g[k].map(r=>r.k).sort((x,y)=>x-y);console.log(k,a.length,'min',a[0],'med',a[a.length>>1],'max',a[a.length-1],'avg',Math.round(a.reduce((s,x)=>s+x,0)/a.length));}
if(process.argv[2]) g[process.argv[2]].sort((x,y)=>x.k-y.k).forEach(r=>console.log(r.k,r.id,r.t,r.m,r.sv,JSON.stringify(r.ing.map(i=>i.k+':'+i.q))));
