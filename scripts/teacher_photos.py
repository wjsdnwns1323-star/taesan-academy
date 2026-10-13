"""드라이브 '02_강사이미지' 폴더의 선생님 사진 → 누끼(배경 제거) → 얼굴 높이 맞춤 → public/images/people/<id>.png

Cloud Shell에서:
  python3 scripts/teacher_photos.py sheet          # 사진 모두 받기 + 한눈에 보기(~/photos/sheet.jpg)
  python3 scripts/teacher_photos.py make 김태현T.png=kim-taehyun 김도현T new.jpg=kim-doheon ...
"""
import json, subprocess, sys, unicodedata
from pathlib import Path

FOLDER = '1sQdh6t8l1EdP950UBFCafgoEHu8d3ayj'
RAW = Path.home() / 'photos'
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'public/images/people'
TOKEN = subprocess.check_output(['gcloud', 'auth', 'print-access-token'], text=True).strip()
H = ['-H', f'Authorization: Bearer {TOKEN}', '-H', 'x-goog-user-project: taesan-academy']


def files():
    q = f"'{FOLDER}' in parents and trashed=false"
    out = subprocess.check_output(['curl', '-sS', '-G', 'https://www.googleapis.com/drive/v3/files', *H,
                                   '--data-urlencode', f'q={q}', '--data-urlencode', 'fields=files(id,name,size)',
                                   '--data-urlencode', 'pageSize=200'], text=True)
    return json.loads(out)['files']


def download():
    RAW.mkdir(exist_ok=True)
    fs = files()
    for f in fs:
        name = unicodedata.normalize('NFC', f['name'])
        p = RAW / name
        if not p.exists() or p.stat().st_size != int(f.get('size', 0)):
            subprocess.run(['curl', '-sS', '-o', str(p), *H, f"https://www.googleapis.com/drive/v3/files/{f['id']}?alt=media"], check=True)
    return sorted(unicodedata.normalize('NFC', f['name']) for f in fs)


def sheet():
    from PIL import Image, ImageDraw, ImageFont, ImageOps
    names = download()
    tw, th, cols = 300, 400, 6
    rows = (len(names) + cols - 1) // cols
    S = Image.new('RGB', (cols * tw, rows * (th + 34)), 'white')
    try:
        font = ImageFont.truetype('/usr/share/fonts/truetype/nanum/NanumGothicBold.ttf', 20)
    except Exception:
        font = ImageFont.load_default()
    d = ImageDraw.Draw(S)
    for i, n in enumerate(names):
        im = ImageOps.exif_transpose(Image.open(RAW / n)).convert('RGBA')
        bg = Image.new('RGBA', im.size, (230, 230, 230, 255)); bg.alpha_composite(im)
        im = bg.convert('RGB'); im.thumbnail((tw - 10, th - 10))
        x, y = (i % cols) * tw, (i // cols) * (th + 34)
        S.paste(im, (x + (tw - im.width) // 2, y + 4))
        d.text((x + 6, y + th + 6), f'{i + 1}. {n}', fill='black', font=font)
    S.save(RAW / 'sheet.jpg', quality=80)
    print('\n'.join(f'{i + 1}. {n}' for i, n in enumerate(names)))
    print('→', RAW / 'sheet.jpg')


def make(pairs):
    from rembg import remove, new_session
    from PIL import Image, ImageOps
    import os
    sess = new_session(os.environ.get('REMBG_MODEL', 'isnet-general-use'))
    tmp = RAW / 'cut'; tmp.mkdir(exist_ok=True)
    for pair in pairs:
        src, pid = pair.rsplit('=', 1)
        im = ImageOps.exif_transpose(Image.open(RAW / src)).convert('RGB')
        im.thumbnail((1200, 1200))
        print('처리 중', src, flush=True)
        cut = remove(im, session=sess, alpha_matting=False, post_process_mask=True)
        cut.save(tmp / f'{pid}.png')
        print('누끼', src, '→', pid)
    subprocess.run([sys.executable, str(ROOT / 'scripts/align_photos.py'), str(tmp), str(OUT)], check=True)


if __name__ == '__main__':
    if sys.argv[1] == 'sheet':
        sheet()
    else:
        make(sys.argv[2:])
