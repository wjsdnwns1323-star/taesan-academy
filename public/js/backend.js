// 데이터·로그인·파일 저장을 한곳에서 처리합니다.
// firebaseConfig.apiKey가 있으면 Firebase(Auth, Firestore, Storage)를, 없으면 브라우저 저장소(체험 모드)를 씁니다.
import { firebaseConfig, adminEmails } from './config.js';
import * as seed from './data/seed.js';
import { BAND_POSTS } from './data/band.js';

const SDK = 'https://www.gstatic.com/firebasejs/10.12.2';

// 공개 콘텐츠 컬렉션: Firestore가 비어 있으면 기본 데이터를 보여줍니다.
export const CONTENT = {
  teachers: seed.teachers,
  leaders: seed.leaders,
  classes: seed.classes,
  results: seed.results,
  events: seed.events,
  notices: seed.notices,
  faqs: seed.faqs,
  schools: seed.schools.map((s) => ({ ...s })),
  banners: seed.banners,
  quicklinks: seed.quicklinks,
  // 강의계획·설명회 안내(밴드 게시글 정리본)
  bandPosts: BAND_POSTS.map((p) => ({ ...p, id: String(p.id), bandUrl: `https://band.us/band/61446116/post/${p.id}` })),
};

const listeners = new Set();
let currentUser = null; // { uid, email, name, phone, role, school, grade, verified }
const notify = () => listeners.forEach((fn) => fn(currentUser));

const clone = (v) => JSON.parse(JSON.stringify(v));
const now = () => new Date().toISOString();

function applyQuery(rows, opts = {}) {
  let out = rows;
  for (const [f, op, v] of opts.where || []) {
    out = out.filter((r) => {
      const x = r[f];
      if (op === '==') return x === v;
      if (op === '!=') return x !== v;
      if (op === 'in') return v.includes(x);
      if (op === 'array-contains') return Array.isArray(x) && x.includes(v);
      return true;
    });
  }
  if (opts.orderBy) {
    const [f, dir = 'asc'] = opts.orderBy;
    out = [...out].sort((a, b) => {
      const x = a[f] ?? '', y = b[f] ?? '';
      const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), 'ko');
      return dir === 'desc' ? -c : c;
    });
  }
  return out;
}

// Storage를 쓰지 않을 때: 이미지를 가로 600px JPEG로 줄여 문서에 바로 저장(약 100KB 이하)
export function shrinkImage(file, max = 600) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / img.width);
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(img.src);
      resolve(c.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

/* ---------------- 체험 모드(브라우저 저장소) ---------------- */
function localAdapter() {
  const key = (c) => `taesan:${c}`;
  const read = (c) => {
    try {
      const raw = localStorage.getItem(key(c));
      if (raw) return JSON.parse(raw);
    } catch (e) { /* 저장소 사용 불가 */ }
    return CONTENT[c] ? clone(CONTENT[c]) : [];
  };
  const write = (c, rows) => {
    try { localStorage.setItem(key(c), JSON.stringify(rows)); } catch (e) { /* 무시 */ }
  };
  const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

  async function hash(s) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  const db = {
    async list(c, opts) { return applyQuery(read(c), opts); },
    async get(c, id) { return read(c).find((r) => r.id === id) || null; },
    async add(c, data) {
      const rows = read(c); const id = uid();
      rows.push({ ...data, id, createdAt: now() }); write(c, rows); return id;
    },
    async set(c, id, data) {
      const rows = read(c).filter((r) => r.id !== id);
      rows.push({ ...data, id, updatedAt: now() }); write(c, rows);
    },
    async update(c, id, patch) {
      write(c, read(c).map((r) => (r.id === id ? { ...r, ...patch, id, updatedAt: now() } : r)));
    },
    async remove(c, id) { write(c, read(c).filter((r) => r.id !== id)); },
    async getDoc(path) {
      try { return JSON.parse(localStorage.getItem(key(path)) || 'null'); } catch (e) { return null; }
    },
    async setDoc(path, data) { try { localStorage.setItem(key(path), JSON.stringify(data)); } catch (e) { /* 무시 */ } },
    isSeeded: async () => true,
  };

  const auth = {
    async init() {
      try {
        const s = JSON.parse(localStorage.getItem('taesan:_session') || 'null');
        if (s) currentUser = (read('users').find((u) => u.uid === s) || null);
      } catch (e) { currentUser = null; }
      notify();
    },
    async signUp({ email, password, ...profile }) {
      const users = read('users');
      if (users.some((u) => u.email === email)) throw new Error('이미 가입된 이메일입니다.');
      const u = {
        id: uid(), uid: '', email, pw: await hash(password), ...profile,
        role: email.startsWith('admin@') || adminEmails.includes(email) ? 'admin' : 'member',
        verified: true, createdAt: now(),
      };
      u.uid = u.id; users.push(u); write('users', users);
      localStorage.setItem('taesan:_session', JSON.stringify(u.uid));
      currentUser = u; notify(); return u;
    },
    async signIn(email, password) {
      const u = read('users').find((x) => x.email === email);
      if (!u || u.pw !== (await hash(password))) throw new Error('이메일 또는 비밀번호가 맞지 않습니다.');
      localStorage.setItem('taesan:_session', JSON.stringify(u.uid));
      currentUser = u; notify(); return u;
    },
    async signInWithGoogle(email) {
      if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('체험용 이메일을 입력해 주세요.');
      const users = read('users');
      let u = users.find((x) => x.email === email); const isNew = !u;
      if (!u) {
        u = { id: uid(), email, name: email.split('@')[0], role: email.startsWith('admin@') || adminEmails.includes(email) ? 'admin' : 'member', verified: true, provider: 'google', createdAt: now() };
        u.uid = u.id; users.push(u); write('users', users);
      }
      localStorage.setItem('taesan:_session', JSON.stringify(u.uid));
      currentUser = u; notify(); return { user: u, isNew };
    },
    async signOut() { localStorage.removeItem('taesan:_session'); currentUser = null; notify(); },
    async resetPassword() { throw new Error('체험 모드에서는 비밀번호 재설정 메일을 보낼 수 없습니다.'); },
    async updateProfile(patch) {
      await db.update('users', currentUser.uid, patch);
      currentUser = { ...currentUser, ...patch }; notify();
    },
    async resendVerification() {},
  };

  const storage = { upload: (_path, file) => shrinkImage(file) };
  return { mode: 'local', db, auth, storage };
}

/* ---------------- Firebase ---------------- */
async function firebaseAdapter() {
  const useStorage = !!firebaseConfig.storageBucket && firebaseConfig.useStorage !== false;
  const [{ initializeApp }, A, F, S] = await Promise.all([
    import(`${SDK}/firebase-app.js`),
    import(`${SDK}/firebase-auth.js`),
    import(`${SDK}/firebase-firestore.js`),
    useStorage ? import(`${SDK}/firebase-storage.js`) : Promise.resolve(null),
  ]);
  const app = initializeApp(firebaseConfig);
  const fa = A.getAuth(app);
  const fs = F.getFirestore(app);
  const st = useStorage ? S.getStorage(app) : null;
  const seededCache = {};

  const toRows = (snap) => snap.docs.map((d) => ({ ...d.data(), id: d.id }));

  async function isSeeded(c) {
    if (c in seededCache) return seededCache[c];
    const snap = await F.getDocs(F.query(F.collection(fs, c), F.limit(1)));
    seededCache[c] = !snap.empty;
    return seededCache[c];
  }

  const db = {
    async list(c, opts = {}) {
      if (CONTENT[c] && !(await isSeeded(c))) return applyQuery(clone(CONTENT[c]), opts);
      const cons = (opts.where || []).map(([f, op, v]) => F.where(f, op, v));
      const snap = await F.getDocs(F.query(F.collection(fs, c), ...cons));
      return applyQuery(toRows(snap), { orderBy: opts.orderBy });
    },
    async get(c, id) {
      const d = await F.getDoc(F.doc(fs, c, id));
      if (d.exists()) return { ...d.data(), id: d.id };
      if (CONTENT[c] && !(await isSeeded(c))) return clone(CONTENT[c]).find((r) => r.id === id) || null;
      return null;
    },
    async add(c, data) {
      const ref = await F.addDoc(F.collection(fs, c), { ...data, createdAt: now() });
      seededCache[c] = true; return ref.id;
    },
    async set(c, id, data) {
      await F.setDoc(F.doc(fs, c, id), { ...data, updatedAt: now() }); seededCache[c] = true;
    },
    async update(c, id, patch) { await F.updateDoc(F.doc(fs, c, id), { ...patch, updatedAt: now() }); },
    async remove(c, id) { await F.deleteDoc(F.doc(fs, c, id)); },
    async getDoc(path) {
      const d = await F.getDoc(F.doc(fs, ...path.split('/')));
      return d.exists() ? d.data() : null;
    },
    async setDoc(path, data) { await F.setDoc(F.doc(fs, ...path.split('/')), data, { merge: true }); },
    isSeeded,
    async seedCollection(c, rows) {
      // 500건 단위로 나눠서 일괄 저장
      for (let i = 0; i < rows.length; i += 400) {
        const batch = F.writeBatch(fs);
        rows.slice(i, i + 400).forEach((r) => batch.set(F.doc(fs, c, r.id), { ...r, updatedAt: now() }));
        await batch.commit();
      }
      seededCache[c] = true;
    },
  };

  async function loadProfile(u) {
    if (!u) return null;
    const d = await F.getDoc(F.doc(fs, 'users', u.uid));
    const p = d.exists() ? d.data() : {};
    const isAdminEmail = u.emailVerified && adminEmails.includes(u.email);
    return {
      uid: u.uid, email: u.email, verified: u.emailVerified, ...p,
      role: isAdminEmail ? 'admin' : p.role || 'member',
    };
  }

  const ERR = {
    'auth/email-already-in-use': '이미 가입된 이메일입니다.',
    'auth/invalid-email': '이메일 형식을 확인해 주세요.',
    'auth/weak-password': '비밀번호는 6자 이상으로 입력해 주세요.',
    'auth/invalid-credential': '이메일 또는 비밀번호가 맞지 않습니다.',
    'auth/wrong-password': '이메일 또는 비밀번호가 맞지 않습니다.',
    'auth/user-not-found': '가입되지 않은 이메일입니다.',
    'auth/too-many-requests': '시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.',
  };
  const wrap = (e) => new Error(ERR[e.code] || e.message);

  const auth = {
    init() {
      return new Promise((resolve) => {
        let first = true;
        A.onAuthStateChanged(fa, async (u) => {
          currentUser = await loadProfile(u);
          notify();
          if (first) { first = false; resolve(); }
        });
      });
    },
    async signUp({ email, password, ...profile }) {
      try {
        const cred = await A.createUserWithEmailAndPassword(fa, email, password);
        await F.setDoc(F.doc(fs, 'users', cred.user.uid), { ...profile, email, role: 'member', createdAt: now() });
        await A.sendEmailVerification(cred.user).catch(() => {});
        currentUser = await loadProfile(cred.user); notify(); return currentUser;
      } catch (e) { throw wrap(e); }
    },
    async signIn(email, password) {
      try {
        const cred = await A.signInWithEmailAndPassword(fa, email, password);
        currentUser = await loadProfile(cred.user); notify(); return currentUser;
      } catch (e) { throw wrap(e); }
    },
    async signInWithGoogle() {
      try {
        const provider = new A.GoogleAuthProvider();
        provider.setCustomParameters({ prompt: 'select_account' });
        const cred = await A.signInWithPopup(fa, provider);
        const ref = F.doc(fs, 'users', cred.user.uid);
        const snap = await F.getDoc(ref);
        if (!snap.exists()) {
          await F.setDoc(ref, { name: cred.user.displayName || '', email: cred.user.email, role: 'member', provider: 'google', createdAt: now() });
        }
        currentUser = await loadProfile(cred.user); notify();
        return { user: currentUser, isNew: !snap.exists() };
      } catch (e) {
        if (e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request') throw new Error('Google 로그인 창이 닫혔습니다.');
        if (e.code === 'auth/popup-blocked') throw new Error('팝업이 차단되었습니다. 브라우저에서 이 사이트의 팝업을 허용해 주세요.');
        if (e.code === 'auth/account-exists-with-different-credential') throw new Error('같은 이메일로 이미 가입한 계정이 있습니다. 이메일·비밀번호로 로그인해 주세요.');
        if (e.code === 'auth/unauthorized-domain') throw new Error('이 주소에서는 Google 로그인이 아직 허용되지 않았습니다. 관리자에게 알려주세요.');
        throw wrap(e);
      }
    },
    async signOut() { await A.signOut(fa); },
    async resetPassword(email) {
      try { await A.sendPasswordResetEmail(fa, email); } catch (e) { throw wrap(e); }
    },
    async updateProfile(patch) {
      await F.setDoc(F.doc(fs, 'users', currentUser.uid), patch, { merge: true });
      currentUser = { ...currentUser, ...patch }; notify();
    },
    async resendVerification() { if (fa.currentUser) await A.sendEmailVerification(fa.currentUser); },
  };

  const storage = {
    async upload(path, file) {
      if (!st) return shrinkImage(file);
      const r = S.ref(st, path);
      await S.uploadBytes(r, file, { contentType: file.type });
      return S.getDownloadURL(r);
    },
  };
  return { mode: 'firebase', db, auth, storage };
}

/* ---------------- 시작 ---------------- */
export const backend = {};
export async function initBackend() {
  let impl;
  if (firebaseConfig.apiKey) {
    try { impl = await firebaseAdapter(); } catch (e) {
      console.error('Firebase 연결 실패, 체험 모드로 전환합니다.', e);
      impl = localAdapter();
    }
  } else {
    impl = localAdapter();
  }
  Object.assign(backend, impl);
  await impl.auth.init();
  return backend;
}

export const getUser = () => currentUser;
export const isAdmin = () => currentUser?.role === 'admin';
export const onUser = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

// 사이트 설정(전화번호, 주소 등)은 settings/site 문서에서 읽고, 없으면 기본값을 씁니다.
export async function getSite() {
  const saved = await backend.db.getDoc('settings/site').catch(() => null);
  const out = { ...seed.site, ...(saved || {}) };
  if (!out.directorName) out.directorName = seed.site.directorName;   // 비워 저장돼 있으면 기본값(김태현 원장)
  return out;
}
export { seed };
