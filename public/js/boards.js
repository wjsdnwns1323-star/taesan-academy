// 게시판·말머리·학년·과목 정의
export const GRADES = ['학부모', '중1', '중2', '중3', '고1', '고2', '고3', 'N수', '기타'];
export const STUDENT_GRADES = ['중1', '중2', '중3', '고1', '고2', '고3', 'N수'];
export const SUBJECTS = ['국어', '수학', '영어', '과학', '사회', '한국사', '기타'];

export const BOARDS = {
  news: {
    name: '소식',
    categories: [
      { id: 'admission-news', name: '입시뉴스' },
      { id: 'office', name: '교육청·대학 발표' },
      { id: 'event', name: '설명회·행사' },
      { id: 'local', name: '대전 교육소식' },
    ],
  },
  talk: {
    name: '수다',
    categories: [
      { id: 'daily', name: '일상' },
      { id: 'parent', name: '학부모 수다' },
      { id: 'worry', name: '고민상담' },
      { id: 'humor', name: '유머' },
    ],
  },
  school: {
    name: '학교',
    categories: [
      { id: 'life', name: '학교생활' },
      { id: 'exam', name: '내신·시험' },
      { id: 'info', name: '학교 정보' },
      { id: 'transfer', name: '고입·배정' },
    ],
  },
  admission: {
    name: '입시',
    categories: [
      { id: 'susi', name: '수시' },
      { id: 'jeongsi', name: '정시·수능' },
      { id: 'career', name: '진로' },
      { id: 'method', name: '공부법' },
    ],
  },
  qna: {
    name: '문제풀이',
    categories: SUBJECTS.map((s) => ({ id: s, name: s })),
  },
  data: {
    name: '자료실',
    categories: [
      { id: 'note', name: '정리노트' },
      { id: 'worksheet', name: '자작 문제·학습지' },
      { id: 'admission', name: '입시 자료' },
      { id: 'school', name: '학교 안내문' },
      { id: 'etc', name: '기타' },
    ],
  },
  notice: {
    name: '공지',
    categories: [{ id: 'notice', name: '공지' }],
  },
};

export const COMMUNITY_TABS = [
  { id: 'rec', name: '인기글' },
  { id: 'news', name: '소식' },
  { id: 'talk', name: '수다' },
  { id: 'school', name: '학교' },
  { id: 'admission', name: '입시' },
];
// 글을 쓸 수 있는 게시판(문제풀이는 학생 회원이 모이면 config.js 의 QNA_OPEN 으로 엽니다)
export const WRITE_BOARDS = ['news', 'talk', 'school', 'admission', 'data'];

export function category(board, id) {
  const b = BOARDS[board];
  return b?.categories.find((c) => c.id === id) || { id, name: id || b?.name || '' };
}

// 자료실 규칙(글쓰기 화면·자료실 상단·규칙 페이지에서 같이 씁니다)
export const DATA_RULES = [
  '본인이 직접 만든 자료이거나, 저작권자에게 배포 허락을 받은 자료만 올릴 수 있습니다.',
  '시중 교재·문제집·인강 교재·학원 교재의 스캔본, 사진, 타이핑본은 올릴 수 없습니다.',
  '시험지 원본, 유료 자료, 다른 사이트·카페의 자료를 허락 없이 옮겨 올 수 없습니다.',
  '다른 사람의 이름·학교·연락처·얼굴 등 개인정보가 담긴 파일은 올릴 수 없습니다.',
  '모든 자료는 관리자 확인 후 공개됩니다. 출처를 반드시 적어야 합니다.',
  '위반 자료는 예고 없이 삭제되며, 작성자는 이용이 정지될 수 있습니다. 저작권 침해의 법적 책임은 올린 사람에게 있습니다.',
];

export const DATA_AGREES = [
  '직접 만들었거나 배포 허락을 받은 자료입니다.',
  '교재·시험지·유료 자료를 복사하거나 스캔한 자료가 아닙니다.',
  '규칙을 어기면 자료가 삭제되고 이용이 정지될 수 있음을 확인했습니다.',
];
