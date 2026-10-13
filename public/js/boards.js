// 게시판·말머리·학년·과목 정의
export const GRADES = ['중1', '중2', '중3', '고1', '고2', '고3', 'N수', '학부모', '기타'];
export const SUBJECTS = ['국어', '수학', '영어', '과학', '사회', '한국사', '기타'];

export const BOARDS = {
  talk: {
    name: '소통해요',
    categories: [
      { id: 'humor', name: '유머', icon: '🍪', bg: '#fbe6d6' },
      { id: 'daily', name: '일상대화', icon: '☀️', bg: '#fff3cf' },
      { id: 'drawing', name: '그림', icon: '🎨', bg: '#e8e4fb' },
      { id: 'love', name: '썸·연애', icon: '💕', bg: '#fde3e7' },
      { id: 'worry', name: '고민상담', icon: '🩹', bg: '#fff1c9' },
      { id: 'school', name: '학교이야기', icon: '🏫', bg: '#e1efe4' },
    ],
  },
  study: {
    name: '공부해요',
    categories: [
      { id: 'method', name: '공부법', icon: '✏️', bg: '#fde8da' },
      { id: 'proof', name: '인증', icon: '🚩', bg: '#e1ecfb' },
      { id: 'admission', name: '입시·진로', icon: '🎓', bg: '#e6e6f5' },
      { id: 'news', name: '최신입시', icon: '📰', bg: '#eef0f2' },
      { id: 'book', name: '문제집·인강', icon: '📗', bg: '#e2f3e5' },
    ],
  },
  qna: {
    name: '문제풀이',
    categories: SUBJECTS.map((s) => ({ id: s, name: s, icon: '❓', bg: '#fde8da' })),
  },
  data: {
    name: '자료실',
    categories: [
      { id: 'note', name: '정리노트', icon: '📒', bg: '#fff3cf' },
      { id: 'worksheet', name: '자작 문제·학습지', icon: '📝', bg: '#e1ecfb' },
      { id: 'admission', name: '입시 자료', icon: '🎓', bg: '#e6e6f5' },
      { id: 'school', name: '학교 안내문', icon: '🏫', bg: '#e1efe4' },
      { id: 'etc', name: '기타', icon: '📎', bg: '#eef0f2' },
    ],
  },
  notice: {
    name: '공지',
    categories: [{ id: 'notice', name: '공지', icon: '📢', bg: '#fde3d3' }],
  },
};

export const COMMUNITY_TABS = [
  { id: 'rec', name: '추천' },
  { id: 'talk', name: '소통해요' },
  { id: 'study', name: '공부해요' },
  { id: 'qna', name: '문제풀이' },
];

export function category(board, id) {
  const b = BOARDS[board];
  return b?.categories.find((c) => c.id === id) || { id, name: id || b?.name || '', icon: '💬', bg: '#eef0f2' };
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
