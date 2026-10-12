import { backend, getUser } from '../backend.js';
import { esc, $, statusTag, dayParts, isPast, formData, toast, CONSENT, phoneOk } from '../ui.js';
import { load, visible, pageHead, clearCache } from './common.js';

const isOpen = (e) => e.status !== '종료' && e.status !== '마감' && !isPast(e.date);

export async function list({ el }) {
  const events = visible(await load('events'));
  const open = events.filter(isOpen).sort((a, b) => (a.date || '9').localeCompare(b.date || '9'));
  const past = events.filter((e) => !isOpen(e)).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const card = (e) => { const d = dayParts(e.date); return `<a class="ev-card" href="#/events/${esc(e.id)}">
    <div class="ev-date">${d ? `<b class="num">${d.d}</b><span>${d.m}월 ${d.w}</span>` : '<b>상시</b><span>신청</span>'}</div>
    <div><p><span class="tag">${esc(e.type)}</span> ${statusTag(isOpen(e) ? e.status : '종료')}</p><h4 style="margin-top:6px">${esc(e.title)}</h4>
    <p>${esc(e.time)} · ${esc(e.place)} · 대상 ${esc(e.target)}</p>${e.benefit ? `<p>참석 혜택: ${esc(e.benefit)}</p>` : ''}</div></a>`; };
  el.innerHTML = `${pageHead('설명회·특강', '고교 선택, 학교별 입시 전략, 진단고사 일정을 안내합니다.', [['학원안내', '#/about'], ['설명회·특강']])}
  <div class="wrap page"><div class="mid">
    <h2 style="font-size:20px;font-weight:900;color:var(--ink);margin-bottom:6px">예약 받는 중</h2>
    ${open.map(card).join('') || '<p class="empty">지금 예약 받는 설명회가 없습니다.</p>'}
    <h2 style="font-size:20px;font-weight:900;color:var(--ink);margin:40px 0 6px">지난 설명회·특강</h2>
    ${past.map(card).join('')}
  </div></div>`;
}

export async function detail({ el, params }) {
  const e = await backend.db.get('events', params.id);
  if (!e) { el.innerHTML = `<div class="wrap page"><div class="empty"><p>설명회를 찾을 수 없습니다.</p><p><a class="btn" href="#/events">목록으로</a></p></div></div>`; return; }
  const u = getUser();
  const open = isOpen(e);
  const diag = e.type === '진단고사';
  el.innerHTML = `${pageHead(e.title, '', [['설명회·특강', '#/events'], [e.type]])}
  <div class="wrap page"><div class="profile ev">
    <div>
      <dl class="kv">
        <dt>일시</dt><dd>${e.date ? esc(e.date.replace(/-/g, '.')) + ' ' : ''}${esc(e.time)}${e.dateNote ? ` <small style="color:var(--muted)">(${esc(e.dateNote)})</small>` : ''}</dd>
        <dt>장소</dt><dd>${esc(e.place)}</dd>
        <dt>대상</dt><dd>${esc(e.target)}</dd>
        ${e.speakers ? `<dt>연사</dt><dd>${esc(e.speakers)}</dd>` : ''}
        ${e.benefit ? `<dt>참석 혜택</dt><dd>${esc(e.benefit)}</dd>` : ''}
        <dt>상태</dt><dd>${statusTag(open ? e.status : '종료')}</dd>
      </dl>
      ${(e.program || []).length ? `<div class="block"><h3>${diag ? '진행 순서' : '프로그램'}</h3><ol class="steps">${e.program.map((p) => `<li>${esc(p)}</li>`).join('')}</ol></div>` : ''}
      ${e.body ? `<div class="block"><h3>안내</h3><p style="white-space:pre-line">${esc(e.body)}</p></div>` : ''}
    </div>
    <div class="card ev-form">
      ${open ? `<h2 style="font-size:20px;font-weight:900;color:var(--ink);margin-bottom:14px">${diag ? '진단고사 신청' : '예약하기'}</h2>
      <form id="rsv" novalidate>
        <label class="field"><span>${diag ? '학생 이름' : '신청자 이름'}</span><input class="input" name="name" required value="${esc(u?.name || '')}"></label>
        <label class="field"><span>연락처</span><input class="input" name="phone" inputmode="tel" required placeholder="010-0000-0000" value="${esc(u?.phone || '')}"></label>
        <div class="row2">
          <label class="field"><span>${diag ? '응시 학교' : '학생 학교'}</span>${diag ? '<select class="select" name="school"><option>대성고</option><option>대신고</option></select>' : `<input class="input" name="school" value="${esc(u?.school || '')}">`}</label>
          <label class="field"><span>${diag ? '과목' : '인원'}</span>${diag ? '<select class="select" name="subjects"><option>국어</option><option>수학</option><option>영어</option><option>국어·수학·영어</option></select>' : '<select class="select" name="people"><option>1</option><option>2</option><option>3</option></select>'}</label>
        </div>
        ${diag ? '<label class="field"><span>희망 날짜·시간</span><input class="input" name="wish" placeholder="예: 10/18(토) 오후"></label>' : ''}
        ${CONSENT}
        <p class="form-error" aria-live="polite"></p>
        <button class="btn block">${diag ? '신청하기' : '예약하기'}</button>
      </form>` : `<p>${e.status === '마감' ? '예약이 마감되었습니다.' : '종료된 설명회입니다.'}</p><p style="margin-top:12px"><a class="btn ghost block" href="#/events">다른 설명회 보기</a></p>`}
    </div>
  </div></div>`;
  const f = $('#rsv', el);
  if (!f) return;
  f.onsubmit = async (ev) => {
    ev.preventDefault();
    const d = formData(f); const err = f.querySelector('.form-error');
    if (!d.name.trim()) return (err.textContent = '이름을 입력해 주세요.');
    if (!phoneOk(d.phone)) return (err.textContent = '연락처를 010-0000-0000 형식으로 입력해 주세요.');
    if (!f.agree.checked) return (err.textContent = '개인정보 수집·이용에 동의해 주세요.');
    const btn = f.querySelector('button'); btn.disabled = true;
    try {
      await backend.db.add('reservations', {
        eventId: e.id, eventTitle: e.title, eventDate: e.date || '', name: d.name.trim(), phone: d.phone.trim(),
        school: d.school || '', people: Number(d.people || 1), subjects: d.subjects || '', wish: d.wish || '',
        uid: getUser()?.uid || '', status: '접수',
      });
      clearCache();
      f.outerHTML = `<div class="callout" role="status"><b>${diag ? '신청' : '예약'}을 접수했습니다.</b><br>${diag ? '응시 일정은 개별 연락드립니다.' : '학원에서 확인 후 연락드립니다.'}${getUser() ? '<br><a class="link" href="#/mypage">내 신청 내역 보기</a>' : ''}</div>`;
      toast(diag ? '진단고사 신청 완료' : '설명회 예약 완료');
    } catch (ex) { err.textContent = `접수하지 못했습니다. ${ex.message}`; btn.disabled = false; }
  };
}
