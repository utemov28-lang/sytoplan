#!/usr/bin/env python3
"""Сводка отзывов из бота: python3 tools/feedback_report.py [/workspace/sytoplan-bot/feedback.jsonl]
Топ «не понравилось» по рецептам, причины, лайки, последние комментарии."""
import json, sys, collections, os
path = sys.argv[1] if len(sys.argv) > 1 else "/workspace/sytoplan-bot/feedback.jsonl"
idx_path = os.path.join(os.path.dirname(__file__), "..", "data", "recipe_index.json")
IDX = {i: (rid, t) for i, rid, t in json.load(open(idx_path, encoding="utf-8"))["recipes"]}
rows = [json.loads(l) for l in open(path, encoding="utf-8") if l.strip()] if os.path.exists(path) else []
types = collections.Counter(); bad = collections.Counter(); good = collections.Counter(); reasons = collections.Counter()
bad_reasons = collections.defaultdict(collections.Counter); users = set()
def title(d):
    return d.get("title") or IDX.get(d.get("idx", ""), (None, "рецепт #" + d.get("idx", "?")))[1]
for r in rows:
    d = r.get("decoded") or {}; types[d.get("type", "unknown")] += 1; users.add(r.get("chat_id"))
    if d.get("type") == "dislike":
        t = title(d); bad[t] += 1
        if d.get("reason"): reasons[d["reason"]] += 1; bad_reasons[t][d["reason"]] += 1
    elif d.get("type") == "like": good[title(d)] += 1
print(f"Отзывов: {len(rows)} от {len(users)} пользователей · " + ", ".join(f"{k}: {v}" for k, v in types.most_common()))
if bad:
    print("\nТоп «не понравилось»:")
    for t, n in bad.most_common(15): print(f"  {n:>3}  {t}  ({', '.join(f'{k} {v}' for k, v in bad_reasons[t].most_common())})")
if reasons:
    print("\nПричины:"); [print(f"  {n:>3}  {k}") for k, n in reasons.most_common()]
if good:
    print("\nТоп «понравилось»:"); [print(f"  {n:>3}  {t}") for t, n in good.most_common(10)]
texts = [r for r in rows if r.get("text")]
if texts:
    print("\nПоследние комментарии:")
    for r in texts[-10:]:
        d = r.get("decoded") or {}; what = title(d) if d.get("type") in ("like", "dislike") else d.get("type", "")
        print(f"  [{r['time'][:16]}] {what}: {r['text'][:200]}")
if not rows: print("Пока нет отзывов.")
