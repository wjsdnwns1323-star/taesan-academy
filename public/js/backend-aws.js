// 로그인·데이터·파일을 AWS 서버(API Gateway + Lambda + DynamoDB + S3, 로그인은 Cognito)로 처리합니다.
// 주소 뒤에 ?demo=1 을 붙이거나 aws-config.js 가 비어 있으면, 같은 서버 규칙(server-core.js)을
// 이 브라우저 안에서 돌리는 체험 모드가 됩니다(데이터는 이 브라우저에만 저장, 인증번호 123456).
import { AWS_CONFIG } from './aws-config.js';
import { LIMITS, QNA_OPEN } from './config.js';

export const DEMO = new URLSearchParams(location.search).has('demo') || !AWS_CONFIG.api;
export const USERNAME_RE = /^[a-z0-9_]{4,20}$/;
export const toE164 = (phone) => `+82${phone.replace(/[^0-9]/g, '').replace(/^0/, '')}`;
const BASE = (AWS_CONFIG.sameOrigin || []).includes(location.hostname) ? '/api' : `${String(AWS_CONFIG.api).replace(/\/$/, '')}/api`;

function fail(code, message, status = 0) { const e = new Error(message || '오류가 생겼습니다.'); e.code = code; e.status = status; return e; }

/* ---------------- 로그인 상태 ---------------- */
const SKEY = DEMO ? 'tsc:demo-session' : 'tsc:session';
const readSession = () => { try { return JSON.parse(localStorage.getItem(SKEY)); } catch { return null; } };
let session = readSession(); // { idToken, refreshToken, exp }
function setSession(s) {
  session = s;
  try { if (s) localStorage.setItem(SKEY, JSON.stringify(s)); else localStorage.removeItem(SKEY); } catch { /* 저장소 사용 불가 */ }
}
let me = null; // { uid, username, nickname, grade, role, banned, createdAt }
const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn(me));
export const currentUser = () => me;
export const isAdmin = () => me?.role === 'admin';
export function onUser(fn) { listeners.add(fn); return () => listeners.delete(fn); }

// 다른 탭에서 로그아웃하면 여기서도 로그아웃
window.addEventListener('storage', (e) => {
  if (e.key !== SKEY) return;
  session = readSession();
  if (!session && me) { me = null; emit(); }
});

/* ---------------- 서버 호출 ---------------- */
const qsOf = (query = {}) => {
  const out = {};
  for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== null && v !== false && v !== '') out[k] = String(v);
  return out;
};

let demoApp = null;
async function demoServer() {
  if (!demoApp) {
    demoApp = (async () => {
      const core = await import('./server-core.js');
      let saved = {};
      try { saved = JSON.parse(localStorage.getItem('tsc:demo-db')) || {}; } catch { /* 처음 */ }
      const db = core.createMemoryStore(saved, (m) => {
        try { localStorage.setItem('tsc:demo-db', JSON.stringify(Object.fromEntries(m))); } catch (e) { console.warn('체험 데이터를 저장하지 못했습니다', e); }
      });
      return core.createApp({ store: db, files: demoFiles, idp: core.createDemoIdp(db), env: { demo: true, qnaOpen: QNA_OPEN, smsDailyMax: 10000 } });
    })();
  }
  return demoApp;
}

async function send(method, path, { query, body, token } = {}) {
  if (DEMO) return (await demoServer()).handle({ method, path, query: qsOf(query), body: body ? JSON.parse(JSON.stringify(body)) : null, token });
  const qs = new URLSearchParams(qsOf(query)).toString();
  let r;
  try {
    r = await fetch(`${BASE}${path}${qs ? `?${qs}` : ''}`, {
      method,
      headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch { throw fail('network', '인터넷 연결을 확인해 주세요.'); }
  return { status: r.status, body: await r.json().catch(() => null) };
}

// 로그인 시간이 거의 지났으면 새 토큰 받기(동시에 여러 번 부르지 않음)
let refreshing = null;
async function refresh() {
  if (!session?.refreshToken) return;
  refreshing = refreshing || (async () => {
    const r = await send('POST', '/auth/refresh', { body: { refreshToken: session.refreshToken } });
    if (r.status === 200) setSession({ ...session, idToken: r.body.idToken, exp: Date.now() + r.body.expiresIn * 1000 });
    else if (r.status === 401) { setSession(null); if (me) { me = null; emit(); } }
  })().finally(() => { refreshing = null; });
  await refreshing;
}
async function idToken() {
  if (!session) return null;
  if (!session.exp || session.exp - 60000 < Date.now()) await refresh();
  return session?.idToken || null;
}

async function api(method, path, opts = {}) {
  let res = await send(method, path, { ...opts, token: await idToken() });
  if (res.status === 401 && res.body?.error === 'session-expired' && session) {
    await refresh();
    res = await send(method, path, { ...opts, token: session ? await idToken() : null });
  }
  if (res.status >= 400) throw fail(res.body?.error || 'server', res.body?.message || '서버에 문제가 생겼습니다.', res.status);
  return res.body;
}

// 같은 순간에 부른 GET 요청은 한 번에 묶어 보냅니다(홈 화면처럼 목록을 여러 개 부를 때 빨라짐)
let queue = null;
function get(path, query) {
  return new Promise((resolve, reject) => {
    if (!queue) { queue = []; setTimeout(flush, 0); }
    queue.push({ path, query: qsOf(query), resolve, reject });
  });
}
async function flush() {
  const list = queue;
  queue = null;
  if (list.length === 1) { api('GET', list[0].path, { query: list[0].query }).then(list[0].resolve, list[0].reject); return; }
  for (let i = 0; i < list.length; i += 50) {
    const part = list.slice(i, i + 50);
    api('POST', '/batch', { body: { requests: part.map((g) => ({ path: g.path, query: g.query })) } }).then((r) => {
      r.responses.forEach((x, j) => (x.status < 400 ? part[j].resolve(x.body) : part[j].reject(fail(x.body?.error, x.body?.message, x.status))));
    }, (e) => part.forEach((g) => g.reject(e)));
  }
}

/* ---------------- 시작 ---------------- */
export async function init() {
  if (session) {
    try { me = await api('GET', '/me'); } catch (e) {
      me = null;
      if (e.status === 401 || e.status === 404) setSession(null);
    }
  }
  return me;
}

export function errorText(e) {
  if (!e) return '오류가 생겼습니다.';
  if (e.code === 'network') return '인터넷 연결을 확인해 주세요.';
  return e.message || '오류가 생겼습니다.';
}

/* ---------------- 회원 ---------------- */
// 회원가입 1단계: 아이디·비밀번호·휴대폰으로 인증번호 보내기
export async function sendPhoneCode({ phone, username, password }) {
  await api('POST', '/auth/start', { body: { username: String(username || '').trim().toLowerCase(), password, phone } });
}

// 2단계: 인증번호 확인과 회원 정보 저장을 한 번에
export async function signUp(f) {
  const r = await api('POST', '/auth/confirm', {
    body: {
      username: f.username, password: f.password, phone: f.phone, code: f.code, realName: f.realName, gender: f.gender, age: f.age,
      memberType: f.memberType, grade: f.grade, childGrade: f.childGrade || '', guardianConsent: !!f.guardianConsent,
      agreeRules: f.agreeRules !== false, agreePrivacy: f.agreePrivacy !== false,
    },
  });
  setSession({ idToken: r.idToken, refreshToken: r.refreshToken, exp: Date.now() + r.expiresIn * 1000 });
  me = r.me;
  emit();
}

export async function signIn(username, password) {
  const r = await api('POST', '/auth/login', { body: { username: username.trim().toLowerCase(), password } });
  setSession({ idToken: r.idToken, refreshToken: r.refreshToken, exp: Date.now() + r.expiresIn * 1000 });
  me = r.me;
  emit();
}

export async function signOut() {
  setSession(null);
  me = null;
  emit();
}

export async function changePassword(oldPassword, newPassword) { await api('POST', '/auth/password', { body: { oldPassword, newPassword } }); }
export const getPrivate = (uid = me?.uid) => get(`/users/${encodeURIComponent(uid)}/private`);
export const getUser = (uid) => get(`/users/${encodeURIComponent(uid)}`);

export async function withdraw(password) {
  await api('DELETE', '/me', { body: { password } });
  await signOut();
}

/* ---------------- 파일 ---------------- */
// 체험 모드 파일은 이 브라우저(IndexedDB)에 둡니다
const idb = (() => {
  let dbp = null;
  const open = () => (dbp = dbp || new Promise((res, rej) => {
    const r = indexedDB.open('tsc-demo-files', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('f');
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  }));
  const tx = async (mode, fn) => {
    const db = await open();
    return new Promise((res, rej) => { const t = db.transaction('f', mode); const q = fn(t.objectStore('f')); t.oncomplete = () => res(q?.result); t.onerror = () => rej(t.error); });
  };
  const mem = new Map();
  return {
    put: (k, v) => tx('readwrite', (s) => s.put(v, k)).catch(() => { mem.set(k, v); }),
    get: (k) => tx('readonly', (s) => s.get(k)).then((v) => v || mem.get(k)).catch(() => mem.get(k)),
    del: (k) => tx('readwrite', (s) => s.delete(k)).catch(() => { mem.delete(k); }),
  };
})();
const demoFiles = {
  async presignUpload({ key }) { return { url: `demo:${key}`, fields: {} }; },
  async presignGet({ key, type }) { return `demo:${type}:${key}`; },
  async remove(key) { await idb.del(key); },
};

function postForm(url, fields, blob, onProgress) {
  return new Promise((resolve, reject) => {
    const fd = new FormData();
    Object.entries(fields).forEach(([k, v]) => fd.append(k, v));
    fd.append('file', blob);
    const x = new XMLHttpRequest();
    x.open('POST', url);
    x.upload.onprogress = (e) => { if (e.lengthComputable) onProgress?.(e.loaded / e.total); };
    x.onload = () => (x.status < 300 ? resolve() : reject(fail('upload', '파일을 올리지 못했습니다. 크기(5MB 이하)를 확인해 주세요.', x.status)));
    x.onerror = () => reject(fail('network', '인터넷 연결을 확인해 주세요.'));
    x.send(fd);
  });
}

export async function uploadFile(blob, name, onProgress) {
  if (blob.size > LIMITS.fileMB * 1024 * 1024) throw new Error(`${name}: ${LIMITS.fileMB}MB보다 큰 파일은 올릴 수 없습니다.`);
  const type = (blob.type || 'application/octet-stream').slice(0, 100);
  const r = await api('POST', '/files', { body: { name, type, size: blob.size } });
  if (r.upload.url.startsWith('demo:')) { await idb.put(r.upload.url.slice(5), blob); onProgress?.(1); }
  else await postForm(r.upload.url, r.upload.fields, blob, onProgress);
  return { id: r.id, name: r.name, type: r.type, size: r.size };
}

const fileCache = new Map();
export function fileUrl(id) {
  if (!fileCache.has(id)) {
    fileCache.set(id, (async () => {
      const { url } = await get(`/files/${encodeURIComponent(id)}`);
      if (!url.startsWith('demo:')) return url;
      const [, type, ...rest] = url.split(':');
      const blob = await idb.get(rest.join(':'));
      if (!blob) throw new Error('파일을 찾을 수 없습니다.');
      return URL.createObjectURL(new Blob([blob], { type }));
    })().catch((e) => { fileCache.delete(id); throw e; }));
    // 서버 주소는 1시간 뒤 만료되므로 50분 뒤 다시 받기
    setTimeout(() => fileCache.delete(id), 50 * 60000);
  }
  return fileCache.get(id);
}

/* ---------------- 글 ---------------- */
const likedCache = new Map();
export const listPosts = ({ board, category, grade, subject, status, pinned, limit = 20, before } = {}) =>
  get('/posts', { board, category: category || subject, grade, status, pinned: pinned ? 1 : '', limit, before });
export const listMyPosts = (uid = me?.uid) => get('/posts', { uid, limit: 100 });
export const listPending = () => get('/posts', { state: 'pending', limit: 200 });
export const listHidden = () => get('/posts', { state: 'hidden', limit: 200 });

export async function getPost(id) {
  let view = '';
  try {
    const key = `tsc:v:${id}`;
    if (me && !sessionStorage.getItem(key)) { sessionStorage.setItem(key, '1'); view = '1'; }
  } catch { /* 저장소 사용 불가 */ }
  try {
    const p = await get(`/posts/${encodeURIComponent(id)}`, { view });
    likedCache.set(id, !!p.liked);
    return p;
  } catch (e) { if (e.status === 404) return null; throw e; }
}

export async function createPost(input) { return (await api('POST', '/posts', { body: input })).id; }
export async function updatePost(id, patch) { await api('PATCH', `/posts/${encodeURIComponent(id)}`, { body: patch }); }
export async function deletePost(post) { await api('DELETE', `/posts/${encodeURIComponent(post.id)}`); }
export async function approvePost(post, ok) { await api('POST', `/posts/${encodeURIComponent(post.id)}/approve`, { body: { ok } }); }
export async function setHidden(post, hidden) { await api('POST', `/posts/${encodeURIComponent(post.id)}/hide`, { body: { hidden } }); }

export async function liked(postId) {
  if (!me) return false;
  if (likedCache.has(postId)) return likedCache.get(postId);
  return !!(await getPost(postId))?.liked;
}
export async function toggleLike(postId, on) {
  await api('POST', `/posts/${encodeURIComponent(postId)}/like`, { body: { on } });
  likedCache.set(postId, on);
}

/* ---------------- 댓글 ---------------- */
const commentLikes = new Map(); // postId → Set(cid)
export async function listComments(postId) {
  const list = await get(`/posts/${encodeURIComponent(postId)}/comments`);
  commentLikes.set(postId, new Set(list.filter((c) => c.liked).map((c) => c.id)));
  return list;
}
export async function addComment(post, body, image = '') { return (await api('POST', `/posts/${encodeURIComponent(post.id)}/comments`, { body: { body, image } })).id; }
export async function deleteComment(postId, cid) { await api('DELETE', `/posts/${encodeURIComponent(postId)}/comments/${encodeURIComponent(cid)}`); }
export async function commentLiked(postId, cid) { return !!commentLikes.get(postId)?.has(cid); }
export async function toggleCommentLike(postId, cid, on) {
  await api('POST', `/posts/${encodeURIComponent(postId)}/comments/${encodeURIComponent(cid)}/like`, { body: { on } });
  const s = commentLikes.get(postId) || new Set();
  if (on) s.add(cid); else s.delete(cid);
  commentLikes.set(postId, s);
}
export async function acceptComment(post, comment) { await api('POST', `/posts/${encodeURIComponent(post.id)}/accept`, { body: { commentId: comment.id } }); }

/* ---------------- 알림 ---------------- */
export const listNotifications = () => (me ? get('/notifications') : Promise.resolve([]));
export async function hasUnread() { return me ? (await get('/notifications/unread')).unread : false; }
export async function markRead(list) {
  const ids = list.filter((n) => !n.read).map((n) => n.id);
  if (ids.length) await api('POST', '/notifications/read', { body: { ids } });
}

/* ---------------- 신고 ---------------- */
export async function report({ post, comment, reason }) { await api('POST', '/reports', { body: { postId: post.id, commentId: comment?.id || '', reason } }); }
export const listReports = () => get('/reports');
export async function closeReport(id) { await api('POST', `/reports/${encodeURIComponent(id)}/done`); }

/* ---------------- 배너·상단 안내 ---------------- */
export const listBanners = () => get('/banners');
export async function addBanner(b) { await api('POST', '/banners', { body: { kind: b.kind, image: b.image || '', text: b.text || '', link: b.link || '' } }); }
export async function saveCover(c) { await api('PUT', '/banners/cover', { body: { text: c.text || '', sub: c.sub || '', image: c.image || '' } }); }
export async function deleteBanner(id) { await api('DELETE', `/banners/${encodeURIComponent(id)}`); }

/* ---------------- 관리자 ---------------- */
export async function getMember(uid) {
  try { return await get(`/users/${encodeURIComponent(uid)}`, { private: 1 }); } catch (e) { if (e.status === 404) return null; throw e; }
}
// 회원 목록(개인정보 포함, 관리자만)
export const listUsers = () => get('/users', { private: 1 });
export async function setUserFlags(uid, patch) { await api('PATCH', `/users/${encodeURIComponent(uid)}`, { body: patch }); }
