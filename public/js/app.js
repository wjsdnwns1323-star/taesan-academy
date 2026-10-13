import { initBackend, backend, getSite, getUser, isAdmin, onUser, seed } from './backend.js';
import { esc, $, $$, toast } from './ui.js';

const PAGES = {
  home: () => import('./pages/home.js'),
  world: () => import('./pages/world.js'),
  timetable: () => import('./pages/timetable.js'),
  teachers: () => import('./pages/teachers.js'),
  results: () => import('./pages/results.js'),
  events: () => import('./pages/events.js'),
  board: () => import('./pages/board.js'),
  consult: () => import('./pages/consult.js'),
  account: () => import('./pages/account.js'),
  about: () => import('./pages/about.js'),
  search: () => import('./pages/search.js'),
  admin: () => import('./pages/admin.js'),
};

// [경로 패턴, 페이지, 내보낸 함수, 메뉴 키]
const ROUTES = [
  ['/', 'home', 'render', ''],
  ['/timetable', 'timetable', 'render', 'timetable'],
  ['/teachers', 'teachers', 'list', 'teachers'],
  ['/teachers/:id', 'teachers', 'detail', 'teachers'],
  ['/curriculum', 'teachers', 'curriculum', 'teachers'],
  ['/results', 'results', 'render', 'results'],
  ['/events', 'events', 'list', 'about'],
  ['/events/:id', 'events', 'detail', 'about'],
  ['/notice', 'board', 'noticeList', 'about'],
  ['/notice/:id', 'board', 'noticeView', 'about'],
  ['/faq', 'board', 'faq', 'consult'],
  ['/consult', 'consult', 'online', 'consult'],
  ['/visit', 'consult', 'visit', 'consult'],
  ['/about', 'about', 'about', 'about'],
  ['/location', 'about', 'location', 'about'],
  ['/privacy', 'about', 'privacy', 'about'],
  ['/login', 'account', 'login', ''],
  ['/join', 'account', 'join', ''],
  ['/mypage', 'account', 'mypage', ''],
  ['/search', 'search', 'render', ''],
  ['/world', 'world', 'render', 'teachers'],
  ['/admin', 'admin', 'render', ''],
  ['/admin/:tab', 'admin', 'render', ''],
];

// 메뉴: [제목, 링크, 하위메뉴?, 새 글 표시?]
const MENU = [
  { key: 'about', label: '학원안내', href: '#/about', groups: [
    ['학원 소개', '#/about'], ['공지사항', '#/notice'],
    ['학원 상담', '#/consult', [['자주 묻는 질문', '#/faq'], ['온라인 상담', '#/consult'], ['방문 상담 예약', '#/visit']]],
    ['입시설명회·공개특강', '#/events'], ['진단고사 신청', '#/events/e-diag'], ['위치안내', '#/location'],
  ] },
  { key: 'timetable', label: '내신 시간표', href: '#/timetable', groups: [
    ['2026년 2학기', '#/timetable', [['기말대비 학교별 내신반', '#/timetable?term=final', 1], ['중간대비(지난 학기)', '#/timetable?term=mid']]],
    ['예비고1', '#/timetable?term=pre', [['겨울 예비고1 과정', '#/timetable?term=pre', 1]]],
    ['학교별 보기', '#/timetable', seed.schools.slice(0, 6).map((s) => [s.id, `#/timetable?term=final&school=${encodeURIComponent(s.id)}`])],
  ] },
  { key: 'teachers', label: '선생님', href: '#/teachers', groups: [
    ['선생님 커리큘럼', '#/curriculum'],
    ['선생님', '#/teachers', [['전체', '#/teachers'], ...seed.subjects.map((s) => [s, `#/teachers?subject=${encodeURIComponent(s)}`])]],
  ] },
  { key: 'results', label: '시험 결과', href: '#/results', groups: [
    ['2026 2학기 중간고사', '#/results?exam=2026 2학기 중간', [['가채점 결과', '#/results?exam=2026 2학기 중간', 1]]],
    ['전체 결과', '#/results'],
  ] },
  { key: 'pre', label: '예비고1', href: '#/timetable?term=pre', groups: [
    ['예비고1 과정', '#/timetable?term=pre', [['국어 올인원', '#/timetable?term=pre&subject=국어'], ['영어 PRE 반', '#/timetable?term=pre&subject=영어'], ['물리 3단계', '#/timetable?term=pre&subject=물리']]],
    ['고교 선택 설명회', '#/events'], ['대성대신 진단고사', '#/events/e-diag'],
  ] },
  { key: 'my', label: '재원생 전용', href: '#/mypage', groups: [
    ['내 신청 내역', '#/mypage'], ['수강 신청 현황', '#/mypage'], ['온라인 상담 답변', '#/mypage'], ['자주 묻는 질문', '#/faq'],
  ] },
];

const ICON = {
  check: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 1.5l2.6 1.9 3.2-.1 1 3 2.6 1.9-1 3.1 1 3-2.6 1.9-1 3.1-3.2-.1L12 22.5l-2.6-1.9-3.2.1-1-3.1L2.6 15.7l1-3-1-3.1 2.6-1.9 1-3 3.2.1z"/><path d="M8 12l3 3 5-6" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 6h18M3 12h18M3 18h18"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  mountain: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M2 19 9.5 6l4 6.8L16 9l6 10z"/></svg>',
  phone: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6.6 10.8a15.5 15.5 0 0 0 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 0 1 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1z"/></svg>',
  pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 21s-7-6.5-7-12a7 7 0 0 1 14 0c0 5.5-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/></svg>',
  pinF: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a7 7 0 0 0-7 7c0 5.3 7 13 7 13s7-7.7 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z"/></svg>',
  chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21l3-4M7 9h10M7 12.5h7"/></svg>',
};

let SITE = null;

function parseHash() {
  const raw = location.hash.replace(/^#/, '') || '/';
  const [path, qs = ''] = raw.split('?');
  const query = Object.fromEntries(new URLSearchParams(qs));
  for (const [pattern, page, fn, menu] of ROUTES) {
    const pp = pattern.split('/'), ap = path.split('/');
    if (pp.length !== ap.length) continue;
    const params = {};
    if (pp.every((seg, i) => (seg.startsWith(':') ? ((params[seg.slice(1)] = decodeURIComponent(ap[i])), true) : seg === ap[i]))) {
      return { page, fn, menu, params, query, path };
    }
  }
  return { page: null, path, query: {} };
}

export const go = (hash) => { if (location.hash === hash) render(); else location.hash = hash; };

function ddayText() {
  const d = Math.ceil((new Date('2026-11-19T00:00:00+09:00') - new Date()) / 864e5);
  return d > 0 ? `D-${d}` : d === 0 ? 'D-DAY' : '';
}
const NEWB = '<span class="n-badge" aria-label="새 소식">N</span>';
const groupHTML = (cls) => (g) => {
  const [t, h, subs] = g;
  return `<a class="d-h" href="${h}">${esc(t)}</a>${subs ? subs.map(([st, sh, n]) => `<a class="d-s" href="${sh}">${esc(st)}${n ? NEWB : ''}</a>`).join('') : ''}`;
};

function topbar() {
  const u = getUser();
  return `<div class="util"><div class="wrap">
    <div class="util-left">
      ${backend.mode === 'local' ? '<span class="mode-badge" title="Firebase 연결 전입니다. 입력한 내용은 이 브라우저에만 저장됩니다.">체험 모드</span>' : ''}
    </div>
    <div class="util-right">
      <div class="util-links">
        ${u ? `<span class="u-txt who">${esc(u.name || '회원')}님</span><a class="u-link" href="#/mypage">마이페이지</a>${isAdmin() ? '<a class="u-link" href="#/admin">관리자</a>' : ''}<button class="u-link" type="button" data-logout>로그아웃</button>`
            : '<a class="u-link" href="#/login">로그인</a><a class="u-link" href="#/join">회원가입</a>'}
      </div>
      <form class="searchbox" role="search" data-search><span class="pill">검색</span>
        <label class="sr" for="g-q">사이트 검색</label><input id="g-q" name="q" placeholder="강사명, 과목명, 학교명을 입력하세요." autocomplete="off">
        <button aria-label="검색">${ICON.search}</button></form>
    </div>
  </div></div>`;
}

function header(active) {
  return `<header class="header"><div class="wrap">
    <a class="logo" href="#/" aria-label="태산학원 홈">
      <span class="tag-line">대전 둔산<br>학교별 내신</span>
      <img class="logo-img" src="images/brand/logo-dark.png" alt="태산학원 TAESANEDU">
    </a>
    <nav aria-label="주 메뉴" style="flex:1;height:100%;display:flex"><ul class="gnb">
      ${MENU.map((m) => `<li><a href="${m.href}" ${active === m.key ? 'aria-current="page"' : ''}>${m.label}</a>
        <div class="drop">${m.groups.map(groupHTML()).join('')}</div></li>`).join('')}
    </ul></nav>
    <button class="menu-btn" aria-label="전체 메뉴" aria-expanded="false" data-allmenu>${ICON.menu}</button>
  </div>
  <div class="allmenu" id="allmenu"><div class="wrap">
    ${MENU.map((m) => `<div><h4>${m.label}</h4>${m.groups.map(groupHTML()).join('')}</div>`).join('')}
  </div></div></header><div class="dim-all" id="dim-all"></div>`;
}

function drawer() {
  const u = getUser();
  return `<div class="drawer" id="drawer" aria-hidden="true"><div class="dim" data-close></div>
    <div class="panel" role="dialog" aria-label="전체 메뉴">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <a class="logo" href="#/"><img class="logo-img" src="images/brand/logo-dark.png" alt="태산학원"></a>
        <button class="icon-btn" data-close aria-label="메뉴 닫기">${ICON.close}</button>
      </div>
      <form data-search style="display:flex;gap:6px;margin-top:16px"><input class="input" name="q" placeholder="강사·과목·학교 검색" style="min-height:40px"><button class="btn sm">검색</button></form>
      <div class="toolbar" style="margin-top:12px">
        ${u ? '<a class="btn sm ghost" href="#/mypage">마이페이지</a><button class="btn sm dark" type="button" data-logout>로그아웃</button>' : '<a class="btn sm" href="#/login">로그인</a><a class="btn sm ghost" href="#/join">회원가입</a>'}
        ${isAdmin() ? '<a class="btn sm gray" href="#/admin">관리자</a>' : ''}
      </div>
      ${MENU.map((m) => `<h4>${m.label}</h4>${m.groups.map(([t, h]) => `<a href="${h}">${esc(t)}</a>`).join('')}`).join('')}
    </div></div>`;
}

function footer() {
  const main = SITE.branches[0];
  return `<footer class="footer">
    <div class="f-top"><div class="wrap">
      <h4><img src="images/brand/logo-dark.png" alt="태산학원" style="height:52px;display:inline-block;vertical-align:middle"></h4>
      <div><span class="tel">${ICON.phone}<a class="num" href="tel:${SITE.phone.replace(/-/g, '')}">${esc(SITE.phone)}</a>
        ${SITE.hours ? `<span class="hours"><em>상담</em>${esc(SITE.hours)}</span>` : ''}</span>
        ${SITE.hours ? '' : '<p class="note">※ 상담 가능 시간은 전화로 확인해 주세요.</p>'}</div>
      <span class="addr">${ICON.pinF}${esc(main.address)}</span>
    </div></div>
    <div class="f-links"><div class="wrap">
      <a href="#/about">학원소개</a><a href="#/notice">공지사항</a><a href="#/consult">온라인 상담</a><a class="on" href="#/privacy">개인정보처리방침</a>
      ${SITE.blogUrl ? `<a href="${esc(SITE.blogUrl)}" target="_blank" rel="noopener">태산학원 밴드</a>` : ''}
    </div></div>
    <div class="f-info"><div class="wrap">
      <b style="color:var(--sub)">태산학원 본관</b> ${esc(main.address)} | 문의전화 ${esc(SITE.phone)}<br>
      <b style="color:var(--sub)">태산2관</b> ${esc(SITE.branches[1]?.address || '주소는 상담 시 안내')}<br>
      © ${new Date().getFullYear()} 태산학원. 개인정보는 상담·신청 확인 목적으로만 사용합니다.
    </div></div>
  </footer>`;
}

function quick() {
  return `<nav class="quick" aria-label="빠른 상담">
    ${SITE.kakaoUrl ? `<a class="talk" href="${esc(SITE.kakaoUrl)}" target="_blank" rel="noopener" aria-label="카카오톡 상담"><span>TALK</span></a>` : `<a class="talk" href="tel:${SITE.phone.replace(/-/g, '')}" aria-label="전화 상담"><span>CALL</span></a>`}
    <a href="#/consult" aria-label="온라인 상담">${ICON.chat}</a>
    <a href="#/location" aria-label="오시는 길">${ICON.pin}</a>
  </nav>`;
}

async function render() {
  const route = parseHash();
  const app = document.getElementById('app');
  const isAdminPage = route.page === 'admin';
  app.innerHTML = `${topbar()}${header(route.menu)}${drawer()}<main id="main" tabindex="-1"></main>${isAdminPage ? '' : footer() + quick()}`;
  bindShell();
  const main = $('#main');
  if (!route.page) {
    main.innerHTML = `<div class="wrap page"><div class="empty"><p>찾는 페이지가 없습니다.</p><p><a class="btn" href="#/">홈으로</a></p></div></div>`;
    return;
  }
  try {
    const mod = await PAGES[route.page]();
    await mod[route.fn]({ el: main, params: route.params, query: route.query, site: SITE, user: getUser(), go, rerender: render });
  } catch (e) {
    console.error(e);
    main.innerHTML = `<div class="wrap page"><div class="callout seal">페이지를 불러오지 못했습니다: ${esc(e.message)}<br>새로고침해도 같으면 학원으로 연락해 주세요.</div></div>`;
  }
  if (!route.query._keep) window.scrollTo(0, 0);
}

function bindShell() {
  $$('[data-search]').forEach((f) => f.addEventListener('submit', (e) => {
    e.preventDefault(); const q = f.q.value.trim(); go(`#/search?q=${encodeURIComponent(q)}`);
  }));
  const am = $('#allmenu'), dimAll = $('#dim-all'), amBtn = $('[data-allmenu]');
  const setAll = (open) => { am.classList.toggle('open', open); dimAll.classList.toggle('open', open); amBtn.setAttribute('aria-expanded', open); amBtn.innerHTML = open ? ICON.close : ICON.menu; };
  if (amBtn) amBtn.onclick = () => {
    if (window.matchMedia('(max-width: 1000px)').matches) { const dr = $('#drawer'); dr.classList.add('open'); dr.setAttribute('aria-hidden', 'false'); return; }
    setAll(!am.classList.contains('open'));
  };
  if (dimAll) dimAll.onclick = () => setAll(false);
  $$('a', am).forEach((a) => a.addEventListener('click', () => setAll(false)));
  $$('[data-logout]').forEach((a) => a.addEventListener('click', async (e) => {
    e.preventDefault(); await backend.auth.signOut(); toast('로그아웃했습니다.'); go('#/');
  }));
  const dr = $('#drawer');
  $$('[data-close]', dr).forEach((b) => (b.onclick = () => { dr.classList.remove('open'); dr.setAttribute('aria-hidden', 'true'); }));
  $$('a', dr).forEach((a) => a.addEventListener('click', () => dr.classList.remove('open')));
  const skip = $('.skip');
  if (skip) skip.onclick = (e) => { e.preventDefault(); $('#main')?.focus(); };
}

(async function start() {
  await initBackend();
  SITE = await getSite();
  let ready = false;
  onUser(() => { if (ready) render(); });
  window.addEventListener('hashchange', () => { document.querySelectorAll('.modal').forEach((m) => m.remove()); render(); });
  await render();
  ready = true;
})();

export const refreshSite = async () => { SITE = await getSite(); };
