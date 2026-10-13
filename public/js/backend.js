// 로그인·데이터·파일 저장을 한곳에서 처리합니다.
// 보통은 Firebase(Authentication + Firestore)를 쓰고, 주소에 ?demo=1 이 있으면 이 브라우저에만 저장하는 체험 모드로 동작합니다.
// 파일은 Storage 대신 Firestore 문서에 조각(약 600KB)으로 나눠 저장합니다. 무료 요금제(Spark)로 동작합니다.
import { firebaseConfig, LOGIN_DOMAIN, LIMITS } from './config.js';

const SDK = 'https://www.gstatic.com/firebasejs/10.12.2';
export const DEMO = new URLSearchParams(location.search).has('demo') || !firebaseConfig.apiKey;

const inc = (n) => ({ __inc: n });
const CHUNK = 600 * 1024;

// 시간순 ID: 새 글이 먼저 나오도록(desc) 또는 오래된 것이 먼저(asc). 정렬용 복합 색인 없이 목록을 만들기 위해 씁니다.
const rand = () => Math.random().toString(36).slice(2, 8).padEnd(6, '0');
export function newId(order = 'desc') {
  const t = order === 'desc' ? Number.MAX_SAFE_INTEGER - Date.now() : Date.now();
  return t.toString(36).padStart(11, '0') + rand();
}

/* ---------------- 저장소 어댑터 ---------------- */
// 공통 모양: get(path) / set(path, data) / update(path, data) / remove(path) / query(col, { eq, limit, after }) / batch(ops)
// auth: onChange(fn) / signUp(email, pw) / signIn(email, pw) / signOut() / reauth(pw) / changePassword(oldPw, newPw) / deleteSelf()

function localAdapter() {
  const KEY = 'tsc:db', AKEY = 'tsc:auth';
  const load = (k) => { try { return JSON.parse(localStorage.getItem(k)) || {}; } catch { return {}; } };
  const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  const apply = (old, data) => {
    const out = { ...(old || {}) };
    for (const [k, v] of Object.entries(data)) out[k] = v && v.__inc !== undefined ? (out[k] || 0) + v.__inc : v;
    return out;
  };
  const run = (store, { op, path, data }) => {
    if (op === 'set') store[path] = apply(null, data);
    else if (op === 'update') {
      if (!store[path]) throw new Error('문서가 없습니다.');
      store[path] = apply(store[path], data);
    } else if (op === 'delete') delete store[path];
  };
  let uid = null;
  const fns = new Set();
  const auth = {
    onChange(fn) { fns.add(fn); uid = localStorage.getItem('tsc:session'); setTimeout(() => fn(uid), 0); },
    emit() { fns.forEach((fn) => fn(uid)); },
    // 체험 모드: 인증번호는 항상 123456
    async sendCode() { return { confirm: async (c) => { if (c !== '123456') throw code('auth/invalid-verification-code'); } }; },
    async signUpVerified(confirmation, codeValue, email, pw) { await confirmation.confirm(codeValue); return this.signUp(email, pw); },
    async signUp(email, pw) {
      const a = load(AKEY);
      if (a[email]) throw code('auth/email-already-in-use');
      a[email] = { uid: newId('asc'), pw };
      save(AKEY, a);
      uid = a[email].uid; localStorage.setItem('tsc:session', uid);
      this.emit();
      return uid;
    },
    async signIn(email, pw) {
      const u = load(AKEY)[email];
      if (!u || u.pw !== pw) throw code('auth/invalid-credential');
      uid = u.uid; localStorage.setItem('tsc:session', uid); this.emit();
    },
    async signOut() { uid = null; localStorage.removeItem('tsc:session'); this.emit(); },
    async reauth(pw) {
      const a = load(AKEY);
      if (!Object.values(a).some((x) => x.uid === uid && x.pw === pw)) throw code('auth/invalid-credential');
    },
    async changePassword(oldPw, pw) {
      const a = load(AKEY);
      const e = Object.keys(a).find((k) => a[k].uid === uid);
      if (a[e].pw !== oldPw) throw code('auth/invalid-credential');
      a[e].pw = pw; save(AKEY, a);
    },
    async deleteSelf() {
      const a = load(AKEY);
      for (const k of Object.keys(a)) if (a[k].uid === uid) delete a[k];
      save(AKEY, a); await this.signOut();
    },
  };
  return {
    auth,
    async get(path) { const d = load(KEY)[path]; return d ? { id: path.split('/').pop(), ...d } : null; },
    async set(path, data) { const s = load(KEY); run(s, { op: 'set', path, data }); save(KEY, s); },
    async update(path, data) { const s = load(KEY); run(s, { op: 'update', path, data }); save(KEY, s); },
    async remove(path) { const s = load(KEY); delete s[path]; save(KEY, s); },
    async batch(ops) { const s = load(KEY); ops.forEach((o) => run(s, o)); save(KEY, s); },
    async query(col, { eq = {}, limit = 30, after } = {}) {
      const s = load(KEY), depth = col.split('/').length + 1;
      return Object.keys(s)
        .filter((p) => p.startsWith(col + '/') && p.split('/').length === depth)
        .map((p) => ({ id: p.split('/').pop(), ...s[p] }))
        .filter((d) => Object.entries(eq).every(([k, v]) => d[k] === v))
        .sort((a, b) => (a.id < b.id ? -1 : 1))
        .filter((d) => !after || d.id > after)
        .slice(0, limit);
    },
  };
}

async function firebaseAdapter() {
  const [{ initializeApp }, A, F] = await Promise.all([
    import(`${SDK}/firebase-app.js`), import(`${SDK}/firebase-auth.js`), import(`${SDK}/firebase-firestore.js`),
  ]);
  const app = initializeApp(firebaseConfig);
  const au = A.getAuth(app);
  const fs = F.getFirestore(app);
  const conv = (data) => {
    const out = {};
    for (const [k, v] of Object.entries(data)) out[k] = v && v.__inc !== undefined ? F.increment(v.__inc) : v;
    return out;
  };
  const ref = (p) => F.doc(fs, p);
  return {
    auth: {
      onChange(fn) { A.onAuthStateChanged(au, (u) => fn(u ? u.uid : null)); },
      async signUp(email, pw) { return (await A.createUserWithEmailAndPassword(au, email, pw)).user.uid; },
      // 휴대폰 인증번호 보내기(보이지 않는 reCAPTCHA 사용)
      async sendCode(phone, boxId) {
        au.languageCode = 'ko';
        if (!this.verifier) this.verifier = new A.RecaptchaVerifier(au, boxId, { size: 'invisible' });
        return A.signInWithPhoneNumber(au, phone, this.verifier);
      },
      // 인증번호 확인 → 휴대폰 계정에 아이디(이메일)·비밀번호 연결
      async signUpVerified(confirmation, codeValue, email, pw) {
        const cred = await confirmation.confirm(codeValue);
        const user = cred.user;
        if (user.providerData.some((p) => p.providerId === 'password')) { await A.signOut(au); throw code('phone-already-used'); }
        try {
          await A.linkWithCredential(user, A.EmailAuthProvider.credential(email, pw));
        } catch (e) { await A.deleteUser(user).catch(() => {}); throw e; }
        await user.getIdToken(true);
        return user.uid;
      },
      async signIn(email, pw) { await A.signInWithEmailAndPassword(au, email, pw); },
      async signOut() { await A.signOut(au); },
      async reauth(pw) {
        const u = au.currentUser;
        await A.reauthenticateWithCredential(u, A.EmailAuthProvider.credential(u.email, pw));
      },
      async changePassword(oldPw, pw) {
        const u = au.currentUser;
        await A.reauthenticateWithCredential(u, A.EmailAuthProvider.credential(u.email, oldPw));
        await A.updatePassword(u, pw);
      },
      async deleteSelf() { await A.deleteUser(au.currentUser); },
    },
    async get(path) { const s = await F.getDoc(ref(path)); return s.exists() ? { id: s.id, ...s.data() } : null; },
    async set(path, data) { await F.setDoc(ref(path), conv(data)); },
    async update(path, data) { await F.updateDoc(ref(path), conv(data)); },
    async remove(path) { await F.deleteDoc(ref(path)); },
    async batch(ops) {
      const b = F.writeBatch(fs);
      for (const o of ops) {
        if (o.op === 'set') b.set(ref(o.path), conv(o.data));
        else if (o.op === 'update') b.update(ref(o.path), conv(o.data));
        else b.delete(ref(o.path));
      }
      await b.commit();
    },
    async query(col, { eq = {}, limit = 30, after } = {}) {
      const parts = Object.entries(eq).map(([k, v]) => F.where(k, '==', v));
      parts.push(F.orderBy(F.documentId()));
      if (after) parts.push(F.startAfter(after));
      parts.push(F.limit(limit));
      const snap = await F.getDocs(F.query(F.collection(fs, col), ...parts));
      return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    },
  };
}

/* ---------------- 상태 ---------------- */
let db = null;
let me = null; // { uid, username, nickname, grade, role, banned }
let signingUp = false; // 가입 중에는 회원 문서가 아직 없으므로 로그인 상태 변화를 잠시 무시
const listeners = new Set();
export const currentUser = () => me;
export const isAdmin = () => me?.role === 'admin';
export function onUser(fn) { listeners.add(fn); return () => listeners.delete(fn); }

export async function init() {
  db = DEMO ? localAdapter() : await firebaseAdapter();
  return new Promise((resolve) => {
    let first = true;
    db.auth.onChange(async (uid) => {
      if (signingUp) return;
      me = uid ? await db.get(`users/${uid}`).catch(() => null) : null;
      // 예전 홈페이지(Google 로그인) 계정이나 가입이 덜 된 계정은 로그아웃시킵니다
      if (uid && (!me || !me.username || !me.nickname)) { me = null; await db.auth.signOut().catch(() => {}); }
      if (me) me.uid = uid;
      listeners.forEach((fn) => fn(me));
      if (first) { first = false; resolve(me); }
    });
  });
}

function code(c) { const e = new Error(c); e.code = c; return e; }
export function errorText(e) {
  const c = e?.code || '';
  if (c.includes('email-already-in-use') || c.includes('credential-already-in-use')) return '이미 쓰고 있는 아이디입니다.';
  if (c.includes('phone-already-used')) return '이미 이 휴대폰 번호로 가입한 계정이 있어요.';
  if (c.includes('invalid-verification-code') || c.includes('code-expired')) return '인증번호가 맞지 않거나 시간이 지났어요.';
  if (c.includes('invalid-phone-number')) return '휴대폰 번호를 확인해 주세요.';
  if (c.includes('quota-exceeded') || c.includes('too-many-requests')) return '인증 요청이 너무 많아요. 잠시 후 다시 시도해 주세요.';
  if (c.includes('captcha') || c.includes('billing') || c.includes('operation-not-allowed')) return '휴대폰 인증이 아직 설정되지 않았어요. 관리자에게 알려 주세요.';
  if (c.includes('invalid-credential') || c.includes('wrong-password') || c.includes('user-not-found') || c.includes('invalid-login')) return '아이디 또는 비밀번호가 맞지 않습니다.';
  if (c.includes('too-many-requests')) return '잠시 후 다시 시도해 주세요(시도 횟수 초과).';
  if (c.includes('weak-password')) return '비밀번호가 너무 쉽습니다.';
  if (c.includes('network')) return '인터넷 연결을 확인해 주세요.';
  if (c.includes('permission-denied')) return '권한이 없습니다. 이용이 정지되었거나 로그인이 필요할 수 있습니다.';
  if (c.includes('operation-not-allowed')) return '아이디 로그인이 아직 켜지지 않았습니다. 관리자에게 알려 주세요.';
  return e?.message || '오류가 생겼습니다.';
}
const need = () => { if (!me) throw new Error('로그인이 필요합니다.'); if (me.banned) throw new Error('이용이 정지된 계정입니다.'); };
const needAdmin = () => { if (!isAdmin()) throw new Error('관리자만 할 수 있습니다.'); };

/* ---------------- 회원 ---------------- */
export const USERNAME_RE = /^[a-z0-9_]{4,20}$/;
const emailOf = (username) => `${username.toLowerCase()}@${LOGIN_DOMAIN}`;

// 회원가입 1단계: 휴대폰으로 인증번호 보내기
let confirmation = null;
export const toE164 = (phone) => `+82${phone.replace(/[^0-9]/g, '').replace(/^0/, '')}`;
export async function sendPhoneCode(phone, boxId) {
  confirmation = await db.auth.sendCode(toE164(phone), boxId);
}

export async function signUp(f) {
  const username = f.username.trim().toLowerCase();
  if (!USERNAME_RE.test(username)) throw new Error('아이디는 영문 소문자·숫자·_ 4~20자입니다.');
  f.nickname = f.nickname || username; // 닉네임은 처음엔 아이디(내 정보에서 바꿀 수 있음)
  if (await db.get(`nicknames/${f.nickname}`).catch(() => null)) throw new Error('이미 쓰고 있는 아이디입니다.');
  signingUp = true;
  const t = Date.now();
  let uid;
  try {
    if (!confirmation) throw new Error('휴대폰 인증번호를 먼저 받아 주세요.');
    uid = await db.auth.signUpVerified(confirmation, f.code, emailOf(username), f.password);
    await db.batch([
      // 체험 모드에서만 아이디 admin 이 관리자가 됩니다(실제 사이트 관리자는 scripts/create_admin.py로 만듭니다)
      { op: 'set', path: `users/${uid}`, data: { username, nickname: f.nickname, grade: f.grade, role: DEMO && username === 'admin' ? 'admin' : 'member', banned: false, createdAt: t } },
      { op: 'set', path: `users/${uid}/private/info`, data: { realName: f.realName, phone: f.phone, gender: f.gender, age: f.age, memberType: f.memberType, childGrade: f.childGrade || '', guardianConsent: !!f.guardianConsent, agreedAt: t } },
      { op: 'set', path: `nicknames/${f.nickname}`, data: { uid } },
    ]);
  } catch (e) {
    if (uid) { await db.auth.deleteSelf().catch(() => {}); confirmation = null; }
    throw e.code?.includes('permission') ? new Error('이미 있는 닉네임이거나 입력값이 올바르지 않습니다.') : e;
  } finally {
    signingUp = false;
  }
  confirmation = null;
  me = await db.get(`users/${uid}`);
  me.uid = uid;
  listeners.forEach((fn) => fn(me));
}

export async function signIn(username, pw) { await db.auth.signIn(emailOf(username.trim()), pw); }
export async function signOut() { await db.auth.signOut(); }
export async function changePassword(oldPw, pw) { await db.auth.changePassword(oldPw, pw); }
export const getPrivate = (uid = me?.uid) => db.get(`users/${uid}/private/info`);
export const getUser = (uid) => db.get(`users/${uid}`);

export async function updateProfile({ nickname, grade, realName, phone, age }) {
  need();
  const ops = [];
  const patch = { grade };
  if (nickname !== me.nickname) {
    if (await db.get(`nicknames/${nickname}`)) throw new Error('이미 있는 닉네임입니다.');
    ops.push({ op: 'delete', path: `nicknames/${me.nickname}` }, { op: 'set', path: `nicknames/${nickname}`, data: { uid: me.uid } });
    patch.nickname = nickname;
  }
  ops.push({ op: 'update', path: `users/${me.uid}`, data: patch });
  ops.push({ op: 'update', path: `users/${me.uid}/private/info`, data: { realName, phone, age } });
  await db.batch(ops);
  Object.assign(me, patch);
  listeners.forEach((fn) => fn(me));
}

export async function withdraw(pw) {
  need();
  await db.auth.reauth(pw);
  await db.batch([
    { op: 'delete', path: `users/${me.uid}/private/info` },
    { op: 'delete', path: `nicknames/${me.nickname}` },
    { op: 'delete', path: `users/${me.uid}` },
  ]);
  await db.auth.deleteSelf();
}

/* ---------------- 파일 ---------------- */
const toB64 = (buf) => {
  let s = '';
  const b = new Uint8Array(buf);
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
  return btoa(s);
};

export async function uploadFile(blob, name, onProgress) {
  need();
  if (blob.size > LIMITS.fileMB * 1024 * 1024) throw new Error(`${name}: ${LIMITS.fileMB}MB보다 큰 파일은 올릴 수 없습니다.`);
  const id = newId('asc');
  const chunks = Math.max(1, Math.ceil(blob.size / CHUNK));
  const meta = { uid: me.uid, name: name.slice(0, 200), type: (blob.type || 'application/octet-stream').slice(0, 100), size: blob.size, chunks, createdAt: Date.now() };
  await db.set(`files/${id}`, meta);
  for (let i = 0; i < chunks; i++) {
    const part = await blob.slice(i * CHUNK, (i + 1) * CHUNK).arrayBuffer();
    await db.set(`files/${id}/chunks/${i}`, { d: toB64(part) });
    onProgress?.((i + 1) / chunks);
  }
  return { id, name: meta.name, type: meta.type, size: meta.size };
}

const fileCache = new Map();
export function fileUrl(id) {
  if (!fileCache.has(id)) {
    fileCache.set(id, (async () => {
      const meta = await db.get(`files/${id}`);
      if (!meta) throw new Error('파일을 찾을 수 없습니다.');
      const parts = await Promise.all(Array.from({ length: meta.chunks }, (_, i) => db.get(`files/${id}/chunks/${i}`)));
      const bytes = parts.map((p) => Uint8Array.from(atob(p.d), (c) => c.charCodeAt(0)));
      // 같은 사이트 주소(blob:)에서 HTML 등이 실행되지 않도록 사진(JPEG) 외에는 내려받기 전용 형식으로 만듭니다.
      const type = meta.type === 'image/jpeg' ? 'image/jpeg' : 'application/octet-stream';
      return URL.createObjectURL(new Blob(bytes, { type }));
    })().catch((e) => { fileCache.delete(id); throw e; }));
  }
  return fileCache.get(id);
}

async function deleteFile(id) {
  const meta = await db.get(`files/${id}`).catch(() => null);
  if (!meta) return;
  const ops = Array.from({ length: meta.chunks }, (_, i) => ({ op: 'delete', path: `files/${id}/chunks/${i}` }));
  ops.push({ op: 'delete', path: `files/${id}` });
  await db.batch(ops).catch(() => {});
}

// 사진을 줄여서 JPEG로 (긴 변 max px)
export function shrinkImage(file, max = LIMITS.imagePx, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      const g = c.getContext('2d');
      g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
      g.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      c.toBlob((b) => (b ? resolve(b) : reject(new Error('사진을 읽지 못했습니다.'))), 'image/jpeg', quality);
    };
    img.onerror = () => reject(new Error(`${file.name}: 사진 파일이 아닙니다.`));
    img.src = URL.createObjectURL(file);
  });
}
export const blobToDataUrl = (b) => new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(b); });

/* ---------------- 글 ---------------- */
// 목록: 조건은 모두 '같음'(==)이고 정렬은 시간순 ID로 합니다.
export async function listPosts({ board, category, grade, subject, status, pinned, limit = 20, after } = {}) {
  const eq = { approved: true };
  if (board) eq.board = board;
  if (category) eq.category = category;
  if (grade) eq.grade = grade;
  if (subject) eq.category = subject;
  if (status) eq.status = status;
  if (pinned) eq.pinned = true;
  // 로그인 안 한 사람은 제목만 있는 목록(postIndex)을 봅니다
  if (!me) return db.query('postIndex', { eq, limit, after }).catch(() => []);
  return db.query('posts', { eq, limit, after });
}
export const listMyPosts = (uid = me?.uid, after) => db.query('posts', { eq: { uid }, limit: 30, after });
export const listPending = () => db.query('posts', { eq: { board: 'data', approved: false }, limit: 100 });
export async function getPost(id) {
  const p = await db.get(`posts/${id}`);
  // 조회수: 이 브라우저에서 처음 열 때 1 올림(실패해도 무시)
  try {
    const key = `tsc:v:${id}`;
    if (p && me && !sessionStorage.getItem(key)) {
      sessionStorage.setItem(key, '1');
      db.update(`posts/${id}`, { viewCount: inc(1) }).catch(() => {});
      p.viewCount = (p.viewCount || 0) + 1;
    }
  } catch { /* 저장소 사용 불가 */ }
  return p;
}

export async function createPost(input) {
  need();
  if (input.board === 'notice') needAdmin();
  const id = newId('desc');
  const post = {
    board: input.board,
    category: input.category,
    title: input.title,
    body: input.body,
    uid: me.uid,
    nickname: me.nickname,
    grade: me.grade,
    createdAt: Date.now(),
    likeCount: 0,
    commentCount: 0,
    thumb: input.thumb || '',
    images: input.images || [],
    files: input.files || [],
    approved: input.board !== 'data',
    status: input.board === 'qna' ? 'open' : '',
    acceptedCommentId: '',
    pinned: !!input.pinned && isAdmin(), // 이 게시판 공지(관리자만)
    source: input.source || '',
  };
  await db.set(`posts/${id}`, post);
  // 비회원용 제목 목록(보안 규칙이 아직 반영 전이어도 글쓰기는 되도록 따로 저장)
  await db.set(`postIndex/${id}`, indexOf(post)).catch((e) => console.warn('제목 목록 저장 실패', e));
  return id;
}

export async function updatePost(id, patch) {
  need();
  const ix = {};
  for (const k of ['title', 'category', 'approved']) if (k in patch) ix[k] = patch[k];
  await db.update(`posts/${id}`, { ...patch, updatedAt: Date.now() });
  if (Object.keys(ix).length) await db.update(`postIndex/${id}`, ix).catch(() => {});
}
// 비회원용 제목 목록에 넣는 항목(본문·사진·파일 없음)
function indexOf(p) {
  return { board: p.board, category: p.category, title: p.title, uid: p.uid, nickname: p.nickname, grade: p.grade, createdAt: p.createdAt, approved: p.approved, pinned: !!p.pinned };
}

export async function deletePost(post) {
  need();
  await db.remove(`posts/${post.id}`);
  await db.remove(`postIndex/${post.id}`).catch(() => {});
  if (post.uid === me.uid || isAdmin()) for (const f of [...(post.images || []), ...(post.files || [])]) await deleteFile(f.id);
}

export async function approvePost(post, ok) {
  needAdmin();
  if (ok) { await db.update(`posts/${post.id}`, { approved: true }); await db.update(`postIndex/${post.id}`, { approved: true }).catch(() => {}); }
  else await deletePost(post);
  await notify(post.uid, ok ? 'approved' : 'rejected', post.id, post.title);
}

export async function liked(postId) { return !!(me && (await db.get(`posts/${postId}/likes/${me.uid}`))); }
export async function toggleLike(postId, on) {
  need();
  await db.batch(on
    ? [{ op: 'set', path: `posts/${postId}/likes/${me.uid}`, data: { at: Date.now() } }, { op: 'update', path: `posts/${postId}`, data: { likeCount: inc(1) } }]
    : [{ op: 'delete', path: `posts/${postId}/likes/${me.uid}` }, { op: 'update', path: `posts/${postId}`, data: { likeCount: inc(-1) } }]);
}

/* ---------------- 댓글 ---------------- */
export const listComments = (postId) => db.query(`posts/${postId}/comments`, { limit: 500 });

export async function addComment(post, body, image = '') {
  need();
  const id = newId('asc');
  await db.batch([
    { op: 'set', path: `posts/${post.id}/comments/${id}`, data: { uid: me.uid, nickname: me.nickname, grade: me.grade, body, image, createdAt: Date.now(), likeCount: 0 } },
    { op: 'update', path: `posts/${post.id}`, data: { commentCount: inc(1) } },
  ]);
  if (post.uid !== me.uid) await notify(post.uid, 'comment', post.id, body).catch(() => {});
  return id;
}

export async function deleteComment(postId, cid) {
  need();
  await db.batch([
    { op: 'delete', path: `posts/${postId}/comments/${cid}` },
    { op: 'update', path: `posts/${postId}`, data: { commentCount: inc(-1) } },
  ]);
}

export async function commentLiked(postId, cid) { return !!(me && (await db.get(`posts/${postId}/comments/${cid}/likes/${me.uid}`))); }
export async function toggleCommentLike(postId, cid, on) {
  need();
  const base = `posts/${postId}/comments/${cid}`;
  await db.batch(on
    ? [{ op: 'set', path: `${base}/likes/${me.uid}`, data: { at: Date.now() } }, { op: 'update', path: base, data: { likeCount: inc(1) } }]
    : [{ op: 'delete', path: `${base}/likes/${me.uid}` }, { op: 'update', path: base, data: { likeCount: inc(-1) } }]);
}

export async function acceptComment(post, comment) {
  need();
  await db.update(`posts/${post.id}`, { acceptedCommentId: comment.id, status: 'solved' });
  if (comment.uid !== me.uid) await notify(comment.uid, 'accepted', post.id, post.title).catch(() => {});
}

/* ---------------- 알림 ---------------- */
async function notify(to, type, postId, text) {
  if (!me || to === me.uid) return;
  await db.set(`notifications/${newId('desc')}`, {
    to, from: me.uid, fromName: me.nickname, type, postId, text: String(text || '').slice(0, 80), read: false, createdAt: Date.now(),
  });
}
export const listNotifications = () => (me ? db.query('notifications', { eq: { to: me.uid }, limit: 50 }) : []);
export async function hasUnread() {
  if (!me) return false;
  return (await db.query('notifications', { eq: { to: me.uid, read: false }, limit: 1 })).length > 0;
}
export async function markRead(list) {
  const ops = list.filter((n) => !n.read).map((n) => ({ op: 'update', path: `notifications/${n.id}`, data: { read: true } }));
  if (ops.length) await db.batch(ops);
}

/* ---------------- 신고 ---------------- */
export async function report({ post, comment, reason }) {
  need();
  await db.set(`reports/${newId('desc')}`, {
    uid: me.uid, postId: post.id, postTitle: post.title.slice(0, 100), commentId: comment?.id || '',
    target: (comment ? comment.body : post.title).slice(0, 200), reason, status: 'open', createdAt: Date.now(),
  });
}
export const listReports = () => db.query('reports', { eq: { status: 'open' }, limit: 100 });
export async function closeReport(id) { needAdmin(); await db.update(`reports/${id}`, { status: 'done' }); }

/* ---------------- 배너·상단 안내 ---------------- */
// banners/{id}: { kind: 'image' | 'text', image(JPEG data 주소), text, link, createdAt }
export const listBanners = () => db.query('banners', { limit: 50 });
export async function addBanner(b) {
  needAdmin();
  await db.set(`banners/${newId('desc')}`, { kind: b.kind, image: b.image || '', text: b.text || '', link: b.link || '', createdAt: Date.now() });
}
// 맨 위 표지(배경 사진·제목·부제): banners/cover 한 문서
export async function saveCover(c) {
  needAdmin();
  await db.set('banners/cover', { kind: 'cover', image: c.image || '', text: c.text || '', sub: c.sub || '', link: '', createdAt: Date.now() });
}
export async function deleteBanner(id) { needAdmin(); await db.remove(`banners/${id}`); }

/* ---------------- 관리자 ---------------- */
export async function listUsers(after) { needAdmin(); return db.query('users', { limit: 200, after }); }
export async function setUserFlags(uid, patch) { needAdmin(); await db.update(`users/${uid}`, patch); }
