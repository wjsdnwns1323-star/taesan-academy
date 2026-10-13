"""선생님 누끼 사진(600x800)에서 머리 위치를 찾아, 동그란 프로필용 정사각형 사진(<id>-face.webp)을 만듭니다.
얼굴이 가운데, 어깨가 좌우 대칭으로 보이도록 머리 중심을 기준으로 자릅니다.
사용: python3 scripts/face_crops.py public/images/people
"""
import sys
from pathlib import Path

import numpy as np
from PIL import Image


def head_center(a):
    rows = np.where((a > 128).sum(axis=1) > 3)[0]
    top = int(rows[0])
    # 머리 꼭대기에서 아래로 내려가며, 머리가 이어진 부분(팔·손은 제외)의 가운데를 따라감
    cx = None
    xs = []
    for y in range(top + 5, min(a.shape[0], top + 170)):
        on = np.where(a[y] > 128)[0]
        if not len(on):
            continue
        runs = np.split(on, np.where(np.diff(on) > 1)[0] + 1)
        if cx is None:
            run = max(runs, key=len)
        else:
            run = min(runs, key=lambda r: abs((r[0] + r[-1]) / 2 - cx))
        mid = (run[0] + run[-1]) / 2
        cx = mid if cx is None else cx * 0.8 + mid * 0.2
        if y > top + 60:
            xs.append(mid)
    return top, float(np.median(xs)) if xs else a.shape[1] / 2


def crop(src, dst, size=240):
    im = Image.open(src).convert('RGBA')
    a = np.asarray(im)[:, :, 3]
    top, cx = head_center(a)
    side = 430                      # 머리 + 어깨가 보이는 크기(600x800 기준)
    y0 = top - 35
    box = (round(cx - side / 2), y0, round(cx + side / 2), y0 + side)
    sq = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    sq.paste(im.crop(box), (0, 0))
    sq.resize((size, size), Image.LANCZOS).save(dst, 'WEBP', quality=86, method=6)


if __name__ == '__main__':
    d = Path(sys.argv[1])
    out = Path(sys.argv[2]) if len(sys.argv) > 2 else d
    for p in sorted(d.glob('*.png')):
        crop(p, out / f'{p.stem}-face.webp')
        print('프로필', p.stem)
