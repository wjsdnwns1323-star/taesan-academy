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
MODEL = Path.home() / '.cache/realesrgan/Real-ESRGAN-x4plus.onnx'
URL = 'https://huggingface.co/qualcomm/Real-ESRGAN-x4plus/resolve/main/Real-ESRGAN-x4plus.onnx'
W, H, TOP = 600, 800, 118
# 원본(assets/cutouts, 600x800) 기준: 얼굴 중심 x, 머리 꼭대기 y, 배율 — 다른 선생님과 머리 크기를 맞춘 값
PEOPLE = {'jeong-jeongrae': (295, 120, 1.42), 'kim-hyun': (298, 135, 1.24), 'park-hanbit': (285, 130, 1.02)}


def model():
    if not MODEL.exists():
        MODEL.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run(['curl', '-sSL', '-o', str(MODEL), URL], check=True)
    import onnxruntime as ort
    return ort.InferenceSession(str(MODEL), providers=['CPUExecutionProvider'])


def upscale(sess, rgb):
    """타일로 나눠 4배 확대(모델 입력 크기가 고정이라 겹치게 잘라 붙임)."""
    inp = sess.get_inputs()[0]
    shp = inp.shape
    T = shp[2] if isinstance(shp[2], int) else 256
    nhwc = shp[-1] == 3
    pad = 12
    h, w = rgb.shape[:2]
    out = np.zeros((h * 4, w * 4, 3), np.float32)
    step = T - pad * 2
    for y in range(0, h, step):
        for x in range(0, w, step):
            y0, x0 = max(0, y - pad), max(0, x - pad)
            tile = np.zeros((T, T, 3), np.float32)
            crop = rgb[y0:y0 + T, x0:x0 + T]
            tile[:crop.shape[0], :crop.shape[1]] = crop
            t = tile[None] if nhwc else tile.transpose(2, 0, 1)[None]
            r = sess.run(None, {inp.name: t})[0][0]
            r = r if nhwc else r.transpose(1, 2, 0)
            oy, ox = (y - y0) * 4, (x - x0) * 4
            hh, ww = min(step, h - y) * 4, min(step, w - x) * 4
            out[y * 4:y * 4 + hh, x * 4:x * 4 + ww] = r[oy:oy + hh, ox:ox + ww]
        print('.', end='', flush=True)
    return np.clip(out, 0, 1)


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
        src = Image.open(ROOT / f'assets/cutouts/{pid}.png').convert('RGBA')
        rgb = np.asarray(src.convert('RGB'), np.float32) / 255
        print(pid, end=' ', flush=True)
        up = (upscale(sess, rgb) * 255).round().astype(np.uint8)
        big = Image.fromarray(up).convert('RGBA')
        big.putalpha(src.split()[3].resize(big.size, Image.LANCZOS))
        s4 = s / 4
        im = big.resize((round(big.width * s4), round(big.height * s4)), Image.LANCZOS)
        c = Image.new('RGBA', (W, H))
        c.paste(im, (round(W / 2 - cx * s), round(TOP - top * s)), im)
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
