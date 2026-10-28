// 태산입시 서버 규칙: 회원가입·로그인, 글·댓글·좋아요, 알림, 신고, 배너, 파일, 관리자 기능
// AWS Lambda(index.mjs)와 체험 모드(public/js/server-core.js, 브라우저 안에서 실행)가 이 파일을 똑같이 씁니다.
// 저장소(store)·파일(files)·로그인(idp)은 밖에서 넣어 줍니다. 이 파일은 다른 패키지를 쓰지 않습니다.
// public/js/server-core.js 는 이 파일의 복사본입니다(scripts/sync-core.sh). 고칠 때는 이 파일만 고치세요.

export const BOARDS = ['news', 'talk', 'school', 'admission', 'qna', 'data', 'notice'];
export const GRADES = ['학부모', '중1', '중2', '중3', '고1', '고2', '고3', 'N수', '기타'];
const CHILD_GRADES = ['', '중1', '중2', '중3', '고1', '고2', '고3', 'N수'];
export const USERNAME_RE = /^[a-z0-9_]{4,20}$/;
const PHONE_RE = /^01[0-9]-?[0-9]{3,4}-?[0-9]{4}$/;
const JPEG_RE = /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/;
const DAY = 86400000;
const LIMIT = {
  fileBytes: 5 * 1024 * 1024, images: 10, files: 5, title: 100, body: 10000, comment: 3000, source: 200,
  thumb: 80000, commentImage: 300000, coverImage: 380000, bannerImage: 300000, pollOptions: 6, pollOption: 40,
};

/* ---------------- 공통 ---------------- */
export class ApiError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
// 저장소 조건(이미 있음/없음 등)이 맞지 않을 때
export class Conflict extends Error { constructor(m = 'conflict') { super(m); this.name = 'Conflict'; } }

const bad = (m) => new ApiError(400, 'invalid', m);
const E = {
  login: () => new ApiError(401, 'login-required', '로그인이 필요합니다.'),
  banned: () => new ApiError(403, 'banned', '이용이 정지된 계정입니다.'),
  admin: () => new ApiError(403, 'forbidden', '관리자만 할 수 있습니다.'),
  forbidden: (m = '권한이 없습니다.') => new ApiError(403, 'forbidden', m),
  notFound: (m = '찾을 수 없습니다.') => new ApiError(404, 'not-found', m),
};

const rnd = (n) => {
  const b = new Uint8Array(n);
  globalThis.crypto.getRandomValues(b);
  return Array.from(b, (x) => (x % 36).toString(36)).join('');
};
// 시간순으로 정렬되는 짧은 ID(같은 밀리초에 여러 개를 만들어도 만든 순서대로)
let lastT = 0, seq = 0;
export function newId(t = Date.now()) {
  if (t <= lastT) { t = lastT; seq += 1; } else { lastT = t; seq = 0; }
  return t.toString(36).padStart(9, '0') + (seq % 1296).toString(36).padStart(2, '0') + rnd(4);
}
const pad = (t) => String(t).padStart(13, '0');
const str = (v, max) => typeof v === 'string' && v.length <= max;
const nonEmpty = (v, max) => str(v, max) && v.trim().length > 0;
const jpeg = (v, max) => v === '' || (str(v, max) && JPEG_RE.test(v));
export const toE164 = (phone) => `+82${String(phone).replace(/[^0-9]/g, '').replace(/^0/, '')}`;
const clean = (item) => {
  if (!item) return item;
  const out = {};
  for (const [k, v] of Object.entries(item)) if (!/^(pk|sk|ttl|gsi\d(pk|sk))$/.test(k)) out[k] = v;
  return out;
};

/* ---------------- 앱 ---------------- */
// store: 저장소, files: 파일 주소 발급, idp: 로그인(Cognito 또는 체험용), sms: 문자 보내기(아이디 찾기),
// env: { demo, qnaOpen, smsDailyMax, now }
export function createApp({ store, files, idp, sms, env = {} }) {
  const now = env.now || Date.now;
  const routes = [];
  const on = (method, pattern, fn) => routes.push({ method, parts: pattern.split('/').filter(Boolean), fn });

  /* ----- 요청한 사람 ----- */
  async function me(ctx) {
    if (!ctx.auth) return null;
    if (ctx._me === undefined) {
      const p = await store.get(`U#${ctx.auth.sub}`, 'PROFILE');
      ctx._me = p ? clean(p) : null;
    }
    return ctx._me;
  }
  async function user(ctx) { const u = await me(ctx); if (!u) throw E.login(); return u; }
  async function active(ctx) { const u = await user(ctx); if (u.banned) throw E.banned(); return u; }
  async function admin(ctx) { const u = await user(ctx); if (u.role !== 'admin') throw E.admin(); return u; }
  const isAdmin = (u) => u?.role === 'admin';
  // 내가 차단한 회원(글·댓글을 가림)
  async function blocksOf(ctx, u) {
    if (!u) return new Set();
    if (!ctx._blocks) ctx._blocks = store.query({ pk: `U#${u.uid}`, skBegins: 'BLK#', limit: 500 }).then((l) => new Set(l.map((b) => b.uid)));
    return ctx._blocks;
  }
  // 관리자가 개인정보를 열람·변경한 기록(개인정보의 안전성 확보조치 기준 제8조, 2년 보관)
  async function audit(u, action, target, count = 1) {
    const t = now();
    const month = new Date(t + 9 * 3600000).toISOString().slice(0, 7);
    await store.put({ pk: `AUDIT#${month}`, sk: `${pad(t)}#${rnd(6)}`, adminUid: u.uid, admin: u.username, action, target, count, at: t, ttl: Math.floor(t / 1000) + 2 * 366 * 86400 }).catch(() => {});
  }
  const sha256 = async (text) => Array.from(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))), (b) => b.toString(16).padStart(2, '0')).join('');
  const smsMax = () => env.smsDailyMax || 300;

  // 하루 횟수 제한(문자 발송·업로드 등)
  async function limit(key, max) {
    const day = new Date(now() + 9 * 3600000).toISOString().slice(0, 10);
    try {
      await store.update(`RATE#${key}#${day}`, 'R', { add: { n: 1 }, set: { ttl: Math.floor(now() / 1000) + 2 * 86400 } }, { upsert: true, ifBelow: { n: max } });
    } catch (e) {
      if (e instanceof Conflict) throw new ApiError(429, 'too-many-requests', '오늘 요청 횟수를 넘었어요. 내일 다시 시도해 주세요.');
      throw e;
    }
  }

  /* ----- 회원가입·로그인 ----- */
  const profileOut = (p) => ({ uid: p.uid, username: p.username, nickname: p.nickname, grade: p.grade, role: p.role, banned: !!p.banned, createdAt: p.createdAt });

  // 너무 쉬운 비밀번호(아이디가 들어간 것, 흔한 것) 거절
  const COMMON = ['12345678', '123456789', '1234567890', 'password', 'password1', 'qwer1234', 'qwerty12', 'asdf1234', '11111111', '00000000', 'abcd1234', 'iloveyou', '1q2w3e4r', 'q1w2e3r4', 'a1234567'];
  function checkPassword(pw, username) {
    if (!str(pw, 64) || pw.length < 8) throw bad('비밀번호는 8자 이상이어야 합니다.');
    if (pw !== pw.trim()) throw bad('비밀번호 앞뒤에는 빈칸을 넣을 수 없습니다.');
    const low = pw.toLowerCase();
    if (username && low.includes(username)) throw new ApiError(400, 'weak-password', '비밀번호에 아이디를 넣을 수 없습니다.');
    if (COMMON.includes(low) || /^(.)\1+$/.test(pw)) throw new ApiError(400, 'weak-password', '너무 쉬운 비밀번호입니다. 다른 비밀번호를 정해 주세요.');
  }

  function checkAccount(b) {
    const username = String(b.username || '').trim().toLowerCase();
    if (!USERNAME_RE.test(username)) throw bad('아이디는 영문 소문자·숫자·밑줄(_) 4~20자로 정해 주세요.');
    checkPassword(b.password, username);
    if (!PHONE_RE.test(String(b.phone || ''))) throw bad('휴대폰 번호를 확인해 주세요.');
    return { username, password: b.password, phone: b.phone, e164: toE164(b.phone) };
  }

  // 1단계: 휴대폰으로 인증번호 보내기(이때 로그인 계정이 '확인 전' 상태로 만들어집니다)
  on('POST', 'auth/start', async (ctx) => {
    const a = checkAccount(ctx.body);
    if (await store.get(`PHONE#${a.e164}`, 'PHONE')) throw new ApiError(409, 'phone-taken', '이미 이 휴대폰 번호로 가입한 계정이 있어요.');
    if (await store.get(`NICK#${a.username}`, 'NICK')) throw new ApiError(409, 'username-taken', '이미 쓰고 있는 아이디입니다.');
    const st = await idp.status(a.username);
    if (st === 'confirmed') throw new ApiError(409, 'username-taken', '이미 쓰고 있는 아이디입니다.');
    await limit(`sms#${a.e164}`, 5);
    await limit('sms#all', env.smsDailyMax || 300);
    if (st === 'unconfirmed') await idp.remove(a.username); // 가입을 끝내지 않은 계정은 지우고 다시 만듭니다
    await idp.signUp({ username: a.username, password: a.password, phone: a.e164 });
    return { sent: true };
  });

  // 만 14세 미만: 보호자 휴대폰으로 동의 인증번호(개인정보 보호법 제22조의2)
  on('POST', 'auth/guardian/start', async (ctx) => {
    const phone = String(ctx.body.phone || '');
    const childName = String(ctx.body.childName || '').trim().slice(0, 20);
    if (!PHONE_RE.test(phone)) throw bad('보호자 휴대폰 번호를 확인해 주세요.');
    if (!childName) throw bad('가입하는 학생의 이름을 먼저 입력해 주세요.');
    const e164 = toE164(phone);
    await limit(`sms#${e164}`, 5);
    await limit('sms#all', smsMax());
    const code = env.demo ? '123456' : String(100000 + (globalThis.crypto.getRandomValues(new Uint32Array(1))[0] % 900000));
    await store.put({ pk: `OTP#guardian#${e164}`, sk: 'OTP', hash: await sha256(`${e164}:${code}`), tries: 0, exp: now() + 10 * 60000, ttl: Math.floor(now() / 1000) + 3600 });
    await sms.send(e164, `[태산입시] ${childName} 학생의 회원가입 보호자 동의 인증번호: ${code}. 동의하시면 학생에게 알려 주세요.`);
    return { sent: true };
  });
  async function checkGuardian(phone, code) {
    const e164 = toE164(phone);
    const otp = await store.get(`OTP#guardian#${e164}`, 'OTP');
    const wrong = () => new ApiError(400, 'invalid-code', '보호자 인증번호가 맞지 않거나 시간이 지났어요.');
    if (!otp || otp.exp < now() || otp.tries >= 5) throw wrong();
    if (otp.hash !== await sha256(`${e164}:${code}`)) {
      await store.update(`OTP#guardian#${e164}`, 'OTP', { add: { tries: 1 } }).catch(() => {});
      throw wrong();
    }
    await store.del(`OTP#guardian#${e164}`, 'OTP');
  }

  // 2단계: 인증번호 확인 → 회원 정보 저장 → 로그인
  on('POST', 'auth/confirm', async (ctx) => {
    const b = ctx.body;
    const a = checkAccount(b);
    const code = String(b.code || '');
    if (!/^[0-9]{6}$/.test(code)) throw bad('휴대폰 인증번호 6자리를 입력해 주세요.');
    const memberType = b.memberType;
    if (!['학생', '학부모'].includes(memberType)) throw bad('학생인지 학부모인지 선택해 주세요.');
    const grade = memberType === '학부모' ? '학부모' : b.grade;
    if (!GRADES.includes(grade)) throw bad('학년을 선택해 주세요.');
    const childGrade = memberType === '학부모' ? b.childGrade : '';
    if (!CHILD_GRADES.includes(childGrade) || (memberType === '학부모' && !childGrade)) throw bad('자녀 학년을 선택해 주세요.');
    const realName = String(b.realName || '').trim();
    if (!nonEmpty(realName, 20)) throw bad('이름을 입력해 주세요.');
    if (!['남', '여'].includes(b.gender)) throw bad('성별을 선택해 주세요.');
    const age = b.age;
    if (!Number.isInteger(age) || age < 8 || age > 99) throw bad('나이를 숫자로 입력해 주세요.');
    if (b.agreeRules !== true || b.agreePrivacy !== true) throw bad('필수 항목에 동의해 주세요.');
    let guardian = { guardianConsent: false, guardianName: '', guardianPhone: '', guardianAt: 0 };
    if (age < 14) {
      const gName = String(b.guardianName || '').trim();
      const gPhone = String(b.guardianPhone || '');
      if (!nonEmpty(gName, 20)) throw bad('만 14세 미만은 보호자 이름이 필요합니다.');
      if (!PHONE_RE.test(gPhone)) throw bad('보호자 휴대폰 번호를 확인해 주세요.');
      if (toE164(gPhone) === a.e164) throw bad('보호자 휴대폰은 학생 번호와 달라야 합니다.');
      if (!/^[0-9]{6}$/.test(String(b.guardianCode || ''))) throw bad('보호자 인증번호 6자리를 입력해 주세요.');
      await checkGuardian(gPhone, String(b.guardianCode));
      guardian = { guardianConsent: true, guardianName: gName, guardianPhone: gPhone, guardianAt: now() };
    }

    const { sub } = await idp.confirm(a.username, code);
    const t = now();
    const nickname = a.username;
    const role = env.demo && a.username === 'admin' ? 'admin' : 'member'; // 체험 모드에서만 아이디 admin 이 관리자
    const profile = { pk: `U#${sub}`, sk: 'PROFILE', uid: sub, username: a.username, nickname, grade, role, banned: false, createdAt: t, gsi2pk: 'USERS', gsi2sk: `${pad(t)}#${sub}` };
    try {
      await store.transact([
        { put: profile, ifNotExists: true },
        { put: { pk: `U#${sub}`, sk: 'PRIVATE', realName, phone: a.phone, gender: b.gender, age, memberType, childGrade, ...guardian, agreedAt: t }, ifNotExists: true },
        { put: { pk: `NICK#${nickname}`, sk: 'NICK', uid: sub }, ifNotExists: true },
        { put: { pk: `PHONE#${a.e164}`, sk: 'PHONE', uid: sub }, ifNotExists: true },
      ]);
    } catch (e) {
      // 이미 가입을 마친 계정이 아니면 로그인 계정을 지워 다시 가입할 수 있게 합니다
      if (!(await store.get(`U#${sub}`, 'PROFILE').catch(() => null))) await idp.remove(a.username).catch(() => {});
      if (e instanceof Conflict) throw new ApiError(409, 'phone-taken', '이미 이 휴대폰 번호로 가입했거나 쓰고 있는 아이디입니다.');
      throw e;
    }
    const tokens = await idp.login(a.username, a.password);
    return { ...tokens, me: profileOut(profile) };
  });

  on('POST', 'auth/login', async (ctx) => {
    const username = String(ctx.body.username || '').trim().toLowerCase();
    const password = String(ctx.body.password || '');
    if (!username || !password) throw bad('아이디와 비밀번호를 입력해 주세요.');
    const tokens = await idp.login(username, password);
    const p = await store.get(`U#${tokens.sub}`, 'PROFILE');
    if (!p) throw new ApiError(401, 'invalid-credential', '아이디 또는 비밀번호가 맞지 않습니다.');
    return { ...tokens, me: profileOut(p) };
  });

  on('POST', 'auth/refresh', async (ctx) => {
    if (!str(ctx.body.refreshToken, 8192) || !ctx.body.refreshToken) throw new ApiError(401, 'session-expired', '다시 로그인해 주세요.');
    return idp.refresh(ctx.body.refreshToken);
  });

  // 로그아웃: 이 기기의 로그인 유지 토큰을 폐기
  on('POST', 'auth/logout', async (ctx) => {
    const t = ctx.body.refreshToken;
    if (str(t, 8192) && t) await idp.revoke(t).catch(() => {});
    return { ok: true };
  });

  // 비밀번호 찾기 1단계: 가입한 휴대폰으로 인증번호(있는 아이디인지는 알려 주지 않음)
  on('POST', 'auth/forgot', async (ctx) => {
    const username = String(ctx.body.username || '').trim().toLowerCase();
    if (!USERNAME_RE.test(username)) throw bad('아이디를 확인해 주세요.');
    await limit(`reset#${username}`, 5);
    await limit('sms#all', smsMax());
    const r = await idp.forgot(username).catch((e) => { if (e instanceof ApiError && e.status === 429) throw e; return null; });
    return { sent: true, destination: r?.destination || '' };
  });
  // 2단계: 인증번호와 새 비밀번호
  on('POST', 'auth/reset', async (ctx) => {
    const username = String(ctx.body.username || '').trim().toLowerCase();
    const code = String(ctx.body.code || '');
    const pw = ctx.body.password;
    if (!USERNAME_RE.test(username) || !/^[0-9]{6}$/.test(code)) throw bad('아이디와 인증번호 6자리를 확인해 주세요.');
    checkPassword(pw, username);
    await idp.confirmForgot(username, code, pw);
    return { ok: true };
  });

  // 아이디 찾기: 휴대폰 인증번호를 확인한 뒤에만 아이디를 알려 줌
  on('POST', 'auth/find-id/start', async (ctx) => {
    const phone = String(ctx.body.phone || '');
    if (!PHONE_RE.test(phone)) throw bad('휴대폰 번호를 확인해 주세요.');
    const e164 = toE164(phone);
    await limit(`sms#${e164}`, 5);
    await limit('sms#all', smsMax());
    const code = env.demo ? '123456' : String(100000 + (globalThis.crypto.getRandomValues(new Uint32Array(1))[0] % 900000));
    await store.put({ pk: `OTP#findid#${e164}`, sk: 'OTP', hash: await sha256(`${e164}:${code}`), tries: 0, exp: now() + 5 * 60000, ttl: Math.floor(now() / 1000) + 3600 });
    await sms.send(e164, `[태산입시] 아이디 찾기 인증번호는 ${code} 입니다`);
    return { sent: true };
  });
  on('POST', 'auth/find-id/confirm', async (ctx) => {
    const phone = String(ctx.body.phone || '');
    const code = String(ctx.body.code || '');
    if (!PHONE_RE.test(phone) || !/^[0-9]{6}$/.test(code)) throw bad('휴대폰 번호와 인증번호 6자리를 확인해 주세요.');
    const e164 = toE164(phone);
    const otp = await store.get(`OTP#findid#${e164}`, 'OTP');
    const wrong = () => new ApiError(400, 'invalid-code', '인증번호가 맞지 않거나 시간이 지났어요.');
    if (!otp || otp.exp < now() || otp.tries >= 5) throw wrong();
    if (otp.hash !== await sha256(`${e164}:${code}`)) {
      await store.update(`OTP#findid#${e164}`, 'OTP', { add: { tries: 1 } }).catch(() => {});
      throw wrong();
    }
    await store.del(`OTP#findid#${e164}`, 'OTP');
    const ph = await store.get(`PHONE#${e164}`, 'PHONE');
    const prof = ph ? await store.get(`U#${ph.uid}`, 'PROFILE') : null;
    return { username: prof?.username || null, createdAt: prof?.createdAt || null };
  });

  on('POST', 'auth/password', async (ctx) => {
    const u = await user(ctx);
    const { oldPassword, newPassword } = ctx.body;
    checkPassword(newPassword, u.username);
    await idp.login(u.username, String(oldPassword || '')); // 현재 비밀번호 확인
    await idp.setPassword(u.username, newPassword);
    return { ok: true };
  });

  on('GET', 'me', async (ctx) => profileOut(await user(ctx)));

  // 탈퇴: 회원 정보·로그인 계정 삭제(쓴 글은 남음)
  on('DELETE', 'me', async (ctx) => {
    const u = await user(ctx);
    await idp.login(u.username, String(ctx.body?.password || ''));
    const priv = await store.get(`U#${u.uid}`, 'PRIVATE');
    const mine = await store.query({ pk: `U#${u.uid}`, limit: 5000 });
    const keys = [...mine.map((x) => [x.pk, x.sk]), [`NICK#${u.nickname}`, 'NICK']];
    if (ctx.auth.phone) keys.push([`PHONE#${ctx.auth.phone}`, 'PHONE']);
    else if (priv?.phone) keys.push([`PHONE#${toE164(priv.phone)}`, 'PHONE']);
    await store.delMany(keys);
    await idp.remove(u.username);
    return { ok: true };
  });

  /* ----- 회원(관리자) ----- */
  on('GET', 'users', async (ctx) => {
    await admin(ctx);
    const list = (await store.query({ index: 'gsi2', pk: 'USERS', desc: true, limit: 1000 })).map(clean);
    if (ctx.query.private) {
      const privs = await store.getMany(list.map((u) => [`U#${u.uid}`, 'PRIVATE']));
      list.forEach((u, i) => { u.priv = clean(privs[i]) || null; });
      await audit(await me(ctx), 'list-private', 'members', list.length);
    }
    return list.map((u) => ({ ...u, id: u.uid }));
  });

  on('GET', 'users/:uid', async (ctx, { uid }) => {
    const u = await user(ctx);
    const p = await store.get(`U#${uid}`, 'PROFILE');
    if (!p) throw E.notFound('회원을 찾을 수 없습니다.');
    const out = { ...profileOut(p), id: p.uid };
    if (ctx.query.private) {
      if (u.uid !== uid && !isAdmin(u)) throw E.forbidden();
      out.priv = clean(await store.get(`U#${uid}`, 'PRIVATE'));
      if (u.uid !== uid) await audit(u, 'view-private', uid);
    }
    return out;
  });

  on('GET', 'users/:uid/private', async (ctx, { uid }) => {
    const u = await user(ctx);
    if (u.uid !== uid && !isAdmin(u)) throw E.forbidden();
    if (u.uid !== uid) await audit(u, 'view-private', uid);
    return clean(await store.get(`U#${uid}`, 'PRIVATE')) || null;
  });

  on('PATCH', 'users/:uid', async (ctx, { uid }) => {
    const u = await admin(ctx);
    if (u.uid === uid) throw bad('내 계정의 권한·상태는 바꿀 수 없습니다.');
    const set = {};
    if ('role' in ctx.body) { if (!['member', 'admin'].includes(ctx.body.role)) throw bad('권한 값이 올바르지 않습니다.'); set.role = ctx.body.role; }
    if ('banned' in ctx.body) { if (typeof ctx.body.banned !== 'boolean') throw bad('정지 값이 올바르지 않습니다.'); set.banned = ctx.body.banned; }
    if (!Object.keys(set).length) throw bad('바꿀 내용이 없습니다.');
    try { await store.update(`U#${uid}`, 'PROFILE', { set }); } catch (e) { if (e instanceof Conflict) throw E.notFound('회원을 찾을 수 없습니다.'); throw e; }
    await audit(u, `set-${Object.keys(set).join(',')}`, uid);
    return { ok: true };
  });

  on('GET', 'audit', async (ctx) => {
    await admin(ctx);
    const month = /^\d{4}-\d{2}$/.test(ctx.query.month || '') ? ctx.query.month : new Date(now() + 9 * 3600000).toISOString().slice(0, 7);
    return (await store.query({ pk: `AUDIT#${month}`, desc: true, limit: 500 })).map(clean);
  });

  /* ----- 글 ----- */
  const visible = (p) => p.approved === true && !p.hidden;
  const canSee = (p, u) => visible(p) || p.uid === u?.uid || isAdmin(u);
  // 목록용 색인(공개 글만 게시판·전체·말머리 목록에 들어감)
  function indexPatch(p) {
    const sk = `${pad(p.createdAt)}#${p.id}`;
    const set = { gsi1pk: visible(p) ? `B#${p.board}` : p.hidden ? 'HIDDEN' : 'PENDING', gsi1sk: sk, gsi3pk: `U#${p.uid}`, gsi3sk: sk };
    const remove = [];
    if (visible(p)) Object.assign(set, { gsi2pk: 'ALL', gsi2sk: sk, gsi4pk: `C#${p.board}#${p.category}`, gsi4sk: sk });
    else remove.push('gsi2pk', 'gsi2sk', 'gsi4pk', 'gsi4sk');
    return { set, remove };
  }
  const excerpt = (body) => String(body || '').replace(/\s+/g, ' ').trim().slice(0, 200);
  // 비회원에게는 제목 목록만
  const guestRow = (p) => ({ id: p.id, board: p.board, category: p.category, title: p.title, nickname: p.nickname, grade: p.grade, createdAt: p.createdAt,
    likeCount: p.likeCount, commentCount: p.commentCount, viewCount: p.viewCount || 0, pinned: !!p.pinned, approved: p.approved, imageCount: p.imageCount || 0, fileCount: p.fileCount || 0, hasPoll: !!p.hasPoll, status: p.status });

  async function getMeta(id) {
    if (!str(id, 40)) throw E.notFound('글을 찾을 수 없습니다.');
    return clean(await store.get(`P#${id}`, 'META'));
  }
  async function seePost(ctx, id) {
    const u = await user(ctx);
    const p = await getMeta(id);
    if (!p || !canSee(p, u)) throw E.notFound('삭제되었거나 볼 수 없는 글입니다.');
    return { p, u };
  }

  // 첨부(사진·파일) 확인: 내가 올린 파일만, 저장된 정보로 바꿔 씀
  async function attachments(list, max, u, imagesOnly) {
    if (!Array.isArray(list) || list.length > max) throw bad(`첨부는 ${max}개까지입니다.`);
    if (!list.length) return [];
    const ids = list.map((x) => String(x?.id || ''));
    if (new Set(ids).size !== ids.length) throw bad('같은 파일이 두 번 들어 있습니다.');
    const items = await store.getMany(ids.map((id) => [`F#${id}`, 'F']));
    return items.map((f, i) => {
      if (!f || (f.uid !== u.uid && !isAdmin(u))) throw bad(`첨부 파일을 찾을 수 없습니다: ${list[i]?.name || ids[i]}`);
      if (imagesOnly && f.type !== 'image/jpeg') throw bad('사진은 JPEG만 올릴 수 있습니다.');
      return { id: f.id, name: f.name, type: f.type, size: f.size };
    });
  }

  function checkContent(b, board) {
    if (!nonEmpty(b.category, 20)) throw bad('말머리를 골라 주세요.');
    if (!nonEmpty(b.title, LIMIT.title)) throw bad('제목을 입력해 주세요(100자까지).');
    if (!str(b.body ?? '', LIMIT.body)) throw bad('내용은 10,000자까지 쓸 수 있습니다.');
    if (!str(b.source ?? '', LIMIT.source)) throw bad('출처는 200자까지 쓸 수 있습니다.');
    if (board === 'data' && !nonEmpty(b.source, LIMIT.source)) throw bad('자료실 글은 출처를 적어야 합니다.');
    if (!jpeg(b.thumb ?? '', LIMIT.thumb)) throw bad('미리보기 사진이 올바르지 않습니다.');
  }

  // 투표: 보기 2~6개, 기간 1~30일. 글을 올린 뒤에는 바꿀 수 없음
  function checkPoll(x, board) {
    if (x == null) return null;
    if (board === 'data') throw bad('자료실 글에는 투표를 넣을 수 없습니다.');
    const options = Array.isArray(x.options) ? x.options.map((o) => (typeof o === 'string' ? o.trim() : '')) : [];
    if (options.length < 2 || options.length > LIMIT.pollOptions) throw bad(`투표 보기는 2~${LIMIT.pollOptions}개로 넣어 주세요.`);
    if (options.some((o) => !o || o.length > LIMIT.pollOption)) throw bad(`투표 보기는 1~${LIMIT.pollOption}자로 적어 주세요.`);
    if (new Set(options).size !== options.length) throw bad('같은 보기가 두 번 들어 있습니다.');
    const days = Number(x.days);
    if (!Number.isInteger(days) || days < 1 || days > 30) throw bad('투표 기간은 1~30일입니다.');
    return { options, multi: x.multi === true, endsAt: now() + days * 86400000 };
  }
  // 결과는 투표한 사람·마감 뒤·글쓴이·관리자에게만
  async function pollOut(p, poll, u) {
    const [tally, mine] = await store.getMany([[`P#${p.id}`, 'POLL'], [`P#${p.id}`, `V#${u.uid}`]]);
    const closed = now() >= poll.endsAt;
    const show = !!mine || closed || p.uid === u.uid || isAdmin(u);
    return { options: poll.options, multi: !!poll.multi, endsAt: poll.endsAt, closed, voters: tally?.voters || 0,
      counts: show ? poll.options.map((_, i) => tally?.[`v${i}`] || 0) : null, mine: mine ? mine.choices : null };
  }

  async function deleteFiles(list, u) {
    const ids = [...new Set(list.map((f) => f.id))];
    if (!ids.length) return;
    const items = await store.getMany(ids.map((id) => [`F#${id}`, 'F']));
    for (const f of items) {
      if (!f || (f.uid !== u.uid && !isAdmin(u))) continue;
      await files.remove(f.key).catch(() => {});
      await store.del(`F#${f.id}`, 'F').catch(() => {});
    }
  }

  async function notify(to, from, type, post, text) {
    if (!to || to === from.uid) return;
    const t = now(), id = newId(t);
    await store.put({ pk: `U#${to}`, sk: `N#${id}`, id, to, from: from.uid, fromName: from.nickname, type, postId: post.id,
      text: String(text || '').slice(0, 80), read: false, createdAt: t, ttl: Math.floor(t / 1000) + 180 * 86400 }).catch(() => {});
  }

  on('GET', 'posts', async (ctx) => {
    const u = await me(ctx);
    const q = ctx.query;
    const lim = Math.min(500, Math.max(1, parseInt(q.limit, 10) || 20));
    let opts, ownOrAdmin = false;
    if (q.state === 'pending' || q.state === 'hidden') {
      if (!isAdmin(u)) throw E.admin();
      opts = { index: 'gsi1', pk: q.state === 'pending' ? 'PENDING' : 'HIDDEN' };
      ownOrAdmin = true;
    } else if (q.uid) {
      if (!u) throw E.login();
      opts = { index: 'gsi3', pk: `U#${q.uid}` };
      ownOrAdmin = q.uid === u.uid || isAdmin(u);
    } else if (q.board && q.category) {
      opts = { index: 'gsi4', pk: `C#${q.board}#${q.category}` };
    } else if (q.board) {
      opts = { index: 'gsi1', pk: `B#${q.board}` };
    } else {
      opts = { index: 'gsi2', pk: 'ALL' };
    }
    const filters = [];
    if (q.status) filters.push((p) => p.status === q.status);
    if (q.grade) filters.push((p) => p.grade === q.grade);
    if (q.pinned) filters.push((p) => !!p.pinned);
    if (!ownOrAdmin) filters.push(visible);
    let rows = (await store.query({ ...opts, desc: true, limit: filters.length > 1 ? Math.min(1000, lim * 3) : lim, skLt: q.before || undefined })).map(clean);
    const blocked = await blocksOf(ctx, u);
    if (blocked.size && !ownOrAdmin) filters.push((p) => !blocked.has(p.uid));
    rows = rows.filter((p) => filters.every((f) => f(p))).slice(0, lim);
    return u ? rows : rows.map(guestRow);
  });

  on('GET', 'posts/:id', async (ctx, { id }) => {
    const { p, u } = await seePost(ctx, id);
    const [body, like, mark] = await store.getMany([[`P#${id}`, 'BODY'], [`P#${id}`, `L#${u.uid}`], [`U#${u.uid}`, `BM#${id}`]]);
    let meta = p;
    if (ctx.query.view) meta = clean(await store.update(`P#${id}`, 'META', { add: { viewCount: 1 } }).catch(() => p));
    // 같은 게시판의 이전 글(더 오래된 글)·다음 글(더 새 글)
    let prev = null, next = null;
    if (visible(p)) {
      const sk = `${pad(p.createdAt)}#${p.id}`;
      const blocked = await blocksOf(ctx, u);
      const pick = (l) => { const x = l.find((r) => !blocked.has(r.uid)); return x ? { id: x.id, title: x.title, createdAt: x.createdAt } : null; };
      [prev, next] = await Promise.all([
        store.query({ index: 'gsi1', pk: `B#${p.board}`, skLt: sk, desc: true, limit: 5 }).then(pick),
        store.query({ index: 'gsi1', pk: `B#${p.board}`, skGt: sk, limit: 5 }).then(pick),
      ]);
    }
    const b = clean(body) || {};
    const poll = b.poll ? await pollOut(p, b.poll, u) : undefined;
    return { ...meta, ...b, poll, id, liked: !!like, bookmarked: !!mark, prev, next };
  });

  on('POST', 'posts', async (ctx) => {
    const u = await active(ctx);
    const b = ctx.body;
    if (!BOARDS.includes(b.board)) throw bad('게시판을 골라 주세요.');
    if (b.board === 'notice' && !isAdmin(u)) throw E.forbidden('공지는 관리자만 쓸 수 있습니다.');
    if (b.board === 'qna' && !env.qnaOpen && !isAdmin(u)) throw E.forbidden('문제풀이 게시판은 아직 열리지 않았습니다.');
    if (b.pinned && !isAdmin(u)) throw E.forbidden('공지 고정은 관리자만 할 수 있습니다.');
    checkContent(b, b.board);
    const poll = checkPoll(b.poll, b.board);
    const images = await attachments(b.images || [], LIMIT.images, u, true);
    const fls = await attachments(b.files || [], LIMIT.files, u, false);
    const t = now(), id = newId(t);
    const meta = {
      id, board: b.board, category: b.category, title: b.title.trim(), uid: u.uid, nickname: u.nickname, grade: u.grade, createdAt: t,
      likeCount: 0, commentCount: 0, viewCount: 0, pinned: !!b.pinned, approved: b.board !== 'data' || isAdmin(u), hidden: false,
      status: b.board === 'qna' ? 'open' : '', acceptedCommentId: '', imageCount: images.length, fileCount: fls.length, excerpt: excerpt(b.body), hasPoll: !!poll,
    };
    const ix = indexPatch(meta);
    await store.transact([
      { put: { pk: `P#${id}`, sk: 'META', ...meta, ...ix.set }, ifNotExists: true },
      { put: { pk: `P#${id}`, sk: 'BODY', body: b.body || '', thumb: b.thumb || '', images, files: fls, source: b.source || '', ...(poll ? { poll } : {}) } },
    ]);
    return { id };
  });

  on('PATCH', 'posts/:id', async (ctx, { id }) => {
    const u = await active(ctx);
    const p = await getMeta(id);
    if (!p) throw E.notFound('글을 찾을 수 없습니다.');
    if (p.uid !== u.uid) throw E.forbidden('직접 쓴 글만 수정할 수 있습니다.');
    const b = ctx.body;
    checkContent(b, p.board);
    const old = clean(await store.get(`P#${id}`, 'BODY')) || {};
    const images = await attachments(b.images || [], LIMIT.images, u, true);
    const fls = await attachments(b.files || [], LIMIT.files, u, false);
    const keep = new Set([...images, ...fls].map((f) => f.id));
    const removed = [...(old.images || []), ...(old.files || [])].filter((f) => !keep.has(f.id));
    const next = { ...p, title: b.title.trim(), category: b.category, approved: p.board !== 'data' || (isAdmin(u) && p.approved) };
    const ix = indexPatch(next);
    await store.transact([
      { update: { pk: `P#${id}`, sk: 'META', patch: { set: { title: next.title, category: next.category, approved: next.approved, imageCount: images.length, fileCount: fls.length, excerpt: excerpt(b.body), updatedAt: now(), ...ix.set }, remove: ix.remove } }, ifExists: true },
      { put: { pk: `P#${id}`, sk: 'BODY', body: b.body || '', thumb: b.thumb || '', images, files: fls, source: b.source || '', ...(old.poll ? { poll: old.poll } : {}) } },
    ]);
    await deleteFiles(removed, u);
    return { ok: true };
  });

  async function removePost(p, u) {
    const body = clean(await store.get(`P#${p.id}`, 'BODY')) || {};
    const all = await store.query({ pk: `P#${p.id}`, limit: 5000 });
    await store.delMany(all.map((x) => [x.pk, x.sk]));
    await deleteFiles([...(body.images || []), ...(body.files || [])], u);
  }

  on('DELETE', 'posts/:id', async (ctx, { id }) => {
    const u = await user(ctx);
    const p = await getMeta(id);
    if (!p) return { ok: true };
    if (p.uid !== u.uid && !isAdmin(u)) throw E.forbidden('직접 쓴 글만 삭제할 수 있습니다.');
    await removePost(p, u);
    return { ok: true };
  });

  // 관리자: 자료 승인(ok=false면 삭제하고 알림)
  on('POST', 'posts/:id/approve', async (ctx, { id }) => {
    const u = await admin(ctx);
    const p = await getMeta(id);
    if (!p) throw E.notFound('글을 찾을 수 없습니다.');
    if (ctx.body.ok === false) {
      await removePost(p, u);
      await notify(p.uid, u, 'rejected', p, p.title);
    } else {
      const ix = indexPatch({ ...p, approved: true, hidden: false });
      await store.update(`P#${id}`, 'META', { set: { approved: true, hidden: false, ...ix.set }, remove: ix.remove });
      await notify(p.uid, u, 'approved', p, p.title);
    }
    return { ok: true };
  });

  // 관리자: 숨김/다시 공개
  on('POST', 'posts/:id/hide', async (ctx, { id }) => {
    await admin(ctx);
    const p = await getMeta(id);
    if (!p) throw E.notFound('글을 찾을 수 없습니다.');
    const hidden = ctx.body.hidden !== false;
    const ix = indexPatch({ ...p, approved: !hidden, hidden });
    await store.update(`P#${id}`, 'META', { set: { approved: !hidden, hidden, ...ix.set }, remove: ix.remove });
    return { ok: true };
  });

  on('POST', 'posts/:id/like', async (ctx, { id }) => {
    const u = await active(ctx);
    await seePost(ctx, id);
    const want = ctx.body.on !== false;
    try {
      await store.transact(want
        ? [{ put: { pk: `P#${id}`, sk: `L#${u.uid}`, at: now() }, ifNotExists: true }, { update: { pk: `P#${id}`, sk: 'META', patch: { add: { likeCount: 1 } } }, ifExists: true }]
        : [{ del: { pk: `P#${id}`, sk: `L#${u.uid}` }, ifExists: true }, { update: { pk: `P#${id}`, sk: 'META', patch: { add: { likeCount: -1 } } }, ifExists: true }]);
    } catch (e) { if (!(e instanceof Conflict)) throw e; } // 이미 누름/이미 취소
    const p = await getMeta(id);
    return { liked: want, likeCount: p?.likeCount || 0 };
  });

  // 투표 참여(한 사람 한 번, 바꿀 수 없음)
  on('POST', 'posts/:id/vote', async (ctx, { id }) => {
    const u = await active(ctx);
    const { p } = await seePost(ctx, id);
    const poll = (clean(await store.get(`P#${id}`, 'BODY')) || {}).poll;
    if (!poll) throw E.notFound('투표가 없는 글입니다.');
    if (now() >= poll.endsAt) throw bad('투표가 끝났습니다.');
    const raw = Array.isArray(ctx.body.choices) ? ctx.body.choices : [];
    const choices = [...new Set(raw)].filter((i) => Number.isInteger(i) && i >= 0 && i < poll.options.length).sort((a, b) => a - b);
    if (!choices.length || choices.length !== raw.length) throw bad('보기를 골라 주세요.');
    if (!poll.multi && choices.length > 1) throw bad('하나만 고를 수 있습니다.');
    const add = { voters: 1 };
    choices.forEach((i) => { add[`v${i}`] = 1; });
    try {
      await store.transact([
        { put: { pk: `P#${id}`, sk: `V#${u.uid}`, choices, at: now() }, ifNotExists: true },
        { update: { pk: `P#${id}`, sk: 'POLL', patch: { add } }, ifExists: false },
      ]);
    } catch (e) {
      if (e instanceof Conflict) throw new ApiError(409, 'voted', '이미 투표했습니다.');
      throw e;
    }
    return pollOut(p, poll, u);
  });

  // 스크랩(나만 보는 저장)
  on('POST', 'posts/:id/bookmark', async (ctx, { id }) => {
    const { u } = await seePost(ctx, id);
    if (ctx.body.on === false) await store.del(`U#${u.uid}`, `BM#${id}`);
    else {
      const n = (await store.query({ pk: `U#${u.uid}`, skBegins: 'BM#', limit: 1001 })).length;
      if (n >= 1000) throw bad('스크랩은 1,000개까지 할 수 있습니다.');
      await store.put({ pk: `U#${u.uid}`, sk: `BM#${id}`, postId: id, at: now() });
    }
    return { bookmarked: ctx.body.on !== false };
  });
  on('GET', 'me/bookmarks', async (ctx) => {
    const u = await user(ctx);
    const marks = (await store.query({ pk: `U#${u.uid}`, skBegins: 'BM#', limit: 1000 })).sort((a, b) => b.at - a.at);
    const metas = await store.getMany(marks.map((m) => [`P#${m.postId}`, 'META']));
    return metas.map((m, i) => (m && canSee(m, u) ? { ...clean(m), bookmarkedAt: marks[i].at } : null)).filter(Boolean);
  });

  // 내가 쓴 댓글
  on('GET', 'me/comments', async (ctx) => {
    const u = await user(ctx);
    return (await store.query({ index: 'gsi3', pk: `UC#${u.uid}`, desc: true, limit: 100 })).map(clean)
      .map((c) => ({ id: c.id, postId: c.postId, postTitle: c.postTitle, body: c.body, createdAt: c.createdAt, likeCount: c.likeCount }));
  });

  // 회원 차단: 그 회원의 글과 댓글이 나에게 보이지 않음
  on('GET', 'me/blocks', async (ctx) => {
    const u = await user(ctx);
    return (await store.query({ pk: `U#${u.uid}`, skBegins: 'BLK#', limit: 500 })).map(clean);
  });
  on('POST', 'me/blocks', async (ctx) => {
    const u = await user(ctx);
    const uid = String(ctx.body.uid || '');
    if (!uid || !str(uid, 128) || uid === u.uid) throw bad('차단할 회원이 올바르지 않습니다.');
    if (ctx.body.on === false) { await store.del(`U#${u.uid}`, `BLK#${uid}`); return { blocked: false }; }
    const t = await store.get(`U#${uid}`, 'PROFILE');
    if (!t) throw E.notFound('회원을 찾을 수 없습니다.');
    if (isAdmin(t)) throw bad('운영진은 차단할 수 없습니다.');
    await store.put({ pk: `U#${u.uid}`, sk: `BLK#${uid}`, uid, nickname: t.nickname, at: now() });
    return { blocked: true };
  });

  // 문제풀이: 글쓴이가 답변 채택(한 번만)
  on('POST', 'posts/:id/accept', async (ctx, { id }) => {
    const u = await active(ctx);
    const p = await getMeta(id);
    if (!p || p.uid !== u.uid) throw E.forbidden('글쓴이만 채택할 수 있습니다.');
    if (p.board !== 'qna') throw bad('문제풀이 글에서만 채택할 수 있습니다.');
    const cid = String(ctx.body.commentId || '');
    const c = str(cid, 40) && cid ? await store.get(`P#${id}`, `C#${cid}`) : null;
    if (!c) throw E.notFound('댓글을 찾을 수 없습니다.');
    try {
      await store.update(`P#${id}`, 'META', { set: { acceptedCommentId: cid, status: 'solved' } }, { ifEq: { acceptedCommentId: '' } });
    } catch (e) { if (e instanceof Conflict) throw bad('이미 채택한 답변이 있습니다.'); throw e; }
    await notify(c.uid, u, 'accepted', p, p.title);
    return { ok: true };
  });

  /* ----- 댓글 ----- */
  on('GET', 'posts/:id/comments', async (ctx, { id }) => {
    const { u } = await seePost(ctx, id);
    const [list, mine] = await Promise.all([
      store.query({ pk: `P#${id}`, skBegins: 'C#', limit: 2000 }),
      store.query({ pk: `P#${id}`, skBegins: `CL#${u.uid}#`, limit: 2000 }),
    ]);
    const liked = new Set(mine.map((x) => x.sk.slice(`CL#${u.uid}#`.length)));
    const blocked = await blocksOf(ctx, u);
    return list.map((c) => {
      const out = { ...clean(c), liked: liked.has(c.id), parentId: c.parentId || '' };
      if (blocked.has(c.uid) && !c.deleted) Object.assign(out, { body: '', image: '', blocked: true });
      return out;
    });
  });

  on('POST', 'posts/:id/comments', async (ctx, { id }) => {
    const u = await active(ctx);
    const { p } = await seePost(ctx, id);
    const body = String(ctx.body.body ?? '');
    const image = ctx.body.image ?? '';
    if (!nonEmpty(body, LIMIT.comment)) throw bad('댓글을 입력해 주세요(3,000자까지).');
    if (!jpeg(image, LIMIT.commentImage)) throw bad('댓글 사진이 너무 크거나 올바르지 않습니다.');
    const parentId = String(ctx.body.parentId || '');
    let parent = null;
    if (parentId) {
      parent = str(parentId, 40) ? await store.get(`P#${id}`, `C#${parentId}`) : null;
      if (!parent || parent.deleted) throw E.notFound('답글을 달 댓글을 찾을 수 없습니다.');
      if (parent.parentId) throw bad('답글에는 다시 답글을 달 수 없습니다.');
    }
    const t = now(), cid = newId(t);
    await store.transact([
      { put: { pk: `P#${id}`, sk: `C#${cid}`, id: cid, uid: u.uid, nickname: u.nickname, grade: u.grade, body, image, createdAt: t, likeCount: 0, parentId,
        postId: id, postTitle: p.title.slice(0, 100), gsi3pk: `UC#${u.uid}`, gsi3sk: `${pad(t)}#${cid}` }, ifNotExists: true },
      { update: { pk: `P#${id}`, sk: 'META', patch: { add: { commentCount: 1 } } }, ifExists: true },
    ]);
    if (parent) await notify(parent.uid, u, 'reply', p, body);
    if (!parent || parent.uid !== p.uid) await notify(p.uid, u, 'comment', p, body);
    return { id: cid };
  });

  on('PATCH', 'posts/:id/comments/:cid', async (ctx, { id, cid }) => {
    const u = await active(ctx);
    const c = str(cid, 40) ? await store.get(`P#${id}`, `C#${cid}`) : null;
    if (!c || c.deleted) throw E.notFound('댓글을 찾을 수 없습니다.');
    if (c.uid !== u.uid) throw E.forbidden('직접 쓴 댓글만 고칠 수 있습니다.');
    const body = String(ctx.body.body ?? '');
    if (!nonEmpty(body, LIMIT.comment)) throw bad('댓글을 입력해 주세요(3,000자까지).');
    await store.update(`P#${id}`, `C#${cid}`, { set: { body, editedAt: now() } });
    return { ok: true };
  });

  on('DELETE', 'posts/:id/comments/:cid', async (ctx, { id, cid }) => {
    const u = await user(ctx);
    const c = str(cid, 40) ? await store.get(`P#${id}`, `C#${cid}`) : null;
    if (!c || c.deleted) return { ok: true };
    if (c.uid !== u.uid && !isAdmin(u)) throw E.forbidden('직접 쓴 댓글만 삭제할 수 있습니다.');
    const hasReplies = !c.parentId && (await store.query({ pk: `P#${id}`, skBegins: 'C#', limit: 2000 })).some((x) => x.parentId === cid && !x.deleted);
    if (hasReplies) {
      await store.transact([
        { update: { pk: `P#${id}`, sk: `C#${cid}`, patch: { set: { deleted: true, body: '', image: '' }, remove: ['gsi3pk', 'gsi3sk'] } }, ifExists: true },
        { update: { pk: `P#${id}`, sk: 'META', patch: { add: { commentCount: -1 } } }, ifExists: true },
      ]).catch((e) => { if (!(e instanceof Conflict)) throw e; });
      return { ok: true };
    }
    try {
      await store.transact([
        { del: { pk: `P#${id}`, sk: `C#${cid}` }, ifExists: true },
        { update: { pk: `P#${id}`, sk: 'META', patch: { add: { commentCount: -1 } } }, ifExists: true },
      ]);
    } catch (e) { if (!(e instanceof Conflict)) throw e; await store.del(`P#${id}`, `C#${cid}`).catch(() => {}); }
    const likes = (await store.query({ pk: `P#${id}`, skBegins: 'CL#', limit: 5000 })).filter((x) => x.sk.endsWith(`#${cid}`));
    if (likes.length) await store.delMany(likes.map((x) => [x.pk, x.sk]));
    return { ok: true };
  });

  on('POST', 'posts/:id/comments/:cid/like', async (ctx, { id, cid }) => {
    const u = await active(ctx);
    await seePost(ctx, id);
    if (!str(cid, 40) || !(await store.get(`P#${id}`, `C#${cid}`))) throw E.notFound('댓글을 찾을 수 없습니다.');
    const want = ctx.body.on !== false;
    const key = { pk: `P#${id}`, sk: `CL#${u.uid}#${cid}` };
    try {
      await store.transact(want
        ? [{ put: { ...key, at: now() }, ifNotExists: true }, { update: { pk: `P#${id}`, sk: `C#${cid}`, patch: { add: { likeCount: 1 } } }, ifExists: true }]
        : [{ del: key, ifExists: true }, { update: { pk: `P#${id}`, sk: `C#${cid}`, patch: { add: { likeCount: -1 } } }, ifExists: true }]);
    } catch (e) { if (!(e instanceof Conflict)) throw e; }
    return { liked: want };
  });

  /* ----- 알림 ----- */
  on('GET', 'notifications', async (ctx) => {
    const u = await user(ctx);
    return (await store.query({ pk: `U#${u.uid}`, skBegins: 'N#', desc: true, limit: 50 })).map(clean);
  });
  on('GET', 'notifications/unread', async (ctx) => {
    const u = await user(ctx);
    const list = await store.query({ pk: `U#${u.uid}`, skBegins: 'N#', desc: true, limit: 30 });
    return { unread: list.some((n) => !n.read) };
  });
  on('POST', 'notifications/read', async (ctx) => {
    const u = await user(ctx);
    const ids = Array.isArray(ctx.body.ids) ? ctx.body.ids.slice(0, 100) : [];
    for (const id of ids) if (str(id, 40)) await store.update(`U#${u.uid}`, `N#${id}`, { set: { read: true } }).catch(() => {});
    return { ok: true };
  });

  /* ----- 신고 ----- */
  on('POST', 'reports', async (ctx) => {
    const u = await active(ctx);
    const { postId, commentId = '', reason } = ctx.body;
    if (!nonEmpty(reason, 300)) throw bad('신고 사유를 골라 주세요.');
    const p = await getMeta(String(postId || ''));
    if (!p) throw E.notFound('글을 찾을 수 없습니다.');
    let target = p.title;
    if (commentId) {
      const c = str(commentId, 40) ? await store.get(`P#${p.id}`, `C#${commentId}`) : null;
      if (!c) throw E.notFound('댓글을 찾을 수 없습니다.');
      target = c.body;
    }
    await limit(`report#${u.uid}`, 30);
    const t = now(), id = newId(t);
    await store.put({ pk: `R#${id}`, sk: 'R', id, uid: u.uid, postId: p.id, postTitle: p.title.slice(0, 100), commentId, target: target.slice(0, 200),
      reason, status: 'open', createdAt: t, gsi1pk: 'REPORT#open', gsi1sk: `${pad(t)}#${id}` });
    return { ok: true };
  });
  on('GET', 'reports', async (ctx) => {
    await admin(ctx);
    return (await store.query({ index: 'gsi1', pk: 'REPORT#open', desc: true, limit: 200 })).map(clean);
  });
  on('POST', 'reports/:id/done', async (ctx, { id }) => {
    await admin(ctx);
    const r = await store.get(`R#${id}`, 'R');
    if (!r) throw E.notFound('신고를 찾을 수 없습니다.');
    await store.update(`R#${id}`, 'R', { set: { status: 'done', gsi1pk: 'REPORT#done', doneAt: now(), ttl: Math.floor(now() / 1000) + 366 * 86400 } });
    return { ok: true };
  });

  /* ----- 배너(표지·상단 안내) ----- */
  on('GET', 'banners', async () => (await store.query({ pk: 'BANNER', limit: 100 })).map(clean).sort((a, b) => b.createdAt - a.createdAt));
  on('PUT', 'banners/cover', async (ctx) => {
    await admin(ctx);
    const { text = '', sub = '', image = '' } = ctx.body;
    if (!str(text, 30) || !str(sub, 100)) throw bad('제목은 30자, 설명은 100자까지입니다.');
    if (!jpeg(image, LIMIT.coverImage)) throw bad('배경 사진이 너무 큽니다. 더 작은 사진을 골라 주세요.');
    await store.put({ pk: 'BANNER', sk: 'cover', id: 'cover', kind: 'cover', image, text, sub, link: '', createdAt: now() });
    return { ok: true };
  });
  on('POST', 'banners', async (ctx) => {
    await admin(ctx);
    const { kind, image = '', text = '', link = '', date = '' } = ctx.body;
    if (!['image', 'text', 'event'].includes(kind)) throw bad('배너 종류가 올바르지 않습니다.');
    if (!str(text, 100) || !jpeg(image, LIMIT.bannerImage)) throw bad('배너 내용이 올바르지 않습니다.');
    if (kind !== 'image' && !nonEmpty(text, 100)) throw bad('내용을 입력해 주세요.');
    // 입시 일정: 날짜(YYYY-MM-DD)와 이름
    if (kind === 'event' && !(/^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(`${date}T00:00:00+09:00`)))) throw bad('날짜를 확인해 주세요.');
    if (!str(link, 300) || (link && !/^(#\/|https:\/\/)/.test(link))) throw bad('링크는 https:// 또는 #/ 로 시작해야 합니다.');
    const t = now(), id = newId(t);
    await store.put({ pk: 'BANNER', sk: id, id, kind, image, text, sub: '', link, date: kind === 'event' ? date : '', createdAt: t });
    return { id };
  });
  on('DELETE', 'banners/:id', async (ctx, { id }) => {
    await admin(ctx);
    await store.del('BANNER', id);
    return { ok: true };
  });

  /* ----- 파일 ----- */
  on('POST', 'files', async (ctx) => {
    const u = await active(ctx);
    const name = String(ctx.body.name || '').replace(/[\u0000-\u001f\\/]/g, '_').trim().slice(0, 200);
    const type = String(ctx.body.type || 'application/octet-stream').slice(0, 100);
    const size = ctx.body.size;
    if (!name) throw bad('파일 이름이 없습니다.');
    if (!Number.isInteger(size) || size < 1 || size > LIMIT.fileBytes) throw bad(`${name}: 5MB보다 큰 파일은 올릴 수 없습니다.`);
    await limit(`upload#${u.uid}`, 300);
    const t = now(), id = newId(t);
    const key = `u/${u.uid}/${id}`;
    await store.put({ pk: `F#${id}`, sk: 'F', id, uid: u.uid, name, type, size, key, createdAt: t });
    const upload = await files.presignUpload({ key, type, size });
    return { id, name, type, size, upload };
  });

  on('GET', 'files/:id', async (ctx, { id }) => {
    await user(ctx);
    const f = str(id, 40) ? await store.get(`F#${id}`, 'F') : null;
    if (!f) throw E.notFound('파일을 찾을 수 없습니다.');
    const isJpeg = f.type === 'image/jpeg';
    // 사진(JPEG) 외에는 내려받기 전용으로 내보냅니다(브라우저에서 HTML 등이 열리지 않게)
    const url = await files.presignGet({ key: f.key, name: f.name, type: isJpeg ? 'image/jpeg' : 'application/octet-stream', download: !isJpeg || !!ctx.query.download });
    return { url };
  });

  /* ----- 여러 요청 한 번에(GET만) ----- */
  on('POST', 'batch', async (ctx) => {
    const reqs = Array.isArray(ctx.body.requests) ? ctx.body.requests : [];
    if (reqs.length > 50) throw bad('한 번에 50개까지 요청할 수 있습니다.');
    await me(ctx); // 회원 정보는 한 번만 읽기
    const responses = await Promise.all(reqs.map((r) => run({ ...ctx, method: 'GET', path: String(r.path || ''), query: r.query || {}, body: {} }, true)));
    return { responses };
  });

  /* ----- 처리 ----- */
  async function run(ctx, inner = false) {
    try {
      const parts = ctx.path.split('/').filter(Boolean);
      let found = null, methodOk = false;
      for (const r of routes) {
        if (r.parts.length !== parts.length) continue;
        const params = {};
        if (!r.parts.every((s, i) => (s[0] === ':' ? ((params[s.slice(1)] = decodeURIComponent(parts[i])), true) : s === parts[i]))) continue;
        if (r.method !== ctx.method) { methodOk = true; continue; }
        found = { r, params };
        break;
      }
      if (!found) throw methodOk ? new ApiError(405, 'method', '지원하지 않는 요청입니다.') : E.notFound('없는 주소입니다.');
      if (inner && found.r.parts[0] === 'batch') throw bad('batch 안에 batch를 넣을 수 없습니다.');
      const body = await found.r.fn(ctx, found.params);
      return { status: 200, body: body ?? null };
    } catch (e) {
      if (e instanceof ApiError) return { status: e.status, body: { error: e.code, message: e.message } };
      console.error(e);
      return { status: 500, body: { error: 'server', message: '서버에 문제가 생겼습니다. 잠시 후 다시 시도해 주세요.' } };
    }
  }

  return {
    // req: { method, path('/posts/abc'), query, body, token }
    async handle(req) {
      let auth = null;
      if (req.token) {
        auth = await idp.verify(req.token).catch(() => null);
        if (!auth) return { status: 401, body: { error: 'session-expired', message: '로그인 시간이 지났습니다. 다시 로그인해 주세요.' } };
      }
      let body = req.body;
      if (body == null || typeof body !== 'object' || Array.isArray(body)) body = {};
      return run({ method: String(req.method || 'GET').toUpperCase(), path: String(req.path || ''), query: req.query || {}, body, auth });
    },
  };
}

/* ---------------- 메모리 저장소(체험 모드·시험용) ---------------- */
// DynamoDB 저장소(index.mjs)와 같은 모양입니다. onWrite(map)는 쓸 때마다 불립니다(체험 모드에서 브라우저에 저장).
export function createMemoryStore(initial = {}, onWrite) {
  const m = new Map(Object.entries(initial));
  const K = (pk, sk) => `${pk}\u0001${sk}`;
  const copy = (x) => (x == null ? null : structuredClone(x));
  const changed = () => onWrite?.(m);
  const exists = (pk, sk) => m.has(K(pk, sk));

  function applyUpdate(pk, sk, { set = {}, add = {}, remove = [] } = {}, opts = {}) {
    const cur = m.get(K(pk, sk));
    if (!cur && !opts.upsert) throw new Conflict('not exists');
    const item = cur ? { ...cur } : { pk, sk };
    for (const [k, v] of Object.entries(opts.ifEq || {})) if (item[k] !== v) throw new Conflict('ifEq');
    for (const [k, v] of Object.entries(opts.ifBelow || {})) if (item[k] !== undefined && !(item[k] < v)) throw new Conflict('ifBelow');
    for (const [k, v] of Object.entries(set)) if (v !== undefined) item[k] = copy(v);
    for (const [k, v] of Object.entries(add)) item[k] = (item[k] || 0) + v;
    for (const k of remove) delete item[k];
    return item;
  }

  return {
    async get(pk, sk) { return copy(m.get(K(pk, sk))); },
    async getMany(keys) { return keys.map(([pk, sk]) => copy(m.get(K(pk, sk)))); },
    async put(item, opts = {}) {
      if (opts.ifNotExists && exists(item.pk, item.sk)) throw new Conflict('exists');
      m.set(K(item.pk, item.sk), copy(item)); changed();
    },
    async update(pk, sk, patch, opts = {}) {
      const item = applyUpdate(pk, sk, patch, opts);
      m.set(K(pk, sk), item); changed();
      return copy(item);
    },
    async del(pk, sk, opts = {}) {
      if (opts.ifExists && !exists(pk, sk)) throw new Conflict('not exists');
      m.delete(K(pk, sk)); changed();
    },
    async delMany(keys) { keys.forEach(([pk, sk]) => m.delete(K(pk, sk))); changed(); },
    async query({ index, pk, skBegins, skLt, skGt, desc, limit = 100 }) {
      const P = index ? `${index}pk` : 'pk', S = index ? `${index}sk` : 'sk';
      const rows = [...m.values()].filter((x) => x[P] === pk && typeof x[S] === 'string'
        && (!skBegins || x[S].startsWith(skBegins)) && (!skLt || x[S] < skLt) && (!skGt || x[S] > skGt));
      rows.sort((a, b) => (a[S] < b[S] ? -1 : a[S] > b[S] ? 1 : 0));
      if (desc) rows.reverse();
      return rows.slice(0, limit).map(copy);
    },
    // 모두 되거나 모두 안 됨
    async transact(ops) {
      const next = new Map();
      for (const o of ops) {
        if (o.put) {
          if (o.ifNotExists && exists(o.put.pk, o.put.sk)) throw new Conflict('exists');
          next.set(K(o.put.pk, o.put.sk), copy(o.put));
        } else if (o.update) {
          const { pk, sk, patch } = o.update;
          next.set(K(pk, sk), applyUpdate(pk, sk, patch, { upsert: o.ifExists === false, ifEq: o.ifEq }));
        } else if (o.del) {
          if (o.ifExists && !exists(o.del.pk, o.del.sk)) throw new Conflict('not exists');
          next.set(K(o.del.pk, o.del.sk), null);
        }
      }
      for (const [k, v] of next) { if (v) m.set(k, v); else m.delete(k); }
      changed();
    },
    dump() { return Object.fromEntries(m); },
  };
}

/* ---------------- 체험용 로그인(인증번호 123456) ---------------- */
// 계정은 같은 저장소의 IDP#아이디 항목에 둡니다. 토큰은 서명이 없는 체험용입니다.
export function createDemoIdp(store, { now = Date.now } = {}) {
  const enc = (o) => btoa(unescape(encodeURIComponent(JSON.stringify(o))));
  const dec = (s) => JSON.parse(decodeURIComponent(escape(atob(s))));
  const fail = () => new ApiError(401, 'invalid-credential', '아이디 또는 비밀번호가 맞지 않습니다.');
  const get = (u) => store.get(`IDP#${u}`, 'IDP');
  const tokens = (a) => ({ idToken: `demo.${enc({ sub: a.sub, username: a.username, phone: a.phone, exp: now() + 3600000 })}`, refreshToken: `demo-r.${enc({ username: a.username })}`, expiresIn: 3600, sub: a.sub });
  return {
    async status(username) { const a = await get(username); return !a ? 'none' : a.confirmed ? 'confirmed' : 'unconfirmed'; },
    async remove(username) { await store.del(`IDP#${username}`, 'IDP'); },
    async signUp({ username, password, phone }) {
      if (await get(username)) throw new ApiError(409, 'username-taken', '이미 쓰고 있는 아이디입니다.');
      await store.put({ pk: `IDP#${username}`, sk: 'IDP', username, password, phone, sub: newId(now()), confirmed: false, code: '123456' });
    },
    async confirm(username, code) {
      const a = await get(username);
      if (!a || a.confirmed || a.code !== code) throw new ApiError(400, 'invalid-code', '인증번호가 맞지 않거나 시간이 지났어요.');
      await store.update(`IDP#${username}`, 'IDP', { set: { confirmed: true } });
      return { sub: a.sub, phone: a.phone };
    },
    async login(username, password) {
      const a = await get(username);
      if (!a || !a.confirmed || a.password !== password) throw fail();
      return tokens(a);
    },
    async refresh(refreshToken) {
      try {
        const a = await get(dec(String(refreshToken).replace(/^demo-r\./, '')).username);
        if (a?.confirmed) { const t = tokens(a); return { idToken: t.idToken, expiresIn: t.expiresIn }; }
      } catch { /* 아래로 */ }
      throw new ApiError(401, 'session-expired', '다시 로그인해 주세요.');
    },
    async setPassword(username, password) { await store.update(`IDP#${username}`, 'IDP', { set: { password } }); },
    async forgot(username) {
      const a = await get(username);
      if (!a?.confirmed) return null;
      await store.update(`IDP#${username}`, 'IDP', { set: { resetCode: '123456' } });
      return { destination: a.phone.replace(/^\+82(\d{2})\d+(\d{4})$/, '010-****-$2') };
    },
    async confirmForgot(username, code, password) {
      const a = await get(username);
      if (!a?.resetCode || a.resetCode !== code) throw new ApiError(400, 'invalid-code', '인증번호가 맞지 않거나 시간이 지났어요.');
      await store.update(`IDP#${username}`, 'IDP', { set: { password }, remove: ['resetCode'] });
    },
    async revoke() {},
    async verify(token) {
      if (!String(token).startsWith('demo.')) return null;
      const c = dec(token.slice(5));
      return c.exp > now() ? { sub: c.sub, username: c.username, phone: c.phone } : null;
    },
  };
}
