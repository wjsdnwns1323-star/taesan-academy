// 화면 공통 도구: 글자 이스케이프, 시간 표시, 상단바, 글 카드, 알림 메시지
import { category } from './boards.js';
import { currentUser, fileUrl, hasUnread } from './backend.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export function ago(t) {
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return '방금 전';
  if (s < 3600) return `${Math.floor(s / 60)}분 전`;
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}일 전`;
  const d = new Date(t);
  return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
}
// 글에 저장된 미리보기 사진은 data:image/jpeg 주소만 씁니다(다른 값은 무시)
export const safeImg = (s) => (/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(s || '') ? s : '');
export const size = (n) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)}MB` : `${Math.max(1, Math.round(n / 1024))}KB`);

export function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => t.classList.remove('show'), 2400);
}

export const ICON = {
  search: '<svg viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m20 20-4.8-4.8"/></svg>',
  user: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9.2"/><circle cx="12" cy="10" r="3.2"/><path d="M6.2 18.4c1.3-2 3.4-3.1 5.8-3.1s4.5 1.1 5.8 3.1"/></svg>',
  bell: '<svg viewBox="0 0 24 24"><path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.6 1.8H4.4z"/><path d="M10 20.5a2.2 2.2 0 0 0 4 0"/></svg>',
  back: '<svg viewBox="0 0 24 24"><path d="M15 5 8 12l7 7"/></svg>',
  heart: '<svg viewBox="0 0 24 24"><path d="M12 21s-7.5-4.6-9.6-9.3C1 8.4 3 4.8 6.6 4.8c2.1 0 3.6 1.2 4.4 2.5h2c.8-1.3 2.3-2.5 4.4-2.5 3.6 0 5.6 3.6 4.2 6.9C19.5 16.4 12 21 12 21z"/></svg>',
  chat: '<svg viewBox="0 0 24 24"><path d="M12 3.5c-5.2 0-9.3 3.6-9.3 8 0 2.3 1.1 4.4 3 5.9l-.6 3.4 3.7-1.9c1 .3 2.1.5 3.2.5 5.2 0 9.3-3.6 9.3-8s-4.1-7.9-9.3-7.9zM7.8 13a1.3 1.3 0 1 1 0-2.6 1.3 1.3 0 0 1 0 2.6zm4.2 0a1.3 1.3 0 1 1 0-2.6 1.3 1.3 0 0 1 0 2.6zm4.2 0a1.3 1.3 0 1 1 0-2.6 1.3 1.3 0 0 1 0 2.6z"/></svg>',
  pen: '<svg viewBox="0 0 24 24"><path d="M3 17.3V21h3.7L17.8 9.9l-3.7-3.7zM20.7 7a1 1 0 0 0 0-1.4l-2.3-2.3a1 1 0 0 0-1.4 0l-1.8 1.8 3.7 3.7z"/></svg>',
  chevron: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#999" stroke-width="2"><path d="m9 6 6 6-6 6"/></svg>',
};

// 큰 제목 + 검색·내 정보·알림
export function topBar(title) {
  return `<header class="top page-top"><div class="top-row"><h1>${esc(title)}</h1>
    <a class="icon-btn" href="#/search" aria-label="검색">${ICON.search}</a>
    <a class="icon-btn" href="#/me" aria-label="내 정보">${ICON.user}</a>
    <a class="icon-btn" href="#/notifications" aria-label="알림">${ICON.bell}<i class="dot hidden" id="bell-dot"></i></a>
  </div>`;
}
export const topEnd = '</header>';

export function backBar(title, right = '') {
  return `<header class="top"><div class="top-row"><button class="back" data-back aria-label="뒤로">${ICON.back}</button><h2>${esc(title)}</h2>${right}</div></header>`;
}

export async function refreshBell() {
  const dot = $('#bell-dot');
  if (!dot || !currentUser()) return;
  try { dot.classList.toggle('hidden', !(await hasUnread())); } catch { /* 알림 확인 실패는 무시 */ }
}

export function labelHtml(p) {
  const c = category(p.board, p.category);
  const ic = p.board === 'qna' ? '<span class="ic q">?</span>' : `<span class="ic" style="background:${c.bg}">${c.icon}</span>`;
  return `<span class="label">${ic}${esc(c.name)}</span>`;
}

const preview = (s) => esc(String(s || '').replace(/\s+/g, ' ').slice(0, 120));

function metaHtml(p, { when = true } = {}) {
  return `<div class="meta"><span class="when">${esc(p.grade)}${when ? ` · ${ago(p.createdAt)}` : ''}</span>
    <span class="cnt">${ICON.heart}${p.likeCount || 0}</span><span class="cnt">${ICON.chat}${p.commentCount || 0}</span></div>`;
}

// 소통해요·공부해요·자료실 목록 한 줄
export function itemHtml(p) {
  const badge = p.board === 'data' && !p.approved ? ' <span class="badge pending">승인 대기</span>' : '';
  const files = p.files?.length ? ` · 📎${p.files.length}` : '';
  return `<a class="item${p.board === 'notice' ? ' pinned' : ''}" href="#/post/${p.id}" data-date="${ago(p.createdAt)}">
    <div class="txt">${labelHtml(p)}<h3>${esc(p.title)}${badge}</h3><p>${preview(p.body)}${files}</p>${metaHtml(p)}</div>
    ${safeImg(p.thumb) ? `<div class="th"><img src="${safeImg(p.thumb)}" alt="" loading="lazy"></div>` : ''}</a>`;
}

// 문제풀이 카드(사진 크게)
export function qcardHtml(p) {
  const st = p.status === 'solved' ? '<span class="badge solved">해결</span>' : '<span class="badge open">답변 기다리는 중</span>';
  return `<a class="qcard" href="#/post/${p.id}">${labelHtml(p)} ${st}<h3>${esc(p.title)}</h3>
    ${safeImg(p.thumb) ? `<div class="shot"><img src="${safeImg(p.thumb)}" alt="" loading="lazy"></div>` : `<p style="margin:-4px 0 12px;color:var(--sub)">${preview(p.body)}</p>`}
    ${metaHtml(p)}</a>`;
}

// 추천 카드(테두리 카드)
export function recCardHtml(p) {
  return `<a class="rec-card" href="#/post/${p.id}">${labelHtml(p)}<h3>${esc(p.title)}</h3><p>${preview(p.body)}</p>${metaHtml(p)}</a>`;
}

export const safeLink = (s) => (/^(#\/|https:\/\/)/.test(s || '') ? s : '');

// 관리자가 올린 배너(가로로 넘기기, 4초마다 자동)
export const bannerSlot = () => '<div class="banner hidden" id="banner"><div class="slider b-slider" id="b-slider"></div><div class="dots b-dots" id="b-dots"></div></div>';
let bannerCache = null;
export async function fillBanner(list) {
  const box = $('#banner');
  if (!box) return;
  const imgs = (await list).filter((b) => b.kind === 'image' && safeImg(b.image));
  if (!imgs.length) return;
  const s = $('#b-slider');
  s.innerHTML = imgs.map((b) => {
    const img = `<img src="${safeImg(b.image)}" alt="${esc(b.text || '배너')}">`;
    const l = safeLink(b.link);
    return l ? `<a href="${esc(l)}" ${l.startsWith('https') ? 'target="_blank" rel="noopener"' : ''}>${img}</a>` : `<div>${img}</div>`;
  }).join('');
  box.classList.remove('hidden');
  bindDots(s, $('#b-dots'));
  if (imgs.length > 1) {
    const t = setInterval(() => {
      if (!document.body.contains(s)) { clearInterval(t); return; }
      const w = s.clientWidth, n = s.children.length, i = Math.round(s.scrollLeft / w);
      s.scrollTo({ left: ((i + 1) % n) * w, behavior: 'smooth' });
    }, 4000);
  }
}
export function getBanners(listFn) { bannerCache = bannerCache || listFn().catch(() => []); return bannerCache; }

export const fab = (href) => `<a class="fab" href="${href}" aria-label="글쓰기">${ICON.pen}</a>`;

// 가로로 넘기는 영역 아래 점 표시
export function bindDots(slider, dots) {
  if (!slider || !dots) return;
  const n = slider.children.length;
  dots.innerHTML = n > 1 ? Array.from({ length: n }, (_, i) => `<i class="${i ? '' : 'on'}"></i>`).join('') : '';
  slider.addEventListener('scroll', () => {
    const w = slider.children[0]?.getBoundingClientRect().width + 12 || 1;
    const i = Math.round(slider.scrollLeft / w);
    $$('i', dots).forEach((d, k) => d.classList.toggle('on', k === i));
  }, { passive: true });
}

// <img data-file="id"> 들을 실제 사진으로 채웁니다
export function loadImages(root) {
  $$('img[data-file]', root).forEach(async (img) => {
    try { img.src = await fileUrl(img.dataset.file); } catch { img.alt = '사진을 불러오지 못했습니다'; }
  });
}

export function linkify(text) {
  return esc(text).replace(/https?:\/\/[^\s<]+/g, (u) => `<a href="${u}" target="_blank" rel="noopener noreferrer nofollow">${u}</a>`);
}
