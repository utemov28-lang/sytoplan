#!/usr/bin/env python3
"""Реальные цены магазинов для СытоПлана — только из официальных открытых интерфейсов сетей.

  * ВкусВилл — официальный MCP-сервер https://mcp.vkusvill.ru/mcp (публичный инструмент vkusvill_products_search,
    без авторизации; описание: https://mcp.vkusvill.ru/, https://vkusvill.ru/llms.txt). Общий каталог (не по адресу).
  * Лента — официальный открытый Integration API https://integration.api.lenta.com (спецификация https://lenta.com/llms.txt,
    «Аутентификация: не используется»). Магазин: ближайший к центру Москвы гипермаркет, канал lo (доставка Ленты Онлайн).

Остальные сети (Пятёрочка, Перекрёсток, Магнит, Ашан, Самокат, Яндекс Лавка) на 30.10.2026 открытого API не имеют,
а сайты закрыты JS-челленджем/401/403/капчей — их не обходим, для них остаётся оценка Росстат × коэффициент.

Правила вежливости: честный User-Agent, пауза между запросами (DELAY), только чтение, без cookies и токенов.
Подбор товара: поисковый запрос → фильтр по названию (must/exclude) → нужен разбираемый вес/объём/штуки →
проверка правдоподобия (0,4…2,5 × оценки Росстата для упаковки) → самый дешёвый за кг/л из подходящих.
ПРАВИЛО: всегда берём ОБЫЧНУЮ (регулярную) цену, без акций, скидок и цен по карте лояльности:
  ВкусВилл — price.old, если есть (акция), иначе price.current; Лента — prices.priceRegular.
"""
import json, re, time, html, datetime, urllib.request, urllib.parse

UA = 'SytoPlan-price-updater/1.0 (+https://github.com/utemov28-lang/sytoplan)'
DELAY = 1.0
MSK = (55.7558, 37.6173)

# ключ → (поисковый запрос, обязательный фрагмент названия (regex, нижний регистр), исключить (regex))
G_EX = r'салат(?! айсберг)|пюре|чипс|десерт|напиток|нектар|\bсок\b|снек|котлет|в тесте|маринад|шашлык|копч|суп\b|смузи|батончик|конфет|мороженое|для (кошек|собак)|корм|набор|детск|шоколад|торт|пирог|блинчик|сырник|запеканк|печенье|крем|бальзам|паштет'
Q = {
 'potato':('картофель','^картофел','фри|бэби|батат|запеч|драник|дольк|чипс'),
 'onion':('лук репчатый','^лук репчат|^лук желт|^лук золот',''), 'carrot':('морковь','^морков','по-корейски|черри|мини'),
 'garlic':('чеснок','^чеснок','сушен|молот|гранул|маринов|паст'), 'cabbage':('капуста белокочанная','^капуста белокоч','квашен|тушен'),
 'beet':('свекла','^св[её]кл','варен|маринов'), 'tomato':('помидоры','^(томат|помидор)','черри|вялен|сушен|паст|соус|в собствен|консерв'),
 'cucumber':('огурцы','^огурц','сол[её]н|маринов|корнишон'), 'pepper':('перец сладкий','^перец (сладк|болгар)|^перец красн|^перец ж[её]лт','чили|остр|молот|фарширов'),
 'zucchini':('кабачки','^кабач','икра|гриль'), 'eggplant':('баклажаны','^баклажан','икра|гриль|маринов|аджик|в томат|консерв'),
 'pumpkin':('тыква','^тыкв','семен|семечк'), 'radish':('редис','^редис',''), 'lettuce':('салат айсберг','айсберг',''),
 'ginger':('имбирь','^имбир','маринов|сушен|молот|чай|мед'), 'greens':('укроп','^(укроп|петрушк)','сушен'),
 'cilantro':('кинза','^кинз','сушен'), 'green_onion':('лук зеленый','^лук з[её]лен','сушен'),
 'mushrooms':('шампиньоны','^шампиньон','маринов|консерв|жарен|бульон|крем|рассол|\\d+ ?мл'), 'celery':('сельдерей стеблевой','^сельдере',''),
 'apple':('яблоки','^яблок','сушен|чипс|пюре|сок'), 'banana':('бананы','^банан','сушен|чипс|мини'),
 'pear':('груши','^груш','сушен'), 'orange':('апельсины','^апельсин',''), 'lemon':('лимоны','^лимон','дроблен|с имбир|мед'),
 'avocado':('авокадо','^авокадо','масло|гуакам'),
 'chicken_fillet':('филе куриной грудки','филе (грудк|курин)|грудк[аи] (курин|цыпл)','бедр|копч|варен|запеч|гриль|наггетс|в панир'),
 'chicken_thigh':('бедро куриное','^бедр[оа] (курин|цыпл)','бескост|филе|копч|гриль'),
 'chicken_drum':('голень куриная','^голен','копч|гриль|индейк'), 'chicken_wings':('крылья куриные','^крыл','копч|гриль|индейк|остр'),
 'minced_chicken':('фарш куриный','^фарш (курин|из цыпл|цыпл)',''), 'turkey_fillet':('филе индейки','филе (грудк[иа] )?индейк','бедр|копч|варен|запеч'),
 'minced_turkey':('фарш из индейки','^фарш (из )?индейк',''), 'minced_mix':('фарш домашний','^фарш (домашн|свино-говяж|говяж[ьи]е? ?-?свин|мясн)',''),
 'beef':('говядина мякоть','^говядин','фарш|тушен|консерв|бульон|котлет|кост'), 'pork':('свинина лопатка','^(свинин|лопатк)','фарш|тушен|консерв|ребр|шея|копч'),
 'liver':('печень куриная','^печень (курин|цыпл)','паштет|индейк|говяж'), 'sausages':('сосиски','^сосиск','в тесте|для (кошек|собак)'),
 'ham':('ветчина','^ветчин','индейк(?!.*свин)'), 'fish_white':('филе минтая','^филе минта|^минтай','в панир|котлет|палоч|рыбн'),
 'hake':('хек','^(филе )?хек','в панир|котлет|палоч'), 'fish_red':('горбуша','^горбуш','копч|сол[её]н|икра|консерв|пресерв'),
 'mackerel':('скумбрия','^скумбри','копч|сол[её]н|консерв|пресерв|масл|натуральн|в томат'), 'herring':('сельдь филе','^(филе )?сельд','под шуб|в горчич|форшмак'),
 'shrimp':('креветки','^кревет','в панир|чипс|кляр|рассол|масле|пресерв'), 'squid':('кальмар','^кальмар','сушен|вялен|кольца в|консерв|копч'),
 'crab_sticks':('крабовые палочки','^крабов','салат|чипс'), 'tuna':('тунец консервированный','тун[ец]','стейк|филе тунца охл|салат'),
 'saury':('сайра','^сайр',''), 'pelmeni':('пельмени','^пельмен',''), 'vareniki':('вареники с картофелем','^вареник.*картоф',''),
 'puff_pastry':('тесто слоеное бездрожжевое','^тесто слоен',''), 'frozen_veg':('овощная смесь замороженная','смесь овощ|овощн(ая|ое) (смесь|ассорти)|^смесь','ягод|фрукт'),
 'broccoli':('брокколи замороженная','^брокколи',''), 'cauliflower':('цветная капуста замороженная','^капуста цветн',''),
 'green_beans':('фасоль стручковая замороженная','фасоль стручк',''), 'peas':('горошек зеленый замороженный','^горош[еo]к','консерв|ж/б|в банке|нут|\\d+ ?мл'),
 'berries':('ягоды замороженные','^(ягод|смесь ягод|черник|малин|клубник|вишн|смородин|брусник|клюкв)','морс|джем|варен'),
 'milk':('молоко 2,5%','^молоко','сгущ|кокос|овся|миндал|растит|сухое|топлен|детск|безлактоз|шоколад|банан'),
 'kefir':('кефир 2,5%','^кефир','детск|безлактоз'), 'ryazhenka':('ряженка','^ряженк',''), 'smetana':('сметана 15%','^сметан','продукт|соус'),
 'tvorog':('творог 5%','^творог','масса|сырок|зерн|десерт|паст'), 'cheese':('сыр полутвердый','^сыр','плавлен|творож|моцарел|брынз|фета|сулугун|колбасн|адыгей|рикот|маскарпон|косичк|голуб|плесен|страчат|бурат|снэк|нарез.*мини'),
 'mozzarella':('моцарелла','^(сыр )?моцарел','пицц'), 'processed_cheese':('сыр плавленый','плавлен',''),
 'butter':('масло сливочное 82','^масло сливоч','топлен|шоколад|чесночн'), 'yogurt':('йогурт натуральный','^йогурт','питьев|клубн|вишн|персик|фрукт|ягод|злак|манго|банан|черник|малин|питьевой'),
 'cream':('сливки 10%','^сливки','растит|кокос|взбит|кондитер|33|35'), 'feta':('брынза','^(сыр )?брынз',''),
 'condensed_milk':('молоко сгущенное','сгущ','варен|какао|кофе'), 'eggs':('яйца куриные С1','^яйц','перепел|шоколад|киндер'),
 'bread':('хлеб пшеничный','^(хлеб|батон)','ржан|бородин|зернов|цельнозерн|без глютен|лаваш|хлебц|тост'),
 'bread_whole':('хлеб цельнозерновой','^хлеб.*(цельнозерн|зернов)','хлебц'), 'lavash':('лаваш тонкий','^лаваш','чипс|с начинк'),
 'tortilla':('тортилья пшеничная','тортиль','чипс|начос'), 'buckwheat':('гречка','^(крупа )?гречн|^гречк','зелен|хлопья|лапша|в варочн|макарон|каша'),
 'rice':('рис круглозерный','^рис','варочн|бурый|дикий|бaсмат|басмат|жасмин|черн|красн|пропарен|рисовые|хлопья|лапша|молоко|каша'),
 'millet':('пшено','^(крупа )?пшен','варочн|хлопья'), 'semolina':('манная крупа','манн',''),
 'barley':('перловая крупа','перлов','варочн'), 'bulgur':('булгур','^булгур','варочн'), 'oats':('овсяные хлопья','^(хлопья )?овсян','печенье|каша (с|готов)|отруб'),
 'pasta':('макароны рожки','^(макарон|рожки|изделия макарон)','с соус|быстр'), 'spaghetti':('спагетти','^спагетти','соус|с '),
 'noodles':('лапша яичная','^лапша','быстрого|рамен|удон|соба|фунчоз|рисов|суп|стакан|wok'),
 'flour':('мука пшеничная','^мука пшен','цельнозерн|блин|смесь'), 'starch':('крахмал картофельный','^крахмал',''),
 'baking_powder':('разрыхлитель теста','разрыхлит',''), 'rice_cakes':('хлебцы рисовые','^хлебц.*рис','глазир|шоколад|йогурт'),
 'breadcrumbs':('сухари панировочные','^сухари панир',''), 'sugar':('сахар','^сахар','тростник|ванил|пудр|кокос|рафинад кусков|сироп'),
 'salt':('соль поваренная','^соль','морск|гималайск|с травами|приправ|нитрит'), 'oil':('масло подсолнечное','^масло подсолн',''),
 'spices':('приправа универсальная','^приправ','для (рыбы|курицы|мяса)|соль'), 'tomato_paste':('томатная паста','^(паста )?томатн(ая)? паст|^паста томатн',''),
 'canned_tomatoes':('томаты в собственном соку','томат.*собствен|томаты резан|томаты очищ',''),
 'ketchup':('кетчуп','^кетчуп',''), 'mustard':('горчица','^горчиц','семен|зерно|порош|масло'), 'mayo':('майонез','^майонез','соус'),
 'soy_sauce':('соевый соус','^соус соев|соевый соус',''), 'honey':('мед','^м[её]д','с орех|орехи в|десерт|пряник|напит|сот'),
 'jam':('варенье','^(варенье|джем|конфитюр)',''), 'nuts':('грецкий орех','^(орех[и]? )?грецк|^ядр[ао] грецк','шоколад|глазур|в мед'),
 'peanut_butter':('арахисовая паста','арахисов.*паст|паста арахис',''), 'sesame':('кунжут','^кунжут','масло|паст|козинак|батончик'),
 'raisins':('изюм','^изюм','шоколад|глазур'), 'prunes':('чернослив','^чернослив','шоколад|глазур'), 'dried_apricots':('курага','^курага','шоколад|глазур'),
 'lentils':('чечевица красная','^чечевиц','суп|паст|чипс|хлебц'), 'split_peas':('горох колотый','^горох','зелен|суп|нут|чипс'),
 'chickpeas':('нут','^нут','хумус|чипс|паст|консерв|в собствен'), 'canned_beans':('фасоль красная консервированная','^фасоль','стручк|бел'),
 'corn':('кукуруза консервированная','^кукуруз','почат|попкорн|хлопья|палочк|мука|крупа|замор'),
 'green_peas':('горошек зеленый консервированный','^горош[еo]к зел','замор'), 'pickles':('огурцы соленые','^огурц.*(сол|маринов)|^корнишон',''),
 'sauerkraut':('капуста квашеная','^капуста квашен',''), 'turkey_thigh':('бедро индейки без кости','бедр.*индейк|индейк.*бедр','копч|запеч|фарш'),
 'minced_beef':('фарш говяжий','^фарш (из )?говяж','свин'), 'pork_neck':('свиная шея','шея|шейка','копч|запеч|шашлык|буженин|карбонад|балык'),
 'minced_pork':('фарш свиной','^фарш (из )?свин','говяж'), 'pork_ribs':('ребра свиные','^р[её]бр','копч|гриль|барбек|bbq|говяж'),
 'lasagna':('листы для лазаньи','лазан','готов'), 'black_pepper':('перец черный молотый','перец ч[её]рн.*молот','горош'),
 'bay_leaf':('лавровый лист','лавров',''), 'cinnamon':('корица молотая','^корица','палоч|булоч|печен'), 'khmeli':('хмели-сунели','хмели',''),
 'coriander':('кориандр молотый','^кориандр',''), 'paprika':('паприка молотая','^паприк','чипс|соус'), 'cumin':('зира','^(зира|кумин)',''),
 'curry':('карри приправа','^(карри|приправа карри)','соус|паст'), 'olives':('оливки','^оливк','масло|паст'),
}

def _get(url, data=None, headers=None):
    h = {'User-Agent': UA, 'Accept': 'application/json'}; h.update(headers or {})
    req = urllib.request.Request(url, data=data, headers=h)
    with urllib.request.urlopen(req, timeout=40) as r: return json.loads(r.read().decode('utf-8'))

def clean(s): return re.sub(r'\s+', ' ', html.unescape(s or '').replace('\xa0', ' ')).strip()

SIZE = re.compile(r'(\d+(?:[.,]\d+)?)\s*(кг|г|гр|мл|л|шт)\b', re.I)
def size_from_text(t):
    """→ ('kg'|'pcs', value) по последнему указанию массы/объёма/штук в названии/упаковке."""
    t = (t or '').replace('1*', '')
    m = [x for x in SIZE.finditer(t)]
    if not m: return None
    v, u = m[-1].groups(); v = float(v.replace(',', '.')); u = u.lower()
    if u in ('г', 'гр', 'мл'): return ('kg', v / 1000)
    if u in ('кг', 'л'): return ('kg', v)
    return ('pcs', v)

# ---------------- источники ----------------
class VkusVill:
    id = 'vkusvill'; name = 'ВкусВилл'
    source = 'ВкусВилл — официальный MCP-сервер (mcp.vkusvill.ru), общий каталог'
    URL = 'https://mcp.vkusvill.ru/mcp'
    def __init__(self): self.n = 0
    def search(self, q):
        body = json.dumps({'jsonrpc': '2.0', 'id': self.n, 'method': 'tools/call', 'params': {'name': 'vkusvill_products_search',
               'arguments': {'q': q, 'mode': 'custom', 'fields': ['id', 'name', 'price', 'unit', 'weight', 'url'],
                             'sort': 'popularity', 'page': 1, 'limit': 10}}}).encode()   # максимум 10
        self.n += 1
        d = _get(self.URL, body, {'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream'})
        if 'error' in d: raise RuntimeError(d['error'].get('message'))
        t = json.loads(d['result']['content'][0]['text'])
        out = []
        for i in (t.get('data') or {}).get('items', []):
            name = clean(i.get('name')); pr = (i.get('price') or {}).get('current')
            if not pr: continue
            w = i.get('weight') or {}; sz = None
            if (i.get('unit') or '') == 'кг': sz = ('kg', 1.0)                     # весовой товар: цена за 1 кг
            else:
                s = size_from_text(name)
                if s and s[0] == 'pcs': sz = s
                elif w.get('value') and w.get('unit') in ('кг', 'л'): sz = ('kg', float(w['value']))
                elif s: sz = s
            old = (i.get('price') or {}).get('old')
            out.append({'name': name, 'price': float(old or pr), 'size': sz, 'url': i.get('url'),
                        'promo': bool(old), 'shelf_promo': float(pr) if old else None,
                        'grams_hint': float(w['value']) if w.get('value') and w.get('unit') == 'кг' else None})
        return out

class Lenta:
    id = 'lenta'; name = 'Лента'
    API = 'https://integration.api.lenta.com'
    def __init__(self):
        hubs = _get(f'{self.API}/v1/stores/nearest/hub?latitude={MSK[0]}&longitude={MSK[1]}&retailBrand=lo')['hubs']
        hubs.sort(key=lambda h: h['distance'])
        pick = next((h for h in hubs if h.get('shopType') == 'HM'), None) or next(h for h in hubs if h.get('shopType') in ('SM', 'MM'))
        self.store = pick
        self.source = f"Лента — официальный открытый Integration API (lenta.com/llms.txt), {pick['name']}, {pick['address']}, доставка (lo)"
    def search(self, q):
        u = f'{self.API}/catalog/v1/items?' + urllib.parse.urlencode({'stores': self.store['id'], 'channel': 'lo', 'retailBrand': 'lo',
                                                                     'query': q, 'limit': 15, 'offset': 0})
        out = []
        for i in _get(u).get('items', []):
            p = i.get('prices') or {}; pr = p.get('priceRegular') or p.get('costRegular') or p.get('price') or p.get('cost')  # обычная цена
            if not pr: continue
            w = i.get('weight') or {}; name = clean(i.get('name'))
            if i.get('isWeight') and w.get('gross'): sz = ('kg', w['gross'] / 1000)  # весовой: цена за gross г
            else: sz = size_from_text(w.get('package') or '') or size_from_text(name)
            out.append({'name': name, 'price': pr / 100, 'size': sz, 'url': f"https://lenta.com/product/{i.get('slug')}-{i.get('id')}/",
                        'promo': bool(p.get('isPromoactionPrice') or p.get('isLoyaltyCardPrice')),
                        'shelf_promo': (p.get('price') / 100) if p.get('price') and p.get('price') != pr else None, 'grams_hint': None})
        return out

# ---------------- подбор ----------------
def normalize(item, g, k, piece_g):
    """Цена за упаковку ингредиента (g.pack g.unit) и цена за кг/л или шт."""
    kind, v = item['size']
    if v <= 0: return None
    if g['unit'] in ('г', 'мл'):
        if kind != 'kg': return None
        per = item['price'] / v; return per * g['pack'] / 1000, round(per, 2), 'кг' if g['unit'] == 'г' else 'л'
    # шт
    if kind == 'pcs': per = item['price'] / v
    elif k == 'eggs': per = item['price'] / 10 if v < 1.0 else None   # «Яйцо С1» (≈0,55 кг) — десяток
    else: per = item['price'] / v * piece_g / 1000
    if not per: return None
    return per * g['pack'], round(per, 2), 'шт'

def pick(src, k, g, est, piece_g):
    q, must, ex = Q.get(k, (g['name'], '', ''))
    try: items = src.search(q)
    except Exception as e: return None, f'error: {e.__class__.__name__}'
    cands = []
    for it in items[:15]:
        n = it['name'].lower().replace('ё', 'е'); m2 = must.replace('ё', 'е')
        if m2 and not re.search(m2, n): continue
        if ex and re.search(ex.replace('ё', 'е'), n): continue
        if re.search(G_EX, n) and not (m2 and re.search(G_EX, m2)): continue
        if not it['size']: continue
        r = normalize(it, g, k, piece_g)
        if not r: continue
        pack_price, per, per_u = r
        if not (0.4 * est <= pack_price <= 2.5 * est): continue
        cands.append((per, pack_price, it, per_u))
    if not cands: return None, f'no match ({len(items)} results)'
    cands.sort(key=lambda c: c[0])
    per, pack_price, it, per_u = cands[0]
    return {'price': round(pack_price), 'pack_price': it['price'], 'per': per, 'per_unit': per_u, 'name': it['name'], 'url': it['url'],
            'regular': True, 'via': 'api', 'promo_now': it['promo'], 'size': f"{it['size'][1]:g} {'кг/л' if it['size'][0]=='kg' else 'шт'}"}, 'ok'

def fetch(cat, est_by_key, piece_g, log=print):
    today = datetime.date.today().isoformat(); res = {}; meta = {}
    import os
    only = [x for x in os.environ.get('SP_ONLY', '').split(',') if x]
    for cls in (VkusVill, Lenta):
        if only and cls.id not in only: continue
        try: src = cls()
        except Exception as e: log(f'{cls.name}: недоступен ({e})'); meta[cls.id] = {'ok': False, 'error': str(e)}; continue
        hit = 0
        for k, g in cat.items():
            r, why = pick(src, k, g, est_by_key[k], piece_g.get(k, g.get('w') or 100))
            if r: r['date'] = today; res.setdefault(k, {})[src.id] = r; hit += 1
            time.sleep(DELAY)
        meta[src.id] = {'ok': True, 'source': src.source, 'matched': hit, 'of': len(cat), 'pct': round(100 * hit / len(cat), 1), 'date': today}
        log(f'{src.name}: {hit}/{len(cat)}')
    return res, meta
