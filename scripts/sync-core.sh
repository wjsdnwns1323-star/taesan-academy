#!/usr/bin/env bash
# 서버 규칙(aws/api/core.mjs)을 체험 모드용 화면 파일(public/js/server-core.js)로 복사합니다.
# --check 를 붙이면 두 파일이 같은지만 확인합니다.
set -euo pipefail
cd "$(dirname "$0")/.."
SRC=aws/api/core.mjs DST=public/js/server-core.js
if [ "${1:-}" = "--check" ]; then
  cmp -s "$SRC" "$DST" && echo "같음" || { echo "다름: scripts/sync-core.sh 를 실행하세요" >&2; exit 1; }
else
  cp "$SRC" "$DST" && echo "복사함: $DST"
fi
