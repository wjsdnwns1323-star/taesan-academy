// 화면 공통 도구
export const esc = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const icons = {
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>',
  menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg>',
  chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 5h16v11H9l-5 4z"/></svg>',
  pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 21s-7-6.5-7-12a7 7 0 0 1 14 0c0 5.5-7 12-7 12z"/><circle cx="12" cy="9" r="2.5"/></svg>',
  cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
};

export function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast'; el.setAttribute('role', 'status'); el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

// 모달: content는 HTML 문자열, onMount(box, close)로 이벤트 연결
export function modal({ title, sub = '', content, onMount }) {
  const prev = document.activeElement;
  const el = document.createElement('div');
  el.className = 'modal';
  el.innerHTML = `<div class="dim"></div>
    <div class="box" role="dialog" aria-modal="true" aria-labelledby="mdl-t">
      <button class="icon-btn close" aria-label="닫기">${icons.close}</button>
      <h2 id="mdl-t">${esc(title)}</h2>${sub ? `<p class="sub">${sub}</p>` : ''}
      <div class="mdl-c">${content}</div>
    </div>`;
  const close = () => { el.remove(); document.removeEventListener('keydown', onKey); prev?.focus?.(); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  el.querySelector('.dim').onclick = close;
  el.querySelector('.close').onclick = close;
  document.addEventListener('keydown', onKey);
  document.body.appendChild(el);
  const first = el.querySelector('input, select, textarea, button:not(.close)');
  (first || el.querySelector('.close')).focus();
  onMount?.(el.querySelector('.box'), close);
  return close;
}

export function confirmBox(message) {
  return new Promise((resolve) => {
    modal({
      title: '확인', content: `<p>${esc(message)}</p><div class="toolbar" style="justify-content:flex-end;margin-top:20px">
        <button class="btn ghost" data-no>취소</button><button class="btn" data-yes>확인</button></div>`,
      onMount(box, close) {
        box.querySelector('[data-no]').onclick = () => { close(); resolve(false); };
        box.querySelector('[data-yes]').onclick = () => { close(); resolve(true); };
      },
    });
  });
}

export const formData = (form) => Object.fromEntries(new FormData(form).entries());

export const statusTag = (s) => {
  if (!s) return '';
  const cls = s === '마감' || s === '종료' ? 'seal' : s === '마감임박' ? 'marker' : s === '진행중' || s === '모집중' ? 'ok' : 'muted';
  return `<span class="tag ${cls}">${esc(s)}</span>`;
};

export function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}`;
}
export const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
export function dayParts(iso) {
  const d = new Date(`${iso}T00:00:00`);
  if (!iso || isNaN(d)) return null;
  return { m: d.getMonth() + 1, d: d.getDate(), w: WEEK[d.getDay()] };
}
export function isPast(iso) {
  if (!iso) return false;
  const d = new Date(`${iso}T23:59:59`);
  return d < new Date();
}

export const phoneOk = (v) => /^0\d{1,2}-?\d{3,4}-?\d{4}$/.test(String(v).trim());

// 개인정보 수집 동의 문구
export const CONSENT = `<div class="consent">수집 항목: 이름, 연락처, 학교·학년, 문의 내용<br>이용 목적: 상담·신청 확인 연락<br>보관 기간: 목적 달성 후 1년 또는 삭제 요청 시까지</div>
  <label class="check"><input type="checkbox" name="agree" required> 개인정보 수집·이용에 동의합니다.</label>`;
