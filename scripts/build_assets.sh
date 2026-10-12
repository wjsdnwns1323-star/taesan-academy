#!/usr/bin/env bash
# 구글 드라이브의 원본(강사 누끼 PNG, 밴드 수업 이미지 카드)을 받아 사이트용으로 가공합니다.
# 드라이브 파일이 '링크가 있는 모든 사용자' 보기 권한이어야 받을 수 있습니다.
# 사용: bash scripts/build_assets.sh   (Cloud Shell 등 인터넷 되는 곳에서)
set -euo pipefail
cd "$(dirname "$0")/.."
RAW=.assets_raw; mkdir -p "$RAW/people" "$RAW/posters" public/images/people public/images/posters
python3 -c "import cv2, PIL" 2>/dev/null || pip3 install -q --user opencv-python-headless pillow numpy
while IFS=$'\t' read -r key id title; do
  [ -z "$key" ] && continue
  if [[ $key == P* ]]; then out="$RAW/posters/$key.jpg"; else out="$RAW/people/$key.png"; fi
  [ -s "$out" ] || curl -fsSL "https://drive.usercontent.google.com/download?id=$id&export=download&confirm=t" -o "$out"
  file -b --mime-type "$out" | grep -q image/ || { echo "실패: $key ($title) — 공유 권한 확인"; rm -f "$out"; }
done < scripts/assets.tsv
python3 scripts/align_photos.py "$RAW/people" public/images/people
python3 - <<'PY'
from pathlib import Path
from PIL import Image
for p in sorted(Path('.assets_raw/posters').glob('*.jpg')):
    im = Image.open(p).convert('RGB'); im.thumbnail((1080, 2400), Image.LANCZOS)
    im.save(f'public/images/posters/{p.name}', quality=84, optimize=True, progressive=True)
print('수업 이미지 카드', len(list(Path('public/images/posters').glob('*.jpg'))), '장')
PY
rm -f public/images/people/*.jpg
