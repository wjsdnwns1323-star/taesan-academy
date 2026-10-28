// 로그인·회원가입·아이디 찾기·비밀번호 찾기·내 정보
import * as be from './backend.js';
import { STUDENT_GRADES } from './boards.js';
import { esc, $, $$, toast, icon, empty, pageHead, listItemHtml, fullDate, shortDate, modal, confirmBox } from './ui.js';

const nextOf = (q) => {
  const n = q.get('next') || '#/';
  return n.startsWith('#/') && !/^#\/(login|join|find-id|reset-password)/.test(n) ? n : '#/';
};
const PHONE_RE = /^01[0-9]-?[0-9]{3,4}-?[0-9]{4}$/;
const cleanPhone = (v) => v.replace(/[^0-9-]/g, '');

// 비밀번호 칸: 보기 버튼, Caps Lock 안내
const pwField = (id, name, label, auto, ph = '') => `<div class="field"><label class="lbl" for="${id}">${label}</label>
  <div class="pw"><input id="${id}" type="password" name="${name}" autocomplete="${auto}" ${ph ? `placeholder="${ph}"` : ''}><button type="button" data-pw="${id}" aria-label="비밀번호 보기" aria-pressed="false">${icon('eye', 'sm')}</button></div>
  <small class="caps hidden" data-caps="${id}">Caps Lock이 켜져 있어요</small></div>`;
function wirePw(root) {
  $$('[data-pw]', root).forEach((b) => b.addEventListener('click', () => {
    const i = $(`#${b.dataset.pw}`);
    const show = i.type === 'password';
    i.type = show ? 'text' : 'password';
    b.setAttribute('aria-pressed', show);
    b.setAttribute('aria-label', show ? '비밀번호 숨기기' : '비밀번호 보기');
    b.innerHTML = icon(show ? 'eyeoff' : 'eye', 'sm');
  }));
  $$('.pw input', root).forEach((i) => ['keydown', 'keyup'].forEach((t) => i.addEventListener(t, (e) => {
    const c = $(`[data-caps="${i.id}"]`);
    if (c && e.getModifierState) c.classList.toggle('hidden', !e.getModifierState('CapsLock'));
  })));
}
// 인증번호 다시 받기까지 남은 초
function cooldown(btn, sec, label = '다시 받기') {
  let n = sec;
  btn.disabled = true;
  const tick = () => { btn.textContent = `${label} (${n})`; if (n-- <= 0) { clearInterval(t); btn.disabled = false; btn.textContent = label; } };
  const t = setInterval(tick, 1000);
  tick();
  return t;
}

/* ---------------- 로그인 ---------------- */
export function renderLogin(ctx) {
  const { view, q } = ctx;
  if (be.currentUser()) { location.replace(nextOf(q)); return; }
  const canFind = be.has('findIdStart');
  view.innerHTML = `<div class="auth">
    <div class="auth-head"><h1>로그인</h1><p>태산입시 회원 아이디로 로그인하세요.</p></div>
    <form id="lf" novalidate>
      <div class="field"><label class="lbl" for="l-id">아이디</label><input id="l-id" name="username" autocomplete="username" autocapitalize="off" spellcheck="false" value="${esc(q.get('id') || '')}"></div>
      ${pwField('l-pw', 'password', '비밀번호', 'current-password')}
      <div class="auth-row"><label class="check"><input type="checkbox" name="keep" id="l-keep" checked>로그인 상태 유지</label></div>
      <p class="err" id="err" role="alert"></p>
      <button class="btn lg block" id="l-btn">로그인</button>
    </form>
    ${canFind ? '<nav class="auth-links"><a href="#/find-id">아이디 찾기</a><a href="#/reset-password">비밀번호 찾기</a></nav>' : '<p class="hint" style="text-align:center;margin-top:16px">아이디나 비밀번호를 잊으셨다면 학원으로 문의해 주세요.</p>'}
    <p class="auth-foot">아직 회원이 아니신가요?<a href="#/join">회원가입</a></p>
    <p class="hint" style="margin-top:12px;text-align:center">공용 컴퓨터에서는 '로그인 상태 유지'를 꺼 주세요.</p>
  </div>`;
  wirePw(view);
  $(q.get('id') ? '#l-pw' : '#l-id').focus();
  $('#lf').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target, btn = $('#l-btn');
    if (!f.username.value.trim() || !f.password.value) { $('#err').textContent = '아이디와 비밀번호를 입력해 주세요.'; return; }
    btn.disabled = true; btn.textContent = '로그인하는 중';
    try { await be.signIn(f.username.value, f.password.value, f.keep.checked); } catch (err) {
      $('#err').textContent = be.errorText(err); btn.disabled = false; btn.textContent = '로그인'; f.password.select();
    }
  });
}

/* ---------------- 회원가입 ---------------- */
export function renderJoin(ctx) {
  const { view } = ctx;
  if (be.currentUser()) { location.replace('#/'); return; }
  const guardianSms = be.has('guardianStart');
  view.innerHTML = `<div class="auth wide">
    <div class="auth-head"><h1>회원가입</h1><p>이름·휴대폰·성별·나이는 관리자만 볼 수 있고, 다른 회원에게는 아이디와 학년만 보입니다.</p></div>
    <form id="jf" novalidate>
      <div class="form-section">
        <h2>계정</h2>
        <div class="field"><label class="lbl" for="j-id">아이디<span class="req">*</span></label><input id="j-id" name="username" autocomplete="username" autocapitalize="off" spellcheck="false" placeholder="영문 소문자·숫자·밑줄(_) 4~20자" aria-describedby="j-id-h"><small id="j-id-h">아이디는 닉네임으로도 보이고, 가입한 뒤에는 바꿀 수 없습니다.</small></div>
        <div class="grid-2">
          ${pwField('j-pw', 'password', '비밀번호<span class="req">*</span>', 'new-password', '8자 이상')}
          ${pwField('j-pw2', 'password2', '비밀번호 확인<span class="req">*</span>', 'new-password')}
        </div>
      </div>
      <div class="form-section">
        <h2>본인 확인</h2>
        <div class="field"><label class="lbl" for="j-phone">휴대폰 번호<span class="req">*</span></label>
          <div class="inline"><input id="j-phone" name="phone" inputmode="tel" autocomplete="tel" placeholder="010-0000-0000"><button type="button" class="btn line" id="send-code">인증번호 받기</button></div>
          <small>한 번호로 한 계정만 만들 수 있습니다.</small></div>
        <div class="field hidden" id="code-box"><label class="lbl" for="j-code">인증번호<span class="req">*</span></label><input id="j-code" name="code" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="6자리 숫자"><small id="code-msg"></small>
          <button type="button" class="text-btn" id="unlock" style="align-self:flex-start;margin-left:-10px">아이디·비밀번호·번호 다시 입력</button></div>
        <div id="recaptcha-box"></div>
      </div>
      <div class="form-section">
        <h2>회원 정보</h2>
        <div class="grid-2">
          <div class="field"><label class="lbl" for="j-name">이름<span class="req">*</span></label><input id="j-name" name="realName" maxlength="20" autocomplete="name"></div>
          <div class="field"><label class="lbl" for="j-age">나이<span class="req">*</span></label><input id="j-age" name="age" type="number" inputmode="numeric" min="8" max="99" placeholder="만 나이"></div>
        </div>
        <div class="field"><span>성별<span class="req">*</span></span><div class="segmented" data-seg="gender" role="radiogroup" aria-label="성별"><button type="button" role="radio" aria-checked="false" data-v="남">남</button><button type="button" role="radio" aria-checked="false" data-v="여">여</button></div></div>
        <div class="field"><span>구분<span class="req">*</span></span><div class="segmented" data-seg="memberType" role="radiogroup" aria-label="구분"><button type="button" role="radio" aria-checked="false" data-v="학생">학생</button><button type="button" role="radio" aria-checked="false" data-v="학부모">학부모</button></div></div>
        <div class="field"><label class="lbl" for="j-grade" id="grade-label">학년<span class="req">*</span></label><select id="j-grade" name="grade"><option value="">선택</option>${STUDENT_GRADES.map((g) => `<option>${g}</option>`).join('')}</select></div>
      </div>
      <div class="form-section hidden" id="guardian-box">
        <h2>보호자 동의 <small style="font-weight:400;color:var(--muted);font-size:14px">만 14세 미만</small></h2>
        ${guardianSms ? `<p class="hint">만 14세 미만은 보호자(법정대리인)가 동의해야 가입할 수 있습니다. 보호자 휴대폰으로 인증번호를 보내 드리니, 보호자께 받아서 입력해 주세요.</p>
        <div class="grid-2">
          <div class="field"><label class="lbl" for="g-name">보호자 이름<span class="req">*</span></label><input id="g-name" name="guardianName" maxlength="20"></div>
          <div class="field"><label class="lbl" for="g-phone">보호자 휴대폰<span class="req">*</span></label><div class="inline"><input id="g-phone" name="guardianPhone" inputmode="tel" placeholder="010-0000-0000"><button type="button" class="btn line" id="g-send">인증번호</button></div></div>
        </div>
        <div class="field hidden" id="g-code-box"><label class="lbl" for="g-code">보호자 인증번호<span class="req">*</span></label><input id="g-code" name="guardianCode" inputmode="numeric" maxlength="6" placeholder="6자리 숫자"><small id="g-msg"></small></div>`
    : '<label class="check"><input type="checkbox" name="guardianConsent"><span>[필수] 만 14세 미만으로, 보호자(법정대리인)의 동의를 받았습니다.</span></label>'}
      </div>
      <div class="agree">
        <label class="check all"><input type="checkbox" id="agree-all"><span><b>전체 동의</b></span></label>
        <label class="check"><input type="checkbox" name="agreeRules"><span>[필수] <a href="#/rules" target="_blank">커뮤니티 이용규칙</a>에 동의합니다</span></label>
        <label class="check"><input type="checkbox" name="agreePrivacy"><span>[필수] <a href="#/privacy" target="_blank">개인정보 수집·이용</a>에 동의합니다 (이름·휴대폰·성별·나이·구분·학년, 회원 관리 목적, 탈퇴할 때까지 보관)</span></label>
      </div>
      <p class="err" id="err" role="alert"></p>
      <button class="btn lg block" id="join-btn">가입하기</button>
    </form>
    <p class="auth-foot">이미 회원이신가요?<a href="#/login">로그인</a></p>
  </div>`;
  wirePw(view);
  const f = $('#jf');
  const seg = { gender: '', memberType: '' };
  f.addEventListener('click', (e) => {
    const b = e.target.closest('[data-seg] button');
    if (!b) return;
    const box = b.parentElement;
    seg[box.dataset.seg] = b.dataset.v;
    [...box.children].forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-checked', x === b); });
    if (box.dataset.seg === 'memberType') $('#grade-label').innerHTML = `${b.dataset.v === '학부모' ? '자녀 학년' : '학년'}<span class="req">*</span>`;
  });
  const agrees = ['agreeRules', 'agreePrivacy'];
  $('#agree-all').addEventListener('change', (e) => agrees.forEach((n) => { f[n].checked = e.target.checked; }));
  f.addEventListener('change', (e) => { if (agrees.includes(e.target.name)) $('#agree-all').checked = agrees.every((n) => f[n].checked); });
  f.phone.addEventListener('input', () => { f.phone.value = cleanPhone(f.phone.value); });
  $('#send-code').addEventListener('click', async (e) => {
    const phone = f.phone.value.replace(/\s/g, '');
    const username = f.username.value.trim().toLowerCase();
    const [problem, el] = !be.USERNAME_RE.test(username) ? ['아이디는 영문 소문자·숫자·밑줄(_) 4~20자로 정해 주세요.', f.username]
      : f.password.value.length < 8 ? ['비밀번호는 8자 이상이어야 합니다.', f.password]
      : f.password.value !== f.password2.value ? ['비밀번호 확인이 일치하지 않습니다.', f.password2]
      : !PHONE_RE.test(phone) ? ['휴대폰 번호를 확인해 주세요. 예) 010-1234-5678', f.phone]
      : ['', null];
    if (problem) { $('#err').textContent = problem; el.focus(); return; }
    const b = e.currentTarget; b.disabled = true; b.textContent = '보내는 중';
    try {
      await be.sendPhoneCode({ phone, username, password: f.password.value, boxId: 'recaptcha-box' });
      $('#code-box').classList.remove('hidden');
      $('#code-msg').textContent = be.DEMO ? '체험 모드 인증번호: 123456' : '문자로 받은 6자리 숫자를 입력해 주세요. 3분 안에 오지 않으면 다시 받아 주세요.';
      $('#err').textContent = '';
      ['phone', 'username', 'password', 'password2'].forEach((n) => { f[n].readOnly = true; });
      f.code.focus();
      clearInterval(b._t); b._t = cooldown(b, 30);
    } catch (err) { $('#err').textContent = be.errorText(err); b.disabled = false; b.textContent = '인증번호 받기'; }
  });
  $('#g-send')?.addEventListener('click', async (e) => {
    const gp = f.guardianPhone.value.replace(/\s/g, '');
    if (!f.realName.value.trim()) { $('#err').textContent = '학생 이름을 먼저 입력해 주세요.'; f.realName.focus(); return; }
    if (!f.guardianName.value.trim()) { $('#err').textContent = '보호자 이름을 입력해 주세요.'; f.guardianName.focus(); return; }
    if (!PHONE_RE.test(gp)) { $('#err').textContent = '보호자 휴대폰 번호를 확인해 주세요.'; f.guardianPhone.focus(); return; }
    const b = e.currentTarget; b.disabled = true;
    try {
      await be.guardianStart(gp, f.realName.value.trim());
      $('#g-code-box').classList.remove('hidden');
      $('#g-msg').textContent = be.DEMO ? '체험 모드 인증번호: 123456' : '보호자 휴대폰으로 보낸 6자리 숫자를 입력해 주세요.';
      $('#err').textContent = ''; f.guardianPhone.readOnly = true; f.guardianCode.focus();
      cooldown(b, 30, '다시');
    } catch (err) { $('#err').textContent = be.errorText(err); b.disabled = false; }
  });
  $('#unlock').addEventListener('click', () => {
    ['phone', 'username', 'password', 'password2'].forEach((n) => { f[n].readOnly = false; });
    f.code.value = ''; $('#code-box').classList.add('hidden');
    const b = $('#send-code'); clearInterval(b._t); b.disabled = false; b.textContent = '인증번호 받기';
    f.username.focus();
  });
  f.age.addEventListener('input', () => $('#guardian-box').classList.toggle('hidden', !(+f.age.value > 0 && +f.age.value < 14)));
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('#err');
    const minor = parseInt(f.age.value, 10) < 14;
    const v = {
      username: f.username.value.trim().toLowerCase(), password: f.password.value,
      realName: f.realName.value.trim(), gender: seg.gender, memberType: seg.memberType,
      grade: seg.memberType === '학부모' ? '학부모' : f.grade.value, childGrade: seg.memberType === '학부모' ? f.grade.value : '',
      phone: f.phone.value.replace(/\s/g, ''), age: parseInt(f.age.value, 10), code: f.code.value.trim(),
      guardianConsent: guardianSms ? minor : !!f.guardianConsent?.checked,
      guardianName: f.guardianName?.value.trim() || '', guardianPhone: f.guardianPhone?.value.trim() || '', guardianCode: f.guardianCode?.value.trim() || '',
    };
    const [problem, el] = !be.USERNAME_RE.test(v.username) ? ['아이디는 영문 소문자·숫자·밑줄(_) 4~20자로 정해 주세요.', f.username]
      : v.password.length < 8 ? ['비밀번호는 8자 이상이어야 합니다.', f.password]
      : v.password !== f.password2.value ? ['비밀번호 확인이 일치하지 않습니다.', f.password2]
      : !PHONE_RE.test(v.phone) ? ['휴대폰 번호를 확인해 주세요.', f.phone]
      : $('#code-box').classList.contains('hidden') ? ['휴대폰 인증번호를 먼저 받아 주세요.', $('#send-code')]
      : !/^[0-9]{6}$/.test(v.code) ? ['휴대폰 인증번호 6자리를 입력해 주세요.', f.code]
      : !v.realName ? ['이름을 입력해 주세요.', f.realName]
      : !(v.age >= 8 && v.age <= 99) ? ['나이를 숫자로 입력해 주세요.', f.age]
      : !v.gender ? ['성별을 선택해 주세요.']
      : !v.memberType ? ['학생인지 학부모인지 선택해 주세요.']
      : !f.grade.value ? [v.memberType === '학부모' ? '자녀 학년을 선택해 주세요.' : '학년을 선택해 주세요.', f.grade]
      : minor && guardianSms && !/^[0-9]{6}$/.test(v.guardianCode) ? ['보호자 인증번호를 받아 입력해 주세요.', f.guardianName]
      : minor && !guardianSms && !v.guardianConsent ? ['만 14세 미만은 보호자 동의가 필요합니다.']
      : !f.agreeRules.checked || !f.agreePrivacy.checked ? ['필수 항목에 동의해 주세요.']
      : ['', null];
    if (problem) { err.textContent = problem; el?.focus(); return; }
    const btn = $('#join-btn');
    btn.disabled = true; btn.textContent = '가입하는 중'; err.textContent = '';
    try {
      await be.signUp(v);
      toast('가입했습니다. 반가워요!');
    } catch (e2) { err.textContent = be.errorText(e2); btn.disabled = false; btn.textContent = '가입하기'; }
  });
}

/* ---------------- 아이디 찾기 ---------------- */
export function renderFindId(ctx) {
  const { view } = ctx;
  if (!be.has('findIdStart')) { view.innerHTML = `${pageHead('아이디 찾기')}${empty('학원(042-321-5788)으로 문의해 주세요', 'info')}`; return; }
  view.innerHTML = `<div class="auth">
    <div class="auth-head"><h1>아이디 찾기</h1><p>가입할 때 인증한 휴대폰 번호로 찾습니다.</p></div>
    <form id="ff" novalidate>
      <div class="field"><label class="lbl" for="f-phone">휴대폰 번호</label><div class="inline"><input id="f-phone" name="phone" inputmode="tel" autocomplete="tel" placeholder="010-0000-0000"><button type="button" class="btn line" id="f-send">인증번호 받기</button></div></div>
      <div class="field hidden" id="f-code-box"><label class="lbl" for="f-code">인증번호</label><input id="f-code" name="code" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="6자리 숫자"><small id="f-msg"></small></div>
      <p class="err" id="err" role="alert"></p>
      <button class="btn lg block hidden" id="f-btn">아이디 확인</button>
    </form>
    <div id="f-result"></div>
    <nav class="auth-links"><a href="#/login">로그인</a><a href="#/reset-password">비밀번호 찾기</a></nav>
  </div>`;
  const f = $('#ff');
  f.phone.focus();
  f.phone.addEventListener('input', () => { f.phone.value = cleanPhone(f.phone.value); });
  $('#f-send').addEventListener('click', async (e) => {
    const phone = f.phone.value.trim();
    if (!PHONE_RE.test(phone)) { $('#err').textContent = '휴대폰 번호를 확인해 주세요.'; f.phone.focus(); return; }
    const b = e.currentTarget; b.disabled = true;
    try {
      await be.findIdStart(phone);
      $('#f-code-box').classList.remove('hidden'); $('#f-btn').classList.remove('hidden');
      $('#f-msg').textContent = be.DEMO ? '체험 모드 인증번호: 123456' : '문자로 받은 6자리 숫자를 입력해 주세요.';
      $('#err').textContent = ''; f.phone.readOnly = true; f.code.focus();
      cooldown(b, 30);
    } catch (err) { $('#err').textContent = be.errorText(err); b.disabled = false; }
  });
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!/^[0-9]{6}$/.test(f.code.value.trim())) { $('#err').textContent = '인증번호 6자리를 입력해 주세요.'; return; }
    try {
      const r = await be.findIdConfirm(f.phone.value.trim(), f.code.value.trim());
      $('#err').textContent = '';
      f.classList.add('hidden');
      $('#f-result').innerHTML = r.username
        ? `<div class="result-box"><span class="hint">이 번호로 가입한 아이디</span><b>${esc(r.username)}</b><span class="hint">가입일 ${r.createdAt ? fullDate(r.createdAt) : '-'}</span></div>
           <a class="btn lg block" style="margin-top:16px" href="#/login?id=${encodeURIComponent(r.username)}">이 아이디로 로그인</a>`
        : `<div class="result-box"><b>가입한 아이디가 없습니다</b><span class="hint">다른 번호로 가입하셨는지 확인해 주세요.</span></div>
           <a class="btn lg block" style="margin-top:16px" href="#/join">회원가입</a>`;
    } catch (err) { $('#err').textContent = be.errorText(err); }
  });
}

/* ---------------- 비밀번호 찾기 ---------------- */
export function renderResetPassword(ctx) {
  const { view, q } = ctx;
  if (!be.has('forgotPassword')) { view.innerHTML = `${pageHead('비밀번호 찾기')}${empty('학원(042-321-5788)으로 문의해 주세요', 'info')}`; return; }
  view.innerHTML = `<div class="auth">
    <div class="auth-head"><h1>비밀번호 찾기</h1><p>가입할 때 등록한 휴대폰으로 인증번호를 보내 드려요.</p></div>
    <form id="rf" novalidate>
      <div class="field"><label class="lbl" for="r-id">아이디</label><div class="inline"><input id="r-id" name="username" autocomplete="username" autocapitalize="off" spellcheck="false" value="${esc(q.get('id') || '')}"><button type="button" class="btn line" id="r-send">인증번호 받기</button></div></div>
      <div class="hidden" id="r-step2" style="display:flex;flex-direction:column;gap:16px">
        <div class="field"><label class="lbl" for="r-code">인증번호</label><input id="r-code" name="code" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="6자리 숫자"><small id="r-msg"></small></div>
        ${pwField('r-pw', 'password', '새 비밀번호', 'new-password', '8자 이상')}
        ${pwField('r-pw2', 'password2', '새 비밀번호 확인', 'new-password')}
      </div>
      <p class="err" id="err" role="alert"></p>
      <button class="btn lg block hidden" id="r-btn">비밀번호 바꾸기</button>
    </form>
    <nav class="auth-links"><a href="#/login">로그인</a><a href="#/find-id">아이디 찾기</a></nav>
  </div>`;
  wirePw(view);
  const f = $('#rf');
  f.username.focus();
  $('#r-send').addEventListener('click', async (e) => {
    const id = f.username.value.trim().toLowerCase();
    if (!be.USERNAME_RE.test(id)) { $('#err').textContent = '아이디를 확인해 주세요.'; f.username.focus(); return; }
    const b = e.currentTarget; b.disabled = true;
    try {
      const r = await be.forgotPassword(id);
      $('#r-step2').classList.remove('hidden'); $('#r-btn').classList.remove('hidden');
      $('#r-msg').textContent = be.DEMO ? '체험 모드 인증번호: 123456'
        : `${r.destination ? `${r.destination} 로` : '가입한 휴대폰으로'} 인증번호를 보냈습니다. 문자가 오지 않으면 아이디를 다시 확인해 주세요.`;
      $('#err').textContent = ''; f.username.readOnly = true; f.code.focus();
      cooldown(b, 30);
    } catch (err) { $('#err').textContent = be.errorText(err); b.disabled = false; }
  });
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('#err');
    if (!/^[0-9]{6}$/.test(f.code.value.trim())) { err.textContent = '인증번호 6자리를 입력해 주세요.'; return; }
    if (f.password.value.length < 8) { err.textContent = '새 비밀번호는 8자 이상이어야 합니다.'; return; }
    if (f.password.value !== f.password2.value) { err.textContent = '새 비밀번호 확인이 일치하지 않습니다.'; return; }
    try {
      await be.resetPassword(f.username.value, f.code.value.trim(), f.password.value);
      toast('비밀번호를 바꿨습니다. 새 비밀번호로 로그인해 주세요');
      location.hash = `#/login?id=${encodeURIComponent(f.username.value.trim().toLowerCase())}`;
    } catch (e2) { err.textContent = be.errorText(e2); }
  });
}

/* ---------------- 내 정보 ---------------- */
export async function renderMe(ctx) {
  const { view, q } = ctx;
  const me = be.currentUser();
  const extra = be.has('listMyComments');
  const tabs = [['info', '내 정보'], ['posts', '내 글'], ...(extra ? [['comments', '내 댓글'], ['bookmarks', '스크랩'], ['blocks', '차단']] : []), ['settings', '설정']];
  const tab = tabs.some(([id]) => id === q.get('tab')) ? q.get('tab') : 'info';
  view.innerHTML = `${pageHead('내 정보', { desc: `@${esc(me.username)} · ${esc(me.grade)}${me.role === 'admin' ? ' · 운영진' : ''}` })}
    <nav class="tabs" style="margin-bottom:8px">${tabs.map(([id, n]) => `<a href="#/me?tab=${id}" class="${id === tab ? 'on' : ''}"${id === tab ? ' aria-current="page"' : ''}>${n}</a>`).join('')}</nav>
    <div id="mb"><div class="loading">불러오는 중</div></div>`;
  const box = $('#mb');
  if (tab === 'info') {
    const priv = await be.getPrivate().catch(() => null);
    if (!ctx.alive()) return;
    const rows = [['아이디', `@${me.username}`], ['닉네임', me.nickname], ['구분', priv?.memberType || me.grade], ['학년', priv?.childGrade ? `자녀 ${priv.childGrade}` : me.grade],
      ['이름', priv?.realName], ['휴대폰', priv?.phone], ['성별', priv?.gender], ['나이', priv?.age ? `${priv.age}세` : ''],
      ['보호자 동의', priv?.guardianConsent ? `${priv.guardianName ? `${priv.guardianName} · ` : ''}동의함` : ''],
      ['권한', me.role === 'admin' ? '관리자' : '회원'], ['상태', me.banned ? '이용 정지' : '정상'], ['가입일', me.createdAt ? fullDate(me.createdAt) : '']];
    box.innerHTML = `<dl class="dl" style="max-width:560px;margin-top:8px">${rows.filter((r) => r[1]).map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
      <p class="hint" style="margin-top:16px">회원 정보를 바꾸려면 학원(042-321-5788)으로 연락해 주세요.</p>`;
  }
  if (tab === 'posts') {
    const posts = await be.listMyPosts();
    if (!ctx.alive()) return;
    box.innerHTML = posts.length ? `<div class="list">${posts.map((p) => listItemHtml(p)).join('')}</div>` : empty('작성한 글이 없습니다', 'pen');
  }
  if (tab === 'comments') {
    const list = await be.listMyComments();
    if (!ctx.alive()) return;
    box.innerHTML = list.length ? `<div class="list">${list.map((c) => `<a class="list-item" href="#/post/${esc(c.postId)}"><div class="main"><p>${esc(c.body)}</p>
      <div class="m"><span class="q">${esc(c.postTitle)}</span><span class="num">${shortDate(c.createdAt)}</span>${c.likeCount ? `<span>좋아요 ${c.likeCount}</span>` : ''}</div></div></a>`).join('')}</div>` : empty('작성한 댓글이 없습니다', 'chat');
  }
  if (tab === 'bookmarks') {
    const list = await be.listBookmarks();
    if (!ctx.alive()) return;
    box.innerHTML = list.length ? `<p class="hint" style="margin:8px 0 12px">스크랩은 나만 볼 수 있습니다 · <b class="num" style="color:var(--text)">${list.length}</b>개</p><div class="list">${list.map((p) => listItemHtml(p)).join('')}</div>`
      : empty('스크랩한 글이 없습니다. 글 아래 스크랩 버튼을 누르면 여기에 모입니다', 'bookmark');
  }
  if (tab === 'blocks') {
    const draw = async () => {
      const list = await be.listBlocks();
      if (!ctx.alive()) return;
      box.innerHTML = list.length ? `<p class="hint" style="margin:8px 0 12px">차단한 회원의 글과 댓글은 나에게 보이지 않습니다.</p><div class="list">${list.map((b) => `<div class="list-item"><div class="main"><span class="t">${esc(b.nickname)}</span><div class="m"><span class="num">${fullDate(b.at)} 차단</span></div></div>
        <button type="button" class="btn sm line side-btn" data-unblock="${esc(b.uid)}">차단 풀기</button></div>`).join('')}</div>` : empty('차단한 회원이 없습니다. 글쓴이 이름 옆 메뉴에서 차단할 수 있습니다', 'ban');
    };
    await draw();
    box.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-unblock]');
      if (!b) return;
      try { await be.setBlock(b.dataset.unblock, false); toast('차단을 풀었습니다'); await draw(); } catch (err) { toast(be.errorText(err)); }
    });
  }
  if (tab === 'settings') {
    box.innerHTML = `
      <section class="set-row"><div class="set-label"><h2>비밀번호 변경</h2><p>다른 사이트와 다른 비밀번호를 쓰세요.</p></div>
        <div class="set-panel"><form id="pwf" novalidate>
          ${pwField('pw-old', 'old', '현재 비밀번호', 'current-password')}
          ${pwField('pw-new', 'pw', '새 비밀번호', 'new-password', '8자 이상')}
          <p class="err" id="pwerr" role="alert"></p><div><button class="btn line">비밀번호 변경</button></div></form></div></section>
      <section class="set-row"><div class="set-label"><h2>로그아웃</h2><p>이 기기에서 로그아웃합니다.</p></div>
        <div class="set-panel"><button type="button" class="btn line" id="logout2">로그아웃</button></div></section>
      <section class="set-row"><div class="set-label"><h2>회원 탈퇴</h2><p>이름·휴대폰·나이 같은 회원 정보가 바로 지워지고 되돌릴 수 없습니다.</p></div>
        <div class="set-panel"><p class="hint" style="margin-bottom:12px">작성한 글과 댓글은 남습니다. 지우고 싶은 글이 있으면 탈퇴 전에 직접 삭제해 주세요.</p><button type="button" class="btn danger" id="withdraw">회원 탈퇴</button></div></section>`;
    wirePw(box);
    $('#pwf').addEventListener('submit', async (e) => {
      e.preventDefault();
      const f = e.target;
      if (f.pw.value.length < 8) { $('#pwerr').textContent = '새 비밀번호는 8자 이상이어야 합니다.'; return; }
      try { await be.changePassword(f.old.value, f.pw.value); toast('비밀번호를 변경했습니다'); f.reset(); $('#pwerr').textContent = ''; } catch (err) { $('#pwerr').textContent = be.errorText(err); }
    });
    $('#logout2').addEventListener('click', async () => { await be.signOut(); toast('로그아웃했습니다'); location.hash = '#/'; });
    $('#withdraw').addEventListener('click', async () => {
      const pw = await modal({
        title: '회원 탈퇴',
        body: `<p style="font-size:15px;color:var(--muted);margin-bottom:16px">탈퇴하면 회원 정보가 즉시 삭제되며 복구할 수 없습니다. 같은 아이디로 다시 가입할 수 있지만 이전 기록은 돌아오지 않습니다.</p>
          <div class="field"><label class="lbl" for="wd-pw">비밀번호 확인</label><input id="wd-pw" type="password" autocomplete="current-password"></div>`,
        buttons: [{ label: '취소', value: null, cls: 'line' }, { label: '탈퇴', value: (b) => $('#wd-pw', b).value || null, cls: 'danger' }],
        onMount: (b) => $('#wd-pw', b).focus(),
      });
      if (!pw) return;
      if (!await confirmBox('마지막 확인', `@${me.username} 계정을 정말 탈퇴할까요?`, '탈퇴', true)) return;
      try { await be.withdraw(pw); toast('탈퇴가 완료되었습니다'); location.hash = '#/'; } catch (err) { toast(be.errorText(err)); }
    });
  }
}
