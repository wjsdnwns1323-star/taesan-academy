#!/usr/bin/env bash
# 태산입시를 AWS에 배포합니다. AWS CloudShell(서울 리전 ap-northeast-2)에서 실행하세요.
#   git clone https://github.com/wjsdnwns1323-star/taesan-academy.git && cd taesan-academy
#   bash aws/deploy.sh
# 사이트 주소(taesan.uinone.net)를 붙일 때는 us-east-1 에서 발급한 인증서 ARN을 함께 넘깁니다.
#   DOMAIN=taesan.uinone.net CERT_ARN=arn:aws:acm:us-east-1:...:certificate/... bash aws/deploy.sh
# 사이트 주소가 taesan.uinone.net 이 아니면 SITE_ORIGIN=https://다른주소 를 함께 넘깁니다.
# 화면만 다시 올릴 때: bash aws/deploy.sh site
set -euo pipefail
cd "$(dirname "$0")"
STACK=${STACK:-taesan}
REGION=${AWS_REGION:-ap-northeast-2}
export AWS_REGION=$REGION AWS_DEFAULT_REGION=$REGION
out() { aws cloudformation describe-stacks --stack-name "$STACK" --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" --output text; }

if [ "${1:-}" != "site" ]; then
  echo "▶ 1/3 서버 코드 묶기"
  (cd api && npm ci --no-audit --no-fund && npm run build)
  echo "▶ 2/3 AWS 자원 만들기·고치기(처음에는 10~20분 걸립니다)"
  PARAMS=()
  [ -n "${DOMAIN:-}" ] && PARAMS+=("DomainName=$DOMAIN")
  [ -n "${CERT_ARN:-}" ] && PARAMS+=("CertificateArn=$CERT_ARN")
  [ -n "${SMS_DAILY_MAX:-}" ] && PARAMS+=("SmsDailyMax=$SMS_DAILY_MAX")
  # 서버를 부를 수 있는 사이트 주소(CORS). 기본은 https://taesan.uinone.net, DOMAIN 을 주면 그 주소
  SITE_ORIGIN=${SITE_ORIGIN:-${DOMAIN:+https://$DOMAIN}}
  [ -n "$SITE_ORIGIN" ] && grep -q "^  SiteOrigin:" template.yaml && PARAMS+=("SiteOrigin=$SITE_ORIGIN")
  sam deploy --template-file template.yaml --stack-name "$STACK" --region "$REGION" --resolve-s3 \
    --capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND --no-fail-on-empty-changeset --no-confirm-changeset \
    ${PARAMS[@]+--parameter-overrides "${PARAMS[@]}"}
fi

echo "▶ 3/3 화면 올리기"
API=$(out ApiUrl); SITE=$(out SiteDomain); BUCKET=$(out SiteBucketName); DIST=$(out DistributionId)
HOSTS="'$SITE'"; [ -n "${DOMAIN:-}" ] && HOSTS="$HOSTS, '$DOMAIN'"
BUILD=$(mktemp -d)
cp -r ../public/. "$BUILD/"
cat > "$BUILD/js/aws-config.js" <<CFG
// aws/deploy.sh 가 만든 파일입니다(비밀 값이 아닙니다).
export const AWS_CONFIG = {
  api: '$API',
  sameOrigin: [$HOSTS],
};
CFG
cp "$BUILD/js/aws-config.js" ../public/js/aws-config.js # 저장소에도 반영(커밋하면 GitHub Pages 주소도 AWS 서버를 씁니다)
V=$(cd "$BUILD" && find . -type f -print0 | sort -z | xargs -0 sha1sum | sha1sum | cut -c1-8)
python3 ../scripts/version_assets.py "$BUILD" "$V"
# index.html 은 늘 새로 확인, 버전이 붙는 css·js 는 오래 보관, 글꼴·그림은 1주
aws s3 sync "$BUILD" "s3://$BUCKET" --delete --exclude index.html --exclude 'fonts/*' --exclude 'images/*' --cache-control 'public, max-age=31536000, immutable'
# 글꼴·그림은 파일 형식을 직접 적어 줍니다(CloudShell 에 따라 woff2·webp 형식을 모를 수 있음)
aws s3 sync "$BUILD/fonts" "s3://$BUCKET/fonts" --delete --exclude '*.woff2' --cache-control 'public, max-age=31536000, immutable'
aws s3 sync "$BUILD/fonts" "s3://$BUCKET/fonts" --exclude '*' --include '*.woff2' --content-type font/woff2 --cache-control 'public, max-age=31536000, immutable'
aws s3 sync "$BUILD/images" "s3://$BUCKET/images" --delete --exclude '*.webp' --cache-control 'public, max-age=604800'
aws s3 sync "$BUILD/images" "s3://$BUCKET/images" --exclude '*' --include '*.webp' --content-type image/webp --cache-control 'public, max-age=604800'
aws s3 cp "$BUILD/index.html" "s3://$BUCKET/index.html" --cache-control 'no-cache' --content-type 'text/html; charset=utf-8'
aws cloudfront create-invalidation --distribution-id "$DIST" --paths '/*' --query 'Invalidation.Id' --output text >/dev/null
rm -rf "$BUILD"

cat <<DONE

✔ 배포 끝
  사이트:   https://$SITE${DOMAIN:+  (연결할 주소: https://$DOMAIN)}
  API:      $API
  관리자 계정 만들기: bash aws/scripts/create-admin.sh qwer
DONE
