"""강사 누끼 사진을 같은 크기·같은 얼굴 높이로 맞춥니다.

사용법: python3 scripts/align_photos.py <원본폴더> <출력폴더>
- 원본: 배경이 투명한 PNG(파일명 = 강사 id, 예: kim-taehyun.png)
- 결과: 600x800 투명 PNG. 얼굴 높이 200px, 얼굴 윗부분이 위에서 150px, 가로 중앙.
"""
import sys
from pathlib import Path

from PIL import Image

W, H = 600, 800
FACE_H = 200      # 얼굴(이마~턱) 높이
FACE_TOP = 150    # 캔버스 위에서 얼굴 윗부분까지

try:  # opencv-python-headless 4.x (Haar 얼굴 인식). 없으면 윤곽선 방식만 사용
    import cv2
    import numpy as np
    CASCADE = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
    if CASCADE.empty():
        raise RuntimeError('cascade')
except Exception:
    cv2 = None


def detect_face(img):
    """(x, y, w, h) 얼굴 상자. 못 찾으면 None."""
    if cv2 is None:
        return None
    bg = Image.new('RGB', img.size, (255, 255, 255))
    bg.paste(img, mask=img.split()[3])
    gray = cv2.cvtColor(np.array(bg), cv2.COLOR_RGB2GRAY)
    min_side = max(40, img.width // 10)
    faces = CASCADE.detectMultiScale(gray, scaleFactor=1.08, minNeighbors=6, minSize=(min_side, min_side))
    if len(faces) == 0:
        return None
    # 위쪽 절반에 있는 가장 큰 얼굴
    faces = [f for f in faces if f[1] < img.height * 0.6] or list(faces)
    x, y, w, h = (int(v) for v in max(faces, key=lambda f: f[2] * f[3]))
    # Haar 상자는 눈썹~입 아래 정도라서 이마~턱으로 넓힙니다
    return (x, int(y - h * 0.12), w, int(h * 1.22))


def head_by_outline(img):
    """얼굴을 못 찾았을 때: 머리 윗부분과 목(가장 좁은 곳)으로 얼굴 상자를 추정."""
    a = img.split()[3]
    w, h = img.size
    px = a.load()
    rows = []
    for y in range(h):
        xs = [x for x in range(0, w, 2) if px[x, y] > 40]
        rows.append((min(xs), max(xs)) if xs else None)
    top = next(y for y, r in enumerate(rows) if r and r[1] - r[0] > w * 0.04)
    widths = [(r[1] - r[0]) if r else 0 for r in rows]
    # 머리 가장 넓은 곳 이후 처음 좁아지는 곳 = 목
    head_zone = range(top, min(h, top + int(h * 0.45)))
    widest = max(head_zone, key=lambda y: widths[y])
    neck = min(range(widest, min(h, widest + int(h * 0.3))), key=lambda y: widths[y] or 10**9)
    hair = int((neck - top) * 0.18)
    fy = top + hair
    fh = max(1, neck - fy)
    l, r = rows[widest]
    cx = (l + r) // 2
    return (cx - fh // 2, fy, fh, fh)


def sane(face, img):
    if not face:
        return None
    fx, fy, fw, fh = face
    return face if img.height * 0.06 <= fh <= img.height * 0.7 and fw > 0 else None


def align(src: Path, dst: Path):
    img = Image.open(src).convert('RGBA')
    # 큰 원본은 먼저 줄여서 처리(메모리·속도)
    if max(img.size) > 1600:
        img.thumbnail((1600, 1600), Image.LANCZOS)
    bbox = img.split()[3].getbbox()
    img = img.crop(bbox)
    found = sane(detect_face(img), img)
    face = found
    if not face:
        try:
            face = sane(head_by_outline(img), img)
        except Exception:
            face = None
    if not face:  # 최후: 위쪽 30%를 얼굴로 가정
        fh = int(img.height * 0.28)
        face = (img.width // 2 - fh // 2, int(img.height * 0.06), fh, fh)
    fx, fy, fw, fh = face
    s = FACE_H / fh
    img = img.resize((max(1, round(img.width * s)), max(1, round(img.height * s))), Image.LANCZOS)
    cx, top = (fx + fw / 2) * s, fy * s
    canvas = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    canvas.paste(img, (round(W / 2 - cx), round(FACE_TOP - top)), img)
    canvas.save(dst, optimize=True)
    return '얼굴 인식' if found else '윤곽 추정'


def main():
    src_dir, out_dir = Path(sys.argv[1]), Path(sys.argv[2])
    out_dir.mkdir(parents=True, exist_ok=True)
    for p in sorted(src_dir.glob('*.png')):
        how = align(p, out_dir / p.name)
        print(f'{p.name}: 정렬 완료 ({how})')


if __name__ == '__main__':
    main()
