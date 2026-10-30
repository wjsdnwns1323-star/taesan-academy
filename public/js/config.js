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

export const SITE_NAME = '태산입시';
export const SITE_TAGLINE = '대전 중고등 입시 커뮤니티';
export const SITE_DESC = '대전 학생과 학부모가 입시 정보와 고민을 나누는 곳';
// 문제풀이 게시판: 학생 회원이 어느 정도 모이면 true 로 바꿔 엽니다
export const QNA_OPEN = false;
export const ACADEMY_NAME = '태산학원';
// 태산학원 홍보 광고: 누르면 이 밴드 주소가 새 창으로 열림. 광고를 모두 끄려면 ADS_ON 을 false 로
export const ACADEMY_BAND = 'https://www.band.us/band/61446116/post';
export const ADS_ON = true;

// 제목이 반짝이는 글: 인기글(조회 views 이상 또는 좋아요 likes 이상)은 주황, 열혈 회원(최근 30일 글 posts개 이상)의 글은 남색
export const HEAT = { views: 200, likes: 10, posts: 5 };

// 아이디 로그인용 내부 이메일 도메인(실제로 메일이 가지 않습니다). 바꾸면 기존 회원이 로그인할 수 없습니다.
export const LOGIN_DOMAIN = 'member.taesan-academy.app';

// 업로드 제한(가벼운 커뮤니티용). 파일은 Firestore에 나눠 저장합니다(Storage·유료 요금제 불필요).
export const LIMITS = {
  fileMB: 5,          // 파일 1개 최대 크기
  files: 5,           // 글 하나에 첨부 파일 수
  images: 10,         // 글 하나에 사진 수
  imagePx: 1600,      // 사진은 이 크기로 줄여서 저장
};

// 개인정보 처리방침에 들어가는 정보. 보호책임자 이름·이메일을 정하면 채워 주세요(비어 있으면 직책만 보입니다).
// 처리방침 내용을 바꾸면 effective(시행일)를 새 날짜로 바꾸고, 바뀌기 전 방침은 history 에 남겨 주세요.
export const PRIVACY = {
  officerName: '',
  officerTitle: '태산학원 원장',
  phone: '042-321-5788',
  email: '',
  address: '대전광역시 서구 둔산남로 96 E.플러스빌딩 2층',
  effective: '2026-11-01',
  history: [],
};
