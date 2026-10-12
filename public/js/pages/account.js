import { backend, getUser, seed } from '../backend.js';
import { esc, $, $$, formData, toast, statusTag, fmtDate, phoneOk, modal, confirmBox } from '../ui.js';
import { pageHead } from './common.js';

const nextOf = (query) => (query.next && query.next.startsWith('/') ? `#${query.next}` : '#/mypage');

export async function login({ el, query, go }) {
  if (getUser()) return go(nextOf(query));
  el.innerHTML = `${pageHead('로그인', '', [['로그인']])}
  <div class="wrap page"><div class="narrow card">
    ${backend.mode === 'local' ? '<div class="callout">체험 모드입니다. 가입 정보는 이 브라우저에만 저장됩니다. <b>admin@</b>으로 시작하는 이메일로 가입하면 관리자 화면을 써 볼 수 있습니다.</div>' : ''}
    <form id="lf" novalidate>
      <label class="field"><span>이메일</span><input class="input" type="email" name="email" autocomplete="email" required></label>
      <label class="field"><span>비밀번호</span><input class="input" type="password" name="password" autocomplete="current-password" required></label>
      <p class="form-error" aria-live="polite"></p>
      <button class="btn block">로그인</button>
    </form>
    <p style="margin-top:16px;display:flex;justify-content:space-between;font-size:14px"><button class="link" id="reset">비밀번호 찾기</button><a class="link" href="#/join">회원가입</a></p>
  </div></div>`;
  const f = $('#lf', el);
  f.onsubmit = async (e) => {
    e.preventDefault(); const d = formData(f); const err = f.querySelector('.form-error');
    if (!d.email || !d.password) return (err.textContent = '이메일과 비밀번호를 입력해 주세요.');
    const b = f.querySelector('button'); b.disabled = true;
    try { await backend.auth.signIn(d.email.trim(), d.password); toast('로그인했습니다.'); go(nextOf(query)); }
    catch (ex) { err.textContent = ex.message; b.disabled = false; }
  };
  $('#reset', el).onclick = () => modal({
    title: '비밀번호 찾기', sub: '가입한 이메일로 재설정 링크를 보내드립니다.',
    content: `<form novalidate><label class="field"><span>이메일</span><input class="input" type="email" name="email" required value="${esc(f.email.value)}"></label><p class="form-error"></p><button class="btn block">재설정 메일 보내기</button></form>`,
    onMount(box, close) {
      const rf = box.querySelector('form');
      rf.onsubmit = async (e) => {
        e.preventDefault();
        try { await backend.auth.resetPassword(rf.email.value.trim()); close(); toast('재설정 메일을 보냈습니다.'); }
        catch (ex) { rf.querySelector('.form-error').textContent = ex.message; }
      };
    },
  });
}

export async function join({ el, go }) {
  if (getUser()) return go('#/mypage');
  el.innerHTML = `${pageHead('회원가입', '가입하면 수강 신청·설명회 예약·상담 답변을 한곳에서 볼 수 있습니다.', [['회원가입']])}
  <div class="wrap page"><div class="narrow card">
    <form id="jf" novalidate>
      <label class="field"><span>이메일</span><input class="input" type="email" name="email" autocomplete="email" required></label>
      <div class="row2">
        <label class="field"><span>비밀번호</span><input class="input" type="password" name="password" autocomplete="new-password" minlength="6" required><small>6자 이상</small></label>
        <label class="field"><span>비밀번호 확인</span><input class="input" type="password" name="password2" autocomplete="new-password" required></label>
      </div>
      <div class="row2">
        <label class="field"><span>이름</span><input class="input" name="name" required></label>
        <label class="field"><span>회원 구분</span><select class="select" name="type"><option>학부모</option><option>학생</option></select></label>
      </div>
      <label class="field"><span>연락처</span><input class="input" name="phone" inputmode="tel" placeholder="010-0000-0000" required></label>
      <div class="row2">
        <label class="field"><span>학생 학교</span><select class="select" name="school"><option value="">선택</option>${seed.schools.filter((s) => s.id !== '연합반').map((s) => `<option>${s.id}</option>`).join('')}<option>중학교</option><option>기타</option></select></label>
        <label class="field"><span>학년</span><select class="select" name="grade"><option value="">선택</option><option>중3</option><option>고1</option><option>고2</option><option>고3</option></select></label>
      </div>
      <label class="field"><span>학생 이름 <small>(학부모 가입 시)</small></span><input class="input" name="studentName"></label>
      <div class="consent">수집 항목: 이메일, 이름, 연락처, 학생 학교·학년·이름<br>이용 목적: 회원 관리, 수강·상담 안내<br>보관 기간: 회원 탈퇴 시까지</div>
      <label class="check"><input type="checkbox" name="agree"> 개인정보 수집·이용에 동의합니다. (필수)</label>
      <label class="check" style="margin-top:6px"><input type="checkbox" name="marketing"> 개강·설명회 소식을 문자로 받겠습니다. (선택)</label>
      <p class="form-error" aria-live="polite"></p>
      <button class="btn block">가입하기</button>
    </form>
  </div></div>`;
  const f = $('#jf', el);
  f.onsubmit = async (e) => {
    e.preventDefault(); const d = formData(f); const err = f.querySelector('.form-error');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email)) return (err.textContent = '이메일 형식을 확인해 주세요.');
    if ((d.password || '').length < 6) return (err.textContent = '비밀번호는 6자 이상으로 입력해 주세요.');
    if (d.password !== d.password2) return (err.textContent = '비밀번호 확인이 일치하지 않습니다.');
    if (!d.name.trim()) return (err.textContent = '이름을 입력해 주세요.');
    if (!phoneOk(d.phone)) return (err.textContent = '연락처를 010-0000-0000 형식으로 입력해 주세요.');
    if (!f.agree.checked) return (err.textContent = '개인정보 수집·이용에 동의해 주세요.');
    const b = f.querySelector('button'); b.disabled = true;
    try {
      await backend.auth.signUp({ email: d.email.trim(), password: d.password, name: d.name.trim(), type: d.type, phone: d.phone.trim(), school: d.school, grade: d.grade, studentName: d.studentName || '', marketing: !!f.marketing.checked });
      toast(backend.mode === 'firebase' ? '가입했습니다. 이메일 인증 메일을 확인해 주세요.' : '가입했습니다.');
      go('#/mypage');
    } catch (ex) { err.textContent = ex.message; b.disabled = false; }
  };
}

export async function mypage({ el, go }) {
  const u = getUser();
  if (!u) return go('#/login?next=/mypage');
  const mine = (col) => backend.db.list(col, { where: [['uid', '==', u.uid]] }).catch(() => []);
  const [apps, rsv, cons, vis] = await Promise.all([mine('applications'), mine('reservations'), mine('consults'), mine('visits')]);
  const desc = (a, b) => (b.createdAt || '').localeCompare(a.createdAt || '');
  el.innerHTML = `${pageHead('내 신청 내역', `${esc(u.name || u.email)}님${u.school ? ` · ${esc(u.school)} ${esc(u.grade || '')}` : ''}`, [['내 신청 내역']])}
  <div class="wrap page"><div class="mid">
    ${backend.mode === 'firebase' && !u.verified ? '<div class="callout">이메일 인증이 아직 안 됐습니다. 받은편지함의 인증 메일을 확인해 주세요. <button class="link" id="resend">인증 메일 다시 받기</button></div>' : ''}
    <div class="tabs" role="tablist">
      ${[['apps', `수강 신청 ${apps.length}`], ['rsv', `설명회·진단고사 ${rsv.length}`], ['cons', `온라인 상담 ${cons.length}`], ['vis', `방문 상담 ${vis.length}`], ['me', '내 정보']].map(([k, t], i) => `<button role="tab" data-t="${k}" aria-selected="${i === 0}">${t}</button>`).join('')}
    </div>
    <div id="pane"></div>
  </div></div>`;
  const empty = (msg, href, label) => `<div class="empty"><p>${msg}</p><p><a class="btn sm" href="${href}">${label}</a></p></div>`;
  const panes = {
    apps: () => (apps.length ? `<div class="status-list">${apps.sort(desc).map((a) => `<div class="item"><div><h4>${esc(a.classLabel)}</h4><p>${esc(a.teacherName)} 선생님 · ${a.kind === 'waitlist' ? '대기 신청' : '수강 신청'} · ${esc(fmtDate(a.createdAt))}</p>${a.adminNote ? `<div class="answer">${esc(a.adminNote)}</div>` : ''}</div><div>${statusTag(a.status)}</div></div>`).join('')}</div>` : empty('아직 수강 신청 내역이 없습니다.', '#/timetable', '시간표 보기')),
    rsv: () => (rsv.length ? `<div class="status-list">${rsv.sort(desc).map((r) => `<div class="item"><div><h4>${esc(r.eventTitle)}</h4><p>${r.eventDate ? esc(r.eventDate) + ' · ' : ''}${esc(r.name)}${r.subjects ? ` · ${esc(r.subjects)}` : ''}</p></div><div>${statusTag(r.status)} ${r.status === '접수' ? `<button class="link" data-cancel="${esc(r.id)}">취소</button>` : ''}</div></div>`).join('')}</div>` : empty('예약한 설명회가 없습니다.', '#/events', '설명회 보기')),
    cons: () => (cons.length ? `<div class="status-list">${cons.sort(desc).map((c) => `<div class="item"><div><h4>${esc(c.title)}</h4><p>${esc(c.topic)} · ${esc(fmtDate(c.createdAt))}</p><p style="white-space:pre-line;color:var(--text);margin-top:6px">${esc(c.body)}</p>${c.answer ? `<div class="answer"><b>학원 답변</b><br>${esc(c.answer)}</div>` : ''}</div><div>${statusTag(c.answer ? '답변완료' : c.status)}</div></div>`).join('')}</div>` : empty('남긴 상담이 없습니다.', '#/consult', '상담 남기기')),
    vis: () => (vis.length ? `<div class="status-list">${vis.sort(desc).map((v) => `<div class="item"><div><h4>${esc(fmtDate(v.date))} ${esc(v.time)} · ${esc(v.branch)}</h4><p>${esc(v.memo || '')}</p></div><div>${statusTag(v.status)}</div></div>`).join('')}</div>` : empty('예약한 방문 상담이 없습니다.', '#/visit', '방문 상담 예약')),
    me: () => `<form id="pf" class="card" novalidate>
      <label class="field"><span>이메일</span><input class="input" value="${esc(u.email)}" disabled></label>
      <div class="row2"><label class="field"><span>이름</span><input class="input" name="name" value="${esc(u.name || '')}"></label>
      <label class="field"><span>연락처</span><input class="input" name="phone" value="${esc(u.phone || '')}"></label></div>
      <div class="row2"><label class="field"><span>학생 학교</span><input class="input" name="school" value="${esc(u.school || '')}"></label>
      <label class="field"><span>학년</span><input class="input" name="grade" value="${esc(u.grade || '')}"></label></div>
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
    if (pf) pf.onsubmit = async (e) => {
      e.preventDefault(); const d = formData(pf);
      if (d.phone && !phoneOk(d.phone)) return (pf.querySelector('.form-error').textContent = '연락처 형식을 확인해 주세요.');
      await backend.auth.updateProfile({ name: d.name, phone: d.phone, school: d.school, grade: d.grade, studentName: d.studentName, marketing: !!pf.marketing.checked });
      toast('정보를 저장했습니다.');
    };
  };
  $$('[data-t]', el).forEach((b) => (b.onclick = () => show(b.dataset.t)));
  const rs = $('#resend', el); if (rs) rs.onclick = async () => { await backend.auth.resendVerification(); toast('인증 메일을 다시 보냈습니다.'); };
  show('apps');
}
