import { seed } from '../backend.js';
import { esc, $$, statusTag } from '../ui.js';
import { load, visible, byOrder, pageHead, teacherCard, monogram, showClassPlan } from './common.js';

export async function list({ el, query }) {
  const teachers = visible(await load('teachers')).sort(byOrder);
  const leaders = visible(await load('leaders'));
  const subjects = seed.subjects.filter((s) => teachers.some((t) => t.subject === s));
  let cur = query.subject || '전체';
  el.innerHTML = `${pageHead('선생님', '', [['선생님']])}
  <div class="wrap page">
    <div class="tabs" role="tablist">${['전체', ...subjects].map((s) => `<button role="tab" aria-selected="${s === cur}" data-s="${esc(s)}">${esc(s)}</button>`).join('')}</div>
    <div id="groups"></div>
    <div class="sub-group"><h2>입시·설명회</h2>
      <div class="t-grid">${leaders.map((l) => `<div class="t-card"><span class="tags"><span class="tag">${esc(l.title)}</span></span>
        <span class="subj">입시 전략</span><h3>${esc(l.name)}</h3><p class="hl">${esc(l.role)}</p>
        <span class="ph">${monogram(l)}</span></div>`).join('')}</div>
    </div>
  </div>`;
  const draw = () => {
    const show = cur === '전체' ? subjects : [cur];
    el.querySelector('#groups').innerHTML = show.map((s) => `<section class="sub-group"><h2>${esc(s)}</h2>
      <div class="t-grid">${teachers.filter((t) => t.subject === s).map(teacherCard).join('')}</div></section>`).join('');
  };
  $$('[data-s]', el).forEach((b) => (b.onclick = () => {
    cur = b.dataset.s; $$('[data-s]', el).forEach((x) => x.setAttribute('aria-selected', x === b)); draw();
    history.replaceState(null, '', cur === '전체' ? '#/teachers' : `#/teachers?subject=${encodeURIComponent(cur)}`);
  }));
  draw();
}

const listBlock = (title, items, cls = '') => (items && items.length ? `<div class="block"><h3>${title}</h3><ul class="${cls}">${items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul></div>` : '');

export async function detail({ el, params }) {
  const [teachers, classes, results] = await Promise.all([load('teachers'), load('classes'), load('results')]);
  const t = teachers.find((x) => x.id === params.id);
  if (!t) { el.innerHTML = `<div class="wrap page"><div class="empty"><p>선생님 정보를 찾을 수 없습니다.</p><p><a class="btn" href="#/teachers">선생님 목록</a></p></div></div>`; return; }
  const mine = visible(classes).filter((c) => c.teacherId === t.id || c.teacherName === t.name);
  const now = mine.filter((c) => c.term !== 'mid');
  const res = visible(results).filter((r) => r.teacherName === t.name);

  el.innerHTML = `${pageHead(`${t.name} 선생님`, '', [['선생님', '#/teachers'], [t.name]])}
  <div class="wrap page"><div class="profile">
    <div><div class="p-photo">${monogram(t)}</div>
      <div class="toolbar" style="margin-top:14px"><a class="btn block" href="#/timetable?teacher=${encodeURIComponent(t.name)}&term=final">시간표 보기</a></div>
    </div>
    <div>
      <p class="subj">${esc(t.subject)}${t.brand ? ` · ${esc(t.brand)}` : ''}</p>
      <h2>${esc(t.name)}</h2>
      ${(t.schools || []).length ? `<p style="margin-top:10px" class="chips">${t.schools.map((s) => `<span class="tag">${esc(s)}</span>`).join('')}</p>` : ''}
      ${listBlock('약력', t.bio)}
      ${res.length ? `<div class="block"><h3>시험 결과</h3><ul>${res.map((r) => `<li><b>${esc(r.exam)} ${esc(r.school)} ${esc(r.grade)}</b> — <span class="mark">${esc(r.headline)}</span> ${esc(r.detail)} ${r.provisional ? '<span class="tag seal">가채점</span>' : ''}</li>`).join('')}</ul></div>` : listBlock('시험 결과', t.highlights)}
      ${now.length ? `<div class="block"><h3>지금 열린 반</h3><div class="tt-wrap"><table class="tt"><tbody>${now.map((c) => `<tr>
        <td class="t-school">${esc(c.school || c.grade)}</td><td>${esc(c.school ? c.grade : '')}</td><td class="t-title">${esc(c.title || '학교 내신반')} ${statusTag(c.status)}</td>
        <td class="num">${esc(c.start)}</td><td class="t-time num">${esc(c.time || '추후 안내')}</td>
        <td class="t-act"><button class="btn sm" data-view="${esc(c.id)}">강의계획 보기</button></td></tr>`).join('')}</tbody></table></div></div>` : ''}
      ${t.method && t.method.length ? `<div class="block"><h3>수업 방식</h3><ol class="steps">${t.method.map((m) => `<li>${esc(m)}</li>`).join('')}</ol></div>` : ''}
      ${listBlock('교재', t.materials)}
      ${listBlock('예비고1 과정', t.prehigh)}
      ${listBlock('설명회·특강', t.roles)}
    </div>
  </div></div>`;
  $$('[data-view]', el).forEach((b) => (b.onclick = () => showClassPlan(mine.find((c) => c.id === b.dataset.view), t)));
}

export async function curriculum({ el }) {
  const curricula = [
    { teacher: '김도현', title: '예비고1 올인원 국어 SEASON 1~4', steps: ['SEASON 1 고전 문학 · 8주(종료)', 'SEASON 2 현대 문학 · 6주(9/6 개강, 일 17:00~20:00)', 'SEASON 3 문법 · 6주(10/25 개강)', 'SEASON 4 실전 올인원 · 10주(12월 개강)'],
      note: '현대 문학: 문학 개념어 ①② → 일제 강점기 → 광복 직후~1950년대 → 1960~1980년대 → 1990년대 이후. 수능까지 이어지는 국어 공부법을 중3부터 적용합니다.' },
    { teacher: '김도현', title: '대전예고1 내신반 운영(매주 목 20:30~23:30)', steps: ['[문학] 2-1 청산별곡 작품·교과서 활동', '복습 TEST·오답 / 심화 개념·연계 작품', '[독서] 1-1 인공 지능을 보는 다양한 관점', '[문학] 2-2 속미인곡 · 교과서 활동·연계 작품', '[문법] 4-1 중세 국어 문법 기본 · 심화', '[화작] 3단원', '직전 보강 FINAL TEST·오답'],
      note: '대전예고 맞춤형 자체 교재, 핵심 압축 강의와 즉각적인 피드백. 시험 1~2주 전 실전 모의고사, 시험 전날 학교별 직전 보강.' },
    { teacher: '이건준', title: '내신개정 VER.3.0', steps: ['선지어휘 강화', '전국기출 N제', '데일리 KTK'], note: '대신고1 기말 전략: 원문을 더 단단하게 → 변형을 더 다양하게 → 고난도 적용까지. 대성고는 외부지문 분석집을 따로 제공합니다.' },
    { teacher: '이예원', title: '문법과 구문을 연결하는 수업', steps: ['구조를 읽는 힘 — 복잡한 문장 분석에서 어법 판단까지', '의미를 연결하는 힘 — 인과·대조·논리 파악', '숨은 의미를 풀어내는 힘 — 함축·비유를 실제 의미로'], note: '짧은 문장 O/X 연습에 그치지 않고, 긴 문장에서 필요한 문법 개념을 찾아 근거로 판단하는 훈련을 합니다.' },
    { teacher: '양지운', title: '공통수학2 내신집중반 7주', steps: ['WEEK 1~3 개념복습 양개념(WORKBOOK 공통수학Ⅱ, 미래엔 교과서)', 'WEEK 4~6 실전개념 기출(ACCELERATOR SERIES 3, 학교 프린트)', 'WEEK 7 동형 모의고사(HIGH-END FINAL, 직보 형식)'], note: '' },
    { teacher: '최성훈', title: '예비고1 물리 3단계', steps: ['물리학 비기너', '물리학 문제풀이(10주, 시즌2 9/12 개강)', '물리학 마스터(12월 개강)'], note: '' },
  ];
  el.innerHTML = `${pageHead('커리큘럼·교재', '선생님별 수업 순서와 쓰는 교재입니다.', [['선생님', '#/teachers'], ['커리큘럼·교재']])}
  <div class="wrap page"><div class="mid">${curricula.map((c) => `<div class="card"><p class="subj" style="color:var(--ink-2);font-weight:800">${esc(c.teacher)}</p><h2 style="font-size:22px;font-weight:900;margin:2px 0 12px">${esc(c.title)}</h2>
    <ol class="steps">${c.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>${c.note ? `<p style="color:var(--muted);margin-top:10px">${esc(c.note)}</p>` : ''}</div>`).join('')}</div></div>`;
}
