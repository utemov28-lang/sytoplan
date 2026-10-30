// Phase 8: «Из остатков», «Готовим на 2 дня», «Сегодня лень», «Где дешевле», отзывы 👍/👎, экспорт списка. node tools/qa_retention.mjs [url]
import { chromium } from 'playwright-core';
const url=process.argv[2]||'http://127.0.0.1:8765/';
const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
const page=await b.newPage({viewport:{width:360,height:780}});
const errs=[]; page.on('pageerror',e=>errs.push(e.message));
await page.route('**/telegram-web-app.js',r=>r.fulfill({body:'',contentType:'application/javascript'}));
await page.goto(url); await page.waitForTimeout(1200);
const res=await page.evaluate(()=>{
 const out={fails:[],info:{}}; const F=(m)=>out.fails.push(m);
 const P=[['base',{}],['bd',{meals:['b','d']}],['veg',{diets:['veg']}],['kids',{kids:2}],['tight',{budget:3500}],['gluten',{allergies:['gluten']}],['hp',{diets:['hp']}],['batch',{styles:['batch']}]];
 const mk=(patch,seed)=>{ S=fresh(); S.A.store='p5'; Object.assign(S.A,JSON.parse(JSON.stringify(patch))); if(S.A.budget==null) S.A.budget=defaultBudget(); generatePlan(seed); };
 const okDay=(d)=>{ const T=targets().ref, t=dayTotals(d); return {p:t.p>=T.pmin-0.5, k:Math.abs(t.k-T.k)<=T.k*0.1}; };
 // ---- 1. Из остатков
 S=fresh(); S.A.store='p5'; S.A.budget=defaultBudget(); generatePlan('fr');
 S.fridge=['chicken_fillet','rice','onion','carrot','eggs']; const fm=fridgeMatches();
 out.info.fridge={n:fm.length,top:fm.slice(0,3).map(x=>x.r.id+' '+x.hit+'/'+x.n+' miss '+x.miss.length)};
 if(fm.length<10) F('fridge: too few matches '+fm.length);
 if(fm.some(x=>whyNot(x.r))) F('fridge: unfit recipe in results');
 for(let i=1;i<fm.length;i++){ const a=fm[i-1],c=fm[i]; if((a.miss.length===0)<(c.miss.length===0)) { F('fridge: complete recipes not first'); break; } }
 if(fm.slice(0,5).some(x=>x.hit<1)) F('fridge: top without hits');
 S.screen='app'; S.tab='recipes'; S.rmode='fridge'; render(); out.info.fridgeCards=document.querySelectorAll('.meal').length; if(!out.info.fridgeCards) F('fridge: no cards rendered');
 S.rmode='';
 // ---- 2. Готовим на 2 дня
 let pairs=0, plans=0, c2p=0,c2k=0,c2n=0;
 for(const [nm,patch] of P) for(let k=0;k<4;k++){ mk(Object.assign({cook2:true},patch),'c2'+nm+k); plans++;
  const sl=S.plan.slots, days=dayOrder(); const lf=sl.map((s,i)=>({s,i})).filter(o=>o.s.left&&o.s.r);
  if(lf.length<2 && nm!=='tight') F(`c2 ${nm}/${k}: only ${lf.length} leftovers`);
  pairs+=lf.length;
  lf.forEach(o=>{ const src=sl[o.s.src]; if(!src||src.r!==o.s.r) F(`c2 ${nm}/${k}: leftover recipe != source`);
    else if(days.indexOf(o.s.d)!==days.indexOf(src.d)+1) F(`c2 ${nm}/${k}: leftover not next day`);
    if(!c2Ok(RMAP[o.s.r])) F(`c2 ${nm}/${k}: not reheatable ${o.s.r}`); if(!mealOk(RMAP[o.s.r],o.s.m)) F(`c2 ${nm}/${k}: meal mismatch`); });
  // повторы: приготовлено (не остатки) не больше 3 раз
  const cooked={}; sl.forEach(s=>{ if(s.r&&!s.left&&!s.hidden) cooked[s.r]=(cooked[s.r]||0)+1; }); const mx=Math.max(...Object.values(cooked)); if(mx>3) F(`c2 ${nm}/${k}: cooked ${mx}x`);
  // одно блюдо — не больше 2 дней подряд
  const byR={}; sl.forEach(s=>{ if(s.r&&!s.hidden&&s.m!=='s'&&s.m!=='b') (byR[s.r]=byR[s.r]||new Set()).add(days.indexOf(s.d)); });
  Object.keys(byR).forEach(r=>{ const ds=[...byR[r]].sort((x,y)=>x-y); let run=1; for(let j=1;j<ds.length;j++){ run=ds[j]===ds[j-1]+1?run+1:1; if(run>2){ F(`c2 ${nm}/${k}: ${r} ${run} days in a row`); break; } } });
  // список покупок: на блюдо с «вчерашним» закупаем 2 порции (кол-во = сумма по всем приёмам)
  const need={}, p=portions(); sl.forEach(s=>{ if(s.r){ const r=RMAP[s.r]; recipeIngs(r).forEach(i=>{ need[i.k]=(need[i.k]||0)+i.q*p/r.sv; }); } });
  const sh=shopping(); const got={}; sh.items.concat(sh.home).forEach(x=>got[x.k]=x.q);
  Object.keys(need).forEach(kk=>{ if(Math.abs((got[kk]||0)-need[kk])>1e-6) F(`c2 ${nm}/${k}: qty ${kk} ${got[kk]} vs ${need[kk]}`); });
  if(lf.length){ const o=lf[0], r=RMAP[o.s.r], i0=recipeIngs(r)[0]; const solo=sl.filter(s=>s.r===r.id).length; if(solo<2) F('c2: pair counted once');
    const pq=i0.q*p/r.sv*solo; if((got[i0.k]||0)+1e-6<pq) F('c2: shopping misses double portion'); }
  const AL=S.A.allergies.filter(x=>x!=='none'); sl.forEach(s=>{ if(s.r&&AL.length&&recipeIngs(RMAP[s.r]).some(i=>AL.some(a=>ING[i.k].flags.includes(a)))) F(`c2 ${nm}/${k}: allergen`); if(s.r&&whyNot(RMAP[s.r])) F(`c2 ${nm}/${k}: whyNot`); });
  days.forEach(d=>{ const o=okDay(d); c2n++; if(o.p) c2p++; if(o.k) c2k++; });
 }
 out.info.cook2={plans,avgLeftovers:(pairs/plans).toFixed(1),proteinDays:c2p+'/'+c2n,kcalDays:c2k+'/'+c2n};
 if(c2p/c2n<0.85) F('c2: protein days rate low '+c2p+'/'+c2n);
 // ---- 3. Сегодня лень
 let lz=0, lp=0, lk=0, lpB=0, lkB=0, changed=0;
 for(const [nm,patch] of P.concat([['c2',{cook2:true}]])) for(let k=0;k<4;k++){ mk(patch,'lz'+nm+k); const days=dayOrder();
  for(const d of [days[1],days[4]]){ const before=JSON.stringify(S.plan.slots); const ob=okDay(d); if(ob.p) lpB++; if(ob.k) lkB++;
   const r=lazyDay(d); lz++; changed+=r.n; const sl=S.plan.slots;
   sl.forEach(s=>{ if(s.d!==d||!s.r||s.hidden||s.left) return; const R=RMAP[s.r]; if(!isLazy(R)) F(`lazy ${nm}/${k}/${d}: ${R.id} not lazy (${totalTime(R)} min)`); if(whyNot(R)) F(`lazy ${nm}/${k}: whyNot ${whyNot(R)}`); });
   const AL=S.A.allergies.filter(x=>x!=='none'); sl.forEach(s=>{ if(s.r&&AL.length&&recipeIngs(RMAP[s.r]).some(i=>AL.some(a=>ING[i.k].flags.includes(a)))) F(`lazy ${nm}/${k}: allergen`); });
   if(nm==='veg'&&sl.some(s=>s.r&&(RMAP[s.r].meat||RMAP[s.r].fish))) F('lazy veg: meat');
   const o=okDay(d); if(o.p) lp++; if(o.k) lk++;
   if(!S.plan.lazy[d]) F('lazy flag missing');
   lazyUndo(); if(JSON.stringify(S.plan.slots)!==before) F(`lazy ${nm}/${k}: undo mismatch`);
  } }
 out.info.lazy={days:lz,changedMeals:changed,proteinOK:`${lp}/${lz} (до: ${lpB})`,kcalOK:`${lk}/${lz} (до: ${lkB})`};
 if(lp<lpB*0.85) F('lazy: protein rate dropped too much');
 if(lk<lkB*0.75) F('lazy: kcal rate dropped too much');
 // ---- 4. Где дешевле
 mk({},'cmp'); const rows=storeCompare(); out.info.compare=rows.map(x=>x.st.id+':'+x.total+' real '+x.real+'/'+x.n+' idx '+x.idx);
 if(rows.length!==8) F('compare: not 8 stores'); for(let i=1;i<rows.length;i++) if(rows[i].ok>rows[i-1].ok||(rows[i].ok===rows[i-1].ok&&rows[i].total<rows[i-1].total)) F('compare: not sorted');
 const cur=rows.find(x=>x.st.id==='p5'); if(cur.total!==shopping().total) F(`compare: p5 total ${cur.total} != shopping ${shopping().total}`);
 const vv=rows.find(x=>x.st.id==='vkusvill'); if(!vv||vv.real<1) F('compare: vkusvill has no real prices');
 S.screen='app'; S.tab='shop'; render(); document.querySelector('[data-act="compare"]').click();
 out.info.cmpRows=document.querySelectorAll('.cmprow').length; if(out.info.cmpRows!==8) F('compare modal rows '+out.info.cmpRows);
 const tgt=rows[0].st.id==='p5'?rows[1].st.id:rows[0].st.id; const btn=document.querySelector(`[data-act="setstore"][data-id="${tgt}"]`); btn.click(); if(S.A.store!==tgt) F('compare: setstore failed');
 if(shopping().total!==rows.find(x=>x.st.id===tgt).total) F('compare: switched total mismatch');
 // ---- 5. Экспорт
 const lt=listText(); if(!/☐/.test(lt)) F('export: no checklist marks'); let opened=null; const wo=window.open; window.open=(u)=>{opened=u;}; shareTG(lt); window.open=wo;
 if(!opened||!opened.startsWith('https://t.me/share/url?url=&text=')) F('export: bad share url'); else { const t=decodeURIComponent(opened.split('&text=')[1]); out.info.share={len:t.length,full:lt.length,trunc:/и ещё/.test(t)}; if(t.length>1500) F('export: too long'); }
 // ---- 6. Отзывы
 const rx=/^[A-Za-z0-9_-]{1,64}$/; const codes=[fbCode('d',RECIPES[RECIPES.length-1].id,'t'),fbCode('l',RECIPES[0].id),fbCode('g')]; out.info.codes=codes;
 codes.forEach(c=>{ if(!rx.test(c)) F('fb code invalid '+c); });
 mk({},'fb'); const victim=S.plan.slots.find(s=>s.r&&!s.left&&s.m==='d').r; markBad(victim,'t'); generatePlan('fb2');
 if(S.plan.slots.some(s=>s.r===victim)) F('fb: disliked recipe still planned'); if(candidates('d').some(r=>r.id===victim)) F('fb: disliked in candidates');
 S.A.bad=[]; if(!candidates('d').some(r=>r.id===victim)&&mealOk(RMAP[victim],'d')) F('fb: unbad failed');
 // ---- 7. Вёрстка 360px и размеры кнопок
 mk({cook2:true},'ui'); S.screen='app'; const ov=[];
 const small=[];
 for(const t of ['week','shop','recipes','profile']){ S.tab=t; S.recipe=null; render(); if(document.documentElement.scrollWidth>362) ov.push(t);
   document.querySelectorAll('.minibtn,.swap.dl,[data-act="compare"],[data-act="tglist"],[data-act="fbsend"],[data-act="rmode"]').forEach(e=>{ const h=e.getBoundingClientRect().height; if(h&&h<44) small.push(t+':'+e.dataset.act+':'+h); }); }
 S.tab='week'; render(); out.info.lazyBtns=document.querySelectorAll('[data-act="lazy"]').length; out.info.c2tags=document.querySelectorAll('.c2tag').length;
 S.recipe=RECIPES[3].id; render(); if(document.documentElement.scrollWidth>362) ov.push('recipe'); document.querySelectorAll('.fbrow .btn').forEach(e=>{ if(e.getBoundingClientRect().height<44) small.push('recipe fb'); });
 S.recipe=null; S.tab='recipes'; S.rmode='fridge'; S.fridge=['eggs','tomato']; render(); if(document.documentElement.scrollWidth>362) ov.push('fridge'); document.querySelectorAll('.frchips .chip').forEach(e=>{ if(e.getBoundingClientRect().height<44) small.push('fridge chip'); });
 S.rmode=''; if(ov.length) F('overflow at 360: '+ov.join(',')); if(small.length) F('tap<44: '+[...new Set(small)].slice(0,5).join(','));
 if(out.info.lazyBtns!==7) F('lazy buttons '+out.info.lazyBtns); if(!out.info.c2tags) F('no c2 tags');
 // ---- 8. Исправления по QA-персонам
 const q={}; out.info.qa=q;
 // орехи ⇒ и арахис; лактоза
 for(let k=0;k<3;k++){ mk({allergies:['nuts']},'nu'+k); if(S.plan.slots.some(s=>s.r&&RMAP[s.r].al.includes('peanut'))) F('nuts: peanut in plan'); }
 if(candidates('s').some(r=>r.al.includes('peanut'))) F('nuts: peanut in candidates');
 mk({allergies:['lactose']},'lac'); if(S.plan.slots.some(s=>s.r&&RMAP[s.r].al.includes('lactose'))) F('lactose: lactose dish in plan'); q.lactoseSubs=shopping().items.filter(x=>x.lf).map(x=>x.k).join(',');
 // 👎 убирает все вхождения
 { let tested=0; for(let k=0;k<6&&tested<3;k++){ mk({cook2:true},'ra'+k); const cnt={}; S.plan.slots.forEach(s=>{ if(s.r&&!s.hidden) cnt[s.r]=(cnt[s.r]||0)+1; }); const v=Object.keys(cnt).find(x=>cnt[x]>=2); if(!v) continue; tested++;
   markBad(v,'t'); const rep=replaceAllOf(v); if(S.plan.slots.some(s=>s.r===v&&!s.hidden)) F('dislike: still in plan '+v); if(rep.n<1) F('dislike: nothing replaced'); S.A.bad=[]; } q.dislikeTested=tested; }
 // стейплы и детское
 let stV=0, stN=0, kidLD=0, kidOK=0, spicyN=0;
 for(const [nm,patch] of P) for(let k=0;k<3;k++){ mk(patch,'st'+nm+k); stN++; const c={}; S.plan.slots.forEach(s=>{ if(s.r&&!s.hidden) staples(RMAP[s.r]).forEach(g=>c[g]=(c[g]||0)+1); });
   if(Object.keys(c).some(g=>c[g]>stapleLim(g)+1)) { stV++; if(stV<=3) q['staple_'+nm+k]=JSON.stringify(c); }
   if(S.A.kids>0) S.plan.slots.forEach(s=>{ if(s.r&&!s.hidden&&(s.m==='l'||s.m==='d')){ kidLD++; if(RMAP[s.r].tags.includes('kids')) kidOK++; if(spicy(RMAP[s.r])) spicyN++; } }); }
 for(let k=0;k<6;k++){ mk({kids:2,cook2:k%2===1},'kd'+k); S.plan.slots.forEach(s=>{ if(s.r&&!s.hidden&&(s.m==='l'||s.m==='d')){ kidLD++; if(RMAP[s.r].tags.includes('kids')) kidOK++; if(spicy(RMAP[s.r])) spicyN++; } }); }
 q.staplePlansOver=stV+'/'+stN; q.kidShare=(kidOK/Math.max(1,kidLD)).toFixed(2); q.kidSpicy=spicyN;
 if(stV>stN*0.1) F('staples over limit in '+stV+'/'+stN); if(kidOK/kidLD<0.6) F('kids share '+q.kidShare); if(spicyN>2) F('kids spicy '+spicyN);
 // строгое время
 let slow=0, all=0; for(let k=0;k<4;k++){ mk({styles:['fast']},'fa'+k); S.plan.slots.forEach(s=>{ if(s.r&&!s.hidden&&!s.left){ all++; if(!quickOk(RMAP[s.r])) slow++; } }); } q.fastSlow=slow+'/'+all; if(slow) F('fast: slow dishes '+slow);
 // набор массы: ккал не урезаны или есть честное предупреждение
 const gp={ad:[{sex:'m',age:24,h:182,w:72,act:3,goal:'gain'}],kd:[]};
 for(const bud of [null,3500]){ mk({adults:1,people:gp,budget:bud==null?undefined:bud},'gn'+bud); if(bud==null){ S.A.budget=defaultBudget(); generatePlan('gn'); }
   const T=targets(), days=dayOrder(), avg=days.reduce((a,d)=>a+dayTotals(d).k,0)/days.length*(T.ad[0].factor||1); S.screen='app'; S.tab='week'; render(); const html=document.getElementById('app').innerHTML;
   q['gain_'+(bud||'def')]=Math.round(avg)+'/'+T.ad[0].k; if(avg<T.ad[0].k*0.9 && !/Не добираем калории/.test(html)) F('gain: short kcal without warning '+bud);
   if(bud==null&&avg<T.ad[0].k*0.9) F('gain: default budget short '+Math.round(avg)); if(/на семью/.test(html)) F('single eater: «на семью» shown'); }
 // фастфуд «часто» с плитой+микроволновкой и белковой диетой
 { let ffs=0; for(let k=0;k<4;k++){ mk({ff:'often',equip:['stove','micro'],diets:['hp']},'ffo'+k); ffs+=ffCount(); } q.ffOftenStoveMicroHp=(ffs/4).toFixed(1); if(ffs/4<1.5) F('ff often stove+micro hp: '+ffs/4); }
 // бюджет ниже минимума — честная причина
 mk({budget:1500},'bm'); S.screen='app'; S.tab='week'; render(); if(!/Даже самый экономный план/.test(document.getElementById('app').innerHTML)) F('budget: no min-plan reason');
 // q7 chips
 S=fresh(); S.screen='q7'; render(); out.info.q7c2=document.querySelectorAll('[data-act="c2m"]').length; if(out.info.q7c2!==2) F('q7 cook2 chips');
 return out; });
console.log(JSON.stringify(res.info,null,1));
console.log('pageerrors',errs.length, errs.slice(0,3).join(' | '));
console.log('SUMMARY retention fails',res.fails.length, res.fails.slice(0,12).join(' ; '));
if(res.fails.length||errs.length) process.exitCode=1;
await b.close();
