// Firebase 웹 앱 설정 (Firebase 콘솔 > 프로젝트 설정 > 내 앱 에서 나온 값)
// 주소 뒤에 ?demo=1 을 붙이면 '체험 모드'로 열립니다(데이터가 그 브라우저에만 저장됨).
export const firebaseConfig = {
  apiKey: 'AIzaSyD7Vksh-2PgYa02WoNZCrI5RorrBw7Zf3U',
  authDomain: 'taesan-academy.firebaseapp.com',
  projectId: 'taesan-academy',
  storageBucket: 'taesan-academy.firebasestorage.app',
  messagingSenderId: '148663191557',
  appId: '1:148663191557:web:5ad98379a6fdef62de346c',
};

export const SITE_NAME = '태산 커뮤니티';
export const ACADEMY_NAME = '태산학원';

// 아이디 로그인용 내부 이메일 도메인(실제로 메일이 가지 않습니다). 바꾸면 기존 회원이 로그인할 수 없습니다.
export const LOGIN_DOMAIN = 'member.taesan-academy.app';

// 업로드 제한(가벼운 커뮤니티용). 파일은 Firestore에 나눠 저장합니다(Storage·유료 요금제 불필요).
export const LIMITS = {
  fileMB: 5,          // 파일 1개 최대 크기
  files: 5,           // 글 하나에 첨부 파일 수
  images: 10,         // 글 하나에 사진 수
  imagePx: 1600,      // 사진은 이 크기로 줄여서 저장
};
