import { seed, getSite } from '../backend.js';
import { esc, $, $$, isPast, WEEK } from '../ui.js';
import { load, visible, byOrder, teacherCard } from './common.js';
import { prefetchWorld } from './world.js';

const I = {
  prev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m15 6-6 6 6 6"/></svg>',
  next: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 6 6 6-6 6"/></svg>',
  pause: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 5v14l12-7z"/></svg>',
  grid: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/></svg>',
};

const fmtDay = (iso) => {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00`);
  return `${d.getFullYear()}. ${String(d.getMonth() + 1).padStart(2, '0')}. ${String(d.getDate()).padStart(2, '0')}(${WEEK[d.getDay()]})`;
};
const shortDay = (iso) => { const d = new Date(`${iso}T00:00:00`); return `${d.getMonth() + 1}. ${d.getDate()}(${WEEK[d.getDay()]})`; };

export async function render({ el, go }) {
  const [teachers, results, events, notices, leaders, classes, links0, site, banners0] = await Promise.all([load('teachers'), load('results'), load('events'), load('notices'), load('leaders'), load('classes'), load('quicklinks').catch(() => seed.quicklinks), getSite(), load('banners').catch(() => seed.banners)]);
  const RECRUIT = visible(banners0).sort(byOrder);
  const LINKS = visible(links0).sort(byOrder);
  const upcoming = visible(events).filter((e) => e.status !== '종료' && !isPast(e.date)).sort((a, b) => (a.date || '9').localeCompare(b.date || '9'));
  const dated = upcoming.filter((e) => e.date);
  const recent = [...visible(notices)].sort((a, b) => (Number(!!b.pinned) - Number(!!a.pinned)) || b.date.localeCompare(a.date)).slice(0, 5);
  const band = visible(results).filter((r) => r.bandLabel).sort((a, b) => (a.bandOrder ?? 9) - (b.bandOrder ?? 9)).slice(0, 5);
  const highlights = visible(results).filter((r) => r.featured).slice(0, 2);
  const vt = visible(teachers).sort(byOrder);

  el.innerHTML = `<section class="sw-mini" role="button" tabindex="0" aria-label="선생님 소개 보러가기">
    <img class="sw-mini-bg" src="media/hall-silhouette.webp" alt="" aria-hidden="true" fetchpriority="high" decoding="async">
    <div class="wrap sw-mini-in">
      <h1 id="swm-t"><img class="sw-mini-logo" src="images/brand/logo-dark.png" alt="태산학원 TAESANEDU"></h1>
      <p class="sw-mini-copy">큰 산처럼 흔들림 없이, 학생들의 곁을 지킵니다</p>
      <a class="sw-mini-cta" href="#/world">강사진 보러가기<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg></a>
    </div>
  </section><div class="home wrap">
  <section class="h-sec" aria-labelledby="rc-t">
    <div class="recruit">
      <div>
        <div class="h-head"><h2 id="rc-t">모집안내</h2>
          <div class="seg" role="group" aria-label="대상 선택">
            <button data-rf="all" aria-pressed="true">전체</button><button data-rf="grade" aria-pressed="false">고1·고2</button><button data-rf="pre" aria-pressed="false">예비고1</button>
          </div></div>
        <div class="r-viewport"><div class="r-track r-small" id="r-track"></div></div>
      </div>
      <div>
        <div class="h-head"><h2>학원소식</h2></div>
        <div id="news"></div>
      </div>
    </div>
    <div class="r-ctrl">
      <div class="r-bar">
        <div class="progress" aria-hidden="true"><i id="r-prog"></i></div>
        <div class="ctrl-btns">
          <div class="ctrl-grp"><button data-r="prev" aria-label="이전 배너">${I.prev}</button><button data-r="next" aria-label="다음 배너">${I.next}</button></div>
          <button class="ctrl-one" data-r="pause" aria-label="자동 넘김 멈춤">${I.pause}</button>
          <a class="ctrl-one" href="#/timetable" aria-label="전체 과정 보기">${I.grid}</a>
        </div>
      </div>
      <div class="dots" id="n-dots"></div>
    </div>
  </section>


  <section class="h-sec">
    <div class="result-band">
      <p class="rb-title">태산학원<br><b>${esc(site.resultBandTitle || '시험 결과')}</b>${site.resultBandNote ? `<small title="학교 성적 발표 전 학원 집계(가채점)가 포함되어 있습니다. 확정되면 업데이트합니다.">ⓘ ${esc(site.resultBandNote)}</small>` : ''}</p>
      ${band.map((r) => `<a class="rb-item" href="#/results"><span>${esc(r.bandLabel)}</span><b class="num">${esc(r.bandValue)}<small>${esc(r.bandUnit)}</small></b></a>`).join('')}
    </div>
  </section>

  <section class="h-sec">
    <div class="h-head"><h2>선생님</h2>
      <div class="seg" role="tablist" id="t-tabs">${['전체', ...seed.subjects].map((s, i) => `<button role="tab" data-s="${esc(s)}" aria-selected="${i === 0}">${esc(s)}</button>`).join('')}</div>
      <a class="plus" href="#/teachers" aria-label="선생님 전체 보기">+</a></div>
    <div class="t-row"><div class="t-grid" id="t-grid"></div><button class="t-next" id="t-next" aria-label="다음 선생님">${I.next}</button></div>
  </section>

  <section class="h-sec two-col">
    <div>
      <div class="h-head"><h2>공지사항</h2><a class="plus" href="#/notice" aria-label="공지사항 더보기">+</a></div>
      <ul class="bullets">${recent.map((n) => `<li><a href="#/notice/${esc(n.id)}">[${esc(n.category || '안내')}] ${esc(n.title)}</a><span class="date num">${esc(fmtDay(n.date))}</span></li>`).join('')}</ul>
    </div>
    <div>
      <div class="h-head"><h2>설명회·공개특강</h2><a class="plus" href="#/events" aria-label="설명회 더보기">+</a></div>
      <div class="ev-box">${(dated.length ? dated : upcoming).slice(0, 2).map((e) => `<div class="ev-item">
        <div><p class="t">${esc(e.target).split(/[·\s]/).filter((x) => /고|중|예비/.test(x)).slice(0, 2).map((x) => `<span class="tag">${esc(x)}</span>`).join('')} ${esc(e.title.split('—')[0].trim())}</p>
        <p class="m"><span><b>일시</b>${e.date ? esc(fmtDay(e.date)) + ' ' : ''}${esc(e.time)}</span><span><b>장소</b>${esc(e.place)}</span></p></div>
        <a class="ring" href="#/events/${esc(e.id)}">${e.status === '마감' ? '마감' : '예약중'}</a></div>`).join('') || '<p class="empty">예정된 설명회가 없습니다.</p>'}</div>
    </div>
  </section>

  <section class="h-sec">
    <div class="h-head"><h2>학습콘텐츠</h2></div>
    <div class="contents">
      ${LINKS.map((q) => q.big ? `<a class="big" href="${esc(q.href)}"><b>${esc(q.title)}</b>${q.sub ? `<span>${esc(q.sub)}</span>` : ''}</a>` : `<a href="${esc(q.href)}">${esc(q.title)}</a>`).join('')}
    </div>
  </section>

  <section class="h-sec story-row">
    <div>
      <div class="h-head"><h2>결과로 말합니다</h2><a class="plus" href="#/results" aria-label="결과 더보기">+</a></div>
      <div class="story-cards">${highlights.map((r) => `<a class="story" href="#/results"><span class="k">${esc(r.exam)}${r.provisional ? ' · 가채점' : ''}</span>
        <h4>${esc(r.school || '')} ${esc(r.grade || '')}<br>${esc(r.subject)}</h4><p>${esc(r.teacherName)} 선생님</p><span class="big">${esc(r.headline)}</span></a>`).join('')}</div>
    </div>
    <div>
      <div class="h-head"><h2>학원 이야기</h2><div class="seg"><a href="#/notice" aria-selected="true">공지</a>${site.blogUrl ? `<a href="${esc(site.blogUrl)}" target="_blank" rel="noopener">밴드</a>` : ''}</div></div>
      ${recent[0] ? `<div class="story-side"><a class="story v" href="#/notice/${esc(recent[0].id)}"><span class="k">태산학원 소식</span><h4>${esc(recent[0].title)}</h4></a>
        <div><p>${esc((recent[0].body || '').split('\n')[0])}</p><small class="num">${esc(fmtDay(recent[0].date))}</small></div></div>` : ''}
    </div>
  </section>
  </div>`;

  // ---- 첫 화면 배너: 누르면 스크롤월드(선생님 소개)로 이동, 손이 가면 사진 미리 받기 ----
  const box = $('.sw-mini', el);
  const goWorld = () => go('#/world');
  box.onclick = goWorld;
  box.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goWorld(); } };
  ['pointerenter', 'touchstart', 'focus'].forEach((ev) => box.addEventListener(ev, () => prefetchWorld(), { once: true, passive: true }));
  // 첫 화면 이미지가 다 뜬 뒤 잠깐 쉬었다가 스크롤월드 사진을 미리 받아 둠(누르면 바로 열리게)
  const later = () => setTimeout(() => { if (location.hash === '' || location.hash === '#/') prefetchWorld(); }, 1200);
  if (document.readyState === 'complete') later(); else window.addEventListener('load', later, { once: true });

  // ---- 모집안내 캐러셀 (관리자 > 홈 모집안내에서 편집) ----
  const st = { filter: 'all', i: 0, playing: !window.matchMedia('(prefers-reduced-motion: reduce)').matches, timer: null };
  const track = $('#r-track', el);
  const cards = () => RECRUIT.filter((c) => st.filter === 'all' || c.for === st.filter);
  const perView = () => (window.innerWidth <= 640 ? 1 : window.innerWidth <= 1280 ? 2 : 3);
  function drawCards() {
    track.innerHTML = cards().map((c) => `<a class="r-card${c.alt ? ' alt' : ''}" href="${esc(c.href || '#/timetable')}">
      <span class="tag">${esc(c.tag)}</span><p class="copy">${esc(c.copy)}</p>
      <p class="t1">${esc(c.t1)}</p><p class="t2${c.violet ? ' violet' : ''}">${esc(c.t2)}</p><p class="when">${esc(c.when)}</p></a>`).join('');
    st.i = 0; move();
  }
  function move() {
    const n = cards().length, pv = perView(), max = Math.max(0, n - pv);
    if (st.i > max) st.i = 0; if (st.i < 0) st.i = max;
    const card = track.firstElementChild;
    const step = card ? card.getBoundingClientRect().width + 24 : 0;
    track.style.transform = `translateX(${-st.i * step}px)`;
    $('#r-prog', el).style.width = `${n ? Math.min(100, ((st.i + pv) / n) * 100) : 0}%`;
  }
  const tick = () => { st.i += 1; move(); };
  const play = () => { clearInterval(st.timer); if (st.playing) st.timer = setInterval(tick, 5000); };
  $$('[data-r]', el).forEach((b) => (b.onclick = () => {
    const a = b.dataset.r;
    if (a === 'prev') { st.i -= 1; move(); }
    if (a === 'next') { st.i += 1; move(); }
    if (a === 'pause') { st.playing = !st.playing; b.innerHTML = st.playing ? I.pause : I.play; b.setAttribute('aria-label', st.playing ? '자동 넘김 멈춤' : '자동 넘김 시작'); }
    play();
  }));
  $$('[data-rf]', el).forEach((b) => (b.onclick = () => {
    st.filter = b.dataset.rf; $$('[data-rf]', el).forEach((x) => x.setAttribute('aria-pressed', x === b)); drawCards(); play();
  }));
  const onResize = () => move();
  window.addEventListener('resize', onResize);
  window.addEventListener('hashchange', () => { clearInterval(st.timer); window.removeEventListener('resize', onResize); }, { once: true });
  drawCards(); play();

  // ---- 학원소식 ----
  const newsList = upcoming.slice(0, 3);
  let ni = 0;
  function drawNews() {
    const e = newsList[ni];
    $('#news', el).innerHTML = e ? `<div class="news"><span class="tag">${esc(e.type)}</span>
      <h3>${esc(e.title.split('—')[0].trim())}</h3>
      <p>${esc(e.target)}<br>${e.date ? esc(shortDay(e.date)) + ' ' : ''}${esc(e.time)}</p>
      <a class="pill-btn" href="#/events/${esc(e.id)}">자세히 보기 ${I.next.replace('<svg', '<svg width="14" height="14"')}</a></div>` : '<div class="news"><h3>새 소식을 준비하고 있습니다</h3></div>';
    $('#n-dots', el).innerHTML = newsList.map((_, k) => `<button aria-label="${k + 1}번째 소식" aria-current="${k === ni}"></button>`).join('');
    $$('#n-dots button', el).forEach((b, k) => (b.onclick = () => { ni = k; drawNews(); }));
  }
  drawNews();

  // ---- 선생님 ----
  let subj = '전체', page = 0;
  function drawT() {
    const list = vt.filter((t) => subj === '전체' || t.subject === subj);
    const per = window.innerWidth <= 1000 ? 2 : window.innerWidth <= 1280 ? 3 : 4;
    const pages = Math.max(1, Math.ceil(list.length / per));
    page %= pages;
    $('#t-grid', el).innerHTML = list.slice(page * per, page * per + per).map(teacherCard).join('');
    $('#t-next', el).style.display = pages > 1 ? '' : 'none';
  }
  $$('#t-tabs button', el).forEach((b) => (b.onclick = () => {
    subj = b.dataset.s; page = 0; $$('#t-tabs button', el).forEach((x) => x.setAttribute('aria-selected', x === b)); drawT();
  }));
  $('#t-next', el).onclick = () => { page += 1; drawT(); };
  drawT();
}
