import { seed, getSite } from '../backend.js';
import { esc, $, $$, isPast, WEEK } from '../ui.js';
import { load, visible, byOrder, teacherCard, gradeTags, photoOf } from './common.js';
import { mountWorld } from './world.js';

// 강사소개 바로가기 카드 묶음: [필터 키, 버튼 이름, 해당 과목]
const T_FILTERS = [
  ['all', '전체', null],
  ['kor', '국어', ['국어']],
  ['eng', '영어', ['영어']],
  ['math', '수학', ['수학']],
  ['etc', '과학·사회', ['물리', '통합사회·한국사', '과학', '화학']],
  ['lead', '입시전략', []],
];

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

export async function render({ el }) {
  const [teachers, results, events, notices, leaders, classes, links0, site, banners0] = await Promise.all([load('teachers'), load('results'), load('events'), load('notices'), load('leaders'), load('classes'), load('quicklinks').catch(() => seed.quicklinks), getSite(), load('banners').catch(() => seed.banners)]);
  const RECRUIT = visible(banners0).sort(byOrder);
  const LINKS = visible(links0).sort(byOrder);
  const upcoming = visible(events).filter((e) => e.status !== '종료' && !isPast(e.date)).sort((a, b) => (a.date || '9').localeCompare(b.date || '9'));
  const dated = upcoming.filter((e) => e.date);
  const recent = [...visible(notices)].sort((a, b) => (Number(!!b.pinned) - Number(!!a.pinned)) || b.date.localeCompare(a.date)).slice(0, 5);
  const band = visible(results).filter((r) => r.bandLabel).sort((a, b) => (a.bandOrder ?? 9) - (b.bandOrder ?? 9)).slice(0, 5);
  const highlights = visible(results).filter((r) => r.featured).slice(0, 2);
  const vt = visible(teachers).sort(byOrder);

  el.innerHTML = `<div id="sw-root"></div><div class="home wrap">
  <section class="h-sec" aria-labelledby="rc-t">
    <div class="recruit">
      <div>
        <div class="h-head"><h2 id="rc-t">강사소개 바로가기</h2>
          <div class="seg" role="group" aria-label="과목 선택">
            ${T_FILTERS.map(([k, label], i) => `<button data-rf="${k}" aria-pressed="${i === 0}">${label}</button>`).join('')}
          </div></div>
        <div class="r-viewport"><div class="r-track" id="r-track"></div></div>
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
          <div class="ctrl-grp"><button data-r="prev" aria-label="이전 선생님">${I.prev}</button><button data-r="next" aria-label="다음 선생님">${I.next}</button></div>
          <button class="ctrl-one" data-r="pause" aria-label="자동 넘김 멈춤">${I.pause}</button>
          <a class="ctrl-one" href="#/teachers" aria-label="선생님 전체 보기">${I.grid}</a>
        </div>
      </div>
      <div class="dots" id="n-dots"></div>
    </div>
  </section>

  <section class="h-sec" aria-labelledby="rc2-t">
    <div class="h-head"><h2 id="rc2-t">모집안내</h2>
      <div class="seg" role="group" aria-label="대상 선택">
        <button data-rf2="all" aria-pressed="true">전체</button><button data-rf2="grade" aria-pressed="false">고1·고2</button><button data-rf2="pre" aria-pressed="false">예비고1</button>
      </div>
      <a class="plus" href="#/timetable" aria-label="전체 과정 보기">+</a></div>
    <div class="r-viewport"><div class="r-track recruit-full" id="rc2-track"></div></div>
    <div class="r-bar rc2-bar">
      <div class="progress" aria-hidden="true"><i id="rc2-prog"></i></div>
      <div class="ctrl-btns">
        <div class="ctrl-grp"><button data-r2="prev" aria-label="이전 모집안내">${I.prev}</button><button data-r2="next" aria-label="다음 모집안내">${I.next}</button></div>
        <button class="ctrl-one" data-r2="pause" aria-label="자동 넘김 멈춤">${I.pause}</button>
      </div>
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

  // ---- 첫 화면 영상(스크롤 월드) ----
  const unmountWorld = mountWorld($('#sw-root', el), { teachers: vt, leaders: visible(leaders), classes: visible(classes) });
  window.addEventListener('hashchange', unmountWorld, { once: true });

  // ---- 강사소개 바로가기 캐러셀 (모집안내 카드 디자인 그대로) ----
  const st = { filter: 'all', i: 0, playing: !window.matchMedia('(prefers-reduced-motion: reduce)').matches, timer: null };
  const track = $('#r-track', el);
  const people = [...vt, ...visible(leaders).map((l) => ({ ...l, subject: '입시 전략', lead: true }))];
  const cards = () => {
    const f = T_FILTERS.find(([k]) => k === st.filter);
    if (!f || !f[2]) return people;
    return f[0] === 'lead' ? people.filter((p) => p.lead) : people.filter((p) => !p.lead && f[2].includes(p.subject));
  };
  const perView = () => (window.innerWidth <= 640 ? 1 : window.innerWidth <= 1280 ? 2 : 3);
  const schoolLine = (p) => {
    const s = (p.schools || []).map((x) => x.replace(/(고)[123]$/, '$1')).filter((x, i, a) => a.indexOf(x) === i);
    return s.length ? (s.length > 3 ? `${s.slice(0, 3).join(' · ')} 외 ${s.length - 3}` : s.join(' · ')) : '';
  };
  function drawCards() {
    track.innerHTML = cards().map((p, k) => {
      const tag = p.lead ? (p.title || '소장') : [p.subject, gradeTags(p).join('·')].filter(Boolean).join(' · ');
      const copy = p.lead ? (p.role || '') : ((p.highlights || [])[0] || (p.bio || [])[0] || '');
      const when = p.lead ? '설명회·입시 상담' : (schoolLine(p) || '연합반');
      const photo = p.photo ? `<span class="r-ph"><img src="${esc(photoOf(p))}" alt="" loading="lazy" onerror="this.onerror=null;this.src=this.src.replace(/\\.png$/,'.jpg')"></span>` : '';
      return `<a class="r-card t-short${k % 2 ? ' alt' : ''}" data-goto="${esc(p.id)}" href="${p.lead ? '#/teachers' : `#/teachers/${esc(p.id)}`}" aria-label="${esc(p.name)} ${p.lead ? esc(p.title || '') : '선생님'} 소개로 이동">
        <span class="tag">${esc(tag)}</span><p class="copy">${esc(copy)}</p>
        <p class="t1">${esc(p.lead ? '입시 전략' : p.subject)}</p><p class="t2">${esc(p.name)}${p.lead ? ` ${esc(p.title || '')}` : ''}</p><p class="when">${esc(when)}</p>${photo}</a>`;
    }).join('');
    st.i = 0; move();
  }
  // 바로가기: 위 영상 속 그 선생님 소개 카드로 이동(없으면 선생님 페이지로)
  track.addEventListener('click', (e) => {
    const a = e.target.closest('[data-goto]'); if (!a) return;
    const card = document.getElementById(`sw-${a.dataset.goto}`); if (!card) return;
    e.preventDefault();
    const r = card.getBoundingClientRect();
    window.scrollTo({ top: r.top + window.scrollY + r.height / 2 - window.innerHeight / 2, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  });
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

  // ---- 모집안내 캐러셀(강사소개·학원소식 아래) ----
  const rc = { filter: 'all', i: 0, playing: !window.matchMedia('(prefers-reduced-motion: reduce)').matches, timer: null };
  const rcTrack = $('#rc2-track', el);
  const rcCards = () => RECRUIT.filter((c) => rc.filter === 'all' || c.for === rc.filter);
  const rcPer = () => (window.innerWidth <= 640 ? 1 : window.innerWidth <= 1000 ? 2 : window.innerWidth <= 1280 ? 3 : 4);
  function rcMove() {
    const n = rcCards().length, pv = rcPer(), max = Math.max(0, n - pv);
    if (rc.i > max) rc.i = 0; if (rc.i < 0) rc.i = max;
    const card = rcTrack.firstElementChild;
    const step = card ? card.getBoundingClientRect().width + 24 : 0;
    rcTrack.style.transform = `translateX(${-rc.i * step}px)`;
    $('#rc2-prog', el).style.width = `${n ? Math.min(100, ((rc.i + pv) / n) * 100) : 0}%`;
  }
  function rcDraw() {
    rcTrack.innerHTML = rcCards().map((c) => `<a class="r-card${c.alt ? ' alt' : ''}" href="${c.href}">
      <span class="tag">${esc(c.tag)}</span><p class="copy">${esc(c.copy)}</p>
      <p class="t1">${esc(c.t1)}</p><p class="t2${c.violet ? ' violet' : ''}">${esc(c.t2)}</p><p class="when">${esc(c.when)}</p></a>`).join('');
    rc.i = 0; rcMove();
  }
  const rcPlay = () => { clearInterval(rc.timer); if (rc.playing) rc.timer = setInterval(() => { rc.i += 1; rcMove(); }, 5500); };
  $$('[data-r2]', el).forEach((b) => (b.onclick = () => {
    const a = b.dataset.r2;
    if (a === 'prev') { rc.i -= 1; rcMove(); }
    if (a === 'next') { rc.i += 1; rcMove(); }
    if (a === 'pause') { rc.playing = !rc.playing; b.innerHTML = rc.playing ? I.pause : I.play; b.setAttribute('aria-label', rc.playing ? '자동 넘김 멈춤' : '자동 넘김 시작'); }
    rcPlay();
  }));
  $$('[data-rf2]', el).forEach((b) => (b.onclick = () => {
    rc.filter = b.dataset.rf2; $$('[data-rf2]', el).forEach((x) => x.setAttribute('aria-pressed', x === b)); rcDraw(); rcPlay();
  }));
  window.addEventListener('resize', rcMove);
  window.addEventListener('hashchange', () => { clearInterval(rc.timer); window.removeEventListener('resize', rcMove); }, { once: true });
  rcDraw(); rcPlay();

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
