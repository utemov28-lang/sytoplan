import fs from 'fs'; import vm from 'vm';
const ctx={console}; vm.createContext(ctx);
for(const f of ['data.js','recipes_base.js','recipes_more1.js','recipes_more2.js','recipes_more3.js','recipes_meat.js','recipes_more5.js','recipes_fastfood.js']) vm.runInContext(fs.readFileSync('js/'+f,'utf8').replace(/^'use strict';/,'').replace(/\bconst (RECIPES|ING|ING_RAW)\b/g,'var $1'),ctx);
const R=Object.fromEntries(ctx.RECIPES.map(r=>[r.id,r]));
const ids=fs.readFileSync('tools/rank.txt','utf8').split('\n').map(l=>l.split(' ')[0]).filter(id=>R[id]);
ctx.RECIPES.forEach(r=>{ if(!ids.includes(r.id)) ids.push(r.id); });
const [a,b]=process.argv.slice(2).map(Number);
for(const id of ids.slice(a,b)){ const r=R[id]; console.log(`## ${id} | ${r.t} | eq:${r.eq} | ${r.prep}+${r.cook}м | sv${r.sv}\nING: ${r.ing.map(i=>{const g=ctx.ING[i.k]; return g? `${g.name} ${i.q}${g.unit}`:i.k}).join('; ')}\nST: ${r.steps.join(' / ')}`); }
console.error('total ranked',ids.length,'all',ctx.RECIPES.length);
