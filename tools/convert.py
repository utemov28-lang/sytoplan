#!/usr/bin/env python3
"""Конвертирует сгенерированные картинки из tools/imgmap.txt в WebP и пишет js/images.js"""
import os, sys
from PIL import Image
ASSETS='/cursor/stores/store-cf6e280a-e9a5-41e7-9f80-8806c854820e/grok-bot/agents/26e409a9-13b5-4d59-a7a6-33095b0b6d18/assets/'
root=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.makedirs(root+'/img/r/s',exist_ok=True); os.makedirs(root+'/img/i',exist_ok=True)
m={}
for line in open(root+'/tools/imgmap.txt'):
    p=line.split()
    if len(p)==2: m[p[0]]=p[1]
R,I=[],[]
for name,h in m.items():
    src=ASSETS+h
    if not os.path.exists(src): print('MISSING',name,h); continue
    im=Image.open(src).convert('RGB')
    if name.startswith('r_'):
        rid=name[2:]; R.append(rid)
        out=root+f'/img/r/{rid}.webp'; outs=root+f'/img/r/s/{rid}.webp'
        if os.path.exists(out) and os.path.getmtime(out)>os.path.getmtime(src) and os.path.exists(outs): continue
        w,h2=im.size; t=4/3
        if w/h2>t: nw=int(h2*t); im=im.crop(((w-nw)//2,0,(w-nw)//2+nw,h2))
        elif w/h2<t: nh=int(w/t); im=im.crop((0,(h2-nh)//2,w,(h2-nh)//2+nh))
        im.resize((800,600),Image.LANCZOS).save(out,'WEBP',quality=70,method=6)
        im.resize((320,240),Image.LANCZOS).save(outs,'WEBP',quality=68,method=6)
    else:
        I.append(name); out=root+f'/img/i/{name}.webp'
        if os.path.exists(out) and os.path.getmtime(out)>os.path.getmtime(src): continue
        size=640 if name in ('hero','loading','empty') else 256
        w,h2=im.size; s=min(w,h2); im=im.crop(((w-s)//2,(h2-s)//2,(w-s)//2+s,(h2-s)//2+s))
        im.resize((size,size),Image.LANCZOS).save(out,'WEBP',quality=74,method=6)
R.sort(); I.sort()
with open(root+'/js/images.js','w') as f:
    f.write('// Сгенерировано tools/convert.py — список готовых картинок\n')
    f.write('const IMG_R='+repr(R).replace("'",'"')+';\n')
    f.write('const IMG_I='+repr(I).replace("'",'"')+';\n')
print('recipes',len(R),'illustrations',len(I))
