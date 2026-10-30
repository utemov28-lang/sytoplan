const fs=require('fs');const vm=require('vm');const d=__dirname+'/../js/';
const files=fs.readFileSync(d+'../index.html','utf8').match(/js\/(data|recipes_[a-z0-9_]+)\.js/g).map(f=>f.slice(3));
const code=files.map(f=>fs.readFileSync(d+f,'utf8').replace(/'use strict';/g,'')).join('\n')+'\n;globalThis.RECIPES=RECIPES;globalThis.ING=ING;globalThis.calcNutrition=calcNutrition;globalThis.normalizePortion=typeof normalizePortion!=="undefined"?normalizePortion:null;';
vm.runInThisContext(code); module.exports={RECIPES,ING};
if(require.main===module){ const a=process.argv[2];
 if(a==='ing') console.log(Object.keys(ING).map(k=>k+'='+ING[k].name).join('; '));
 if(a==='titles') console.log(RECIPES.map(r=>r.id+'|'+r.t+'|'+r.m.join('')+'|'+r.tags.join('.')).join('\n'));
}
