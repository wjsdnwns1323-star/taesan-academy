#!/usr/bin/env bash
# 관리자 계정을 만들거나(없으면) 이미 가입한 회원을 관리자로 바꿉니다. CloudShell에서 실행하세요.
#   bash aws/scripts/create-admin.sh qwer
# 비밀번호는 화면에 보이지 않게 입력받으며 어디에도 저장하지 않습니다.
set -euo pipefail
NAME=${1:?아이디를 적어 주세요. 예) bash aws/scripts/create-admin.sh qwer}
NAME=$(echo "$NAME" | tr 'A-Z' 'a-z')
STACK=${STACK:-taesan}
export AWS_REGION=${AWS_REGION:-ap-northeast-2} AWS_DEFAULT_REGION=${AWS_REGION:-ap-northeast-2}
out() { aws cloudformation describe-stacks --stack-name "$STACK" --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" --output text; }
POOL=$(out UserPoolId); TABLE=$(out TableName)

if aws cognito-idp admin-get-user --user-pool-id "$POOL" --username "$NAME" >/dev/null 2>&1; then
  echo "이미 있는 계정입니다. 관리자로 바꿉니다."
else
  read -r -s -p "새 관리자 비밀번호(8자 이상): " PW; echo
  read -r -p "관리자 휴대폰 번호(예 010-1234-5678): " PHONE
  E164="+82$(echo "$PHONE" | tr -cd '0-9' | sed 's/^0//')"
  aws cognito-idp admin-create-user --user-pool-id "$POOL" --username "$NAME" --message-action SUPPRESS \
    --user-attributes Name=phone_number,Value="$E164" Name=phone_number_verified,Value=true >/dev/null
  aws cognito-idp admin-set-user-password --user-pool-id "$POOL" --username "$NAME" --password "$PW" --permanent
  unset PW
fi
SUB=$(aws cognito-idp admin-get-user --user-pool-id "$POOL" --username "$NAME" --query "UserAttributes[?Name=='sub'].Value" --output text)
NOW=$(($(date +%s) * 1000))
HAS=$(aws dynamodb get-item --table-name "$TABLE" --key "{\"pk\":{\"S\":\"U#$SUB\"},\"sk\":{\"S\":\"PROFILE\"}}" --query 'Item.uid.S' --output text)
if [ "$HAS" = "None" ] || [ -z "$HAS" ]; then
  PHONE_STORED=${PHONE:-}
  aws dynamodb transact-write-items --transact-items "[
    {\"Put\":{\"TableName\":\"$TABLE\",\"Item\":{\"pk\":{\"S\":\"U#$SUB\"},\"sk\":{\"S\":\"PROFILE\"},\"uid\":{\"S\":\"$SUB\"},\"username\":{\"S\":\"$NAME\"},\"nickname\":{\"S\":\"$NAME\"},\"grade\":{\"S\":\"기타\"},\"role\":{\"S\":\"admin\"},\"banned\":{\"BOOL\":false},\"createdAt\":{\"N\":\"$NOW\"},\"gsi2pk\":{\"S\":\"USERS\"},\"gsi2sk\":{\"S\":\"$(printf '%013d' $NOW)#$SUB\"}}}},
    {\"Put\":{\"TableName\":\"$TABLE\",\"Item\":{\"pk\":{\"S\":\"U#$SUB\"},\"sk\":{\"S\":\"PRIVATE\"},\"realName\":{\"S\":\"관리자\"},\"phone\":{\"S\":\"$PHONE_STORED\"},\"gender\":{\"S\":\"\"},\"age\":{\"N\":\"0\"},\"memberType\":{\"S\":\"관리자\"},\"childGrade\":{\"S\":\"\"},\"guardianConsent\":{\"BOOL\":false},\"agreedAt\":{\"N\":\"$NOW\"}}}},
    {\"Put\":{\"TableName\":\"$TABLE\",\"Item\":{\"pk\":{\"S\":\"NICK#$NAME\"},\"sk\":{\"S\":\"NICK\"},\"uid\":{\"S\":\"$SUB\"}}}}
  ]"
else
  aws dynamodb update-item --table-name "$TABLE" --key "{\"pk\":{\"S\":\"U#$SUB\"},\"sk\":{\"S\":\"PROFILE\"}}" \
    --update-expression 'SET #r = :a' --expression-attribute-names '{"#r":"role"}' --expression-attribute-values '{":a":{"S":"admin"}}'
fi
echo "✔ $NAME 계정이 관리자입니다."
