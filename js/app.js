'use strict';
/* ====== ПРОИЗВОДНЫЕ ДАННЫЕ ====== */
const RMAP = {};
RECIPES.forEach(r=>{
  if(r.ing.every(i=>ING[i.k])) normalizePortion(r);
  const fl = new Set(); r.ing.forEach(i=>{ if(!ING[i.k]) console.error('Нет ингредиента', i.k, r.id); else ING[i.k].flags.forEach(f=>fl.add(f)); });
  r.meat = fl.has('meat'); r.fish = fl.has('fish')||fl.has('seafood');
  r.al = ['nuts','peanut','dairy','eggs','gluten','fish','seafood','soy','sesame','honey','mustard'].filter(a=>fl.has(a));
  calcNutrition(r);
  RMAP[r.id] = r;
});
/* Гарнир учитывает аллергии: если гарнир (хлеб) содержит аллерген пользователя — подменяем на безопасный аналог
   (рисовые хлебцы без глютена/кунжута), чтобы рецепт не выпадал из плана и в план не попадал аллерген. */
const SIDE_ALT={bread:{k:'rice_cakes',f:0.6,name:'рисовые хлебцы'}};
const ALLERGEN_IDS=['nuts','peanut','dairy','eggs','gluten','fish','seafood','soy','sesame','honey','mustard'];
function deriveFlags(r){ const fl=new Set(); r.ing.forEach(i=>ING[i.k]&&ING[i.k].flags.forEach(f=>fl.add(f)));
  r.meat=fl.has('meat'); r.fish=fl.has('fish')||fl.has('seafood'); r.al=ALLERGEN_IDS.filter(a=>fl.has(a)); calcNutrition(r); }
let SIDE_MODE=null;
function applySides(){ const al=new Set(((S&&S.A&&S.A.allergies)||[]).filter(x=>x!=='none')); const key=[...al].sort().join();
  if(key===SIDE_MODE) return; SIDE_MODE=key;
  RECIPES.forEach(r=>{ const i=r.ing.findIndex(x=>x.side); if(i<0) return;
    const o=r.sideOrig||(r.sideOrig={k:r.ing[i].k,q:r.ing[i].q,name:r.side,si:r.steps.indexOf(SIDE_STEP[r.ing[i].k])});
    const alt=SIDE_ALT[o.k]; const use=(ING[o.k].flags.some(f=>al.has(f)) && alt && !ING[alt.k].flags.some(f=>al.has(f)))?alt:null;
    const k=use?use.k:o.k; if(r.ing[i].k===k) return;
    r.ing[i]={k,q:use?Math.round(o.q*use.f):o.q,side:true}; r.side=use?use.name:o.name; if(o.si>=0) r.steps[o.si]=SIDE_STEP[k];
    deriveFlags(r); }); }
const MEALMAP = Object.fromEntries(MEALS.map(m=>[m.id,m]));
const CUISMAP = Object.fromEntries(CUISINES.map(c=>[c.id,c]));
const STEPS = ['q1','q2','q2b','q3','q4','q5','q6','q7','q8','q9','q10','q11'];
/* категории блюд — выводятся из названия и приёма пищи */
const SOUP_RE=/суп|борщ|(^|\s)щи(\s|$)|окрошка|солянка|рассольник|^уха(\s|$)|харчо|шурпа|свекольник|гаспачо|минестроне|бульон/i;
const SALAD_RE=/^(тёплый )?салат|винегрет|оливье|под шубой|мимоза|табуле|цезарь|по-корейски|^свёкла с/i;
function rcat(r){ if(r._cat) return r._cat; let c;
  if(SOUP_RE.test(r.t)) c='soup'; else if(SALAD_RE.test(r.t)) c='salad'; else if(r.m[0]==='b') c='breakfast'; else if(r.m[0]==='s') c='snack'; else c='hot';
  return r._cat=c; }
const CATS=[['all','Все'],['ff','Фастфуд'],['breakfast','Завтраки'],['soup','Супы'],['hot','Горячее'],['salad','Салаты'],['snack','Перекусы'],['kids','Детям'],['lean','Постное'],['veg','Вегетарианское'],['hp','Белковое']];
const CATNAME=Object.fromEntries(CATS);
function inCat(r,c){ if(c==='all') return true; if(c==='ff') return isFF(r); if(['kids','lean','veg','hp'].includes(c)) return DIETCHK[c](r); return rcat(r)===c; }
/* ====== ИЗОБРАЖЕНИЯ ====== */
const HAS_R=new Set(typeof IMG_R!=='undefined'?IMG_R:[]), HAS_I=new Set(typeof IMG_I!=='undefined'?IMG_I:[]);
function ilu(n){ return HAS_I.has(n)?'img/i/'+n+'.webp':null; }
function ill(n,fb,cls){ const u=ilu(n); return u?`<img class="${cls||'ill'}" src="${u}" alt="" loading="lazy" decoding="async">`:fb; }
function photo(r,cls,big,extra){ const c=CUISMAP[r.c]; let inner;
  if(HAS_R.has(r.id)) inner=`<img src="img/r/${big?'':'s/'}${r.id}.webp" alt="${esc(r.t)}" ${big?'':'loading="lazy"'} decoding="async" onerror="this.remove()">`;
  else { const u=ilu(fbName(r)); inner=u?`<img class="fb" src="${u}" alt="" loading="lazy" decoding="async">`:`<span>${r.e}</span>`; }
  return `<div class="ph ${cls}" style="background:linear-gradient(135deg,${c.g[0]},${c.g[1]})">${inner}${extra||''}</div>`; }
/* Запасная иллюстрация — нейтральная по категории, чтобы не показывать мясо на овощном блюде */
function fbName(r){ const c=rcat(r);
  if(c==='hot') return r.meat?'cat_hot':(r.fish?'empty':'diet_veg');
  if(c==='soup') return r.meat||r.fish||!ilu('diet_veg')?'cat_soup':'diet_veg';
  if(c==='breakfast') return (r.al.includes('eggs')||r.al.includes('dairy'))?'cat_breakfast':'diet_lean';
  if(c==='snack') return /фрукт|яблок|банан|груш|ягод/i.test(r.t)?'cat_snack':'empty';
  return 'cat_'+c; }
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
function prevStep(){ const i=STEPS.indexOf(S.screen); navDir='back'; if(S.editing && S.plan && S.screen===S.editing){ finishEdit(); } else go(i>0?STEPS[i-1]:'intro'); }
/* Редактирование одного ответа из профиля: «Сохранить» → если что-то изменилось, план пересобирается (быстрая загрузка) */
function startEdit(id){ S.editing=id; S.editSnap=JSON.stringify(S.A); go(id); }
function finishEdit(){ const changed=S.editSnap!==JSON.stringify(S.A); S.editing=false; S.editSnap=null; navDir='back';
  if(changed && S.plan){ if(S.A.budget==null) S.A.budget=defaultBudget(); S.quick=true; S.tab='week'; set({screen:'loading',ticks:{}}); } else { S.tab='profile'; set({screen:'app'}); } }
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
const TO_TASTE=new Set(['salt','spices','black_pepper','paprika','cumin','coriander','khmeli','curry','cinnamon']);
function fmtIngQty(k,q,unit){ // для рецепта
  if(TO_TASTE.has(k)) return 'по вкусу'; if(k==='bay_leaf') return '1–2 листа';
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
     diets:['none'], cuisines:[], styles:[], ff:'some', allergies:['none'], dislikes:[], pantry:[], budget:null, budgetManual:false, people:null},
  plan:null, ticks:{}, favs:[], extras:[], tab:'week', recipe:null, rtab:'ing', serv:2, rfilter:'fit', ptab:'all'}; }
function load(){ try{ const s=JSON.parse(localStorage.getItem(LS_KEY)); if(s&&s.A){ const f=fresh(); const o=Object.assign(f,s); o.A=Object.assign(fresh().A,s.A); if(STORE_ALIAS[o.A.store]) o.A.store=STORE_ALIAS[o.A.store]; if(o.A.store&&!STORES.some(x=>x.id===o.A.store)) o.A.store='p5'; return o; } }catch(e){} return null; }
let S = load() || fresh();
function save(){ try{ localStorage.setItem(LS_KEY, JSON.stringify(S)); }catch(e){} }
function set(p){ Object.assign(S,p); save(); render(); }
function setA(p){ Object.assign(S.A,p); save(); render(); }
const A = ()=>S.A;
function storeLogo(s){ const fb=`<div class="badge" style="background:${s.bg};color:${s.color}">${s.ini}</div>`;
  return s.logo?`<div class="badge logo"><img src="${s.logo}" alt="${s.name}" width="52" height="52" decoding="async" onerror="this.parentNode.outerHTML=this.parentNode.dataset.fb"></div>`.replace('<div class="badge logo">',`<div class="badge logo" data-fb='${fb.replace(/'/g,'&#39;')}'>`):fb; }
function store(){ return STORES.find(s=>s.id===S.A.store) || STORES[0]; }

/* ====== ЦЕНЫ ====== data/prices.json: {ингредиент: {p5,magnit,…: ₽ за упаковку, source, date}, _meta} */
let PRICES_META=null;
function applyPrices(P){ if(!P||!P._meta) return; Object.keys(P).forEach(k=>{ const g=ING[k], p=P[k]; if(!g||k==='_meta') return;
  g.sp={}; STORES.forEach(st=>{ if(typeof p[st.id]==='number') g.sp[st.id]=p[st.id]; }); g.psrc=p.source; g.real=p.real||null; g.est=p.est||null; }); PRICES_META=P._meta; _baseCache={}; }
function loadPrices(){ const t=new Promise(res=>setTimeout(res,3000));
  const f=fetch('data/prices.json',{cache:'no-cache'}).then(r=>r.ok?r.json():null).then(applyPrices).catch(()=>{});
  return Promise.race([f,t]); }
function priceDate(){ if(!PRICES_META) return ''; const [y,mo,da]=(PRICES_META.weekly_date||PRICES_META.updated||'').split('-'); return `${+da} ${['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'][+mo-1]} ${y}`; }
/* Реальные цены (ВкусВилл, Лента — официальные открытые API) помечаем «цена магазина» с датой; остальное — «оценка» (Росстат × уровень цен сети) */
const RU_MON=['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
function dateRu(iso){ const [y,mo,da]=(iso||'').split('-'); return da?`${+da} ${RU_MON[+mo-1]} ${y}`:(iso||''); }
function realOf(g,st){ st=st||store(); return g&&g.real&&g.real[st.id]||null; }
function storeReal(st){ st=st||store(); const m=PRICES_META&&PRICES_META.stores&&PRICES_META.stores[st.id]; return m&&(m.matched||m.derived)?m:null; }
function estKind(g,st){ st=st||store(); return g&&g.est&&g.est[st.id]||'rosstat'; }
function priceTag(g,st){ const r=realOf(g,st); if(r) return `<small class="ptag real" title="${esc(r.name)} — ${r.pack_price} ₽ за ${esc(r.size)} (обычная цена)">цена магазина · ${dateRu(r.date).replace(/ \d{4}$/,'')}</small>`;
  return estKind(g,st)==='p5-index'?`<small class="ptag est" title="Цена Пятёрочки × индекс цен сети по категории">оценка · индекс</small>`:`<small class="ptag est" title="Средняя цена Росстата × уровень цен сети">оценка</small>`; }
function priceNote(){ if(!PRICES_META) return 'Цены: примерные запасные данные, ориентировочно.';
  const m=storeReal();
  if(m) return `Цены ${store().name}: для ${m.matched} из ${m.of} продуктов — цена магазина (обычная цена без акций, Москва, ${dateRu(m.date)})${m.derived?`, для ${m.derived} — оценка по индексу к Пятёрочке`:''}, остальные — оценка: Росстат × уровень цен сети (данные на ${priceDate()}).`;
  return `Цены ${store().name} — оценка: Росстат × уровень цен сети (данные на ${priceDate()}); открытого каталога у сети нет.`; }

/* ====== РАСЧЁТЫ ====== */
/* Порции: взрослый = 1, ребёнок = 0,5 (или по его норме калорий, если заполнены параметры КБЖУ) */
function kidFactors(){ return targets().kd.map(k=>k.factor); }
function portions(){ if(!S.A.people) return S.A.adults+S.A.kids*0.5; const T=targets(); return Math.round((T.ad.concat(T.kd).reduce((a,t)=>a+t.factor,0))*10)/10; }
function mealOrder(){ return MEALS.filter(m=>S.A.meals.includes(m.id)).map(m=>m.id); }
function dayOrder(){ return S.A.days.slice().sort((a,b)=>a-b); }
function portionsPerWeek(){ return portions()*S.A.meals.length*S.A.days.length; }
let _baseCache={};
function mealBase(m){ const key=S.A.store+'|'+(PRICES_META?PRICES_META.updated:'')+'|'+S.A.dislikes.join(); if(!_baseCache[key]) _baseCache={[key]:{}};
  const c=_baseCache[key]; if(c[m]==null){ const v=RECIPES.filter(r=>r.m.includes(m)).map(portionCost).sort((a,b)=>a-b); c[m]=v.length?v[Math.floor(v.length/2)]:MEALMAP[m].base; } return c[m]; }

/* ====== НОРМЫ КБЖУ ======
   Источники:
   • Энергия: уравнение Миффлина — Сан Жеора (Mifflin MD, St Jeor ST et al., Am J Clin Nutr 1990;51:241–7) × коэффициент активности
     1,2 / 1,375 / 1,55 / 1,725 / 1,9 (FAO/WHO/UNU 2004, Human energy requirements). Снижение веса — дефицит ≈18 %, набор — +10 %
     (Academy of Nutrition and Dietetics; ISSN position stand on diets and body composition, 2017).
   • Белок: ≥1,2–1,6 г/кг при поддержании, 1,6–2,0 г/кг при снижении веса/наборе; никогда <1,0 г/кг
     (ISSN position stand: protein and exercise, Jäger 2017; Morton 2018 BJSM meta-analysis; PROT-AGE 2013 для взрослых старше 65 — ≥1,0–1,2 г/кг).
   • Жиры 25–35 % ккал (не менее ~0,8 г/кг), углеводы — остальное (MR 2.3.1.0253-21 Роспотребнадзора; EFSA DRV 2017; WHO 2023 fat guideline).
   • Клетчатка ≥25–30 г/сут (WHO 2023 carbohydrate guideline; EFSA). Добавленный сахар <10 % ккал (WHO 2015 sugars guideline).
   • Дети: энергия и белок по возрасту — MR 2.3.1.0253-21 «Нормы физиологических потребностей…» (усреднено по полу);
     клетчатка ≈ возраст + 5 г (правило AAP/Williams 1995), сахар <10 % ккал (WHO).
   Если шаг пропущен — средний взрослый: ≈2200 ккал (среднее 2000 для женщин и 2400 для мужчин), белок 1,2 г/кг × 70 кг ≈ 85 г.
   Это ориентир для планирования, а не медицинская рекомендация. */
const ACT=[[1.2,'Минимальная','сидячая работа, без спорта'],[1.375,'Низкая','1–3 тренировки в неделю'],[1.55,'Средняя','3–5 тренировок'],[1.725,'Высокая','6–7 тренировок'],[1.9,'Очень высокая','физический труд + спорт']];
const GOALS=[['keep','Поддержание'],['lose','Снижение веса'],['gain','Набор массы']];
const KID_NORM=[[3,1300,39],[7,1800,54],[11,2100,63],[14,2400,72],[18,2700,81]]; // до N лет: ккал, белок г (MR 2.3.1.0253-21, среднее м/ж)
function adultTarget(x){
  if(!x||!(x.w>0&&x.h>0&&x.age>0)) { const w=70; const k=x&&x.sex==='m'?2400:x&&x.sex==='f'?2000:2200;
    return {k, pmin:Math.round(w*1.2), pgood:Math.round(w*1.4), w, fat:[k*.25/9,k*.35/9], fib:k>=2200?30:25, sug:k*.1/4, def:true}; }
  const bmr=10*x.w+6.25*x.h-5*x.age+(x.sex==='m'?5:-161); let k=bmr*ACT[x.act==null?1:+x.act][0];
  if(x.goal==='lose') k*=0.82; else if(x.goal==='gain') k*=1.10; k=Math.round(k/10)*10;
  const keep=!x.goal||x.goal==='keep', pk=keep?(x.age>=65?1.2:1.2):1.6, pg=keep?1.5:1.8;
  return {k, pmin:Math.round(x.w*pk), pgood:Math.round(x.w*pg), w:x.w, fat:[Math.max(k*.25/9,0.8*x.w),k*.35/9], fib:k>=2200?30:25, sug:k*.1/4};
}
function kidTarget(age){ const a=age>0?age:6; const n=KID_NORM.find(z=>a<z[0])||KID_NORM[KID_NORM.length-1];
  return {k:n[1], pmin:n[2], pgood:n[2], w:null, fat:[n[1]*.25/9,n[1]*.35/9], fib:Math.min(25,Math.round(a)+5), sug:n[1]*.1/4, age:a}; }
let _tCache={};
function targets(){ const cov=coverage(); const key=JSON.stringify([S.A.adults,S.A.kids,S.A.people,cov]); if(_tCache.key===key) return _tCache.v;
  const P=S.A.people||{}; const ad=[], kd=[]; const STD=2200; /* стандартная взрослая порция плана ≈ 2200 ккал/день */
  const set=!!(P.ad&&P.ad.some(x=>x&&x.w>0&&x.h>0&&x.age>0));
  for(let i=0;i<S.A.adults;i++){ const t=adultTarget(P.ad&&P.ad[i]); t.factor=set&&!t.def?Math.max(0.6,Math.min(1.8,Math.round(t.k/STD*10)/10)):1; ad.push(t); }
  for(let i=0;i<S.A.kids;i++){ const age=P.kd&&P.kd[i]&&P.kd[i].age; const t=kidTarget(age); t.factor=age>0?Math.max(0.4,Math.min(1.2,Math.round(t.k/STD*10)/10)):0.5; kd.push(t); }
  /* Норма на «стандартную порцию»: ккал — средняя, белок — максимальная среди едоков (белок — жёсткий порог для каждого) */
  const all=ad.concat(kd.filter((t,i)=>P.kd&&P.kd[i]&&P.kd[i].age>0));
  const ref={k:all.reduce((a,t)=>a+t.k/t.factor,0)/all.length, pmin:Math.max(...all.map(t=>t.pmin/t.factor)), pgood:Math.max(...all.map(t=>t.pgood/t.factor))};
  const v={ad,kd,ref:{k:ref.k*cov,pmin:ref.pmin*cov,pgood:ref.pgood*cov},cov,set};
  _tCache={key,v}; return v; }
const MEAL_SHARE={b:.25,l:.35,d:.3,s:.1};
function mainMeals(){ return S.A.meals.filter(m=>m!=='s').length; }
function coverage(){ return mainMeals()>=2?1:Math.min(1,S.A.meals.reduce((a,m)=>a+MEAL_SHARE[m],0)); }

/* ====== БЮДЖЕТ: оценка по пробному плану ======
   Типичная сумма = корзина плана, собранного без ограничения бюджета (с вашими фильтрами, упаковками и авто-перекусами);
   минимум = корзина самого экономного плана. Кэшируется по ответам. */
let _estCache={};
function trialTotal(budget){ const sp=S.plan, sb=S.A.budget; S.A.budget=budget; let t=0;
  try{ generatePlan('est',true); t=shopping().total; }catch(e){ console.error(e); } S.plan=sp; S.A.budget=sb; return t; }
function estimate(){ const a=Object.assign({},S.A); delete a.budget; delete a.budgetManual;
  const key=JSON.stringify(a)+(PRICES_META?PRICES_META.updated:'');
  if(_estCache.key!==key){ const typ=trialTotal(1e7), min=trialTotal(1); _estCache={key,v:{typ,min:Math.min(min,typ)}}; } return _estCache.v; }
function typicalCost(){ return estimate().typ; }
const BUDGET_CAP=200000;
function budgetRange(){ const e=estimate(); return {min:Math.max(300,Math.floor(e.min*0.9/100)*100), max:Math.max(1000,Math.ceil(e.typ*2.5/100)*100)}; }
function defaultBudget(){ return Math.max(500, Math.ceil(typicalCost()*1.05/500)*500); }
function budgetStatus(b){
  const e=estimate(), t=e.typ, st=store();
  if(b>=t*3) return {cls:'tight',ic:'💡',title:'Бюджет с большим запасом',text:`Типичная корзина для вашей семьи в ${st.loc} — около ${rub(Math.round(t/100)*100)}. План не станет дороже: лишние деньги просто останутся. Проверьте, не лишний ли ноль.`};
  if(b>=t) return {cls:'ok',ic:'✅',title:'Укладываемся',text:`Типичная корзина для вашей семьи в ${st.loc} — около ${rub(Math.round(t/100)*100)}. Запас ~${rub(Math.max(0,Math.round((b-t)/100)*100))} на непредвиденное.`};
  if(b>=e.min) return {cls:'tight',ic:'⚠️',title:'Впритык — экономная неделя',text:`Типичная корзина — около ${rub(Math.round(t/100)*100)}. Соберём план из недорогих блюд (самый экономный вариант ≈ ${rub(Math.round(e.min/100)*100)}): крупы, курица, сезонные овощи.`};
  return {cls:'bad',ic:'⛔',title:'Не хватит',text:`Даже самая экономная неделя с вашими ответами в ${st.loc} обойдётся примерно в ${rub(Math.round(e.min/100)*100)}. Увеличьте бюджет или уберите перекусы/дни — иначе план будет дороже суммы.`};
}
function dislikedKeys(){ const s=new Set(); S.A.dislikes.forEach(id=>{ const d=DISLIKES.find(x=>x[0]===id); if(d) d[3].forEach(k=>s.add(k)); }); return s; }
function recipeIngs(r){ const dk=dislikedKeys(); return r.ing.filter(i=>!(ING[i.k].opt && dk.has(i.k))); }
function removedIngs(r){ const dk=dislikedKeys(); return r.ing.filter(i=>ING[i.k].opt && dk.has(i.k)); }
const DIETCHK = {
  veg:r=>!r.meat&&!r.fish,
  lean:r=>!r.meat&&!r.fish&&!r.al.includes('dairy')&&!r.al.includes('eggs'),
  pp:r=>r.tags.includes('light')||(r.f*9/r.k<=0.35 && r.k<=(r.kind==='s'?300:700)),
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
/* Обед ↔ ужин: основное блюдо ужина подходит на обед, а не-суп с обеда — на ужин */
function mealOk(r,m){ if(!m||r.m.includes(m)) return true;
  if(m==='l') return r.m.includes('d') && r.kind==='main';
  if(m==='d') return r.m.includes('l') && (r.kind==='main'||r.kind==='salad');
  return false; }
function fits(r,m){ return mealOk(r,m) && !whyNot(r); }
/* Домашний фастфуд: не больше ffCap() блюд с тегом fastfood в неделю (по умолчанию «иногда» = 2); соусы в план не ставим */
const FF_CAP={none:0,some:2,often:4};
const FF_OPTS=[['none','Не нужен'],['some','Иногда (до 2)'],['often','Часто (до 4)']];
function ffCap(){ const v=FF_CAP[S.A.ff||'some']; return v==null?2:v; }
function isFF(r){ return !!r && r.tags.includes('fastfood'); }
function ffCount(skip){ return S.plan?S.plan.slots.filter((s,j)=>j!==skip&&s.r&&!s.hidden&&isFF(RMAP[s.r])).length:0; }
function ffOk(r,skip){ return !isFF(r)||ffCount(skip)<ffCap(); }
function candidates(m){ applySides(); return RECIPES.filter(r=>fits(r,m)&&!r.tags.includes('sauce')&&(ffCap()>0||!isFF(r))); }
function priceOf(g,st){ st=st||store(); return g.sp&&g.sp[st.id]!=null ? g.sp[st.id] : g.price*st.mult; }
function portionCost(r){ const st=store(); return recipeIngs(r).reduce((s,i)=>{const g=ING[i.k]; return s+i.q/r.sv/g.pack*priceOf(g,st);},0); }
function totalTime(r){ return r.prep+r.cook; }
function styleMatch(r,st){
  if(st==='fast') return !r.rest && (r.tags.includes('fast')||totalTime(r)<=25);
  if(st==='light') return r.tags.includes('light')||r.k<=380;
  return r.tags.includes(st);
}
function meatAllowed(){ return !S.A.diets.some(d=>d==='veg'||d==='lean'); }
const MEAT_SHARE=0.65; // доля обедов/ужинов с мясом или птицей для профилей без ограничений
function recipeScore(r,ctx,slotKey){
  const a=S.A; let s=hash((S.plan&&S.plan.seed||'x')+r.id+slotKey)*2.2;
  a.styles.forEach(st=>{ if(styleMatch(r,st)) s+=2.5; });
  if(a.cuisines.includes(r.c)) s+=1.6;
  if(isFF(r) && a.ff==='often') s+=1.5;
  if(a.kids>0 && r.tags.includes('kids')) s+=0.8;
  const batchSt=a.styles.includes('batch');
  const u=(ctx.uses[r.id]||0); s-= u*(batchSt?1.5:4); if(u>=(batchSt?3:2)) s-=12;
  if(ctx.dayRecipes && ctx.dayRecipes.has(r.id)) s-=10;
  let shared=0; recipeIngs(r).forEach(i=>{ if(ctx.ings.has(i.k) && !['salt','spices','oil','sugar','black_pepper'].includes(i.k)) shared++; }); s+=Math.min(shared,4)*0.25;
  if(ctx.target){ const pc=portionCost(r); s-=Math.max(-1,Math.min(3,(pc/ctx.target[r.m.includes(ctx.m)?ctx.m:'d']-1)*2)); }
  if((ctx.m==='l'||ctx.m==='d') && meatAllowed() && ctx.ld!=null){ const sh=ctx.meatN/Math.max(1,ctx.ld);
    if(r.meat) s+= sh<MEAT_SHARE?2.2:-1.4; else s-= sh<MEAT_SHARE-0.05?0.8:0; }
  s+=Math.min(r.fi||0,10)*0.08;
  if(ctx.pNeed && r.kind!=='s'){ s+=Math.max(-1.5,Math.min(2,(r.p-ctx.pNeed)/12)); }
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
    const price=Math.round(packs*priceOf(g,st));
    total+=price; items.push({k,g,q,packs,price});
  });
  const order=AISLES.map(a=>a.id);
  const sorter=(x,y)=>order.indexOf(x.g.aisle)-order.indexOf(y.g.aisle)||x.g.name.localeCompare(y.g.name,'ru');
  items.sort(sorter); home.sort(sorter);
  return {items,home,total};
}
function shopTotalFor(slots){ const save=S.plan; S.plan=Object.assign({},save||{},{slots}); const t=shopping().total; S.plan=save; return t; }

/* ====== ПЛАНИРОВЩИК ======
   1) фильтр по приёму пищи (обед↔ужин взаимозаменяемы), диете, аллергенам, нелюбимому, технике;
   2) жадный выбор по баллам (стиль, кухня, разнообразие — не больше 2 повторов за неделю, общие ингредиенты,
      цена порции относительно цели, ~65 % обедов/ужинов с мясом, белок);
   3) «готовка впрок»: обед следующего дня = остатки ужина (если рецепт batch);
   4) баланс дней под нормы: белок ≥ нормы (жёстко: замена блюда или белковый перекус), ккал в пределах ±10 %;
   5) подгонка под бюджет без потери белка; если не выходит — предупреждение о компромиссе. */
function generatePlan(seed,trial){ applySides();
  const a=S.A; const days=dayOrder(), meals=mealOrder();
  const perPortion=a.budget/(Math.max(1,portionsPerWeek()));
  const baseSum=meals.reduce((s,m)=>s+mealBase(m),0)/meals.length;
  const target={}; MEALS.forEach(m=>target[m.id]=perPortion*mealBase(m.id)/baseSum);
  const T=targets().ref;
  S.plan={seed:seed||String(Date.now()),slots:[],noTop:{}};
  const ctx={uses:{},ings:new Set(),target,meatN:0,ld:0};
  const cands={}; meals.forEach(m=>cands[m]=candidates(m));
  const batch=a.styles.includes('batch')&&meals.includes('l')&&meals.includes('d');
  let prevDinner=-1;
  days.forEach((d,di)=>{
    ctx.dayRecipes=new Set(); let dayP=0;
    meals.forEach((m,mi)=>{
      const slots=S.plan.slots;
      const left=meals.slice(mi).reduce((x,y)=>x+MEAL_SHARE[y],0)||1;
      ctx.pNeed=Math.max(0,(T.pmin-dayP))*MEAL_SHARE[m]/left;
      const take=(r,extra)=>{ slots.push(Object.assign({d,m,r:r.id},extra||{})); dayP+=r.p; ctx.dayRecipes.add(r.id);
        if((m==='l'||m==='d')){ ctx.ld++; if(r.meat) ctx.meatN++; } };
      if(m==='l' && batch && prevDinner>=0){ const src=slots[prevDinner]; const r=src.r&&RMAP[src.r];
        if(r && r.tags.includes('batch') && mealOk(r,'l') && !slots.some(x=>x.src===prevDinner)){ take(r,{src:prevDinner,left:true}); return; } }
      const list=cands[m]; if(!list.length){ slots.push({d,m,r:null}); return; }
      ctx.m=m; let best=null,bs=-1e9;
      list.forEach(r=>{ if(!ffOk(r)) return; const sc=recipeScore(r,ctx,d+m); if(sc>bs){bs=sc;best=r;} });
      take(best); ctx.uses[best.id]=(ctx.uses[best.id]||0)+1;
      recipeIngs(best).forEach(i=>ctx.ings.add(i.k));
      if(m==='d') prevDinner=slots.length-1;
    });
  });
  fitBudget(cands);
  balanceDays(cands);
  fitBudget(cands);
  const sh=shopping();
  S.plan.tradeoff = sh.total>a.budget && S.plan.pBlocked>0;
  if(!trial) save();
}
function dayP(d){ return dayTotals(d).p; }
/* Перекусы и баланс дня. Авто-перекусы добавляются, только если выбрано ≥2 основных приёмов пищи. */
function balanceDays(cands){
  const T=targets().ref, slots=S.plan.slots; const full=mainMeals()>=2;
  const used={}; slots.forEach(x=>{ if(x.r) used[x.r]=(used[x.r]||0)+1; });
  const maxUse=S.A.styles.includes('batch')?3:2;
  const snacks=candidates('s'); const psn=snacks.filter(r=>r.tags.includes('psnack')||r.p*4/r.k>=0.25);
  dayOrder().forEach(d=>{
    const inDay=()=>new Set(slots.filter(x=>x.d===d).map(x=>x.r));
    // 1) белок: меняем блюдо дня на более белковое того же приёма (без лишних ккал)
    for(let g=0; g<4 && dayP(d)<T.pmin; g++){
      const t=dayTotals(d); let best=null;
      slots.forEach((s,i)=>{ if(s.d!==d||!s.r||s.left||s.auto||slots.some(x=>x.src===i)) return; const cur=RMAP[s.r]; const ids=inDay();
        (cands[s.m]||candidates(s.m)).forEach(r=>{ if(ids.has(r.id)||(used[r.id]||0)>=maxUse||!ffOk(r,i)) return; const dp=r.p-cur.p; if(dp<5) return;
          const nk=t.k-cur.k+r.k; if(full && nk>T.k*1.1) return;
          const sc=dp - Math.max(0,portionCost(r)-portionCost(cur))*0.15 - Math.abs(nk-T.k)/80;
          if(!best||sc>best.sc) best={i,r,sc,cur}; }); });
      if(!best) break; used[best.cur.id]--; used[best.r.id]=(used[best.r.id]||0)+1; replaceSlot(best.i,best.r.id);
    }
    if(!full) return;
    // 2) белковый перекус, если белка всё ещё мало
    for(let n=0;n<2 && dayP(d)<T.pmin;n++){ const ids=inDay();
      const pick=psn.filter(r=>!ids.has(r.id)&&(used[r.id]||0)<maxUse&&ffOk(r)).map(r=>({r,sc:Math.min(r.p,T.pmin-dayP(d)+5)/Math.max(10,portionCost(r))-Math.max(0,dayTotals(d).k+r.k-T.k*1.1)/50}))
        .sort((a,b)=>b.sc-a.sc)[0];
      if(!pick) break; slots.push({d,m:'s',r:pick.r.id,auto:true,prot:true}); used[pick.r.id]=(used[pick.r.id]||0)+1; }
    // 3) калории: добираем до −10 % перекусами (не больше 2 авто-перекусов в день)
    for(let n=0;n<2;n++){ const k=dayTotals(d).k; if(k>=T.k*0.9) break; if(slots.filter(x=>x.d===d&&x.auto).length>=2) break;
      const need=T.k-k, ids=inDay();
      const pick=snacks.filter(r=>!ids.has(r.id)&&(used[r.id]||0)<2&&ffOk(r))
        .map(r=>({r,sc:Math.min(r.k,need+100)/Math.max(15,portionCost(r))-Math.max(0,r.k-need-150)/40+hash(S.plan.seed+r.id+d)*0.5}))
        .sort((a,b)=>b.sc-a.sc)[0];
      if(!pick) break; slots.push({d,m:'s',r:pick.r.id,auto:true}); used[pick.r.id]=(used[pick.r.id]||0)+1; }
    // 4) перебор ккал > +10 %: меняем самое калорийное блюдо на более лёгкое, не роняя белок ниже нормы
    for(let g=0; g<3 && dayTotals(d).k>T.k*1.1; g++){
      const t=dayTotals(d); let best=null; const ids=inDay();
      const au=slots.findIndex(x=>x.d===d&&x.auto&&!x.prot&&x.r); if(au>=0){ const r=RMAP[slots[au].r]; if(t.k-r.k>=T.k*0.9){ slots[au].r=null; slots[au].hidden=true; continue; } }
      slots.forEach((s,i)=>{ if(s.d!==d||!s.r||s.left||s.auto||slots.some(x=>x.src===i)) return; const cur=RMAP[s.r];
        (cands[s.m]||candidates(s.m)).forEach(r=>{ if(ids.has(r.id)||(used[r.id]||0)>=maxUse||!ffOk(r,i)) return; const nk=t.k-cur.k+r.k, np=t.p-cur.p+r.p;
          if(nk>=t.k-40||np<Math.min(T.pmin,t.p)) return; const sc=-Math.abs(nk-T.k)-Math.max(0,portionCost(r)-portionCost(cur))*2; if(!best||sc>best.sc) best={i,r,sc,cur}; }); });
      if(!best) break; used[best.cur.id]--; used[best.r.id]=(used[best.r.id]||0)+1; replaceSlot(best.i,best.r.id);
    }
  });
}
function fitBudget(cands){
  const slots=S.plan.slots; const maxUse=S.A.styles.includes('batch')?3:2; const T=targets().ref;
  const uses=()=>{const u={}; slots.forEach(s=>{ if(s.r&&!s.left) u[s.r]=(u[s.r]||0)+1; }); return u;};
  let total=shopping().total, guard=0; S.plan.pBlocked=S.plan.pBlocked||0;
  while(total>S.A.budget && guard++<150){
    const u=uses(); let best=null; const dt={};
    slots.forEach((s,i)=>{ if(!s.r||s.left) return; const cur=RMAP[s.r];
      const curC=portionCost(cur); if(dt[s.d]==null) dt[s.d]=dayTotals(s.d);
      const t=dt[s.d], same=new Set(slots.filter(x=>x.d===s.d).map(x=>x.r));
      const pool=s.auto?candidates('s'):(cands[s.m]||candidates(s.m));
      const alts=pool.filter(r=>r.id!==s.r && !same.has(r.id) && (u[r.id]||0)<maxUse && ffOk(r,i) && portionCost(r)<curC*0.9)
        .filter(r=>{ const np=t.p-cur.p+r.p; const ok=np>=Math.min(T.pmin,t.p)||np>=T.pmin; if(!ok) S.plan.pBlocked++; return ok; })
        .sort((x,y)=>portionCost(x)-portionCost(y)).slice(0,3).sort((x,y)=>(u[x.id]||0)-(u[y.id]||0));
      if(!alts.length) return; const sav=curC-portionCost(alts[0]);
      if(!best||sav>best.sav) best={i,r:alts[0].id,sav}; });
    if(!best) break;
    replaceSlot(best.i,best.r);
    total=shopping().total;
  }
}
function replaceSlot(i,rid){ const slots=S.plan.slots; slots[i].r=rid; slots[i].left=false; delete slots[i].src;
  slots.forEach(x=>{ if(x.src===i) x.r=rid; }); }
/* Замена: шторка с 4 вариантами + «Отменить» */
function swapOptions(i){
  const s=S.plan.slots[i]; const pool=s.auto?candidates('s'):candidates(s.m);
  const ctx={uses:{},ings:new Set(),m:s.m}; S.plan.slots.forEach(x=>{ if(x.r) ctx.uses[x.r]=(ctx.uses[x.r]||0)+1; });
  ctx.dayRecipes=new Set(S.plan.slots.filter(x=>x.d===s.d&&x!==s).map(x=>x.r));
  return pool.filter(r=>r.id!==s.r).map(r=>({r,sc:recipeScore(r,ctx,'swap'+(s.sw||0)+s.d+s.m)})).sort((a,b)=>b.sc-a.sc).map(x=>x.r);
}
function swapMeal(i){
  const s=S.plan.slots[i]; if(!s) return; const alts=swapOptions(i);
  if(!alts.length){ toast('Других подходящих рецептов нет'); return; }
  const cur=RMAP[s.r]; const list=alts.slice(0,4);
  modal(`<h3>Заменить ${MEALMAP[s.m].name.toLowerCase()} · ${DAYS_FULL[s.d]}</h3><p>Сейчас: «${esc(cur?cur.t:'—')}»${cur?` · ${cur.k}${NB}ккал · белок ${cur.p}${NB}г`:''}</p>
  <div class="swlist">${list.map(r=>`<button class="swopt" data-act="doswap" data-i="${i}" data-id="${r.id}">${photo(r,'thumb')}<div class="mi"><div class="mt">${esc(r.t)}</div><div class="mm">${totalTime(r)}${NB}мин · ${r.k}${NB}ккал · Б${NB}${r.p}${NB}г · ~${fmt(portionCost(r))}${NB}₽</div></div></button>`).join('')}</div>
  <div class="stack" style="margin-top:10px">${alts.length>4?`<button class="btn sec sm" data-act="swapmore" data-i="${i}">Другие варианты</button>`:''}<button class="btn sec sm" data-act="closemodal">Отмена</button></div>`);
}
let undoState=null;
function doSwap(i,rid){ const s=S.plan.slots[i]; undoState={i,r:s.r,left:s.left,src:s.src,deps:S.plan.slots.map((x,j)=>x.src===i?j:-1).filter(j=>j>=0)};
  replaceSlot(i,rid); closeModal(); save(); render(); toast('Заменили на «'+RMAP[rid].t+'»',{act:'undo',label:'Отменить'}); }
function undoSwap(){ if(!undoState) return; const u=undoState, s=S.plan.slots[u.i]; s.r=u.r; s.left=u.left; if(u.src!=null) s.src=u.src;
  u.deps.forEach(j=>{ S.plan.slots[j].r=u.r; }); undoState=null; save(); render(); toast('Замена отменена'); }
function dayTotals(d){ const t={k:0,p:0,f:0,c:0,fi:0,su:0}; S.plan.slots.filter(s=>s.d===d&&s.r).forEach(s=>{const r=RMAP[s.r]; t.k+=r.k;t.p+=r.p;t.f+=r.f;t.c+=r.cb;t.fi+=r.fi||0;t.su+=r.su||0;}); return t; }

/* ====== РЕНДЕР ====== */
const app=document.getElementById('app');
let lastKey='', keepToast=false;
function render(){ applySides();
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
  const n=STEPS.indexOf(sc)+1, ed=S.editing===sc&&S.plan;
  if(ed) btn=`<button class="btn" data-act="saveedit">${sc==='q11'?'Сохранить и пересобрать':'Сохранить'}</button>`;
  return header({back:'prev',title:APP_NAME,right:ed?'<span>Изменение ответа</span>':(opts.right||`<span>${n} из ${STEPS.length}</span>`),prog:ed?null:Math.round(n/STEPS.length*100)})+
   `<div class="content"><h1>${title}</h1>${sub?`<p class="sub">${sub}</p>`:''}${body}
   ${ed?'<p class="foot">После сохранения план пересоберётся с учётом изменений.</p>':'<button class="restart" data-act="restart">Начать заново</button>'}</div>
   <div class="bottom">${btn}</div>`;
}
/* --- шаг «Параметры для расчёта КБЖУ» (необязательный) --- */
function peopleObj(){ const a=S.A; const P=a.people?JSON.parse(JSON.stringify(a.people)):{ad:[],kd:[]};
  P.ad=P.ad||[]; P.kd=P.kd||[]; while(P.ad.length<a.adults) P.ad.push({sex:P.ad.length%2?'m':'f',age:null,h:null,w:null,act:1,goal:'keep'}); P.ad.length=a.adults;
  while(P.kd.length<a.kids) P.kd.push({age:null}); P.kd.length=a.kids; return P; }
function ptgtHtml(i,kid){ if(!S.A.people) return 'Пока не заполнено — посчитаем по среднему взрослому.'; const T=targets();
  if(kid){ const t=T.kd[i]; return S.A.people.kd&&S.A.people.kd[i]&&S.A.people.kd[i].age?`Норма: <b>${fmt(t.k)} ккал</b> · белок <b>${t.pmin} г</b> · порция ×${dec(t.factor)} от взрослой`:'Укажите возраст.'; }
  const t=T.ad[i]; return `${t.def?'Заполните возраст, рост и вес — пока по среднему: ':'Норма: '}<b>${fmt(t.k)} ккал</b> · белок <b>${t.pmin}–${t.pgood} г</b>${t.w&&!t.def?` (${dec(t.pmin/t.w)}–${dec(t.pgood/t.w)} г/кг)`:''}`; }
function renderQ2b(){
  const P=peopleObj();
  const num=(f,i,v,ph,min,max)=>`<label class="pf"><span>${ph}</span><input type="number" inputmode="numeric" min="${min}" max="${max}" data-pf="${f}" data-i="${i}" value="${v==null?'':v}"></label>`;
  const ad=P.ad.map((x,i)=>{
    return `<div class="card pcard"><div class="pt">👤 Взрослый ${P.ad.length>1?i+1:''}</div>
    <div class="seg2">${[['f','Женщина'],['m','Мужчина']].map(o=>`<button class="${x.sex===o[0]?'on':''}" data-act="pset" data-f="sex" data-i="${i}" data-id="${o[0]}">${o[1]}</button>`).join('')}</div>
    <div class="pgrid">${num('age',i,x.age,'Возраст, лет',14,100)}${num('h',i,x.h,'Рост, см',120,230)}${num('w',i,x.w,'Вес, кг',35,250)}</div>
    <label class="pf wide"><span>Активность</span><select data-pf="act" data-i="${i}">${ACT.map((a,j)=>`<option value="${j}" ${(x.act==null?1:+x.act)===j?'selected':''}>${a[1]} — ${a[2]}</option>`).join('')}</select></label>
    <div class="seg2 three">${GOALS.map(o=>`<button class="${x.goal===o[0]?'on':''}" data-act="pset" data-f="goal" data-i="${i}" data-id="${o[0]}">${o[1]}</button>`).join('')}</div>
    <div class="ptgt" id="ptgt${i}">${ptgtHtml(i)}</div></div>`; }).join('');
  const kd=P.kd.map((x,i)=>`<div class="card pcard"><div class="pt">🧒 Ребёнок ${P.kd.length>1?i+1:''}</div><div class="pgrid">${num('kage',i,x.age,'Возраст, лет',1,17)}</div>
    <div class="ptgt" id="ptgtk${i}">${ptgtHtml(i,true)}</div></div>`).join('');
  return stepShell('q2b','Параметры для расчёта КБЖУ','Необязательно. Подберём калории и белок под каждого — или пропустите, тогда посчитаем по среднему взрослому.',
    `<div class="stack">${ad}${kd}</div>
    <details class="howcalc"><summary>Как считаем</summary><p>Калории — по формуле Миффлина — Сан Жеора с учётом активности; для снижения веса −18 %, для набора +10 %. Белок — 1,2–1,6 г на кг веса (1,6–2,0 г/кг при снижении веса или наборе), не меньше 1,0 г/кг. Жиры — 25–35 % калорий, клетчатка — от 25–30 г в день, добавленный сахар — меньше 10 % калорий (ВОЗ). Детям — по возрастным нормам Роспотребнадзора (МР 2.3.1.0253-21). Без параметров: ~2000 ккал для женщины, ~2400 для мужчины, белок ~85 г.</p><p><b>Это ориентир для планирования меню, а не медицинская рекомендация.</b> При заболеваниях, беременности или специальной диете посоветуйтесь с врачом.</p></details>`,
    `<div class="row2"><button class="btn sec" data-act="pskip">Пропустить</button><button class="btn" data-act="next">Далее</button></div>`);
}
function optCard(act,id,sel,inner,cls=''){ return `<button class="opt ${cls} ${sel?'sel':''}" data-act="${act}" data-id="${id}">${CK}${inner}</button>`; }
function renderStep(sc){
  const a=S.A;
  switch(sc){
  case 'q1': return stepShell(sc,'Где покупаете продукты?','Посчитаем примерную стоимость корзины по ценам магазина.',
    `<div class="grid3">${STORES.map(s=>optCard('store',s.id,a.store===s.id,`${storeLogo(s)}<div class="t">${s.name}</div><div class="s">цены ${s.lvl}${s.delivery?' · доставка':''}</div>`,'store')).join('')}</div>
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
  case 'q2b': return renderQ2b();
  case 'q3': return stepShell(sc,'Какие приёмы пищи планируем?','Можно выбрать несколько.',
    `<div class="list">${MEALS.map(m=>optCard('meal',m.id,a.meals.includes(m.id),`<span class="em">${ill('meal_'+m.id,m.e,'')}</span><div><div class="t">${m.name}</div><div class="s">${m.sub}</div></div>`,'row')).join('')}</div>
    ${a.meals.length&&mainMeals()<2?`<div class="warn">План покроет только ${a.meals.map(m=>MEALMAP[m].name.toLowerCase()).join(' и ')} — это не полный рацион на день. Перекусы до дневной нормы добавлять не будем; калории и белок посчитаем для этой части дня.</div>`:''}`,
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
    <h2>Любимые кухни</h2><div class="chips">${CUISINES.filter(c=>!c.hidden).map(c=>`<button class="chip ${a.cuisines.includes(c.id)?'sel':''}" data-act="cuis" data-id="${c.id}">${c.e} ${c.name}</button>`).join('')}</div>`,
    `<button class="btn" data-act="next">Далее</button>`);
  case 'q7': return stepShell(sc,'Сколько времени на готовку?','Выберите удобный формат — можно несколько.',
    `<div class="list">${STYLES.map(s=>optCard('style',s.id,a.styles.includes(s.id),`<span class="em">${ill('st_'+s.id,s.e,'')}</span><div><div class="t">${s.name}</div><div class="s">${s.sub}</div></div>`,'row')).join('')}</div>
    <h2>🍔 Домашний фастфуд</h2><p class="sub" style="margin-top:-4px">Бургеры, шаурма, пицца, наггетсы — приготовленные дома. Сколько раз в неделю ставить в план?</p>
    <div class="chips">${FF_OPTS.map(o=>`<button class="chip ${(a.ff||'some')===o[0]?'sel':''}" data-act="ffm" data-id="${o[0]}">${o[1]}</button>`).join('')}</div>`,
    `<button class="btn" data-act="next">Далее</button>`);
  case 'q8': return stepShell(sc,'Есть аллергии?','Блюда с этими продуктами исключим полностью.',
    `<div class="chips">${ALLERGENS.map(x=>`<button class="chip ${a.allergies.includes(x.id)?'sel':''}" data-act="allergy" data-id="${x.id}">${x.e} ${x.name}</button>`).join('')}</div>`,
    `<button class="btn" data-act="next">Подтвердить</button>`);
  case 'q9': return stepShell(sc,'Что не любите?','Такие продукты не попадут в план. Лук, чеснок, зелень и специи просто уберём из рецепта.',
    `<div class="search">${ICON.search}<input type="search" placeholder="Найти продукт" data-search="chips" autocomplete="off"></div>
    <div class="nores" id="nores" hidden>Ничего не найдено. Попробуйте другое слово.</div><div class="chips" id="flt">${DISLIKES.map(d=>`<button class="chip ${a.dislikes.includes(d[0])?'sel':''}" data-act="dislike" data-id="${d[0]}" data-name="${d[1]}">${d[2]} ${d[1]}${a.dislikes.includes(d[0])?' <span class="x">×</span>':''}</button>`).join('')}</div>`,
    `<button class="btn ${a.dislikes.length?'':'sec'}" data-act="next">${a.dislikes.length?'Далее':'Пропустить'}</button>`);
  case 'q10': { const tabs=[['all','Все'],['fresh','Свежее'],['meat','Мясо'],['fridge','Холодильник'],['groc','Бакалея']];
    const keys=PANTRY_FIRST.concat(Object.keys(ING).filter(k=>!PANTRY_FIRST.includes(k)));
    return stepShell(sc,'Что уже есть дома?','Эти продукты отметим «есть дома» и не будем считать в корзине.',
    `<div class="search">${ICON.search}<input type="search" placeholder="Поиск продуктов" data-search="tiles" autocomplete="off"></div>
    <div class="tabs">${tabs.map(t=>`<button class="tab ${S.ptab===t[0]?'on':''}" data-act="ptab" data-id="${t[0]}">${t[1]}</button>`).join('')}</div>
    <div class="nores" id="nores" hidden>Ничего не найдено. Попробуйте другое слово.</div><div class="grid3" id="flt">${keys.filter(k=>S.ptab==='all'||pantryCat(k)===S.ptab).map(k=>{const g=ING[k];
      return `<button class="tile ${a.pantry.includes(k)?'sel':''}" data-act="pantry" data-id="${k}" data-name="${esc(g.name.toLowerCase())}">${CK}<span class="em">${ill('p_'+k,g.e,'')}</span>${esc(shortName(g.name))}</button>`;}).join('')}</div>`,
    `<button class="btn" data-act="next">${a.pantry.length?`Продолжить · ${a.pantry.length} ${plural(a.pantry.length,'продукт','продукта','продуктов')}`:'Пропустить'}</button>`); }
  case 'q11': { if(a.budget==null){ a.budget=defaultBudget(); a.budgetManual=false; save(); } const rg=budgetRange(); const p=portions(); const rec=defaultBudget();
    return stepShell(sc,'Бюджет на неделю','',
    `<p class="sub" style="margin-top:-4px">${a.adults} ${plural(a.adults,'взрослый','взрослых','взрослых')} · ${a.kids} ${plural(a.kids,'ребёнок','ребёнка','детей')} · ${a.meals.length} ${plural(a.meals.length,'приём','приёма','приёмов')}/день · ${dec(p)} ${plural(Math.ceil(p),'порция','порции','порций')}</p>
    <div class="budget-box"><label class="budget-input"><span>₽</span><input id="bin" inputmode="numeric" pattern="[0-9]*" value="${fmt(a.budget)}" aria-label="Бюджет на неделю"></label>
    <div class="mut small" style="margin-top:6px">нажмите на сумму, чтобы ввести</div>
    ${a.budgetManual&&Math.abs(a.budget-rec)/rec>0.15?`<button class="linkbtn" data-act="budrec">Рекомендуем ${rub(rec)} — применить</button>`:''}</div>
    <input type="range" id="brange" min="${rg.min}" max="${rg.max}" step="100" value="${Math.min(rg.max,Math.max(rg.min,a.budget))}">
    <div class="range-l"><span>${rub(rg.min)}</span><span>${rub(rg.max)}</span></div>
    <div id="bstatus"></div>
    <div class="metrics"><div class="metric"><div class="v" id="m1"></div><div class="l">₽ / неделя</div></div><div class="metric"><div class="v" id="m2"></div><div class="l">₽ / порция</div></div><div class="metric"><div class="v" id="m3"></div><div class="l">порций / неделя</div></div></div>
    <p class="foot">Оценка по пробному плану с вашими ответами (целые упаковки, перекусы). ${priceNote()}</p>`,
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
  const btn=document.querySelector('[data-act=build],[data-act=saveedit]'); if(btn) btn.disabled=b<300;
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
  if(S.A.budget==null) S.A.budget=defaultBudget();
  try{ generatePlan(); }catch(e){ console.error(e); }
  const step=S.quick?230:600; S.quick=false;
  let i=0; const tick=()=>{ const prev=document.getElementById('cl'+(i-1)); if(prev){prev.classList.remove('cur');prev.classList.add('done');}
    const lb=document.getElementById('lbar'); if(lb) lb.style.width=Math.round(i/LSTEPS.length*100)+'%';
    if(i>=LSTEPS.length){ setTimeout(()=>{ loadingRun=false; S.tab='week'; hap('ok'); set({screen:'app'}); },step===600?450:200); return; }
    const c=document.getElementById('cl'+i); if(c) c.classList.add('cur'); i++; setTimeout(tick, step); };
  setTimeout(tick,step===600?250:100);
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
function mealMeta(r){ return `${totalTime(r)}${NB}мин${r.rest?' '+restText(r):''} · ${r.k}${NB}ккал · ${fmt(portionCost(r))}${NB}₽/порц`; }
function macroBar(t){ const p=t.p*4,f=t.f*9,c=t.c*4,s=p+f+c||1;
  return `<div class="mbar"><i class="p" style="width:${(p/s*100).toFixed(1)}%"></i><i class="f" style="width:${(f/s*100).toFixed(1)}%"></i><i class="c" style="width:${(c/s*100).toFixed(1)}%"></i></div>
  <div class="mleg"><span class="lg-p">Б ${fmt(t.p)}${NB}г</span><span class="lg-f">Ж ${fmt(t.f)}${NB}г</span><span class="lg-c">У ${fmt(t.c)}${NB}г</span><span class="lg-fi">Клетч. ${fmt(t.fi)}${NB}г</span></div>`; }
/* Прогресс дня к нормам для каждого едока: зелёный — в норме, жёлтый — рядом/вне диапазона */
function mk(ok,warn){ return ok?'g':(warn?'y':'r'); }
function personRows(t){
  const T=targets(); const cov=T.cov; const rows=[];
  const one=(name,tg,f)=>{ const k=t.k*f, p=t.p*f, fa=t.f*f, c=t.c*f, fi=t.fi*f, K=tg.k*cov, Pm=tg.pmin*cov;
    const kOk=Math.abs(k-K)<=K*0.1, pOk=p>=Pm, faOk=fa>=tg.fat[0]*cov*0.9&&fa<=tg.fat[1]*cov*1.1, fiOk=fi>=tg.fib*cov*0.8;
    const cMin=(K-Pm*4-tg.fat[1]*cov*9)/4;
    return `<div class="prog-row"><span class="pn">${name}${f!==1?` <i>×${dec(f)}</i>`:''}</span>
     <span class="pm ${mk(kOk,Math.abs(k-K)<=K*0.2)}">${fmt(Math.round(k/10)*10)}/${fmt(Math.round(K/10)*10)} ккал</span>
     <span class="pm ${mk(pOk,p>=Pm*0.9)}">Б ${Math.round(p)}/${Math.round(Pm)}${NB}г${tg.w?` · ${dec(p/tg.w)}${NB}г/кг`:''}</span>
     <span class="pm ${mk(faOk,true)}">Ж ${Math.round(fa)}</span><span class="pm ${mk(c>=cMin*0.8,true)}">У ${Math.round(c)}</span><span class="pm ${mk(fiOk,fi>=tg.fib*cov*0.5)}">Кл ${Math.round(fi)}/${Math.round(tg.fib*cov)}</span></div>`; };
  T.ad.forEach((tg,i)=>rows.push(one(T.ad.length>1?(T.set?`Взрослый ${i+1}`:`Взрослый ${i+1}`):'Взрослый',tg,tg.factor||1)));
  T.kd.forEach((tg,i)=>rows.push(one(T.kd.length>1?`Ребёнок ${i+1}`:'Ребёнок',tg,tg.factor)));
  return `<div class="progbox">${rows.join('')}</div>`; }
function renderWeek(){
  const sh=shopping(); const plan=S.plan; const n=plan.slots.filter(s=>s.r).length; const T=targets();
  let html=`<h1>Ваша неделя готова!</h1><p class="sub">${n} ${plural(n,'блюдо','блюда','блюд')} · ${store().name} · ${dec(portions())} ${plural(Math.ceil(portions()),'порция','порции','порций')} за приём</p>
  <button class="shopcard" data-act="tab" data-id="shop"><span class="ic">🛒</span><div style="flex:1;min-width:0"><div class="t">Список покупок</div><div class="s">${sh.items.length} ${plural(sh.items.length,'позиция','позиции','позиций')} · ~${rub(sh.total)} из ${rub(S.A.budget)}</div></div>${budgetPill(sh.total)}</button>`;
  const days=dayOrder(); const pp=portions();
  const bad=plan.slots.filter(s=>s.r&&whyNot(RMAP[s.r]));
  if(bad.length) html+=`<div class="warn">${bad.length} ${plural(bad.length,'блюдо','блюда','блюд')} в плане не подходят под ваши ответы (например, «${esc(RMAP[bad[0].r].t)}»: ${esc(whyNot(RMAP[bad[0].r]))}). <button class="linkbtn" data-act="regen">Пересобрать план</button></div>`;
  const avgK=days.length?days.reduce((a,d)=>a+dayTotals(d).k,0)/days.length:0;
  const pDays=days.filter(d=>dayTotals(d).p>=T.ref.pmin-0.5).length, kDays=days.filter(d=>Math.abs(dayTotals(d).k-T.ref.k)<=T.ref.k*0.1).length;
  html+=`<div class="kcalsum">🔥 В среднем <b>${fmt(Math.round(avgK/10)*10)}${NB}ккал</b> в день на взрослого${pp!==1?` · ${fmt(Math.round(avgK*pp/10)*10)} на семью`:''}
   <div class="small" style="margin-top:4px">Цель ${fmt(Math.round(T.ref.k/10)*10)}${NB}ккал ±10 % — ${kDays} из ${days.length} дн. · белок ≥${Math.round(T.ref.pmin)}${NB}г — ${pDays} из ${days.length} дн.${T.set?'':' · <button class="linkbtn" data-act="edit" data-id="q2b">указать параметры</button>'}</div></div>`;
  if(T.cov<1) html+=`<div class="note">ℹ️ В плане только ${S.A.meals.map(m=>MEALMAP[m].name.toLowerCase()).join(' и ')} — это часть дневного рациона (~${Math.round(T.cov*100)} %). Калории и белок сравниваем с этой долей нормы, перекусы до полной нормы не добавляем.</div>`;
  const autoN=plan.slots.filter(s=>s.auto&&s.r).length;
  if(autoN) html+=`<div class="note">🍎 Добавили ${autoN} ${plural(autoN,'перекус','перекуса','перекусов')}, чтобы дотянуть дни до нормы калорий и белка. Каждый можно заменить или убрать кнопкой «Убрать» — тогда день будет менее сытным.</div>`;
  if(plan.tradeoff) html+=`<div class="warn">⚖️ Бюджета не хватает, чтобы закрыть норму белка: оставили белковые блюда, поэтому корзина дороже бюджета на ~${rub(Math.max(0,sh.total-S.A.budget))}. Увеличьте бюджет или отметьте продукты, которые есть дома.</div>`;
  else if(sh.total>S.A.budget) html+=`<div class="warn">Даже самые экономные подходящие блюда дороже бюджета на ~${rub(sh.total-S.A.budget)}. Попробуйте увеличить бюджет или отметить продукты, которые есть дома.</div>`;
  const lowP=days.filter(d=>dayTotals(d).p<T.ref.pmin*0.95).length;
  if(lowP&&!plan.tradeoff) html+=`<div class="note">💪 В ${lowP} ${plural(lowP,'день','дня','дней')} белка меньше нормы — подходящих белковых блюд с вашими фильтрами мало.</div>`;
  if(days.length>1) html+=`<div class="daystrip">${days.map(d=>`<button data-act="jumpday" data-id="${d}">${DAYS[d]}<span>${fmt(dayTotals(d).k)}</span></button>`).join('')}</div>`;
  const missing=mealOrder().filter(m=>!candidates(m).length);
  if(missing.length) html+=`<div class="warn">Нет подходящих рецептов для: ${missing.map(m=>MEALMAP[m].name.toLowerCase()).join(', ')}. Ослабьте фильтры в профиле.</div>`;
  const few=mealOrder().filter(m=>{ const c=candidates(m).length; return c>0 && c<Math.ceil(days.length/2)+1; });
  if(few.length) html+=`<div class="note">📚 Мало рецептов под ваши ответы для: ${few.map(m=>MEALMAP[m].name.toLowerCase()+' ('+candidates(m).length+')').join(', ')} — блюда будут повторяться. Можно ослабить фильтры в профиле.</div>`;
  days.forEach(d=>{ const t=dayTotals(d);
    html+=`<div class="dayh" id="day${d}"><div class="row"><div class="n">${DAYS_FULL[d]}</div><div class="kc">${fmt(Math.round(t.k))}${NB}ккал<span class="kcf">${pp!==1?` · ${fmt(Math.round(t.k*pp))} на семью`:''}</span></div></div>${macroBar(t)}${personRows(t)}</div>`;
    plan.slots.forEach((s,i)=>{ if(s.d!==d||s.hidden) return; const r=s.r&&RMAP[s.r]; const lbl=MEALMAP[s.m].short;
      if(!r){ html+=`<div class="meal empty-meal"><div class="ph thumb" style="background:var(--bg)">🤷</div><div class="mi"><div class="mlabel">${lbl}</div><div class="mt">Нет подходящих рецептов</div><div class="mm">Ослабьте фильтры в профиле</div></div></div>`; return; }
      html+=`<div class="meal" data-act="open" data-id="${r.id}">${photo(r,'thumb')}<div class="mi"><div class="mlabel">${lbl}</div><div class="mt">${esc(r.t)}</div><div class="mm">${mealMeta(r)}</div>${s.left?'<span class="lefttag">📦 из остатков ужина</span>':''}${s.auto?`<span class="lefttag">${s.prot?'💪 добавлено для белка':'🍎 добавлено для сытости'}</span>`:''}</div>
      <div class="mbtns"><button class="swap" data-act="swap" data-i="${i}" aria-label="Заменить">${ICON.swap}Заменить</button>${s.auto?`<button class="swap rm" data-act="rmauto" data-i="${i}" aria-label="Убрать перекус">${ICON.close}Убрать</button>`:''}</div></div>`; });
  });
  html+=`<p class="foot">КБЖУ — на одну взрослую порцию (×N — рекомендуемая порция едока), по таблицам состава продуктов. Нормы — ориентир, не медицинская рекомендация. ${priceNote()}</p>`;
  return html;
}
function renderShop(){
  const sh=shopping(); const b=S.A.budget; const pct=Math.min(100,Math.round(sh.total/b*100));
  let html=`<h1>Список покупок</h1><p class="sub">${sh.items.length} ${plural(sh.items.length,'позиция','позиции','позиций')} · ${store().name} · на ${dec(portions())} ${plural(Math.ceil(portions()),'порцию','порции','порций')}</p>
  <div class="sumcard"><div class="sumrow"><div><div class="mut small" style="font-weight:700">Итого примерно</div><div class="v">${rub(sh.total)}</div></div><div style="text-align:right"><div class="mut small" style="font-weight:700">Бюджет</div><div style="font-weight:800;font-size:18px">${rub(b)}</div></div></div>
  <div class="bar"><i style="width:${pct}%;background:${sh.total<=b?'var(--g)':'var(--red)'}"></i></div>
  <div class="small" style="font-weight:700;color:${sh.total<=b?'var(--gt)':'#B91C1C'}">${sh.total<=b?'✓ Укладываемся, остаётся '+rub(b-sh.total):'Превышение на '+rub(sh.total-b)}</div>
  <div class="small mut" style="margin-top:6px">${(()=>{const n=sh.items.filter(x=>realOf(x.g)).length; return n?`<span class="ptag real">цена магазина</span> ${n} из ${sh.items.length} позиций · остальные <span class="ptag est">оценка</span>`:`Все цены — <span class="ptag est">оценка</span> (у сети нет открытого каталога — пока нет снимка цен)`;})()}</div></div>`;
  if(S.extras.length) html+=`<div class="chips" style="margin-top:12px">${S.extras.map((x,i)=>`<button class="chip sel" data-act="rmextra" data-i="${i}">➕ ${esc(RMAP[x.r].t)} · ${dec(x.serv)} порц. <span class="x">×</span></button>`).join('')}</div>`;
  AISLES.forEach(a=>{ const it=sh.items.filter(x=>x.g.aisle===a.id); if(!it.length) return;
    html+=`<div class="aisle">${a.e} ${a.name} <span class="c">${it.length}</span></div>`;
    it.forEach(x=>{ const done=S.ticks[x.k];
      html+=`<div class="li ${done?'done':''}"><button class="cb" data-act="tick" data-id="${x.k}" aria-label="Отметить">${ICON.check}</button><span class="e">${x.g.e}</span>
      <div class="nm"><b>${esc(x.g.name)} · ${fmtPack(x.g.pack,x.g.unit)} × ${x.packs}</b><span>нужно ≈ ${fmtAmount(x.q,x.g.unit)}</span></div><div class="pr">${realOf(x.g)?'':'~'}${rub(x.price)}${priceTag(x.g)}</div></div>`; }); });
  if(sh.home.length){ html+=`<div class="aisle">🏠 Есть дома <span class="c">${sh.home.length}</span></div>`;
    sh.home.forEach(x=>{ html+=`<div class="li"><span class="e">${x.g.e}</span><div class="nm"><b>${esc(x.g.name)}</b><span>понадобится ≈ ${fmtAmount(x.q,x.g.unit)}</span></div><span class="homepill">есть дома</span></div>`; }); }
  const left=sh.items.filter(x=>!S.ticks[x.k]).length;
  html+=`<div class="stack" style="margin-top:22px"><button class="btn out sm" data-act="copylist">Скопировать список</button>${left&&left<sh.items.length?`<button class="btn sec sm" data-act="copyleft">Скопировать только некупленное (${left})</button>`:''}</div>
  <p class="foot">Количество округлено до реальных упаковок. ${priceNote()} ${storeReal()?'Цена магазина пересчитана на указанную упаковку; наличие и акции в вашем магазине могут отличаться.':'Это ориентир, не цена на полке.'}</p>`;
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
  const T=targets();
  const rows=[['Магазин',store().name,'q1'],['Город',S.city,'city'],['Едоки',`${a.adults} взр. · ${a.kids} дет. · ${dec(portions())} порц./приём`,'q2'],
   ['Нормы КБЖУ',T.set?T.ad.map(t=>fmt(t.k)+' ккал / Б '+t.pmin+' г').join('; '):'по среднему взрослому','q2b'],
   ['Приёмы пищи',listNames(a.meals,MEALS),'q3'],['Дни',dayOrder().map(d=>DAYS[d]).join(', '),'q4'],['Техника',listNames(a.equip,EQUIP),'q5'],
   ['Питание',a.diets.includes('none')?'Без ограничений':listNames(a.diets,DIETS),'q6'],['Любимые кухни',listNames(a.cuisines,CUISINES),'q6'],['Формат',listNames(a.styles,STYLES),'q7'],['Домашний фастфуд',(FF_OPTS.find(o=>o[0]===(a.ff||'some'))||FF_OPTS[1])[1],'q7'],
   ['Аллергии',a.allergies.includes('none')?'Нет':listNames(a.allergies,ALLERGENS),'q8'],['Не любите',a.dislikes.map(id=>DISLIKES.find(d=>d[0]===id)[1]).join(', ')||'—','q9'],
   ['Есть дома',a.pantry.length?a.pantry.map(k=>shortName(ING[k].name).toLowerCase()).join(', '):'—','q10'],['Бюджет',rub(a.budget)+' / неделя','q11']];
  return `<h1>Профиль</h1><p class="sub">Ваши ответы. Нажмите на строку, измените и нажмите «Сохранить» — план пересоберётся.</p>
  <div class="card" style="padding:4px 16px">${rows.map(r=>`<div class="prow" data-act="${r[2]==='city'?'city':'edit'}" data-id="${r[2]}" style="cursor:pointer"><span class="k">${r[0]}</span><span class="v">${esc(r[1])} <span class="mut">›</span></span></div>`).join('')}</div>
  <div class="stack" style="margin-top:20px"><button class="btn" data-act="regen">${ICON.swap} Пересобрать план</button><button class="btn sec" data-act="edit" data-id="q1">Изменить ответы</button><button class="btn sec" data-act="restart" style="color:#B91C1C">Начать заново</button></div>
  <p class="foot">${APP_NAME} · прототип. ${priceNote()} Реальные цены — только из официальных открытых каталогов сетей (сейчас ВкусВилл и Лента). Нормы КБЖУ — ориентир, не медицинская рекомендация.</p>`;
}
/* --- рецепт --- */
function renderRecipe(){
  const r=RMAP[S.recipe]; const c=CUISMAP[r.c]; const fav=S.favs.includes(r.id); const n=S.serv; const wn=whyNot(r); const rem=removedIngs(r);
  const btns=(inTG?'':`<button class="icon-btn" style="left:14px" data-act="closerecipe" aria-label="Назад">${ICON.back}</button>`)+
   `<button class="icon-btn" style="right:14px;color:${fav?'#EF4444':'#111827'}" data-act="fav" aria-label="В избранное">${fav?ICON.heartf:ICON.heart}</button>`;
  const tags=[`<span class="rtag g">${CATNAME[rcat(r)]}</span>`].concat(['lean','veg','hp','kids'].filter(x=>DIETCHK[x](r)).map(x=>`<span class="rtag">${({lean:'🌾 Постное',veg:'🥦 Вегетарианское',hp:'💪 Много белка',kids:'🧸 Детям'})[x]}</span>`));
  if(totalTime(r)<=25 && !r.rest) tags.push('<span class="rtag">⚡ Быстро</span>');
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
  <div class="kbnote">Клетчатка ${dec(r.fi||0)}${NB}г${r.su?` · добавленный сахар ${r.su}${NB}г`:''}. Рассчитано по составу ингредиентов (таблицы Скурихина/USDA), на одну взрослую порцию.</div>
  <div class="times"><div><b>${r.prep} мин</b>подготовка</div><div><b>${r.cook} мин</b>готовка${r.side&&r.side!=='хлеб'?' с гарниром':''}</div><div><b>~${fmt(portionCost(r))} ₽</b>за порцию${(()=>{const ii=recipeIngs(r), n=ii.filter(i=>realOf(ING[i.k])).length; return n?` · <span class="ptag real">цена магазина</span> ${n}/${ii.length}`:` · <span class="ptag est">оценка</span>`;})()}</div></div>
  ${r.rest?`<div class="note" style="margin-top:8px">⏳ Плюс ${r.rest[0]>=480?'ночь':(r.rest[0]>=60?Math.round(r.rest[0]/60)+' ч':r.rest[0]+' мин')} ${r.rest[1]} — заложите время заранее.</div>`:''}
  <h2>Нужна техника</h2><div class="chips">${r.eq.length?r.eq.map(e=>{const q=EQUIP.find(x=>x.id===e); return `<span class="chip ${S.A.equip.includes(e)?'sel':''}">${q.e} ${q.name}</span>`;}).join(''):'<span class="chip">🙌 Без техники</span>'}</div>
  <div class="seg"><button class="${S.rtab==='ing'?'on':''}" data-act="rtab" data-id="ing">Ингредиенты</button><button class="${S.rtab==='steps'?'on':''}" data-act="rtab" data-id="steps">Приготовление · ${r.steps.length} ${plural(r.steps.length,'шаг','шага','шагов')}</button></div>
  ${S.rtab==='ing'?`<div class="stepper-card" style="margin-bottom:8px"><div><div class="t">Порции</div><div class="s">${n===portions()?'на вашу семью, как в плане':'количества пересчитаются'}</div></div><div class="stepper"><button data-act="serv" data-d="-0.5" ${n<=0.5?'disabled':''}>−</button><span class="v">${dec(n)}</span><button data-act="serv" data-d="0.5" ${n>=12?'disabled':''}>+</button></div></div>${r.side||r.scaled?`<p class="mut small" style="margin:0 0 8px">🍽 Порция рассчитана на сытного взрослого (~${fmt(Math.round(r.k/10)*10)}${NB}ккал)${r.side?`, с гарниром: ${r.side}`:''}.</p>`:''}
   ${recipeIngs(r).map(i=>{const g=ING[i.k]; const home=S.A.pantry.includes(i.k); return `<div class="ing"><span class="e">${g.e}</span><span class="n">${esc(g.name)} ${home?'<span class="homepill">есть дома</span>':''}</span><span class="q">${fmtIngQty(i.k,i.q*n/r.sv,g.unit)}</span></div>`;}).join('')}
   ${rem.length?`<p class="mut small" style="margin-top:10px">Убрали, т.к. вы не любите: ${rem.map(i=>ING[i.k].name.toLowerCase()).join(', ')}</p>`:''}`
  :`<ol class="steps">${r.steps.map(s=>`<li><span>${esc(s)}</span></li>`).join('')}</ol>`}
  <p class="foot">Стоимость порции для ${store().name}. ${priceNote()}</p></div>`;
}
/* --- модалки и тосты --- */
function modal(html){ closeModal(); const d=document.createElement('div'); d.className='mback'; d.id='modal'; d.innerHTML=`<div class="modal">${html}</div>`;
  d.addEventListener('click',e=>{ if(e.target===d) closeModal(); }); document.body.appendChild(d); syncTG(); }
function closeModal(){ const m=document.getElementById('modal'); if(m){ m.remove(); syncTG(); } }
let toastT; function toast(t,o){ let el=document.querySelector('.toast'); if(!el){ el=document.createElement('div'); el.className='toast'; document.body.appendChild(el);}
  el.innerHTML=esc(t)+(o?` <button class="tbtn" data-act="${o.act}">${o.label}</button>`:''); clearTimeout(toastT); toastT=setTimeout(()=>el.remove(),o?4500:2200); }
function listText(onlyLeft){
  const sh=shopping(); let t=`Список покупок — ${APP_NAME} (${store().name})${onlyLeft?' · только некупленное':''}\n`;
  AISLES.forEach(a=>{ const it=sh.items.filter(x=>x.g.aisle===a.id&&!(onlyLeft&&S.ticks[x.k])); if(!it.length) return; t+=`\n${a.name}:\n`;
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
  case 'cnt': { const d=+el.dataset.d; a[id]=Math.max(id==='adults'?1:0,Math.min(10,a[id]+d)); if(!a.budgetManual) a.budget=null; save(); render(); break; }
  case 'meal': toggle(a.meals,id); if(!a.budgetManual) a.budget=null; save(); render(); break;
  case 'day': toggle(a.days,+id); if(!a.budgetManual) a.budget=null; save(); render(); break;
  case 'pset': { const P=peopleObj(); P.ad[+el.dataset.i][el.dataset.f]=id; a.people=P; save(); render(); break; }
  case 'pskip': a.people=null; save(); if(S.editing==='q2b'&&S.plan) finishEdit(); else go('q3'); break;
  case 'saveedit': finishEdit(); break;
  case 'budrec': a.budget=defaultBudget(); a.budgetManual=false; save(); render(); break;
  case 'rmauto': { e.stopPropagation(); const s=S.plan.slots[+el.dataset.i]; if(s){ s.r=null; s.hidden=true; } save(); render(); toast('Перекус убран'); break; }
  case 'doswap': doSwap(+el.dataset.i,id); break;
  case 'swapmore': { const i=+el.dataset.i; const s=S.plan.slots[i]; s.sw=(s.sw||0)+1; swapMeal(i); break; }
  case 'undo': { const t=document.querySelector('.toast'); if(t) t.remove(); undoSwap(); break; }
  case 'copyleft': copyText(listText(true)); break;
  case 'equip': toggle(a.equip,id); save(); render(); break;
  case 'diet': if(id==='none') a.diets=['none']; else { a.diets=a.diets.filter(x=>x!=='none'); toggle(a.diets,id); if(!a.diets.length) a.diets=['none']; } save(); render(); break;
  case 'cuis': toggle(a.cuisines,id); save(); render(); break;
  case 'style': toggle(a.styles,id); save(); render(); break;
  case 'ffm': a.ff=id; save(); render(); break;
  case 'allergy': if(id==='none') a.allergies=['none']; else { a.allergies=a.allergies.filter(x=>x!=='none'); toggle(a.allergies,id); if(!a.allergies.length) a.allergies=['none']; } save(); render(); break;
  case 'dislike': toggle(a.dislikes,id); save(); render(); reapplySearch(); break;
  case 'pantry': toggle(a.pantry,id); save(); render(); reapplySearch(); break;
  case 'ptab': S.ptab=id; save(); render(); reapplySearch(); break;
  case 'build': if(!(a.budget>0)) return; S.editing=false; set({screen:'loading',ticks:{}}); break;
  case 'regenq': closeModal(); S.quick=true; set({screen:'loading',ticks:{}}); break;
  case 'tab': S.tab=id; set({recipe:null}); break;
  case 'swap': e.stopPropagation(); swapMeal(+el.dataset.i); break;
  case 'open': S.serv=portions(); S.rtab='ing'; set({recipe:id}); break;
  case 'closerecipe': navDir='back'; set({recipe:null}); break;
  case 'rtab': set({rtab:id}); break;
  case 'serv': S.serv=Math.max(0.5,Math.min(12,Math.round((S.serv+(+el.dataset.d))*2)/2)); save(); render(); break;
  case 'fav': toggle(S.favs,S.recipe); save(); render(); toast(S.favs.includes(S.recipe)?'Добавлено в избранное':'Убрано из избранного'); break;
  case 'toplan': toPlanModal(); break;
  case 'putplan': { const i=+el.dataset.i, s=S.plan.slots[i]; undoState={i,r:s.r,left:s.left,src:s.src,deps:S.plan.slots.map((x,j)=>x.src===i?j:-1).filter(j=>j>=0)};
    replaceSlot(i,S.recipe); closeModal(); save(); render(); toast(`Добавлено: ${DAYS[s.d]}, ${MEALMAP[s.m].name.toLowerCase()}`,{act:'undo',label:'Отменить'}); break; }
  case 'tpf': S.tpf=id; toPlanModal(); break;
  case 'toshop': { const ex=S.extras.find(x=>x.r===S.recipe); if(ex) ex.serv+=S.serv; else S.extras.push({r:S.recipe,serv:S.serv}); save();
    toast(ex?`Добавили ещё ${dec(S.serv)} порц. — всего ${dec(ex.serv)} порц. в покупках`:`Ингредиенты на ${dec(S.serv)} порц. добавлены в покупки`); break; }
  case 'rmextra': S.extras.splice(+el.dataset.i,1); save(); render(); break;
  case 'sharerecipe': { const r=RMAP[S.recipe]; const t=`${r.t}\n\nИнгредиенты (${dec(S.serv)} порц.):\n`+recipeIngs(r).map(i=>`• ${ING[i.k].name} — ${fmtIngQty(i.k,i.q*S.serv/r.sv,ING[i.k].unit)}`).join('\n')+`\n\nПриготовление:\n`+r.steps.map((s,i)=>`${i+1}. ${s}`).join('\n')+`\n\n— ${APP_NAME}`;
    shareText(r.t,t.replace(/\u00A0/g,' ')); break; }
  case 'rfilter': set({rfilter:id}); break;
  case 'rcat': set({rcat:id}); break;
  case 'jumpday': { const t=document.getElementById('day'+id); if(t) t.scrollIntoView({behavior:'smooth',block:'start'}); document.querySelectorAll('.daystrip button').forEach(b=>b.classList.toggle('on',b===el)); break; }
  case 'tick': S.ticks[id]=!S.ticks[id]; save(); render(); break;
  case 'cart': modal(`<div style="font-size:44px">🛒</div><h3>Интеграция с магазином скоро</h3><p>Скоро можно будет собрать корзину в ${store().loc} в один клик. Пока можно скопировать список или поделиться им.</p>
    <div class="stack"><button class="btn" data-act="copylist">Скопировать список</button><button class="btn out" data-act="sharelist">${ICON.share} Поделиться</button><button class="btn sec sm" data-act="closemodal">Закрыть</button></div>`); break;
  case 'copylist': closeModal(); copyText(listText()); break;
  case 'sharelist': closeModal(); shareText('Список покупок',listText()); break;
  case 'edit': if(id==='q1'&&el.classList.contains('btn')){ S.editing=false; go('q1'); } else startEdit(id); break;
  case 'regen': S.quick=true; set({screen:'loading',ticks:{}}); break;
  }
});
function toPlanModal(){
  const r=RMAP[S.recipe]; const f=S.tpf||'all';
  const all=S.plan.slots.map((s,i)=>({s,i})).filter(o=>!o.s.hidden&&!o.s.left&&mealOk(r,o.s.m));
  const ms=[...new Set(all.map(o=>o.s.m))]; const opts=all.filter(o=>f==='all'||o.s.m===f);
  const byDay={}; opts.forEach(o=>{ (byDay[o.s.d]=byDay[o.s.d]||[]).push(o); });
  modal(`<h3>Добавить в план</h3><p>Выберите, какое блюдо заменить на «${esc(r.t)}».</p>
  ${ms.length>1?`<div class="tabs tight">${[['all','Все']].concat(ms.map(m=>[m,MEALMAP[m].name])).map(t=>`<button class="tab ${f===t[0]?'on':''}" data-act="tpf" data-id="${t[0]}">${t[1]}</button>`).join('')}</div>`:''}
  ${opts.length?`<div class="tplist">${Object.keys(byDay).map(d=>`<div class="tpday">${DAYS_FULL[d]}</div>${byDay[d].map(o=>{const cur=o.s.r?RMAP[o.s.r].t:'пусто'; return `<button class="tprow" data-act="putplan" data-i="${o.i}"><span class="tpm">${MEALMAP[o.s.m].name}</span><span class="tpc">${esc(cur)}</span></button>`;}).join('')}`).join('')}</div>`
  :`<div class="warn">В плане нет подходящих приёмов пищи (${r.m.map(m=>MEALMAP[m].name.toLowerCase()).join(', ')}).</div>`}
  <div style="height:10px"></div><button class="btn sec" data-act="closemodal">Отмена</button>`);
}
let searchQ='';
function reapplySearch(){ const inp=document.querySelector('[data-search]'); if(!inp) return; inp.value=searchQ; filterTiles(searchQ); }
function filterTiles(q){ q=q.trim().toLowerCase(); let n=0; document.querySelectorAll('#flt [data-name]').forEach(b=>{ const v=!q||b.dataset.name.includes(q); b.style.display=v?'':'none'; if(v) n++; });
  const nr=document.getElementById('nores'); if(nr) nr.hidden=n>0; }
document.addEventListener('input',e=>{
  const t=e.target;
  if(t.dataset.search){ searchQ=t.value; filterTiles(searchQ); return; }
  if(t.id==='bin'){ /* сохраняем позицию курсора: считаем цифры слева от него */
    const pos=t.selectionStart||0, dl=t.value.slice(0,pos).replace(/\D/g,'').length;
    let v=parseInt(t.value.replace(/\D/g,''),10)||0; const capped=v>BUDGET_CAP; v=Math.min(BUDGET_CAP,v); S.A.budget=v; S.A.budgetManual=true;
    const nv=v?fmt(v):''; t.value=nv; let np=0, c=0; while(np<nv.length && c<dl){ if(/\d/.test(nv[np])) c++; np++; } try{ t.setSelectionRange(np,np); }catch(_){}
    if(capped) toast('Максимум — '+rub(BUDGET_CAP)+' в неделю');
    const r=document.getElementById('brange'); const rg=budgetRange(); r.value=Math.min(rg.max,Math.max(rg.min,v)); save(); updateBudgetUI(); return; }
  if(t.id==='brange'){ S.A.budget=+t.value; S.A.budgetManual=true; const b=document.getElementById('bin'); if(b) b.value=fmt(S.A.budget); save(); updateBudgetUI(); return; }
  if(t.dataset.pf){ const P=peopleObj(), i=+t.dataset.i, f=t.dataset.pf; const v=t.value===''?null:+t.value;
    if(f==='kage') P.kd[i].age=v; else P.ad[i][f]=v; S.A.people=P; save(); const el=document.getElementById(f==='kage'?'ptgtk'+i:'ptgt'+i); if(el) el.innerHTML=ptgtHtml(i,f==='kage'); return; }
});
document.addEventListener('focusin',e=>{ if(e.target.id==='bin') setTimeout(()=>{ try{e.target.select();}catch(_){} },0); });
document.addEventListener('keydown',e=>{ if(e.key==='Enter'&&e.target.id==='cityin'){ const btn=document.querySelector('[data-act=savecity]'); if(btn) btn.click(); } if(e.key==='Escape') closeModal(); });
// переходы по экранам сбрасывают поиск
const _go=go; go=function(sc){ searchQ=''; _go(sc); };
document.title=APP_NAME+' — план питания на неделю';
if(inTG){ try{ applyTheme(); TG.onEvent('themeChanged',applyTheme); if(tgv('6.1')) TG.BackButton.onClick(goBack); if(tgv('7.7')&&TG.disableVerticalSwipes) TG.disableVerticalSwipes(); document.documentElement.classList.add('tg'); }catch(e){ console.warn(e); } }
if(S.screen==='loading') loadingRun=false;
loadPrices().then(render);
