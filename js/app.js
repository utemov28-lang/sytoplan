'use strict';
/* ====== ПРОИЗВОДНЫЕ ДАННЫЕ ====== */
const RMAP = {};
RECIPES.forEach(r=>{
  const fl = new Set(); r.ing.forEach(i=>{ if(!ING[i.k]) console.error('Нет ингредиента', i.k, r.id); else ING[i.k].flags.forEach(f=>fl.add(f)); });
  r.meat = fl.has('meat'); r.fish = fl.has('fish')||fl.has('seafood');
  r.al = ['nuts','peanut','dairy','eggs','gluten','fish','seafood','soy','sesame','honey'].filter(a=>fl.has(a));
  calcNutrition(r);
  RMAP[r.id] = r;
});
const MEALMAP = Object.fromEntries(MEALS.map(m=>[m.id,m]));
const CUISMAP = Object.fromEntries(CUISINES.map(c=>[c.id,c]));
const STEPS = ['q1','q2','q3','q4','q5','q6','q7','q8','q9','q10','q11'];
/* категории блюд — выводятся из названия и приёма пищи */
const SOUP_RE=/суп|борщ|(^|\s)щи(\s|$)|окрошка|солянка|рассольник|^уха(\s|$)|харчо|шурпа|свекольник|гаспачо|минестроне|бульон/i;
const SALAD_RE=/^(тёплый )?салат|винегрет|оливье|под шубой|мимоза|табуле|цезарь|по-корейски|^свёкла с/i;
function rcat(r){ if(r._cat) return r._cat; let c;
  if(SOUP_RE.test(r.t)) c='soup'; else if(SALAD_RE.test(r.t)) c='salad'; else if(r.m[0]==='b') c='breakfast'; else if(r.m[0]==='s') c='snack'; else c='hot';
  return r._cat=c; }
const CATS=[['all','Все'],['breakfast','Завтраки'],['soup','Супы'],['hot','Горячее'],['salad','Салаты'],['snack','Перекусы'],['kids','Детям'],['lean','Постное'],['veg','Вегетарианское'],['hp','Белковое']];
const CATNAME=Object.fromEntries(CATS);
function inCat(r,c){ if(c==='all') return true; if(['kids','lean','veg','hp'].includes(c)) return DIETCHK[c](r); return rcat(r)===c; }
/* ====== ИЗОБРАЖЕНИЯ ====== */
const HAS_R=new Set(typeof IMG_R!=='undefined'?IMG_R:[]), HAS_I=new Set(typeof IMG_I!=='undefined'?IMG_I:[]);
function ilu(n){ return HAS_I.has(n)?'img/i/'+n+'.webp':null; }
function ill(n,fb,cls){ const u=ilu(n); return u?`<img class="${cls||'ill'}" src="${u}" alt="" loading="lazy" decoding="async">`:fb; }
function photo(r,cls,big,extra){ const c=CUISMAP[r.c]; let inner;
  if(HAS_R.has(r.id)) inner=`<img src="img/r/${big?'':'s/'}${r.id}.webp" alt="${esc(r.t)}" ${big?'':'loading="lazy"'} decoding="async" onerror="this.remove()">`;
  else { const u=ilu('cat_'+rcat(r)); inner=u?`<img class="fb" src="${u}" alt="" loading="lazy" decoding="async">`:`<span>${r.e}</span>`; }
  return `<div class="ph ${cls}" style="background:linear-gradient(135deg,${c.g[0]},${c.g[1]})">${inner}${extra||''}</div>`; }
/* ====== TELEGRAM ====== */
const TG=(window.Telegram&&window.Telegram.WebApp)||null;
const inTG=!!(TG&&TG.initData);
function tgv(v){ try{ return TG.isVersionAtLeast(v); }catch(e){ return false; } }
function hap(t){ if(!inTG||!TG.HapticFeedback||!tgv('6.1')) return; try{ if(t==='sel') TG.HapticFeedback.selectionChanged(); else if(t==='ok') TG.HapticFeedback.notificationOccurred('success'); else if(t==='warn') TG.HapticFeedback.notificationOccurred('warning'); else TG.HapticFeedback.impactOccurred(t||'light'); }catch(e){} }
function applyTheme(){ if(!inTG) return; const dark=TG.colorScheme==='dark'; document.documentElement.classList.toggle('dark',dark);
  const c=dark?'#17191E':'#FFFFFF'; try{ if(tgv('6.1')){ TG.setHeaderColor(c); TG.setBackgroundColor(c); } if(tgv('7.10')) TG.setBottomBarColor(c); }catch(e){}
  const m=document.querySelector('meta[name=theme-color]'); if(m) m.content=c; }
function canBack(){ return !!(document.getElementById('modal')||S.recipe||STEPS.includes(S.screen)||(S.screen==='app'&&S.tab!=='week')); }
function syncTG(){ if(!inTG||!tgv('6.1')) return; try{ if(canBack()) TG.BackButton.show(); else TG.BackButton.hide(); }catch(e){} }
let navDir='';
function goBack(){ navDir='back';
  if(document.getElementById('modal')){ closeModal(); return; }
  if(S.recipe){ set({recipe:null}); return; }
  if(STEPS.includes(S.screen)){ prevStep(); return; }
  if(S.screen==='app'&&S.tab!=='week'){ S.tab='week'; set({}); } }
function prevStep(){ const i=STEPS.indexOf(S.screen); navDir='back'; if(S.editing && S.plan && S.screen===S.editing){ S.editing=false; set({screen:'app'}); } else go(i>0?STEPS[i-1]:'intro'); }
/* ====== УТИЛИТЫ ====== */
const NB = '\u00A0';
function fmt(n){ n = Math.round(n||0); return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, NB); }
function rub(n){ return fmt(n)+NB+'₽'; }
function dec(n){ const r = Math.round(n*10)/10; return String(r).replace('.',','); }
function plural(n,a,b,c){ n=Math.abs(Math.round(n))%100; const n1=n%10; if(n>10&&n<20)return c; if(n1>1&&n1<5)return b; if(n1===1)return a; return c; }
function esc(s){ return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
function half(n){ const w=Math.floor(n), f=n-w; if(f<0.25) return String(w||(n>0?'½':'0')).replace(/^0$/,'½'); if(f<0.75) return (w?w:'')+'½'; return String(w+1); }
function fmtAmount(q,unit){ // для списка «нужно»
  if(unit==='шт') return Math.max(1,Math.ceil(q-0.01))+NB+'шт';
  const big = unit==='г'?'кг':'л';
  if(q>=1000) return dec(q/1000)+NB+big;
  const r = q<20?Math.max(1,Math.round(q)):(q<100?Math.round(q/5)*5:Math.round(q/10)*10);
  return r+NB+unit;
}
function fmtPack(p,unit){ if(unit==='шт') return p+NB+'шт'; if(p>=1000) return dec(p/1000)+NB+(unit==='г'?'кг':'л'); return p+NB+unit; }
function fmtIngQty(k,q,unit){ // для рецепта
  if(k==='salt'||k==='spices') return 'по вкусу';
  if(k==='eggs') return Math.max(1,Math.round(q))+NB+'шт';
  if(unit==='шт'){ const h=Math.max(0.5,Math.round(q*2)/2); return half(h)+NB+'шт'; }
  return fmtAmount(q,unit);
}
function hash(s){ let h=2166136261; for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619);} return ((h>>>0)%100000)/100000; }
const ICON = {
  back:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
  close:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  check:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  cal:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="4"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  cart:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6.2"/><circle cx="10" cy="20.5" r="1.3"/><circle cx="17" cy="20.5" r="1.3"/></svg>',
  book:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/></svg>',
  user:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>',
  heart:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 20s-7.5-4.6-9.3-9.2C1.5 7.6 3.6 4.5 7 4.5c2 0 3.5 1.1 5 3 1.5-1.9 3-3 5-3 3.4 0 5.5 3.1 4.3 6.3C19.5 15.4 12 20 12 20z"/></svg>',
  heartf:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 20s-7.5-4.6-9.3-9.2C1.5 7.6 3.6 4.5 7 4.5c2 0 3.5 1.1 5 3 1.5-1.9 3-3 5-3 3.4 0 5.5 3.1 4.3 6.3C19.5 15.4 12 20 12 20z"/></svg>',
  plus:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  share:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v13M7 8l5-5 5 5"/><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/></svg>',
  swap:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9a8 8 0 0 1 14-3l2 2M20 4v4h-4M20 15a8 8 0 0 1-14 3l-2-2M4 20v-4h4"/></svg>',
  search:'<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#9CA3AF" stroke-width="2.4" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>'
};
const CK = '<span class="ck">'+ICON.check+'</span>';

/* ====== СОСТОЯНИЕ ====== */
function fresh(){ return {screen:'intro', city:'Москва',
  A:{store:null, adults:2, kids:0, meals:['b','l','d'], days:[0,1,2,3,4,5,6], equip:['stove','oven','micro'],
     diets:['none'], cuisines:[], styles:[], allergies:['none'], dislikes:[], pantry:[], budget:null},
  plan:null, ticks:{}, favs:[], extras:[], tab:'week', recipe:null, rtab:'ing', serv:2, rfilter:'fit', ptab:'all'}; }
function load(){ try{ const s=JSON.parse(localStorage.getItem(LS_KEY)); if(s&&s.A){ const f=fresh(); const o=Object.assign(f,s); o.A=Object.assign(fresh().A,s.A); return o; } }catch(e){} return null; }
let S = load() || fresh();
function save(){ try{ localStorage.setItem(LS_KEY, JSON.stringify(S)); }catch(e){} }
function set(p){ Object.assign(S,p); save(); render(); }
function setA(p){ Object.assign(S.A,p); save(); render(); }
const A = ()=>S.A;
function store(){ return STORES.find(s=>s.id===S.A.store) || STORES[0]; }

/* ====== РАСЧЁТЫ ====== */
function portions(){ return S.A.adults + S.A.kids*0.5; }
function mealOrder(){ return MEALS.filter(m=>S.A.meals.includes(m.id)).map(m=>m.id); }
function dayOrder(){ return S.A.days.slice().sort((a,b)=>a-b); }
function portionsPerWeek(){ return portions()*S.A.meals.length*S.A.days.length; }
function typicalCost(){ const perDay=S.A.meals.reduce((s,m)=>s+MEALMAP[m].base,0); return perDay*portions()*S.A.days.length*store().mult; }
function budgetRange(){ const t=typicalCost(); return {min:Math.max(500,Math.round(t*0.3/100)*100), max:Math.max(1000,Math.round(t*2/100)*100)}; }
function defaultBudget(){ return Math.max(500, Math.ceil(typicalCost()*1.2/500)*500); }
function budgetStatus(b){
  const t=typicalCost(), r=b/t, st=store();
  if(r>=1) return {cls:'ok',ic:'✅',title:'Укладываемся',text:`Типичная корзина для вашей семьи в ${st.loc} — около ${rub(Math.round(t/100)*100)}. Запас ~${rub(Math.max(0,Math.round((b-t)/100)*100))} на непредвиденное.`};
  if(r>=0.8) return {cls:'tight',ic:'⚠️',title:'Впритык — экономная неделя',text:`Типичная корзина — около ${rub(Math.round(t/100)*100)}. Соберём план из недорогих блюд: крупы, курица, сезонные овощи, готовка впрок.`};
  return {cls:'bad',ic:'⛔',title:'Не хватит',text:`Даже экономная неделя в ${st.loc} обойдётся примерно в ${rub(Math.round(t*0.8/100)*100)}. Увеличьте бюджет или уберите перекусы/дни — план будет превышать сумму.`};
}
function dislikedKeys(){ const s=new Set(); S.A.dislikes.forEach(id=>{ const d=DISLIKES.find(x=>x[0]===id); if(d) d[3].forEach(k=>s.add(k)); }); return s; }
function recipeIngs(r){ const dk=dislikedKeys(); return r.ing.filter(i=>!(ING[i.k].opt && dk.has(i.k))); }
function removedIngs(r){ const dk=dislikedKeys(); return r.ing.filter(i=>ING[i.k].opt && dk.has(i.k)); }
const DIETCHK = {
  veg:r=>!r.meat&&!r.fish,
  lean:r=>!r.meat&&!r.fish&&!r.al.includes('dairy')&&!r.al.includes('eggs'),
  pp:r=>r.tags.includes('light')||r.k<=(r.m.includes('s')?300:450),
  hp:r=>r.tags.includes('highprotein')||r.p*4/r.k>=0.2,
  kids:r=>r.tags.includes('kids')
};
function whyNot(r){ // null если рецепт подходит
  const a=S.A;
  if(!r.eq.every(e=>a.equip.includes(e))) return 'нужна техника: '+r.eq.filter(e=>!a.equip.includes(e)).map(e=>EQUIP.find(x=>x.id===e).name.toLowerCase()).join(', ');
  const al=a.allergies.filter(x=>x!=='none'); const bad=r.al.filter(x=>al.includes(x));
  if(bad.length) return 'аллерген: '+bad.map(b=>ALLERGENS.find(x=>x.id===b).name.toLowerCase()).join(', ');
  const dk=dislikedKeys(); const d=r.ing.find(i=>dk.has(i.k)&&!ING[i.k].opt);
  if(d) return 'не любите: '+ING[d.k].name.toLowerCase();
  const diets=a.diets.filter(x=>x!=='none'); const nd=diets.find(x=>!DIETCHK[x](r));
  if(nd) return 'не подходит: '+DIETS.find(x=>x.id===nd).name;
  return null;
}
function fits(r,m){ return (!m||r.m.includes(m)) && !whyNot(r); }
function candidates(m){ return RECIPES.filter(r=>fits(r,m)); }
function portionCost(r){ const st=store(); return recipeIngs(r).reduce((s,i)=>{const g=ING[i.k]; return s+i.q/r.sv/g.pack*g.price;},0)*st.mult; }
function styleMatch(r,st){
  if(st==='fast') return r.tags.includes('fast')||r.prep+r.cook<=25;
  if(st==='light') return r.tags.includes('light')||r.k<=380;
  return r.tags.includes(st);
}
function recipeScore(r,ctx,slotKey){
  const a=S.A; let s=hash((S.plan&&S.plan.seed||'x')+r.id+slotKey)*2.2;
  a.styles.forEach(st=>{ if(styleMatch(r,st)) s+=2.5; });
  if(a.cuisines.includes(r.c)) s+=1.6;
  if(a.kids>0 && r.tags.includes('kids')) s+=0.8;
  const u=(ctx.uses[r.id]||0); s-= u*(a.styles.includes('batch')?1.5:4); if(u>=3) s-=8;
  if(ctx.dayRecipes && ctx.dayRecipes.has(r.id)) s-=10;
  let shared=0; recipeIngs(r).forEach(i=>{ if(ctx.ings.has(i.k) && !['salt','spices','oil','sugar'].includes(i.k)) shared++; }); s+=Math.min(shared,4)*0.25;
  if(ctx.target){ const pc=portionCost(r); s-=Math.max(-1,Math.min(3,(pc/ctx.target[r.m.includes(ctx.m)?ctx.m:'d']-1)*2)); }
  return s;
}
function slotRecipe(plan,i){ const s=plan.slots[i]; return s && s.r ? RMAP[s.r] : null; }
function shopping(){
  const plan=S.plan; const need={}; const p=portions();
  const add=(r,f)=>recipeIngs(r).forEach(i=>{ need[i.k]=(need[i.k]||0)+i.q*f; });
  if(plan) plan.slots.forEach(s=>{ if(s.r && RMAP[s.r]){ const r=RMAP[s.r]; add(r,p/r.sv); } });
  (S.extras||[]).forEach(x=>{ const r=RMAP[x.r]; if(r) add(r,x.serv/r.sv); });
  const st=store(); const items=[], home=[]; let total=0;
  Object.keys(need).forEach(k=>{ const g=ING[k], q=need[k];
    if(S.A.pantry.includes(k)){ home.push({k,g,q}); return; }
    const packs=Math.max(1,Math.ceil(q/g.pack-0.08));
    const price=Math.round(packs*g.price*st.mult);
    total+=price; items.push({k,g,q,packs,price});
  });
  const order=AISLES.map(a=>a.id);
  const sorter=(x,y)=>order.indexOf(x.g.aisle)-order.indexOf(y.g.aisle)||x.g.name.localeCompare(y.g.name,'ru');
  items.sort(sorter); home.sort(sorter);
  return {items,home,total};
}
function shopTotalFor(slots){ const save=S.plan; S.plan=Object.assign({},save||{},{slots}); const t=shopping().total; S.plan=save; return t; }

/* ====== ПЛАНИРОВЩИК ======
   1) фильтр по приёму пищи, диете, аллергенам, нелюбимому, технике;
   2) жадный выбор по баллам (стиль, кухня, разнообразие, общие ингредиенты, цена порции относительно цели);
   3) «готовка впрок»: обед следующего дня = остатки ужина (если рецепт batch);
   4) подгонка под бюджет: пока корзина (целыми упаковками) дороже бюджета — меняем самое дорогое блюдо на более дешёвое подходящее. */
function generatePlan(seed){
  const a=S.A; const days=dayOrder(), meals=mealOrder(); const p=portions();
  const perPortion=a.budget/(Math.max(1,portionsPerWeek()));
  const baseSum=meals.reduce((s,m)=>s+MEALMAP[m].base,0)/meals.length;
  const target={}; MEALS.forEach(m=>target[m.id]=perPortion*MEALMAP[m.id].base/baseSum);
  S.plan={seed:seed||String(Date.now()),slots:[]};
  const ctx={uses:{},ings:new Set(),target};
  const cands={}; meals.forEach(m=>cands[m]=candidates(m));
  const batch=a.styles.includes('batch')&&meals.includes('l')&&meals.includes('d');
  let prevDinner=-1;
  days.forEach((d,di)=>{
    ctx.dayRecipes=new Set();
    meals.forEach(m=>{
      const slots=S.plan.slots;
      if(m==='l' && batch && prevDinner>=0){ const src=slots[prevDinner]; const r=src.r&&RMAP[src.r];
        if(r && r.tags.includes('batch') && r.m.includes('l') && !slots.some(x=>x.src===prevDinner)){
          slots.push({d,m,r:src.r,src:prevDinner,left:true}); ctx.dayRecipes.add(src.r); return; } }
      const list=cands[m]; if(!list.length){ slots.push({d,m,r:null}); return; }
      ctx.m=m; let best=null,bs=-1e9;
      list.forEach(r=>{ const sc=recipeScore(r,ctx,d+m); if(sc>bs){bs=sc;best=r;} });
      slots.push({d,m,r:best.id}); ctx.uses[best.id]=(ctx.uses[best.id]||0)+1; ctx.dayRecipes.add(best.id);
      recipeIngs(best).forEach(i=>ctx.ings.add(i.k));
      if(m==='d') prevDinner=slots.length-1;
    });
  });
  fitBudget(cands);
  save();
}
function fitBudget(cands){
  const slots=S.plan.slots; const maxUse=S.A.styles.includes('batch')?3:2;
  const uses=()=>{const u={}; slots.forEach(s=>{ if(s.r&&!s.left) u[s.r]=(u[s.r]||0)+1; }); return u;};
  let total=shopping().total, guard=0;
  while(total>S.A.budget && guard++<150){
    const u=uses(); let best=null;
    slots.forEach((s,i)=>{ if(!s.r||s.left) return; const cur=portionCost(RMAP[s.r]);
      const same=new Set(slots.filter(x=>x.d===s.d).map(x=>x.r));
      const alts=(cands[s.m]||candidates(s.m)).filter(r=>r.id!==s.r && !same.has(r.id) && (u[r.id]||0)<maxUse && portionCost(r)<cur*0.9)
        .sort((x,y)=>portionCost(x)-portionCost(y)).slice(0,3).sort((x,y)=>(u[x.id]||0)-(u[y.id]||0));
      if(!alts.length) return; const sav=cur-portionCost(alts[0]);
      if(!best||sav>best.sav) best={i,r:alts[0].id,sav}; });
    if(!best) break;
    replaceSlot(best.i,best.r);
    total=shopping().total;
  }
}
function replaceSlot(i,rid){ const slots=S.plan.slots; slots[i].r=rid; slots[i].left=false; delete slots[i].src;
  slots.forEach(x=>{ if(x.src===i) x.r=rid; }); }
function swapMeal(i){
  const s=S.plan.slots[i]; if(!s) return;
  const ctx={uses:{},ings:new Set(),m:s.m}; S.plan.slots.forEach(x=>{ if(x.r) ctx.uses[x.r]=(ctx.uses[x.r]||0)+1; });
  ctx.dayRecipes=new Set(S.plan.slots.filter(x=>x.d===s.d&&x!==s).map(x=>x.r));
  const alts=candidates(s.m).filter(r=>r.id!==s.r).map(r=>({r,sc:recipeScore(r,ctx,'swap'+s.d+s.m)})).sort((a,b)=>b.sc-a.sc);
  if(!alts.length){ toast('Других подходящих рецептов нет'); return; }
  s.sw=(s.sw||0)+1; const pick=alts[(s.sw-1)%Math.min(alts.length,8)].r;
  replaceSlot(i,pick.id); save(); render(); toast('Заменили на «'+pick.t+'»');
}
function dayTotals(d){ const t={k:0,p:0,f:0,c:0}; S.plan.slots.filter(s=>s.d===d&&s.r).forEach(s=>{const r=RMAP[s.r]; t.k+=r.k;t.p+=r.p;t.f+=r.f;t.c+=r.cb;}); return t; }

/* ====== РЕНДЕР ====== */
const app=document.getElementById('app');
let lastKey='', keepToast=false;
function render(){
  const y=window.scrollY; let html='';
  const sc=S.screen;
  if(S.recipe && RMAP[S.recipe]) html=renderRecipe();
  else if(sc==='intro') html=renderIntro();
  else if(STEPS.includes(sc)) html=renderStep(sc);
  else if(sc==='loading') html=renderLoading();
  else if(sc==='app' && S.plan) html=renderApp();
  else { S.screen='intro'; html=renderIntro(); }
  app.innerHTML=html;
  const key=S.recipe?('r'+S.recipe):(sc+(sc==='app'?S.tab:''));
  if(key!==lastKey){ const t=document.querySelector('.toast'); if(t && !keepToast) t.remove();
    const cls=(sc==='app'&&!S.recipe&&lastKey.startsWith('app'))?'fade':(navDir==='back'?'back':'');
    app.querySelectorAll(':scope>.content,:scope>.intro,:scope>.loading,:scope>.hero,:scope>.rbody').forEach(el=>{ el.classList.add('scr'); if(cls) el.classList.add(cls); }); }
  keepToast=false; navDir='';
  window.scrollTo(0, key===lastKey?y:0); lastKey=key;
  if(sc==='q11' && !S.recipe) updateBudgetUI();
  if(sc==='loading' && !S.recipe) runLoading();
  syncTG();
}
function header(o){
  const back=o.back&&!inTG;
  return `<div class="hdr"><div class="hdr-row">${back?`<button class="icon-btn" data-act="${o.back}" aria-label="Назад">${ICON.back}</button>`:(o.logo?'':'<span style="width:42px"></span>')}
  <div class="hdr-title ${o.logo?'left':''}">${o.logo?'<span class="lg">🥗</span>':''}${o.title||''}</div><div class="hdr-right">${o.right||''}</div></div>
  ${o.prog!=null?`<div class="prog"><i style="width:${o.prog}%"></i></div>`:''}</div>`;
}
function renderIntro(){
  const has=S.A.store||S.plan; const n=RECIPES.length;
  const hero=ilu('hero')?`<img class="heroimg" src="img/i/hero.webp" alt="" fetchpriority="high">`:'<div style="font-size:120px;margin:40px 0">🥗</div>';
  return `<div class="intro">${hero}<div class="brand"><i>🥗</i>${APP_NAME}</div>
  <h1>Вкусно, сытно<br>и в рамках бюджета</h1>
  <p class="sub">Меню на неделю под ваш магазин и семью: домашние рецепты с КБЖУ и готовый список покупок.</p>
  <div class="feats"><div class="feat"><span class="e">🛒</span>Корзина по ценам магазина</div><div class="feat"><span class="e">💸</span>Меню под ваш бюджет</div>
  <div class="feat"><span class="e">🍲</span>${n} ${plural(n,'рецепт','рецепта','рецептов')} с КБЖУ</div><div class="feat"><span class="e">🥫</span>Учтём, что уже есть дома</div></div></div>
  <div class="bottom stack">${S.plan?`<button class="btn" data-act="goapp">Открыть мой план</button><button class="btn sec sm" data-act="restart">Начать заново</button>`:
   has?`<button class="btn" data-act="continue">Продолжить</button><button class="btn sec sm" data-act="restart">Начать заново</button>`:`<button class="btn" data-act="go" data-to="q1">Составить план за 2 минуты</button>`}</div>`;
}
function stepShell(sc,title,sub,body,btn,opts={}){
  const n=STEPS.indexOf(sc)+1;
  return header({back:'prev',title:APP_NAME,right:opts.right||`<span>${n} из ${STEPS.length}</span>`,prog:Math.round(n/STEPS.length*100)})+
   `<div class="content"><h1>${title}</h1>${sub?`<p class="sub">${sub}</p>`:''}${body}
   <button class="restart" data-act="restart">Начать заново</button></div>
   <div class="bottom">${btn}</div>`;
}
function optCard(act,id,sel,inner,cls=''){ return `<button class="opt ${cls} ${sel?'sel':''}" data-act="${act}" data-id="${id}">${CK}${inner}</button>`; }
function renderStep(sc){
  const a=S.A;
  switch(sc){
  case 'q1': return stepShell(sc,'Где покупаете продукты?','Посчитаем примерную стоимость корзины по ценам магазина.',
    `<div class="grid3">${STORES.map(s=>optCard('store',s.id,a.store===s.id,`<div class="badge" style="background:${s.bg};color:${s.color}">${s.ini}</div><div class="t">${s.name}</div><div class="s">цены ${s.lvl}</div>`,'store')).join('')}</div>
    <p class="foot">Названия магазинов — только для расчёта цен. ${APP_NAME} не связан с торговыми сетями.</p>`,
    `<button class="btn" data-act="next" ${a.store?'':'disabled'}>Выбрать магазин</button>`,
    {right:`<button class="linkbtn" data-act="city">📍 ${esc(S.city)} · Изменить</button>`});
  case 'q2': { const p=portions();
    return stepShell(sc,'Кто ест?','Ребёнок считается как половина порции.',
    `<div class="stack">
     <div class="stepper-card"><div><div class="t">👩 Взрослые</div><div class="s">полная порция</div></div><div class="stepper"><button data-act="cnt" data-id="adults" data-d="-1" ${a.adults<=1?'disabled':''}>−</button><span class="v">${a.adults}</span><button data-act="cnt" data-id="adults" data-d="1" ${a.adults>=10?'disabled':''}>+</button></div></div>
     <div class="stepper-card"><div><div class="t">🧒 Дети</div><div class="s">половина порции</div></div><div class="stepper"><button data-act="cnt" data-id="kids" data-d="-1" ${a.kids<=0?'disabled':''}>−</button><span class="v">${a.kids}</span><button data-act="cnt" data-id="kids" data-d="1" ${a.kids>=10?'disabled':''}>+</button></div></div>
     <div class="sect center" style="margin-top:8px"><div class="mut small" style="font-weight:700">Порций за приём</div><div class="bignum" style="margin-top:6px">${dec(p)}</div></div></div>`,
    `<button class="btn" data-act="next">Далее</button>`); }
  case 'q3': return stepShell(sc,'Какие приёмы пищи планируем?','Можно выбрать несколько.',
    `<div class="list">${MEALS.map(m=>optCard('meal',m.id,a.meals.includes(m.id),`<span class="em">${ill('meal_'+m.id,m.e,'')}</span><div><div class="t">${m.name}</div><div class="s">${m.sub}</div></div>`,'row')).join('')}</div>`,
    `<button class="btn" data-act="next" ${a.meals.length?'':'disabled'}>Далее</button>`);
  case 'q4': return stepShell(sc,'В какие дни готовим?','Отметьте дни, на которые нужен план.',
    `<div class="daychips">${DAYS.map((d,i)=>`<button class="chip ${a.days.includes(i)?'sel':''}" data-act="day" data-id="${i}">${d}</button>`).join('')}</div>
    <div class="bigtext">Планируем ${a.days.length} ${plural(a.days.length,'день','дня','дней')}</div>`,
    `<button class="btn" data-act="next" ${a.days.length?'':'disabled'}>Далее</button>`);
  case 'q5': return stepShell(sc,'Что есть на кухне?','Рецепты без нужной техники не попадут в план.',
    `<div class="grid3">${EQUIP.map(e=>optCard('equip',e.id,a.equip.includes(e.id),`${ill('eq_'+e.id,'<div class="em">'+e.e+'</div>')}<div class="t">${e.name}</div>`,'eq')).join('')}</div>
    ${a.equip.includes('stove')?'':'<div class="warn">Без плиты останутся только простые блюда без варки — выбор будет небольшим.</div>'}`,
    `<button class="btn" data-act="next" ${a.equip.length?'':'disabled'}>Далее</button>`);
  case 'q6': return stepShell(sc,'Как питаетесь?','Выберите тип питания и любимые кухни.',
    `<div class="grid2">${DIETS.map(d=>optCard('diet',d.id,a.diets.includes(d.id),`${ill('diet_'+d.id,'<div class="em">'+d.e+'</div>')}<div class="t">${d.name}</div><div class="s">${d.sub}</div>`,'diet')).join('')}</div>
    <h2>Любимые кухни</h2><div class="chips">${CUISINES.map(c=>`<button class="chip ${a.cuisines.includes(c.id)?'sel':''}" data-act="cuis" data-id="${c.id}">${c.e} ${c.name}</button>`).join('')}</div>`,
    `<button class="btn" data-act="next">Далее</button>`);
  case 'q7': return stepShell(sc,'Сколько времени на готовку?','Выберите удобный формат — можно несколько.',
    `<div class="list">${STYLES.map(s=>optCard('style',s.id,a.styles.includes(s.id),`<span class="em">${ill('st_'+s.id,s.e,'')}</span><div><div class="t">${s.name}</div><div class="s">${s.sub}</div></div>`,'row')).join('')}</div>`,
    `<button class="btn" data-act="next">Далее</button>`);
  case 'q8': return stepShell(sc,'Есть аллергии?','Блюда с этими продуктами исключим полностью.',
    `<div class="chips">${ALLERGENS.map(x=>`<button class="chip ${a.allergies.includes(x.id)?'sel':''}" data-act="allergy" data-id="${x.id}">${x.e} ${x.name}</button>`).join('')}</div>`,
    `<button class="btn" data-act="next">Подтвердить</button>`);
  case 'q9': return stepShell(sc,'Что не любите?','Такие продукты не попадут в план. Лук, чеснок, зелень и специи просто уберём из рецепта.',
    `<div class="search">${ICON.search}<input type="search" placeholder="Найти продукт" data-search="chips" autocomplete="off"></div>
    <div class="chips" id="flt">${DISLIKES.map(d=>`<button class="chip ${a.dislikes.includes(d[0])?'sel':''}" data-act="dislike" data-id="${d[0]}" data-name="${d[1]}">${d[2]} ${d[1]}${a.dislikes.includes(d[0])?' <span class="x">×</span>':''}</button>`).join('')}</div>`,
    `<button class="btn ${a.dislikes.length?'':'sec'}" data-act="next">${a.dislikes.length?'Далее':'Пропустить'}</button>`);
  case 'q10': { const tabs=[['all','Все'],['fresh','Свежее'],['meat','Мясо'],['fridge','Холодильник'],['groc','Бакалея']];
    const keys=PANTRY_FIRST.concat(Object.keys(ING).filter(k=>!PANTRY_FIRST.includes(k)));
    return stepShell(sc,'Что уже есть дома?','Эти продукты отметим «есть дома» и не будем считать в корзине.',
    `<div class="search">${ICON.search}<input type="search" placeholder="Поиск продуктов" data-search="tiles" autocomplete="off"></div>
    <div class="tabs">${tabs.map(t=>`<button class="tab ${S.ptab===t[0]?'on':''}" data-act="ptab" data-id="${t[0]}">${t[1]}</button>`).join('')}</div>
    <div class="grid3" id="flt">${keys.filter(k=>S.ptab==='all'||pantryCat(k)===S.ptab).map(k=>{const g=ING[k];
      return `<button class="tile ${a.pantry.includes(k)?'sel':''}" data-act="pantry" data-id="${k}" data-name="${esc(g.name.toLowerCase())}">${CK}<span class="em">${ill('p_'+k,g.e,'')}</span>${esc(shortName(g.name))}</button>`;}).join('')}</div>`,
    `<button class="btn" data-act="next">Продолжить · ${a.pantry.length} ${plural(a.pantry.length,'выбран','выбрано','выбрано')}</button>`); }
  case 'q11': { if(a.budget==null){ a.budget=defaultBudget(); save(); } const rg=budgetRange(); const p=portions();
    return stepShell(sc,'Бюджет на неделю','',
    `<p class="sub" style="margin-top:-4px">${a.adults} ${plural(a.adults,'взрослый','взрослых','взрослых')} · ${a.kids} ${plural(a.kids,'ребёнок','ребёнка','детей')} · ${a.meals.length} ${plural(a.meals.length,'приём','приёма','приёмов')}/день · ${dec(p)} ${plural(Math.ceil(p),'порция','порции','порций')}</p>
    <div class="budget-box"><label class="budget-input"><span>₽</span><input id="bin" inputmode="numeric" pattern="[0-9]*" value="${fmt(a.budget)}" aria-label="Бюджет на неделю"></label>
    <div class="mut small" style="margin-top:6px">нажмите на сумму, чтобы ввести</div></div>
    <input type="range" id="brange" min="${rg.min}" max="${rg.max}" step="100" value="${Math.min(rg.max,Math.max(rg.min,a.budget))}">
    <div class="range-l"><span>${rub(rg.min)}</span><span>${rub(rg.max)}</span></div>
    <div id="bstatus"></div>
    <div class="metrics"><div class="metric"><div class="v" id="m1"></div><div class="l">₽ / неделя</div></div><div class="metric"><div class="v" id="m2"></div><div class="l">₽ / порция</div></div><div class="metric"><div class="v" id="m3"></div><div class="l">порций / неделя</div></div></div>
    <p class="foot">Оценка по примерным демо-ценам, не по актуальным ценам магазина.</p>`,
    `<button class="btn" data-act="build">Собрать план</button>`); }
  }
  return '';
}
function shortName(n){ return n.replace(/\s*\(.*\)/,'').replace(' замороженная',' зам.').replace(' консервированная',' конс.').replace(' консервированный',' конс.'); }
function pantryCat(k){ const g=ING[k]; if(g.flags.includes('fish')||g.flags.includes('seafood')||g.aisle==='meat') return 'meat'; if(g.aisle==='veg') return 'fresh'; if(g.aisle==='dairy'||g.aisle==='frozen') return 'fridge'; return 'groc'; }
function updateBudgetUI(){
  const a=S.A, b=a.budget||0, t=typicalCost(), st=budgetStatus(b), ppw=portionsPerWeek();
  const el=document.getElementById('bstatus'); if(!el) return;
  el.innerHTML=`<div class="status ${st.cls}"><span class="ic">${st.ic}</span><div><b>${st.title}</b><p>${st.text}</p></div></div>`;
  document.getElementById('m1').textContent=fmt(b);
  document.getElementById('m2').textContent=fmt(b/ppw);
  document.getElementById('m3').textContent=dec(ppw);
  const r=document.getElementById('brange'); const rg=budgetRange();
  r.style.setProperty('--p',((Math.min(rg.max,Math.max(rg.min,b))-rg.min)/(rg.max-rg.min)*100)+'%');
  const btn=document.querySelector('[data-act=build]'); if(btn) btn.disabled=b<300;
}
/* --- загрузка --- */
let loadingRun=false;
const LSTEPS=['Смотрим цены недели…','Подбираем рецепты…','Считаем корзину…','Проверяем бюджет…','Собираем план…'];
function renderLoading(){
  const im=ilu('loading')?`<img class="loadimg" src="img/i/loading.webp" alt="">`:'<div class="loadimg" style="display:grid;place-items:center;font-size:90px;background:var(--gl)">🛒</div>';
  return `<div class="loading">${im}
  <h1 class="center" style="font-size:24px">Готовим ваш план</h1><p class="sub center" style="margin-bottom:14px">${store().name} · ${rub(S.A.budget)} на неделю</p>
  <div class="lbar"><i id="lbar"></i></div>
  <div class="checklist">${LSTEPS.map((s,i)=>`<div class="cli" id="cl${i}"><span class="dot">${ICON.check}</span>${s}</div>`).join('')}</div></div>`;
}
function runLoading(){
  if(loadingRun) return; loadingRun=true;
  try{ generatePlan(); }catch(e){ console.error(e); }
  let i=0; const tick=()=>{ const prev=document.getElementById('cl'+(i-1)); if(prev){prev.classList.remove('cur');prev.classList.add('done');}
    const lb=document.getElementById('lbar'); if(lb) lb.style.width=Math.round(i/LSTEPS.length*100)+'%';
    if(i>=LSTEPS.length){ setTimeout(()=>{ loadingRun=false; S.tab='week'; hap('ok'); set({screen:'app'}); },450); return; }
    const c=document.getElementById('cl'+i); if(c) c.classList.add('cur'); i++; setTimeout(tick, 600); };
  setTimeout(tick,250);
}
/* --- основное приложение --- */
function renderApp(){
  const tabs=[['week','Неделя',ICON.cal],['shop','Покупки',ICON.cart],['recipes','Рецепты',ICON.book],['profile','Профиль',ICON.user]];
  let body='', action='';
  if(S.tab==='week') body=renderWeek();
  else if(S.tab==='shop'){ body=renderShop(); action=`<div class="navaction"><button class="btn" data-act="cart">${ICON.cart} Собрать корзину в ${store().loc}</button></div>`; }
  else if(S.tab==='recipes') body=renderRecipes();
  else body=renderProfile();
  return header({title:APP_NAME,logo:1,right:`<button class="linkbtn" data-act="city" style="color:var(--mut)">📍 ${esc(S.city)}</button>`})+`<div class="content app">${body}</div>${action}
  <nav class="nav">${tabs.map(t=>`<button class="${S.tab===t[0]?'on':''}" data-act="tab" data-id="${t[0]}">${t[2]}${t[1]}</button>`).join('')}</nav>`;
}
function budgetPill(total){ const b=S.A.budget; return total<=b?`<span class="pill ok">✓ В бюджете</span>`:`<span class="pill bad">+${rub(total-b)}</span>`; }
function mealMeta(r){ return `${r.prep+r.cook}${NB}мин · ${r.k}${NB}ккал · ${fmt(portionCost(r))}${NB}₽/порц`; }
function macroBar(t){ const p=t.p*4,f=t.f*9,c=t.c*4,s=p+f+c||1;
  return `<div class="mbar"><i class="p" style="width:${(p/s*100).toFixed(1)}%"></i><i class="f" style="width:${(f/s*100).toFixed(1)}%"></i><i class="c" style="width:${(c/s*100).toFixed(1)}%"></i></div>
  <div class="mleg"><span class="lg-p">Б ${fmt(t.p)}${NB}г</span><span class="lg-f">Ж ${fmt(t.f)}${NB}г</span><span class="lg-c">У ${fmt(t.c)}${NB}г</span></div>`; }
function renderWeek(){
  const sh=shopping(); const plan=S.plan; const n=plan.slots.filter(s=>s.r).length;
  let html=`<h1>Ваша неделя готова!</h1><p class="sub">${n} ${plural(n,'блюдо','блюда','блюд')} · ${store().name} · ${dec(portions())} ${plural(Math.ceil(portions()),'порция','порции','порций')} за приём</p>
  <button class="shopcard" data-act="tab" data-id="shop"><span class="ic">🛒</span><div style="flex:1;min-width:0"><div class="t">Список покупок</div><div class="s">${sh.items.length} ${plural(sh.items.length,'позиция','позиции','позиций')} · ~${rub(sh.total)} из ${rub(S.A.budget)}</div></div>${budgetPill(sh.total)}</button>`;
  const days=dayOrder();
  if(days.length>1) html+=`<div class="daystrip">${days.map(d=>`<button data-act="jumpday" data-id="${d}">${DAYS[d]}<span>${fmt(dayTotals(d).k)}</span></button>`).join('')}</div>`;
  const missing=mealOrder().filter(m=>!candidates(m).length);
  if(missing.length) html+=`<div class="warn">Нет подходящих рецептов для: ${missing.map(m=>MEALMAP[m].name.toLowerCase()).join(', ')}. Ослабьте фильтры в профиле.</div>`;
  if(sh.total>S.A.budget) html+=`<div class="warn">Даже самые экономные подходящие блюда дороже бюджета на ~${rub(sh.total-S.A.budget)}. Попробуйте увеличить бюджет или отметить продукты, которые есть дома.</div>`;
  days.forEach(d=>{ const t=dayTotals(d);
    html+=`<div class="dayh" id="day${d}"><div class="row"><div class="n">${DAYS_FULL[d]}</div><div class="kc">${fmt(t.k)}${NB}ккал</div></div>${macroBar(t)}</div>`;
    plan.slots.forEach((s,i)=>{ if(s.d!==d) return; const r=s.r&&RMAP[s.r]; const lbl=MEALMAP[s.m].short;
      if(!r){ html+=`<div class="meal empty-meal"><div class="ph thumb" style="background:var(--bg)">🤷</div><div class="mi"><div class="mlabel">${lbl}</div><div class="mt">Нет подходящих рецептов</div><div class="mm">Ослабьте фильтры в профиле</div></div></div>`; return; }
      html+=`<div class="meal" data-act="open" data-id="${r.id}">${photo(r,'thumb')}<div class="mi"><div class="mlabel">${lbl}</div><div class="mt">${esc(r.t)}</div><div class="mm">${mealMeta(r)}</div>${s.left?'<span class="lefttag">📦 из остатков ужина</span>':''}</div>
      <button class="swap" data-act="swap" data-i="${i}" aria-label="Заменить">${ICON.swap}Заменить</button></div>`; });
  });
  html+=`<p class="foot">КБЖУ — на одну взрослую порцию, рассчитаны по таблицам состава продуктов. Цены — примерные демо-данные, не актуальные цены магазинов.</p>`;
  return html;
}
function renderShop(){
  const sh=shopping(); const b=S.A.budget; const pct=Math.min(100,Math.round(sh.total/b*100));
  let html=`<h1>Список покупок</h1><p class="sub">${sh.items.length} ${plural(sh.items.length,'позиция','позиции','позиций')} · ${store().name} · на ${dec(portions())} ${plural(Math.ceil(portions()),'порцию','порции','порций')}</p>
  <div class="sumcard"><div class="sumrow"><div><div class="mut small" style="font-weight:700">Итого примерно</div><div class="v">${rub(sh.total)}</div></div><div style="text-align:right"><div class="mut small" style="font-weight:700">Бюджет</div><div style="font-weight:800;font-size:18px">${rub(b)}</div></div></div>
  <div class="bar"><i style="width:${pct}%;background:${sh.total<=b?'var(--g)':'var(--red)'}"></i></div>
  <div class="small" style="font-weight:700;color:${sh.total<=b?'var(--gt)':'#B91C1C'}">${sh.total<=b?'✓ Укладываемся, остаётся '+rub(b-sh.total):'Превышение на '+rub(sh.total-b)}</div></div>`;
  if(S.extras.length) html+=`<div class="chips" style="margin-top:12px">${S.extras.map((x,i)=>`<button class="chip sel" data-act="rmextra" data-i="${i}">➕ ${esc(RMAP[x.r].t)} · ${x.serv} порц. <span class="x">×</span></button>`).join('')}</div>`;
  AISLES.forEach(a=>{ const it=sh.items.filter(x=>x.g.aisle===a.id); if(!it.length) return;
    html+=`<div class="aisle">${a.e} ${a.name} <span class="c">${it.length}</span></div>`;
    it.forEach(x=>{ const done=S.ticks[x.k];
      html+=`<div class="li ${done?'done':''}"><button class="cb" data-act="tick" data-id="${x.k}" aria-label="Отметить">${ICON.check}</button><span class="e">${x.g.e}</span>
      <div class="nm"><b>${esc(x.g.name)} · ${fmtPack(x.g.pack,x.g.unit)} × ${x.packs}</b><span>нужно ≈ ${fmtAmount(x.q,x.g.unit)}</span></div><div class="pr">~${rub(x.price)}</div></div>`; }); });
  if(sh.home.length){ html+=`<div class="aisle">🏠 Есть дома <span class="c">${sh.home.length}</span></div>`;
    sh.home.forEach(x=>{ html+=`<div class="li"><span class="e">${x.g.e}</span><div class="nm"><b>${esc(x.g.name)}</b><span>понадобится ≈ ${fmtAmount(x.q,x.g.unit)}</span></div><span class="homepill">есть дома</span></div>`; }); }
  html+=`<div class="stack" style="margin-top:22px"><button class="btn out sm" data-act="copylist">Скопировать список</button></div>
  <p class="foot">Количество округлено до реальных упаковок. Цены — примерные демо-данные для ${store().name} (2025–2026), не актуальные цены магазина.</p>`;
  return html;
}
function renderRecipes(){
  const f=S.rfilter, cat=S.rcat||'all'; let list=RECIPES;
  if(f==='fit') list=list.filter(r=>!whyNot(r)); else if(f==='fav') list=list.filter(r=>S.favs.includes(r.id));
  list=list.filter(r=>inCat(r,cat));
  const fitN=RECIPES.filter(r=>!whyNot(r)).length;
  const empty=f==='fav'?`<div class="empty">${ill('empty','<div style="font-size:54px">💚</div>')}<b>Пока пусто</b>Нажмите на сердечко на странице рецепта — он появится здесь.</div>`
    :`<div class="empty">${ill('empty','<div style="font-size:54px">🍽️</div>')}<b>Ничего не нашлось</b>Попробуйте другую категорию или вкладку «Все».</div>`;
  return `<h1>Рецепты</h1><p class="sub">${RECIPES.length} ${plural(RECIPES.length,'рецепт','рецепта','рецептов')} в базе, ${fitN} подходят вам</p>
  <div class="search">${ICON.search}<input type="search" placeholder="Найти блюдо" data-search="recipes" autocomplete="off"></div>
  <div class="tabs">${[['fit','Подходят вам'],['fav','Избранное ('+S.favs.length+')'],['all','Все рецепты']].map(t=>`<button class="tab ${f===t[0]?'on':''}" data-act="rfilter" data-id="${t[0]}">${t[1]}</button>`).join('')}</div>
  <div class="tabs" style="margin-top:-6px">${CATS.map(c=>`<button class="chip ${cat===c[0]?'sel':''}" style="flex:0 0 auto;padding:7px 12px;font-size:13px" data-act="rcat" data-id="${c[0]}">${c[1]}</button>`).join('')}</div>
  ${list.length?`<div class="rgrid" id="flt">${list.map(r=>{ const wn=whyNot(r);
    return `<div class="rc" data-act="open" data-id="${r.id}" data-name="${esc(r.t.toLowerCase())}">${photo(r,'th',false,(S.favs.includes(r.id)?'<span class="fav">❤️</span>':'')+`<span class="tm">${r.prep+r.cook}${NB}мин</span>`)}
    <div class="b"><b>${esc(r.t)}</b><span>${r.k}${NB}ккал · Б${NB}${r.p} Ж${NB}${r.f} У${NB}${r.cb}</span><span style="color:${wn?'#B45309':'var(--gt)'}">${wn?esc(wn):'~'+fmt(portionCost(r))+NB+'₽/порц'}</span></div></div>`;}).join('')}</div>`:empty}`;
}
function listNames(arr,src){ const n=arr.filter(x=>x!=='none').map(id=>{const o=src.find(s=>s.id===id); return o?o.name:id;}); return n.length?n.join(', '):'—'; }
function renderProfile(){
  const a=S.A;
  const rows=[['Магазин',store().name,'q1'],['Город',S.city,'city'],['Едоки',`${a.adults} взр. · ${a.kids} дет. · ${dec(portions())} порц./приём`,'q2'],
   ['Приёмы пищи',listNames(a.meals,MEALS),'q3'],['Дни',dayOrder().map(d=>DAYS[d]).join(', '),'q4'],['Техника',listNames(a.equip,EQUIP),'q5'],
   ['Питание',a.diets.includes('none')?'Без ограничений':listNames(a.diets,DIETS),'q6'],['Любимые кухни',listNames(a.cuisines,CUISINES),'q6'],['Формат',listNames(a.styles,STYLES),'q7'],
   ['Аллергии',a.allergies.includes('none')?'Нет':listNames(a.allergies,ALLERGENS),'q8'],['Не любите',a.dislikes.map(id=>DISLIKES.find(d=>d[0]===id)[1]).join(', ')||'—','q9'],
   ['Есть дома',a.pantry.length?a.pantry.map(k=>shortName(ING[k].name).toLowerCase()).join(', '):'—','q10'],['Бюджет',rub(a.budget)+' / неделя','q11']];
  return `<h1>Профиль</h1><p class="sub">Ваши ответы. Нажмите на строку, чтобы изменить — план пересоберётся.</p>
  <div class="card" style="padding:4px 16px">${rows.map(r=>`<div class="prow" data-act="${r[2]==='city'?'city':'edit'}" data-id="${r[2]}" style="cursor:pointer"><span class="k">${r[0]}</span><span class="v">${esc(r[1])} <span class="mut">›</span></span></div>`).join('')}</div>
  <div class="stack" style="margin-top:20px"><button class="btn" data-act="regen">${ICON.swap} Пересобрать план</button><button class="btn sec" data-act="edit" data-id="q1">Изменить ответы</button><button class="btn sec" data-act="restart" style="color:#B91C1C">Начать заново</button></div>
  <p class="foot">${APP_NAME} · прототип. Цены — примерные демо-данные, не актуальные цены магазинов. Интеграции с магазинами пока нет.</p>`;
}
/* --- рецепт --- */
function renderRecipe(){
  const r=RMAP[S.recipe]; const c=CUISMAP[r.c]; const fav=S.favs.includes(r.id); const n=S.serv; const wn=whyNot(r); const rem=removedIngs(r);
  const btns=(inTG?'':`<button class="icon-btn" style="left:14px" data-act="closerecipe" aria-label="Назад">${ICON.back}</button>`)+
   `<button class="icon-btn" style="right:14px;color:${fav?'#EF4444':'#111827'}" data-act="fav" aria-label="В избранное">${fav?ICON.heartf:ICON.heart}</button>`;
  const tags=[`<span class="rtag g">${CATNAME[rcat(r)]}</span>`].concat(['lean','veg','hp','kids'].filter(x=>DIETCHK[x](r)).map(x=>`<span class="rtag">${({lean:'🌾 Постное',veg:'🥦 Вегетарианское',hp:'💪 Много белка',kids:'🧸 Детям'})[x]}</span>`));
  if(r.prep+r.cook<=25) tags.push('<span class="rtag">⚡ Быстро</span>');
  return `${photo(r,'hero',true,btns)}
  <div class="rbody"><div class="rmeta">${c.e} ${c.name} кухня · ${r.m.map(m=>MEALMAP[m].name).join(', ')}</div>
  <h1 style="margin-top:6px">${esc(r.t)}</h1><div class="rtags">${tags.join('')}</div>
  ${wn?`<div class="warn" style="margin:12px 0 0">Не подходит под ваши ответы: ${esc(wn)}</div>`:''}
  <div class="actions">
   <button class="act ${fav?'on':''}" data-act="fav"><span class="c">${fav?ICON.heartf:ICON.heart}</span>В избранное</button>
   <button class="act" data-act="toplan"><span class="c">${ICON.cal}</span>В план</button>
   <button class="act" data-act="toshop"><span class="c">${ICON.cart}</span>В покупки</button>
   <button class="act" data-act="sharerecipe"><span class="c">${ICON.share}</span>Поделиться</button></div>
  <h2>КБЖУ на порцию</h2>
  <div class="kb"><div class="k"><b>${r.k}</b><span>ккал</span></div><div class="p"><b>${r.p}</b><span>белки, г</span></div><div class="f"><b>${r.f}</b><span>жиры, г</span></div><div class="c"><b>${r.cb}</b><span>углеводы, г</span></div></div>
  <div class="kbnote">Рассчитано по составу ингредиентов (таблицы Скурихина/USDA), на 1 из ${r.sv} ${plural(r.sv,'порции','порций','порций')}.</div>
  <div class="times"><div><b>${r.prep} мин</b>подготовка</div><div><b>${r.cook} мин</b>готовка</div><div><b>~${fmt(portionCost(r))} ₽</b>за порцию</div></div>
  <h2>Нужна техника</h2><div class="chips">${r.eq.length?r.eq.map(e=>{const q=EQUIP.find(x=>x.id===e); return `<span class="chip ${S.A.equip.includes(e)?'sel':''}">${q.e} ${q.name}</span>`;}).join(''):'<span class="chip">🙌 Без техники</span>'}</div>
  <div class="seg"><button class="${S.rtab==='ing'?'on':''}" data-act="rtab" data-id="ing">Ингредиенты</button><button class="${S.rtab==='steps'?'on':''}" data-act="rtab" data-id="steps">Приготовление · ${r.steps.length} ${plural(r.steps.length,'шаг','шага','шагов')}</button></div>
  ${S.rtab==='ing'?`<div class="stepper-card" style="margin-bottom:8px"><div><div class="t">Порции</div><div class="s">количества пересчитаются</div></div><div class="stepper"><button data-act="serv" data-d="-1" ${n<=1?'disabled':''}>−</button><span class="v">${n}</span><button data-act="serv" data-d="1" ${n>=12?'disabled':''}>+</button></div></div>
   ${recipeIngs(r).map(i=>{const g=ING[i.k]; const home=S.A.pantry.includes(i.k); return `<div class="ing"><span class="e">${g.e}</span><span class="n">${esc(g.name)} ${home?'<span class="homepill">есть дома</span>':''}</span><span class="q">${fmtIngQty(i.k,i.q*n/r.sv,g.unit)}</span></div>`;}).join('')}
   ${rem.length?`<p class="mut small" style="margin-top:10px">Убрали, т.к. вы не любите: ${rem.map(i=>ING[i.k].name.toLowerCase()).join(', ')}</p>`:''}`
  :`<ol class="steps">${r.steps.map(s=>`<li><span>${esc(s)}</span></li>`).join('')}</ol>`}
  <p class="foot">Стоимость — по примерным демо-ценам для ${store().name}.</p></div>`;
}
/* --- модалки и тосты --- */
function modal(html){ closeModal(); const d=document.createElement('div'); d.className='mback'; d.id='modal'; d.innerHTML=`<div class="modal">${html}</div>`;
  d.addEventListener('click',e=>{ if(e.target===d) closeModal(); }); document.body.appendChild(d); syncTG(); }
function closeModal(){ const m=document.getElementById('modal'); if(m){ m.remove(); syncTG(); } }
let toastT; function toast(t){ let el=document.querySelector('.toast'); if(!el){ el=document.createElement('div'); el.className='toast'; document.body.appendChild(el);} el.textContent=t; clearTimeout(toastT); toastT=setTimeout(()=>el.remove(),2200); }
function listText(){
  const sh=shopping(); let t=`Список покупок — ${APP_NAME} (${store().name})\n`;
  AISLES.forEach(a=>{ const it=sh.items.filter(x=>x.g.aisle===a.id); if(!it.length) return; t+=`\n${a.name}:\n`;
    it.forEach(x=>{ t+=`${S.ticks[x.k]?'✓':'•'} ${x.g.name} ${fmtPack(x.g.pack,x.g.unit)} × ${x.packs} — ~${rub(x.price)}\n`; }); });
  t+=`\nИтого: ~${rub(sh.total)} (бюджет ${rub(S.A.budget)})\n`;
  if(sh.home.length) t+=`\nЕсть дома: ${sh.home.map(x=>x.g.name.toLowerCase()).join(', ')}\n`;
  return t.replace(/\u00A0/g,' ');
}
function copyText(text){
  const ok=()=>toast('Скопировано в буфер обмена');
  const fallback=()=>{ try{ const ta=document.createElement('textarea'); ta.value=text; ta.style.position='fixed'; ta.style.opacity='0'; document.body.appendChild(ta); ta.select(); const r=document.execCommand('copy'); ta.remove(); if(r){ok();return;} }catch(e){}
    modal(`<h3>Скопируйте вручную</h3><textarea readonly>${esc(text)}</textarea><div style="height:12px"></div><button class="btn sec" data-act="closemodal">Закрыть</button>`); };
  if(navigator.clipboard && window.isSecureContext){ navigator.clipboard.writeText(text).then(ok,fallback); } else fallback();
}
function shareText(title,text){
  if(navigator.share){ navigator.share({title,text}).catch(err=>{ if(err&&err.name!=='AbortError') copyText(text); }); }
  else copyText(text);
}
function cityModal(){ modal(`<h3>Ваш город</h3><p>Нужен, чтобы в будущем подтягивать акции ближайших магазинов.</p><input type="text" id="cityin" value="${esc(S.city)}" maxlength="40"><button class="btn" data-act="savecity">Сохранить</button>`);
  setTimeout(()=>{const i=document.getElementById('cityin'); if(i){i.focus(); i.select();}},50); }

/* ====== СОБЫТИЯ ====== */
const HAP_SEL=new Set(['store','meal','day','equip','diet','cuis','style','allergy','dislike','pantry','ptab','tab','rfilter','rcat','rtab','tick','jumpday']);
const HAP_TAP=new Set(['cnt','serv','fav','next','prev','build','swap','open','go','toplan','toshop','putplan','regen']);
function toggle(arr,id){ const i=arr.indexOf(id); if(i>=0) arr.splice(i,1); else arr.push(id); }
function go(sc){ set({screen:sc, recipe:null}); }
document.addEventListener('click',e=>{
  const el=e.target.closest('[data-act]'); if(!el) return;
  const act=el.dataset.act, id=el.dataset.id, a=S.A;
  if(HAP_SEL.has(act)) hap('sel'); else if(HAP_TAP.has(act)) hap('light');
  switch(act){
  case 'go': go(el.dataset.to); break;
  case 'continue': go(STEPS.includes(S.screen)?S.screen:'q1'); break;
  case 'goapp': set({screen:'app'}); break;
  case 'prev': prevStep(); break;
  case 'next': { const i=STEPS.indexOf(S.screen); go(STEPS[i+1]); break; }
  case 'restart': modal(`<h3>Начать заново?</h3><p>Ответы, план и список покупок будут удалены.</p><div class="stack"><button class="btn" data-act="dorestart" style="background:#EF4444;box-shadow:none">Да, начать заново</button><button class="btn sec" data-act="closemodal">Отмена</button></div>`); break;
  case 'dorestart': closeModal(); try{localStorage.removeItem(LS_KEY);}catch(_){} S=fresh(); save(); render(); break;
  case 'closemodal': closeModal(); break;
  case 'city': cityModal(); break;
  case 'savecity': { const v=(document.getElementById('cityin').value||'').trim(); closeModal(); if(v) set({city:v}); break; }
  case 'store': a.store=id; save(); render(); break;
  case 'cnt': { const d=+el.dataset.d; a[id]=Math.max(id==='adults'?1:0,Math.min(10,a[id]+d)); a.budget=null; save(); render(); break; }
  case 'meal': toggle(a.meals,id); a.budget=null; save(); render(); break;
  case 'day': toggle(a.days,+id); a.budget=null; save(); render(); break;
  case 'equip': toggle(a.equip,id); save(); render(); break;
  case 'diet': if(id==='none') a.diets=['none']; else { a.diets=a.diets.filter(x=>x!=='none'); toggle(a.diets,id); if(!a.diets.length) a.diets=['none']; } save(); render(); break;
  case 'cuis': toggle(a.cuisines,id); save(); render(); break;
  case 'style': toggle(a.styles,id); save(); render(); break;
  case 'allergy': if(id==='none') a.allergies=['none']; else { a.allergies=a.allergies.filter(x=>x!=='none'); toggle(a.allergies,id); if(!a.allergies.length) a.allergies=['none']; } save(); render(); break;
  case 'dislike': toggle(a.dislikes,id); save(); render(); reapplySearch(); break;
  case 'pantry': toggle(a.pantry,id); save(); render(); reapplySearch(); break;
  case 'ptab': S.ptab=id; save(); render(); reapplySearch(); break;
  case 'build': if(!(a.budget>0)) return; S.editing=false; set({screen:'loading',ticks:{}}); break;
  case 'tab': S.tab=id; set({recipe:null}); break;
  case 'swap': e.stopPropagation(); swapMeal(+el.dataset.i); break;
  case 'open': S.serv=Math.max(1,Math.ceil(portions())); S.rtab='ing'; set({recipe:id}); break;
  case 'closerecipe': navDir='back'; set({recipe:null}); break;
  case 'rtab': set({rtab:id}); break;
  case 'serv': S.serv=Math.max(1,Math.min(12,S.serv+(+el.dataset.d))); save(); render(); break;
  case 'fav': toggle(S.favs,S.recipe); save(); render(); toast(S.favs.includes(S.recipe)?'Добавлено в избранное':'Убрано из избранного'); break;
  case 'toplan': toPlanModal(); break;
  case 'putplan': { replaceSlot(+el.dataset.i,S.recipe); closeModal(); save(); render(); toast('Добавлено в план'); break; }
  case 'toshop': S.extras.push({r:S.recipe,serv:S.serv}); save(); toast(`Ингредиенты на ${S.serv} порц. добавлены в покупки`); break;
  case 'rmextra': S.extras.splice(+el.dataset.i,1); save(); render(); break;
  case 'sharerecipe': { const r=RMAP[S.recipe]; const t=`${r.t}\n\nИнгредиенты (${S.serv} порц.):\n`+recipeIngs(r).map(i=>`• ${ING[i.k].name} — ${fmtIngQty(i.k,i.q*S.serv/r.sv,ING[i.k].unit)}`).join('\n')+`\n\nПриготовление:\n`+r.steps.map((s,i)=>`${i+1}. ${s}`).join('\n')+`\n\n— ${APP_NAME}`;
    shareText(r.t,t.replace(/\u00A0/g,' ')); break; }
  case 'rfilter': set({rfilter:id}); break;
  case 'rcat': set({rcat:id}); break;
  case 'jumpday': { const t=document.getElementById('day'+id); if(t) t.scrollIntoView({behavior:'smooth',block:'start'}); document.querySelectorAll('.daystrip button').forEach(b=>b.classList.toggle('on',b===el)); break; }
  case 'tick': S.ticks[id]=!S.ticks[id]; save(); render(); break;
  case 'cart': modal(`<div style="font-size:44px">🛒</div><h3>Интеграция с магазином скоро</h3><p>Скоро можно будет собрать корзину в ${store().loc} в один клик. Пока можно скопировать список или поделиться им.</p>
    <div class="stack"><button class="btn" data-act="copylist">Скопировать список</button><button class="btn out" data-act="sharelist">${ICON.share} Поделиться</button><button class="btn sec sm" data-act="closemodal">Закрыть</button></div>`); break;
  case 'copylist': closeModal(); copyText(listText()); break;
  case 'sharelist': closeModal(); shareText('Список покупок',listText()); break;
  case 'edit': S.editing=id; go(id); break;
  case 'regen': set({screen:'loading',ticks:{}}); break;
  }
});
function toPlanModal(){
  const r=RMAP[S.recipe];
  const opts=S.plan.slots.map((s,i)=>({s,i})).filter(o=>r.m.includes(o.s.m));
  modal(`<h3>Добавить в план</h3><p>Выберите, какое блюдо заменить на «${esc(r.t)}».</p>
  ${opts.length?`<div class="stack">${opts.map(o=>{const cur=o.s.r?RMAP[o.s.r].t:'пусто'; return `<button class="btn sec sm" style="justify-content:flex-start;padding:0 18px;font-size:14px" data-act="putplan" data-i="${o.i}">${DAYS[o.s.d]} · ${MEALMAP[o.s.m].name}: <span class="mut" style="font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(cur)}</span></button>`;}).join('')}</div>`
  :`<div class="warn">В плане нет подходящих приёмов пищи (${r.m.map(m=>MEALMAP[m].name.toLowerCase()).join(', ')}).</div>`}
  <div style="height:10px"></div><button class="btn sec" data-act="closemodal">Отмена</button>`);
}
let searchQ='';
function reapplySearch(){ const inp=document.querySelector('[data-search]'); if(!inp) return; inp.value=searchQ; filterTiles(searchQ); }
function filterTiles(q){ q=q.trim().toLowerCase(); document.querySelectorAll('#flt [data-name]').forEach(b=>{ b.style.display=!q||b.dataset.name.includes(q)?'':'none'; }); }
document.addEventListener('input',e=>{
  const t=e.target;
  if(t.dataset.search){ searchQ=t.value; filterTiles(searchQ); return; }
  if(t.id==='bin'){ const v=parseInt(t.value.replace(/\D/g,''),10)||0; S.A.budget=Math.min(999999,v); t.value=v?fmt(S.A.budget):''; const r=document.getElementById('brange'); const rg=budgetRange(); r.value=Math.min(rg.max,Math.max(rg.min,v)); save(); updateBudgetUI(); return; }
  if(t.id==='brange'){ S.A.budget=+t.value; const b=document.getElementById('bin'); if(b) b.value=fmt(S.A.budget); save(); updateBudgetUI(); return; }
});
document.addEventListener('focusin',e=>{ if(e.target.id==='bin') setTimeout(()=>{ try{e.target.select();}catch(_){} },0); });
document.addEventListener('keydown',e=>{ if(e.key==='Enter'&&e.target.id==='cityin'){ const btn=document.querySelector('[data-act=savecity]'); if(btn) btn.click(); } if(e.key==='Escape') closeModal(); });
// переходы по экранам сбрасывают поиск
const _go=go; go=function(sc){ searchQ=''; _go(sc); };
document.title=APP_NAME+' — план питания на неделю';
if(inTG){ try{ applyTheme(); TG.onEvent('themeChanged',applyTheme); if(tgv('6.1')) TG.BackButton.onClick(goBack); if(tgv('7.7')&&TG.disableVerticalSwipes) TG.disableVerticalSwipes(); document.documentElement.classList.add('tg'); }catch(e){ console.warn(e); } }
if(S.screen==='loading') loadingRun=false;
render();
