'use strict';
/* ====== НАСТРОЙКИ ====== */
const APP_NAME = 'СытоПлан';          // ← название приложения меняется здесь
const LS_KEY = 'sytoplan_state_v1';

/* Магазины. mult — уровень цен сети относительно средней цены Росстата (ориентировочно).
   Источники: prosto.ru — корзина из 10 продуктов, Москва, апрель 2026 (Ашан 1276 ₽ … Перекрёсток 1671 ₽);
   ngnovoros.ru — 13 продуктов, Москва, сентябрь 2025 (Пятёрочка дешевле Магнита и Ленты). Источники расходятся,
   поэтому отклонение от 1 по prosto.ru уменьшено вдвое. Те же коэффициенты — в tools/update_prices.py (STORE_COEF).
   Основные цены берутся из data/prices.json (обновляет tools/update_prices.py); mult применяется к ним уже там,
   а здесь — только к запасным ценам каталога ниже, если prices.json не загрузился. */
/* logo: путь к картинке магазина (img/stores/<id>.webp|svg) — иконки приложений из App Store / знак с Wikimedia Commons.
   Если logo пустой или файл не загрузился — рисуется фирменная плашка (bg/color/ini). Заменить логотип = положить файл и поправить путь здесь. */
const STORES = [
  {id:'p5',      name:'Пятёрочка',    loc:'Пятёрочке',    ini:'5', color:'#E31E24', bg:'#FDECEC', mult:1.04, lvl:'₽',   logo:'img/stores/p5.webp'},
  {id:'magnit',  name:'Магнит',       loc:'Магните',      ini:'М', color:'#D7262B', bg:'#FFEFF0', mult:0.97, lvl:'₽',   logo:'img/stores/magnit.webp'},
  {id:'perek',   name:'Перекрёсток',  loc:'Перекрёстке',  ini:'П', color:'#0B7A3B', bg:'#E7F5EC', mult:1.05, lvl:'₽₽',  logo:'img/stores/perek.webp'},
  {id:'lenta',   name:'Лента',        loc:'Ленте',        ini:'Л', color:'#003C96', bg:'#EAF0FB', mult:1.02, lvl:'₽₽',  logo:'img/stores/lenta.svg'},
  {id:'auchan',  name:'Ашан',         loc:'Ашане',        ini:'А', color:'#E2001A', bg:'#FDE8EA', mult:0.92, lvl:'₽',   logo:'img/stores/auchan.webp'},
  {id:'samokat', name:'Самокат',      loc:'Самокате',     ini:'С', color:'#FF335F', bg:'#FFEAF0', mult:1.14, lvl:'₽₽₽', logo:'img/stores/samokat.webp', delivery:true},
  {id:'lavka',   name:'Яндекс Лавка', loc:'Яндекс Лавке', ini:'Л', color:'#00A3FF', bg:'#E6F6FF', mult:1.18, lvl:'₽₽₽', logo:'img/stores/lavka.webp', delivery:true},
  {id:'vkusvill',name:'ВкусВилл',     loc:'ВкусВилле',    ini:'В', color:'#2DBE64', bg:'#E8F8EE', mult:1.20, lvl:'₽₽₽', logo:'img/stores/vkusvill.webp'}
];
const STORE_ALIAS = {dixy:'p5'}; /* Дикси убрали — сохранённые профили переводим на Пятёрочку */
/* base — типичная стоимость одной взрослой порции, ₽ (для оценки бюджета) */
const MEALS = [
  {id:'b', name:'Завтрак',  short:'ЗАВТРАК', sub:'быстро и просто',   e:'🍳', base:65},
  {id:'l', name:'Обед',     short:'ОБЕД',    sub:'можно из остатков', e:'🍲', base:130},
  {id:'d', name:'Ужин',     short:'УЖИН',    sub:'главное блюдо',     e:'🍽️', base:160},
  {id:'s', name:'Перекусы', short:'ПЕРЕКУС', sub:'по желанию',        e:'🍎', base:50}
];
const DAYS = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
const DAYS_FULL = ['Понедельник','Вторник','Среда','Четверг','Пятница','Суббота','Воскресенье'];
const EQUIP = [
  {id:'stove',name:'Плита',e:'🔥'},{id:'oven',name:'Духовка',e:'♨️'},{id:'micro',name:'Микроволновка',e:'⏲️'},
  {id:'multi',name:'Мультиварка',e:'🍲'},{id:'air',name:'Аэрогриль',e:'🌪️'},{id:'blender',name:'Блендер',e:'🥤'},{id:'toaster',name:'Тостер',e:'🍞'},{id:'fryer',name:'Фритюрница',e:'🍟'}
];
const DIETS = [
  {id:'none',name:'Без ограничений',sub:'едим всё',e:'🍽️'},
  {id:'veg',name:'Вегетарианское',sub:'без мяса и рыбы',e:'🥦'},
  {id:'pp',name:'ПП / полезное',sub:'лёгкие блюда, меньше калорий',e:'🥗'},
  {id:'hp',name:'Высокобелковое',sub:'больше белка',e:'💪'},
  {id:'lean',name:'Постное',sub:'без мяса, молочного и яиц',e:'🌾'},
  {id:'kids',name:'Детское',sub:'мягкие вкусы для детей',e:'🧸'}
];
const CUISINES = [
  {id:'ru',name:'Русская',e:'🥟',g:['#FEF3C7','#FDE68A']},
  {id:'cau',name:'Кавказская',e:'🍢',g:['#FFE4E6','#FECDD3']},
  {id:'asia',name:'Азиатская',e:'🍜',g:['#FFEDD5','#FED7AA']},
  {id:'it',name:'Итальянская',e:'🍝',g:['#FEE2E2','#FECACA']},
  {id:'med',name:'Средиземноморская',e:'🫒',g:['#DCFCE7','#BBF7D0']},
  {id:'ff',name:'Фастфуд',e:'🍔',g:['#FEF9C3','#FDE68A'],hidden:true} /* домашний фастфуд: в анкете отдельный переключатель, не «любимая кухня» */
];
const STYLES = [
  {id:'fast',name:'Быстро',sub:'около 20 минут',e:'⚡'},
  {id:'onepan',name:'Одна сковорода',sub:'меньше посуды',e:'🍳'},
  {id:'batch',name:'Готовка впрок',sub:'готовим раз — едим два',e:'📦'},
  {id:'family',name:'Семейная классика',sub:'как дома',e:'🏠'},
  {id:'light',name:'Лёгкое и свежее',sub:'овощи, салаты, супы',e:'🥗'}
];
const ALLERGENS = [
  {id:'none',name:'Нет аллергии',e:'✅'},{id:'nuts',name:'Орехи (и арахис)',e:'🌰'},{id:'peanut',name:'Арахис',e:'🥜'},
  {id:'dairy',name:'Молочное',e:'🥛'},{id:'lactose',name:'Лактоза',e:'🍼'},{id:'eggs',name:'Яйца',e:'🥚'},{id:'gluten',name:'Глютен',e:'🌾'},
  {id:'fish',name:'Рыба',e:'🐟'},{id:'seafood',name:'Морепродукты',e:'🦐'},{id:'soy',name:'Соя',e:'🫘'},
  {id:'sesame',name:'Кунжут',e:'⚪'},{id:'honey',name:'Мёд',e:'🍯'},{id:'mustard',name:'Горчица',e:'🟡'}
];
const AISLES = [
  {id:'veg',name:'Овощи и фрукты',e:'🥕'},{id:'meat',name:'Мясо и птица',e:'🍗'},{id:'fish',name:'Рыба и морепродукты',e:'🐟'},{id:'dairy',name:'Молочное',e:'🥛'},
  {id:'groc',name:'Бакалея',e:'🌾'},{id:'canned',name:'Консервы и соленья',e:'🥫'},{id:'bread',name:'Хлеб',e:'🍞'},{id:'frozen',name:'Заморозка',e:'❄️'},{id:'other',name:'Прочее',e:'🧺'}
];

/* ====== КАТАЛОГ ПРОДУКТОВ ======
   Цены здесь — ЗАПАСНЫЕ (ориентир на розницу РФ 2025–2026, «средняя» цена, mult=1.0).
   Актуальные — в data/prices.json: средние потребительские цены Росстата (еженедельные/ежемесячные, РФ),
   пересчитанные на упаковку × коэффициент сети. Для ~20 позиций без аналога у Росстата остаётся цена отсюда (source:'demo').
   Это НЕ цены с полок и не данные из API магазинов.
   Формат: key: [название, отдел, упаковка, ед., цена упаковки ₽, emoji, флаги, [ккал, Б, Ж, У на 100 г/мл], вес 1 шт в г]
   Пищевая ценность — справочные значения на 100 г съедобной части сырого продукта
   (И. М. Скурихин «Химический состав российских пищевых продуктов», при отсутствии — USDA FoodData Central).
   флаги: meat/fish/seafood — тип продукта; dairy/eggs/gluten/nuts/peanut/soy/sesame/honey — аллергены;
   opt — «необязательный» ингредиент: если его не любят, он просто убирается из рецепта. */
const ING_RAW = {
  /* Овощи, зелень, фрукты */
  potato:['Картофель','veg',1000,'г',55,'🥔','',[77,2,0.4,16.3]],
  onion:['Лук репчатый','veg',1000,'г',45,'🧅','opt',[41,1.4,0.2,8.2]],
  carrot:['Морковь','veg',1000,'г',50,'🥕','',[35,1.3,0.1,6.9]],
  garlic:['Чеснок','veg',100,'г',45,'🧄','opt',[143,6.5,0.5,29.9]],
  cabbage:['Капуста белокочанная','veg',1000,'г',40,'🥬','',[28,1.8,0.1,4.7]],
  beet:['Свёкла','veg',1000,'г',50,'🟣','',[42,1.5,0.1,8.8]],
  tomato:['Помидоры','veg',500,'г',140,'🍅','',[20,0.6,0.2,4.2]],
  cucumber:['Огурцы','veg',500,'г',110,'🥒','',[15,0.8,0.1,2.8]],
  pepper:['Перец болгарский','veg',500,'г',180,'🫑','',[27,1.3,0.1,5.3]],
  zucchini:['Кабачки','veg',1000,'г',120,'🥒','',[24,0.6,0.3,4.6]],
  eggplant:['Баклажаны','veg',500,'г',130,'🍆','',[24,1.2,0.1,4.5]],
  pumpkin:['Тыква','veg',1000,'г',60,'🎃','',[22,1,0.1,4.4]],
  radish:['Редис','veg',200,'г',70,'🔴','',[19,1.2,0.1,3.4]],
  lettuce:['Салат айсберг','veg',400,'г',130,'🥬','',[14,0.9,0.1,1.8]],
  ginger:['Имбирь','veg',100,'г',45,'🫚','opt',[80,1.8,0.8,15.8]],
  greens:['Зелень (укроп, петрушка)','veg',50,'г',55,'🌿','opt',[40,2.5,0.5,6.3]],
  cilantro:['Кинза','veg',50,'г',65,'🌿','opt',[23,2.1,0.5,1.9]],
  green_onion:['Лук зелёный','veg',50,'г',50,'🌱','opt',[20,1.3,0.1,3.2]],
  mushrooms:['Шампиньоны','veg',400,'г',150,'🍄','',[27,4.3,1,0.1]],
  celery:['Сельдерей стеблевой','veg',300,'г',120,'🥬','opt',[13,0.9,0.1,2.1]],
  apple:['Яблоки','veg',1000,'г',140,'🍎','',[47,0.4,0.4,9.8]],
  banana:['Бананы','veg',1000,'г',150,'🍌','',[96,1.5,0.2,21.8]],
  pear:['Груши','veg',1000,'г',200,'🍐','',[47,0.4,0.3,10.3]],
  orange:['Апельсины','veg',1000,'г',160,'🍊','',[43,0.9,0.2,8.1]],
  lemon:['Лимон','veg',1,'шт',45,'🍋','opt',[34,0.9,0.1,3],60],
  avocado:['Авокадо','veg',1,'шт',110,'🥑','',[160,2,14.7,1.8],150],
  /* Мясо и птица */
  chicken_fillet:['Филе куриное','meat',500,'г',230,'🍗','meat',[113,23.6,1.9,0.4]],
  chicken_thigh:['Бёдра куриные','meat',900,'г',300,'🍗','meat',[160,15,11,0]],
  chicken_drum:['Голени куриные','meat',900,'г',290,'🍗','meat',[158,15.5,10.5,0]],
  chicken_wings:['Крылья куриные','meat',900,'г',270,'🍗','meat',[186,19,12,0]],
  minced_chicken:['Фарш куриный','meat',500,'г',220,'🍗','meat',[143,17.4,8.1,0]],
  turkey_fillet:['Филе индейки','meat',500,'г',330,'🦃','meat',[114,23,2,0]],
  minced_turkey:['Фарш из индейки','meat',400,'г',230,'🦃','meat',[160,18,10,0]],
  minced_mix:['Фарш домашний (свинина + говядина)','meat',500,'г',290,'🥩','meat',[263,17,21.6,0]],
  beef:['Говядина (мякоть)','meat',500,'г',430,'🥩','meat',[158,20,8.5,0]],
  pork:['Свинина (лопатка)','meat',500,'г',290,'🥓','meat',[259,16,21.6,0]],
  liver:['Печень куриная','meat',500,'г',140,'🫀','meat',[136,19.1,6.3,0.6]],
  sausages:['Сосиски','meat',450,'г',240,'🌭','meat,dairy,soy',[266,11,23.9,1.6]],
  ham:['Ветчина','meat',300,'г',190,'🍖','meat',[180,15,13,1]],
  /* Рыба и морепродукты */
  fish_white:['Филе минтая','fish',500,'г',260,'🐟','fish',[72,15.9,0.9,0]],
  hake:['Хек (филе)','fish',500,'г',290,'🐟','fish',[86,16.6,2.2,0]],
  fish_red:['Горбуша (стейки)','fish',500,'г',390,'🐟','fish',[142,20.5,6.5,0]],
  mackerel:['Скумбрия','fish',400,'г',190,'🐟','fish',[191,18,13.2,0]],
  herring:['Сельдь филе слабосолёное','fish',250,'г',170,'🐟','fish',[217,19.8,15.4,0]],
  shrimp:['Креветки варёно-мороженые','fish',500,'г',520,'🦐','seafood',[95,22,1,0]],
  squid:['Кальмар (тушка)','fish',500,'г',330,'🦑','seafood',[100,18,2.2,2]],
  crab_sticks:['Крабовые палочки','fish',200,'г',110,'🦀','fish,eggs',[94,6,1,10]],
  tuna:['Тунец консервированный','canned',185,'г',170,'🐟','fish',[96,21,1,0]],
  saury:['Сайра консервированная','canned',245,'г',160,'🐟','fish',[205,18.3,14.1,0]],
  /* Заморозка */
  pelmeni:['Пельмени','frozen',800,'г',380,'🥟','meat,gluten,eggs',[275,11.9,12.4,29]],
  vareniki:['Вареники с картофелем','frozen',800,'г',260,'🥟','gluten',[160,4,3,28]],
  puff_pastry:['Тесто слоёное бездрожжевое','frozen',500,'г',170,'🥐','gluten,dairy',[360,6,23,32]],
  frozen_veg:['Овощная смесь замороженная','frozen',400,'г',130,'🥦','',[40,2.2,0.3,7]],
  broccoli:['Брокколи замороженная','frozen',400,'г',170,'🥦','',[28,3,0.4,5.2]],
  cauliflower:['Цветная капуста замороженная','frozen',400,'г',150,'🥦','',[30,2.5,0.3,4.2]],
  green_beans:['Стручковая фасоль замороженная','frozen',400,'г',130,'🫛','',[24,2,0.2,3.6]],
  peas:['Горошек зелёный замороженный','frozen',400,'г',110,'🫛','',[73,5,0.2,13.8]],
  berries:['Ягоды замороженные','frozen',300,'г',180,'🫐','',[45,0.8,0.4,9.5]],
  /* Молочное и яйца */
  milk:['Молоко 2,5%','dairy',1000,'мл',95,'🥛','dairy',[52,2.8,2.5,4.7]],
  kefir:['Кефир 2,5%','dairy',1000,'мл',100,'🥛','dairy',[50,2.9,2.5,4]],
  ryazhenka:['Ряженка 4%','dairy',500,'мл',85,'🥛','dairy',[67,2.9,4,4.2]],
  smetana:['Сметана 15%','dairy',300,'г',105,'🫙','dairy',[158,2.6,15,3.6]],
  tvorog:['Творог 5%','dairy',200,'г',110,'🥣','dairy',[121,17.2,5,1.8]],
  cheese:['Сыр полутвёрдый','dairy',200,'г',210,'🧀','dairy',[356,24,28,0.3]],
  mozzarella:['Моцарелла','dairy',125,'г',130,'🧀','dairy',[280,20,21,1]],
  processed_cheese:['Сыр плавленый','dairy',200,'г',140,'🧀','dairy',[257,7,23,6]],
  butter:['Масло сливочное 82%','dairy',180,'г',190,'🧈','dairy',[748,0.5,82.5,0.8]],
  yogurt:['Йогурт натуральный','dairy',350,'г',110,'🥛','dairy',[60,4,2.5,5]],
  cream:['Сливки 10%','dairy',200,'мл',95,'🥛','dairy',[118,2.8,10,4]],
  feta:['Брынза','dairy',250,'г',230,'🧀','dairy',[260,17.9,20.1,0.3]],
  condensed_milk:['Сгущённое молоко','groc',380,'г',130,'🥫','dairy',[320,7.2,8.5,56]],
  eggs:['Яйца С1','dairy',10,'шт',125,'🥚','eggs',[157,12.7,11.5,0.7],55],
  /* Хлеб */
  bread:['Хлеб пшеничный','bread',400,'г',55,'🍞','gluten,sesame',[250,7.7,3,48]],
  bread_whole:['Хлеб цельнозерновой','bread',300,'г',80,'🍞','gluten,sesame',[230,8,3,43]],
  lavash:['Лаваш тонкий','bread',200,'г',60,'🫓','gluten',[236,7.9,1,47.6]],
  tortilla:['Тортильи пшеничные','bread',250,'г',150,'🫓','gluten',[300,8,7,50]],
  /* Бакалея */
  buckwheat:['Гречка','groc',900,'г',110,'🌾','',[313,12.6,3.3,57.1]],
  rice:['Рис круглозёрный','groc',900,'г',120,'🍚','',[333,7,1,74]],
  millet:['Пшено','groc',900,'г',85,'🌾','',[342,11.5,3.3,66.5]],
  semolina:['Манная крупа','groc',800,'г',70,'🌾','gluten',[333,10.3,1,70.6]],
  barley:['Перловая крупа','groc',900,'г',70,'🌾','gluten',[315,9.3,1.1,66.9]],
  bulgur:['Булгур','groc',450,'г',120,'🌾','gluten',[342,12.3,1.3,63.4]],
  oats:['Овсяные хлопья','groc',500,'г',75,'🥣','gluten',[352,12.3,6.2,61.8]],
  pasta:['Макароны (рожки)','groc',450,'г',80,'🍝','gluten',[337,10.4,1.1,69.7]],
  spaghetti:['Спагетти','groc',450,'г',100,'🍝','gluten',[337,10.4,1.1,69.7]],
  noodles:['Лапша пшеничная яичная','groc',300,'г',110,'🍜','gluten,eggs',[340,11,1.2,70]],
  yeast:['Дрожжи сухие быстродействующие','groc',11,'г',25,'🧫','',[325,40,7.6,41]],
  flour:['Мука пшеничная','groc',1000,'г',70,'🌾','gluten',[334,10.3,1.1,68.9]],
  starch:['Крахмал картофельный','groc',200,'г',55,'🌾','',[313,0.1,0,78.2]],
  baking_powder:['Разрыхлитель теста','groc',10,'г',15,'🧁','',[0,0,0,0]],
  rice_cakes:['Хлебцы рисовые (без глютена)','bread',100,'г',95,'🍘','',[380,8,3,80]],
  burger_bun:['Булочки для бургеров с кунжутом','bread',4,'шт',110,'🍔','gluten,sesame',[275,9,5,48],75],
  hotdog_bun:['Булочки для хот-догов','bread',4,'шт',85,'🌭','gluten',[265,8.5,4,48],55],
  baguette:['Багет','bread',1,'шт',65,'🥖','gluten',[262,8,2.5,52],250],
  breadcrumbs:['Сухари панировочные','groc',200,'г',50,'🍞','gluten',[347,9.7,1.9,77.6]],
  sugar:['Сахар','groc',1000,'г',85,'🍬','',[398,0,0,99.7]],
  salt:['Соль','groc',1000,'г',25,'🧂','opt',[0,0,0,0]],
  oil:['Масло подсолнечное','groc',900,'мл',140,'🌻','',[827,0,92,0]],
  spices:['Специи (набор)','groc',30,'г',60,'🌶️','opt',[250,10,8,40]],
  tomato_paste:['Томатная паста','groc',270,'г',90,'🥫','',[99,4.8,0.5,19]],
  canned_tomatoes:['Томаты в собственном соку','canned',400,'г',140,'🥫','',[20,1.1,0.1,3.5]],
  ketchup:['Кетчуп','groc',350,'г',120,'🥫','',[100,1.8,0.1,22]],
  mustard:['Горчица','groc',100,'г',60,'🟡','mustard',[143,9.9,12.7,5.3]],
  mayo:['Майонез 67%','groc',400,'г',120,'🫙','eggs,mustard',[625,0.3,67,3]],
  soy_sauce:['Соевый соус','groc',150,'мл',110,'🍶','soy,gluten',[53,6,0,6.6]],
  honey:['Мёд','groc',250,'г',260,'🍯','honey',[329,0.8,0,80.3]],
  jam:['Варенье','groc',350,'г',160,'🍓','',[265,0.3,0.2,68]],
  nuts:['Грецкие орехи','groc',100,'г',150,'🌰','nuts',[656,16.2,60.8,11.1]],
  peanut_butter:['Арахисовая паста','groc',250,'г',220,'🥜','peanut',[588,25,50,20]],
  sesame:['Кунжут','groc',50,'г',50,'⚪','sesame',[565,19.4,48.7,12.2]],
  raisins:['Изюм','groc',200,'г',110,'🍇','',[264,2.9,0.6,66]],
  prunes:['Чернослив','groc',200,'г',170,'🟤','',[231,2.3,0.7,57.5]],
  dried_apricots:['Курага','groc',200,'г',190,'🟠','',[215,5.2,0.3,51]],
  lentils:['Чечевица красная','groc',500,'г',130,'🫘','',[295,24,1.5,46.3]],
  split_peas:['Горох колотый','groc',800,'г',75,'🫘','',[298,20.5,2,49.5]],
  chickpeas:['Нут','groc',500,'г',140,'🫘','',[309,20.1,4.3,46.2]],
  canned_beans:['Фасоль красная консервированная','canned',400,'г',110,'🫘','',[99,6.7,0.3,17]],
  corn:['Кукуруза консервированная','canned',340,'г',110,'🌽','',[72,2.2,1.1,13.5]],
  green_peas:['Горошек консервированный','canned',400,'г',100,'🫛','',[55,3.6,0.1,9.8]],
  pickles:['Огурцы солёные','canned',500,'г',130,'🥒','',[11,0.8,0.1,1.7]],
  sauerkraut:['Капуста квашеная','canned',500,'г',120,'🥬','',[23,1.8,0.1,3]],
  /* Мясо (добавлено в фазе 3) */
  turkey_thigh:['Бедро индейки без кости','meat',600,'г',330,'🦃','meat',[144,19.5,7.3,0]],
  minced_beef:['Фарш говяжий','meat',400,'г',260,'🥩','meat',[254,17.2,20,0]],
  pork_neck:['Свиная шея','meat',600,'г',360,'🥩','meat',[267,13.5,23.5,0]],
  minced_pork:['Фарш свиной','meat',400,'г',200,'🥩','meat',[263,17,21.5,0]],
  pork_ribs:['Рёбра свиные','meat',800,'г',320,'🍖','meat',[321,15.2,29,0]],
  lasagna:['Листы для лазаньи','groc',250,'г',140,'🍝','gluten,eggs',[350,12,1.5,72]],
  /* Пряности — вместо «специи (набор)» */
  black_pepper:['Перец чёрный молотый','groc',20,'г',45,'⚫','opt',[251,10,3.3,64]],
  bay_leaf:['Лавровый лист','groc',10,'г',35,'🍃','opt',[313,7.6,8.4,48.7]],
  cinnamon:['Корица молотая','groc',15,'г',50,'🟤','opt',[247,4,1.2,81]],
  khmeli:['Хмели-сунели','groc',20,'г',50,'🌿','opt',[290,12,5,50]],
  coriander:['Кориандр молотый','groc',20,'г',45,'🌰','opt',[298,12.4,17.8,55]],
  paprika:['Паприка молотая','groc',20,'г',50,'🌶️','opt',[282,14,13,54]],
  cumin:['Зира','groc',20,'г',55,'🌰','opt',[375,17.8,22.3,44]],
  curry:['Карри (приправа)','groc',20,'г',55,'🍛','opt',[325,14,14,58]],
  olives:['Оливки','canned',300,'г',170,'🫒','opt',[166,1.6,16.8,4]]
};
const ING = {};
Object.keys(ING_RAW).forEach(k=>{const a=ING_RAW[k];const fl=a[6]?a[6].split(','):[];const n=a[7]||[0,0,0,0];
  ING[k]={k,name:a[0],aisle:a[1],pack:a[2],unit:a[3],price:a[4],e:a[5],flags:fl,opt:fl.includes('opt'),
    n:{k:n[0],p:n[1],f:n[2],c:n[3]},w:a[8]||0};});
/* граммы для расчёта КБЖУ: шт → вес штуки, мл → 1 мл ≈ 1 г (для масла плотность учтена в таблице на 100 мл) */
function ingGrams(k,q){const it=ING[k];if(!it)return 0;return it.unit==='шт'?q*(it.w||0):q;}

/* Нелюбимые продукты → ключи каталога */
const DISLIKES = [
  ['cilantro','кинза','🌿',['cilantro']],['mushrooms','грибы','🍄',['mushrooms']],['liver','печень','🫀',['liver']],
  ['onion','лук','🧅',['onion','green_onion']],['garlic','чеснок','🧄',['garlic']],['eggplant','баклажаны','🍆',['eggplant']],
  ['pork','свинина','🐖',['pork','minced_mix','pelmeni','sausages','ham']],['beef','говядина','🐄',['beef','minced_mix','pelmeni']],
  ['chicken','курица','🐔',['chicken_fillet','chicken_thigh','chicken_drum','chicken_wings','minced_chicken']],
  ['turkey','индейка','🦃',['turkey_fillet','minced_turkey']],
  ['fish','рыба','🐟',['fish_white','hake','fish_red','mackerel','herring','tuna','saury','crab_sticks']],
  ['seafood','морепродукты','🦐',['shrimp','squid']],
  ['olives','оливки','🫒',['olives']],['celery','сельдерей','🥬',['celery']],['tvorog','творог','🥣',['tvorog']],
  ['beet','свёкла','🟣',['beet']],['cabbage','капуста','🥬',['cabbage','sauerkraut']],['pepper','перец болгарский','🫑',['pepper']],
  ['zucchini','кабачки','🥒',['zucchini']],['pumpkin','тыква','🎃',['pumpkin']],['tomato','помидоры','🍅',['tomato']],['carrot','морковь','🥕',['carrot']],
  ['legumes','бобовые (нут, фасоль, чечевица, горох)','🫘',['lentils','chickpeas','canned_beans','split_peas']],
  ['pickles','солёные огурцы','🥒',['pickles']],['mayo','майонез','🫙',['mayo']],
  ['sausages','сосиски','🌭',['sausages']],['milk','молоко','🥛',['milk']],['kefir','кефир','🥛',['kefir']],
  ['buckwheat','гречка','🌾',['buckwheat']],['oats','овсянка','🥣',['oats']],['semolina','манка','🌾',['semolina']],
  ['millet','пшено','🌾',['millet']],['barley','перловка','🌾',['barley']],['feta','брынза','🧀',['feta']],
  ['raisins','изюм','🍇',['raisins']],['banana','бананы','🍌',['banana']],['greens','укроп и петрушка','🌿',['greens']],
  ['smetana','сметана','🫙',['smetana']],['cream','сливки','🥛',['cream']]
];
/* Порядок плиток «что есть дома» */
const PANTRY_FIRST = ['eggs','milk','butter','oil','salt','sugar','flour','rice','buckwheat','pasta','onion','potato','carrot','garlic','spices','bread','smetana','cheese','oats','tomato_paste','tvorog','kefir','soy_sauce','honey','mayo','semolina','millet'];

/* ====== РЕЦЕПТЫ ======
   R(id, название, emoji, приёмы[b,l,d,s], кухня, теги, техника, подготовка мин, готовка мин, порций в базе,
     'ингредиент:кол-во,...' (на базовые порции), шаги).
   КБЖУ НЕ задаются вручную — считаются из таблицы пищевой ценности каталога (см. calcNutrition). */
const RECIPES = [];
function R(id,t,e,m,c,tags,eq,prep,cook,sv,ing,steps){
  RECIPES.push({id,t,e,m:m.split(','),c,tags:tags?tags.split(','):[],eq:eq?eq.split(','):[],prep,cook,sv,
    ing:ing.split(',').map(s=>{const [k,q]=s.split(':');return {k:k.trim(),q:+q};}),steps});
}
function calcNutrition(r){let k=0,p=0,f=0,c=0,fi=0,su=0;
  r.ing.forEach(x=>{const it=ING[x.k];if(!it)return;const g=ingGrams(x.k,x.q)/100;k+=it.n.k*g;p+=it.n.p*g;f+=it.n.f*g;c+=it.n.c*g;
    fi+=(FIBER[x.k]||0)*g; su+=(ADDED_SUGAR[x.k]||0)*g*100;});
  r.k=Math.round(k/r.sv);r.p=Math.round(p/r.sv);r.f=Math.round(f/r.sv);r.cb=Math.round(c/r.sv);r.fi=Math.round(fi/r.sv*10)/10;r.su=Math.round(su/r.sv);}

/* ====== КЛЕТЧАТКА и ДОБАВЛЕННЫЙ САХАР ======
   Пищевые волокна, г на 100 г (USDA FoodData Central / Скурихин; крупы и бобовые — в сухом виде). Остальное = 0. */
const FIBER = {potato:2.2,onion:1.7,carrot:2.8,garlic:2.1,cabbage:2.5,beet:2.8,tomato:1.2,cucumber:0.7,pepper:1.9,zucchini:1,eggplant:3,
  pumpkin:2,radish:1.6,lettuce:1.2,ginger:2,greens:3,cilantro:2.8,green_onion:2.6,mushrooms:1,celery:1.6,apple:2.4,banana:2.6,pear:3.1,
  orange:2.4,lemon:2.8,avocado:6.7,pelmeni:1,vareniki:1.5,puff_pastry:1,frozen_veg:3,broccoli:2.6,cauliflower:2,green_beans:2.7,peas:5,
  berries:3.5,bread:2.5,burger_bun:2.3,hotdog_bun:2.2,baguette:2.4,bread_whole:6.5,lavash:2,tortilla:3,buckwheat:10,rice:1.3,millet:3.5,semolina:3.6,barley:15,bulgur:12,oats:10,
  pasta:3,spaghetti:3,noodles:3,flour:3,breadcrumbs:4,tomato_paste:4,canned_tomatoes:1.5,ketchup:0.5,mustard:4,soy_sauce:0.8,jam:1,
  nuts:6.7,peanut_butter:6,sesame:12,raisins:3.7,prunes:7,dried_apricots:7.3,lentils:11,split_peas:15,chickpeas:12,canned_beans:6,
  corn:2.4,green_peas:4.5,pickles:1,sauerkraut:2.9,olives:3.3,lasagna:3,black_pepper:25,bay_leaf:26,cinnamon:53,khmeli:20,coriander:42,
  paprika:35,cumin:10,curry:33,spices:25};
/* доля добавленного сахара в продукте (для лимита ВОЗ <10% ккал) */
const ADDED_SUGAR = {sugar:1,honey:0.8,jam:0.6,condensed_milk:0.45,ketchup:0.2,peanut_butter:0.05};

/* ====== ДОРАБОТКА РЕЦЕПТОВ ПРИ ЗАГРУЗКЕ ======
   1) Конкретные пряности вместо «Специи (набор)»: по тексту шагов (корица, лавровый лист, хмели-сунели…).
   2) Масло для смазывания, если в шагах «смажьте», а масла в списке нет. */
const SPICE_KW = [[/кориц/i,'cinnamon',2],[/лавров/i,'bay_leaf',1],[/хмели/i,'khmeli',3],[/кориандр/i,'coriander',2],[/паприк/i,'paprika',3],
  [/зир[аыуо]/i,'cumin',2],[/карри/i,'curry',5],[/поперч|молот\S* перц|чёрн\S* перц|черн\S* перц|перц\S* горош|перцем по вкусу|солью и перцем|соль, перец/i,'black_pepper',1]];
function enrichIngredients(r){
  const txt=(r.t+' '+r.steps.join(' ')).toLowerCase(); const has=k=>r.ing.some(i=>i.k===k);
  let added=0; SPICE_KW.forEach(([rx,k,q])=>{ if(rx.test(txt)&&!has(k)){ r.ing.push({k,q}); added++; } });
  const sp=r.ing.findIndex(i=>i.k==='spices');
  if(sp>=0){ if(added) r.ing.splice(sp,1); else { r.ing[sp].k='black_pepper'; r.ing[sp].q=Math.min(r.ing[sp].q,2); } }
  if(/смаж|смазать|смазанн/i.test(txt) && !has('oil') && !has('butter')) r.ing.push({k:'oil',q:5});
}
/* Время настаивания/замачивания/охлаждения — не входит в «активное» время, показывается отдельно */
const REST = {hummus_veg:[720,'замачивания нута'],chickpea_curry:[720,'замачивания нута'],overnight_oats:[480,'настаивания'],falafel:[720,'замачивания нута'],
  rassolnik:[120,'замачивания перловки'],barley_mushrooms:[120,'замачивания перловки'],pea_soup:[180,'замачивания гороха'],svekolnik:[30,'охлаждения'],
  gazpacho:[30,'охлаждения'],honey_wings:[20,'маринования'],chicken_skewers:[30,'маринования'],shuba:[120,'настаивания'],crab_salad:[15,'охлаждения'],
  mimosa:[60,'пропитки'],korean_carrot:[180,'настаивания'],lean_overnight_oats:[480,'настаивания'],pork_shashlik_oven:[60,'маринования'],
  chicken_thighs_soy:[30,'маринования'],air_pork_neck_veg:[30,'маринования'],lavash_roll:[20,'охлаждения'],
  chickpea_potato_stew:[720,'замачивания нута'],
  ff_pizza_margherita:[60,'подъёма теста'],ff_pizza_ham_mushroom:[60,'подъёма теста'],ff_pizza_chicken:[60,'подъёма теста'],ff_pizza_kids:[60,'подъёма теста'],
  ff_belyashi:[60,'подъёма теста'],ff_sausage_rolls:[75,'подъёма теста'],ff_chebureki:[30,'отдыха теста'],chickpea_pilaf_lean:[720,'замачивания нута'],buckwheat_kefir:[480,'настаивания']};
function restText(r){ if(!r.rest) return ''; const m=r.rest[0]; return '+'+(m>=480?'ночь':m>=60?(Math.round(m/60))+'\u00A0ч':m+'\u00A0мин')+' '+r.rest[1]; }

/* ====== НОРМЫ ПОРЦИЙ ======
   Взрослая порция: завтрак ≈420+ ккал, основное блюдо ≈560+ (350–450 г с гарниром), суп ≈350 (300–350 мл + хлеб).
   1) Гарнир/хлеб добавляем ТОЛЬКО основным блюдам обеда/ужина, супам и салатам (не завтракам и не перекусам).
   2) Затем масштабируем остальное не больше чем ×1,3 (гарнир не масштабируется) — реалистичные порции.
   3) Числа с единицами в тексте шагов пересчитываются тем же множителем, чтобы совпадать со списком. */
const STARCH = new Set(['potato','rice','buckwheat','pasta','spaghetti','noodles','bulgur','millet','barley','semolina','oats','flour',
  'bread','bread_whole','lavash','tortilla','burger_bun','hotdog_bun','baguette','pelmeni','vareniki','puff_pastry','lentils','chickpeas','split_peas','canned_beans','lasagna']);
const KCAL_MIN = {b:420, main:560, soup:350, salad:330, s:150};
const KCAL_TGT = {b:450, main:600, soup:380, salad:360, s:180};
const SCALE_MAX = 1.3;
const SALAD_RX=/^(тёплый )?салат|винегрет|оливье|под шубой|мимоза|табуле|цезарь|по-корейски|^свёкла с/i;
const SOUP_RX=/суп|борщ|(^|\s)щи(\s|$)|окрошка|солянка|рассольник|^уха(\s|$)|харчо|шурпа|свекольник|гаспачо|минестроне|бульон/i;
function mealKind(r){ if(r.m.includes('b')) return 'b'; if(SOUP_RX.test(r.t)) return 'soup'; if(SALAD_RX.test(r.t)) return 'salad';
  if(r.m.includes('l')||r.m.includes('d')) return 'main'; return 's'; }
function kcalOf(r){ let k=0; r.ing.forEach(x=>{const it=ING[x.k]; if(it) k+=it.n.k*ingGrams(x.k,x.q)/100;}); return k/r.sv; }
const SIDE_STEP={potato:'Гарнир: отварите очищенный картофель в подсоленной воде 20 минут, подавайте вместе с блюдом.',
  buckwheat:'Гарнир: отварите гречку (1 часть крупы на 2 части воды) 15–20 минут, подавайте вместе с блюдом.',
  rice:'Гарнир: отварите рис 15–18 минут, подавайте вместе с блюдом.',bread:'Подавайте с хлебом — так порция будет сытнее.',
  rice_cakes:'Подавайте с рисовыми хлебцами (без глютена) — так порция будет сытнее.'};
function scaleStepText(t,f){
  const rnd=(v,u)=>{ if(/^(г|мл)$/.test(u)) return v>=20?Math.round(v/5)*5:Math.round(v); if(/^(кг|л)$/.test(u)) return Math.round(v*10)/10; return Math.max(1,Math.round(v)); };
  return t.replace(/(\d+(?:[.,]\d+)?)(?:([–-])(\d+(?:[.,]\d+)?))?(\s*)(кг|г|мл|л|шт\.?|ст\.\s?л\.?|ч\.\s?л\.?|яиц|яйц[аоу]?|зубчик\S*)(?=[\s.,;)!]|$)/g,
    (m,a,d,b,sp,u)=>{ const uu=u.replace(/\.$/,''); const A=rnd(parseFloat(a.replace(',','.'))*f,uu); const B=b?rnd(parseFloat(b.replace(',','.'))*f,uu):null;
      const fmtN=v=>String(v).replace('.',','); return fmtN(A)+(B!=null?d+fmtN(B):'')+sp+u; });
}
function normalizePortion(r){
  enrichIngredients(r);
  if(REST[r.id]) r.rest=REST[r.id];
  const kind=mealKind(r); r.kind=kind; if(r.tags.includes('sauce')) return; let k=kcalOf(r); if(k>=KCAL_MIN[kind]) return;
  const has=k2=>r.ing.some(i=>i.k===k2), starch=r.ing.some(i=>STARCH.has(i.k));
  const stove=r.eq.includes('stove')||r.eq.includes('multi');
  let side=null;
  if((kind==='soup'||kind==='salad') && !has('bread') && !starch) side={k:'bread',q:50,name:'хлеб'};
  else if(kind==='soup' && !has('bread')) side={k:'bread',q:40,name:'хлеб'};
  else if(kind==='main' && !starch){
    if(!stove) side={k:'bread',q:60,name:'хлеб'};
    else if(r.c==='asia') side={k:'rice',q:60,name:'отварной рис'};
    else if(r.c==='ru') side={k:'potato',q:200,name:'отварной картофель'};
    else side={k:'buckwheat',q:60,name:'гречка'};
  }
  if(side){ r.ing.push({k:side.k,q:side.q*r.sv,side:true}); r.side=side.name; k=kcalOf(r); r.steps=r.steps.concat(SIDE_STEP[side.k]);
    if(side.k!=='bread') r.cook=Math.max(r.cook,20); }
  if(k<KCAL_MIN[kind]){ const f=Math.min(SCALE_MAX,KCAL_TGT[kind]/k); if(f<1.05) return; r.scaled=+f.toFixed(2);
    r.ing.forEach(i=>{ if(i.side||['salt','spices','baking_powder','black_pepper','bay_leaf','cinnamon','khmeli','coriander','paprika','cumin','curry'].includes(i.k)) return; const u=ING[i.k]&&ING[i.k].unit;
      if(u==='шт') i.q=Math.max(i.q,Math.round(i.q*f)); else { const q=i.q*f; i.q=q>=20?Math.round(q/5)*5:Math.max(1,Math.round(q)); } });
    r.steps=r.steps.map(t=>typeof t==='string'&&!SIDE_STEP_SET.has(t)?scaleStepText(t,f):t); }
}
const SIDE_STEP_SET=new Set(Object.values(SIDE_STEP));
