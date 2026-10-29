// AWS 서버 연결 정보. aws/deploy.sh 가 배포한 뒤 채웁니다(비밀 값이 아닙니다).
// api 가 비어 있으면 예전 서버(Firebase)를 씁니다. 주소 뒤에 ?demo=1 을 붙이면 체험 모드입니다.
export const AWS_CONFIG = {
  api: 'https://sznqeblvwl.execute-api.ap-northeast-2.amazonaws.com',
  // 이 주소에서 열면 같은 주소의 /api 로 부릅니다(CloudFront). taesan.uinone.net 은 DNS를 CloudFront로 바꾼 뒤에 넣습니다.
  sameOrigin: ['dk6r8ltp4doe3.cloudfront.net'],
};
