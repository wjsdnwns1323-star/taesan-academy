// 홈 첫 화면 '스크롤 월드'
// 스크롤 위치에 맞춰 유화 복도 영상이 넘어가고, 영상 속 선생님이 화면 가운데 올 때 소개 카드가 지나갑니다.
// 카드 내용은 선생님·강좌 데이터(관리자 화면에서 수정)를 그대로 씁니다.
import { esc, statusTag } from '../ui.js';
import { photoOf, gradeTags, load as loadCol, visible } from './common.js';

// 영상 구간(초). desktop = 가로 영상, mobile = 세로 영상. 영상을 바꾸면 이 숫자만 맞추면 됩니다.
// 영상은 초당 12장 WebP 사진으로 쪼개 두었습니다(media/frames/d: 가로 960x540, m: 세로 540x960).
const FPS = 12;
const VIDEO = {
  desktop: { frames: 'media/frames/d/', count: 361, poster: 'media/poster-desktop.jpg', hero: [0, 2.5], dissolve: [2.5, 6], reveal: [6, 9.5], settle: [9.5, 10] },
  mobile: { frames: 'media/frames/m/', count: 361, poster: 'media/poster-mobile.jpg', hero: [0, 3], dissolve: [3, 7], reveal: [7, 10.4], settle: [10.4, 10.8] },
};
// 카메라가 지나가는 순서와 각 선생님 카드가 떠 있는 영상 구간
const TOUR = [
  ['lee-geonjun', [10, 12], [10.8, 12.6]],
  ['kim-taehyun', [12, 14], [12.6, 14.1]],
  ['kim-dohyun', [14, 15.8], [14.1, 15.45]],
  ['lee-yewon', [15.8, 17.1], [15.45, 17.1]],
  ['jeong-jikhan', [17.1, 18.8], [17.1, 18.8]],
  ['yang-jiwoon', [18.8, 21], [18.8, 20.3]],
  ['park-hanbit', [21, 22.7], [20.3, 22.05]],
  ['kim-mina', [22.7, 24], [22.05, 23.95]],
  ['choi-sunghoon', [24, 25.9], [23.95, 25.85]],
  ['jeong-jeongrae', [25.9, 28.45], [25.85, 28.15]],
  ['kim-hyun', [28.45, 30], [28.15, 30]],
];
// 사진 미리 받기: 8장마다 1장 → 4장마다 → 2장마다 → 전부 순서로 받습니다.
// 4장마다 1장꼴로 모이면 화면을 띄우고, 나머지는 보는 동안 채웁니다. 홈에서 미리 불러 두면 바로 열립니다.
const STORE = {};
const modeNow = () => (window.innerWidth / window.innerHeight < 0.9 ? 'mobile' : 'desktop');
const frameUrl = (m, i) => `${VIDEO[m].frames}${String(i + 1).padStart(3, '0')}.webp`;
export function prefetchWorld(m = modeNow()) {
  if (STORE[m]) return STORE[m];
  const n = VIDEO[m].count, seen = new Set(), order = [];
  let firstCount = 0;
  for (const step of [8, 4, 2, 1]) {
    for (let i = 0; i < n; i += step) if (!seen.has(i)) { seen.add(i); order.push(i); }
    if (step === 4) firstCount = order.length;
  }
  if (!seen.has(n - 1)) order.push(n - 1);
  let resolveReady; let next = 0;
  const S = { imgs: new Array(n), n, done: 0, firstCount, listeners: new Set(), ready: new Promise((r) => (resolveReady = r)) };
  const worker = async () => {
    while (next < order.length) {
      const i = order[next++];
      try { const img = new Image(); img.decoding = 'async'; img.src = frameUrl(m, i); await img.decode(); S.imgs[i] = img; } catch (e) { /* 한 장 실패는 이웃 장면으로 대신 */ }
      S.done += 1; S.listeners.forEach((f) => f());
      if (S.done >= firstCount) resolveReady();
    }
  };
  for (let k = 0; k < 6; k += 1) worker();
  STORE[m] = S;
  return S;
}

const FALLBACK = `onerror="this.onerror=null;this.src=this.src.replace(/\\.png$/,'.jpg')"`;

const list = (title, items, cls = '') => (items && items.length ? `<div class="sw-block"><h4>${title}</h4><ul class="${cls}">${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul></div>` : '');

function teacherCard(t, classes) {
  const open = classes.filter((c) => c.term !== 'mid' && (c.teacherId === t.id || c.teacherName === t.name));
  const hl = t.highlights || [];
  const rows = open.slice(0, 6).map((c) => `<tr><td class="sw-g">${esc(c.school || c.grade)}</td><td>${esc(c.school ? c.grade : '')} ${esc(c.title || '학교 내신반')} ${statusTag(c.status)}</td><td class="num">${esc(c.start)}</td><td class="num sw-nw">${esc(c.time || '추후 안내')}</td></tr>`).join('');
  return `<article class="sw-card" aria-labelledby="sw-n-${esc(t.id)}">
    <header>
      <div><span class="tag">${esc([t.subject, gradeTags(t).join('·')].filter(Boolean).join(' · '))}</span>
        ${hl[0] ? `<p class="copy">${esc(hl[0])}</p>` : ''}
        <p class="t1">${esc(t.brand || t.subject)}</p>
        <h3 class="t2" id="sw-n-${esc(t.id)}">${esc(t.name)} 선생님</h3></div>
      ${t.photo ? `<div class="sw-ph"><img src="${esc(photoOf(t))}" alt="${esc(t.name)} 선생님" loading="lazy" ${FALLBACK}></div>` : ''}
    </header>
    ${(t.schools || []).length ? `<div class="sw-chips">${t.schools.map((s) => `<span>${esc(s)}</span>`).join('')}</div>` : ''}
    ${list('약력', t.bio)}
    ${list('성과', hl.slice(1), 'sw-win')}
    ${list('수업 방식', (t.method || []).slice(0, 4))}
    ${rows ? `<details class="sw-tt"><summary>지금 열린 반 ${open.length}개</summary><div class="tt-wrap"><table><tbody>${rows}</tbody></table></div>
      ${open.length > 6 ? `<p class="sw-more">외 ${open.length - 6}개 반은 시간표에서 볼 수 있습니다.</p>` : ''}</details>` : ''}
    <div class="sw-act"><a class="btn sm" href="#/teachers/${esc(t.id)}">선생님 소개</a>
      <a class="btn sm ghost" href="#/timetable?term=final&teacher=${encodeURIComponent(t.name)}">시간표·수강 신청</a></div>
  </article>`;
}

function leaderCard(l) {
  return `<article class="sw-card" aria-labelledby="sw-n-${esc(l.id)}">
    <header>
      <div><span class="tag">${esc(l.title || '소장')}</span>
        ${l.role ? `<p class="copy">${esc(l.role)}</p>` : ''}
        <p class="t1">입시 전략</p>
        <h3 class="t2" id="sw-n-${esc(l.id)}">${esc(l.name)} ${esc(l.title || '')}</h3></div>
      ${l.photo ? `<div class="sw-ph"><img src="${esc(photoOf(l))}" alt="${esc(l.name)} ${esc(l.title || '')}" loading="lazy" ${FALLBACK}></div>` : ''}
    </header>
    ${list('약력', l.bio)}
    <div class="sw-act"><a class="btn sm" href="#/events">설명회 일정</a><a class="btn sm ghost" href="#/visit">방문 상담 예약</a></div>
  </article>`;
}

export function mountWorld(el, { teachers, leaders, classes }) {
  window.__swCleanup?.();   // 로그인 상태가 바뀌어 홈을 다시 그릴 때 이전 영상 정리
  const people = Object.fromEntries([...teachers, ...leaders].map((p) => [p.id, p]));
  const tour = TOUR.filter(([id]) => people[id] && !people[id].hidden);
  const groups = [];
  tour.forEach(([id]) => {
    const p = people[id]; const k = p.title ? '입시 전략' : p.subject;
    let g = groups.find((x) => x[0] === k); if (!g) groups.push((g = [k, []])); g[1].push(p);
  });

  el.innerHTML = `<section class="sw" aria-label="태산학원 선생님 소개">
    <div class="sw-stage" aria-hidden="true"><img class="sw-poster" alt=""><canvas class="sw-canvas"></canvas><span class="sw-load">불러오는 중</span></div>
    <div class="sw-steps">
      <div class="sw-step sw-hero" data-seg="hero"><span class="sw-hint" aria-hidden="true"></span></div>
      <div class="sw-step sw-dissolve" data-seg="dissolve" aria-hidden="true"></div>
      <div class="sw-step sw-reveal" data-seg="reveal" aria-hidden="true"></div>
      <div class="sw-step sw-settle" data-seg="settle" aria-hidden="true"></div>
      ${tour.map(([id, d, m]) => `<div class="sw-step sw-t" id="sw-${esc(id)}" data-d="${d}" data-m="${m}">${people[id].title ? leaderCard(people[id]) : teacherCard(people[id], classes)}</div>`).join('')}
    </div>
  </section>`;

  const root = el.querySelector('.sw');
  const stage = root.querySelector('.sw-stage'), canvas = stage.querySelector('canvas'), ctx = canvas.getContext('2d'), poster = stage.querySelector('.sw-poster'), loadEl = stage.querySelector('.sw-load');
  const steps = root.querySelector('.sw-steps');
  const wide = window.matchMedia('(min-width: 761px)');
  steps.querySelectorAll('.sw-tt').forEach((d) => { if (wide.matches && d.querySelectorAll('tr').length <= 4) d.open = true; });

  let mode = null, V = null, S = null, map = [], cur = 0, ready = false, dur = 30, raf = 0, alive = true, drawn = -1, onProg = null;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const portrait = () => modeNow() === 'mobile';

  function layout() {
    if (!V) return;
    const y0 = window.scrollY;
    map = [...steps.children].map((s) => {
      const r = s.getBoundingClientRect();
      const seg = s.dataset.seg ? V[s.dataset.seg] : (mode === 'mobile' ? s.dataset.m : s.dataset.d).split(',').map(Number);
      return { top: r.top + y0, h: r.height, t0: seg[0], t1: seg[1] };
    });
  }
  function target() {
    if (!map.length) return 0;
    const c = window.scrollY + window.innerHeight / 2;
    const f = map[0], fTop = f.top + window.innerHeight / 2;   // 첫 화면은 0초에서 시작
    if (c <= fTop) return f.t0;
    if (c < f.top + f.h) return f.t0 + (f.t1 - f.t0) * (c - fTop) / Math.max(1, f.h - window.innerHeight / 2);
    for (const m of map.slice(1)) if (c < m.top + m.h) return m.t0 + (m.t1 - m.t0) * Math.min(1, Math.max(0, (c - m.top) / m.h));
    return map[map.length - 1].t1;
  }
  function sizeCanvas() {
    const r = stage.getBoundingClientRect(), d = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(r.width * d)); canvas.height = Math.max(1, Math.round(r.height * d)); drawn = -1;
  }
  function nearest(i) {
    if (S.imgs[i]) return i;
    for (let k = 1; k < S.n; k += 1) { if (S.imgs[i - k]) return i - k; if (S.imgs[i + k]) return i + k; }
    return -1;
  }
  function draw(i) {
    const j = nearest(i); if (j < 0 || j === drawn) return;
    const img = S.imgs[j], cw = canvas.width, ch = canvas.height;
    const k = Math.max(cw / img.naturalWidth, ch / img.naturalHeight), w = img.naturalWidth * k, h = img.naturalHeight * k;
    ctx.drawImage(img, (cw - w) / 2, (ch - h) / 2, w, h); drawn = j;
  }
  function tick() {
    if (!alive) return;
    if (ready) {
      const tgt = Math.min(dur, target());
      cur += reduce ? tgt - cur : (tgt - cur) * 0.25;
      draw(Math.max(0, Math.min(S.n - 1, Math.round(cur * FPS))));
    }
    root.classList.toggle('sw-moved', window.scrollY > 40);
    document.body.classList.toggle('sw-on', root.getBoundingClientRect().bottom > window.innerHeight * 0.6);
    raf = requestAnimationFrame(tick);
  }
  function load() {
    const m = portrait() ? 'mobile' : 'desktop';
    if (m === mode) return;
    if (S && onProg) S.listeners.delete(onProg);
    mode = m; V = VIDEO[m]; ready = false; root.classList.remove('ready'); stage.classList.remove('ready'); layout();
    poster.src = V.poster; S = prefetchWorld(m); dur = (S.n - 1) / FPS;
    onProg = () => { loadEl.textContent = `불러오는 중 ${Math.min(100, Math.round((S.done / S.firstCount) * 100))}%`; };
    S.listeners.add(onProg); onProg();
    S.ready.then(() => {
      if (!alive || m !== mode) return;
      sizeCanvas(); cur = target(); ready = true; root.classList.add('ready'); stage.classList.add('ready');
    });
  }
  const setHdr = () => { const h = document.querySelector('.header'); document.documentElement.style.setProperty('--hdr', `${h ? Math.round(h.getBoundingClientRect().height) : 0}px`); };
  setHdr();
  const onResize = () => { setHdr(); layout(); sizeCanvas(); load(); };
  const ro = new ResizeObserver(layout); ro.observe(steps);
  steps.addEventListener('toggle', layout, true);
  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-goto]'); if (!b) return;
    const s = document.getElementById(`sw-${b.dataset.goto}`); if (!s) return;
    const r = s.getBoundingClientRect();
    window.scrollTo({ top: r.top + window.scrollY + r.height / 2 - window.innerHeight / 2, behavior: reduce ? 'auto' : 'smooth' });
  });
  window.addEventListener('resize', onResize);
  load(); raf = requestAnimationFrame(tick);

  const cleanup = () => {
    if (!alive) return;
    alive = false; cancelAnimationFrame(raf); ro.disconnect(); document.body.classList.remove('sw-on');
    window.removeEventListener('resize', onResize); if (S && onProg) S.listeners.delete(onProg);
    if (window.__swCleanup === cleanup) window.__swCleanup = null;
  };
  window.__swCleanup = cleanup;
  return cleanup;
}

// '#/world' 화면: 스크롤월드 전체. ?t=선생님id 로 들어오면 그 선생님 카드 위치에서 시작합니다.
export async function render({ el, query }) {
  const [teachers, leaders, classes] = await Promise.all([loadCol('teachers'), loadCol('leaders'), loadCol('classes')]);
  el.innerHTML = '<div id="sw-root"></div>';
  const cleanup = mountWorld(el.querySelector('#sw-root'), { teachers: visible(teachers), leaders: visible(leaders), classes: visible(classes) });
  window.addEventListener('hashchange', cleanup, { once: true });
  if (query.t) {
    setTimeout(() => {
      const card = document.getElementById(`sw-${query.t}`); if (!card) return;
      const r = card.getBoundingClientRect();
      window.scrollTo({ top: r.top + window.scrollY + r.height / 2 - window.innerHeight / 2, behavior: 'auto' });
    }, 80);
  }
}
