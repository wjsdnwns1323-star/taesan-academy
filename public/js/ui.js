// 화면 공통 도구: 이스케이프, 날짜, 아이콘, 목록 한 줄, 빈 화면, 알림 메시지, 대화상자
import { category, BOARDS } from './boards.js';
import { fileUrl } from './backend.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const pad = (n) => String(n).padStart(2, '0');
export function ago(t) {
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return '방금 전';
  if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}일 전`;
  return fullDate(t);
}
export const fullDate = (t) => { const d = new Date(t); return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`; };
// 오늘 글은 시:분, 그 밖은 날짜
export const shortDate = (t) => { const d = new Date(t); return Date.now() - t < 86400000 && new Date().getDate() === d.getDate() ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : fullDate(t); };
export const dateTime = (t) => { const d = new Date(t); return `${fullDate(t)} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
export const size = (n) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)}MB` : `${Math.max(1, Math.round(n / 1024))}KB`);
// 글에 저장된 미리보기 사진은 data:image/jpeg 주소만 씁니다
export const safeImg = (s) => (/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(s || '') ? s : '');
export const safeLink = (s) => (/^(#\/|https:\/\/)/.test(s || '') ? s : '');

// 선 아이콘(굵기 1.75)
const P = {
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  bookmark: '<path d="M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
  more: '<circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>',
  reply: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  ban: '<circle cx="12" cy="12" r="9"/><path d="m5.7 5.7 12.6 12.6"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  eyeoff: '<path d="M9.9 4.2A9.6 9.6 0 0 1 12 4c6.5 0 10 8 10 8a17 17 0 0 1-2.2 3.2M6.6 6.6A17 17 0 0 0 2 12s3.5 8 10 8a9.7 9.7 0 0 0 5.4-1.6"/><path d="m2 2 20 20"/><path d="M14.1 14.1a3 3 0 0 1-4.2-4.2"/>',
  bell: '<path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  pen: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  heart: '<path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7Z"/>',
  chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  clip: '<path d="m21.4 11.1-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
  right: '<path d="m9 18 6-6-6-6"/>',
  left: '<path d="m15 18-6-6 6-6"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  at: '<circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8"/>',
  poll: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>',
  alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  megaphone: '<path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
  flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1.1-2.1-.2-4 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.2.4-2.3 1-3.3.4 1 1.3 2.8 2.5 2.8z"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  news: '<path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8M15 18h-5M10 6h8v4h-8z"/>',
  talk: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
  school: '<path d="M22 10 12 5 2 10l10 5 10-5Z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/>',
  cap: '<path d="M2 20h20"/><path d="M5 20V9l7-5 7 5v11"/><path d="M9 20v-6h6v6"/>',
  book: '<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
  up: '<path d="m18 15-6-6-6 6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  inbox: '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.7 1.1"/>',
  flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22v-7"/>',
  settings: '<path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>',
};
export const icon = (name, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true">${P[name] || ''}</svg>`;
// 게시판별 아이콘(왼쪽 메뉴·제목)
export const BOARD_ICON = { news: 'news', talk: 'talk', school: 'school', admission: 'cap', data: 'book', notice: 'megaphone', qna: 'info', all: 'list', rec: 'flame' };

export function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => t.classList.remove('show'), 2400);
}

export const empty = (msg = '등록된 글이 없습니다', ic = 'inbox') => `<div class="empty">${icon(ic)}<p>${esc(msg)}</p></div>`;

// 페이지 머리(제목·설명·오른쪽 버튼)
export function pageHead(title, { desc = '', actions = '', crumb = '' } = {}) {
  return `<div class="page-head"><div>${crumb}<h1>${esc(title)}</h1>${desc ? `<p>${desc}</p>` : ''}</div>${actions ? `<div class="actions">${actions}</div>` : ''}</div>`;
}

export function catName(p) {
  if (p.board === 'notice' || p.pinned) return '공지';
  return category(p.board, p.category).name || BOARDS[p.board]?.name || '';
}
export const tagHtml = (p) => `<span class="tag${p.board === 'notice' || p.pinned ? ' notice' : ''}">${esc(catName(p))}</span>`;

// 읽은 글(이 브라우저에만, 최근 500개): 목록에서 흐리게
const READ_KEY = 'tsc:read';
export function markReadPost(id) {
  try {
    const l = JSON.parse(localStorage.getItem(READ_KEY) || '[]').filter((x) => x !== id);
    l.unshift(id);
    localStorage.setItem(READ_KEY, JSON.stringify(l.slice(0, 500)));
  } catch { /* 저장소 사용 불가 */ }
}
export const readSet = () => { try { return new Set(JSON.parse(localStorage.getItem(READ_KEY) || '[]')); } catch { return new Set(); } };

// 하루 안에 올라온 글
export const isNew = (p) => Date.now() - p.createdAt < 86400000;
export const newBadge = (p) => (isNew(p) ? '<span class="new" aria-label="새 글">N</span>' : '');
// 회원마다 같은 연한 색(구분용, 데이터 색 아님)
export function avatarHtml(name, uid = '') {
  let h = 0;
  for (const c of String(uid || name)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return `<span class="avatar h${(h % 6) + 1}" aria-hidden="true">${esc(String(name || '?')[0])}</span>`;
}
// 검색어 강조(이스케이프한 뒤 표시)
export function highlight(text, word) {
  const t = esc(text);
  const w = String(word || '').trim();
  if (!w) return t;
  const e = esc(w).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return t.replace(new RegExp(e, 'gi'), (m) => `<mark>${m}</mark>`);
}

// 홈 상자·검색 결과용 한 줄
export function rowHtml(p, rank, { by = false } = {}) {
  return `<a class="row" href="#/post/${esc(p.id)}">${rank ? `<span class="rank${rank <= 3 ? ' top' : ''}">${rank}</span>` : ''}${tagHtml(p)}<span class="t">${esc(p.title)}</span>
    ${p.commentCount ? `<span class="cmt">${p.commentCount}</span>` : ''}${newBadge(p)}${by ? `<span class="by">${esc(p.nickname)}</span>` : ''}<time>${shortDate(p.createdAt)}</time></a>`;
}

// 목록형(검색·내 글·스크랩)
export function listItemHtml(p, word = '') {
  return `<a class="list-item" href="#/post/${esc(p.id)}"><div class="main">
    <span class="t">${highlight(p.title, word)}${p.board === 'data' && !p.approved && !p.hidden ? ' <span class="tag warn">승인 대기</span>' : ''}${p.hidden ? ' <span class="tag">숨김</span>' : ''}</span>
    <div class="m">${tagHtml(p)}${p.board === 'notice' ? '' : `<span>${esc(BOARDS[p.board]?.name || '')}</span>`}<span>${esc(p.nickname || '')}</span><span class="num">${shortDate(p.createdAt)}</span>${p.commentCount ? `<span>댓글 ${p.commentCount}</span>` : ''}</div>
    ${word && p.excerpt && p.excerpt.toLowerCase().includes(word.toLowerCase()) ? `<div class="m"><span class="q">${highlight(p.excerpt, word)}</span></div>` : ''}</div></a>`;
}

// 사진 크게 보기
export function viewer(src) {
  const v = document.createElement('div');
  v.className = 'viewer';
  v.innerHTML = `<img src="${esc(src)}" alt="크게 본 사진">`;
  const close = () => { v.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  v.addEventListener('click', close);
  document.addEventListener('keydown', onKey);
  document.body.appendChild(v);
}

// 버튼 아래 작은 메뉴: items [{label, icon, fn, cls}]
export function pop(anchor, items) {
  document.querySelector('.pop')?.remove();
  const m = document.createElement('div');
  m.className = 'pop';
  m.setAttribute('role', 'menu');
  m.innerHTML = items.map((it, i) => `<button type="button" role="menuitem" data-i="${i}" class="${it.cls || ''}">${it.icon ? icon(it.icon, 'sm') : ''}${esc(it.label)}</button>`).join('');
  document.body.appendChild(m);
  const r = anchor.getBoundingClientRect();
  const left = Math.min(window.scrollX + r.left, window.scrollX + document.documentElement.clientWidth - m.offsetWidth - 8);
  m.style.left = `${Math.max(8, left)}px`;
  m.style.top = `${window.scrollY + r.bottom + 4}px`;
  const close = () => { m.remove(); document.removeEventListener('click', outside, true); document.removeEventListener('keydown', onKey); };
  const outside = (e) => { if (!m.contains(e.target)) close(); };
  const onKey = (e) => { if (e.key === 'Escape') { close(); anchor.focus(); } };
  m.addEventListener('click', (e) => { const b = e.target.closest('[data-i]'); if (b) { close(); items[+b.dataset.i].fn(); } });
  setTimeout(() => document.addEventListener('click', outside, true), 0);
  document.addEventListener('keydown', onKey);
  m.querySelector('button')?.focus();
}

// 주소 복사
export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch {
    const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select();
    const ok = document.execCommand('copy'); t.remove(); return ok;
  }
}

// D-day: 오늘이면 D-DAY, 지났으면 null
export function dday(date) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(`${date}T00:00:00`);
  const n = Math.round((d - today) / 86400000);
  return n < 0 ? null : n === 0 ? 'D-DAY' : `D-${n}`;
}

// 관리자가 정한 배너(표지)·상단 안내 문구는 한 번만 불러옵니다
let bannerCache = null;
export function getBanners(listFn) { bannerCache = bannerCache || listFn().catch(() => { bannerCache = null; return []; }); return bannerCache; }
// 관리자가 표지·일정·안내 문구를 바꾸면 다시 불러오게
export function resetBanners() { bannerCache = null; }

export const fab = (href) => `<a class="fab" href="${href}" aria-label="글쓰기">${icon('pen')}</a>`;

// <img data-file="id"> 를 실제 사진으로 채웁니다
export function loadImages(root) {
  $$('img[data-file]', root).forEach(async (img) => {
    try { img.src = await fileUrl(img.dataset.file); } catch { img.alt = '사진을 불러오지 못했습니다'; }
  });
}

export function linkify(text) {
  return esc(text).replace(/https?:\/\/[^\s<]+/g, (u) => `<a href="${u}" target="_blank" rel="noopener noreferrer nofollow">${u}</a>`);
}
// 댓글의 @아이디 강조(링크 글자 안은 건드리지 않음)
export function mentionify(html) {
  let inLink = false;
  return html.split(/(<[^>]+>)/).map((part) => {
    if (part.startsWith('<')) { inLink = /^<a\b/i.test(part) || (inLink && !/^<\/a>/i.test(part)); return part; }
    return inLink ? part : part.replace(/(^|[^a-z0-9_@&])@([a-z0-9_]{4,20})(?![a-z0-9_])/g, '$1<span class="mention">@$2</span>');
  }).join('');
}

// 대화상자: html 본문, 버튼 [{label, value, cls}] → 누른 버튼의 value (닫으면 null)
export function modal({ title, body, buttons = [{ label: '닫기', value: null, cls: 'line' }], onMount }) {
  return new Promise((resolve) => {
    const box = document.createElement('div');
    box.className = 'modal';
    box.innerHTML = `<div class="modal-card" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="modal-h"><h2>${esc(title)}</h2><button type="button" data-x aria-label="닫기">${icon('x')}</button></div>
      <div class="modal-b">${body}</div>
      <div class="modal-f">${buttons.map((b, i) => `<button type="button" class="btn ${b.cls || ''}" data-i="${i}">${esc(b.label)}</button>`).join('')}</div></div>`;
    const close = (v) => { box.remove(); document.removeEventListener('keydown', onKey); resolve(v); };
    const onKey = (e) => { if (e.key === 'Escape') close(null); };
    box.addEventListener('click', (e) => {
      if (e.target === box || e.target.closest('[data-x]')) close(null);
      const b = e.target.closest('[data-i]');
      if (b) close(typeof buttons[+b.dataset.i].value === 'function' ? buttons[+b.dataset.i].value(box) : buttons[+b.dataset.i].value);
    });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(box);
    onMount?.(box);
    $('[data-i]:last-child', box)?.focus();
  });
}

export async function confirmBox(title, message, ok = '확인', danger = false) {
  return (await modal({ title, body: `<p style="font-size:15px;color:var(--muted)">${esc(message)}</p>`,
    buttons: [{ label: '취소', value: false, cls: 'line' }, { label: ok, value: true, cls: danger ? 'danger' : '' }] })) === true;
}
