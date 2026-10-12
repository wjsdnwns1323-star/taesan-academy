#!/usr/bin/env bash
# 구글 드라이브의 원본(강사 누끼 PNG, 밴드 수업 이미지 카드)을 받아 사이트용으로 가공합니다.
# 드라이브 권한이 있는 gcloud 로그인이 필요합니다(한 번만):
#   gcloud auth login --enable-gdrive-access --update-adc
# 사용: bash scripts/build_assets.sh   (Cloud Shell 등 인터넷 되는 곳에서)
set -euo pipefail
cd "$(dirname "$0")/.."
RAW=.assets_raw; mkdir -p "$RAW/people" "$RAW/posters" public/images/people public/images/posters
python3 -c "import cv2; cv2.CascadeClassifier" 2>/dev/null || pip3 install -q --user 'opencv-python-headless<5' pillow numpy
TOKEN=$(gcloud auth print-access-token)
while IFS=$'\t' read -r key id title; do
  [ -z "$key" ] && continue
  if [[ $key == P* ]]; then out="$RAW/posters/$key.jpg"; else out="$RAW/people/$key.png"; fi
  [ -s "$out" ] || curl -fsSL -H "x-goog-user-project: taesan-academy" -H "Authorization: Bearer $TOKEN" "https://www.googleapis.com/drive/v3/files/$id?alt=media" -o "$out" || true
  file -b --mime-type "$out" 2>/dev/null | grep -q image/ || { echo "실패: $key ($title) — 드라이브 권한 확인"; rm -f "$out"; }
done < scripts/assets.tsv
python3 scripts/align_photos.py "$RAW/people" public/images/people
python3 - <<'PY'
from pathlib import Path
from PIL import Image
for p in sorted(Path('.assets_raw/posters').glob('*.jpg')):
    im = Image.open(p).convert('RGB'); im.thumbnail((1600, 4000), Image.LANCZOS)
    im.save(f'public/images/posters/{p.name}', quality=90, optimize=True, progressive=True)
print('수업 이미지 카드', len(list(Path('public/images/posters').glob('*.jpg'))), '장')
PY
rm -f public/images/people/*.jpg

# 밴드 강좌 소개 원본 이미지(고화질) — scripts/band_images.tsv
mkdir -p public/images/band
while IFS=$'\t' read -r pid n path out; do
  [ -z "$pid" ] && continue
  [ -s "public/$out" ] || curl -fsSL "https://coresos-phinf.pstatic.net/$path" -o "public/$out" || echo "실패: $pid-$n"
done < scripts/band_images.tsv
echo "밴드 이미지 $(ls public/images/band | wc -l)장"
# 목록용 작은 이미지(가로 640px JPG)
python3 - <<'PY'
from pathlib import Path
from PIL import Image
out = Path('public/images/band/t'); out.mkdir(parents=True, exist_ok=True)
for p in Path('public/images/band').glob('*.*'):
    if p.is_file():
        im = Image.open(p).convert('RGB'); im.thumbnail((640, 640), Image.LANCZOS)
        im.save(out / (p.stem + '.jpg'), quality=82, optimize=True, progressive=True)
print('밴드 썸네일', len(list(out.glob('*.jpg'))), '장')
PY
