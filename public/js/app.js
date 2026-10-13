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
  renderSide(location.hash || '#/');
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
  view.innerHTML = `<div class="hero"><img class="hero-logo" src="images/logo.webp" alt="태산학원"><h1>${esc(SITE_NAME)}</h1>
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
  const boards = ['news', 'talk', 'school', 'admission'];
  const box = (id, title, href) => `<section class="box"><header class="box-h"><h2>${title}</h2><a href="${href}">더 보기 ›</a></header><div class="rows" id="${id}"><div class="loading">불러오는 중…</div></div></section>`;
  view.innerHTML = `${topBar(SITE_NAME)}${topEnd}${bannerSlot()}
    <div class="home-head"><h1>${esc(me.nickname)}님, 반가워요</h1><p>${esc(me.grade)} · 대전 입시 소식을 한곳에서 확인하세요</p></div>
    <section class="box"><div class="rows" id="h-notice"></div></section>
    ${box('h-hot', '지금 인기 있는 글', '#/community/rec')}
    <div class="box-grid">${boards.map((b) => box(`h-${b}`, `최신 ${BOARDS[b].name}`, `#/community/${b}`)).join('')}</div>
    ${box('h-data', '새로 올라온 자료', '#/study')}
    ${emojiRow()}`;
  const [notices, recent, data, ...per] = await Promise.all([
    be.listPosts({ board: 'notice', limit: 3 }),
    be.listPosts({ limit: 100 }),
    be.listPosts({ board: 'data', limit: 5 }),
    ...boards.map((b) => be.listPosts({ board: b, limit: 5 })),
  ]);
  if (!ctx.alive()) return;
  fillBanner(getBanners(be.listBanners));
  const empty = '<div class="empty" style="padding:20px">아직 글이 없어요</div>';
  $('#h-notice').innerHTML = notices.map(rowHtml).join('') || '<a class="row" href="#/rules"><span class="tag t-notice">공지</span><span class="t">커뮤니티 이용규칙을 꼭 읽어 주세요</span></a>';
  $('#h-hot').innerHTML = hot(recent).slice(0, 5).map(rowHtml).join('') || empty;
  boards.forEach((b, i) => { $(`#h-${b}`).innerHTML = per[i].map(rowHtml).join('') || empty; });
  $('#h-data').innerHTML = data.map(rowHtml).join('') || empty;
}

// [말머리] 제목 …… 날짜 (DSchool 스타일 한 줄)
function rowHtml(p) {
  const c = p.board === 'notice' ? '공지' : category(p.board, p.category).name;
  const d = new Date(p.createdAt);
  const date = Date.now() - p.createdAt < 86400000 ? `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    : `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  return `<a class="row" href="#/post/${p.id}"><span class="tag t-${p.board}">${esc(c)}</span><span class="t">${esc(p.title)}</span>
    ${p.commentCount ? `<em>[${p.commentCount}]</em>` : ''}<time>${date}</time></a>`;
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
  if (matchMedia('(min-width: 1024px)').matches) return renderBoardTable(ctx, board, filter, href);
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

// 데스크탑: 네이버 카페식 표(말머리·제목·작성자·작성일·조회수·좋아요) + 쪽 번호 + 아래 검색
const fmtDate = (t) => { const d = new Date(t); return Date.now() - t < 86400000 ? `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}.`; };
const ICONS = { news: '📰', talk: '☕', school: '🏫', admission: '🎓', data: '📚', notice: '📢', qna: '❓' };
async function renderBoardTable(ctx, board, filter, href) {
  const { view, q } = ctx;
  const b = BOARDS[board];
  const per = +(q.get('n') || 15), page = +(q.get('p') || 1), word = (q.get('q') || '').trim(), field = q.get('f') || 'title', period = q.get('d') || '';
  const catName = filter.category ? ` · ${category(board, filter.category).name}` : '';
  view.innerHTML = `<div class="bt-head"><h1>${ICONS[board] || '📄'} ${esc(b.name)} 게시판${esc(catName)}</h1>
      <div class="bt-tools"><label><input type="checkbox" id="hide-n" ${q.get('hn') ? 'checked' : ''}> 공지 숨기기</label>
      <select id="per">${[15, 30, 50].map((n) => `<option value="${n}" ${n === per ? 'selected' : ''}>${n}개씩</option>`).join('')}</select></div></div>
    ${board === 'data' ? `<div class="rules compact"><h3>⚠️ 자료실 규칙 — 꼭 지켜 주세요</h3><ol>${DATA_RULES.slice(0, 3).map((r) => `<li>${esc(r)}</li>`).join('')}</ol><p style="margin:8px 0 0;font-size:14px"><a href="#/data-rules" style="color:var(--warn);font-weight:700">자료실 규칙 전체 보기 ›</a></p></div>` : ''}
    ${board === 'notice' ? '' : `<div class="bt-cats"><a class="${filter.category ? '' : 'on'}" href="${href({ category: '' })}">전체</a>${b.categories.map((c) => `<a class="${c.id === filter.category ? 'on' : ''}" href="${href({ category: c.id })}">${esc(c.name)}</a>`).join('')}</div>`}
    <table class="bt"><colgroup><col style="width:92px"><col><col style="width:150px"><col style="width:110px"><col style="width:70px"><col style="width:70px"></colgroup>
      <thead><tr><th>말머리</th><th>제목</th><th>작성자</th><th>작성일</th><th>조회수</th><th>좋아요</th></tr></thead><tbody id="bt-body"><tr><td colspan="6" class="loading">불러오는 중…</td></tr></tbody></table>
    <div class="bt-foot"><div class="pager" id="pager"></div>
      <form class="bt-search" id="bt-search"><select name="d"><option value="">전체기간</option><option value="7" ${period === '7' ? 'selected' : ''}>1주</option><option value="30" ${period === '30' ? 'selected' : ''}>1개월</option><option value="365" ${period === '365' ? 'selected' : ''}>1년</option></select>
        <select name="f"><option value="title">제목만</option><option value="all" ${field === 'all' ? 'selected' : ''}>제목+내용</option><option value="author" ${field === 'author' ? 'selected' : ''}>글작성자</option></select>
        <input name="q" value="${esc(word)}" placeholder="검색어를 입력해주세요"><button aria-label="검색"><svg viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m20 20-4.8-4.8"/></svg></button></form></div>
    ${board !== 'notice' || be.isAdmin() ? fab(`#/write?board=${board}${filter.category ? `&category=${encodeURIComponent(filter.category)}` : ''}`) : ''}`;
  const qs = (patch) => { const u = new URLSearchParams(q); Object.entries(patch).forEach(([k, v]) => (v ? u.set(k, v) : u.delete(k))); return `#/${board === 'data' ? 'study' : board === 'notice' ? 'notices' : `community/${board}`}?${u}`; };
  $('#per').addEventListener('change', (e) => ctx.go(qs({ n: e.target.value, p: '' })));
  $('#hide-n').addEventListener('change', (e) => ctx.go(qs({ hn: e.target.checked ? '1' : '' })));
  $('#bt-search').addEventListener('submit', (e) => { e.preventDefault(); const f = e.target; ctx.go(qs({ q: f.q.value.trim(), f: f.f.value, d: f.d.value, p: '' })); });
  const [notices, rows] = await Promise.all([
    board === 'notice' || q.get('hn') ? [] : be.listPosts({ board: 'notice', limit: 10 }),
    be.listPosts({ board, category: filter.category, limit: 500 }),
  ]);
  if (!ctx.alive()) return;
  const since = period ? Date.now() - +period * 86400000 : 0;
  const k = word.toLowerCase();
  const hits = rows.filter((p) => p.createdAt >= since && (!k || (field === 'author' ? p.nickname.toLowerCase().includes(k)
    : (field === 'all' ? `${p.title} ${p.body}` : p.title).toLowerCase().includes(k))));
  const pages = Math.max(1, Math.ceil(hits.length / per));
  const list = hits.slice((page - 1) * per, page * per);
  const tr = (p, pin) => `<tr class="${pin ? 'pin' : ''}"><td><span class="tag ${pin ? 't-notice fill' : `t-${p.board}`}">${pin ? '공지' : esc(category(p.board, p.category).name)}</span></td>
    <td class="tt"><a href="#/post/${p.id}">${esc(p.title)}${p.images?.length ? ' <i class="ico">🖼</i>' : ''}${p.files?.length ? ' <i class="ico">📎</i>' : ''}${p.commentCount ? ` <em>[${p.commentCount}]</em>` : ''}${p.board === 'data' && !p.approved ? ' <span class="badge pending">승인 대기</span>' : ''}</a></td>
    <td class="au">${esc(p.nickname)} <small>${esc(p.grade)}</small></td><td>${fmtDate(p.createdAt)}</td><td>${(p.viewCount || 0).toLocaleString()}</td><td>${(p.likeCount || 0).toLocaleString()}</td></tr>`;
  $('#bt-body').innerHTML = (page === 1 ? notices.map((p) => tr(p, true)).join('') : '') + list.map((p) => tr(p, board === 'notice')).join('')
    || '<tr><td colspan="6" class="empty">등록된 글이 없어요</td></tr>';
  $('#pager').innerHTML = Array.from({ length: Math.min(pages, 10) }, (_, i) => `<a class="${i + 1 === page ? 'on' : ''}" href="${qs({ p: String(i + 1) })}">${i + 1}</a>`).join('');
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

/* ---------------- 데스크탑 왼쪽 메뉴(카페 정보·게시판 목록) ---------------- */
let sideTab = 'info';
function renderSide(hash) {
  const side = $('#side');
  const me = be.currentUser();
  const login = $('#u-login');
  if (login) { login.textContent = me ? '내 정보' : '로그인'; login.href = me ? '#/me' : '#/login'; }
  const cur = hash.split('&')[0];
  const link = (href, label, icon = '📄', sub = false) => `<a class="s-link${sub ? ' sub' : ''}${cur === href || cur.startsWith(`${href}?`) || cur === href.split('?')[0] + '?' + (href.split('?')[1] || '') ? ' on' : ''}" href="${href}"><i>${sub ? '└' : icon}</i>${esc(label)}</a>`;
  const board = (b, icon) => {
    const base = b === 'data' ? '#/study' : `#/community/${b}`;
    return link(base, BOARDS[b].name + ' 게시판', icon) + BOARDS[b].categories.map((c) => link(`${base}?category=${encodeURIComponent(c.id)}`, c.name, '', true)).join('');
  };
  const info = `<div class="s-info"><img src="images/logo.png" alt="">
      <div><b>태산학원</b> <small class="mgr">매니저</small><br><span>2026.10.13. 개설</span><br><a href="#/rules">커뮤니티 소개</a></div></div>
    <div class="s-stat"><span>🌱 새싹 커뮤니티</span><span>${me ? `${esc(me.grade)} 회원` : '회원 전용'}</span></div>
    ${me ? '<a class="s-btn dark" href="#/write?board=talk">글쓰기</a><a class="s-btn" href="#/notifications">내소식</a>'
      : '<a class="s-btn dark" href="#/join">커뮤니티 가입하기</a><a class="s-btn" href="#/login">로그인</a>'}`;
  const mine = me ? `<div class="s-info"><span class="avatar">${esc(me.nickname[0])}</span><div><b>${esc(me.nickname)}</b>${me.role === 'admin' ? ' <small class="mgr">관리자</small>' : ''}<br><span>@${esc(me.username)} · ${esc(me.grade)}</span></div></div>
      <a class="s-btn dark" href="#/me">내가 쓴 글·내 정보</a><a class="s-btn" href="#/notifications">알림</a>${me.role === 'admin' ? '<a class="s-btn" href="#/admin">관리자 화면</a>' : ''}<button class="s-btn" id="s-logout">로그아웃</button>`
    : '<p class="s-empty">로그인하면 내 활동을 볼 수 있어요.</p><a class="s-btn dark" href="#/login">로그인</a>';
  side.innerHTML = `<div class="s-tabs"><button data-st="info" class="${sideTab === 'info' ? 'on' : ''}">카페정보</button><button data-st="mine" class="${sideTab === 'mine' ? 'on' : ''}">나의활동</button></div>
    <div class="s-card">${sideTab === 'info' ? info : mine}</div>
    <form class="s-search" id="s-search"><input name="q" aria-label="검색어"><button>검색</button></form>
    <nav class="s-menu">
      ${link('#/community/rec', '전체글보기', '📋')}${link('#/', '인기글', '🔥')}
      <h4>입시 정보</h4>${board('news', '📰')}${board('admission', '🎓')}
      <h4>우리들 이야기</h4>${board('talk', '☕')}${board('school', '🏫')}
      ${QNA_OPEN ? `<h4>공부</h4>${board('qna', '❓')}` : ''}
      <h4>자료</h4>${board('data', '📚')}
      <h4>안내</h4>${link('#/notices', '공지사항', '📢')}${link('#/rules', '이용규칙', '📌')}${link('#/data-rules', '자료실 규칙', '⚠️')}${link('#/privacy', '개인정보 처리방침', '🔒')}
    </nav>`;
  $$('[data-st]', side).forEach((b) => b.addEventListener('click', () => { sideTab = b.dataset.st; renderSide(location.hash || '#/'); }));
  $('#s-search', side).addEventListener('submit', (e) => { e.preventDefault(); location.hash = `#/search?q=${encodeURIComponent(e.target.q.value.trim())}`; });
  $('#s-logout', side)?.addEventListener('click', async () => { await be.signOut(); location.hash = '#/'; });
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
