import { backend, getUser, seed, isAdmin } from '../backend.js';
import { esc, $, $$, formData, toast, statusTag, fmtDate, phoneOk, modal, confirmBox } from '../ui.js';
import { pageHead } from './common.js';
import { schoolFields, bindSchoolPickers } from '../school.js';

const G_ICON = `<svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.8 6C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 7l7.2 5.6c4.2-3.9 7.1-9.6 7.1-17.1z"/><path fill="#FBBC05" d="M10.5 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.8-6A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.7l7.9-6z"/><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.2-5.6c-2 1.4-4.7 2.3-8.7 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6C6.6 42.6 14.6 48 24 48z"/></svg>`;

function authPage(el, go, query, mode) {
  const local = backend.mode === 'local';
  const join = mode === 'join';
  el.innerHTML = `<div class="gate"><div class="gate-main"><div class="gate-card">
    <h1 class="gate-h">${join ? '회원가입' : '로그인'}</h1>
    <p class="gate-sub">${join ? '가입하면 수강 신청·설명회 예약·상담 답변을 한곳에서 볼 수 있어요.' : '태산학원은 Google 계정으로 로그인해요. 처음이면 로그인과 동시에 가입돼요.'}</p>
    ${join ? '<ol class="steps-mini"><li class="cur"><b>STEP 1</b>Google 로그인</li><li><b>STEP 2</b>내 정보 입력</li><li><b>STEP 3</b>가입 완료</li></ol>' : ''}
    <div class="panel">
      <img src="images/brand/logo-dark.png" alt="태산학원" class="gate-logo">
      ${local ? '<div class="callout" style="text-align:left">체험 모드입니다. 아래 이메일로 Google 로그인을 흉내 냅니다. <b>admin@</b>으로 시작하면 관리자 화면을 볼 수 있습니다.</div><label class="field" style="text-align:left"><span>체험용 이메일</span><input class="input" id="demo-email" type="email" placeholder="you@gmail.com"></label>' : ''}
      <label class="check gate-agree"><input type="checkbox" id="agree"> <span><a class="link" href="#/privacy">개인정보 수집·이용</a>에 동의합니다. (필수)</span></label>
      <button type="button" class="gbtn" data-google>${G_ICON} Google 계정으로 ${join ? '시작하기' : '로그인'}</button>
      <p class="form-error" aria-live="polite"></p>
    </div>
    <p class="gate-note">${join ? '이미 가입했나요? <a class="link" href="#/login">로그인</a>' : '처음이신가요? <a class="link" href="#/join">회원가입 안내</a>'} · 문의 042-321-5788</p>
  </div></div></div>`;
  const b = el.querySelector('[data-google]'), err = el.querySelector('.form-error');
  b.onclick = async () => {
    if (!el.querySelector('#agree').checked) { err.textContent = '개인정보 수집·이용에 동의해 주세요.'; return; }
    err.textContent = ''; b.disabled = true;
    try {
      const demo = el.querySelector('#demo-email');
      const { user, isNew } = await backend.auth.signInWithGoogle(demo ? demo.value.trim() : undefined);
      toast(`${user.name || user.email} 님, 환영합니다.`);
      go(isNew || !user.phone ? '#/mypage?setup=1' : nextOf(query));
    } catch (ex) { err.textContent = ex.message; b.disabled = false; }
  };
}

const nextOf = (query) => (query.next && query.next.startsWith('/') ? `#${query.next}` : '#/mypage');

export async function login({ el, query, go }) {
  if (getUser()) return go(nextOf(query));
  authPage(el, go, query, 'login');
}

export async function join({ el, query, go }) {
  if (getUser()) return go('#/mypage');
  authPage(el, go, query, 'join');
}

export async function mypage({ el, go, query = {} }) {
  const u = getUser();
  if (!u) return go('#/login?next=/mypage');
  const mine = (col) => backend.db.list(col, { where: [['uid', '==', u.uid]] }).catch(() => []);
  const [apps, rsv, cons, vis] = await Promise.all([mine('applications'), mine('reservations'), mine('consults'), mine('visits')]);
  const desc = (a, b) => (b.createdAt || '').localeCompare(a.createdAt || '');
  const tabs = [['apps', '수강 신청', apps.length], ['rsv', '설명회·진단고사', rsv.length], ['cons', '온라인 상담', cons.length], ['vis', '방문 상담', vis.length], ['me', '내 정보']];
  const initial = (u.name || u.email || '?').trim().slice(0, 1);
  el.innerHTML = `<div class="wrap page" style="padding-top:48px"><div class="me-wrap">
    <aside class="lnb me-lnb">
      <h2 class="lnb-t">마이페이지</h2>
      <div class="prof"><span class="avatar sm">${u.photo ? `<img src="${esc(u.photo)}" alt="">` : esc(initial)}</span>
        <div><b>${esc(u.name || '회원')}님</b><small>${esc(u.email || '')}</small>${u.school ? `<small>${esc(u.school)} ${esc(u.grade || '')}</small>` : ''}</div></div>
      <nav class="lnb-nav" role="tablist" aria-label="마이페이지 메뉴">
        ${tabs.map(([k, t, n]) => `<button class="lnb-i" role="tab" data-t="${k}">${t}${n !== undefined ? `<small class="num">${n}건</small>` : ''}</button>`).join('')}
        ${isAdmin() ? '<a class="lnb-i" href="#/admin">관리자 페이지<small>›</small></a>' : ''}
      </nav>
      <button class="lnb-out" type="button" data-out>로그아웃</button>
    </aside>
    <section class="me-main"><div id="pane"></div></section>
  </div></div>`;
  $('[data-out]', el).onclick = async () => { await backend.auth.signOut(); toast('로그아웃했습니다.'); go('#/'); };
  const empty = (msg, href, label) => `<div class="empty"><p>${msg}</p><p><a class="btn sm" href="${href}">${label}</a></p></div>`;
  const panes = {
    apps: () => (apps.length ? `<div class="status-list">${apps.sort(desc).map((a) => `<div class="item"><div><h4>${esc(a.classLabel)}</h4><p>${esc(a.teacherName)} 선생님 · ${a.kind === 'waitlist' ? '대기 신청' : '수강 신청'} · ${esc(fmtDate(a.createdAt))}</p>${a.adminNote ? `<div class="answer">${esc(a.adminNote)}</div>` : ''}</div><div>${statusTag(a.status)}</div></div>`).join('')}</div>` : empty('아직 수강 신청 내역이 없습니다.', '#/timetable', '시간표 보기')),
    rsv: () => (rsv.length ? `<div class="status-list">${rsv.sort(desc).map((r) => `<div class="item"><div><h4>${esc(r.eventTitle)}</h4><p>${r.eventDate ? esc(r.eventDate) + ' · ' : ''}${esc(r.name)}${r.subjects ? ` · ${esc(r.subjects)}` : ''}</p></div><div>${statusTag(r.status)} ${r.status === '접수' ? `<button class="link" data-cancel="${esc(r.id)}">취소</button>` : ''}</div></div>`).join('')}</div>` : empty('예약한 설명회가 없습니다.', '#/events', '설명회 보기')),
    cons: () => (cons.length ? `<div class="status-list">${cons.sort(desc).map((c) => `<div class="item"><div><h4>${esc(c.title)}</h4><p>${esc(c.topic)} · ${esc(fmtDate(c.createdAt))}</p><p style="white-space:pre-line;color:var(--text);margin-top:6px">${esc(c.body)}</p>${c.answer ? `<div class="answer"><b>학원 답변</b><br>${esc(c.answer)}</div>` : ''}</div><div>${statusTag(c.answer ? '답변완료' : c.status)}</div></div>`).join('')}</div>` : empty('남긴 상담이 없습니다.', '#/consult', '상담 남기기')),
    vis: () => (vis.length ? `<div class="status-list">${vis.sort(desc).map((v) => `<div class="item"><div><h4>${esc(fmtDate(v.date))} ${esc(v.time)} · ${esc(v.branch)}</h4><p>${esc(v.memo || '')}</p></div><div>${statusTag(v.status)}</div></div>`).join('')}</div>` : empty('예약한 방문 상담이 없습니다.', '#/visit', '방문 상담 예약')),
    me: () => `<form id="pf" class="card" novalidate>
      <div class="row2"><label class="field"><span>Google 계정</span><input class="input" value="${esc(u.email)}" disabled></label>
      <label class="field"><span>회원 구분</span><select class="select" name="type">${['학부모', '학생'].map((t) => `<option ${u.type === t ? 'selected' : ''}>${t}</option>`).join('')}</select></label></div>
      <div class="row2"><label class="field"><span>이름</span><input class="input" name="name" value="${esc(u.name || '')}"></label>
      <label class="field"><span>연락처</span><input class="input" name="phone" value="${esc(u.phone || '')}"></label></div>
      ${schoolFields({ school: u.school || '', grade: u.grade || '', label: '학생 학교' })}
      <label class="field"><span>학생 이름</span><input class="input" name="studentName" value="${esc(u.studentName || '')}"></label>
      <label class="check"><input type="checkbox" name="marketing" ${u.marketing ? 'checked' : ''}> 개강·설명회 소식 문자 받기</label>
      <p class="form-error"></p><button class="btn">정보 저장</button></form>`,
  };
  const show = (k) => {
    $$('[data-t]', el).forEach((b) => b.setAttribute('aria-selected', b.dataset.t === k));
    $('#pane', el).innerHTML = panes[k]();
    $$('[data-cancel]', el).forEach((b) => (b.onclick = async () => {
      if (!(await confirmBox('이 예약을 취소할까요?'))) return;
      await backend.db.update('reservations', b.dataset.cancel, { status: '취소' });
      rsv.find((r) => r.id === b.dataset.cancel).status = '취소'; show('rsv'); toast('예약을 취소했습니다.');
    }));
    const pf = $('#pf', el);
    if (pf) bindSchoolPickers(pf);
    if (pf) pf.onsubmit = async (e) => {
      e.preventDefault(); const d = formData(pf);
      if (!phoneOk(d.phone || '')) return (pf.querySelector('.form-error').textContent = '연락처 형식을 확인해 주세요.');
      await backend.auth.updateProfile({ type: d.type, name: d.name, phone: d.phone, school: d.school, schoolCode: d.schoolCode || (d.school === u.school ? u.schoolCode || '' : ''), schoolFull: d.schoolFull || (d.school === u.school ? u.schoolFull || '' : ''), grade: d.grade, studentName: d.studentName, marketing: !!pf.marketing.checked });
      toast('정보를 저장했습니다.'); if (query.setup) go('#/mypage');
    };
  };
  $$('[data-t]', el).forEach((b) => (b.onclick = () => show(b.dataset.t)));
  const rs = $('#resend', el); if (rs) rs.onclick = async () => { await backend.auth.resendVerification(); toast('인증 메일을 다시 보냈습니다.'); };
  if (query.setup || !u.phone) {
    show('me');
    $('#pane', el).insertAdjacentHTML('afterbegin', '<div class="callout">수강 신청·상담 연락을 받으려면 연락처와 학생 학교·학년을 입력해 주세요.</div>');
  } else show('apps');
}
