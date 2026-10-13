// 관리자 페이지 — 접수 관리, 사이트 모든 콘텐츠 편집, 사이트 정보, 회원, 백업
import { backend, getUser, isAdmin, getSite, CONTENT, seed, shrinkImage } from '../backend.js';
import { esc, $, $$, toast, confirmBox, statusTag, fmtDate } from '../ui.js';
import { clearCache } from './common.js';
import { refreshSite } from '../app.js';
import { imgAttrs, hydrateMedia } from '../media.js';

/* ───────────── 필드 정의 도우미 ─────────────
   F(key, label, type, { opts, hint, ph, req, wide }) */
const F = (k, l, t = 'text', o = {}) => ({ k, l, t, ...o });
const S = (arr) => arr.map((x) => (Array.isArray(x) ? x : [x, x]));
const SUBJECTS = [...seed.subjects, '통합과학', '화학'];
const schoolOpts = () => S(['', ...seed.schools.map((s) => s.id)]).map(([v, t]) => [v, t || '(없음·예비고1)']);
const LINKS = [
  ['#/timetable?term=final', '시간표 · 기말대비'], ['#/timetable?term=pre', '시간표 · 예비고1'], ['#/teachers', '선생님'], ['#/curriculum', '커리큘럼·교재'],
  ['#/results', '시험 결과'], ['#/events', '설명회·특강'], ['#/events/e-diag', '진단고사'], ['#/notice', '공지사항'], ['#/consult', '온라인 상담'], ['#/visit', '방문 상담'], ['#/about', '학원 소개'], ['#/location', '오시는 길'],
];

/* ───────────── 콘텐츠 스키마 ───────────── */
const SCHEMA = {
  classes: {
    title: '강좌·시간표', one: '강좌', view: '#/timetable',
    desc: '내신 시간표에 나오는 반입니다. 여러 반을 골라 한 번에 마감·숨김 처리할 수 있습니다.',
    cols: [['term', '과정'], ['sg', '학교·학년'], ['subject', '과목'], ['teacherName', '선생님'], ['title', '반'], ['start', '개강'], ['time', '시간'], ['status', '상태']],
    filters: [['term', '과정', () => seed.terms.map((t) => [t.id, t.name])], ['subject', '과목', () => S(SUBJECTS)], ['school', '학교', () => seed.schools.map((s) => [s.id, s.id])]],
    defaultFilter: { term: 'final' }, bulk: true, sortable: true,
    sections: [
      ['반 정보', [
        F('term', '과정', 'select', { opts: () => seed.terms.map((t) => [t.id, t.name]), req: true }),
        F('subject', '과목', 'select', { opts: () => S(SUBJECTS), req: true }),
        F('school', '학교', 'select', { opts: schoolOpts }), F('grade', '학년', 'select', { opts: () => S(['고1', '고2', '고3', '고2·3', '예비고1']) }),
        F('teacherName', '선생님', 'teacher', { req: true }), F('title', '반 이름', 'text', { ph: '예: A반 · 외부지문 완벽정복 (비우면 "학교 내신반")' }),
      ]],
      ['일정', [
        F('start', '개강일', 'text', { ph: '예: 10/18(일)' }), F('time', '수업 시간', 'text', { ph: '예: 토 13:00-16:00 / 수 17:00-20:00' }),
        F('status', '모집 상태', 'select', { opts: () => [['', '모집중'], ['마감임박', '마감임박'], ['마감', '마감'], ['진행중', '진행중']] }),
      ]],
      ['강의계획', [
        F('planPost', '강의계획에 보여줄 안내', 'post', { hint: '비우면 선생님·학교·학년이 맞는 안내를 자동으로 골라 보여줍니다.' }),
        F('src', '포스터 번호', 'text', { ph: '예: P50,P89', hint: '밴드 수업 이미지 카드 번호 (P01~P95)' }),
      ]],
      ['노출', [F('order', '정렬 순서', 'number'), F('hidden', '사이트에서 숨기기', 'bool')]],
    ],
  },
  teachers: {
    title: '선생님', one: '선생님', view: '#/teachers', sortable: true,
    desc: '선생님 목록·상세 페이지와 홈 "강사소개 바로가기"·첫 화면 영상 카드에 나오는 정보입니다. 순서도 홈에 그대로 반영됩니다.',
    cols: [['photo', '사진'], ['name', '이름'], ['subject', '과목'], ['brand', '브랜드'], ['schools', '담당']],
    filters: [['subject', '과목', () => S(SUBJECTS)]],
    sections: [
      ['기본 정보', [F('name', '이름', 'text', { req: true }), F('subject', '과목', 'select', { opts: () => S(SUBJECTS), req: true }), F('brand', '브랜드명', 'text', { ph: '예: 이건준 영어연구소' }), F('photo', '사진', 'image', { hint: '배경을 지운(누끼) 세로 사진이 가장 예쁩니다.' })]],
      ['소개', [F('bio', '약력', 'list'), F('highlights', '대표 결과', 'list', { hint: '첫 줄이 선생님 카드와 홈 바로가기 카드에 나옵니다.' }), F('schools', '담당 학교·반', 'list'), F('grades', '학년 태그', 'list', { hint: '비우면 담당 학교에서 자동으로 만듭니다.' })]],
      ['수업', [F('method', '수업 방식', 'list'), F('materials', '교재', 'list'), F('prehigh', '예비고1 과정', 'list'), F('roles', '설명회·특강', 'list')]],
      ['노출', [F('order', '정렬 순서', 'number'), F('hidden', '사이트에서 숨기기', 'bool')]],
    ],
  },
  leaders: {
    title: '소장·연사', one: '소장·연사', view: '#/teachers',
    desc: '선생님 페이지 아래 "입시·설명회"에 나오는 소장님·연사입니다.',
    cols: [['photo', '사진'], ['name', '이름'], ['title', '직함'], ['role', '역할']],
    sections: [['정보', [F('name', '이름', 'text', { req: true }), F('title', '직함', 'text', { ph: '예: 소장' }), F('role', '역할', 'text'), F('photo', '사진', 'image'), F('bio', '약력', 'list'), F('hidden', '사이트에서 숨기기', 'bool')]]],
  },
  bandPosts: {
    title: '강의계획·설명회 안내', one: '안내', view: '#/events',
    desc: '"강의계획 보기" 팝업과 설명회 상세 페이지에 나오는 글·이미지입니다. 강좌 소개는 선생님·학교·학년이 맞는 반에 자동으로 나오고, 설명회 안내는 설명회·특강에서 연결합니다.',
    cols: [['imgs', '이미지'], ['kind', '구분'], ['date', '게시일'], ['title', '제목'], ['teachers', '선생님']],
    filters: [['kind', '구분', () => [['class', '강좌 소개'], ['event', '설명회 안내']]]],
    sections: [
      ['기본', [F('kind', '구분', 'select', { opts: () => [['class', '강좌 소개(강의계획)'], ['event', '설명회 안내']], req: true }), F('title', '제목', 'text', { req: true }), F('date', '게시일', 'text', { ph: '예: 2026.10.12' })]],
      ['어느 반에 보여줄까요? (강좌 소개)', [F('teachers', '선생님', 'list', { hint: '한 줄에 한 명' }), F('schools', '학교', 'list', { hint: '예: 대성고' }), F('grades', '학년', 'list', { hint: '예: 고1, 고2, 예비고1' })]],
      ['내용', [F('text', '본문', 'textarea', { rows: 12 }), F('imgs', '이미지', 'images', { hint: '위에서부터 순서대로 보여줍니다.' }), F('bandUrl', '밴드 원문 주소', 'text', { ph: 'https://band.us/band/61446116/post/...' })]],
      ['노출', [F('hidden', '사이트에서 숨기기', 'bool')]],
    ],
  },
  events: {
    title: '설명회·특강', one: '설명회', view: '#/events',
    desc: '설명회·특강·진단고사 목록과 상세 페이지입니다. 상태가 "모집중·마감임박"이면 예약을 받습니다.',
    cols: [['type', '구분'], ['date', '날짜'], ['title', '제목'], ['place', '장소'], ['status', '상태']],
    filters: [['status', '상태', () => S(['모집중', '마감임박', '마감', '종료'])]],
    sections: [
      ['기본', [F('type', '구분', 'select', { opts: () => S(['설명회', '특강', '진단고사']) }), F('title', '제목', 'text', { req: true }), F('status', '상태', 'select', { opts: () => S(['모집중', '마감임박', '마감', '종료']) })]],
      ['일시·장소', [F('date', '날짜', 'date', { hint: '비우면 "상시"로 표시' }), F('time', '시간', 'text', { ph: '예: 19:30' }), F('dateNote', '날짜 메모', 'text'), F('place', '장소', 'text'), F('target', '대상', 'text')]],
      ['내용', [F('speakers', '연사', 'text'), F('benefit', '참석 혜택', 'text'), F('program', '프로그램', 'list'), F('body', '추가 안내문', 'textarea')]],
      ['밴드 안내·포스터', [F('bandPosts', '설명회 안내', 'posts', { hint: '첫 번째 안내의 글과 이미지가 상세 페이지에 나오고, 첫 이미지가 목록 썸네일이 됩니다.' }), F('src', '포스터 번호', 'text', { ph: '예: P85,P86' })]],
      ['노출', [F('hidden', '사이트에서 숨기기', 'bool')]],
    ],
  },
  results: {
    title: '시험 결과', one: '시험 결과', view: '#/results',
    desc: '시험 결과 페이지와 홈 실적 띠·"결과로 말합니다"에 나오는 성적입니다.',
    cols: [['exam', '시험'], ['school', '학교'], ['grade', '학년'], ['subject', '과목'], ['teacherName', '선생님'], ['headline', '대표 문구'], ['featured', '홈'], ['bandLabel', '실적 띠']],
    filters: [['subject', '과목', () => S(seed.subjects)]],
    sections: [
      ['성적', [F('exam', '시험', 'text', { ph: '예: 2026 2학기 중간', req: true }), F('teacherName', '선생님', 'teacher'), F('subject', '과목', 'select', { opts: () => S(seed.subjects) }), F('school', '학교', 'select', { opts: schoolOpts }), F('grade', '학년', 'text'), F('headline', '대표 문구', 'text', { req: true, ph: '예: 100점 8명' }), F('detail', '세부 내용', 'textarea'), F('provisional', '가채점(확정 전)', 'bool')]],
      ['홈 화면', [F('featured', '"결과로 말합니다"에 노출', 'bool'), F('bandLabel', '실적 띠 문구', 'text', { hint: '비우면 실적 띠에 나오지 않습니다. 최대 5개.', ph: '예: 대신고2 국어 100점' }), F('bandValue', '실적 띠 숫자', 'text', { ph: '예: 8' }), F('bandUnit', '실적 띠 단위', 'text', { ph: '예: 명' }), F('bandOrder', '실적 띠 순서', 'number')]],
      ['노출', [F('hidden', '사이트에서 숨기기', 'bool')]],
    ],
  },
  notices: {
    title: '공지사항', one: '공지', view: '#/notice',
    desc: '공지사항 게시판과 홈 공지 목록입니다. "상단 고정"한 글이 먼저 나옵니다.',
    cols: [['pinned', '고정'], ['category', '분류'], ['title', '제목'], ['date', '게시일']],
    filters: [['category', '분류', () => S(['안내', '개강', '설명회', '실적', '예비고1', '진단고사', '휴원'])]],
    sections: [['공지', [F('title', '제목', 'text', { req: true }), F('category', '분류', 'select', { opts: () => S(['안내', '개강', '설명회', '실적', '예비고1', '진단고사', '휴원']) }), F('date', '게시일', 'date'), F('pinned', '상단 고정', 'bool'), F('image', '이미지', 'image'), F('body', '내용', 'textarea', { rows: 12 }), F('hidden', '사이트에서 숨기기', 'bool')]]],
  },
  faqs: {
    title: '자주 묻는 질문', one: '질문', view: '#/faq', sortable: true,
    cols: [['category', '분류'], ['q', '질문']],
    sections: [['질문', [F('category', '분류', 'select', { opts: () => S(['수강', '수업', '설명회', '기타']) }), F('q', '질문', 'text', { req: true }), F('a', '답변', 'textarea', { req: true }), F('order', '정렬 순서', 'number'), F('hidden', '사이트에서 숨기기', 'bool')]]],
  },
  quicklinks: {
    title: '홈 학습콘텐츠', one: '바로가기', view: '#/', sortable: true,
    desc: '홈 "학습콘텐츠"의 바로가기 칸입니다. "크게"를 켠 칸은 두 칸 너비로 나옵니다.',
    cols: [['title', '제목'], ['href', '링크'], ['big', '크게']],
    sections: [['바로가기', [F('title', '제목', 'textarea', { rows: 2, req: true, hint: '줄바꿈이 그대로 보입니다.' }), F('sub', '작은 설명(크게일 때)', 'textarea', { rows: 2 }), F('href', '누르면 갈 곳', 'link'), F('big', '크게', 'bool'), F('order', '순서', 'number'), F('hidden', '숨기기', 'bool')]]],
  },
  schools: {
    title: '학교', one: '학교', view: '#/timetable',
    desc: '시간표 학교 필터와 메뉴에 쓰는 학교 목록입니다.',
    cols: [['id', '짧은 이름'], ['full', '정식 이름'], ['type', '구분'], ['grades', '학년']],
    idField: 'id',
    sections: [['학교', [F('id', '짧은 이름(시간표 표기)', 'text', { req: true, hint: '저장 후에는 바꿀 수 없습니다.' }), F('full', '정식 이름', 'text'), F('type', '구분', 'text'), F('grades', '학년', 'list'), F('hidden', '숨기기', 'bool')]]],
  },
};

/* ───────────── 접수 ───────────── */
const REQ = {
  applications: {
    title: '수강 신청', statuses: ['접수', '연락완료', '등록', '대기', '취소'], noteKey: 'adminNote', noteLabel: '관리 메모 (회원의 내 신청 내역에 보입니다)',
    who: (r) => r.studentName, what: (r) => `${r.classLabel || ''}${r.kind === 'waitlist' ? ' (대기)' : ''}`,
    head: ['접수일', '구분', '강좌', '선생님', '학생', '연락처', '학교', '메모'],
    cols: (r) => [fmtDate(r.createdAt), r.kind === 'waitlist' ? '대기' : '수강', r.classLabel, r.teacherName, r.studentName, r.phone, `${r.school || ''} ${r.grade || ''}`, r.memo],
    detail: [['강좌', 'classLabel'], ['선생님', 'teacherName'], ['학생', 'studentName'], ['연락처', 'phone'], ['학교', (r) => `${r.school || ''} ${r.grade || ''}`], ['남긴 말', 'memo']],
  },
  reservations: {
    title: '설명회·진단고사 예약', statuses: ['접수', '확정', '참석', '불참', '취소'], noteKey: 'adminNote', noteLabel: '관리 메모',
    who: (r) => r.name, what: (r) => r.eventTitle,
    head: ['접수일', '설명회', '이름', '연락처', '학교', '인원', '과목', '희망 일시'],
    cols: (r) => [fmtDate(r.createdAt), r.eventTitle, r.name, r.phone, `${r.school || ''} ${r.grade || ''}`, r.people || '', r.subjects || '', r.wish || ''],
    detail: [['설명회', 'eventTitle'], ['이름', 'name'], ['연락처', 'phone'], ['학교', (r) => `${r.school || ''} ${r.grade || ''}`], ['인원', 'people'], ['과목', 'subjects'], ['희망 일시', 'wish']],
  },
  consults: {
    title: '온라인 상담', statuses: ['접수', '답변완료', '전화완료'], noteKey: 'answer', noteLabel: '답변 (회원은 마이페이지에서 봅니다)',
    who: (r) => r.name, what: (r) => r.title,
    head: ['접수일', '분야', '제목', '이름', '연락처', '학교', '답변'],
    cols: (r) => [fmtDate(r.createdAt), r.topic, r.title, r.name, r.phone, `${r.school || ''} ${r.grade || ''}`, r.answer ? '답변함' : ''],
    detail: [['분야', 'topic'], ['관심 과목', 'subject'], ['제목', 'title'], ['내용', 'body'], ['이름', 'name'], ['연락처', 'phone'], ['학교', (r) => `${r.school || ''} ${r.grade || ''}`]],
  },
  visits: {
    title: '방문 상담', statuses: ['접수', '확정', '완료', '취소'], noteKey: 'adminNote', noteLabel: '관리 메모',
    who: (r) => r.name, what: (r) => `${r.date || ''} ${r.time || ''} 방문`,
    head: ['접수일', '희망 일시', '장소', '이름', '연락처', '학교', '메모'],
    cols: (r) => [fmtDate(r.createdAt), `${r.date} ${r.time}`, r.branch, r.name, r.phone, `${r.school || ''} ${r.grade || ''}`, r.memo],
    detail: [['희망 일시', (r) => `${r.date || ''} ${r.time || ''}`], ['장소', 'branch'], ['이름', 'name'], ['연락처', 'phone'], ['학교', (r) => `${r.school || ''} ${r.grade || ''}`], ['메모', 'memo']],
  },
};

const NAV = [
  ['', [['', '대시보드']]],
  ['접수 관리', [['applications', '수강 신청'], ['reservations', '설명회 예약'], ['consults', '온라인 상담'], ['visits', '방문 상담']]],
  ['수업·선생님', [['classes', '강좌·시간표'], ['teachers', '선생님'], ['leaders', '소장·연사'], ['bandPosts', '강의계획·설명회 안내']]],
  ['소식·결과', [['events', '설명회·특강'], ['results', '시험 결과'], ['notices', '공지사항'], ['faqs', '자주 묻는 질문']]],
  ['홈 화면·사이트', [['quicklinks', '홈 학습콘텐츠'], ['settings', '사이트 정보'], ['schools', '학교']]],
  ['관리', [['users', '회원'], ['data', '데이터 백업']]],
];

/* ───────────── 진입 ───────────── */
export async function render({ el, params, query = {}, go }) {
  const u = getUser();
  if (!u) return go('#/login?next=/admin');
  if (!isAdmin()) {
    el.innerHTML = `<div class="wrap page"><div class="narrow card"><h2 style="font-size:20px;font-weight:900">관리자만 볼 수 있습니다.</h2>
      <p style="margin-top:8px;color:var(--muted)">관리자 Google 계정으로 로그인했는지 확인해 주세요. 다른 관리자는 관리자 &gt; 회원에서 지정할 수 있습니다.</p>
      <p style="margin-top:14px"><a class="btn" href="#/">홈으로</a></p></div></div>`;
    return;
  }
  const tab = params.tab || '';
  const reqData = {};
  await Promise.all(Object.keys(REQ).map(async (c) => { reqData[c] = await backend.db.list(c).catch(() => []); }));
  const pending = Object.fromEntries(Object.entries(reqData).map(([c, rows]) => [c, rows.filter((r) => r.status === '접수').length]));

  el.innerHTML = `<div class="adm">
    <aside class="adm-side">
      <a class="adm-title" href="#/admin">관리자 모드</a>
      <nav aria-label="관리 메뉴">${NAV.map(([g, items]) => `${g ? `<p class="adm-g">${g}</p>` : ''}${items.map(([k, t]) => `<a href="#/admin${k ? '/' + k : ''}" ${tab === k ? 'aria-current="page"' : ''}><span>${t}</span>${pending[k] ? `<b class="cnt num">${pending[k]}</b>` : ''}</a>`).join('')}`).join('')}</nav>
      <a class="adm-site" href="#/" target="_blank" rel="noopener">사이트 새 창으로 보기 ↗</a>
    </aside>
    <section class="adm-main" id="am"></section></div>`;
  const main = $('#am', el);
  try {
    if (!tab) await dashboard(main, reqData, pending);
    else if (REQ[tab]) await requests(main, tab, reqData[tab], query);
    else if (SCHEMA[tab]) await content(main, tab, query);
    else if (tab === 'users') await users(main);
    else if (tab === 'settings') await settings(main);
    else if (tab === 'data') await data(main);
    else main.innerHTML = '<p class="empty">없는 메뉴입니다.</p>';
  } catch (e) {
    main.innerHTML = `<div class="callout seal">불러오지 못했습니다: ${esc(e.message)}<br>잠시 후 다시 열어 보세요. 계속되면 로그아웃 후 다시 로그인해 주세요.</div>`;
  }
}

const head = (title, desc = '', actions = '') => `<header class="adm-head"><div><h1>${esc(title)}</h1>${desc ? `<p>${desc}</p>` : ''}</div><div class="adm-act">${actions}</div></header>`;
const ago = (iso) => {
  if (!iso) return ''; const m = Math.round((Date.now() - new Date(iso)) / 60000);
  return m < 1 ? '방금' : m < 60 ? `${m}분 전` : m < 1440 ? `${Math.round(m / 60)}시간 전` : fmtDate(iso);
};

/* 처음 수정할 때 기본 데이터를 저장소로 옮깁니다 */
async function ensureSeeded(col) {
  if (backend.mode !== 'firebase' || !CONTENT[col]) return;
  if (await backend.db.isSeeded(col)) return;
  await backend.db.seedCollection(col, CONTENT[col]);
  toast('처음 수정이라 지금 보이는 기본 내용을 저장소로 옮겼습니다.');
}

/* ───────────── 대시보드 ───────────── */
async function dashboard(main, reqData, pending) {
  const [classes, events, teachers, notices, site] = await Promise.all(['classes', 'events', 'teachers', 'notices'].map((c) => backend.db.list(c).catch(() => [])).concat(getSite()));
  const open = classes.filter((c) => c.term === 'final' && !c.hidden);
  const todo = Object.entries(reqData).flatMap(([c, rows]) => rows.filter((r) => r.status === '접수').map((r) => ({ c, r })))
    .sort((a, b) => (b.r.createdAt || '').localeCompare(a.r.createdAt || '')).slice(0, 8);
  const missing = [['hours', '운영·상담 시간'], ['kakaoUrl', '카카오톡 채널 주소'], ['directorName', '원장 이름']].filter(([k]) => !site[k]);
  if (!site.branches?.[1]?.address) missing.push(['annex', '2관 주소']);
  const d = new Date();
  main.innerHTML = `${head('대시보드', `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 · ${esc(getUser().name || '')}님, 오늘 처리할 일을 모았습니다.`)}
  ${backend.mode === 'local' ? '<div class="callout">체험 모드입니다. 여기서 바꾼 내용은 이 브라우저에만 저장됩니다.</div>' : ''}
  <div class="kpis">${Object.entries(REQ).map(([k, v]) => `<a class="kpi ${pending[k] ? 'hot' : ''}" href="#/admin/${k}"><span>새 ${v.title}</span><b class="num">${pending[k] || 0}<small>건</small></b><em>전체 ${reqData[k].length}건 ›</em></a>`).join('')}</div>
  <div class="adm-cols">
    <section class="adm-card"><h2>처리 대기 <small>상태가 "접수"인 신청</small></h2>
      ${todo.length ? `<ul class="todo">${todo.map(({ c, r }) => `<li><a href="#/admin/${c}?open=${esc(r.id)}"><span class="tag">${esc(REQ[c].title)}</span><b>${esc(REQ[c].who(r) || '이름 없음')}</b><span class="t">${esc(REQ[c].what(r) || '')}</span><time>${esc(ago(r.createdAt))}</time></a></li>`).join('')}</ul>` : '<p class="empty">처리할 신청이 없습니다. 👍</p>'}
    </section>
    <div>
      <section class="adm-card"><h2>빠른 작업</h2>
        <div class="qa-grid">
          <a href="#/admin/notices?new=1">＋ 공지 쓰기</a><a href="#/admin/classes?new=1">＋ 강좌 추가</a><a href="#/admin/events?new=1">＋ 설명회 추가</a>
          <a href="#/admin/results?new=1">＋ 시험 결과 추가</a><a href="#/admin/bandPosts?new=1">＋ 강의계획 안내</a><a href="#/admin/quicklinks">홈 바로가기 바꾸기</a>
        </div></section>
      <section class="adm-card"><h2>사이트 현황</h2>
        <dl class="mini">
          <div><dt>기말대비 반</dt><dd class="num">${open.length}</dd></div><div><dt>마감된 반</dt><dd class="num">${open.filter((c) => c.status === '마감').length}</dd></div>
          <div><dt>예약 받는 설명회</dt><dd class="num">${events.filter((e) => ['모집중', '마감임박'].includes(e.status) && !e.hidden).length}</dd></div>
          <div><dt>선생님</dt><dd class="num">${teachers.filter((t) => !t.hidden).length}</dd></div><div><dt>공지</dt><dd class="num">${notices.length}</dd></div>
        </dl></section>
      ${missing.length ? `<section class="adm-card warn"><h2>채워 주세요</h2><p>사이트에 아직 비어 있는 정보: ${missing.map(([, t]) => `<b>${t}</b>`).join(', ')}</p><a class="btn sm" href="#/admin/settings">사이트 정보 열기</a></section>` : ''}
    </div>
  </div>`;
}

/* ───────────── 공통: 오른쪽 편집 창 ───────────── */
function drawer({ title, sub = '', body, foot = '', wide = false, onMount }) {
  const prev = document.activeElement;
  const el = document.createElement('div');
  el.className = 'drw';
  el.innerHTML = `<div class="drw-dim"></div><aside class="drw-box ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="drw-t">
    <header class="drw-h"><div><h2 id="drw-t">${esc(title)}</h2>${sub ? `<p>${sub}</p>` : ''}</div><button class="drw-x" type="button" aria-label="닫기">✕</button></header>
    <div class="drw-b">${body}</div>${foot ? `<footer class="drw-f">${foot}</footer>` : ''}</aside>`;
  let dirty = false;
  const close = async (force) => {
    if (dirty && force !== true && !(await confirmBox('저장하지 않은 내용이 있습니다. 닫을까요?'))) return;
    el.remove(); document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; prev?.focus?.();
  };
  const onKey = (e) => { if (e.key === 'Escape' && !document.querySelector('.modal')) close(); };
  el.querySelector('.drw-dim').onclick = () => close();
  el.querySelector('.drw-x').onclick = () => close();
  document.addEventListener('keydown', onKey);
  document.body.appendChild(el); document.body.style.overflow = 'hidden';
  el.addEventListener('input', () => { dirty = true; });
  el.addEventListener('change', () => { dirty = true; });
  requestAnimationFrame(() => el.classList.add('open'));
  onMount?.(el.querySelector('.drw-box'), close, () => { dirty = false; });
  (el.querySelector('input:not([type=hidden]), select, textarea') || el.querySelector('.drw-x')).focus({ preventScroll: true });
  return close;
}

/* ───────────── 필드 그리기·읽기 ───────────── */
let TEACHERS = [], POSTS = [];
const optList = (o) => (typeof o === 'function' ? o() : o || []);
const imgItem = (f) => `<figure class="img-item" data-f="${esc(f)}"><img ${imgAttrs(f)} alt=""><div><button type="button" data-mv="-1" aria-label="앞으로">◀</button><button type="button" data-mv="1" aria-label="뒤로">▶</button><button type="button" data-rm aria-label="빼기">✕</button></div></figure>`;
const postLabel = (p) => `${p.kind === 'event' ? '[설명회]' : '[강좌]'} ${p.date || ''} ${p.title || ''}`;

function fieldHTML(f, v) {
  const lab = `${esc(f.l)}${f.req ? ' <i class="req">*</i>' : ''}`;
  const hint = f.hint ? `<small>${esc(f.hint)}</small>` : '';
  const ph = f.ph ? ` placeholder="${esc(f.ph)}"` : '';
  switch (f.t) {
    case 'bool':
      return `<label class="tgl-row"><span class="tgl"><input type="checkbox" name="${f.k}" ${v ? 'checked' : ''}><i></i></span><span>${lab}${hint}</span></label>`;
    case 'select':
      return `<label class="field"><span>${lab}</span><select class="select" name="${f.k}">${optList(f.opts).map(([val, t]) => `<option value="${esc(val)}" ${String(v ?? '') === String(val) ? 'selected' : ''}>${esc(t || '(없음)')}</option>`).join('')}</select>${hint}</label>`;
    case 'textarea':
      return `<label class="field full"><span>${lab}</span><textarea class="textarea" name="${f.k}" rows="${f.rows || 5}"${ph}>${esc(v || '')}</textarea>${hint}</label>`;
    case 'list':
      return `<label class="field full"><span>${lab}</span><textarea class="textarea" rows="${Math.max(3, (v || []).length + 1)}" name="${f.k}" placeholder="한 줄에 하나씩">${esc((v || []).join('\n'))}</textarea><small>${esc(f.hint || '한 줄에 하나씩 적습니다.')}</small></label>`;
    case 'teacher':
      return `<label class="field"><span>${lab}</span><input class="input" name="${f.k}" value="${esc(v || '')}" list="dl-teachers" autocomplete="off"${ph}><datalist id="dl-teachers">${TEACHERS.map((t) => `<option value="${esc(t.name)}">${esc(t.subject)}</option>`).join('')}</datalist>${hint}</label>`;
    case 'link':
      return `<label class="field"><span>${lab}</span><input class="input" name="${f.k}" value="${esc(v || '')}" list="dl-links" autocomplete="off" placeholder="#/timetable 또는 https://…"><datalist id="dl-links">${LINKS.map(([h, t]) => `<option value="${esc(h)}">${esc(t)}</option>`).join('')}</datalist><small>목록에서 고르거나 주소를 직접 넣습니다.</small></label>`;
    case 'post':
      return `<label class="field full"><span>${lab}</span><select class="select" name="${f.k}"><option value="">자동으로 고르기</option>${POSTS.filter((p) => p.kind !== 'event').map((p) => `<option value="${esc(p.id)}" ${String(v || '') === String(p.id) ? 'selected' : ''}>${esc(postLabel(p))}</option>`).join('')}</select>${hint}</label>`;
    case 'posts': {
      const sel = (v || []).map(String);
      return `<div class="field full"><span>${lab}</span><div class="pick-list" data-posts="${f.k}">${sel.map((id) => { const p = POSTS.find((x) => String(x.id) === id); return `<div class="pick" data-id="${esc(id)}"><span>${esc(p ? postLabel(p) : `안내 ${id} (없음)`)}</span><button type="button" data-up>▲</button><button type="button" data-x>✕</button></div>`; }).join('')}</div>
        <select class="select" data-posts-add="${f.k}"><option value="">＋ 안내 연결하기</option>${POSTS.filter((p) => p.kind === 'event').concat(POSTS.filter((p) => p.kind !== 'event')).map((p) => `<option value="${esc(p.id)}">${esc(postLabel(p))}</option>`).join('')}</select>${hint}</div>`;
    }
    case 'image':
      return `<div class="field full"><span>${lab}</span><div class="img-one">${v ? `<img src="${esc(v)}" alt="">` : '<em>사진 없음</em>'}</div>
        <div class="toolbar"><label class="btn sm ghost">사진 올리기<input type="file" accept="image/*" data-upload="${f.k}" hidden></label>${v ? `<button type="button" class="btn sm ghost" data-clear="${f.k}">사진 빼기</button>` : ''}</div>
        <input type="hidden" name="${f.k}" value="${esc(v || '')}">${hint}</div>`;
    case 'images':
      return `<div class="field full"><span>${lab}</span><div class="img-list" data-imgs="${f.k}">${(v || []).map(imgItem).join('')}</div>
        <div class="toolbar" style="margin-top:8px"><label class="btn sm ghost">사진 올리기<input type="file" accept="image/*" multiple data-imgs-upload="${f.k}" hidden></label>
        <input class="input" style="flex:1;min-width:200px" data-imgs-url="${f.k}" placeholder="또는 이미지 주소 붙여넣고 Enter (밴드 이미지 우클릭 → 이미지 주소 복사)"></div>${hint}</div>`;
    default:
      return `<label class="field"><span>${lab}</span><input class="input" type="${f.t === 'number' ? 'number' : f.t === 'date' ? 'date' : 'text'}" name="${f.k}" value="${esc(v ?? '')}"${ph}>${hint}</label>`;
  }
}

function bindFields(box, col) {
  hydrateMedia(box);
  // 사진 한 장
  $$('[data-upload]', box).forEach((inp) => (inp.onchange = async () => {
    const file = inp.files[0]; if (!file) return;
    toast('사진을 줄이는 중…');
    try {
      const url = await shrinkImage(file, col === 'notices' ? 1200 : 800);
      const wrap = inp.closest('.field');
      wrap.querySelector(`input[name="${inp.dataset.upload}"]`).value = url;
      wrap.querySelector('.img-one').innerHTML = `<img src="${url}" alt="">`;
      wrap.dispatchEvent(new Event('input', { bubbles: true }));
    } catch (e) { toast(`올리지 못했습니다: ${e.message}`); }
  }));
  $$('[data-clear]', box).forEach((b) => (b.onclick = () => {
    const wrap = b.closest('.field'); wrap.querySelector(`input[name="${b.dataset.clear}"]`).value = ''; wrap.querySelector('.img-one').innerHTML = '<em>사진 없음</em>'; b.remove();
    wrap.dispatchEvent(new Event('input', { bubbles: true }));
  }));
  // 여러 장
  const wire = (list) => {
    $$('[data-mv]', list).forEach((b) => (b.onclick = () => {
      const it = b.closest('.img-item'); const d = Number(b.dataset.mv);
      if (d < 0 && it.previousElementSibling) it.parentNode.insertBefore(it, it.previousElementSibling);
      if (d > 0 && it.nextElementSibling) it.parentNode.insertBefore(it.nextElementSibling, it);
      list.dispatchEvent(new Event('input', { bubbles: true }));
    }));
    $$('[data-rm]', list).forEach((b) => (b.onclick = () => { b.closest('.img-item').remove(); list.dispatchEvent(new Event('input', { bubbles: true })); }));
  };
  $$('[data-imgs]', box).forEach(wire);
  const addImg = (key, f) => { const list = box.querySelector(`[data-imgs="${key}"]`); list.insertAdjacentHTML('beforeend', imgItem(f)); hydrateMedia(list); wire(list); list.dispatchEvent(new Event('input', { bubbles: true })); };
  $$('[data-imgs-url]', box).forEach((inp) => (inp.onkeydown = (e) => {
    if (e.key !== 'Enter') return; e.preventDefault();
    const u = inp.value.trim().split('?')[0];
    if (!/^https?:\/\//.test(u)) { toast('http로 시작하는 이미지 주소를 넣어 주세요.'); return; }
    addImg(inp.dataset.imgsUrl, u); inp.value = '';
  }));
  $$('[data-imgs-upload]', box).forEach((inp) => (inp.onchange = async () => {
    for (const file of inp.files) {
      if (file.size > 20 * 1024 * 1024) { toast(`${file.name}: 20MB 이하만 올릴 수 있습니다.`); continue; }
      toast(`${file.name} 올리는 중…`);
      try {
        let data = await shrinkImage(file, 1600);
        if (data.length > 950000) data = await shrinkImage(file, 1100);
        const id = await backend.db.add('media', { data, name: file.name, from: col });
        addImg(inp.dataset.imgsUpload, `media:${id}`);
      } catch (e) { toast(`올리지 못했습니다: ${e.message}`); }
    }
    inp.value = '';
  }));
  // 안내 연결
  $$('[data-posts]', box).forEach((list) => {
    const wireP = () => {
      $$('[data-x]', list).forEach((b) => (b.onclick = () => { b.closest('.pick').remove(); list.dispatchEvent(new Event('input', { bubbles: true })); }));
      $$('[data-up]', list).forEach((b) => (b.onclick = () => { const it = b.closest('.pick'); if (it.previousElementSibling) list.insertBefore(it, it.previousElementSibling); list.dispatchEvent(new Event('input', { bubbles: true })); }));
    };
    wireP();
    const add = box.querySelector(`[data-posts-add="${list.dataset.posts}"]`);
    add.onchange = () => {
      const id = add.value; add.value = ''; if (!id || list.querySelector(`[data-id="${CSS.escape(id)}"]`)) return;
      const p = POSTS.find((x) => String(x.id) === id);
      list.insertAdjacentHTML('beforeend', `<div class="pick" data-id="${esc(id)}"><span>${esc(postLabel(p))}</span><button type="button" data-up>▲</button><button type="button" data-x>✕</button></div>`);
      wireP();
    };
  });
}

function readFields(form, fields) {
  const out = {};
  for (const f of fields) {
    const el = form.elements[f.k];
    if (f.t === 'bool') out[f.k] = !!el?.checked;
    else if (f.t === 'list') out[f.k] = (el?.value || '').split('\n').map((s) => s.trim()).filter(Boolean);
    else if (f.t === 'number') out[f.k] = el?.value === '' ? null : Number(el.value);
    else if (f.t === 'images') out[f.k] = $$(`[data-imgs="${f.k}"] .img-item`, form).map((x) => x.dataset.f);
    else if (f.t === 'posts') out[f.k] = $$(`[data-posts="${f.k}"] .pick`, form).map((x) => x.dataset.id);
    else out[f.k] = (el?.value ?? '').trim();
  }
  return out;
}

/* ───────────── 콘텐츠 목록 + 편집 ───────────── */
async function content(main, col, query) {
  const cfg = SCHEMA[col];
  const fields = cfg.sections.flatMap(([, fs]) => fs);
  [TEACHERS, POSTS] = await Promise.all([backend.db.list('teachers').catch(() => []), backend.db.list('bandPosts').catch(() => [])]);
  let rows = await backend.db.list(col);
  const st = { q: '', f: { ...(cfg.defaultFilter || {}) }, sel: new Set() };
  const hasHidden = fields.some((f) => f.k === 'hidden');

  main.innerHTML = `${head(cfg.title, cfg.desc || '', `${cfg.view ? `<a class="btn ghost" href="${cfg.view}" target="_blank" rel="noopener">사이트에서 보기 ↗</a>` : ''}<button class="btn" id="add">＋ 새 ${esc(cfg.one)}</button>`)}
    <div class="adm-tools">
      <input class="input" id="fq" placeholder="검색" type="search">
      ${(cfg.filters || []).map(([k, l, opts]) => `<select class="select" data-f="${k}"><option value="">${l} 전체</option>${opts().map(([v, t]) => `<option value="${esc(v)}" ${st.f[k] === v ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>`).join('')}
      <span class="cnt-l" id="cnt"></span>
    </div>
    ${cfg.bulk ? '<div class="bulk" id="bulk" hidden><b id="bn"></b>개 선택 <button class="btn sm ghost" data-b="">모집중으로</button><button class="btn sm ghost" data-b="마감임박">마감임박</button><button class="btn sm ghost" data-b="마감">마감</button><button class="btn sm ghost" data-bh="1">숨기기</button><button class="btn sm ghost" data-bh="0">보이기</button></div>' : ''}
    <div class="tbl-wrap"><table class="adm-tbl"><thead><tr id="th"></tr></thead><tbody id="tb"></tbody></table></div>`;
  // 필터로 하나만 고른 열은 표에서 뺍니다(같은 값이 반복되므로).
  const shownCols = () => cfg.cols.filter(([k]) => !st.f[k]);

  const cell = (r, k) => {
    const v = r[k];
    if (k === 'sg') return esc(`${r.school || ''} ${r.grade || ''}`.trim());
    if (k === 'status') return statusTag(v || '모집중');
    if (k === 'term') return esc(seed.terms.find((t) => t.id === v)?.short || v);
    if (k === 'kind') return v === 'event' ? '<span class="tag">설명회</span>' : '<span class="tag">강좌</span>';
    if (k === 'for') return v === 'pre' ? '예비고1' : '고1·고2';
    if (k === 'photo') return v ? `<img class="th-img round" src="${esc(v)}" alt="">` : '<span class="th-img round none"></span>';
    if (k === 'imgs') return (v || []).length ? `<img class="th-img" ${imgAttrs(v[0])} alt=""><small class="num"> ${v.length}</small>` : '<span class="th-img none"></span>';
    if (k === 'href') return `<code>${esc(v || '')}</code>`;
    if (typeof v === 'boolean') return v ? '✓' : '';
    if (Array.isArray(v)) return esc(v.slice(0, 3).join(', ') + (v.length > 3 ? ` 외 ${v.length - 3}` : ''));
    return esc(String(v ?? '').replace(/\n/g, ' '));
  };
  const sorted = () => rows.filter((r) => Object.entries(st.f).every(([k, v]) => !v || String(r[k] ?? '') === v) && (!st.q || JSON.stringify(r).toLowerCase().includes(st.q.toLowerCase())))
    .sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999) || String(b.date || '').localeCompare(String(a.date || '')));
  const draw = () => {
    const list = sorted();
    $('#cnt', main).textContent = `${list.length}건`;
    $('#th', main).innerHTML = `${cfg.bulk ? '<th class="ck"><input type="checkbox" id="ckall" aria-label="모두 선택"></th>' : ''}${shownCols().map(([, l]) => `<th>${l}</th>`).join('')}${hasHidden ? '<th>노출</th>' : ''}${cfg.sortable ? '<th>순서</th>' : ''}<th></th>`;
    $('#tb', main).innerHTML = list.map((r, i) => `<tr class="${r.hidden ? 'off' : ''}" data-row="${esc(r.id)}">
      ${cfg.bulk ? `<td class="ck"><input type="checkbox" data-ck="${esc(r.id)}" ${st.sel.has(r.id) ? 'checked' : ''} aria-label="선택"></td>` : ''}
      ${shownCols().map(([k]) => `<td class="c-${k}">${cell(r, k)}</td>`).join('')}
      ${hasHidden ? `<td><label class="tgl sm" title="사이트에 보이기"><input type="checkbox" data-vis="${esc(r.id)}" ${r.hidden ? '' : 'checked'}><i></i></label></td>` : ''}
      ${cfg.sortable ? `<td class="ord"><button data-up="${esc(r.id)}" ${i === 0 ? 'disabled' : ''} aria-label="위로">▲</button><button data-dn="${esc(r.id)}" ${i === list.length - 1 ? 'disabled' : ''} aria-label="아래로">▼</button></td>` : ''}
      <td class="act"><button class="btn sm ghost" data-edit="${esc(r.id)}">수정</button><button class="btn sm ghost" data-copy="${esc(r.id)}" title="복제">복제</button><button class="btn sm ghost danger-t" data-del="${esc(r.id)}">삭제</button></td></tr>`).join('')
      || `<tr><td colspan="20" class="empty">항목이 없습니다. 오른쪽 위 "새 ${esc(cfg.one)}"로 추가하세요.</td></tr>`;
    hydrateMedia($('#tb', main));
    $$('[data-edit]', main).forEach((b) => (b.onclick = () => edit(rows.find((r) => r.id === b.dataset.edit))));
    $$('[data-row] td:not(.ck):not(.act):not(.ord)', main).forEach((td) => { if (!td.querySelector('.tgl')) td.onclick = () => edit(rows.find((r) => r.id === td.parentNode.dataset.row)); });
    $$('[data-copy]', main).forEach((b) => (b.onclick = () => { const { id, createdAt, updatedAt, ...rest } = rows.find((r) => r.id === b.dataset.copy); edit(null, { ...rest, hidden: true, ...(rest.title ? { title: `${rest.title} (복사본)` } : {}) }); }));
    $$('[data-del]', main).forEach((b) => (b.onclick = async () => {
      const r = rows.find((x) => x.id === b.dataset.del);
      if (!(await confirmBox(`"${r.title || r.name || r.q || r.t1 || r.id}"을(를) 삭제할까요? 되돌릴 수 없습니다.\n잠시 내리려면 "노출"을 끄세요.`))) return;
      await ensureSeeded(col); await backend.db.remove(col, r.id); rows = rows.filter((x) => x !== r); clearCache(); draw(); toast('삭제했습니다.');
    }));
    $$('[data-vis]', main).forEach((c) => (c.onchange = async () => {
      const r = rows.find((x) => x.id === c.dataset.vis); await ensureSeeded(col);
      await backend.db.update(col, r.id, { hidden: !c.checked }); r.hidden = !c.checked; clearCache(); draw(); toast(c.checked ? '사이트에 보입니다.' : '사이트에서 숨겼습니다.');
    }));
    const move = async (id, d) => {
      const list2 = sorted(); const i = list2.findIndex((r) => r.id === id); const j = i + d; if (j < 0 || j >= list2.length) return;
      [list2[i], list2[j]] = [list2[j], list2[i]];
      await ensureSeeded(col);
      const changed = list2.map((r, k) => ({ r, o: k + 1 })).filter(({ r, o }) => r.order !== o);
      await Promise.all(changed.map(({ r, o }) => { r.order = o; return backend.db.update(col, r.id, { order: o }); }));
      clearCache(); draw();
    };
    $$('[data-up]', main).forEach((b) => (b.onclick = () => move(b.dataset.up, -1)));
    $$('[data-dn]', main).forEach((b) => (b.onclick = () => move(b.dataset.dn, 1)));
    if (cfg.bulk) {
      const all = $('#ckall', main); const vis = list.map((r) => r.id);
      all.checked = vis.length > 0 && vis.every((id) => st.sel.has(id));
      all.onchange = (e) => { list.forEach((r) => (e.target.checked ? st.sel.add(r.id) : st.sel.delete(r.id))); draw(); };
      $$('[data-ck]', main).forEach((c) => (c.onchange = () => { c.checked ? st.sel.add(c.dataset.ck) : st.sel.delete(c.dataset.ck); syncBulk(); }));
      syncBulk();
    }
  };
  const syncBulk = () => { const b = $('#bulk', main); if (!b) return; b.hidden = !st.sel.size; $('#bn', main).textContent = st.sel.size; };
  if (cfg.bulk) {
    $$('[data-b], [data-bh]', main).forEach((b) => (b.onclick = async () => {
      await ensureSeeded(col);
      const patch = b.dataset.bh !== undefined ? { hidden: b.dataset.bh === '1' } : { status: b.dataset.b };
      await Promise.all([...st.sel].map((id) => backend.db.update(col, id, patch).then(() => Object.assign(rows.find((r) => r.id === id), patch))));
      toast(`${st.sel.size}개를 바꿨습니다.`); st.sel.clear(); clearCache(); draw();
    }));
  }

  const edit = (r, preset) => {
    const isNew = !r;
    const base = r || preset || { ...(col === 'notices' ? { date: new Date().toISOString().slice(0, 10), category: '안내' } : {}), ...(col === 'classes' ? { term: st.f.term || 'final' } : {}), ...(col === 'bandPosts' ? { kind: 'class' } : {}), ...(col === 'events' ? { type: '설명회', status: '모집중', place: '태산학원 본관' } : {}) };
    drawer({
      title: isNew ? `새 ${cfg.one}` : `${cfg.one} 수정`,
      sub: isNew ? '' : esc(r.title || r.name || r.q || r.t1 || ''),
      wide: col === 'bandPosts' || col === 'events',
      body: `<form id="ef" novalidate>${cfg.sections.map(([t, fs]) => `<fieldset class="sec"><legend>${esc(t)}</legend><div class="sec-g">${fs.map((f) => (col === 'schools' && f.k === 'id' && !isNew ? fieldHTML({ ...f, t: 'text' }, base[f.k]).replace('<input ', '<input readonly ') : fieldHTML(f, base[f.k]))).join('')}</div></fieldset>`).join('')}<p class="form-error" aria-live="polite"></p></form>`,
      foot: `<span class="kbd">⌘/Ctrl + S 저장</span><button class="btn ghost" type="button" data-cancel>취소</button><button class="btn" type="button" data-save>${isNew ? '추가하기' : '저장하기'}</button>`,
      onMount(box, close, clean) {
        const form = box.querySelector('#ef');
        bindFields(box, col);
        box.querySelector('[data-cancel]').onclick = () => close();
        const save = async () => {
          const d = readFields(form, fields);
          const err = form.querySelector('.form-error');
          const miss = fields.filter((f) => f.req && !(Array.isArray(d[f.k]) ? d[f.k].length : d[f.k]));
          if (miss.length) { err.textContent = `필수 항목을 채워 주세요: ${miss.map((f) => f.l).join(', ')}`; form.elements[miss[0].k]?.focus?.(); return; }
          if (col === 'classes' || col === 'results') d.teacherId = TEACHERS.find((t) => t.name === d.teacherName)?.id || '';
          if (col === 'bandPosts' && !d.bandUrl) delete d.bandUrl;
          const btn = box.querySelector('[data-save]'); btn.disabled = true; btn.textContent = '저장 중…';
          try {
            await ensureSeeded(col);
            if (isNew) {
              const id = cfg.idField ? d[cfg.idField] : col === 'classes' ? `C${Date.now().toString().slice(-7)}` : null;
              if (cfg.idField && rows.some((x) => x.id === id)) throw new Error('같은 이름이 이미 있습니다.');
              if (cfg.sortable && d.order == null) d.order = Math.max(0, ...rows.map((x) => x.order || 0)) + 1;
              if (id) { await backend.db.set(col, id, { ...d, id }); rows.push({ ...d, id }); }
              else { const nid = await backend.db.add(col, d); rows.push({ ...d, id: nid }); }
            } else {
              const { id, createdAt, ...rest } = { ...r, ...d };
              await backend.db.set(col, r.id, { ...rest, ...(createdAt ? { createdAt } : {}) }); Object.assign(r, d);
            }
            clearCache(); clean(); close(true); draw();
            toast(isNew ? '추가했습니다. 사이트에 바로 반영됩니다.' : '저장했습니다. 사이트에 바로 반영됩니다.');
          } catch (ex) { err.textContent = `저장하지 못했습니다: ${ex.message}`; btn.disabled = false; btn.textContent = isNew ? '추가하기' : '저장하기'; }
        };
        box.querySelector('[data-save]').onclick = save;
        box.addEventListener('keydown', (e) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(); } });
      },
    });
  };

  $('#add', main).onclick = () => edit(null);
  $('#fq', main).oninput = (e) => { st.q = e.target.value.trim(); draw(); };
  $$('[data-f]', main).forEach((s) => (s.onchange = () => { st.f[s.dataset.f] = s.value; draw(); }));
  draw();
  if (query.new) edit(null);
  if (query.open) { const r = rows.find((x) => x.id === query.open); if (r) edit(r); }
}

/* ───────────── 접수 목록 ───────────── */
function toCSV(h, rows) {
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return '﻿' + [h, ...rows].map((r) => r.map(q).join(',')).join('\r\n');
}
function download(name, text, type = 'text/csv;charset=utf-8') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

async function requests(main, col, rows0, query) {
  const cfg = REQ[col];
  let rows = [...rows0].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  const st = { status: query.status || '', q: '' };
  const counts = () => Object.fromEntries(cfg.statuses.map((s) => [s, rows.filter((r) => r.status === s).length]));
  main.innerHTML = `${head(cfg.title, '행을 누르면 자세히 보고 상태·메모를 바꿀 수 있습니다.', '<button class="btn ghost" id="csv">엑셀(CSV) 받기</button>')}
    <div class="chips" id="chips"></div>
    <div class="adm-tools"><input class="input" type="search" id="fq" placeholder="이름·연락처·내용 검색"><span class="cnt-l" id="cnt"></span></div>
    <div class="tbl-wrap"><table class="adm-tbl click"><thead><tr>${cfg.head.map((h) => `<th>${h}</th>`).join('')}<th>상태</th></tr></thead><tbody id="tb"></tbody></table></div>`;
  const filtered = () => rows.filter((r) => (!st.status || r.status === st.status) && (!st.q || JSON.stringify(r).includes(st.q)));
  const draw = () => {
    const c = counts();
    $('#chips', main).innerHTML = `<button data-s="" aria-pressed="${!st.status}">전체 <b>${rows.length}</b></button>${cfg.statuses.map((s) => `<button data-s="${s}" aria-pressed="${st.status === s}" class="${s === '접수' && c[s] ? 'hot' : ''}">${s} <b>${c[s]}</b></button>`).join('')}`;
    $$('#chips button', main).forEach((b) => (b.onclick = () => { st.status = b.dataset.s; draw(); }));
    const list = filtered();
    $('#cnt', main).textContent = `${list.length}건`;
    $('#tb', main).innerHTML = list.map((r) => `<tr data-open="${esc(r.id)}" class="${r.status === '접수' ? 'new' : ''}">${cfg.cols(r).map((v) => `<td>${esc(v)}</td>`).join('')}<td>${statusTag(r.status)}</td></tr>`).join('')
      || `<tr><td colspan="${cfg.head.length + 1}" class="empty">${st.status || st.q ? '조건에 맞는 내역이 없습니다.' : '아직 접수된 내역이 없습니다.'}</td></tr>`;
    $$('[data-open]', main).forEach((tr) => (tr.onclick = () => open(rows.find((r) => r.id === tr.dataset.open))));
  };
  const open = (r) => {
    const val = (k) => (typeof k === 'function' ? k(r) : r[k]);
    drawer({
      title: `${cfg.title} · ${cfg.who(r) || ''}`,
      sub: `${esc(fmtDate(r.createdAt))} 접수${r.uid ? ' · 회원' : ' · 비회원'}`,
      body: `<dl class="kv2">${cfg.detail.map(([l, k]) => (val(k) ? `<dt>${l}</dt><dd>${l === '연락처' ? `<a class="link" href="tel:${esc(val(k))}">${esc(val(k))}</a>` : esc(val(k)).replace(/\n/g, '<br>')}</dd>` : '')).join('')}</dl>
        <fieldset class="sec"><legend>상태</legend><div class="seg-st">${cfg.statuses.map((s) => `<button type="button" data-st="${s}" aria-pressed="${r.status === s}">${s}</button>`).join('')}</div></fieldset>
        <fieldset class="sec"><legend>${esc(cfg.noteLabel)}</legend><textarea class="textarea" rows="6" id="note">${esc(r[cfg.noteKey] || '')}</textarea></fieldset>`,
      foot: `<button class="btn ghost danger-t" type="button" data-del>삭제</button><span style="flex:1"></span><button class="btn ghost" type="button" data-cancel>닫기</button><button class="btn" type="button" data-save>저장</button>`,
      onMount(box, close, clean) {
        let status = r.status;
        $$('[data-st]', box).forEach((b) => (b.onclick = () => { status = b.dataset.st; $$('[data-st]', box).forEach((x) => x.setAttribute('aria-pressed', x === b)); box.dispatchEvent(new Event('input', { bubbles: true })); }));
        box.querySelector('[data-cancel]').onclick = () => close();
        box.querySelector('[data-save]').onclick = async () => {
          const note = box.querySelector('#note').value;
          if (col === 'consults' && note && !r.answer && status === '접수') status = '답변완료';
          const patch = { status, [cfg.noteKey]: note };
          await backend.db.update(col, r.id, patch); Object.assign(r, patch); clean(); close(true); draw(); toast('저장했습니다.');
        };
        box.querySelector('[data-del]').onclick = async () => {
          if (!(await confirmBox('이 접수 내역을 삭제할까요? 되돌릴 수 없습니다.'))) return;
          await backend.db.remove(col, r.id); rows = rows.filter((x) => x !== r); clean(); close(true); draw(); toast('삭제했습니다.');
        };
      },
    });
  };
  $('#fq', main).oninput = (e) => { st.q = e.target.value.trim(); draw(); };
  $('#csv', main).onclick = () => download(`${cfg.title}_${new Date().toISOString().slice(0, 10)}.csv`, toCSV([...cfg.head, '상태', '메모'], filtered().map((r) => [...cfg.cols(r), r.status, r[cfg.noteKey] || ''])));
  draw();
  if (query.open) { const r = rows.find((x) => x.id === query.open); if (r) open(r); }
}

/* ───────────── 회원 ───────────── */
async function users(main) {
  let list = (await backend.db.list('users')).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  const st = { q: '' };
  main.innerHTML = `${head('회원', 'Google로 로그인한 회원입니다. 관리자로 지정하면 이 화면을 쓸 수 있습니다.', '<button class="btn ghost" id="csv">엑셀(CSV) 받기</button>')}
    <div class="adm-tools"><input class="input" type="search" id="fq" placeholder="이름·이메일·학교 검색"><span class="cnt-l" id="cnt"></span></div>
    <div class="tbl-wrap"><table class="adm-tbl"><thead><tr><th>가입일</th><th>이름</th><th>이메일</th><th>구분</th><th>연락처</th><th>학교·학년</th><th>문자 수신</th><th>권한</th></tr></thead><tbody id="tb"></tbody></table></div>`;
  const filtered = () => list.filter((u) => !st.q || JSON.stringify(u).includes(st.q));
  const draw = () => {
    const l = filtered(); $('#cnt', main).textContent = `${l.length}명`;
    $('#tb', main).innerHTML = l.map((u) => `<tr><td>${esc(fmtDate(u.createdAt))}</td><td><b>${esc(u.name)}</b></td><td>${esc(u.email)}</td><td>${esc(u.type || '')}</td><td>${u.phone ? `<a class="link" href="tel:${esc(u.phone)}">${esc(u.phone)}</a>` : ''}</td><td>${esc(u.school || '')} ${esc(u.grade || '')}</td><td>${u.marketing ? '동의' : ''}</td>
      <td><select class="select sm" data-role="${esc(u.id)}" ${u.id === getUser().uid ? 'disabled' : ''}><option value="member" ${u.role !== 'admin' ? 'selected' : ''}>회원</option><option value="admin" ${u.role === 'admin' ? 'selected' : ''}>관리자</option></select></td></tr>`).join('') || '<tr><td colspan="8" class="empty">가입한 회원이 없습니다.</td></tr>';
    $$('[data-role]', main).forEach((s) => (s.onchange = async () => {
      if (s.value === 'admin' && !(await confirmBox('이 회원을 관리자로 지정할까요? 사이트의 모든 내용을 바꿀 수 있게 됩니다.'))) { s.value = 'member'; return; }
      await backend.db.update('users', s.dataset.role, { role: s.value }); list.find((u) => u.id === s.dataset.role).role = s.value; toast('권한을 바꿨습니다.');
    }));
  };
  $('#fq', main).oninput = (e) => { st.q = e.target.value.trim(); draw(); };
  $('#csv', main).onclick = () => download(`회원_${new Date().toISOString().slice(0, 10)}.csv`, toCSV(['가입일', '이름', '이메일', '구분', '연락처', '학교', '학년', '학생 이름', '문자 수신', '권한'], filtered().map((u) => [fmtDate(u.createdAt), u.name, u.email, u.type, u.phone, u.school, u.grade, u.studentName, u.marketing ? '동의' : '', u.role])));
  draw();
}

/* ───────────── 사이트 정보 ───────────── */
async function settings(main) {
  const site = await getSite();
  const v = { ...site, mainAddress: site.branches?.[0]?.address || '', annexAddress: site.branches?.[1]?.address || '' };
  const sections = [
    ['연락처', [F('phone', '대표 전화', 'text', { req: true }), F('hours', '운영·상담 시간', 'text', { ph: '예: 평일 14:00~22:00 / 주말 09:00~18:00' }), F('kakaoUrl', '카카오톡 채널 주소', 'text', { ph: 'https://pf.kakao.com/...', hint: '오른쪽 아래 TALK 버튼에 연결됩니다.' }), F('blogUrl', '네이버 밴드 주소', 'text')]],
    ['학원 소개', [F('directorName', '원장 이름', 'text'), F('greeting', '인사말', 'textarea', { rows: 8, hint: '학원 소개 페이지에 나옵니다. 빈 줄로 문단을 나눕니다.' })]],
    ['지점 주소', [F('mainAddress', '본관 주소', 'text'), F('annexAddress', '2관 주소', 'text')]],
    ['홈·시간표 문구', [F('resultBandTitle', '홈 실적 띠 제목', 'text', { ph: '예: 2학기 중간고사 결과' }), F('resultBandNote', '실적 띠 작은 글씨', 'text', { ph: '예: 가채점 포함 (비우면 숨김)' }), F('timetableNotice', '시간표 안내 문구', 'textarea', { rows: 3 })]],
  ];
  const fields = sections.flatMap(([, f]) => f);
  main.innerHTML = `${head('사이트 정보', '전화번호·주소·인사말처럼 사이트 곳곳에 쓰이는 정보입니다.', '<a class="btn ghost" href="#/about" target="_blank" rel="noopener">학원 소개 보기 ↗</a>')}
    <form id="sf" class="adm-form" novalidate>${sections.map(([t, fs]) => `<fieldset class="sec card"><legend>${t}</legend><div class="sec-g">${fs.map((f) => fieldHTML(f, v[f.k])).join('')}</div></fieldset>`).join('')}
    <div class="save-bar"><p class="form-error"></p><button class="btn lg">저장하기</button></div></form>`;
  $('#sf', main).onsubmit = async (e) => {
    e.preventDefault();
    const d = readFields(e.target, fields);
    const branches = (site.branches || seed.site.branches).map((b) => ({ ...b }));
    branches[0].address = d.mainAddress; branches[1].address = d.annexAddress; delete d.mainAddress; delete d.annexAddress;
    await backend.db.setDoc('settings/site', { ...d, branches });
    await refreshSite(); toast('저장했습니다. 사이트에 바로 반영됩니다.');
  };
}

/* ───────────── 데이터 백업 ───────────── */
async function data(main) {
  const cols = Object.keys(CONTENT);
  const state = {};
  for (const c of cols) state[c] = await backend.db.isSeeded(c);
  const name = (c) => SCHEMA[c]?.title || c;
  main.innerHTML = `${head('데이터 백업', '사이트 내용을 파일로 받아 두거나, 처음 상태로 되돌릴 수 있습니다.')}
    <div class="adm-cols"><section class="adm-card"><h2>백업 받기</h2><p class="muted">강좌·선생님·설명회 등 모든 콘텐츠와 사이트 정보를 JSON 파일 하나로 받습니다. 큰 수정 전에 받아 두세요.</p><button class="btn" id="export">백업 파일 받기</button></section>
    <section class="adm-card"><h2>접수 내역 받기</h2><p class="muted">수강 신청·예약·상담은 각 메뉴의 "엑셀(CSV) 받기"로 받을 수 있습니다.</p></section></div>
    ${backend.mode === 'firebase' ? `<section class="adm-card"><h2>콘텐츠 저장 상태</h2><p class="muted">"기본값"은 아직 한 번도 수정하지 않아 처음 만든 내용을 보여주는 상태입니다. 처음 수정하면 자동으로 저장소로 옮겨집니다.</p>
      <table class="adm-tbl"><thead><tr><th>메뉴</th><th>기본 항목 수</th><th>상태</th><th></th></tr></thead><tbody>
      ${cols.map((c) => `<tr><td>${esc(name(c))}</td><td class="num">${CONTENT[c].length}</td><td>${state[c] ? '<span class="tag ok">저장소 사용 중</span>' : '<span class="tag muted">기본값</span>'}</td>
        <td class="act">${state[c] ? `<button class="btn sm ghost danger-t" data-reset="${c}">처음 상태로 되돌리기</button>` : `<button class="btn sm ghost" data-seed="${c}">저장소로 옮기기</button>`}</td></tr>`).join('')}
      </tbody></table></section>`
    : '<section class="adm-card"><h2>체험 데이터</h2><button class="btn danger" id="reset">체험 데이터 모두 지우기</button></section>'}`;
  $$('[data-seed]', main).forEach((b) => (b.onclick = async () => { b.disabled = true; await backend.db.seedCollection(b.dataset.seed, CONTENT[b.dataset.seed]); clearCache(); toast('옮겼습니다.'); data(main); }));
  $$('[data-reset]', main).forEach((b) => (b.onclick = async () => {
    if (!(await confirmBox(`"${name(b.dataset.reset)}"을(를) 처음 만든 내용으로 덮어쓸까요? 같은 항목의 수정 내용이 사라집니다. 먼저 백업을 받아 두세요.`))) return;
    b.disabled = true; await backend.db.seedCollection(b.dataset.reset, CONTENT[b.dataset.reset]); clearCache(); toast('되돌렸습니다.'); data(main);
  }));
  const reset = $('#reset', main);
  if (reset) reset.onclick = async () => {
    if (!(await confirmBox('이 브라우저의 체험 데이터를 모두 지울까요?'))) return;
    Object.keys(localStorage).filter((k) => k.startsWith('taesan:')).forEach((k) => localStorage.removeItem(k));
    location.hash = '#/'; location.reload();
  };
  $('#export', main).onclick = async () => {
    const out = { exportedAt: new Date().toISOString(), site: await getSite() };
    for (const c of cols) out[c] = await backend.db.list(c);
    download(`taesan-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(out, null, 2), 'application/json');
  };
}

