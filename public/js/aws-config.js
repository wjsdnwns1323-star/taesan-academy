// AWS 서버 연결 정보. aws/deploy.sh 가 배포한 뒤 채웁니다(비밀 값이 아닙니다).
// api 가 비어 있으면 예전 서버(Firebase)를 씁니다. 주소 뒤에 ?demo=1 을 붙이면 체험 모드입니다.
export const AWS_CONFIG = {
  api: '',        // 예: 'https://abcd1234.execute-api.ap-northeast-2.amazonaws.com'
  sameOrigin: [], // 이 주소에서 열면 같은 주소의 /api 로 부릅니다(CloudFront). 예: ['taesan.uinone.net']
};
