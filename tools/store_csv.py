#!/usr/bin/env python3
"""Цены магазинов из ежемесячных снимков → data/prices.json (Москва).

Методика (три слоя, по убыванию приоритета):
  1) «цена магазина» — цена, которую видел покупатель / отдаёт официальный открытый API сети:
       data/store_prices/p5_<YYYY-MM>.csv      — ПОЛНЫЙ снимок Пятёрочки (~133 ингредиента) — база;
       data/store_prices/basket_<YYYY-MM>.csv  — корзина из 25 сопоставимых продуктов × 8 сетей;
       (необязательно) <store>_<YYYY-MM>.csv  — полный снимок любой другой сети;
       ВкусВилл / Лента — официальные открытые API (tools/store_prices.py, поле via='api').
  2) «оценка · индекс» — для сети s и продукта k без своей цены: цена = цена базы(k) × индекс(s, категория k).
       База — Пятёрочка, если есть её снимок (≥ половины продуктов); иначе Лента (реальные цены из официального API).
       Индекс = среднее геометрическое отношений цена_s / цена_базы по продуктам, где есть обе цены
       (цены приведены к упаковке ингредиента, т.е. к одной цене за кг/л/шт); несопоставимые пары (другой сорт/разделка
       у базы — NOT_COMPARABLE) и выбросы (> OUTLIER_X от медианы сети) исключаются
       (корзина + полные снимки + API), отдельно по категориям (мясо/рыба, молочка/яйца, овощи/фрукты, бакалея);
       если в категории < 3 пар — общий индекс сети (нужно ≥ 5 пар), иначе слой 3.
  3) «оценка: Росстат × коэффициент сети» — если у базы нет цены на продукт (или нет индекса).

ПРАВИЛО ЦЕНЫ: всегда ОБЫЧНАЯ (регулярная) цена — без акций, скидок и цен по карте лояльности; если показаны
перечёркнутая старая цена и акционная — берётся старая. Колонка regular_price (price — устаревший синоним).

CSV p5/<store>: ingredient_id, query, product_name, pack_size, unit, regular_price, url, date
CSV basket:     ingredient_id, category, store, query, product_name, pack_size, unit, regular_price, url, date
  pack_size+unit — фасовка (900 г, 1 кг, 0.9 л, 10 шт); весовой товар: цена за кг → pack_size=1, unit=кг.
  Пустая цена = не найдено. Цена пересчитывается на упаковку ингредиента (js/data.js) и проверяется на
  правдоподобие (0,4…2,5 × оценки Росстата), иначе строка пропускается с предупреждением.

  python3 tools/store_csv.py --template YYYY-MM   пустые шаблоны → data/store_prices/_template/
  python3 tools/store_csv.py                      пересобрать цены магазинов в data/prices.json (без сети)
"""
import csv, glob, json, math, os, re, sys, datetime
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import store_prices as sp

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIR = os.path.join(ROOT, 'data', 'store_prices')
STORES = {'p5': 'Пятёрочка', 'magnit': 'Магнит', 'perek': 'Перекрёсток', 'lenta': 'Лента', 'auchan': 'Ашан',
          'samokat': 'Самокат', 'lavka': 'Яндекс Лавка', 'vkusvill': 'ВкусВилл'}
BASE = 'p5'
COLS = ['ingredient_id', 'query', 'product_name', 'pack_size', 'unit', 'regular_price', 'url', 'date']
BCOLS = ['ingredient_id', 'category', 'store', 'query', 'product_name', 'pack_size', 'unit', 'regular_price', 'url', 'date']
UNIT = {'г': ('kg', 1e-3), 'гр': ('kg', 1e-3), 'мл': ('kg', 1e-3), 'кг': ('kg', 1), 'л': ('kg', 1), 'шт': ('pcs', 1),
        'g': ('kg', 1e-3), 'ml': ('kg', 1e-3), 'kg': ('kg', 1), 'l': ('kg', 1), 'pcs': ('pcs', 1)}
# база индексов: первая сеть, у которой есть реальные цены минимум на половину продуктов (Пятёрочка, иначе Лента)
BASE_ORDER = ['p5', 'lenta']
# вес одной штуки (кг) для товаров «за штуку», когда ингредиент считается на вес (банан в Лавке продаётся поштучно)
PIECE_KG = {'banana': 0.18}
# выброс (не тот товар/фасовка) — в индекс не берём: отношение цена_сети/цена_базы отличается от медианы сети
# больше чем в OUTLIER_X раз или вне жёстких границ RATIO_OK
RATIO_OK = (0.33, 3.0); OUTLIER_X = 2.5
# пары, где товар базы другого сорта/разделки, чем в корзине → несопоставимы (в индекс не идут). Регулярное выражение по названию товара базы.
NOT_COMPARABLE = {'buckwheat': r'1-й сорт', 'pasta': r'группа в', 'chicken_fillet': r'с кожей', 'pork': r'на кости|на шкуре',
                  'sugar': r'5\s?кг'}
CAT_OF_AISLE = {'veg': 'produce', 'meat': 'meatfish', 'fish': 'meatfish', 'dairy': 'dairy',
                'groc': 'grocery', 'canned': 'grocery', 'bread': 'grocery', 'frozen': 'grocery', 'other': 'grocery'}
CAT_NAME = {'produce': 'овощи/фрукты', 'meatfish': 'мясо/рыба', 'dairy': 'молочка/яйца', 'grocery': 'бакалея'}
# корзина 25 сопоставимых базовых продуктов (6–7 на категорию); в query — уточнение, чтобы брать одинаковые товары во всех сетях
BASKET = [
 ('potato', 'картофель (весовой, обычный)'), ('onion', 'лук репчатый (весовой)'), ('carrot', 'морковь (весовая)'),
 ('cucumber', 'огурцы среднеплодные'), ('apple', 'яблоки (весовые, самые обычные: Гала/Голден)'), ('banana', 'бананы (весовые)'),
 ('chicken_fillet', 'филе куриной грудки охлаждённое (лоток)'), ('chicken_thigh', 'бедро куриное охлаждённое'),
 ('minced_mix', 'фарш домашний свино-говяжий'), ('pork', 'свинина лопатка без кости'), ('beef', 'говядина мякоть/лопатка без кости'),
 ('fish_white', 'филе минтая замороженное'),
 ('milk', 'молоко 2,5% (≈900 мл–1 л)'), ('kefir', 'кефир 2,5% (≈900 г–1 л)'), ('smetana', 'сметана 15% (300 г)'),
 ('tvorog', 'творог 5% (≈200 г)'), ('butter', 'масло сливочное 82,5% (≈180 г)'), ('eggs', 'яйца куриные С1, 10 шт'),
 ('buckwheat', 'гречка ядрица (≈900 г)'), ('rice', 'рис круглозёрный (≈900 г)'), ('pasta', 'макароны (рожки/перья, ≈450 г)'),
 ('flour', 'мука пшеничная высший сорт (2 кг/1 кг)'), ('sugar', 'сахар песок (1 кг)'), ('oil', 'масло подсолнечное рафинированное (≈900 мл)'),
 ('bread', 'хлеб/батон пшеничный (≈400 г)'),
]

def cat_of(g): return CAT_OF_AISLE.get(g.get('aisle'), 'grocery')

def template(period, cat):
    tdir = os.path.join(DIR, '_template'); os.makedirs(tdir, exist_ok=True)
    p = os.path.join(tdir, f'{BASE}_{period}.csv')
    with open(p, 'w', newline='', encoding='utf-8') as fh:
        w = csv.writer(fh); w.writerow(COLS)
        for k, g in cat.items(): w.writerow([k, sp.Q.get(k, (g['name'],))[0], '', '', '', '', '', ''])
    b = os.path.join(tdir, f'basket_{period}.csv')
    with open(b, 'w', newline='', encoding='utf-8') as fh:
        w = csv.writer(fh); w.writerow(BCOLS)
        for sid in STORES:
            for k, q in BASKET: w.writerow([k, CAT_NAME[cat_of(cat[k])], sid, q, '', '', '', '', '', ''])
    print('шаблоны:', p, b)

def _latest(pattern):
    fs = sorted(glob.glob(os.path.join(DIR, pattern)))
    return fs[-1] if fs else None

def _row_price(row, k, g, est, piece_g, tag, log):
    try:
        price = float((row.get('regular_price') or row.get('price') or '').replace(',', '.').replace('₽', '').replace(' ', ''))
        size = float((row.get('pack_size') or '').replace(',', '.'))
    except ValueError: return None
    u = UNIT.get((row.get('unit') or '').strip().lower())
    if not u or price <= 0 or size <= 0: return None
    if u[0] == 'pcs' and g.get('unit') in ('г', 'мл') and k in PIECE_KG: u = ('kg', PIECE_KG[k])   # штука → кг
    r = sp.normalize({'price': price, 'size': (u[0], size * u[1])}, g, k, piece_g.get(k, g.get('w') or 100))
    if not r or not (0.4 * est <= r[0] <= 2.5 * est):
        log(f'  {tag}/{k}: пропуск (неправдоподобно или не та единица): {row.get("product_name")} {price} ₽ за {size:g} {row.get("unit")}'); return None
    return {'price': round(r[0]), 'pack_price': price, 'per': r[1], 'per_unit': r[2], 'name': (row.get('product_name') or '').strip(),
            'url': (row.get('url') or '').strip(), 'regular': True, 'size': f"{size:g} {row.get('unit').strip()}",
            'date': (row.get('date') or '').strip()}

def build(res, cat, piece_g, coef, log=print):
    keys = [k for k in cat if k in res]
    # слой 3 по умолчанию + очистка прошлых снимков/индексов (API-цены сохраняем)
    for k in keys:
        rec = res[k]
        for s, c in coef.items(): rec[s] = int(round(rec['base'] * c))
        rec['real'] = {s: v for s, v in (rec.get('real') or {}).items() if v.get('via', 'api') == 'api'}
        rec['est'] = {}
    files = []
    # слой 1: полные снимки (p5 обязателен для индексов; другие сети — по желанию)
    for sid in STORES:
        f = _latest(f'{sid}_????-??.csv')
        if not f: continue
        period = re.search(r'(\d{4}-\d\d)', f).group(1); n = 0; files.append(os.path.basename(f))
        for row in csv.DictReader(open(f, encoding='utf-8-sig')):
            k = (row.get('ingredient_id') or '').strip()
            if k not in keys: continue
            r = _row_price(row, k, cat[k], res[k]['base'], piece_g, sid, log)
            if r: r['date'] = r['date'] or period + '-01'; r['via'] = 'snapshot'; res[k]['real'][sid] = r; n += 1
        log(f'{STORES[sid]}: полный снимок {period}: {n}')
    bf = sorted(glob.glob(os.path.join(DIR, 'basket_????-??*.csv')))
    if bf:
        period = max(re.search(r'basket_(\d{4}-\d\d)', x).group(1) for x in bf)
        for f in [x for x in bf if os.path.basename(x).startswith('basket_' + period)]:
            n = 0; files.append(os.path.basename(f))
            for row in csv.DictReader(open(f, encoding='utf-8-sig')):
                k = (row.get('ingredient_id') or '').strip(); sid = (row.get('store') or '').strip()
                if k not in keys or sid not in STORES: continue
                if (res[k]['real'].get(sid) or {}).get('via') == 'snapshot': continue    # полный снимок того же месяца важнее
                r = _row_price(row, k, cat[k], res[k]['base'], piece_g, 'basket/' + sid, log)
                if r: r['date'] = r['date'] or period + '-01'; r['via'] = 'basket'; res[k]['real'][sid] = r; n += 1
            log(f'Корзина {os.path.basename(f)}: {n} цен')
    for k in keys:
        for sid, r in res[k]['real'].items(): res[k][sid] = r['price']
    # слой 2: индексы к базе (Пятёрочка; если её снимка нет — Лента с ценами из официального API)
    base = next((b for b in BASE_ORDER if sum(1 for k in keys if b in res[k]['real']) >= len(keys) / 2), None)
    log(f'База индексов: {STORES.get(base, "нет")}')
    idx = {}; tag = f'{base}-index'
    gm = lambda v: math.exp(sum(math.log(x) for x in v) / len(v))
    for sid in STORES:
        if sid == base or not base: continue
        pairs, outl, raw = {}, [], []
        for k in keys:
            a, b = res[k]['real'].get(base), res[k]['real'].get(sid)
            if not (a and b): continue
            if k in NOT_COMPARABLE and re.search(NOT_COMPARABLE[k], a.get('name', '').lower()): outl.append(f'{k} (другой сорт у базы)'); continue
            raw.append((k, b['price'] / a['price']))
        med = sorted(x for _, x in raw)[len(raw) // 2] if raw else 1
        for k, ratio in raw:
            if not (RATIO_OK[0] <= ratio <= RATIO_OK[1]) or not (med / OUTLIER_X <= ratio <= med * OUTLIER_X):
                outl.append(f'{k} {ratio:.2f}'); continue
            pairs.setdefault(cat_of(cat[k]), []).append(ratio)
        if outl: log(f'  {STORES[sid]}: выбросы vs {STORES[base]} (не в индексе): ' + ', '.join(outl))
        allr = [x for v in pairs.values() for x in v]
        overall = gm(allr) if len(allr) >= 5 else None
        by = {c: round(gm(v), 3) for c, v in pairs.items() if len(v) >= 3}
        idx[sid] = {'base': base, 'overall': round(overall, 3) if overall else None, 'by_cat': by, 'pairs': len(allr),
                    'pairs_by_cat': {c: len(v) for c, v in pairs.items()}, 'outliers': outl}
        if not overall and not by: continue
        skipped = []
        for k in keys:
            if sid in res[k]['real'] or base not in res[k]['real']: continue
            i = by.get(cat_of(cat[k])) or overall
            if not i: continue
            v = res[k]['real'][base]['price'] * i
            if not (0.4 * res[k]['base'] <= v <= 2.5 * res[k]['base']):     # та же проверка правдоподобия, что для снимков
                skipped.append(f'{k} {round(v)}'); continue
            res[k][sid] = int(round(v)); res[k]['est'][sid] = tag
        if skipped: log(f'  {STORES[sid]}: оценка по индексу неправдоподобна (> 2,5× / < 0,4× Росстата) → Росстат×коэф.: ' + ', '.join(skipped))
    # метаданные
    n = len(keys); stores = {}
    for sid in STORES:
        real = [res[k]['real'][sid] for k in keys if sid in res[k]['real']]
        derived = sum(1 for k in keys if (res[k]['est'].get(sid) or '').endswith('-index'))
        vias = sorted({r.get('via', 'api') for r in real})
        stores[sid] = {'ok': bool(real), 'matched': len(real), 'derived': derived, 'of': n,
                       'pct': round(100 * len(real) / n, 1), 'pct_with_index': round(100 * (len(real) + derived) / n, 1),
                       'date': max([r['date'] for r in real] or ['']), 'via': vias, 'index': idx.get(sid)}
    m = res['_meta']
    for sid, v in stores.items():
        old = (m.get('stores') or {}).get(sid) or {}
        if old.get('source') and 'api' in v['via']: v['source'] = old['source']
    m['stores'] = stores; m['snapshot_files'] = files; m['index_base'] = base
    m['method'] = (f'цена магазина (снимок/корзина/официальный API) → {STORES.get(base, "база")} × индекс сети по категории (корзина 25 продуктов) '
                   '→ Росстат × коэффициент сети; всегда обычная цена без акций и карт лояльности')
    cv = m.setdefault('coverage', {})
    cv['store_pct'] = {s: v['pct'] for s, v in stores.items()}
    cv['store_pct_with_index'] = {s: v['pct_with_index'] for s, v in stores.items()}
    cv['store_direct_pct'] = round(sum(v['matched'] for v in stores.values()) / (n * len(STORES)) * 100, 1)
    for sid in STORES:
        log(f"{STORES[sid]}: цена магазина {stores[sid]['matched']}/{n}, по индексу {stores[sid]['derived']}, индекс {idx.get(sid, {}).get('overall')}")
    return stores

def main():
    import update_prices as up
    cat = up.catalog()
    if '--template' in sys.argv: return template(sys.argv[sys.argv.index('--template') + 1], cat)
    p = os.path.join(ROOT, 'data', 'prices.json'); res = json.load(open(p, encoding='utf-8'))
    build(res, cat, up.PIECE_G, res['_meta'].get('store_coef') or up.STORE_COEF)
    json.dump(res, open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

if __name__ == '__main__':
    main()
