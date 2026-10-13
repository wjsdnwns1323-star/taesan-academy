// 로그인·회원가입·내 정보
import * as be from './backend.js';
import { GRADES, STUDENT_GRADES } from './boards.js';
import { SITE_NAME } from './config.js';
import { esc, $, toast, backBar, itemHtml, qcardHtml } from './ui.js';

const nextOf = (q) => {
  const n = q.get('next') || '#/';
  return n.startsWith('#/') && !n.startsWith('#/login') && !n.startsWith('#/join') ? n : '#/';
};

export function renderLogin(ctx) {
  const { view, q } = ctx;
  if (be.currentUser()) { location.replace(nextOf(q)); return; }
  view.innerHTML = `${backBar('로그인')}
    <div class="hero" style="padding-bottom:6px"><img class="hero-logo" src="images/logo.webp" alt="태산학원"><h1>${esc(SITE_NAME)}</h1><p>아이디와 비밀번호로 로그인하세요</p></div>
    <form class="form" id="lf">
      <label class="field"><span>아이디</span><input class="input" name="username" autocomplete="username" autocapitalize="off" required></label>
      <label class="field"><span>비밀번호</span><input class="input" type="password" name="password" autocomplete="current-password" required></label>
      <p class="err" id="err"></p>
      <button class="btn">로그인</button>
      <a class="btn gray" href="#/join" style="display:grid;place-items:center">회원가입</a>
      <p style="text-align:center;color:var(--muted);font-size:14px;margin:0">비밀번호를 잊었다면 학원 관리자에게 문의해 주세요.</p>
    </form>`;
  $('#lf').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target, btn = $('button', f);
    btn.disabled = true;
    try {
      await be.signIn(f.username.value, f.password.value);
    } catch (err) { $('#err').textContent = be.errorText(err); btn.disabled = false; }
  });
}

export function renderJoin(ctx) {
  const { view } = ctx;
  if (be.currentUser()) { location.replace('#/'); return; }
  view.innerHTML = `${backBar('회원가입')}
    <form class="form" id="jf" novalidate>
      <div class="card" style="margin:0"><p>🔒 실명·전화번호·성별·나이는 <b>관리자만</b> 볼 수 있어요. 다른 회원에게는 아이디(닉네임)와 학생/학부모 구분만 보여요.</p></div>
      <label class="field"><span>아이디</span><input class="input" name="username" autocomplete="username" autocapitalize="off" placeholder="영문 소문자·숫자·_ 4~20자"></label>
      <div class="row2">
        <label class="field"><span>비밀번호</span><input class="input" type="password" name="password" autocomplete="new-password" placeholder="8자 이상"></label>
        <label class="field"><span>비밀번호 확인</span><input class="input" type="password" name="password2" autocomplete="new-password"></label>
      </div>
      <div class="row2">
        <label class="field"><span>실명</span><input class="input" name="realName" maxlength="20" autocomplete="name"></label>
        <label class="field"><span>성별</span><select name="gender"><option value="">선택</option><option>남</option><option>여</option></select></label>
      </div>
      <div class="row2">
        <label class="field"><span>학생/학부모</span><select name="memberType"><option value="">선택</option><option>학생</option><option>학부모</option></select></label>
        <label class="field"><span id="grade-label">학년</span><select name="grade"><option value="">선택</option>${STUDENT_GRADES.map((g) => `<option>${g}</option>`).join('')}</select></label>
      </div>
      <div class="row2">
        <label class="field"><span>휴대폰 번호</span><div style="display:flex;gap:6px"><input class="input" name="phone" inputmode="tel" autocomplete="tel" placeholder="010-0000-0000"><button type="button" class="btn small dark" id="send-code" style="flex:none">인증번호 받기</button></div></label>
        <label class="field"><span>나이</span><input class="input" name="age" type="number" inputmode="numeric" min="8" max="99" placeholder="만 나이"></label>
      </div>
      <label class="field hidden" id="code-box"><span>인증번호</span><input class="input" name="code" inputmode="numeric" maxlength="6" placeholder="문자로 받은 6자리"><small id="code-msg"></small></label>
      <div id="recaptcha-box"></div>
      <div class="field">
        <label class="check"><input type="checkbox" name="agreeRules"> <span>[필수] <a href="#/rules" target="_blank" style="text-decoration:underline">커뮤니티 이용규칙</a>에 동의합니다.</span></label>
        <label class="check"><input type="checkbox" name="agreePrivacy"> <span>[필수] <a href="#/privacy" target="_blank" style="text-decoration:underline">개인정보 수집·이용</a>(실명, 전화번호, 성별, 나이, 학생·학부모 구분과 학년 / 회원 관리·학원 연락 목적 / 탈퇴 시까지 보관)에 동의합니다.</span></label>
        <label class="check hidden" id="guardian"><input type="checkbox" name="guardianConsent"> <span>[필수] 만 14세 미만이라 <b>보호자(부모님)의 동의</b>를 받았습니다.</span></label>
      </div>
      <p class="err" id="err"></p>
      <button class="btn" id="join-btn">가입하기</button>
    </form>`;
  const f = $('#jf');
  $('#send-code').addEventListener('click', async (e) => {
    const phone = f.phone.value.replace(/\s/g, '');
    if (!/^01[0-9]-?[0-9]{3,4}-?[0-9]{4}$/.test(phone)) { $('#err').textContent = '휴대폰 번호를 확인해 주세요. (예: 010-1234-5678)'; return; }
    const b = e.currentTarget; b.disabled = true; b.textContent = '보내는 중…';
    try {
      await be.sendPhoneCode(phone, 'recaptcha-box');
      $('#code-box').classList.remove('hidden');
      $('#code-msg').textContent = be.DEMO ? '체험 모드: 인증번호는 123456' : '문자로 받은 인증번호 6자리를 넣어 주세요.';
      $('#err').textContent = ''; b.textContent = '다시 받기'; f.phone.readOnly = true;
      setTimeout(() => { b.disabled = false; }, 30000);
    } catch (err) { $('#err').textContent = be.errorText(err); b.disabled = false; b.textContent = '인증번호 받기'; }
  });
  f.memberType.addEventListener('change', () => { $('#grade-label').textContent = f.memberType.value === '학부모' ? '자녀 학년' : '학년'; });
  f.age.addEventListener('input', () => $('#guardian').classList.toggle('hidden', !(+f.age.value > 0 && +f.age.value < 14)));
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const err = $('#err');
    const v = {
      username: f.username.value.trim().toLowerCase(), password: f.password.value,
      realName: f.realName.value.trim(), gender: f.gender.value, memberType: f.memberType.value,
      grade: f.memberType.value === '학부모' ? '학부모' : f.grade.value, childGrade: f.memberType.value === '학부모' ? f.grade.value : '', phone: f.phone.value.replace(/\s/g, ''), age: parseInt(f.age.value, 10),
      guardianConsent: f.guardianConsent.checked, code: f.code.value.trim(),
    };
    const problem = !be.USERNAME_RE.test(v.username) ? '아이디는 영문 소문자·숫자·_ 4~20자입니다.'
      : v.password.length < 8 ? '비밀번호는 8자 이상이어야 해요.'
      : v.password !== f.password2.value ? '비밀번호 확인이 맞지 않아요.'
      : !v.realName ? '실명을 입력해 주세요.'
      : !/^01[0-9]-?[0-9]{3,4}-?[0-9]{4}$/.test(v.phone) ? '휴대전화 번호를 확인해 주세요. (예: 010-1234-5678)'
      : !/^[0-9]{6}$/.test(v.code) ? '휴대폰 인증번호 6자리를 넣어 주세요.'
      : !v.gender ? '성별을 골라 주세요.'
      : !(v.age >= 8 && v.age <= 99) ? '나이를 숫자로 입력해 주세요.'
      : !v.memberType ? '학생인지 학부모인지 골라 주세요.'
      : !f.grade.value ? (v.memberType === '학부모' ? '자녀 학년을 골라 주세요.' : '학년을 골라 주세요.')
      : !f.agreeRules.checked || !f.agreePrivacy.checked ? '필수 동의 항목에 체크해 주세요.'
      : v.age < 14 && !v.guardianConsent ? '만 14세 미만은 보호자 동의가 필요해요.'
      : '';
    if (problem) { err.textContent = problem; return; }
    const btn = $("#join-btn");
    btn.disabled = true; err.textContent = '';
    try {
      await be.signUp(v);
      toast('가입을 환영해요!');
    } catch (e2) { err.textContent = be.errorText(e2); btn.disabled = false; }
  });
}

export async function renderMe(ctx) {
  const { view } = ctx;
  const me = be.currentUser();
  const [priv, posts] = await Promise.all([be.getPrivate().catch(() => null), be.listMyPosts()]);
  if (!ctx.alive()) return;
  view.innerHTML = `${backBar('내 정보')}
    <div class="card"><div class="profile"><span class="avatar">${esc(me.nickname[0])}</span><div><b>${esc(me.nickname)}</b><br>
      <small style="color:var(--sub)">@${esc(me.username)} · ${esc(me.grade)}${me.role === 'admin' ? ' · 관리자' : ''}${me.banned ? ' · <b style="color:var(--danger)">이용 정지</b>' : ''}</small></div></div></div>
    <form class="form" id="pf">
      <div class="row2">
        <label class="field"><span>닉네임</span><input class="input" name="nickname" maxlength="20" value="${esc(me.nickname)}"></label>
        <label class="field"><span>학년</span><select name="grade">${GRADES.map((g) => `<option ${g === me.grade ? 'selected' : ''}>${g}</option>`).join('')}</select></label>
      </div>
      <div class="row2">
        <label class="field"><span>실명 <small>(관리자만 봄)</small></span><input class="input" name="realName" maxlength="20" value="${esc(priv?.realName || '')}"></label>
        <label class="field"><span>나이</span><input class="input" type="number" name="age" value="${esc(priv?.age ?? '')}"></label>
      </div>
      <p style="margin:0;color:var(--sub);font-size:14px">${esc(priv?.memberType || '')}${priv?.childGrade ? ` · 자녀 ${esc(priv.childGrade)}` : ''}${priv?.gender ? ` · ${esc(priv.gender)}` : ''}</p>
      <label class="field"><span>전화번호 <small>(관리자만 봄)</small></span><input class="input" name="phone" inputmode="tel" value="${esc(priv?.phone || '')}"></label>
      <p class="err" id="perr"></p>
      <button class="btn dark">정보 저장</button>
    </form>
    <div class="sec-title" style="padding-top:10px"><h2>내가 쓴 글</h2></div>
    <div class="post-list">${posts.map((p) => (p.board === 'qna' ? qcardHtml(p) : itemHtml(p))).join('') || '<div class="empty">올라온 글이 없어요</div>'}</div>
    <form class="form" id="pwf"><h3 style="margin:10px 0 0">비밀번호 바꾸기</h3>
      <input class="input" type="password" name="old" placeholder="지금 비밀번호" autocomplete="current-password">
      <input class="input" type="password" name="pw" placeholder="새 비밀번호(8자 이상)" autocomplete="new-password">
      <p class="err" id="pwerr"></p><button class="btn gray">비밀번호 바꾸기</button></form>
    <div class="menu-list"><button id="withdraw" style="color:var(--muted);font-size:15px">회원 탈퇴</button></div>`;

  $('#pf').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    const v = { nickname: f.nickname.value.trim(), grade: f.grade.value, realName: f.realName.value.trim(), phone: f.phone.value.replace(/\s/g, ''), age: parseInt(f.age.value, 10) };
    const problem = v.nickname.length < 2 || /[/\s]/.test(v.nickname) ? '닉네임은 띄어쓰기·/ 없이 2~20자로 정해 주세요.'
      : !v.realName ? '실명을 입력해 주세요.'
      : !/^01[0-9]-?[0-9]{3,4}-?[0-9]{4}$/.test(v.phone) ? '휴대전화 번호를 확인해 주세요.'
      : !(v.age >= 8 && v.age <= 99) ? '나이를 확인해 주세요.' : '';
    if (problem) { $('#perr').textContent = problem; return; }
    try { await be.updateProfile(v); toast('저장했어요'); $('#perr').textContent = ''; } catch (err) { $('#perr').textContent = be.errorText(err); }
  });
  $('#pwf').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.target;
    if (f.pw.value.length < 8) { $('#pwerr').textContent = '새 비밀번호는 8자 이상이어야 해요.'; return; }
    try { await be.changePassword(f.old.value, f.pw.value); toast('비밀번호를 바꿨어요'); f.reset(); $('#pwerr').textContent = ''; } catch (err) { $('#pwerr').textContent = be.errorText(err); }
  });
  $('#withdraw').addEventListener('click', async () => {
    const pw = prompt('탈퇴하면 회원 정보(실명·전화번호·나이)가 바로 지워지고 되돌릴 수 없어요.\n쓴 글과 댓글은 남습니다(탈퇴 전에 직접 지울 수 있어요).\n\n계속하려면 비밀번호를 입력하세요.');
    if (!pw) return;
    try { await be.withdraw(pw); toast('탈퇴했어요. 이용해 주셔서 고마워요.'); location.hash = '#/'; } catch (err) { toast(be.errorText(err)); }
  });
}
