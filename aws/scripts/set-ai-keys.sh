#!/usr/bin/env bash
# 매주 광고 초안(밴드 글 → AI)에 쓰는 키를 넣습니다. CloudShell에서 실행하세요.
#   bash aws/scripts/set-ai-keys.sh        키 넣고 바로 초안 한 번 만들기
#   bash aws/scripts/set-ai-keys.sh run    키는 그대로 두고 초안만 다시 만들기
# 키는 화면에 보이지 않게 입력받아 SSM 파라미터(암호화)에만 저장합니다.
set -euo pipefail
STACK=${STACK:-taesan}
export AWS_REGION=${AWS_REGION:-ap-northeast-2} AWS_DEFAULT_REGION=${AWS_REGION:-ap-northeast-2}
put() { aws ssm put-parameter --name "$1" --type SecureString --overwrite --value "$2" >/dev/null; }

if [ "${1:-}" != "run" ]; then
  read -rsp "밴드 Access Token(developers.band.us → 내 서비스): " BAND; echo
  # 토큰으로 가입한 밴드 목록을 받아 태산학원 밴드를 고릅니다
  BANDS=$(curl -fsS "https://openapi.band.us/v2.1/bands?access_token=$BAND")
  echo "$BANDS" | python3 -c 'import json,sys; [print("  %d) %s" % (i, b["name"])) for i, b in enumerate(json.load(sys.stdin)["result_data"]["bands"])]'
  read -rp "태산학원 밴드 번호: " N; [[ "$N" =~ ^[0-9]+$ ]] || { echo "번호를 숫자로 적어 주세요."; exit 1; }
  KEY=$(echo "$BANDS" | python3 -c "import json,sys; print(json.load(sys.stdin)['result_data']['bands'][$N]['band_key'])")
  read -rsp "Claude API 키(console.anthropic.com → API Keys): " AI; echo
  put /taesan/band-token "$BAND"; put /taesan/band-key "$KEY"; put /taesan/anthropic-key "$AI"
  echo "✔ 키 저장"
fi

FN=$(aws cloudformation describe-stack-resource --stack-name "$STACK" --logical-resource-id ApiFunction --query StackResourceDetail.PhysicalResourceId --output text)
OUT=$(mktemp)
aws lambda invoke --function-name "$FN" --cli-binary-format raw-in-base64-out --payload '{"job":"ads-draft"}' "$OUT" >/dev/null
echo "결과: $(cat "$OUT")"; rm -f "$OUT"
echo "관리자 → 광고 칸에서 'AI 초안 불러오기'로 확인하세요. 이후로는 매주 월요일 오전 9시에 새 초안이 만들어집니다."
