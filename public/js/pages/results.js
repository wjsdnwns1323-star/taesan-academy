import { esc, $, $$ } from '../ui.js';
import { load, visible, pageHead } from './common.js';

export async function render({ el, query }) {
  const results = visible(await load('results'));
  const exams = [...new Set(results.map((r) => r.exam))];
  const st = { exam: query.exam || '전체', subject: '전체' };
  el.innerHTML = `${pageHead('시험 결과', '선생님별로 공개한 학교 시험·모의고사 결과입니다.', [['시험 결과']])}
  <div class="wrap page">
    <div class="callout">가채점 표시는 학교 성적 발표 전 학원 집계 수치입니다. 확정되면 업데이트합니다. 학생 이름은 공개하지 않습니다.</div>
    <div class="filters"><div class="f-row"><span class="f-label">시험</span><div class="chips" id="f-exam"></div></div>
    <div class="f-row"><span class="f-label">과목</span><div class="chips" id="f-subj"></div></div></div>
    <div class="score-board" id="board"></div>
  </div>`;
  const chips = (box, key, list) => {
    $(box, el).innerHTML = list.map((v) => `<button class="chip" data-v="${esc(v)}" aria-pressed="${st[key] === v}">${esc(v)}</button>`).join('');
    $$(`${box} .chip`, el).forEach((b) => (b.onclick = () => { st[key] = b.dataset.v; draw(); }));
  };
  function draw() {
    chips('#f-exam', 'exam', ['전체', ...exams]);
    chips('#f-subj', 'subject', ['전체', ...new Set(results.map((r) => r.subject))]);
    const rows = results.filter((r) => (st.exam === '전체' || r.exam === st.exam) && (st.subject === '전체' || r.subject === st.subject));
    $('#board', el).innerHTML = rows.map((r) => `<div class="score">
      <div class="who">${esc(r.exam)}${r.provisional ? ' <span class="tag seal">가채점</span>' : ''}</div>
      <div class="who" style="color:var(--text)">${esc(r.school || '전체')} ${esc(r.grade || '')} · ${esc(r.subject)} <a class="link" href="#/teachers?subject=${encodeURIComponent(r.subject)}">${esc(r.teacherName)}</a></div>
      <p class="big"><span>${esc(r.headline)}</span></p><p class="detail">${esc(r.detail)}</p></div>`).join('') || '<p class="empty">해당 결과가 없습니다.</p>';
  }
  draw();
}
