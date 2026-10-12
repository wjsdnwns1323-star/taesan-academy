import { seed } from '../backend.js';
import { esc, $, $$, statusTag, dayParts, isPast } from '../ui.js';
import { load, visible, byOrder, teacherCard, applyClass } from './common.js';

const SUBJ_ORDER = ['국어', '영어', '수학', '통합사회·한국사', '물리', '통합과학', '화학'];

export async function render({ el, site, query }) {
  const [classes, teachers, results, events, notices, schools] = await Promise.all([
    load('classes'), load('teachers'), load('results'), load('events'), load('notices'), load('schools'),
  ]);
  const vClasses = visible(classes);
  const state = { term: query.term === 'pre' ? 'pre' : 'final', school: query.school || '대성고', grade: query.grade || '고1' };

  const featured = visible(results).filter((r) => r.featured).slice(0, 8);
  const upcoming = visible(events).filter((e) => e.status !== '종료' && !isPast(e.date)).sort((a, b) => (a.date || '9').localeCompare(b.date || '9'));
  const pinned = [...visible(notices)].sort((a, b) => (b.pinned - a.pinned) || b.date.localeCompare(a.date)).slice(0, 5);

  el.innerHTML = `
  <section class="finder" aria-labelledby="finder-t">
    <div class="wrap">
      <div class="finder-head">
        <div>
          <h1 id="finder-t">우리 학교 <span class="hl">기말 범위</span>,<br>반부터 찾으세요</h1>
          <p class="lead">대전 둔산 태산학원은 학교마다 따로 반을 엽니다. 학교와 학년을 고르면 이번 기말대비 수업이 바로 나옵니다.</p>
        </div>
        <div class="term-switch" role="group" aria-label="과정 선택">
          <button data-term="final" aria-pressed="${state.term === 'final'}">2학기 기말대비</button>
          <button data-term="pre" aria-pressed="${state.term === 'pre'}">예비고1</button>
        </div>
      </div>
      <div class="finder-body">
        <div class="finder-pick" id="pick"></div>
        <div class="finder-result" id="result" aria-live="polite"></div>
      </div>
    </div>
  </section>

  <section class="section">
    <div class="wrap">
      <div class="sec-head"><div><h2>모집 중인 과정</h2><p>지금 신청할 수 있는 반과 설명회입니다.</p></div><a class="more" href="#/timetable">전체 시간표</a></div>
      <div class="banners">
        <a class="banner primary" href="#/timetable?term=final"><span class="for">고1 · 고2</span><h3>2학기 기말대비 학교별 내신반</h3><p>대성·대신·대전외고·공주사대부고 등 11개 학교·연합반</p><span class="when">10월 순차 개강</span></a>
        <a class="banner" href="#/timetable?term=pre"><span class="for">중3 · 예비고1</span><h3>예비고1 겨울 과정</h3><p>국어 올인원, PRE 대성·대신·대전외고 영어, 물리 3단계</p><span class="when">10/25 ~ 12월 개강</span></a>
        ${upcoming.slice(0, 2).map((e) => `<a class="banner" href="#/events/${esc(e.id)}"><span class="for">${esc(e.type)} · ${esc(e.target)}</span><h3>${esc(e.title.split('—')[0])}</h3><p>${esc(e.benefit || '')}</p><span class="when">${e.date ? esc(e.date.slice(5).replace('-', '/')) + ' ' + esc(e.time) : '상시 신청'} ${statusTag(e.status)}</span></a>`).join('')}
      </div>
    </div>
  </section>

  <section class="section alt">
    <div class="wrap">
      <div class="sec-head"><div><h2>2학기 중간고사 결과</h2><p>선생님별로 공개한 결과입니다.</p></div><a class="more" href="#/results">결과 전체 보기</a></div>
      <div class="score-board">
        ${featured.map((r) => `<div class="score">
          <div class="who">${esc(r.school || '전체')} ${esc(r.grade || '')} · ${esc(r.subject)} ${esc(r.teacherName)}${r.provisional ? ' <span class="tag seal">가채점</span>' : ''}</div>
          <p class="big"><span>${esc(r.headline)}</span></p>
          <p class="detail">${esc(r.detail)}</p></div>`).join('')}
      </div>
      <p class="disclaimer">가채점 표시는 학교 발표 전 학원 집계 수치입니다. 확정되면 업데이트합니다.</p>
    </div>
  </section>

  <section class="section">
    <div class="wrap">
      <div class="sec-head"><div><h2>선생님</h2><p>맡은 학교와 결과로 소개합니다.</p></div><a class="more" href="#/teachers">전체 보기</a></div>
      <div class="tabs" role="tablist" id="t-tabs">
        ${['전체', ...seed.subjects].map((s, i) => `<button role="tab" aria-selected="${i === 0}" data-s="${esc(s)}">${esc(s)}</button>`).join('')}
      </div>
      <div class="t-grid" id="t-grid"></div>
    </div>
  </section>

  <section class="section alt">
    <div class="wrap two-col">
      <div>
        <div class="sec-head"><h3>공지사항</h3><a class="more" href="#/notice">더보기</a></div>
        <div class="board"><ul>${pinned.map((n) => `<li><a href="#/notice/${esc(n.id)}">${n.pinned ? '<span class="tag">공지</span>' : `<span class="tag muted">${esc(n.category || '안내')}</span>`}<span class="title">${esc(n.title)}</span><span class="date num">${esc(n.date.slice(5).replace('-', '.'))}</span></a></li>`).join('')}</ul></div>
      </div>
      <div>
        <div class="sec-head"><h3>설명회·특강</h3><a class="more" href="#/events">더보기</a></div>
        ${upcoming.slice(0, 3).map((e) => { const d = dayParts(e.date); return `<a class="ev-card" href="#/events/${esc(e.id)}">
          <div class="ev-date">${d ? `<b class="num">${d.d}</b><span>${d.m}월 ${d.w}</span>` : '<b>상시</b><span>신청</span>'}</div>
          <div><h4>${esc(e.title)}</h4><p>${esc(e.time)} · ${esc(e.place)} · ${esc(e.target)}</p><p>${statusTag(e.status)}</p></div></a>`; }).join('') || '<p class="empty">예정된 설명회가 없습니다.</p>'}
      </div>
    </div>
  </section>

  <section class="section">
    <div class="wrap">
      <div class="info-band">
        <div><h3>상담 전화</h3><a class="v num" href="tel:${esc(site.phone.replace(/-/g, ''))}">${esc(site.phone)}</a><p>${esc(site.hours || '상담 가능 시간은 전화로 확인해 주세요.')}</p></div>
        <div><h3>본관</h3><p class="v" style="font-size:18px">${esc(site.branches[0].address)}</p><p><a class="link" href="#/location">오시는 길</a></p></div>
        <div><h3>처음이라면</h3><p class="v" style="font-size:18px">진단고사로 실력부터 확인</p><p><a class="link" href="#/events/e-diag">대성대신 진단고사 신청</a> · <a class="link" href="#/visit">방문 상담 예약</a></p></div>
      </div>
    </div>
  </section>`;

  // ---- 학교 찾기 ----
  const schoolCount = (sid) => vClasses.filter((c) => c.term === 'final' && c.school === sid).length;

  function drawPick() {
    const pick = $('#pick', el);
    if (state.term === 'pre') {
      pick.innerHTML = `<h2>예비고1 과목</h2><div class="chips">${['전체', ...SUBJ_ORDER].filter((s) => s === '전체' || vClasses.some((c) => c.term === 'pre' && c.subject === s))
        .map((s) => `<button class="chip" data-subj="${esc(s)}" aria-pressed="${(state.subj || '전체') === s}">${esc(s)}</button>`).join('')}</div>
        <p class="notice-line" style="margin-top:18px">중3 겨울방학, 고등 첫 내신을 학교별로 준비하는 과정입니다. 원하는 고등학교에 맞춘 PRE 반이 따로 있습니다.</p>`;
      $$('[data-subj]', pick).forEach((b) => (b.onclick = () => { state.subj = b.dataset.subj; drawPick(); drawResult(); }));
      return;
    }
    pick.innerHTML = `<h2>학교 선택</h2>
      <div class="school-grid">${visible(schools).map((s) => `<button class="school-btn" data-school="${esc(s.id)}" aria-pressed="${state.school === s.id}">
        <b>${esc(s.id)}</b><span>${esc(s.type)}</span><em class="num">${schoolCount(s.id)}반</em></button>`).join('')}</div>
      <div class="grade-row"><span class="label">학년</span>${['고1', '고2'].map((g) => `<button class="chip" data-grade="${g}" aria-pressed="${state.grade === g}">${g}</button>`).join('')}</div>`;
    $$('[data-school]', pick).forEach((b) => (b.onclick = () => {
      state.school = b.dataset.school;
      const sc = schools.find((s) => s.id === state.school);
      if (sc && !sc.grades.includes(state.grade)) state.grade = sc.grades[0];
      drawPick(); drawResult();
    }));
    $$('[data-grade]', pick).forEach((b) => (b.onclick = () => { state.grade = b.dataset.grade; drawPick(); drawResult(); }));
  }

  function drawResult() {
    const box = $('#result', el);
    let rows, title, link;
    if (state.term === 'pre') {
      rows = vClasses.filter((c) => c.term === 'pre' && (!state.subj || state.subj === '전체' || c.subject === state.subj) && c.status !== '마감');
      title = '예비고1'; link = '#/timetable?term=pre';
    } else {
      rows = vClasses.filter((c) => c.term === 'final' && c.school === state.school && (c.grade === state.grade || c.grade.includes(state.grade.slice(1))));
      title = `${state.school} ${state.grade}`; link = `#/timetable?term=final&school=${encodeURIComponent(state.school)}&grade=${state.grade}`;
    }
    rows.sort((a, b) => SUBJ_ORDER.indexOf(a.subject) - SUBJ_ORDER.indexOf(b.subject) || a.order - b.order);
    box.innerHTML = `<header><h2>${esc(title)}</h2><a href="${link}">시간표에서 보기</a></header>
      ${rows.length ? rows.slice(0, 7).map((c) => `<div class="slot">
        <span class="subj">${esc(c.subject.replace('통합사회·한국사', '통사'))}</span>
        <div><div class="who">${esc(c.teacherName || '추후 공개')}${c.title ? ` · ${esc(c.title)}` : ''} ${statusTag(c.status)}</div>
        <div class="when num">개강 ${esc(c.start)}${c.time ? ` · ${esc(c.time)}` : ''}</div></div>
        <button data-apply="${esc(c.id)}">${c.status === '마감' ? '대기 신청' : '신청'}</button></div>`).join('')
        + (rows.length > 7 ? `<p class="notice-line" style="margin-top:10px">외 ${rows.length - 7}개 반은 <a class="link" href="${link}">시간표</a>에서 볼 수 있습니다.</p>` : '')
        : `<div class="empty"><p>이 학교·학년은 아직 열린 반이 없습니다.</p><p><a class="link" href="#/timetable?term=final&school=연합반">연합반 보기</a> 또는 <a class="link" href="#/consult">반 개설 문의</a></p></div>`}
      <p class="notice-line" style="margin-top:auto;padding-top:14px">${esc(site.timetableNotice)}</p>`;
    $$('[data-apply]', box).forEach((b) => (b.onclick = () => applyClass(classes.find((c) => c.id === b.dataset.apply))));
  }

  $$('[data-term]', el).forEach((b) => (b.onclick = () => {
    state.term = b.dataset.term;
    $$('[data-term]', el).forEach((x) => x.setAttribute('aria-pressed', x === b));
    drawPick(); drawResult();
  }));
  drawPick(); drawResult();

  // ---- 선생님 탭 ----
  const vt = visible(teachers).sort(byOrder);
  const drawT = (s) => { $('#t-grid', el).innerHTML = vt.filter((t) => s === '전체' || t.subject === s).map(teacherCard).join(''); };
  $$('#t-tabs button', el).forEach((b) => (b.onclick = () => {
    $$('#t-tabs button', el).forEach((x) => x.setAttribute('aria-selected', x === b)); drawT(b.dataset.s);
  }));
  drawT('전체');
}
