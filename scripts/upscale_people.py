"""화질이 낮은 선생님 누끼 사진을 AI 초해상도(Real-ESRGAN x4)로 4배 키운 뒤, 카드 규격(600x800)에 맞춰 배치합니다.
얼굴을 새로 그리지 않고 원래 사진의 디테일만 선명하게 복원합니다.

Cloud Shell에서: python3 scripts/upscale_people.py   → public/images/people/<id>.png
"""
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
MODEL = Path.home() / '.cache/sr/EDSR_x4.pb'
URL = 'https://raw.githubusercontent.com/Saafke/EDSR_Tensorflow/master/models/EDSR_x4.pb'
W, H, TOP = 600, 800, 118
# 원본(assets/cutouts, 600x800) 기준: 얼굴 중심 x, 머리 꼭대기 y, 배율 — 다른 선생님과 머리 크기를 맞춘 값
PEOPLE = {'jeong-jeongrae': (295, 120, 1.42), 'kim-hyun': (298, 135, 1.24), 'park-hanbit': (285, 130, 1.02)}


def model():
    """EDSR x4(공개 초해상도 모델) — opencv-contrib의 dnn_superres로 실행."""
    if not MODEL.exists() or MODEL.stat().st_size < 1_000_000:
        MODEL.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(['curl', '-sSL', '-o', str(MODEL), URL], check=True)
    import cv2
    sr = cv2.dnn_superres.DnnSuperResImpl_create()
    sr.readModel(str(MODEL)); sr.setModel('edsr', 4)
    return sr


def upscale(sr, rgb):
    """4배 확대(메모리 때문에 겹치게 잘라서 처리)."""
    import cv2
    bgr = (rgb[:, :, ::-1] * 255).astype(np.uint8)
    h, w = bgr.shape[:2]
    T, pad = 160, 10
    out = np.zeros((h * 4, w * 4, 3), np.uint8)
    for y in range(0, h, T):
        for x in range(0, w, T):
            y0, x0 = max(0, y - pad), max(0, x - pad)
            tile = bgr[y0:min(h, y + T + pad), x0:min(w, x + T + pad)]
            r = sr.upsample(tile)
            oy, ox = (y - y0) * 4, (x - x0) * 4
            hh, ww = min(T, h - y) * 4, min(T, w - x) * 4
            out[y * 4:y * 4 + hh, x * 4:x * 4 + ww] = r[oy:oy + hh, ox:ox + ww]
        print('.', end='', flush=True)
    return out[:, :, ::-1].astype(np.float32) / 255


def fill_bottom(c):
    bb = c.split()[3].point(lambda v: 255 if v > 40 else 0).getbbox()
    if not bb or bb[3] >= H - 2:
        return c
    top, bottom = bb[1], bb[3]
    k = (H - top) / (bottom - top)
    big = c.resize((round(W * k), round(H * k)), Image.LANCZOS)
    cx = (bb[0] + bb[2]) / 2
    out = Image.new('RGBA', (W, H))
    out.paste(big, (round(cx - cx * k), round(top - top * k)), big)
    return out


def main():
    sess = model()
    for pid, (cx, top, s) in PEOPLE.items():
        full = Image.open(ROOT / f'assets/cutouts/{pid}.png').convert('RGBA')
        bx = full.split()[3].getbbox()          # 투명한 빈 곳은 빼고 사람 부분만 확대(속도)
        src = full.crop(bx)
        rgb = np.asarray(src.convert('RGB'), np.float32) / 255
        print(pid, src.size, end=' ', flush=True)
        up = (upscale(sess, rgb) * 255).round().astype(np.uint8)
        big = Image.fromarray(up).convert('RGBA')
        big.putalpha(src.split()[3].resize(big.size, Image.LANCZOS))
        s4 = s / 4
        im = big.resize((round(big.width * s4), round(big.height * s4)), Image.LANCZOS)
        c = Image.new('RGBA', (W, H))
        c.paste(im, (round(W / 2 - (cx - bx[0]) * s), round(TOP - (top - bx[1]) * s)), im)
        c = fill_bottom(c)
        px, e = c.load(), 48
        for x in list(range(e)) + list(range(W - e, W)):
            k = (x if x < e else W - 1 - x) / e
            for y in range(H):
                r, g, b, a = px[x, y]
                if a:
                    px[x, y] = (r, g, b, int(a * k))
        c.save(ROOT / f'public/images/people/{pid}.png', optimize=True)
        c.save(ROOT / f'assets/people/{pid}.png', optimize=True)
        print(' 완료')


if __name__ == '__main__':
    sys.exit(main())
