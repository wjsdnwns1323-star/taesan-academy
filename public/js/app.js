// 화면 이동(해시 주소)과 홈·커뮤니티·자료실·검색·알림·메뉴 화면
import * as be from './backend.js';
import { BOARDS, COMMUNITY_TABS, GRADES, SUBJECTS, DATA_RULES, category } from './boards.js';
import { SITE_NAME, SITE_DESC, ACADEMY_NAME, QNA_OPEN } from './config.js';
import {
  esc, $, $$, ago, toast, topBar, topEnd, backBar, refreshBell, itemHtml, qcardHtml, recCardHtml, fab, bindDots, ICON, bannerSlot, fillBanner, getBanners, safeLink,
} from './ui.js';
import { renderPost } from './post.js';
import { renderWrite } from './write.js';
import { renderLogin, renderJoin, renderMe } from './account.js';
import { renderAdmin } from './admin.js';
import { renderDoc } from './docs.js';

const view = $('#view');
const PUBLIC = new Set(['login', 'join', 'rules', 'privacy', 'data-rules']);

function parse() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [path, qs] = raw.split('?');
  return { parts: path.split('/').filter(Boolean), q: new URLSearchParams(qs || '') };
}

let seq = 0;
async function route() {
  const my = ++seq;
  const { parts, q } = parse();
  const [page = 'home', arg] = parts;
  const nav = { home: 'home', study: 'study', community: 'community', menu: 'menu' }[page] || (page === 'post' ? 'community' : '');
  $$('#bottom-nav a').forEach((a) => a.classList.toggle('on', a.dataset.nav === nav));
  const tab = page === 'home' ? 'home' : page === 'study' ? 'study' : page === 'community' ? arg : '';
  $$('#sh-tabs a').forEach((a) => a.classList.toggle('on', a.dataset.t === tab));
  window.scrollTo(0, 0);
  const user = be.currentUser();
  if (!user && !PUBLIC.has(page) && page !== 'home' && page !== 'menu') {
    location.hash = `#/login?next=${encodeURIComponent(location.hash)}`;
    return;
  }
  view.innerHTML = '<div class="loading">불러오는 중…</div>';
  const ctx = { view, q, arg, alive: () => my === seq, go: (h) => { location.hash = h; } };
  try {
    switch (page) {
      case 'home': await (user ? renderHome(ctx) : renderWelcome(ctx)); break;
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
      case 'me': await renderMe(ctx); break;
      case 'admin': await renderAdmin(ctx); break;
      case 'rules': case 'privacy': case 'data-rules': renderDoc(ctx, page); break;
      default: view.innerHTML = `${backBar('페이지 없음')}<div class="empty">없는 페이지입니다.</div>`;
    }
  } catch (e) {
    console.error(e);
    if (ctx.alive()) view.innerHTML = `${backBar('오류')}<div class="empty">${esc(be.errorText(e))}</div>`;
  }
  if (ctx.alive()) refreshBell();
}

document.addEventListener('click', (e) => {
  if (e.target.closest('[data-back]')) {
    if (history.length > 1) history.back(); else location.hash = '#/';
  }
});

/* ---------------- 홈 ---------------- */
function renderWelcome({ view }) {
  view.innerHTML = `<div class="hero"><div class="logo">태</div><h1>${esc(SITE_NAME)}</h1>
    <p>${esc(SITE_DESC)}</p>
    <div class="btns"><a class="btn" href="#/login" style="display:grid;place-items:center">로그인</a>
    <a class="btn gray" href="#/join" style="display:grid;place-items:center">회원가입</a></div></div>
    <div class="card"><h3>🔒 회원 전용 커뮤니티</h3><p>글과 자료는 가입한 회원만 볼 수 있어요. 실명·전화번호는 관리자만 볼 수 있고 다른 회원에게는 닉네임과 학년만 보여요.</p></div>
    <div class="card"><h3>💬 이런 걸 할 수 있어요</h3><p>최신 입시 소식 · 학부모·학생 수다 · 대전 학교 이야기 · 입시 정보 · 자료실 · 좋아요 · 댓글 · 사진·파일 올리기</p></div>
    <div class="menu-list"><a href="#/rules">커뮤니티 이용규칙</a><a href="#/privacy">개인정보 처리방침</a></div>`;
}

async function renderHome(ctx) {
  const { view } = ctx;
  const me = be.currentUser();
  view.innerHTML = `${topBar(SITE_NAME)}${topEnd}${bannerSlot()}
    <div class="home-head"><h1>${esc(me.nickname)}님, 반가워요 👋</h1><p>${esc(me.grade)} · 오늘의 입시 소식을 확인해 보세요</p></div>
    <div class="slider" id="notice-slider"></div><div class="dots" id="notice-dots"></div>
    <div class="sec-title"><a class="all" href="#/community/rec">더 보기</a><h2>지금 인기 있는 글</h2></div>
    <div class="mini" id="hot"><div class="loading">불러오는 중…</div></div>
    <div class="sec-title"><a class="all" href="#/community/news">더 보기</a><h2>새 입시 소식</h2></div>
    <div class="mini" id="open-q"></div>
    <div class="sec-title"><a class="all" href="#/study">자료실</a><h2>새로 올라온 자료</h2></div>
    <div class="mini" id="new-data"></div>
    ${emojiRow()}`;
  const [notices, recent, openQ, data] = await Promise.all([
    be.listPosts({ board: 'notice', limit: 5 }),
    be.listPosts({ limit: 100 }),
    be.listPosts({ board: 'news', limit: 3 }),
    be.listPosts({ board: 'data', limit: 3 }),
  ]);
  if (!ctx.alive()) return;
  fillBanner(getBanners(be.listBanners));
  fillNotices(notices);
  const mini = (list, rank) => (list.length ? list.map((p, i) => `<a href="#/post/${p.id}">${rank ? `<span class="rank">${i + 1}</span>` : ''}
    <span class="t">${esc(p.title)}</span><small>${esc(category(p.board, p.category).name)} · ${ago(p.createdAt)}</small></a>`).join('') : '<div class="empty" style="padding:24px">아직 글이 없어요</div>');
  $('#hot').innerHTML = mini(hot(recent).slice(0, 5), true);
  $('#open-q').innerHTML = mini(openQ);
  $('#new-data').innerHTML = mini(data);
}

// 최근 7일 글 중 좋아요·댓글이 많은 순
function hot(list) {
  const week = Date.now() - 7 * 86400000;
  const score = (p) => (p.likeCount || 0) * 2 + (p.commentCount || 0) + (p.createdAt > week ? 3 : 0);
  return list.filter((p) => p.board !== 'notice').sort((a, b) => score(b) - score(a) || b.createdAt - a.createdAt);
}

function fillNotices(notices) {
  const s = $('#notice-slider');
  if (!s) return;
  s.innerHTML = notices.length
    ? notices.map((n) => `<a class="notice-card" href="#/post/${n.id}">📢 <span>${esc(n.title)}</span>${ICON.chevron}</a>`).join('')
    : `<a class="notice-card" href="#/rules">📢 <span>커뮤니티 이용규칙을 꼭 읽어 주세요</span>${ICON.chevron}</a>`;
  bindDots(s, $('#notice-dots'));
}

function emojiRow() {
  const pick = [['news', 'admission-news'], ['news', 'event'], ['talk', 'parent'], ['talk', 'worry'], ['school', 'exam'], ['school', 'transfer'], ['admission', 'susi'], ['admission', 'jeongsi']];
  return `<div class="emoji-row">${pick.map(([b, c]) => {
    const x = category(b, c);
    return `<a href="#/community/${b}?category=${c}"><span style="background:${x.bg}">${x.icon}</span>${esc(x.name)}</a>`;
  }).join('')}</div>`;
}

/* ---------------- 커뮤니티 ---------------- */
function tabsHtml(on) {
  return `<nav class="tabs">${[...COMMUNITY_TABS, ...(QNA_OPEN ? [{ id: 'qna', name: '문제풀이' }] : [])].map((t) => `<a href="#/community/${t.id}" class="${t.id === on ? 'on' : ''}">${t.name}</a>`).join('')}</nav>`;
}

async function renderCommunity(ctx, tab) {
  if (tab !== 'rec' && (!BOARDS[tab] || ['data', 'notice'].includes(tab) || (tab === 'qna' && !QNA_OPEN))) tab = 'rec';
  if (tab !== 'rec') return renderBoard(ctx, tab);
  const { view } = ctx;
  view.innerHTML = `${topBar('커뮤니티')}${tabsHtml('rec')}${topEnd}${bannerSlot()}
    <div class="slider" id="notice-slider"></div><div class="dots" id="notice-dots"></div>
    <div class="sec-title"><h2>추천 게시글</h2><p>좋아요와 댓글이 많은 글을 골랐어요</p></div>
    <div class="slider" id="rec-slider"><div class="loading" style="width:100%">불러오는 중…</div></div><div class="dots" id="rec-dots"></div>
    <div class="sec-title"><h2>최신 글</h2></div><div class="post-list" id="latest"></div>
    ${emojiRow()}${fab('#/write?board=talk')}`;
  const [notices, recent] = await Promise.all([be.listPosts({ board: 'notice', limit: 5 }), be.listPosts({ limit: 100 })]);
  if (!ctx.alive()) return;
  fillBanner(getBanners(be.listBanners));
  fillNotices(notices);
  const top = hot(recent).slice(0, 10);
  const pages = [];
  for (let i = 0; i < top.length; i += 2) pages.push(top.slice(i, i + 2));
  $('#rec-slider').innerHTML = pages.length
    ? pages.map((pg) => `<div class="rec-page">${pg.map(recCardHtml).join('')}</div>`).join('')
    : '<div class="empty" style="width:100%">첫 글을 써 보세요!</div>';
  bindDots($('#rec-slider'), $('#rec-dots'));
  const latest = recent.filter((p) => p.board !== 'notice').slice(0, 10);
  $('#latest').innerHTML = latest.map((p) => (p.board === 'qna' ? qcardHtml(p) : itemHtml(p))).join('') || '<div class="empty">아직 글이 없어요</div>';
}

// 게시판 목록(소통해요·공부해요·문제풀이·자료실·공지)
async function renderBoard(ctx, board) {
  const { view, q } = ctx;
  const b = BOARDS[board];
  const filter = { board, category: q.get('category') || '', grade: q.get('grade') || '', status: q.get('status') || '' };
  const href = (patch) => {
    const n = { ...filter, ...patch };
    const qs = new URLSearchParams(Object.entries(n).filter(([k, v]) => v && k !== 'board')).toString();
    const base = board === 'data' ? '#/study' : board === 'notice' ? '#/notices' : `#/community/${board}`;
    return base + (qs ? `?${qs}` : '');
  };
  const gradeSel = `<select class="pill-select${filter.grade ? ' set' : ''}" data-f="grade" aria-label="학년">
    <option value="">${board === 'qna' ? '학년' : '전 학년'}</option>${GRADES.map((g) => `<option ${g === filter.grade ? 'selected' : ''}>${g}</option>`).join('')}</select>`;
  let filters = '';
  if (board === 'qna') {
    filters = `<div class="chips">${gradeSel}
      <select class="pill-select${filter.category ? ' set' : ''}" data-f="category" aria-label="과목"><option value="">과목</option>
        ${SUBJECTS.map((s) => `<option ${s === filter.category ? 'selected' : ''}>${s}</option>`).join('')}</select>
      <select class="pill-select${filter.status ? ' set' : ''}" data-f="status" aria-label="상태"><option value="">상태</option>
        <option value="open" ${filter.status === 'open' ? 'selected' : ''}>답변 기다리는 중</option>
        <option value="solved" ${filter.status === 'solved' ? 'selected' : ''}>해결</option></select></div>`;
  } else if (board !== 'notice') {
    filters = `<div class="chips">${gradeSel}<a class="chip ${filter.category ? '' : 'on'}" href="${href({ category: '' })}">전체</a>
      ${b.categories.map((c) => `<a class="chip ${c.id === filter.category ? 'on' : ''}" href="${href({ category: c.id })}">${esc(c.name)}</a>`).join('')}</div>`;
  }
  const head = board === 'data'
    ? `${topBar('입시 자료실')}${topEnd}<div class="rules compact"><h3>⚠️ 자료실 규칙 — 꼭 지켜 주세요</h3><ol>${DATA_RULES.slice(0, 3).map((r) => `<li>${esc(r)}</li>`).join('')}</ol>
       <p style="margin:8px 0 0;font-size:14px"><a href="#/data-rules" style="color:var(--warn);font-weight:700">자료실 규칙 전체 보기 ›</a></p></div>`
    : board === 'notice' ? backBar('공지사항') : `${topBar('커뮤니티')}${tabsHtml(board)}${topEnd}`;
  const canWrite = board !== 'notice' || be.isAdmin();
  view.innerHTML = `${head}${board === 'notice' ? '' : bannerSlot()}${filters}<div class="post-list" id="pins"></div><div class="post-list" id="list"><div class="loading">불러오는 중…</div></div>
    <button class="more hidden" id="more">더 보기</button>
    ${canWrite ? fab(`#/write?board=${board}${filter.category ? `&category=${encodeURIComponent(filter.category)}` : ''}`) : ''}`;
  $$('select[data-f]', view).forEach((s) => s.addEventListener('change', () => ctx.go(href({ [s.dataset.f]: s.value }))));

  let after = null;
  const list = $('#list'), more = $('#more');
  const load = async () => {
    more.disabled = true;
    const rows = await be.listPosts({ ...filter, limit: 20, after });
    if (!ctx.alive()) return;
    if (!after) list.innerHTML = '';
    list.insertAdjacentHTML('beforeend', rows.map((p) => (board === 'qna' ? qcardHtml(p) : itemHtml(p))).join(''));
    if (!list.children.length) list.innerHTML = `<div class="empty">${board === 'data' ? '아직 공개된 자료가 없어요' : '아직 글이 없어요'}</div>`;
    after = rows.length ? rows[rows.length - 1].id : after;
    more.classList.toggle('hidden', rows.length < 20);
    more.disabled = false;
  };
  more.addEventListener('click', load);
  if (board !== 'notice') {
    fillBanner(getBanners(be.listBanners));
    be.listPosts({ board: 'notice', limit: 3 }).then((ns) => { if (ctx.alive()) $('#pins').innerHTML = ns.map(itemHtml).join(''); }).catch(() => {});
  }
  await load();
}

/* ---------------- 검색 ---------------- */
async function renderSearch(ctx) {
  const { view, q } = ctx;
  const word = (q.get('q') || '').trim();
  view.innerHTML = `${backBar('검색')}<form class="search-box" id="sf"><input class="input" name="q" placeholder="제목·내용으로 찾기" value="${esc(word)}" autofocus>
    <button class="btn small dark">검색</button></form><div class="post-list" id="res"></div>`;
  $('#sf').addEventListener('submit', (e) => { e.preventDefault(); ctx.go(`#/search?q=${encodeURIComponent(e.target.q.value.trim())}`); });
  if (!word) { $('#res').innerHTML = '<div class="empty">찾고 싶은 낱말을 넣어 주세요</div>'; return; }
  const rows = await be.listPosts({ limit: 400 });
  if (!ctx.alive()) return;
  const k = word.toLowerCase();
  const hits = rows.filter((p) => `${p.title} ${p.body}`.toLowerCase().includes(k));
  $('#res').innerHTML = hits.length ? hits.map((p) => (p.board === 'qna' ? qcardHtml(p) : itemHtml(p))).join('')
    : `<div class="empty">'${esc(word)}' 검색 결과가 없어요<br><small>최근 글 400개 안에서 찾았어요</small></div>`;
}

/* ---------------- 알림 ---------------- */
async function renderNotifications(ctx) {
  const { view } = ctx;
  view.innerHTML = `${backBar('알림')}<div id="nl"><div class="loading">불러오는 중…</div></div>`;
  const list = await be.listNotifications();
  if (!ctx.alive()) return;
  const text = (n) => ({
    comment: ['💬', `<b>${esc(n.fromName)}</b>님이 내 글에 댓글을 남겼어요: ${esc(n.text)}`],
    accepted: ['✅', `<b>${esc(n.fromName)}</b>님이 내 답변을 채택했어요: ${esc(n.text)}`],
    approved: ['📗', `자료가 승인되어 공개됐어요: ${esc(n.text)}`],
    rejected: ['⚠️', `자료실 규칙에 맞지 않아 자료가 삭제됐어요: ${esc(n.text)}`],
  }[n.type] || ['🔔', esc(n.text)]);
  $('#nl').innerHTML = list.length ? list.map((n) => {
    const [ic, t] = text(n);
    return `<a class="notif ${n.read ? '' : 'unread'}" href="${n.type === 'rejected' ? '#/study' : `#/post/${esc(n.postId)}`}"><span class="ic">${ic}</span><div><p>${t}</p><small>${ago(n.createdAt)}</small></div></a>`;
  }).join('') : '<div class="empty">새 알림이 없어요</div>';
  be.markRead(list).catch(() => {});
}

/* ---------------- 전체 메뉴 ---------------- */
function renderMenu({ view }) {
  const me = be.currentUser();
  view.innerHTML = `${topBar('전체 메뉴')}${topEnd}
    <div class="card">${me
      ? `<div class="profile"><span class="avatar">${esc(me.nickname[0])}</span><div><b>${esc(me.nickname)}</b><br><small style="color:var(--sub)">${esc(me.grade)} · @${esc(me.username)}${me.role === 'admin' ? ' · 관리자' : ''}</small></div></div>`
      : '<h3>로그인하고 함께해요</h3><p>글·댓글·자료는 회원만 볼 수 있어요.</p><div style="display:flex;gap:8px;margin-top:12px"><a class="btn small" href="#/login" style="display:grid;place-items:center">로그인</a><a class="btn small gray" href="#/join" style="display:grid;place-items:center">회원가입</a></div>'}</div>
    <div class="menu-list">
      <div class="group">커뮤니티</div>
      ${COMMUNITY_TABS.slice(1).map((t) => `<a href="#/community/${t.id}">${t.name}</a>`).join('')}${QNA_OPEN ? '<a href="#/community/qna">문제풀이</a>' : ''}<a href="#/study">스터디 자료실</a><a href="#/notices">공지사항</a>
      ${me ? `<div class="group">내 활동</div><a href="#/me">내 정보·내가 쓴 글</a><a href="#/notifications">알림</a>` : ''}
      ${me?.role === 'admin' ? '<div class="group">관리</div><a href="#/admin">관리자 화면</a><a href="#/write?board=notice">공지 쓰기</a>' : ''}
      <div class="group">안내</div><a href="#/rules">커뮤니티 이용규칙</a><a href="#/data-rules">자료실 규칙</a><a href="#/privacy">개인정보 처리방침</a>
      ${me ? '<button id="logout" style="color:var(--danger)">로그아웃</button>' : ''}
    </div>`;
  $('#logout')?.addEventListener('click', async () => { await be.signOut(); toast('로그아웃했어요'); location.hash = '#/'; });
}

/* ---------------- 상단 안내 띠·검색·맨위로 ---------------- */
async function startTopline() {
  const items = (await getBanners(be.listBanners)).filter((b) => b.kind === 'text' && b.text);
  if (!items.length) return;
  let i = 0;
  const bar = $('#topline'), a = $('#tl-text');
  const show = () => { const b = items[i]; a.textContent = b.text; a.href = safeLink(b.link) || '#/'; };
  show();
  bar.classList.remove('hidden');
  bar.addEventListener('click', (e) => { const d = e.target.closest('[data-tl]'); if (d) { i = (i + +d.dataset.tl + items.length) % items.length; show(); } });
  setInterval(() => { i = (i + 1) % items.length; show(); }, 5000);
}
$('#sh-search').addEventListener('submit', (e) => {
  e.preventDefault();
  location.hash = `#/search?q=${encodeURIComponent(e.target.q.value.trim())}`;
});
$('#to-top').addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
window.addEventListener('scroll', () => $('#to-top').classList.toggle('show', window.scrollY > 400), { passive: true });

/* ---------------- 시작 ---------------- */
window.addEventListener('hashchange', route);
be.init().then(() => {
  route();
  startTopline().catch(() => {});
  // 로그인·로그아웃하면 지금 화면을 다시 그립니다
  be.onUser(() => { if (!be.currentUser() || ['login', 'join'].includes(parse().parts[0])) route(); });
}).catch((e) => {
  console.error(e);
  view.innerHTML = `<div class="empty">사이트를 불러오지 못했습니다.<br>${esc(be.errorText(e))}</div>`;
});
if (be.DEMO) setTimeout(() => toast('체험 모드: 데이터가 이 브라우저에만 저장돼요'), 800);
