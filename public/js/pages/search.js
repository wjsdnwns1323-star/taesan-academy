import { esc, $ } from '../ui.js';
import { load, visible, pageHead, classLabel } from './common.js';

export async function render({ el, query }) {
  const [classes, teachers, notices, events] = await Promise.all([load('classes'), load('teachers'), load('notices'), load('events')]);
  el.innerHTML = `${pageHead('검색', '학교, 과목, 선생님 이름, 공지 제목으로 찾아보세요.', [['검색']])}
  <div class="wrap page"><div class="mid">
    <form id="sf" role="search" style="display:flex;gap:8px;margin-bottom:24px"><label class="sr" for="q">검색어</label>
      <input id="q" class="input" placeholder="예: 대신고 영어, 김민아, 설명회" value="${esc(query.q || '')}"><button class="btn">검색</button></form>
    <div id="out"></div>
  </div></div>`;
  const draw = (q) => {
    const terms = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) { $('#out', el).innerHTML = '<p class="empty">검색어를 입력해 주세요.</p>'; return; }
    const hit = (s) => terms.every((t) => s.toLowerCase().includes(t));
    const c = visible(classes).filter((x) => x.term !== 'mid' && hit(`${classLabel(x)} ${x.teacherName} ${x.time}`));
    const t = visible(teachers).filter((x) => hit(`${x.name} ${x.subject} ${(x.schools || []).join(' ')}`));
    const n = visible(notices).filter((x) => hit(`${x.title} ${x.body}`));
    const e = visible(events).filter((x) => hit(`${x.title} ${x.target} ${x.speakers}`));
    const sec = (title, items) => (items.length ? `<div class="block"><h3>${title} <small class="num">${items.length}</small></h3><div class="board" style="border-top:0"><ul>${items.join('')}</ul></div></div>` : '');
    const html = sec('강좌', c.map((x) => `<li><a href="#/timetable?term=${x.term}${x.school ? `&school=${encodeURIComponent(x.school)}` : ''}"><span class="title">${esc(classLabel(x))} · ${esc(x.teacherName)}</span><span class="date num">${esc(x.start)}</span></a></li>`))
      + sec('선생님', t.map((x) => `<li><a href="#/teachers/${esc(x.id)}"><span class="title">${esc(x.name)} · ${esc(x.subject)}</span></a></li>`))
      + sec('설명회', e.map((x) => `<li><a href="#/events/${esc(x.id)}"><span class="title">${esc(x.title)}</span><span class="date num">${esc(x.date)}</span></a></li>`))
      + sec('공지사항', n.map((x) => `<li><a href="#/notice/${esc(x.id)}"><span class="title">${esc(x.title)}</span><span class="date num">${esc(x.date)}</span></a></li>`));
    $('#out', el).innerHTML = html || `<p class="empty">"${esc(q)}"에 맞는 결과가 없습니다. 학교 이름이나 과목으로 다시 찾아보세요.</p>`;
  };
  $('#sf', el).onsubmit = (ev) => { ev.preventDefault(); const q = $('#q', el).value; history.replaceState(null, '', `#/search?q=${encodeURIComponent(q)}`); draw(q); };
  draw(query.q || '');
  $('#q', el).focus();
}
