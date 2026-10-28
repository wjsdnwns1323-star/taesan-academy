// 체험 모드 예시 데이터(?demo=1&seed=1). 화면 점검과 시연용이며 실제 사이트에는 쓰이지 않습니다.
// 모든 예시 계정의 비밀번호는 demo1234, 인증번호는 123456 입니다.
const PW = 'demo1234';
const H = 3600000, D = 24 * H;

const USERS = [
  { username: 'admin', realName: '운영진', gender: '여', age: 41, memberType: '학부모', childGrade: '고1' },
  { username: 'mom_dunsan', realName: '김서연', gender: '여', age: 44, memberType: '학부모', childGrade: '중3' },
  { username: 'yuseong_papa', realName: '박준호', gender: '남', age: 47, memberType: '학부모', childGrade: '고1' },
  { username: 'noeun_mom', realName: '이지은', gender: '여', age: 45, memberType: '학부모', childGrade: '고2' },
  { username: 'daeseong17', realName: '최민재', gender: '남', age: 17, memberType: '학생', grade: '고1' },
  { username: 'jihu_0820', realName: '정지후', gender: '여', age: 15, memberType: '학생', grade: '중3' },
];

// [게시판, 말머리, 제목, 본문, 글쓴이, 몇 시간 전, 조회, {고정·좋아요한 사람}]
const POSTS = [
  ['notice', 'notice', '태산입시 이용 안내', '태산입시는 대전 학생과 학부모가 입시 정보를 나누는 회원제 커뮤니티입니다.\n\n글을 쓰기 전에 이용규칙을 한 번 읽어 주세요. 다른 사람의 실명·학교·연락처는 올리지 않습니다.', 'admin', 30 * 24, 412],
  ['talk', 'daily', '수다 게시판에서 지켜 주세요', '서로 존댓말로 이야기해 주세요. 특정 학원·학교를 깎아내리는 글은 관리자가 숨길 수 있어요.', 'admin', 20 * 24, 188, { pinned: true }],
  ['news', 'event', '대전 고입 설명회 일정 모음 (11월)', '교육청과 학교에서 공지한 설명회를 한곳에 모았습니다.\n\n- 일반고 배정 설명회: 각 구청 대강당\n- 자사고·특목고 설명회: 학교별 홈페이지 공지\n\n날짜가 바뀌는 경우가 많으니 가시기 전에 학교 공지를 꼭 확인하세요.', 'mom_dunsan', 5, 231, { likes: ['yuseong_papa', 'noeun_mom', 'jihu_0820'] }],
  ['news', 'office', '2028 대입 개편, 내신 5등급제 정리', '고1부터 내신이 5등급으로 바뀝니다. 학교 설명회에서 들은 내용을 정리해 봤어요.\n\n1등급 비율이 10%로 늘어나는 대신 변별력이 줄어서 수능 비중이 커질 거라는 이야기가 많았습니다.', 'yuseong_papa', 26, 340, { likes: ['mom_dunsan', 'noeun_mom', 'daeseong17', 'admin'] }],
  ['news', 'local', '둔산동 학원가 셔틀 노선 바뀐 곳 있나요', '이번 달부터 몇몇 학원 셔틀이 시간표를 바꿨다고 들었어요. 아시는 분 댓글 부탁드려요.', 'noeun_mom', 50, 97],
  ['talk', 'parent', '중3 겨울방학, 다들 어떻게 보내실 계획이세요?', '고입 끝나고 겨울방학이 꽤 길더라고요. 선행을 얼마나 할지, 쉬게 할지 고민입니다. 다른 집은 어떻게 하시는지 궁금해요.', 'mom_dunsan', 3, 156, { likes: ['noeun_mom', 'yuseong_papa'] }],
  ['talk', 'worry', '아이가 수학을 너무 싫어해요', '중학교 때까지는 그럭저럭 했는데 고1 올라와서 수학 점수가 많이 떨어졌어요. 학원을 바꿔야 할지, 과외를 붙여야 할지 모르겠습니다.', 'yuseong_papa', 9, 203, { likes: ['mom_dunsan'] }],
  ['talk', 'daily', '기말 끝나고 다들 뭐 하세요', '시험 끝나서 친구들이랑 은행동 갔다 왔어요 ㅎㅎ 다들 고생 많으셨어요', 'daeseong17', 14, 88, { likes: ['jihu_0820'] }],
  ['talk', 'humor', '엄마가 제 시험지를 보고 한 말', '"이건 실수지?" 라고 물어보셨는데 실수가 아니었습니다…', 'jihu_0820', 31, 142, { likes: ['daeseong17', 'mom_dunsan', 'noeun_mom'] }],
  ['school', 'exam', '대성고 1학년 2학기 기말 범위', '국어: 교과서 4~6단원 + 프린트\n수학: 공통수학1 3단원까지\n영어: 교과서 5~7과, 모의고사 9월분\n\n틀린 부분 있으면 알려 주세요.', 'daeseong17', 40, 265, { likes: ['yuseong_papa'] }],
  ['school', 'transfer', '서구 일반고 배정, 희망 학교 몇 지망까지 쓰셨어요?', '작년에 1지망에 못 간 집이 꽤 있었다고 해서 걱정이에요. 거리 기준인지 추첨 비중이 큰지 경험 있으신 분 이야기 듣고 싶어요.', 'mom_dunsan', 52, 310, { likes: ['noeun_mom', 'jihu_0820'] }],
  ['school', 'life', '고1 동아리, 진로랑 꼭 맞춰야 하나요', '생기부 때문에 진로랑 맞는 동아리를 들어야 한다는 말도 있고, 하고 싶은 걸 하라는 말도 있어서요.', 'noeun_mom', 75, 120],
  ['school', 'info', '노은동 근처 스터디카페 추천', '조용하고 늦게까지 하는 곳 찾고 있어요. 아이가 독서실보다는 스터디카페를 더 좋아하네요.', 'noeun_mom', 98, 77],
  ['admission', 'susi', '학종 준비, 고1 겨울방학에 뭘 해야 할까요', '세특에 쓸 탐구 주제를 미리 정해 두라는 조언을 들었는데 구체적으로 어떻게 시작해야 할지 막막합니다.', 'yuseong_papa', 7, 189, { likes: ['noeun_mom', 'admin'] }],
  ['admission', 'jeongsi', '정시 비중 늘어난다는데 수능 준비는 언제부터?', '고2 겨울부터 본격적으로 해도 늦지 않다는 말과 고1부터 해야 한다는 말이 다 있어서 헷갈려요.', 'noeun_mom', 20, 174, { likes: ['yuseong_papa'] }],
  ['admission', 'career', '이과 성향인데 문과 과목이 더 점수가 잘 나와요', '진로를 아직 못 정했는데 선택과목을 고르라고 해서 고민이에요. 비슷한 경험 있으신 분 계실까요?', 'jihu_0820', 60, 133],
  ['admission', 'method', '오답노트, 손으로 쓰는 게 나을까요 태블릿이 나을까요', '아이가 태블릿으로 하겠다는데 집중이 될지 모르겠어요.', 'mom_dunsan', 120, 96],
  ['data', 'note', '중3 겨울방학 국어 문법 정리 노트', '수업 시간에 정리한 내용을 직접 다시 만들었습니다. 개인 공부용으로만 써 주세요.', 'noeun_mom', 44, 154, { likes: ['mom_dunsan', 'jihu_0820'], source: '직접 작성' }],
  ['data', 'note', '고1 공통수학 개념 체크리스트', '단원별로 꼭 알아야 할 개념을 표로 정리했어요.', 'daeseong17', 2, 0, { source: '직접 작성', pending: true }],
];

// [글 제목, 댓글 쓴 사람, 내용, 몇 시간 전, 답글 대상(같은 글의 댓글 순서)]
const COMMENTS = [
  ['대전 고입 설명회 일정 모음 (11월)', 'noeun_mom', '정리해 주셔서 고맙습니다. 구청 설명회는 사전 신청이 필요한가요?', 4],
  ['대전 고입 설명회 일정 모음 (11월)', 'mom_dunsan', '서구는 신청 없이 가도 됐어요. 일찍 가셔야 자리가 있어요.', 3.5, 0],
  ['대전 고입 설명회 일정 모음 (11월)', 'jihu_0820', '저도 엄마랑 가 보려고요!', 2],
  ['2028 대입 개편, 내신 5등급제 정리', 'noeun_mom', '내신 부담이 줄어드는 건지 오히려 늘어나는 건지 아직도 모르겠어요.', 20],
  ['2028 대입 개편, 내신 5등급제 정리', 'admin', '학원 설명회에서도 같은 질문이 많았습니다. 다음 주에 정리 글 올릴게요.', 18, 0],
  ['중3 겨울방학, 다들 어떻게 보내실 계획이세요?', 'noeun_mom', '저희는 수학 선행 한 학기 정도만 하고 나머지는 책 읽기로 했어요.', 2],
  ['중3 겨울방학, 다들 어떻게 보내실 계획이세요?', 'yuseong_papa', '작년에 너무 몰아쳤더니 아이가 지쳐서 올해는 쉬엄쉬엄 가려고요.', 1],
  ['아이가 수학을 너무 싫어해요', 'mom_dunsan', '저희 아이도 고1 때 그랬는데 개념부터 다시 잡으니까 좀 나아졌어요.', 8],
  ['아이가 수학을 너무 싫어해요', 'yuseong_papa', '개념부터 다시 하는 게 맞겠네요. 감사합니다.', 7, 0],
  ['대성고 1학년 2학기 기말 범위', 'jihu_0820', '내년에 대성고 가는데 미리 참고할게요!', 30],
  ['서구 일반고 배정, 희망 학교 몇 지망까지 쓰셨어요?', 'noeun_mom', '저희는 5지망까지 다 채웠어요. 거리보다 추첨 영향이 컸던 것 같아요.', 48],
  ['학종 준비, 고1 겨울방학에 뭘 해야 할까요', 'noeun_mom', '관심 있는 분야 책 두세 권 읽고 짧게 기록해 두는 것부터 시작했어요.', 5],
  ['중3 겨울방학 국어 문법 정리 노트', 'jihu_0820', '문법 너무 어려웠는데 정리가 깔끔해요. 고맙습니다!', 40],
];

export async function seedDemo({ app, store, setClock }) {
  const call = async (method, path, body, token, query) => {
    const r = await app.handle({ method, path, body, token, query });
    if (r.status >= 400) throw new Error(`${method} ${path}: ${r.body?.message}`);
    return r.body;
  };
  const start = Date.now();
  setClock(start - 40 * D);
  // 예시 시각마다 새로 로그인(지난 시각으로 만든 토큰은 금방 만료되므로)
  const as = async (who) => (await call('POST', '/auth/login', { username: who, password: PW })).idToken;
  let n = 0;
  for (const u of USERS) {
    const phone = `010-7${String(100 + n).padStart(3, '0')}-${String(1000 + n * 7).padStart(4, '0')}`;
    n += 1;
    await call('POST', '/auth/start', { username: u.username, password: PW, phone });
    await call('POST', '/auth/confirm', { ...u, password: PW, phone, code: '123456', grade: u.grade || '', childGrade: u.childGrade || '', agreeRules: true, agreePrivacy: true, guardianConsent: u.age < 14 });
  }
  // 글은 오래된 것부터
  const ids = {};
  const sorted = [...POSTS].sort((a, b) => b[5] - a[5]);
  for (const [board, category, title, body, author, hoursAgo, views, o = {}] of sorted) {
    setClock(start - hoursAgo * H);
    const { id } = await call('POST', '/posts', { board, category, title, body, source: o.source || '', pinned: !!o.pinned, images: [], files: [] }, await as(author));
    ids[title] = id;
    if (board === 'data' && !o.pending) await call('POST', `/posts/${id}/approve`, { ok: true }, await as('admin'));
    for (const who of o.likes || []) await call('POST', `/posts/${id}/like`, { on: true }, await as(who));
    await store.update(`P#${id}`, 'META', { set: { viewCount: views } });
  }
  const made = {};
  for (const [title, who, body, hoursAgo, replyTo] of [...COMMENTS].sort((a, b) => b[3] - a[3])) {
    setClock(start - hoursAgo * H);
    const list = (made[title] = made[title] || []);
    const { id } = await call('POST', `/posts/${ids[title]}/comments`, { body, parentId: replyTo !== undefined ? list[replyTo] : '' }, await as(who));
    list.push(id);
  }
  // 홈 '입시 일정' 예시(오늘 기준 날짜, 실제 일정은 관리자가 공식 발표를 보고 넣습니다)
  setClock(null);
  const ymd = (days) => { const d = new Date(Date.now() + days * D); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const adm = await as('admin');
  for (const [days, text] of [[6, '고입 원서 접수 시작(예시)'], [16, '2학기 기말고사(예시)'], [23, '대학수학능력시험(예시)'], [41, '일반고 배정 발표(예시)'], [58, '겨울방학 시작(예시)']]) {
    await call('POST', '/banners', { kind: 'event', date: ymd(days), text, link: '' }, adm);
  }
  await call('POST', '/banners', { kind: 'text', text: '11월 고입 설명회 일정을 소식 게시판에 정리해 두었어요', link: '#/community/news' }, adm);
}

export const DEMO_PASSWORD = PW;
