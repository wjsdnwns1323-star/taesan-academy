// Firebase 웹 앱 설정
// Firebase 콘솔 > 프로젝트 설정 > 내 앱 > SDK 설정 및 구성 에서 나온 값을 그대로 붙여넣으세요.
// apiKey가 비어 있으면 사이트는 '체험 모드'로 동작합니다(데이터가 이 브라우저에만 저장됨).
export const firebaseConfig = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: '',
  // Storage(유료 Blaze 요금제 필요)를 쓰지 않으면 false. 사진은 줄여서 Firestore에 저장합니다.
  useStorage: false,
};

// 관리자 이메일. 이 주소로 가입하고 이메일 인증을 마치면 관리자 화면이 열립니다.
// firestore.rules / storage.rules 의 ADMIN_EMAILS 목록과 같게 유지하세요.
export const adminEmails = ['wjsdnwns1323@uinone.net'];
