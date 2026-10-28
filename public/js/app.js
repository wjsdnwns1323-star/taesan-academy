// 화면 이동(해시 주소), 틀(위쪽 막대·왼쪽 메뉴·모바일 탭), 홈·게시판·검색·알림·전체 메뉴
import * as be from './backend.js';
import { BOARDS, COMMUNITY_TABS } from './boards.js';
import { SITE_NAME, SITE_DESC, QNA_OPEN } from './config.js';
import {
  esc, $, $$, toast, icon, BOARD_ICON, empty, pageHead, tagHtml, rowHtml, listItemHtml, shortDate, ago, fullDate, getBanners, safeLink, safeImg, modal, confirmBox,
  avatarHtml, newBadge, highlight, dday, readSet,
} from './ui.js';
import { renderPost } from './post.js';
import { renderWrite } from './write.js';
import { renderLogin, renderJoin, renderMe, renderFindId, renderResetPassword } from './account.js';
import { renderAdmin } from './admin.js';
import { renderDoc } from './docs.js';

const view = $('#view');
const AUTH_PAGES = new Set(['login', 'join', 'find-id', 'reset-password']);
const PUBLIC = new Set([...AUTH_PAGES, 'rules', 'privacy', 'data-rules']);
const GUEST_OK = new Set(['home', 'menu', 'community', 'study', 'notices', 'search']);
const WRITE_KEYS = ['news', 'talk', 'school', 'admission', 'data'];

const BOARD_DESC = {
  news: '입시 뉴스와 교육청·대학 발표, 설명회 일정',
  talk: '학생도 학부모도 편하게 이야기해요',
  school: '대전 학교생활·내신·고입 배정 이야기',
  admission: '수시·정시와 진로, 공부법',
  data: '직접 만들었거나 허락받은 자료만 공개됩니다',
  notice: '운영 안내',
  qna: '문제 풀이 질문과 답변',
  all: '모든 게시판의 새 글',
  rec: '최근 7일 동안 반응이 많았던 글',
};

function parse() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [path, qs] = raw.split('?');
  return { parts: path.split('/').filter(Boolean), q: new URLSearchParams(qs || '') };
}
const boardHref = (b) => (b === 'data' ? '#/study' : b === 'notice' ? '#/notices' : `#/community/${b}`);
const currentKey = (page, arg) => (page === 'home' ? 'home' : page === 'study' ? 'data' : page === 'notices' ? 'notice' : page === 'community' ? (arg || 'rec') : page === 'admin' ? 'admin' : page);

let seq = 0;
async function route() {
  const my = ++seq;
  const { parts, q } = parse();
  const [page = 'home', arg] = parts;
  const user = be.currentUser();
  if (!user && !PUBLIC.has(page) && !GUEST_OK.has(page)) {
    if (page === 'post') toast('로그인하면 글 내용을 볼 수 있습니다');
    location.hash = `#/login?next=${encodeURIComponent(location.hash)}`;
    return;
  }
  document.body.className = `page-${page}`;
  $('#app').classList.toggle('bare', AUTH_PAGES.has(page));
  renderChrome(page, arg, q);
  window.scrollTo(0, 0);
  view.innerHTML = '<div class="loading">불러오는 중</div>';
  const ctx = { view, q, arg, alive: () => my === seq, go: (h) => { location.hash = h; } };
  try {
    switch (page) {
      case 'home': await renderHome(ctx); break;
      case 'community': await renderCommunity(ctx, arg || 'rec'); break;
      case 'study': await renderBoard(ctx, 'data'); break;
      case 'notices': await renderBoard(ctx, 'notice'); break;
      case 'post': await renderPost(ctx); break;
      case 'write': case 'edit': await renderWrite(ctx, page === 'edit'); break;
      case 'search': await renderSearch(ctx); break;
      case 'notifications': await renderNotifications(ctx); break;
      case 'menu': renderMenu(ctx); break;
      case 'login': renderLogin(ctx); break;
      case 'join': renderJoin(ctx); break;
      case 'find-id': renderFindId(ctx); break;
      case 'reset-password': renderResetPassword(ctx); break;
      case 'me': await renderMe(ctx); break;
      case 'admin': await renderAdmin(ctx); break;
      case 'rules': case 'privacy': case 'data-rules': renderDoc(ctx, page); break;
      default: view.innerHTML = `${pageHead('페이지를 찾을 수 없습니다')}${empty('주소가 바뀌었거나 삭제된 페이지입니다', 'info')}`;
    }
  } catch (e) {
    console.error(e);
    if (ctx.alive()) {
      view.innerHTML = `${pageHead('문제가 생겼습니다')}${empty(be.errorText(e), 'alert')}<p style="text-align:center"><button class="btn line" type="button" id="retry">다시 시도</button></p>`;
      $('#retry').addEventListener('click', () => route());
    }
  }
  if (ctx.alive()) { refreshBell(); document.title = titleOf(page, arg); }
}

function titleOf(page, arg) {
  const h1 = $('#view h1')?.textContent?.trim();
  return page === 'home' || !h1 ? SITE_NAME : `${h1} · ${SITE_NAME}`;
}

document.addEventListener('click', (e) => {
  if (e.target.closest('[data-back]')) { if (history.length > 1) history.back(); else location.hash = '#/'; }
});

/* ---------------- 틀: 위쪽 막대·왼쪽 메뉴·모바일 탭 ---------------- */
function renderChrome(page, arg, q) {
  const me = be.currentUser();
  const admin = be.isAdmin();
  const key = currentKey(page, arg);
  const writeHref = `#/write?board=${WRITE_KEYS.includes(key) ? key : 'talk'}`;

  $('#gnb-nav').innerHTML = me
    ? `<a href="#/notifications" class="icon-only" aria-label="알림">${icon('bell')}<i class="dot hidden" data-bell></i></a>
       ${admin ? `<a href="#/admin" aria-label="관리자">${icon('shield', 'sm')}관리자<span class="count num" data-queue></span></a>` : ''}
       <a href="#/me">${esc(me.nickname)}님</a>
       <a class="btn" href="${writeHref}">${icon('pen', 'sm')}글쓰기</a>`
    : '<a href="#/login">로그인</a><a class="btn" href="#/join">회원가입</a>';
  $('#gnb-m').innerHTML = `<a href="#/search" aria-label="검색">${icon('search')}</a>
    ${me ? `<a href="#/notifications" aria-label="알림">${icon('bell')}<i class="dot hidden" data-bell></i></a>` : `<a href="#/login" aria-label="로그인">${icon('user')}</a>`}
    <a href="#/menu" aria-label="전체 메뉴">${icon('menu')}</a>`;

  const tabs = [['home', '홈', '#/'], ['rec', '인기글', '#/community/rec'], ['all', '전체글', '#/community/all'],
    ...COMMUNITY_TABS.slice(1).map((t) => [t.id, t.name, `#/community/${t.id}`]), ...(QNA_OPEN ? [['qna', '문제풀이', '#/community/qna']] : []),
    ['data', '자료실', '#/study'], ['notice', '공지', '#/notices'], ...(admin ? [['admin', '관리자', '#/admin']] : [])];
  $('#lnb').innerHTML = tabs.map(([k, n, h]) => `<a href="${h}" class="${k === key ? 'on' : ''}">${n}</a>`).join('');
  $('#lnb .on')?.scrollIntoView({ inline: 'center', block: 'nearest' });

  const curCat = q.get('category') || '';
  const link = (k, label, href, ic, extra = '') => `<a class="side-link${k === key ? ' on' : ''}" href="${href}"${k === key ? ' aria-current="page"' : ''}>${icon(ic)}${esc(label)}${extra}</a>`;
  const board = (b) => link(b, BOARDS[b].name, boardHref(b), BOARD_ICON[b])
    + (b === key ? BOARDS[b].categories.map((c) => `<a class="side-link sub${c.id === curCat ? ' on' : ''}" href="${boardHref(b)}?category=${encodeURIComponent(c.id)}">${esc(c.name)}</a>`).join('') : '');
  $('#side').innerHTML = `
    <div class="side-profile"><span class="logo-tile"><img src="images/logo.webp" alt=""></span><div><b>${esc(SITE_NAME)}</b><span>운영 태산학원 · 대전</span></div></div>
    ${me ? `<div class="side-me">${avatarHtml(me.nickname, me.uid)}<div><b>${esc(me.nickname)}</b><small>${esc(me.grade)}${me.role === 'admin' ? ' · 운영진' : ''}</small></div><a href="#/me">내 정보</a></div>
      <div class="side-actions"><a class="btn wide" href="${writeHref}">${icon('pen', 'sm')}글쓰기</a></div>`
    : '<div class="side-actions"><a class="btn" href="#/join">회원가입</a><a class="btn line" href="#/login">로그인</a></div>'}
    <nav class="side-menu">
      ${link('home', '홈', '#/', 'home')}${link('rec', '인기글', '#/community/rec', 'flame')}${link('all', '전체글', '#/community/all', 'list')}
      <h4>입시 정보</h4>${board('news')}${board('admission')}
      <h4>이야기</h4>${board('talk')}${board('school')}${QNA_OPEN ? board('qna') : ''}
      <h4>자료</h4>${board('data')}
      <h4>안내</h4>${link('notice', '공지사항', '#/notices', 'megaphone')}${link('rules', '이용규칙', '#/rules', 'file')}${link('privacy', '개인정보 처리방침', '#/privacy', 'lock')}
      ${admin ? `<h4>관리</h4>${link('admin', '관리자', '#/admin', 'shield', '<span class="count" data-queue></span>')}` : ''}
    </nav>`;
  if (admin) refreshQueue();
}

async function refreshBell() {
  if (!be.currentUser()) return;
  try {
    const on = await be.hasUnread();
    $$('[data-bell]').forEach((d) => d.classList.toggle('hidden', !on));
  } catch { /* 알림 확인 실패는 무시 */ }
}
// 관리자: 처리할 일(승인 대기 자료 + 열린 신고) 개수
async function refreshQueue() {
  try {
    const [p, r] = await Promise.all([be.listPending(), be.listReports()]);
    const n = p.length + r.length;
    $$('[data-queue]').forEach((el) => { el.textContent = n ? String(n) : ''; el.title = n ? `처리할 일 ${n}건(승인 대기 ${p.length}, 신고 ${r.length})` : ''; });
  } catch { /* 무시 */ }
}

$('#gnb-search').addEventListener('submit', (e) => {
  e.preventDefault();
  const v = e.target.q.value.trim();
  if (v) location.hash = `#/search?q=${encodeURIComponent(v)}`;
});
// '/' 키로 검색창
document.addEventListener('keydown', (e) => {
  if (e.key !== '/' || e.ctrlKey || e.metaKey || /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName)) return;
  const i = $('#gnb-search input');
  if (i && i.offsetParent) { e.preventDefault(); i.focus(); }
});

/* ---------------- 홈 ---------------- */
// 글 상자는 늘 같은 줄 수(옆 상자와 높이를 맞춤)
const SLOTS = 5;
function rowsBox(list, none, opts) {
  const rows = list.slice(0, SLOTS).map((p, i) => rowHtml(p, opts?.rank ? i + 1 : 0, opts)).join('');
  const blank = '<div class="row blank" aria-hidden="true"></div>';
  if (!list.length) return `<div class="row"><span class="t" style="color:var(--muted)">${esc(none)}</span></div>${blank.repeat(SLOTS - 1)}`;
  return rows + blank.repeat(Math.max(0, SLOTS - list.length));
}

async function renderHome(ctx) {
  const { view } = ctx;
  const boards = ['news', 'admission', 'talk', 'school'];
  const panel = (id, title, href, more = '전체 보기') => `<section class="panel"><header class="panel-h"><h2>${title}</h2>${href ? `<a href="${href}">${more}${icon('right', 'sm')}</a>` : ''}</header><div id="${id}">${'<div class="row"><span class="skeleton" style="width:60%"></span></div>'.repeat(SLOTS)}</div></section>`;
  view.innerHTML = `<div class="home">
    <section class="cover" id="cover"><h1 class="cover-title" id="cover-title">${esc(SITE_NAME)}</h1><p class="cover-sub" id="cover-sub">${esc(SITE_DESC)}</p><div class="cover-stats" id="cover-stats"></div></section>
    <div class="home-top">${panel('h-hot', '인기글 <small>최근 7일</small>', '#/community/rec')}${panel('h-events', '입시 일정', be.isAdmin() ? '#/admin?tab=events' : '', '일정 관리')}</div>
    <div class="home-grid">${boards.map((b) => panel(`h-${b}`, BOARDS[b].name, boardHref(b))).join('')}</div>
    <div class="home-grid">${panel('h-notice', '공지사항', '#/notices')}${panel('h-data', '자료실 새 자료', '#/study')}</div>
  </div>`;
  applyCover();
  const [notices, recent, data, banners, ...per] = await Promise.all([
    be.listPosts({ board: 'notice', limit: SLOTS }),
    be.listPosts({ limit: 200 }),
    be.listPosts({ board: 'data', limit: SLOTS }),
    getBanners(be.listBanners),
    ...boards.map((b) => be.listPosts({ board: b, limit: SLOTS + 3 })),
  ]);
  if (!ctx.alive()) return;
  const day = Date.now() - 86400000, week = Date.now() - 7 * 86400000;
  const today = recent.filter((p) => p.createdAt > day).length, thisWeek = recent.filter((p) => p.createdAt > week).length;
  $('#cover-stats').innerHTML = `<span>오늘 새 글<b>${today}</b></span><span>이번 주<b>${thisWeek}</b></span>`;
  $('#h-hot').innerHTML = rowsBox(hot(recent), '최근 7일 동안 올라온 글이 없습니다', { rank: true, by: true });
  $('#h-notice').innerHTML = rowsBox(notices, '공지가 없습니다');
  $('#h-data').innerHTML = rowsBox(data, '공개된 자료가 없습니다');
  boards.forEach((b, i) => { $(`#h-${b}`).innerHTML = rowsBox(per[i].filter((p) => !p.pinned), '등록된 글이 없습니다'); });
  // 입시 일정: 오늘 이후 가까운 순
  const events = banners.filter((x) => x.kind === 'event' && dday(x.date)).sort((a, b) => a.date.localeCompare(b.date));
  const ev = (x) => {
    const d = dday(x.date);
    const n = d === 'D-DAY' ? 0 : +d.slice(2);
    const [, m, dd] = x.date.split('-');
    const title = safeLink(x.link) ? `<a href="${esc(safeLink(x.link))}" ${x.link.startsWith('https') ? 'target="_blank" rel="noopener"' : ''}>${esc(x.text)}</a>` : esc(x.text);
    return `<div class="event${n === 0 ? ' today' : n <= 14 ? ' soon' : ''}"><span class="d">${d}</span><span class="t">${title}</span><time class="num">${+m}월 ${+dd}일</time></div>`;
  };
  $('#h-events').innerHTML = `<div class="events">${events.slice(0, SLOTS).map(ev).join('')
    || `<div class="event"><span class="d">-</span><span class="t" style="color:var(--muted)">${be.isAdmin() ? '관리자 화면에서 일정을 올려 주세요' : '다가오는 일정이 없습니다'}</span><span></span></div>`}${'<div class="event blank" aria-hidden="true"></div>'.repeat(Math.max(0, SLOTS - Math.max(1, Math.min(SLOTS, events.length))))}</div>`;
}

// 최근 7일 글 중 좋아요·댓글이 많은 순
function hot(list) {
  const week = Date.now() - 7 * 86400000;
  const score = (p) => (p.likeCount || 0) * 2 + (p.commentCount || 0) + (p.viewCount || 0) / 20 + (p.createdAt > week ? 3 : 0);
  return list.filter((p) => p.board !== 'notice' && !p.pinned).sort((a, b) => score(b) - score(a) || b.createdAt - a.createdAt);
}

/* ---------------- 게시판 ---------------- */
async function renderCommunity(ctx, tab) {
  if (tab === 'all' || tab === 'rec') return renderBoard(ctx, tab);
  if (!BOARDS[tab] || ['data', 'notice'].includes(tab) || (tab === 'qna' && !QNA_OPEN)) return renderBoard(ctx, 'rec');
  return renderBoard(ctx, tab);
}

async function renderBoard(ctx, board) {
  const { view, q } = ctx;
  const virtual = board === 'all' || board === 'rec';
  const b = virtual ? { name: board === 'all' ? '전체글' : '인기글', categories: [] } : BOARDS[board];
  const cat = q.get('category') || '';
  const per = [15, 30, 50].includes(+q.get('n')) ? +q.get('n') : 15;
  const page = Math.max(1, +q.get('p') || 1);
  const word = (q.get('q') || '').trim(), field = q.get('f') || 'title', period = q.get('d') || '';
  const admin = be.isAdmin();
  const writable = !virtual && (board !== 'notice' || admin) && !!be.currentUser();
  const writeHref = `#/write?board=${board}${cat ? `&category=${encodeURIComponent(cat)}` : ''}`;
  const base = virtual ? `#/community/${board}` : boardHref(board);
  const qs = (patch) => { const u = new URLSearchParams(q); Object.entries(patch).forEach(([k, v]) => (v ? u.set(k, v) : u.delete(k))); const s = u.toString(); return s ? `${base}?${s}` : base; };
  const cols = `<colgroup><col style="width:112px"><col><col style="width:136px"><col style="width:96px"><col style="width:64px"><col style="width:64px">${admin ? '<col style="width:108px">' : ''}</colgroup>`;

  view.innerHTML = `${pageHead(b.name, { desc: BOARD_DESC[board], actions: writable ? `<a class="btn" href="${writeHref}">${icon('pen', 'sm')}글쓰기</a>` : '' })}
    ${board === 'data' ? `<div class="notice-box" style="margin-bottom:16px">${icon('info')}<div>직접 만들었거나 배포 허락을 받은 자료만 올릴 수 있고, 관리자가 확인한 뒤 공개됩니다. <a href="#/data-rules">자료실 규칙</a></div></div>` : ''}
    <div id="cc"></div>
    <div class="board-tools"><div class="left" id="bt-count"></div>
      <div class="right">${!virtual && board !== 'notice' ? `<label class="check"><input type="checkbox" id="hide-n" ${q.get('hn') ? 'checked' : ''}>공지 숨기기</label>` : ''}
        <select class="select sm" id="per" aria-label="한 쪽에 보일 글 수">${[15, 30, 50].map((n) => `<option value="${n}" ${n === per ? 'selected' : ''}>${n}개씩</option>`).join('')}</select></div></div>
    <table class="bt">${cols}
      <thead><tr><th>말머리</th><th class="l">제목</th><th class="l">작성자</th><th class="r">작성일</th><th class="r">조회</th><th class="r">좋아요</th>${admin ? '<th>관리</th>' : ''}</tr></thead>
      <tbody id="bt-body">${'<tr><td colspan="7"><span class="skeleton" style="width:70%"></span></td></tr>'.repeat(6)}</tbody></table>
    <div class="board-foot"><div class="pager" id="pager"></div>
      <form class="board-search" id="bt-search">
        <select class="select" name="d" aria-label="기간"><option value="">전체 기간</option><option value="7" ${period === '7' ? 'selected' : ''}>1주</option><option value="30" ${period === '30' ? 'selected' : ''}>1개월</option><option value="365" ${period === '365' ? 'selected' : ''}>1년</option></select>
        <select class="select" name="f" aria-label="검색 범위"><option value="title">제목</option><option value="all" ${field === 'all' ? 'selected' : ''}>제목+내용</option><option value="author" ${field === 'author' ? 'selected' : ''}>작성자</option></select>
        <input class="input" name="q" value="${esc(word)}" placeholder="검색어 입력" aria-label="검색어">
        <button class="btn line" aria-label="검색">${icon('search', 'sm')}</button></form></div>
`;
  $('#per').addEventListener('change', (e) => ctx.go(qs({ n: e.target.value === '15' ? '' : e.target.value, p: '' })));
  $('#hide-n')?.addEventListener('change', (e) => ctx.go(qs({ hn: e.target.checked ? '1' : '', p: '' })));
  $('#bt-search').addEventListener('submit', (e) => { e.preventDefault(); const f = e.target; ctx.go(qs({ q: f.q.value.trim(), f: f.f.value === 'title' ? '' : f.f.value, d: f.d.value, p: '' })); });

  let all;
  if (board === 'rec') all = hot(await be.listPosts({ limit: 300 })).filter((p) => p.createdAt > Date.now() - 30 * 86400000).slice(0, 100);
  else if (board === 'all') all = (await be.listPosts({ limit: 500 })).filter((p) => p.board !== 'notice');
  else all = await be.listPosts({ board, limit: 500 });
  if (!ctx.alive()) return;

  // 말머리 개수 카드(누르면 그 말머리만)
  if (b.categories.length && board !== 'notice') {
    const body = all.filter((p) => !p.pinned);
    const cards = [['', '전체', body.length], ...b.categories.map((c) => [c.id, c.name, body.filter((p) => p.category === c.id).length])];
    $('#cc').innerHTML = `<nav class="count-cards" style="--n:${cards.length}" aria-label="말머리">${cards.map(([id, n, c]) => `<a href="${qs({ category: id, p: '' })}" class="${id === cat ? 'on' : ''}"${id === cat ? ' aria-current="true"' : ''}><span>${esc(n)}</span><b>${c.toLocaleString()}</b></a>`).join('')}</nav>`;
  }
  const rows = cat ? all.filter((p) => p.category === cat || p.pinned) : all;
  const pins = virtual || board === 'notice' || q.get('hn') ? [] : rows.filter((p) => p.pinned);
  const since = period ? Date.now() - +period * 86400000 : 0;
  const k = word.toLowerCase();
  const hits = rows.filter((p) => (virtual || board === 'notice' || !p.pinned) && p.createdAt >= since && (!k || (field === 'author' ? (p.nickname || '').toLowerCase().includes(k)
    : (field === 'all' ? `${p.title} ${p.excerpt ?? p.body ?? ''}` : p.title).toLowerCase().includes(k))));
  const pages = Math.max(1, Math.ceil(hits.length / per));
  const list = hits.slice((page - 1) * per, page * per);
  $('#bt-count').innerHTML = `${word ? `'${esc(word)}' 검색 결과 ` : ''}<b class="num">${hits.length.toLocaleString()}</b>건`;

  const read = readSet();
  const tr = (p, pin) => `<tr class="${pin ? 'pin' : ''}${read.has(p.id) ? ' read' : ''}">
    <td class="c-cat">${pin ? '<span class="tag notice">공지</span>' : tagHtml(p)}</td>
    <td class="c-title"><a href="#/post/${esc(p.id)}"><span class="t">${word && field !== 'author' ? highlight(p.title, word) : esc(p.title)}</span>${p.imageCount ?? p.images?.length ? icon('image') : ''}${p.fileCount ?? p.files?.length ? icon('clip') : ''}${p.commentCount ? `<span class="cmt">${p.commentCount}</span>` : ''}${newBadge(p)}${p.board === 'data' && !p.approved ? '<span class="tag warn">승인 대기</span>' : ''}</a></td>
    <td class="c-author" data-uid="${admin ? esc(p.uid) : ''}">${esc(p.nickname)}<small>${esc(p.grade)}</small></td>
    <td class="r">${shortDate(p.createdAt)}</td><td class="r">${(p.viewCount || 0).toLocaleString()}</td><td class="r">${(p.likeCount || 0).toLocaleString()}</td>
    ${admin ? `<td class="c-adm" data-pid="${esc(p.id)}"><button type="button" data-hide>숨김</button><button type="button" data-del>삭제</button></td>` : ''}
    <td class="m-meta">${esc(p.nickname)} · <span class="num">${shortDate(p.createdAt)}</span> · 조회 ${(p.viewCount || 0).toLocaleString()}${p.likeCount ? ` · 좋아요 ${p.likeCount}` : ''}</td></tr>`;
  $('#bt-body').innerHTML = (page === 1 ? pins.map((p) => tr(p, true)).join('') : '') + list.map((p) => tr(p, false)).join('')
    || `<tr><td colspan="7" class="empty">${icon(word ? 'search' : 'inbox')}<p>${word ? '검색 결과가 없습니다' : cat ? '이 말머리에는 아직 글이 없습니다' : '등록된 글이 없습니다'}</p>${writable && !word ? `<a class="btn line sm" href="${writeHref}">첫 글 쓰기</a>` : ''}</td></tr>`;

  // 쪽 번호(10쪽씩)
  const start = Math.floor((page - 1) / 10) * 10 + 1, end = Math.min(pages, start + 9);
  $('#pager').innerHTML = pages > 1 ? `${start > 1 ? `<a href="${qs({ p: String(start - 1) })}" aria-label="이전 10쪽">${icon('left', 'sm')}</a>` : ''}
    ${Array.from({ length: end - start + 1 }, (_, i) => start + i).map((n) => `<a class="${n === page ? 'on' : ''}" href="${qs({ p: n === 1 ? '' : String(n) })}"${n === page ? ' aria-current="page"' : ''}>${n}</a>`).join('')}
    ${end < pages ? `<a href="${qs({ p: String(end + 1) })}" aria-label="다음 10쪽">${icon('right', 'sm')}</a>` : ''}` : '';

  if (admin) {
    $('#bt-body').addEventListener('click', async (e) => {
      const cell = e.target.closest('td.c-adm');
      if (!cell) return;
      const p = rows.find((x) => x.id === cell.dataset.pid);
      try {
        if (e.target.closest('[data-hide]') && await confirmBox('글 숨기기', `'${p.title}' 글을 숨깁니다. 관리자 화면의 글 관리에서 다시 공개할 수 있습니다.`, '숨기기')) {
          await be.setHidden(p, true); cell.closest('tr').remove(); toast('글을 숨겼습니다');
        }
        if (e.target.closest('[data-del]') && await confirmBox('글 삭제', `'${p.title}' 글을 삭제합니다. 삭제한 글은 되돌릴 수 없습니다.`, '삭제', true)) {
          await be.deletePost(p); cell.closest('tr').remove(); toast('글을 삭제했습니다');
        }
      } catch (err) { toast(be.errorText(err)); }
    });
  }
}

/* ---------------- 검색 ---------------- */
async function renderSearch(ctx) {
  const { view, q } = ctx;
  const word = (q.get('q') || '').trim();
  view.innerHTML = `${pageHead('검색', { desc: '모든 게시판의 제목과 내용에서 찾습니다' })}
    <form class="inline" id="sf" style="max-width:560px"><input class="input" name="q" placeholder="찾을 단어" value="${esc(word)}" aria-label="검색어" enterkeyhint="search"><button class="btn">검색</button></form>
    <div class="section" id="res" style="margin-top:24px"></div>`;
  $('#sf').addEventListener('submit', (e) => { e.preventDefault(); const v = e.target.q.value.trim(); if (v) ctx.go(`#/search?q=${encodeURIComponent(v)}`); });
  if (!word) { $('#res').innerHTML = empty('찾을 단어를 입력해 주세요', 'search'); $('#sf input').focus(); return; }
  const rows = await be.listPosts({ limit: 500 });
  if (!ctx.alive()) return;
  const k = word.toLowerCase();
  const hits = rows.filter((p) => `${p.title} ${p.excerpt ?? p.body ?? ''} ${p.nickname}`.toLowerCase().includes(k));
  $('#res').innerHTML = `<p class="hint" style="margin-bottom:12px">'${esc(word)}' 검색 결과 <b class="num" style="color:var(--text)">${hits.length}</b>건${be.currentUser() ? '' : ' · 로그인하면 내용까지 찾습니다'}</p>`
    + (hits.length ? `<div class="list">${hits.map((p) => listItemHtml(p, word)).join('')}</div>` : empty('검색 결과가 없습니다', 'search'));
}

/* ---------------- 알림 ---------------- */
async function renderNotifications(ctx) {
  const { view } = ctx;
  view.innerHTML = `${pageHead('알림', { desc: '내 글과 댓글에 생긴 일을 알려 드려요' })}<div id="nl"><div class="loading">불러오는 중</div></div>`;
  const list = await be.listNotifications();
  if (!ctx.alive()) return;
  const text = (n) => ({
    comment: ['chat', `<b>${esc(n.fromName)}</b>님이 내 글에 댓글을 남겼습니다`, n.text],
    reply: ['reply', `<b>${esc(n.fromName)}</b>님이 내 댓글에 답글을 남겼습니다`, n.text],
    accepted: ['check', `<b>${esc(n.fromName)}</b>님이 내 답변을 채택했습니다`, n.text],
    approved: ['check', '올린 자료가 승인되어 공개되었습니다', n.text],
    rejected: ['alert', '자료실 규칙에 맞지 않아 자료가 삭제되었습니다', n.text],
  }[n.type] || ['bell', '알림', n.text]);
  $('#nl').innerHTML = list.length ? `<div class="list">${list.map((n) => {
    const [ic, t, sub] = text(n);
    return `<a class="list-item ${n.read ? '' : 'unread'}" href="${n.type === 'rejected' ? '#/study' : `#/post/${esc(n.postId)}`}">${icon(ic)}<div class="main"><p>${t}</p>
      <div class="m"><span class="q">${esc(sub)}</span><span>${ago(n.createdAt)}</span></div></div></a>`;
  }).join('')}</div>` : empty('새 알림이 없습니다', 'bell');
  be.markRead(list).then(() => $$('[data-bell]').forEach((d) => d.classList.add('hidden'))).catch(() => {});
}

/* ---------------- 전체 메뉴(모바일) ---------------- */
function renderMenu({ view }) {
  const me = be.currentUser();
  const a = (href, label) => `<a href="${href}">${esc(label)}${icon('right', 'sm')}</a>`;
  view.innerHTML = `${pageHead('전체 메뉴')}
    <div class="side-me" style="margin:0 0 24px">${me
      ? `${avatarHtml(me.nickname, me.uid)}<div><b>${esc(me.nickname)}</b><small>@${esc(me.username)} · ${esc(me.grade)}${me.role === 'admin' ? ' · 운영진' : ''}</small></div><a href="#/me">내 정보</a>`
      : '<span class="logo-tile"><img src="images/logo.webp" alt=""></span><div><b>태산입시</b><small>로그인하면 글 내용을 볼 수 있습니다</small></div>'}</div>
    ${me ? '' : '<div class="grid-2" style="margin-bottom:24px"><a class="btn line" href="#/login">로그인</a><a class="btn" href="#/join">회원가입</a></div>'}
    <div class="menu-group"><h2>게시판</h2>${a('#/community/rec', '인기글')}${a('#/community/all', '전체글')}${COMMUNITY_TABS.slice(1).map((t) => a(`#/community/${t.id}`, t.name)).join('')}${QNA_OPEN ? a('#/community/qna', '문제풀이') : ''}${a('#/study', '자료실')}${a('#/notices', '공지사항')}</div>
    ${me ? `<div class="menu-group"><h2>내 활동</h2>${a('#/me', '내 정보')}${a('#/me?tab=posts', '내가 쓴 글')}${be.has('listMyComments') ? a('#/me?tab=comments', '내 댓글') + a('#/me?tab=bookmarks', '스크랩') : ''}${a('#/notifications', '알림')}</div>` : ''}
    ${me?.role === 'admin' ? `<div class="menu-group"><h2>관리</h2>${a('#/admin?tab=users', '회원 관리')}${a('#/admin?tab=posts', '글 관리')}${a('#/admin?tab=cover', '표지')}${be.has('events') ? a('#/admin?tab=events', '입시 일정') : ''}${a('#/write?board=notice', '공지 쓰기')}</div>` : ''}
    <div class="menu-group"><h2>안내</h2>${a('#/rules', '이용규칙')}${a('#/data-rules', '자료실 규칙')}${a('#/privacy', '개인정보 처리방침')}
      ${me ? '<button type="button" id="logout" style="color:var(--muted)">로그아웃</button>' : ''}</div>`;
  $('#logout')?.addEventListener('click', async () => { await be.signOut(); toast('로그아웃했습니다'); location.hash = '#/'; });
}

/* ---------------- 관리자: 작성자를 누르면 회원 정보 ---------------- */
document.addEventListener('click', async (e) => {
  const el = e.target.closest('[data-uid]');
  if (!el || !be.isAdmin() || !el.dataset.uid) return;
  e.preventDefault();
  try {
    const m = await be.getMember(el.dataset.uid);
    if (!m) { toast('탈퇴했거나 없는 회원입니다'); return; }
    const p = m.priv || {};
    const rows = [['아이디', `@${m.username}`], ['닉네임', m.nickname], ['구분', p.memberType || m.grade], ['학년', p.childGrade ? `자녀 ${p.childGrade}` : m.grade],
      ['실명', p.realName], ['휴대폰', p.phone], ['성별', p.gender], ['나이', p.age ? `${p.age}세` : ''], ['보호자 동의', p.guardianConsent ? '예' : ''],
      ['가입일', m.createdAt ? fullDate(m.createdAt) : ''], ['권한', m.role === 'admin' ? '관리자' : '회원'], ['상태', m.banned ? '이용 정지' : '정상']];
    const self = m.uid === be.currentUser().uid;
    const v = await modal({
      title: '회원 정보',
      body: `<dl class="dl">${rows.filter((r) => r[1]).map(([k, val]) => `<div><dt>${k}</dt><dd>${esc(val)}</dd></div>`).join('')}</dl>`,
      buttons: [...(self ? [] : [{ label: m.role === 'admin' ? '관리자 해제' : '관리자 지정', value: 'role', cls: 'line' }, { label: m.banned ? '정지 해제' : '이용 정지', value: 'ban', cls: 'danger' }]), { label: '닫기', value: null, cls: 'dark' }],
    });
    if (v === 'ban' && await confirmBox(m.banned ? '정지 해제' : '이용 정지', `${m.nickname}님을 ${m.banned ? '정지 해제' : '이용 정지'}합니다.`, '확인', !m.banned)) {
      await be.setUserFlags(m.uid, { banned: !m.banned }); toast('변경했습니다');
    }
    if (v === 'role' && await confirmBox('권한 변경', `${m.nickname}님을 ${m.role === 'admin' ? '일반 회원으로' : '관리자로'} 변경합니다.`)) {
      await be.setUserFlags(m.uid, { role: m.role === 'admin' ? 'member' : 'admin' }); toast('변경했습니다');
    }
  } catch (err) { toast(be.errorText(err)); }
});

/* ---------------- 표지·상단 안내·맨 위로 ---------------- */
async function applyCover() {
  const c = (await getBanners(be.listBanners)).find((b) => b.id === 'cover');
  const el = $('#cover');
  if (!c || !el) return;
  if (c.text) $('#cover-title').textContent = c.text;
  if (c.sub) $('#cover-sub').textContent = c.sub;
  const img = safeImg(c.image);
  el.classList.toggle('photo', !!img);
  // 사진 위 글자를 읽을 수 있게 왼쪽을 어둡게 덮습니다(사진 위 글자 보호용 덮개)
  el.style.backgroundImage = img ? `linear-gradient(90deg, rgba(12, 22, 46, 0.78), rgba(12, 22, 46, 0.35)), url("${img}")` : '';
}

async function startTopline() {
  const items = (await getBanners(be.listBanners)).filter((b) => b.kind === 'text' && b.text);
  if (!items.length) return;
  let i = 0;
  const a = $('#tl-text');
  const show = () => { a.textContent = items[i].text; a.href = safeLink(items[i].link) || '#/'; };
  show();
  $('#topline').classList.remove('hidden');
  $$('#topline [data-tl]').forEach((d) => d.classList.toggle('hidden', items.length < 2));
  $('#topline').addEventListener('click', (e) => { const d = e.target.closest('[data-tl]'); if (d) { i = (i + +d.dataset.tl + items.length) % items.length; show(); } });
  if (items.length > 1) setInterval(() => { if (!document.hidden) { i = (i + 1) % items.length; show(); } }, 6000);
}

$('#to-top').addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
window.addEventListener('scroll', () => $('#to-top').classList.toggle('show', window.scrollY > 600), { passive: true });

/* ---------------- 시작 ---------------- */
window.addEventListener('hashchange', route);
be.init().then(() => {
  route();
  startTopline().catch(() => {});
  be.onUser(() => { if (!be.currentUser() || AUTH_PAGES.has(parse().parts[0])) route(); else renderChrome(parse().parts[0] || 'home', parse().parts[1], parse().q); });
}).catch((e) => {
  console.error(e);
  view.innerHTML = empty(`사이트를 불러오지 못했습니다. ${be.errorText(e)}`, 'alert');
});
if (be.DEMO) setTimeout(() => toast('체험 모드: 데이터가 이 브라우저에만 저장됩니다'), 800);
