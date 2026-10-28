// 로그인·회원가입·내 정보
import * as be from './backend.js';
import { STUDENT_GRADES } from './boards.js';
import { esc, $, toast, icon, empty, pageHead, listItemHtml, fullDate, modal } from './ui.js';

const nextOf = (q) => {
  const n = q.get('next') || '#/';
  return n.startsWith('#/') && !n.startsWith('#/login') && !n.startsWith('#/join') ? n : '#/';
};
const PHONE_RE = /^01[0-9]-?[0-9]{3,4}-?[0-9]{4}$/;

export function renderLogin(ctx) {
  const { view, q } = ctx;
  if (be.currentUser()) { location.replace(nextOf(q)); return; }
  view.innerHTML = `<div class="auth">
    <div class="auth-head"><img src="images/logo.webp" alt="태산학원"><h1>로그인</h1><p>태산입시 회원 아이디로 로그인하세요.</p></div>
    <form id="lf" novalidate>
      <div class="field"><label class="lbl" for="l-id">아이디</label><input id="l-id" name="username" autocomplete="username" autocapitalize="off" spellcheck="false"></div>
      <div class="field"><label class="lbl" for="l-pw">비밀번호</label><input id="l-pw" type="password" name="password" autocomplete="current-password"></div>
      <p class="err" id="err"></p>
      <button class="btn lg block" id="l-btn">로그인</button>
    </form>
    <p class="auth-foot">아직 회원이 아니신가요?<a href="#/join">회원가입</a></p>
    <p class="hint" style="text-align:center;margin-top:8px">비밀번호를 잊으셨다면 학원으로 문의해 주세요.</p>
  </div>`;
  $('#lf').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target, btn = $('#l-btn');
    if (!f.username.value.trim() || !f.password.value) { $('#err').textContent = '아이디와 비밀번호를 입력해 주세요.'; return; }
    btn.disabled = true;
    try { await be.signIn(f.username.value, f.password.value); } catch (err) { $('#err').textContent = be.errorText(err); btn.disabled = false; }
  });
}

export function renderJoin(ctx) {
  const { view } = ctx;
  if (be.currentUser()) { location.replace('#/'); return; }
  view.innerHTML = `<div class="auth wide">
    <div class="auth-head"><img src="images/logo.webp" alt="태산학원"><h1>회원가입</h1><p>실명·휴대폰·성별·나이는 관리자만 볼 수 있습니다.</p></div>
    <form id="jf" novalidate>
      <div class="form-section">
        <h2>계정</h2>
        <div class="field"><label class="lbl" for="j-id">아이디<span class="req">*</span></label><input id="j-id" name="username" autocomplete="username" autocapitalize="off" spellcheck="false" placeholder="영문 소문자·숫자·밑줄(_) 4~20자"></div>
        <div class="grid-2">
          <div class="field"><label class="lbl" for="j-pw">비밀번호<span class="req">*</span></label><input id="j-pw" type="password" name="password" autocomplete="new-password" placeholder="8자 이상"></div>
          <div class="field"><label class="lbl" for="j-pw2">비밀번호 확인<span class="req">*</span></label><input id="j-pw2" type="password" name="password2" autocomplete="new-password"></div>
        </div>
      </div>
      <div class="form-section">
        <h2>본인 확인</h2>
        <div class="field"><label class="lbl" for="j-phone">휴대폰 번호<span class="req">*</span></label>
          <div class="inline"><input id="j-phone" name="phone" inputmode="tel" autocomplete="tel" placeholder="010-0000-0000"><button type="button" class="btn line" id="send-code">인증번호 받기</button></div></div>
        <div class="field hidden" id="code-box"><label class="lbl" for="j-code">인증번호<span class="req">*</span></label><input id="j-code" name="code" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="6자리 숫자"><small id="code-msg"></small></div>
        <div id="recaptcha-box"></div>
      </div>
      <div class="form-section">
        <h2>회원 정보</h2>
        <div class="grid-2">
          <div class="field"><label class="lbl" for="j-name">이름<span class="req">*</span></label><input id="j-name" name="realName" maxlength="20" autocomplete="name"></div>
          <div class="field"><label class="lbl" for="j-age">나이<span class="req">*</span></label><input id="j-age" name="age" type="number" inputmode="numeric" min="8" max="99" placeholder="만 나이"></div>
        </div>
        <div class="field"><span>성별<span class="req">*</span></span><div class="segmented" data-seg="gender"><button type="button" data-v="남">남</button><button type="button" data-v="여">여</button></div></div>
        <div class="field"><span>구분<span class="req">*</span></span><div class="segmented" data-seg="memberType"><button type="button" data-v="학생">학생</button><button type="button" data-v="학부모">학부모</button></div></div>
        <div class="field"><label class="lbl" for="j-grade" id="grade-label">학년<span class="req">*</span></label><select id="j-grade" name="grade"><option value="">선택</option>${STUDENT_GRADES.map((g) => `<option>${g}</option>`).join('')}</select></div>
      </div>
      <div class="agree">
        <label class="check"><input type="checkbox" id="agree-all"><b>전체 동의</b></label>
        <label class="check"><input type="checkbox" name="agreeRules">[필수] <a href="#/rules" target="_blank">커뮤니티 이용규칙</a> 동의</label>
        <label class="check"><input type="checkbox" name="agreePrivacy">[필수] <a href="#/privacy" target="_blank">개인정보 수집·이용</a> 동의 (이름·휴대폰·성별·나이·구분·학년, 회원 관리 목적, 탈퇴 시까지 보관)</label>
        <label class="check hidden" id="guardian"><input type="checkbox" name="guardianConsent">[필수] 만 14세 미만으로, 보호자(법정대리인)의 동의를 받았습니다.</label>
      </div>
      <p class="err" id="err"></p>
      <button class="btn lg block" id="join-btn">가입하기</button>
    </form>
    <p class="auth-foot">이미 회원이신가요?<a href="#/login">로그인</a></p>
  </div>`;
  const f = $('#jf');
  const seg = { gender: '', memberType: '' };
  f.addEventListener('click', (e) => {
    const b = e.target.closest('[data-seg] button');
    if (!b) return;
    const box = b.parentElement;
    seg[box.dataset.seg] = b.dataset.v;
    [...box.children].forEach((x) => x.classList.toggle('on', x === b));
    if (box.dataset.seg === 'memberType') $('#grade-label').innerHTML = `${b.dataset.v === '학부모' ? '자녀 학년' : '학년'}<span class="req">*</span>`;
  });
  const agrees = ['agreeRules', 'agreePrivacy', 'guardianConsent'];
  $('#agree-all').addEventListener('change', (e) => agrees.forEach((n) => { if (!f[n].closest('.hidden')) f[n].checked = e.target.checked; }));
  $('#send-code').addEventListener('click', async (e) => {
    const phone = f.phone.value.replace(/\s/g, '');
    if (!PHONE_RE.test(phone)) { $('#err').textContent = '휴대폰 번호를 확인해 주세요. 예) 010-1234-5678'; f.phone.focus(); return; }
    const b = e.currentTarget; b.disabled = true; b.textContent = '보내는 중';
    try {
      await be.sendPhoneCode(phone, 'recaptcha-box');
      $('#code-box').classList.remove('hidden');
      $('#code-msg').textContent = be.DEMO ? '체험 모드 인증번호: 123456' : '문자로 받은 6자리 숫자를 입력해 주세요.';
      $('#err').textContent = ''; b.textContent = '다시 받기'; f.phone.readOnly = true; f.code.focus();
      setTimeout(() => { b.disabled = false; }, 30000);
    } catch (err) { $('#err').textContent = be.errorText(err); b.disabled = false; b.textContent = '인증번호 받기'; }
  });
  f.age.addEventListener('input', () => $('#guardian').classList.toggle('hidden', !(+f.age.value > 0 && +f.age.value < 14)));
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('#err');
    const v = {
      username: f.username.value.trim().toLowerCase(), password: f.password.value,
      realName: f.realName.value.trim(), gender: seg.gender, memberType: seg.memberType,
      grade: seg.memberType === '학부모' ? '학부모' : f.grade.value, childGrade: seg.memberType === '학부모' ? f.grade.value : '',
      phone: f.phone.value.replace(/\s/g, ''), age: parseInt(f.age.value, 10), guardianConsent: f.guardianConsent.checked, code: f.code.value.trim(),
    };
    const [problem, el] = !be.USERNAME_RE.test(v.username) ? ['아이디는 영문 소문자·숫자·밑줄(_) 4~20자로 정해 주세요.', f.username]
      : v.password.length < 8 ? ['비밀번호는 8자 이상이어야 합니다.', f.password]
      : v.password !== f.password2.value ? ['비밀번호 확인이 일치하지 않습니다.', f.password2]
      : !PHONE_RE.test(v.phone) ? ['휴대폰 번호를 확인해 주세요.', f.phone]
      : !/^[0-9]{6}$/.test(v.code) ? ['휴대폰 인증번호 6자리를 입력해 주세요.', f.code]
      : !v.realName ? ['이름을 입력해 주세요.', f.realName]
      : !(v.age >= 8 && v.age <= 99) ? ['나이를 숫자로 입력해 주세요.', f.age]
      : !v.gender ? ['성별을 선택해 주세요.']
      : !v.memberType ? ['학생인지 학부모인지 선택해 주세요.']
      : !f.grade.value ? [v.memberType === '학부모' ? '자녀 학년을 선택해 주세요.' : '학년을 선택해 주세요.', f.grade]
      : !f.agreeRules.checked || !f.agreePrivacy.checked ? ['필수 항목에 동의해 주세요.']
      : v.age < 14 && !v.guardianConsent ? ['만 14세 미만은 보호자 동의가 필요합니다.']
      : ['', null];
    if (problem) { err.textContent = problem; el?.focus(); return; }
    const btn = $('#join-btn');
    btn.disabled = true; err.textContent = '';
    try {
      await be.signUp(v);
      toast('가입이 완료되었습니다');
    } catch (e2) { err.textContent = be.errorText(e2); btn.disabled = false; }
  });
}

export async function renderMe(ctx) {
  const { view } = ctx;
  const me = be.currentUser();
  const [priv, posts] = await Promise.all([be.getPrivate().catch(() => null), be.listMyPosts()]);
  if (!ctx.alive()) return;
  const rows = [['아이디', `@${me.username}`], ['닉네임', me.nickname], ['구분', priv?.memberType || me.grade], ['학년', priv?.childGrade ? `자녀 ${priv.childGrade}` : me.grade],
    ['이름', priv?.realName], ['휴대폰', priv?.phone], ['성별', priv?.gender], ['나이', priv?.age ? `${priv.age}세` : ''],
    ['권한', me.role === 'admin' ? '관리자' : '회원'], ['상태', me.banned ? '이용 정지' : '정상'], ['가입일', me.createdAt ? fullDate(me.createdAt) : '']];
  view.innerHTML = `${pageHead('내 정보', { desc: '회원 정보 변경은 학원으로 문의해 주세요.' })}
    <dl class="dl">${rows.filter((r) => r[1]).map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>
    <section class="section"><h2>내가 쓴 글</h2>${posts.length ? `<div class="list">${posts.map(listItemHtml).join('')}</div>` : empty('작성한 글이 없습니다', 'pen')}</section>
    <section class="section"><h2>비밀번호 변경</h2>
      <form id="pwf" style="display:flex;flex-direction:column;gap:12px;max-width:400px" novalidate>
        <div class="field"><label class="lbl" for="pw-old">현재 비밀번호</label><input id="pw-old" type="password" name="old" autocomplete="current-password"></div>
        <div class="field"><label class="lbl" for="pw-new">새 비밀번호</label><input id="pw-new" type="password" name="pw" autocomplete="new-password" placeholder="8자 이상"></div>
        <p class="err" id="pwerr"></p><div><button class="btn line">비밀번호 변경</button></div></form></section>
    <section class="section" style="display:flex;gap:8px"><button type="button" class="btn ghost" id="logout2">로그아웃</button><button type="button" class="btn ghost" id="withdraw" style="color:var(--g500)">회원 탈퇴</button></section>`;

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
      body: `<p style="font-size:15px;color:var(--g700);margin-bottom:16px">탈퇴하면 회원 정보(이름·휴대폰·나이)가 즉시 삭제되며 복구할 수 없습니다. 작성한 글과 댓글은 남으니, 필요하면 탈퇴 전에 직접 삭제해 주세요.</p>
        <div class="field"><label class="lbl" for="wd-pw">비밀번호 확인</label><input id="wd-pw" type="password" autocomplete="current-password"></div>`,
      buttons: [{ label: '취소', value: null, cls: 'line' }, { label: '탈퇴', value: (box) => $('#wd-pw', box).value || null, cls: 'danger' }],
    });
    if (!pw) return;
    try { await be.withdraw(pw); toast('탈퇴가 완료되었습니다'); location.hash = '#/'; } catch (err) { toast(be.errorText(err)); }
  });
}
