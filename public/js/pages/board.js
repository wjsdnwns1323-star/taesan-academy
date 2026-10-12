import { esc, $, $$ } from '../ui.js';
import { load, visible, pageHead } from './common.js';

const sortNotices = (rows) => [...rows].sort((a, b) => (Number(!!b.pinned) - Number(!!a.pinned)) || (b.date || '').localeCompare(a.date || ''));

export async function noticeList({ el, query }) {
  const all = sortNotices(visible(await load('notices')));
  const cats = ['전체', ...new Set(all.map((n) => n.category).filter(Boolean))];
  const st = { cat: query.cat || '전체', q: query.q || '', page: 1 };
  const PER = 10;
  el.innerHTML = `${pageHead('공지사항', '', [['학원안내', '#/about'], ['공지사항']])}
  <div class="wrap page"><div class="mid">
    <div class="toolbar" style="justify-content:space-between">
      <div class="chips" id="cats"></div>
      <form id="sf" role="search" style="display:flex;gap:6px"><label class="sr" for="nq">공지 검색</label><input id="nq" class="input" style="min-height:38px;width:200px" placeholder="제목·내용 검색" value="${esc(st.q)}"><button class="btn sm">검색</button></form>
    </div>
    <div class="board" id="list"></div>
    <div class="toolbar" id="pager" style="justify-content:center;margin-top:18px"></div>
  </div></div>`;
  function draw() {
    $('#cats', el).innerHTML = cats.map((c) => `<button class="chip" data-c="${esc(c)}" aria-pressed="${st.cat === c}">${esc(c)}</button>`).join('');
    $$('[data-c]', el).forEach((b) => (b.onclick = () => { st.cat = b.dataset.c; st.page = 1; draw(); }));
    const q = st.q.trim();
    const rows = all.filter((n) => (st.cat === '전체' || n.category === st.cat) && (!q || n.title.includes(q) || (n.body || '').includes(q)));
    const pages = Math.max(1, Math.ceil(rows.length / PER));
    const slice = rows.slice((st.page - 1) * PER, st.page * PER);
    $('#list', el).innerHTML = slice.length ? `<ul>${slice.map((n) => `<li><a href="#/notice/${esc(n.id)}">${n.pinned ? '<span class="tag">공지</span>' : `<span class="tag muted">${esc(n.category || '안내')}</span>`}<span class="title">${esc(n.title)}</span><span class="date num">${esc(n.date)}</span></a></li>`).join('')}</ul>` : '<p class="empty">검색 결과가 없습니다.</p>';
    $('#pager', el).innerHTML = pages > 1 ? Array.from({ length: pages }, (_, i) => `<button class="chip" data-p="${i + 1}" aria-pressed="${st.page === i + 1}">${i + 1}</button>`).join('') : '';
    $$('[data-p]', el).forEach((b) => (b.onclick = () => { st.page = Number(b.dataset.p); draw(); }));
  }
  $('#sf', el).onsubmit = (e) => { e.preventDefault(); st.q = $('#nq', el).value; st.page = 1; draw(); };
  draw();
}

export async function noticeView({ el, params }) {
  const all = sortNotices(visible(await load('notices')));
  const i = all.findIndex((n) => n.id === params.id);
  const n = all[i];
  if (!n) { el.innerHTML = `<div class="wrap page"><div class="empty"><p>공지를 찾을 수 없습니다.</p><p><a class="btn" href="#/notice">목록으로</a></p></div></div>`; return; }
  const prev = all[i + 1], next = all[i - 1];
  el.innerHTML = `${pageHead('공지사항', '', [['공지사항', '#/notice'], [n.title]])}
  <div class="wrap page"><article class="article">
    <h2 style="font-size:26px;font-weight:900;margin-bottom:10px">${esc(n.title)}</h2>
    <p class="meta">${n.pinned ? '<span class="tag">공지</span>' : ''}<span class="tag muted">${esc(n.category || '안내')}</span><span class="num">${esc(n.date)}</span></p>
    ${n.image ? `<img src="${esc(n.image)}" alt="" style="margin-top:20px;border-radius:var(--radius)">` : ''}
    <div class="body">${esc(n.body)}</div>
    <nav class="nav" aria-label="이전·다음 글">
      <span>${prev ? `<a class="link" href="#/notice/${esc(prev.id)}">이전 글: ${esc(prev.title)}</a>` : ''}</span>
      <a class="btn ghost sm" href="#/notice">목록</a>
      <span>${next ? `<a class="link" href="#/notice/${esc(next.id)}">다음 글: ${esc(next.title)}</a>` : ''}</span>
    </nav>
  </article></div>`;
}

export async function faq({ el }) {
  const faqs = visible(await load('faqs'));
  const cats = ['전체', ...new Set(faqs.map((f) => f.category))];
  let cur = '전체';
  el.innerHTML = `${pageHead('자주 묻는 질문', '찾는 답이 없으면 <a class="link" href="#/consult">온라인 상담</a>으로 남겨 주세요.', [['상담', '#/consult'], ['자주 묻는 질문']])}
  <div class="wrap page"><div class="mid"><div class="chips" id="fc" style="margin-bottom:16px"></div><div class="faq" id="fl"></div></div></div>`;
  const draw = () => {
    $('#fc', el).innerHTML = cats.map((c) => `<button class="chip" data-c="${esc(c)}" aria-pressed="${cur === c}">${esc(c)}</button>`).join('');
    $$('[data-c]', el).forEach((b) => (b.onclick = () => { cur = b.dataset.c; draw(); }));
    $('#fl', el).innerHTML = faqs.filter((f) => cur === '전체' || f.category === cur).map((f) => `<details><summary>${esc(f.q)}</summary><div class="a">${esc(f.a)}</div></details>`).join('');
  };
  draw();
}
