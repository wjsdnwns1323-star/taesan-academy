# AWS 배포 안내

태산입시를 AWS로 옮기는 순서입니다. 명령은 모두 **AWS CloudShell**에서 실행합니다(브라우저에서 열리는 터미널이라 따로 설치할 것이 없습니다).

## 무엇이 만들어지나

| 하는 일 | AWS 서비스 | 비고 |
| --- | --- | --- |
| 로그인·회원가입 휴대폰 인증 | Cognito(사용자 풀) + SNS 문자 | 아이디·비밀번호 로그인, 가입할 때 인증번호 문자 |
| 글·댓글·회원 정보 | DynamoDB | 표 1개, 쓰는 만큼 요금, 35일 되돌리기(PITR) 켜짐 |
| 서버 규칙 | Lambda + API Gateway(HTTP API) | `aws/api/core.mjs` 한 파일에 모든 권한 규칙 |
| 사진·첨부 파일 | S3(비공개) | 회원에게만 1시간짜리 주소로 내려줌, 파일 1개 5MB |
| 사이트 화면 | S3 + CloudFront | `/api/*`는 서버로, 나머지는 화면 파일로 |

표, 사용자 풀, 파일 버킷은 실수로 지워지지 않게 삭제 보호를 걸어 두었습니다.

## 0. 준비(요금 알림)

배포 전에 콘솔 **Billing and Cost Management → 예산(Budgets) → 예산 생성 → 월 비용 예산** 에서 월 1만 원(예: 8달러) 정도로 만들고 알림 이메일을 넣습니다. 생각보다 요금이 나오면 바로 메일이 옵니다.

## 1. 처음 배포

1. AWS 콘솔에 로그인한 뒤 오른쪽 위 리전을 **아시아 태평양(서울) ap-northeast-2**로 바꿉니다.
2. 위쪽 검색창 옆 CloudShell 아이콘(`>_`)을 누릅니다.
3. 아래를 붙여 넣습니다.

```bash
git clone https://github.com/wjsdnwns1323-star/taesan-academy.git && cd taesan-academy
bash aws/deploy.sh
```

처음에는 CloudFront 때문에 10~20분 걸립니다. 끝나면 사이트 주소(`https://xxxx.cloudfront.net`)와 API 주소가 나옵니다. **API 주소를 알려 주시면** 저장소의 `public/js/aws-config.js`에 넣어 커밋하겠습니다(비밀 값이 아닙니다).

## 2. 관리자 계정

```bash
bash aws/scripts/create-admin.sh qwer
```

비밀번호는 화면에 보이지 않게 입력받고 어디에도 저장하지 않습니다. 이미 가입한 회원 아이디를 넣으면 그 회원을 관리자로 바꿉니다.

## 3. 인증 문자 열기(꼭 필요)

새 AWS 계정은 **문자 샌드박스** 상태라, 미리 등록한 번호로만 문자가 갑니다. 회원가입을 열기 전에 아래 두 가지를 해야 합니다.

1. 콘솔에서 **Amazon SNS → 문자 메시지(SMS) → 샌드박스 종료(Exit SMS sandbox)** 를 눌러 신청합니다. 용도는 "회원가입 휴대폰 인증(일회용 비밀번호)", 대상 국가는 대한민국, 예상 발송량은 하루 수십 건 정도로 적습니다.
2. 같은 화면의 **월 지출 한도(Account spend limit)** 가 처음에는 1달러입니다. 한 달 예상 문자 수에 맞춰 올려 달라고 함께 신청합니다(예: 20달러).

샌드박스가 풀리기 전에는 SNS 화면에서 내 휴대폰 번호를 "샌드박스 대상 번호"로 등록하면 그 번호로는 시험할 수 있습니다.

- 문자는 `[태산입시] 인증번호는 123456 입니다` 형식이며, 해외 발송 경로라 휴대폰에 '국제발신'이 붙을 수 있습니다.
- 요금 보호를 위해 서버가 **하루 300건**, **같은 번호는 하루 5번**까지만 보냅니다. 바꾸려면 `SMS_DAILY_MAX=500 bash aws/deploy.sh`처럼 배포합니다.

## 4. 사이트 주소 연결(taesan.uinone.net)

1. 콘솔 리전을 **미국 동부(버지니아 북부) us-east-1**로 바꾸고 **Certificate Manager → 인증서 요청 → 퍼블릭 인증서**에서 `taesan.uinone.net`을 넣고 **DNS 검증**을 고릅니다.
2. 인증서 화면에 나오는 CNAME(이름·값)을 uinone.net 도메인을 관리하는 곳(가비아·호스팅 업체 등)의 DNS에 추가합니다. 몇 분 뒤 '발급됨'이 됩니다.
3. CloudShell(서울)에서 인증서 ARN을 넣고 다시 배포합니다.

```bash
DOMAIN=taesan.uinone.net CERT_ARN=arn:aws:acm:us-east-1:123456789012:certificate/... bash aws/deploy.sh
```

4. DNS에서 `taesan` 레코드를 지금의 GitHub Pages 대신 **CNAME → 배포 결과의 `xxxx.cloudfront.net`** 으로 바꿉니다.
5. 새 주소에서 가입·로그인·글쓰기·사진 올리기가 되면, GitHub 저장소 **Settings → Pages** 의 사용자 도메인을 비우고 Pages를 끕니다(그 뒤로는 화면도 AWS에서만 나갑니다).

## 5. 화면만 다시 올리기

```bash
git pull && bash aws/deploy.sh site
```

## 6. 예상 요금(회원 수백 명, 하루 방문 수천 회 기준)

- Cognito: 월 활성 사용자 1만 명까지 무료(Lite 요금제)
- Lambda·API Gateway·DynamoDB·S3·CloudFront: 이 규모에서는 대부분 무료 사용량 안이거나 월 몇천 원 이하
- **문자**: 인증 문자 1건마다 요금이 붙습니다(대한민국 요금은 SNS 요금표 확인). 가입자 수만큼만 나옵니다.

## 7. 예전 Firebase 데이터

- `public/js/aws-config.js`의 `api`가 비어 있으면 사이트는 지금처럼 Firebase를 씁니다. 주소가 들어가는 순간부터 AWS를 씁니다.
- Firebase 회원 비밀번호는 옮길 수 없어서, 기존 시험 계정은 AWS에서 다시 가입해야 합니다. 옮길 글이 있으면 알려 주세요. 옮기는 도구를 따로 만들겠습니다.

## 8. 개발용

```bash
# 서버 규칙 시험(메모리 저장소)
cd aws/api && npm ci && cd ../.. && node --test aws/api/test/*.test.mjs
# DynamoDB Local 로 같은 시험
DDB_ENDPOINT=http://localhost:8000 node --test aws/api/test/*.test.mjs
# core.mjs 를 고친 뒤 체험 모드 파일 맞추기
scripts/sync-core.sh
```
