import { seed } from '../backend.js';
import { esc, $, $$ } from '../ui.js';
import { load, visible, pageHead, applyClass, avatar } from './common.js';

const HERO = {
  final: { copy: '학교별 시험 범위 그대로\n학교마다 따로 여는 내신반', title: '2학기 기말대비 내신반', target: '고1·고2 (연합반 포함)', open: '10월 순차 개강', status: '현재 접수 중' },
  pre: { copy: '고등 첫 내신을\n중3 겨울부터 준비하는', title: '예비고1 과정', target: '중3·예비고1', open: '10/25 ~ 12월 순차 개강', status: '현재 접수 중' },
  mid: { copy: '지난 학기 시간표입니다\n이번 학기 반은 기말대비에서 확인하세요', title: '2학기 중간대비 내신반', target: '고1·고2·고3', open: '8월 개강 (종료)', status: '접수 종료 · 대기 신청 가능' },
};

const statusTag = (c) => {
  if (c.term === 'mid') return '<span class="tag muted">종료</span>';
  if (c.status === '마감') return '<span class="tag seal">마감</span>';
  if (c.status === '마감임박') return '<span class="tag marker">마감임박</span>';
  if (c.status === '진행중') return '<span class="tag ok">진행중</span>';
  return '<span class="tag blue">학원 접수중</span>';
};
const dayOf = (time) => (time || '').split(/\s/)[0] || '';
const hoursOf = (time) => (time || '').replace(/^[^\s]+\s/, '');

export async function render({ el, query, site }) {
  const [classes, schools, teachers] = await Promise.all([load('classes'), load('schools'), load('teachers')]);
  const all = visible(classes);
  const tById = Object.fromEntries(teachers.map((t) => [t.id, t]));
  const st = {
    term: query.term || 'final',
    school: query.school || '전체',
    grade: query.grade || '전체',
    subject: query.subject || '전체',
    teacher: query.teacher || '',
  };
  const term = seed.terms.find((t) => t.id === st.term) || seed.terms[0];
  const hero = HERO[term.id];

  el.innerHTML = `${pageHead('내신 시간표', '', [['내신 시간표']])}
  <div class="wrap page">
    <div class="tabs" role="tablist">${seed.terms.map((t) => `<button role="tab" data-term="${t.id}" aria-selected="${t.id === term.id}">${esc(t.name)} <small>${esc(t.note)}</small></button>`).join('')}</div>
    <div class="course-hero">
      <div class="l"><p>${esc(hero.copy)}</p><h2>${esc(hero.title)}</h2></div>
      <dl class="r">
        <div><dt>모집대상</dt><dd>${esc(hero.target)}</dd></div>
        <div><dt>개강일</dt><dd>${esc(hero.open)}</dd></div>
        <div><dt>접수 기간</dt><dd>${esc(hero.status)}</dd></div>
        <div><dt>문의/상담</dt><dd><a class="num" href="tel:${esc(site.phone.replace(/-/g, ''))}">${esc(site.phone)}</a></dd></div>
      </dl>
    </div>
    <div class="filters" id="filters"></div>
    <div id="list"></div>
  </div>`;

  const sync = () => {
    const q = new URLSearchParams({ term: st.term, ...(st.school !== '전체' && { school: st.school }), ...(st.grade !== '전체' && { grade: st.grade }), ...(st.subject !== '전체' && { subject: st.subject }), ...(st.teacher && { teacher: st.teacher }), _keep: 1 });
    history.replaceState(null, '', `#/timetable?${q}`);
  };

  function drawFilters() {
    const inTerm = all.filter((c) => c.term === st.term);
    const schoolList = ['전체', ...visible(schools).map((s) => s.id).filter((s) => inTerm.some((c) => c.school === s))];
    const grades = ['전체', ...new Set(inTerm.map((c) => c.grade))];
    const subjects = ['전체', ...new Set(inTerm.map((c) => c.subject))];
    const tnames = [...new Set(inTerm.map((c) => c.teacherName).filter(Boolean))];
    const row = (label, key, list) => `<div class="f-row"><span class="f-label">${label}</span><div class="chips">${list.map((v) => `<button class="chip" data-k="${key}" data-v="${esc(v)}" aria-pressed="${st[key] === v}">${esc(v === '통합사회·한국사' ? '통사·한국사' : v)}</button>`).join('')}</div></div>`;
    $('#filters', el).innerHTML = `
      ${st.term !== 'pre' ? row('학교', 'school', schoolList) : ''}
      ${grades.length > 2 ? row('학년', 'grade', grades) : ''}
      ${row('과목', 'subject', subjects)}
      <div class="f-row"><label class="f-label" for="f-teacher">선생님</label>
        <select class="select" style="max-width:240px" id="f-teacher"><option value="">전체</option>${tnames.map((t) => `<option ${st.teacher === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></div>`;
    $$('[data-k]', el).forEach((b) => (b.onclick = () => { st[b.dataset.k] = b.dataset.v; drawFilters(); drawList(); sync(); }));
    $('#f-teacher', el).onchange = (e) => { st.teacher = e.target.value; drawList(); sync(); };
  }

  function drawList() {
    const rows = all.filter((c) => c.term === st.term
      && (st.school === '전체' || c.school === st.school)
      && (st.grade === '전체' || c.grade === st.grade)
      && (st.subject === '전체' || c.subject === st.subject)
      && (!st.teacher || c.teacherName === st.teacher)).sort((a, b) => a.order - b.order);
    if (!rows.length) {
      $('#list', el).innerHTML = `<p class="total">총 <b>0</b>건</p><div class="empty"><p>조건에 맞는 반이 없습니다.</p><p><button class="btn gray sm" id="reset">필터 초기화</button> <a class="btn sm" href="#/consult">반 개설 문의</a></p></div>`;
      $('#reset', el).onclick = () => { Object.assign(st, { school: '전체', grade: '전체', subject: '전체', teacher: '' }); drawFilters(); drawList(); sync(); };
      return;
    }
    const closed = (c) => c.status === '마감' || c.term === 'mid';
    $('#list', el).innerHTML = `<p class="total"><span>총 <b class="num">${rows.length}</b>건</span><span style="font-size:14px;color:var(--muted)">${esc(site.timetableNotice)}</span></p>
      ${rows.map((c) => { const t = tById[c.teacherId]; return `<article class="course">
        <div class="who">${c.teacherId ? `<a href="#/teachers/${esc(c.teacherId)}">${avatar(t || { name: c.teacherName })}</a>` : avatar({ name: c.teacherName || '미정' })}
          <p><span>${esc(c.subject === '통합사회·한국사' ? '통사' : c.subject)}</span>${esc(c.teacherName || '추후 공개')}</p></div>
        <div>
          <div class="tags"><span class="tag box">${esc(c.grade)}</span>${c.school ? `<span class="tag box">${esc(c.school)}</span>` : ''}${statusTag(c)}</div>
          <h3>${c.school ? `[${esc(c.school)}]` : ''}[${esc(c.subject === '통합사회·한국사' ? '통사·한국사' : c.subject)}] ${esc(c.title || `${c.grade} 내신반`)}</h3>
          <p class="when num">${esc(c.start)}${/개강|~|종료|월$/.test(c.start) ? '' : ' 개강'}${c.time ? ` <span>[${esc(dayOf(c.time))}] ${esc(hoursOf(c.time))}</span>` : ' <span>시간 추후 안내</span>'}</p>
        </div>
        <div class="act">
          <button class="btn ${closed(c) ? 'gray' : 'line'}" data-apply="${esc(c.id)}">${closed(c) ? '대기 신청' : '수강 신청'}</button>
        </div>
      </article>`; }).join('')}`;
    $$('[data-apply]', el).forEach((b) => (b.onclick = () => applyClass(all.find((c) => c.id === b.dataset.apply))));
  }

  $$('[data-term]', el).forEach((b) => (b.onclick = () => { location.hash = `#/timetable?term=${b.dataset.term}`; }));
  drawFilters(); drawList();
}
