import { seed } from '../backend.js';
import { esc, $, $$, statusTag } from '../ui.js';
import { load, visible, pageHead, applyClass } from './common.js';

export async function render({ el, query, site }) {
  const [classes, schools] = await Promise.all([load('classes'), load('schools')]);
  const all = visible(classes);
  const st = {
    term: query.term || 'final',
    school: query.school || '전체',
    grade: query.grade || '전체',
    subject: query.subject || '전체',
    teacher: query.teacher || '',
    group: query.group || 'school',
  };
  const term = seed.terms.find((t) => t.id === st.term) || seed.terms[0];

  el.innerHTML = `${pageHead('시간표', '학교·학년·과목으로 좁혀 보고, 원하는 반에서 바로 수강 신청하세요.', [['시간표']])}
  <div class="wrap page">
    <div class="tabs" role="tablist">${seed.terms.map((t) => `<button role="tab" data-term="${t.id}" aria-selected="${t.id === st.term}">${esc(t.name)} <small style="font-weight:600">${esc(t.note)}</small></button>`).join('')}</div>
    <div class="filters" id="filters"></div>
    ${st.term === 'mid' ? '<div class="callout">지난 2학기 중간대비 시간표입니다. 지금 신청할 수 있는 반은 <a class="link" href="#/timetable?term=final">기말대비</a>에서 확인하세요.</div>' : ''}
    <p class="notice-line">${esc(site.timetableNotice)}</p>
    <div id="table"></div>
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
    const teachers = [...new Set(inTerm.map((c) => c.teacherName).filter(Boolean))];
    const chipRow = (label, key, list) => `<div class="f-row"><span class="f-label">${label}</span><div class="chips">${list.map((v) => `<button class="chip" data-k="${key}" data-v="${esc(v)}" aria-pressed="${st[key] === v}">${esc(v)}</button>`).join('')}</div></div>`;
    $('#filters', el).innerHTML = `
      ${st.term !== 'pre' ? chipRow('학교', 'school', schoolList) : ''}
      ${grades.length > 2 ? chipRow('학년', 'grade', grades) : ''}
      ${chipRow('과목', 'subject', subjects)}
      <div class="f-row"><span class="f-label">선생님</span>
        <select class="select" style="max-width:220px" id="f-teacher"><option value="">전체</option>${teachers.map((t) => `<option ${st.teacher === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>
        ${st.term !== 'pre' ? `<span class="f-label" style="margin-left:12px">묶어보기</span><div class="chips">${[['school', '학교별'], ['subject', '과목별'], ['none', '목록']].map(([v, t]) => `<button class="chip" data-k="group" data-v="${v}" aria-pressed="${st.group === v}">${t}</button>`).join('')}</div>` : ''}
      </div>`;
    $$('[data-k]', el).forEach((b) => (b.onclick = () => { st[b.dataset.k] = b.dataset.v; drawFilters(); drawTable(); sync(); }));
    $('#f-teacher', el).onchange = (e) => { st.teacher = e.target.value; drawTable(); sync(); };
  }

  function drawTable() {
    const rows = all.filter((c) => c.term === st.term
      && (st.school === '전체' || c.school === st.school)
      && (st.grade === '전체' || c.grade === st.grade)
      && (st.subject === '전체' || c.subject === st.subject)
      && (!st.teacher || c.teacherName === st.teacher)).sort((a, b) => a.order - b.order);
    if (!rows.length) {
      $('#table', el).innerHTML = `<div class="empty"><p>조건에 맞는 반이 없습니다.</p><p><button class="btn ghost sm" id="reset">필터 초기화</button> <a class="btn sm" href="#/consult">반 개설 문의</a></p></div>`;
      $('#reset', el).onclick = () => { Object.assign(st, { school: '전체', grade: '전체', subject: '전체', teacher: '' }); drawFilters(); drawTable(); sync(); };
      return;
    }
    const groupKey = st.term === 'pre' ? 'subject' : st.group;
    const groups = groupKey === 'none' ? [['', rows]] : [...rows.reduce((m, r) => m.set(r[groupKey] || '기타', [...(m.get(r[groupKey] || '기타') || []), r]), new Map())];
    const isPre = st.term === 'pre';
    $('#table', el).innerHTML = `<p class="notice-line"><b class="num">${rows.length}</b>개 반 · ${esc(term.name)}</p>
      <div class="tt-wrap"><table class="tt">
      <thead><tr>${isPre ? '' : '<th>학교</th><th>학년</th>'}<th>과목</th><th>선생님</th><th>강좌</th><th>개강</th><th>수업 시간</th><th><span class="sr">신청</span></th></tr></thead>
      <tbody>${groups.map(([g, list]) => `${g ? `<tr class="tt-group"><td colspan="8">${esc(g)} <small>${list.length}개 반</small></td></tr>` : ''}${list.map((c) => `<tr>
        ${isPre ? '' : `<td class="t-school">${esc(c.school)}</td><td>${esc(c.grade)}</td>`}
        <td>${esc(c.subject)}</td>
        <td>${c.teacherId ? `<a class="link" href="#/teachers/${esc(c.teacherId)}">${esc(c.teacherName)}</a>` : esc(c.teacherName || '추후 공개')}</td>
        <td class="t-title">${esc(c.title || '학교 내신반')} ${statusTag(c.status)}</td>
        <td class="num">${esc(c.start)}</td>
        <td class="t-time num">${esc(c.time || '추후 안내')}</td>
        <td class="t-act"><button class="btn sm ${c.status === '마감' || st.term === 'mid' ? 'ghost' : ''}" data-apply="${esc(c.id)}">${c.status === '마감' || st.term === 'mid' ? '대기 신청' : '수강 신청'}</button></td>
      </tr>`).join('')}`).join('')}</tbody></table></div>`;
    $$('[data-apply]', el).forEach((b) => (b.onclick = () => applyClass(all.find((c) => c.id === b.dataset.apply))));
  }

  $$('[data-term]', el).forEach((b) => (b.onclick = () => { location.hash = `#/timetable?term=${b.dataset.term}`; }));
  drawFilters(); drawTable();
}
