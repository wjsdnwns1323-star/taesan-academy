// 홈 첫 화면 '스크롤 월드'
// 스크롤 위치에 맞춰 유화 복도 영상이 넘어가고, 영상 속 선생님이 화면 가운데 올 때 소개 카드가 지나갑니다.
// 카드 내용은 선생님·강좌 데이터(관리자 화면에서 수정)를 그대로 씁니다.
import { esc, statusTag } from '../ui.js';

// 영상 구간(초). desktop = 가로 영상, mobile = 세로 영상. 영상을 바꾸면 이 숫자만 맞추면 됩니다.
const VIDEO = {
  desktop: { src: 'media/scroll-desktop.mp4', poster: 'media/poster-desktop.jpg', hero: [0, 2.5], dissolve: [2.5, 6], reveal: [6, 9.5], settle: [9.5, 10] },
  mobile: { src: 'media/scroll-mobile.mp4', poster: 'media/poster-mobile.jpg', hero: [0, 3], dissolve: [3, 7], reveal: [7, 10.4], settle: [10.4, 10.8] },
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
// 배경을 지운 사진이 있는 선생님
const CUTOUT = new Set(TOUR.map(([id]) => id));
const photoOf = (p) => (CUTOUT.has(p.id) ? `images/people/${p.id}.webp` : p.photo);

const list = (title, items, cls = '') => (items && items.length ? `<div class="sw-block"><h4>${title}</h4><ul class="${cls}">${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul></div>` : '');

function teacherCard(t, classes) {
  const open = classes.filter((c) => c.term !== 'mid' && (c.teacherId === t.id || c.teacherName === t.name));
  const hl = t.highlights || [];
  const rows = open.slice(0, 6).map((c) => `<tr><td class="sw-g">${esc(c.school || c.grade)}</td><td>${esc(c.school ? c.grade : '')} ${esc(c.title || '학교 내신반')} ${statusTag(c.status)}</td><td class="num">${esc(c.start)}</td><td class="num sw-nw">${esc(c.time || '추후 안내')}</td></tr>`).join('');
  return `<article class="sw-card" aria-labelledby="sw-n-${esc(t.id)}">
    <header>
      <div class="sw-ph"><img src="${esc(photoOf(t))}" alt="${esc(t.name)} 선생님" loading="lazy"></div>
      <div><p class="sw-subj">${esc(t.subject)}${t.brand ? ` · ${esc(t.brand)}` : ''}</p>
        <h3 id="sw-n-${esc(t.id)}">${esc(t.name)}</h3>
        ${hl[0] ? `<p class="sw-hl">${esc(hl[0])}</p>` : ''}</div>
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
      <div class="sw-ph"><img src="${esc(photoOf(l))}" alt="${esc(l.name)} ${esc(l.title || '')}" loading="lazy"></div>
      <div><p class="sw-subj">입시 전략</p><h3 id="sw-n-${esc(l.id)}">${esc(l.name)}<small>${esc(l.title || '')}</small></h3>
        ${l.role ? `<p class="sw-hl">${esc(l.role)}</p>` : ''}</div>
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
    <div class="sw-stage" aria-hidden="true"><img class="sw-poster" alt=""><video muted playsinline preload="none"></video><span class="sw-load">영상 불러오는 중</span></div>
    <div class="sw-steps">
      <div class="sw-step sw-hero" data-seg="hero">
        <div class="sw-panel sw-intro">
          <h1>태산학원</h1>
          <p>대성고, 대신고, 대전외고, 공주사대부고, 동산고, 대전예고. 학교마다 시험이 다르니까 반도 학교별로 나눴습니다.</p>
          <div class="sw-act"><a class="btn" href="#/timetable?term=final">기말대비 학교별 시간표</a><a class="btn ghost" href="#/events">설명회 예약</a></div>
          <p class="sw-cue">아래로 내리면 선생님들이 한 분씩 나옵니다</p>
        </div>
      </div>
      <div class="sw-step sw-dissolve" data-seg="dissolve"><p class="sw-whisper">강의실 2 앞 복도에 선생님들이 모입니다</p></div>
      <div class="sw-step sw-reveal" data-seg="reveal">
        <div class="sw-panel sw-roster">
          <h2>태산학원 선생님들</h2>
          <p>이름을 누르면 그 선생님 소개로 바로 내려갑니다.</p>
          <dl>${groups.map(([k, arr]) => `<dt>${esc(k)}</dt><dd>${arr.map((p) => `<button type="button" data-goto="${esc(p.id)}">${esc(p.name)}${p.title ? ` ${esc(p.title)}` : ''}</button>`).join('')}</dd>`).join('')}</dl>
        </div>
      </div>
      <div class="sw-step sw-settle" data-seg="settle" aria-hidden="true"></div>
      ${tour.map(([id, d, m]) => `<div class="sw-step sw-t" id="sw-${esc(id)}" data-d="${d}" data-m="${m}">${people[id].title ? leaderCard(people[id]) : teacherCard(people[id], classes)}</div>`).join('')}
    </div>
  </section>`;

  const root = el.querySelector('.sw');
  const stage = root.querySelector('.sw-stage'), vid = stage.querySelector('video'), poster = stage.querySelector('.sw-poster'), loadEl = stage.querySelector('.sw-load');
  const steps = root.querySelector('.sw-steps');
  const wide = window.matchMedia('(min-width: 761px)');
  steps.querySelectorAll('.sw-tt').forEach((d) => { if (wide.matches && d.querySelectorAll('tr').length <= 4) d.open = true; });

  let mode = null, V = null, map = [], cur = 0, ready = false, dur = 30, raf = 0, alive = true;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const portrait = () => window.innerWidth / window.innerHeight < 0.9;

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
  function tick() {
    if (!alive) return;
    if (ready) {
      const tgt = Math.min(dur - 0.05, target());
      cur += reduce ? tgt - cur : (tgt - cur) * 0.2;
      if (Math.abs(vid.currentTime - cur) > 0.02 && !vid.seeking) vid.currentTime = cur;
    }
    const bottom = root.getBoundingClientRect().bottom;
    document.body.classList.toggle('sw-solid', bottom < 90);
    raf = requestAnimationFrame(tick);
  }
  async function load() {
    const m = portrait() ? 'mobile' : 'desktop';
    if (m === mode) return;
    mode = m; V = VIDEO[m]; ready = false; stage.classList.remove('ready'); layout();
    poster.src = V.poster; loadEl.textContent = '영상 불러오는 중';
    let url = V.src;
    try {
      const res = await fetch(V.src);
      if (!res.ok) throw new Error(res.status);
      const total = +res.headers.get('content-length') || 0;
      const reader = res.body.getReader(); const parts = []; let got = 0;
      for (;;) {
        const { done, value } = await reader.read(); if (done) break;
        parts.push(value); got += value.length;
        if (total) loadEl.textContent = `영상 불러오는 중 ${Math.round((got / total) * 100)}%`;
      }
      url = URL.createObjectURL(new Blob(parts, { type: 'video/mp4' }));
    } catch (e) { /* 스트리밍으로 재생 */ }
    if (!alive || m !== mode) return;
    vid.addEventListener('loadeddata', () => { dur = vid.duration || 30; ready = true; stage.classList.add('ready'); vid.currentTime = cur = target(); }, { once: true });
    vid.src = url; vid.load();
  }
  const onResize = () => { layout(); load(); };
  const prime = () => { vid.play().then(() => vid.pause()).catch(() => {}); };   // iOS: 한 번 재생해야 탐색이 안정적
  const ro = new ResizeObserver(layout); ro.observe(steps);
  steps.addEventListener('toggle', layout, true);
  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-goto]'); if (!b) return;
    const s = document.getElementById(`sw-${b.dataset.goto}`); if (!s) return;
    const r = s.getBoundingClientRect();
    window.scrollTo({ top: r.top + window.scrollY + r.height / 2 - window.innerHeight / 2, behavior: reduce ? 'auto' : 'smooth' });
  });
  window.addEventListener('resize', onResize);
  window.addEventListener('touchstart', prime, { once: true, passive: true });
  document.body.classList.add('sw-home');
  load(); raf = requestAnimationFrame(tick);

  const cleanup = () => {
    if (!alive) return;
    alive = false; cancelAnimationFrame(raf); ro.disconnect();
    window.removeEventListener('resize', onResize); window.removeEventListener('touchstart', prime);
    document.body.classList.remove('sw-home', 'sw-solid');
    if (vid.src.startsWith('blob:')) URL.revokeObjectURL(vid.src);
    if (window.__swCleanup === cleanup) window.__swCleanup = null;
  };
  window.__swCleanup = cleanup;
  return cleanup;
}
