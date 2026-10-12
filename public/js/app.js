import { initBackend, backend, getSite, getUser, isAdmin, onUser, seed } from './backend.js';
import { esc, icons, $, $$ } from './ui.js';

const PAGES = {
  home: () => import('./pages/home.js'),
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
  ['/login', 'account', 'login', ''],
  ['/join', 'account', 'join', ''],
  ['/mypage', 'account', 'mypage', ''],
  ['/search', 'search', 'render', ''],
  ['/admin', 'admin', 'render', ''],
  ['/admin/:tab', 'admin', 'render', ''],
];

const MENU = [
  { key: 'about', label: '학원안내', href: '#/about', items: [
    ['학원 소개', '#/about'], ['공지사항', '#/notice'], ['설명회·특강', '#/events'], ['진단고사 신청', '#/events/e-diag'], ['오시는 길', '#/location'],
  ] },
  { key: 'timetable', label: '시간표', href: '#/timetable', items: [
    ['2학기 기말대비', '#/timetable?term=final'], ['예비고1', '#/timetable?term=pre'], ['2학기 중간대비(지난 학기)', '#/timetable?term=mid'],
  ] },
  { key: 'teachers', label: '선생님', href: '#/teachers', items: [
    ['전체', '#/teachers'], ...seed.subjects.map((s) => [s, `#/teachers?subject=${encodeURIComponent(s)}`]), ['커리큘럼·교재', '#/curriculum'],
  ] },
  { key: 'results', label: '시험 결과', href: '#/results', items: [
    ['2학기 중간고사', '#/results?exam=2026 2학기 중간'], ['전체 결과', '#/results'],
  ] },
  { key: 'consult', label: '상담', href: '#/consult', items: [
    ['온라인 상담', '#/consult'], ['방문 상담 예약', '#/visit'], ['자주 묻는 질문', '#/faq'],
  ] },
];

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

function topbar() {
  const u = getUser();
  return `<div class="topbar"><div class="wrap">
    <div class="tb-left">
      ${backend.mode === 'local' ? '<span class="mode-badge" title="Firebase 연결 전입니다. 입력한 내용은 이 브라우저에만 저장됩니다.">체험 모드</span>' : ''}
      <span>2학기 기말대비 학교별 내신반 개강 중</span>
      <a class="hide-m" href="#/events">예비고1 설명회 예약</a>
    </div>
    <div class="tb-right">
      ${u ? `${isAdmin() ? '<a href="#/admin">관리자</a>' : ''}<a href="#/mypage">${esc(u.name || '내 정보')}님</a><a href="#" data-logout>로그아웃</a>`
          : '<a href="#/login">로그인</a><a href="#/join">회원가입</a>'}
    </div></div></div>`;
}

function header(active) {
  return `<header class="header"><div class="wrap">
    <a class="logo" href="#/" aria-label="태산학원 홈"><b>태산학원</b><small>TAESAN ACADEMY</small></a>
    <nav aria-label="주 메뉴" style="flex:1;height:100%"><ul class="gnb" style="margin:0;padding:0">
      ${MENU.map((m) => `<li><a href="${m.href}" ${active === m.key ? 'aria-current="page"' : ''}>${m.label}</a></li>`).join('')}
    </ul></nav>
    <div class="hd-actions">
      <a class="icon-btn desk" href="#/search" aria-label="검색">${icons.search}</a>
      <a class="btn sm desk" href="#/consult">상담 신청</a>
      <button class="icon-btn menu-btn" aria-label="전체 메뉴 열기" data-drawer>${icons.menu}</button>
    </div>
  </div>
  <div class="mega"><div class="wrap">
    <p class="mega-intro">대전 둔산<br>학교별 고등 내신<br><br>${esc(SITE.phone)}</p>
    ${MENU.map((m) => `<div><h4>${m.label}</h4>${m.items.map(([t, h]) => `<a href="${h}">${esc(t)}</a>`).join('')}</div>`).join('')}
    <div><h4>학교별 시간표</h4>${seed.schools.slice(0, 6).map((s) => `<a href="#/timetable?school=${encodeURIComponent(s.id)}">${s.id}</a>`).join('')}</div>
  </div></div></header>`;
}

function drawer() {
  const u = getUser();
  return `<div class="drawer" id="drawer" aria-hidden="true"><div class="dim" data-close></div>
    <div class="panel" role="dialog" aria-label="전체 메뉴">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <a class="logo" href="#/"><b>태산학원</b></a>
        <button class="icon-btn" data-close aria-label="메뉴 닫기">${icons.close}</button>
      </div>
      <div class="toolbar" style="margin-top:14px">
        ${u ? '<a class="btn sm ghost" href="#/mypage">내 신청 내역</a><a class="btn sm ghost" href="#" data-logout>로그아웃</a>' : '<a class="btn sm" href="#/login">로그인</a><a class="btn sm ghost" href="#/join">회원가입</a>'}
        ${isAdmin() ? '<a class="btn sm ghost" href="#/admin">관리자</a>' : ''}
      </div>
      ${MENU.map((m) => `<h4>${m.label}</h4>${m.items.map(([t, h]) => `<a href="${h}">${esc(t)}</a>`).join('')}`).join('')}
      <h4>검색</h4><a href="#/search">강좌·선생님·공지 검색</a>
    </div></div>`;
}

function footer() {
  const main = SITE.branches[0];
  return `<footer class="footer"><div class="wrap">
    <div>
      <h4>태산학원</h4>
      <a class="tel num" href="tel:${SITE.phone.replace(/-/g, '')}">${esc(SITE.phone)}</a>
      ${SITE.hours ? `<p>${esc(SITE.hours)}</p>` : '<p>상담 가능 시간은 전화로 확인해 주세요.</p>'}
      <div class="links"><a href="#/consult">온라인 상담</a><a href="#/visit">방문 상담 예약</a><a href="#/location">오시는 길</a>${SITE.kakaoUrl ? `<a href="${esc(SITE.kakaoUrl)}" target="_blank" rel="noopener">카카오톡 상담</a>` : ''}</div>
    </div>
    <div>
      <h4>본관</h4><p>${esc(main.address)}</p><p>학원등록번호 ${esc(main.regNo)}(확인 필요)</p>
      <h4 style="margin-top:14px">2관</h4><p>${esc(SITE.branches[1]?.address || '주소는 상담 시 안내')}</p>
    </div>
    <div>
      <h4>바로가기</h4>
      <div class="links" style="margin-top:0;display:grid;gap:6px">
        <a href="#/timetable">시간표</a><a href="#/teachers">선생님</a><a href="#/results">시험 결과</a><a href="#/notice">공지사항</a>
        ${SITE.blogUrl ? `<a href="${esc(SITE.blogUrl)}" target="_blank" rel="noopener">태산학원 밴드</a>` : ''}
      </div>
    </div>
    <p class="copy">© ${new Date().getFullYear()} 태산학원. 개인정보는 상담·신청 확인 목적으로만 사용합니다.</p>
  </div></footer>`;
}

function quick() {
  return `<nav class="quick" aria-label="빠른 상담">
    <a class="main" href="#/consult">${icons.chat}상담</a>
    <a href="tel:${SITE.phone.replace(/-/g, '')}">${icons.phone}전화</a>
    <a href="#/location">${icons.pin}위치</a>
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
  $$('[data-logout]').forEach((a) => a.addEventListener('click', async (e) => {
    e.preventDefault(); await backend.auth.signOut(); go('#/');
  }));
  const dr = $('#drawer');
  $$('[data-drawer]').forEach((b) => (b.onclick = () => { dr.classList.add('open'); dr.setAttribute('aria-hidden', 'false'); dr.querySelector('button').focus(); }));
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
  window.addEventListener('hashchange', render);
  await render();
  ready = true;
})();

export const refreshSite = async () => { SITE = await getSite(); };
