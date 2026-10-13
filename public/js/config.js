// Firebase 웹 앱 설정
// Firebase 콘솔 > 프로젝트 설정 > 내 앱 > SDK 설정 및 구성 에서 나온 값을 그대로 붙여넣으세요.
// apiKey가 비어 있으면 사이트는 '체험 모드'로 동작합니다(데이터가 이 브라우저에만 저장됨).
export const firebaseConfig = {
  apiKey: 'AIzaSyD7Vksh-2PgYa02WoNZCrI5RorrBw7Zf3U',
  authDomain: 'taesan-academy.firebaseapp.com',
  projectId: 'taesan-academy',
  storageBucket: 'taesan-academy.firebasestorage.app',
  messagingSenderId: '148663191557',
  appId: '1:148663191557:web:5ad98379a6fdef62de346c',
  // Storage(유료 Blaze 요금제 필요)를 쓰지 않으면 false. 사진은 줄여서 Firestore에 저장합니다.
  useStorage: false,
};

// 관리자 계정(아이디·비밀번호 로그인 전용). 관리자 화면(#/admin)에서 아이디 'admin'과 비밀번호로 로그인합니다.
// 계정은 Firebase 콘솔 > Authentication > 사용자 추가에서 만듭니다. Google 로그인 계정은 관리자가 될 수 없습니다.
// firestore.rules / storage.rules 의 관리자 이메일과 같게 유지하세요.
export const ADMIN_DOMAIN = 'taesan-academy.firebaseapp.com';
export const adminEmails = ['admin@taesan-academy.firebaseapp.com'];

// 나이스 교육정보 개방 포털(open.neis.go.kr) 인증키. 학교 검색에 씁니다.
// 비어 있어도 동작하지만 한 번에 5개까지만 찾아집니다. 키를 넣으면 더 많이 찾습니다.
export const neisKey = '';
