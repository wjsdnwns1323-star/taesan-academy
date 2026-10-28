// 서버 규칙 시험: node --test aws/api/test/*.test.mjs (DDB_ENDPOINT=http://localhost:8000 이면 DynamoDB Local)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp, createMemoryStore, createDemoIdp } from '../core.mjs';
const makeDynamoStore = async () => (await import('./dynamo.mjs')).makeDynamoStore();

// DDB_ENDPOINT 가 있으면 DynamoDB Local 로, 없으면 메모리 저장소로 시험합니다
const makeStore = process.env.DDB_ENDPOINT ? makeDynamoStore : async () => createMemoryStore();

async function setup(env = {}) {
  const store = await makeStore();
  const removed = [];
  const files = {
    async presignUpload({ key }) { return { url: `mem:${key}`, fields: {} }; },
    async presignGet({ key, download }) { return `mem:${key}${download ? '?dl' : ''}`; },
    async remove(key) { removed.push(key); },
  };
  const idp = createDemoIdp(store);
  const texts = [];
  const sms = { async send(to, text) { texts.push({ to, text }); } };
  const app = createApp({ store, files, idp, sms, env: { demo: true, ...env } });
  const call = async (method, path, body, token, query) => {
    const r = await app.handle({ method, path, body, token, query });
    return r;
  };
  const ok = async (...a) => {
    const r = await call(...a);
    assert.equal(r.status, 200, `${a[0]} ${a[1]} → ${r.status} ${JSON.stringify(r.body)}`);
    return r.body;
  };
  const fail = async (status, ...a) => {
    const r = await call(...a);
    assert.equal(r.status, status, `${a[0]} ${a[1]} expected ${status} got ${r.status} ${JSON.stringify(r.body)}`);
    return r.body;
  };
  let n = 0;
  const join = async (username, extra = {}) => {
    const phone = extra.phone || `010-1234-${String(1000 + n++).slice(-4)}`;
    await ok('POST', '/auth/start', { username, password: 'tsPass_01', phone });
    const r = await ok('POST', '/auth/confirm', {
      username, password: 'tsPass_01', phone, code: '123456', realName: '홍길동', gender: '여', age: 45,
      memberType: '학부모', childGrade: '고2', agreeRules: true, agreePrivacy: true, ...extra,
    });
    return { token: r.idToken, me: r.me, refresh: r.refreshToken };
  };
  return { store, app, call, ok, fail, join, removed, texts };
}

const post = (over = {}) => ({ board: 'talk', category: 'daily', title: '안녕하세요', body: '본문입니다', images: [], files: [], source: '', ...over });

test('회원가입: 인증·검증·중복', async () => {
  const t = await setup();
  await t.fail(400, 'POST', '/auth/start', { username: 'AB', password: 'tsPass_01', phone: '010-1111-2222' });
  await t.fail(400, 'POST', '/auth/start', { username: 'mom01', password: 'short', phone: '010-1111-2222' });
  assert.equal((await t.fail(400, 'POST', '/auth/start', { username: 'mom01', password: 'mom01pass', phone: '010-1111-2222' })).error, 'weak-password');
  assert.equal((await t.fail(400, 'POST', '/auth/start', { username: 'mom01', password: 'qwer1234', phone: '010-1111-2222' })).error, 'weak-password');
  await t.fail(400, 'POST', '/auth/start', { username: 'mom01', password: 'tsPass_01', phone: '02-123-4567' });
  await t.ok('POST', '/auth/start', { username: 'mom01', password: 'tsPass_01', phone: '010-1111-2222' });
  const base = { username: 'mom01', password: 'tsPass_01', phone: '010-1111-2222', realName: '김엄마', gender: '여', age: 44, memberType: '학부모', childGrade: '중3', agreeRules: true, agreePrivacy: true };
  await t.fail(400, 'POST', '/auth/confirm', { ...base, code: '000000' });
  await t.fail(400, 'POST', '/auth/confirm', { ...base, code: '123456', agreePrivacy: false });
  await t.fail(400, 'POST', '/auth/confirm', { ...base, code: '123456', childGrade: '' });
  const r = await t.ok('POST', '/auth/confirm', { ...base, code: '123456' });
  assert.equal(r.me.username, 'mom01');
  assert.equal(r.me.grade, '학부모');
  assert.equal(r.me.role, 'member');
  assert.ok(r.idToken && r.refreshToken);
  // 같은 아이디·같은 번호는 다시 못 씀
  assert.equal((await t.fail(409, 'POST', '/auth/start', { username: 'mom01', password: 'tsPass_01', phone: '010-9999-2222' })).error, 'username-taken');
  assert.equal((await t.fail(409, 'POST', '/auth/start', { username: 'mom02', password: 'tsPass_01', phone: '01011112222' })).error, 'phone-taken');
  // 다시 확인해도 기존 계정이 지워지지 않음
  await t.fail(400, 'POST', '/auth/confirm', { ...base, code: '123456' });
  await t.ok('POST', '/auth/login', { username: 'mom01', password: 'tsPass_01' });
  // 만 14세 미만은 보호자 동의
  await t.ok('POST', '/auth/start', { username: 'kid01', password: 'tsPass_01', phone: '010-3333-4444' });
  const kid = { username: 'kid01', password: 'tsPass_01', phone: '010-3333-4444', code: '123456', realName: '어린이', gender: '남', age: 13, memberType: '학생', grade: '중1', agreeRules: true, agreePrivacy: true };
  await t.fail(400, 'POST', '/auth/confirm', kid); // 보호자 정보 없음
  await t.fail(400, 'POST', '/auth/confirm', { ...kid, guardianConsent: true }); // 체크만으로는 안 됨
  await t.fail(400, 'POST', '/auth/guardian/start', { phone: '010-5555-6666', childName: '' });
  await t.ok('POST', '/auth/guardian/start', { phone: '010-5555-6666', childName: '어린이' });
  assert.match(t.texts.at(-1).text, /어린이 학생의 회원가입 보호자 동의 인증번호: 123456/);
  await t.fail(400, 'POST', '/auth/confirm', { ...kid, guardianName: '어른', guardianPhone: '010-3333-4444', guardianCode: '123456' }); // 학생 번호와 같음
  await t.fail(400, 'POST', '/auth/confirm', { ...kid, guardianName: '어른', guardianPhone: '010-5555-6666', guardianCode: '000000' });
  const k = await t.ok('POST', '/auth/confirm', { ...kid, guardianName: '어른', guardianPhone: '010-5555-6666', guardianCode: '123456' });
  assert.equal(k.me.grade, '중1');
  const priv = await t.ok('GET', `/users/${k.me.uid}/private`, null, k.idToken);
  assert.equal(priv.guardianConsent, true);
  assert.equal(priv.guardianName, '어른');
  assert.ok(priv.guardianAt > 0);
  assert.equal(priv.childGrade, '');
});

test('확인 안 한 가입은 다시 시작할 수 있음', async () => {
  const t = await setup();
  await t.ok('POST', '/auth/start', { username: 'half01', password: 'tsPass_01', phone: '010-5555-6666' });
  await t.ok('POST', '/auth/start', { username: 'half01', password: 'tsPass_02', phone: '010-5555-7777' });
  const r = await t.ok('POST', '/auth/confirm', { username: 'half01', password: 'tsPass_02', phone: '010-5555-7777', code: '123456', realName: '반쪽', gender: '남', age: 17, memberType: '학생', grade: '고1', agreeRules: true, agreePrivacy: true });
  assert.equal(r.me.username, 'half01');
});

test('문자 발송 횟수 제한', async () => {
  const t = await setup({ smsDailyMax: 3 });
  for (let i = 0; i < 3; i++) await t.ok('POST', '/auth/start', { username: `user0${i}`, password: 'tsPass_01', phone: `010-7000-000${i}` });
  assert.equal((await t.fail(429, 'POST', '/auth/start', { username: 'user09', password: 'tsPass_01', phone: '010-7000-0009' })).error, 'too-many-requests');
  const t2 = await setup();
  for (let i = 0; i < 5; i++) await t2.ok('POST', '/auth/start', { username: `same0${i}`, password: 'tsPass_01', phone: '010-7000-1111' });
  await t2.fail(429, 'POST', '/auth/start', { username: 'same09', password: 'tsPass_01', phone: '010-7000-1111' });
});

test('로그인·토큰 갱신·비밀번호 변경·탈퇴', async () => {
  const t = await setup();
  const a = await t.join('papa01');
  await t.fail(401, 'POST', '/auth/login', { username: 'papa01', password: 'wrongpass' });
  const l = await t.ok('POST', '/auth/login', { username: 'PAPA01 ', password: 'tsPass_01' });
  assert.equal(l.me.uid, a.me.uid);
  const r = await t.ok('POST', '/auth/refresh', { refreshToken: l.refreshToken });
  assert.ok(r.idToken);
  await t.fail(401, 'POST', '/auth/refresh', { refreshToken: 'nope' });
  assert.equal((await t.ok('GET', '/me', null, r.idToken)).username, 'papa01');
  assert.equal((await t.fail(401, 'GET', '/me', null, 'demo.garbage')).error, 'session-expired');
  await t.fail(401, 'POST', '/auth/password', { oldPassword: 'bad', newPassword: 'tsNewPass_1' }, a.token);
  await t.fail(400, 'POST', '/auth/password', { oldPassword: 'tsPass_01', newPassword: 'short' }, a.token);
  await t.ok('POST', '/auth/password', { oldPassword: 'tsPass_01', newPassword: 'tsNewPass_1' }, a.token);
  await t.fail(401, 'POST', '/auth/login', { username: 'papa01', password: 'tsPass_01' });
  await t.ok('POST', '/auth/login', { username: 'papa01', password: 'tsNewPass_1' });
  // 탈퇴하면 같은 번호로 다시 가입 가능
  await t.fail(401, 'DELETE', '/me', { password: 'tsPass_01' }, a.token);
  await t.ok('DELETE', '/me', { password: 'tsNewPass_1' }, a.token);
  await t.fail(401, 'POST', '/auth/login', { username: 'papa01', password: 'tsNewPass_1' });
  await t.join('papa01', { phone: '010-1234-1000' });
});

test('글: 비회원은 제목만, 회원은 본문', async () => {
  const t = await setup();
  const a = await t.join('writer1');
  const b = await t.join('reader1');
  await t.fail(401, 'POST', '/posts', post());
  const { id } = await t.ok('POST', '/posts', post({ body: '비밀 본문'.repeat(10) }), a.token);
  const guest = await t.ok('GET', '/posts', null, null, { board: 'talk' });
  assert.equal(guest.length, 1);
  assert.equal(guest[0].title, '안녕하세요');
  assert.equal(guest[0].excerpt, undefined);
  assert.equal(guest[0].uid, undefined);
  assert.equal((await t.fail(401, 'GET', `/posts/${id}`)).error, 'login-required');
  const full = await t.ok('GET', `/posts/${id}`, null, b.token, { view: '1' });
  assert.match(full.body, /비밀 본문/);
  assert.equal(full.viewCount, 1);
  assert.equal(full.liked, false);
  const list = await t.ok('GET', '/posts', null, b.token, {});
  assert.ok(list[0].excerpt.startsWith('비밀 본문'));
  assert.equal((await t.ok('GET', '/posts', null, b.token, { board: 'talk', category: 'daily' })).length, 1);
  assert.equal((await t.ok('GET', '/posts', null, b.token, { board: 'talk', category: 'worry' })).length, 0);
  assert.equal((await t.ok('GET', '/posts', null, b.token, { board: 'news' })).length, 0);
  // 검증
  await t.fail(400, 'POST', '/posts', post({ title: '' }), a.token);
  await t.fail(400, 'POST', '/posts', post({ title: 'x'.repeat(101) }), a.token);
  await t.fail(400, 'POST', '/posts', post({ board: 'nope' }), a.token);
  await t.fail(403, 'POST', '/posts', post({ board: 'notice' }), a.token);
  await t.fail(403, 'POST', '/posts', post({ pinned: true }), a.token);
  await t.fail(403, 'POST', '/posts', post({ board: 'qna' }), a.token);
  await t.fail(400, 'POST', '/posts', post({ board: 'data', source: '' }), a.token);
  await t.fail(400, 'POST', '/posts', post({ thumb: 'data:text/html;base64,AAAA' }), a.token);
  // 남의 글 수정·삭제 불가
  await t.fail(403, 'PATCH', `/posts/${id}`, post({ title: '바꿈' }), b.token);
  await t.fail(403, 'DELETE', `/posts/${id}`, null, b.token);
  await t.ok('PATCH', `/posts/${id}`, post({ title: '바꾼 제목' }), a.token);
  assert.equal((await t.ok('GET', `/posts/${id}`, null, b.token)).title, '바꾼 제목');
  await t.ok('DELETE', `/posts/${id}`, null, a.token);
  await t.fail(404, 'GET', `/posts/${id}`, null, b.token);
  assert.equal((await t.ok('GET', '/posts', null, null, {})).length, 0);
});

test('관리자: 공지·고정·자료 승인·숨김·회원 관리', async () => {
  const t = await setup();
  const adm = await t.join('admin');
  assert.equal(adm.me.role, 'admin');
  const a = await t.join('member1');
  const b = await t.join('member2');
  await t.ok('POST', '/posts', post({ board: 'notice', category: 'notice', title: '공지' }), adm.token);
  const pin = await t.ok('POST', '/posts', post({ title: '수다 공지', pinned: true }), adm.token);
  assert.equal((await t.ok('GET', `/posts/${pin.id}`, null, a.token)).pinned, true);
  // 자료실: 승인 전에는 목록에 없음, 글쓴이·관리자만 봄
  const d = await t.ok('POST', '/posts', post({ board: 'data', category: 'own', title: '자료', source: '직접 작성' }), a.token);
  assert.equal((await t.ok('GET', '/posts', null, b.token, { board: 'data' })).length, 0);
  await t.fail(404, 'GET', `/posts/${d.id}`, null, b.token);
  assert.equal((await t.ok('GET', `/posts/${d.id}`, null, a.token)).approved, false);
  await t.fail(403, 'GET', '/posts', null, a.token, { state: 'pending' });
  assert.equal((await t.ok('GET', '/posts', null, adm.token, { state: 'pending' })).length, 1);
  await t.fail(403, 'POST', `/posts/${d.id}/approve`, { ok: true }, a.token);
  await t.ok('POST', `/posts/${d.id}/approve`, { ok: true }, adm.token);
  assert.equal((await t.ok('GET', '/posts', null, null, { board: 'data' })).length, 1);
  assert.equal((await t.ok('GET', '/notifications', null, a.token))[0].type, 'approved');
  // 글쓴이가 고치면 다시 승인 대기
  await t.ok('PATCH', `/posts/${d.id}`, post({ board: 'data', category: 'own', title: '자료 수정', source: '직접 작성' }), a.token);
  assert.equal((await t.ok('GET', '/posts', null, null, { board: 'data' })).length, 0);
  // 숨김
  const p = await t.ok('POST', '/posts', post({ title: '나쁜 글' }), b.token);
  await t.fail(403, 'POST', `/posts/${p.id}/hide`, { hidden: true }, a.token);
  await t.ok('POST', `/posts/${p.id}/hide`, { hidden: true }, adm.token);
  await t.fail(404, 'GET', `/posts/${p.id}`, null, a.token);
  assert.equal((await t.ok('GET', `/posts/${p.id}`, null, b.token)).hidden, true);
  assert.equal((await t.ok('GET', '/posts', null, adm.token, { state: 'hidden' })).length, 1);
  assert.ok(!(await t.ok('GET', '/posts', null, a.token, {})).some((x) => x.id === p.id));
  await t.ok('POST', `/posts/${p.id}/hide`, { hidden: false }, adm.token);
  assert.ok((await t.ok('GET', '/posts', null, a.token, {})).some((x) => x.id === p.id));
  // 반려(삭제 + 알림)
  const d2 = await t.ok('POST', '/posts', post({ board: 'data', category: 'own', title: '불법 자료', source: '인터넷' }), b.token);
  await t.ok('POST', `/posts/${d2.id}/approve`, { ok: false }, adm.token);
  await t.fail(404, 'GET', `/posts/${d2.id}`, null, b.token);
  assert.equal((await t.ok('GET', '/notifications', null, b.token))[0].type, 'rejected');
  // 남의 글 삭제
  await t.ok('DELETE', `/posts/${p.id}`, null, adm.token);
  // 회원 목록·개인정보
  await t.fail(403, 'GET', '/users', null, a.token);
  const users = await t.ok('GET', '/users', null, adm.token, { private: '1' });
  assert.equal(users.length, 3);
  assert.equal(users.find((u) => u.username === 'member1').priv.realName, '홍길동');
  await t.fail(403, 'GET', `/users/${b.me.uid}/private`, null, a.token);
  assert.equal((await t.ok('GET', `/users/${b.me.uid}`, null, adm.token, { private: '1' })).priv.gender, '여');
  // 정지
  await t.fail(400, 'PATCH', `/users/${adm.me.uid}`, { banned: true }, adm.token);
  await t.ok('PATCH', `/users/${b.me.uid}`, { banned: true }, adm.token);
  assert.equal((await t.fail(403, 'POST', '/posts', post(), b.token)).error, 'banned');
  await t.ok('GET', '/posts', null, b.token, {});
  await t.ok('PATCH', `/users/${b.me.uid}`, { banned: false, role: 'admin' }, adm.token);
  await t.ok('POST', '/posts', post({ board: 'notice', category: 'notice' }), b.token);
  await t.fail(400, 'PATCH', `/users/${a.me.uid}`, { role: 'owner' }, adm.token);
  // 관리자 개인정보 열람 기록
  await t.fail(403, 'GET', '/audit', null, a.token);
  const log = await t.ok('GET', '/audit', null, adm.token);
  assert.ok(log.some((l) => l.action === 'list-private' && l.count === 3));
  assert.ok(log.some((l) => l.action === 'view-private' && l.target === b.me.uid));
  assert.ok(log.some((l) => l.action === 'set-banned'));
  assert.ok(log.every((l) => l.admin === 'admin'));
});

test('좋아요·댓글·알림·채택', async () => {
  const t = await setup({ qnaOpen: true });
  const a = await t.join('asker01');
  const b = await t.join('helper1');
  const { id } = await t.ok('POST', '/posts', post({ board: 'qna', category: '수학', title: '질문' }), a.token);
  // 좋아요는 한 번만
  await t.ok('POST', `/posts/${id}/like`, { on: true }, b.token);
  await t.ok('POST', `/posts/${id}/like`, { on: true }, b.token);
  let p = await t.ok('GET', `/posts/${id}`, null, b.token);
  assert.equal(p.likeCount, 1);
  assert.equal(p.liked, true);
  await t.ok('POST', `/posts/${id}/like`, { on: false }, b.token);
  await t.ok('POST', `/posts/${id}/like`, { on: false }, b.token);
  assert.equal((await t.ok('GET', `/posts/${id}`, null, b.token)).likeCount, 0);
  // 댓글
  await t.fail(400, 'POST', `/posts/${id}/comments`, { body: '' }, b.token);
  await t.fail(400, 'POST', `/posts/${id}/comments`, { body: 'x', image: 'data:image/png;base64,AAA' }, b.token);
  const c1 = await t.ok('POST', `/posts/${id}/comments`, { body: '답입니다', image: 'data:image/jpeg;base64,/9j/AAAA' }, b.token);
  await t.ok('POST', `/posts/${id}/comments`, { body: '고마워요' }, a.token);
  p = await t.ok('GET', `/posts/${id}`, null, a.token);
  assert.equal(p.commentCount, 2);
  const unread = await t.ok('GET', '/notifications/unread', null, a.token);
  assert.equal(unread.unread, true);
  const notes = await t.ok('GET', '/notifications', null, a.token);
  assert.equal(notes.length, 1);
  assert.equal(notes[0].type, 'comment');
  assert.equal(notes[0].fromName, 'helper1');
  await t.ok('POST', '/notifications/read', { ids: notes.map((n) => n.id) }, a.token);
  assert.equal((await t.ok('GET', '/notifications/unread', null, a.token)).unread, false);
  assert.equal((await t.ok('GET', '/notifications', null, b.token)).length, 0); // 내 글에 내가 단 댓글은 알림 없음
  // 댓글 좋아요
  await t.ok('POST', `/posts/${id}/comments/${c1.id}/like`, { on: true }, a.token);
  await t.ok('POST', `/posts/${id}/comments/${c1.id}/like`, { on: true }, a.token);
  let cs = await t.ok('GET', `/posts/${id}/comments`, null, a.token);
  assert.equal(cs[0].likeCount, 1);
  assert.equal(cs[0].liked, true);
  assert.equal((await t.ok('GET', `/posts/${id}/comments`, null, b.token))[0].liked, false);
  // 채택: 글쓴이만, 한 번만
  await t.fail(403, 'POST', `/posts/${id}/accept`, { commentId: c1.id }, b.token);
  await t.ok('POST', `/posts/${id}/accept`, { commentId: c1.id }, a.token);
  await t.fail(400, 'POST', `/posts/${id}/accept`, { commentId: c1.id }, a.token);
  p = await t.ok('GET', `/posts/${id}`, null, a.token);
  assert.equal(p.status, 'solved');
  assert.equal(p.acceptedCommentId, c1.id);
  assert.equal((await t.ok('GET', '/notifications', null, b.token))[0].type, 'accepted');
  // 댓글 삭제: 남의 것은 불가
  await t.fail(403, 'DELETE', `/posts/${id}/comments/${c1.id}`, null, a.token);
  await t.ok('DELETE', `/posts/${id}/comments/${c1.id}`, null, b.token);
  cs = await t.ok('GET', `/posts/${id}/comments`, null, a.token);
  assert.equal(cs.length, 1);
  assert.equal((await t.ok('GET', `/posts/${id}`, null, a.token)).commentCount, 1);
  assert.equal(await t.store.get(`P#${id}`, `CL#${a.me.uid}#${c1.id}`), null);
});

test('신고', async () => {
  const t = await setup();
  const adm = await t.join('admin');
  const a = await t.join('member1');
  const { id } = await t.ok('POST', '/posts', post({ title: '신고될 글' }), a.token);
  await t.fail(400, 'POST', '/reports', { postId: id, reason: '' }, adm.token);
  await t.fail(404, 'POST', '/reports', { postId: 'nope', reason: '광고' }, adm.token);
  await t.ok('POST', '/reports', { postId: id, reason: '광고·도배' }, adm.token);
  await t.fail(403, 'GET', '/reports', null, a.token);
  const list = await t.ok('GET', '/reports', null, adm.token);
  assert.equal(list.length, 1);
  assert.equal(list[0].target, '신고될 글');
  await t.ok('POST', `/reports/${list[0].id}/done`, {}, adm.token);
  assert.equal((await t.ok('GET', '/reports', null, adm.token)).length, 0);
});

test('배너', async () => {
  const t = await setup();
  const adm = await t.join('admin');
  const a = await t.join('member1');
  await t.fail(403, 'PUT', '/banners/cover', { text: '태산입시', sub: '설명' }, a.token);
  await t.fail(400, 'PUT', '/banners/cover', { text: '태산입시', sub: '설명', image: 'javascript:alert(1)' }, adm.token);
  await t.fail(400, 'PUT', '/banners/cover', { text: '태산입시', image: `data:image/jpeg;base64,${'A'.repeat(400000)}` }, adm.token);
  await t.ok('PUT', '/banners/cover', { text: '태산입시', sub: '설명', image: 'data:image/jpeg;base64,/9j/AA' }, adm.token);
  await t.ok('POST', '/banners', { kind: 'text', text: '설명회 안내', link: '#/notices' }, adm.token);
  await t.fail(400, 'POST', '/banners', { kind: 'text', text: '나쁜 링크', link: 'javascript:alert(1)' }, adm.token);
  await t.fail(400, 'POST', '/banners', { kind: 'event', text: '수능', date: '2026-13-40' }, adm.token);
  await t.fail(400, 'POST', '/banners', { kind: 'event', text: '', date: '2026-11-19' }, adm.token);
  const ev = await t.ok('POST', '/banners', { kind: 'event', text: '대학수학능력시험', date: '2026-11-19' }, adm.token);
  assert.equal((await t.ok('GET', '/banners')).find((x) => x.id === ev.id).date, '2026-11-19');
  await t.ok('DELETE', `/banners/${ev.id}`, null, adm.token);
  const list = await t.ok('GET', '/banners');
  assert.equal(list.length, 2);
  assert.equal(list.find((x) => x.id === 'cover').sub, '설명');
  await t.ok('DELETE', `/banners/${list.find((x) => x.kind === 'text').id}`, null, adm.token);
  assert.equal((await t.ok('GET', '/banners')).length, 1);
});

test('파일: 내 파일만 첨부, 글 지우면 파일도 삭제', async () => {
  const t = await setup();
  const a = await t.join('upload1');
  const b = await t.join('upload2');
  await t.fail(400, 'POST', '/files', { name: 'big.pdf', type: 'application/pdf', size: 6 * 1024 * 1024 }, a.token);
  const img = await t.ok('POST', '/files', { name: 'a.jpg', type: 'image/jpeg', size: 1000 }, a.token);
  const pdf = await t.ok('POST', '/files', { name: '../../시간표.pdf', type: 'application/pdf', size: 2000 }, a.token);
  assert.equal(pdf.name, '.._.._시간표.pdf');
  assert.match(img.upload.url, /^mem:u\//);
  const other = await t.ok('POST', '/files', { name: 'b.jpg', type: 'image/jpeg', size: 1000 }, b.token);
  await t.fail(400, 'POST', '/posts', post({ images: [{ id: other.id }] }), a.token);
  await t.fail(400, 'POST', '/posts', post({ images: [{ id: pdf.id }] }), a.token);
  await t.fail(400, 'POST', '/posts', post({ images: [{ id: img.id }, { id: img.id }] }), a.token);
  const { id } = await t.ok('POST', '/posts', post({ images: [{ id: img.id, name: '가짜', size: 1 }], files: [{ id: pdf.id }] }), a.token);
  const full = await t.ok('GET', `/posts/${id}`, null, b.token);
  assert.deepEqual(full.images, [{ id: img.id, name: 'a.jpg', type: 'image/jpeg', size: 1000 }]);
  const list = await t.ok('GET', '/posts', null, null, {});
  assert.equal(list[0].imageCount, 1);
  assert.equal(list[0].fileCount, 1);
  await t.fail(401, 'GET', `/files/${pdf.id}`);
  assert.match((await t.ok('GET', `/files/${pdf.id}`, null, b.token)).url, /\?dl$/);
  assert.doesNotMatch((await t.ok('GET', `/files/${img.id}`, null, b.token)).url, /\?dl$/);
  // 수정하면서 뺀 파일은 지워짐
  await t.ok('PATCH', `/posts/${id}`, post({ images: [{ id: img.id }], files: [] }), a.token);
  assert.deepEqual(t.removed, [`u/${a.me.uid}/${pdf.id}`]);
  await t.ok('DELETE', `/posts/${id}`, null, a.token);
  assert.equal(t.removed.length, 2);
  assert.deepEqual(await t.store.query({ pk: `P#${id}`, limit: 100 }), []);
});

test('여러 요청 한 번에', async () => {
  const t = await setup();
  const a = await t.join('batch01');
  await t.ok('POST', '/posts', post(), a.token);
  const r = await t.ok('POST', '/batch', { requests: [{ path: '/posts', query: { limit: '5' } }, { path: '/me' }, { path: '/nope' }, { path: '/batch' }] }, a.token);
  assert.deepEqual(r.responses.map((x) => x.status), [200, 200, 404, 405]);
  assert.equal(r.responses[0].body.length, 1);
  assert.equal(r.responses[1].body.username, 'batch01');
});

test('정렬: 새 글이 먼저', async () => {
  let clock = 1_700_000_000_000;
  const store = await makeStore();
  const app = createApp({ store, files: {}, idp: createDemoIdp(store, { now: () => clock }), env: { demo: true, now: () => clock } });
  const h = (method, path, body, token, query) => app.handle({ method, path, body, token, query });
  await h('POST', '/auth/start', { username: 'order1', password: 'tsPass_01', phone: '010-2222-3333' });
  const { body: { idToken } } = await h('POST', '/auth/confirm', { username: 'order1', password: 'tsPass_01', phone: '010-2222-3333', code: '123456', realName: '순서', gender: '남', age: 18, memberType: '학생', grade: '고3', agreeRules: true, agreePrivacy: true });
  for (const title of ['첫째', '둘째', '셋째']) { clock += 1000; await h('POST', '/posts', post({ title }), idToken); }
  const { body } = await h('GET', '/posts', null, null, { limit: '2' });
  assert.deepEqual(body.map((p) => p.title), ['셋째', '둘째']);
  const { body: rest } = await h('GET', '/posts', null, null, { before: `${String(body[1].createdAt).padStart(13, '0')}#${body[1].id}` });
  assert.deepEqual(rest.map((p) => p.title), ['첫째']);
});

test('체험 모드용 복사본(public/js/server-core.js)이 core.mjs 와 같음', async () => {
  const { readFile } = await import('node:fs/promises');
  const a = await readFile(new URL('../core.mjs', import.meta.url), 'utf8');
  const b = await readFile(new URL('../../../public/js/server-core.js', import.meta.url), 'utf8');
  assert.ok(a === b, 'scripts/sync-core.sh 를 실행하세요');
});

test('비밀번호 찾기·아이디 찾기·로그아웃', async () => {
  const t = await setup();
  const a = await t.join('mom_find', { phone: '010-4444-5555' });
  const f = await t.ok('POST', '/auth/forgot', { username: 'mom_find' });
  assert.equal(f.destination, '010-****-5555');
  assert.equal((await t.ok('POST', '/auth/forgot', { username: 'nobody1' })).sent, true); // 없는 아이디도 같은 응답
  await t.fail(400, 'POST', '/auth/reset', { username: 'mom_find', code: '000000', password: 'tsNewPass99' });
  await t.fail(400, 'POST', '/auth/reset', { username: 'mom_find', code: '123456', password: 'short' });
  await t.ok('POST', '/auth/reset', { username: 'mom_find', code: '123456', password: 'tsNewPass99' });
  await t.fail(400, 'POST', '/auth/reset', { username: 'mom_find', code: '123456', password: 'tsAgain999' }); // 한 번만
  await t.fail(401, 'POST', '/auth/login', { username: 'mom_find', password: 'tsPass_01' });
  const l = await t.ok('POST', '/auth/login', { username: 'mom_find', password: 'tsNewPass99' });
  for (let i = 0; i < 4; i++) await t.ok('POST', '/auth/forgot', { username: 'mom_find' });
  await t.fail(429, 'POST', '/auth/forgot', { username: 'mom_find' });
  // 아이디 찾기: 인증번호를 맞혀야 알려 줌
  await t.ok('POST', '/auth/find-id/start', { phone: '010-4444-5555' });
  assert.match(t.texts.at(-1).text, /아이디 찾기 인증번호는 123456/);
  assert.equal(t.texts.at(-1).to, '+821044445555');
  await t.fail(400, 'POST', '/auth/find-id/confirm', { phone: '010-4444-5555', code: '000000' });
  const r = await t.ok('POST', '/auth/find-id/confirm', { phone: '01044445555', code: '123456' });
  assert.equal(r.username, 'mom_find');
  await t.fail(400, 'POST', '/auth/find-id/confirm', { phone: '010-4444-5555', code: '123456' }); // 한 번 쓰면 끝
  await t.ok('POST', '/auth/find-id/start', { phone: '010-9999-0000' });
  assert.equal((await t.ok('POST', '/auth/find-id/confirm', { phone: '010-9999-0000', code: '123456' })).username, null);
  // 틀린 번호 5번이면 막힘
  await t.ok('POST', '/auth/find-id/start', { phone: '010-4444-5555' });
  for (let i = 0; i < 5; i++) await t.fail(400, 'POST', '/auth/find-id/confirm', { phone: '010-4444-5555', code: '000000' });
  await t.fail(400, 'POST', '/auth/find-id/confirm', { phone: '010-4444-5555', code: '123456' });
  assert.equal((await t.ok('POST', '/auth/logout', { refreshToken: l.refreshToken })).ok, true);
  assert.ok(a.me.uid);
});

test('스크랩·이전/다음 글·내 댓글', async () => {
  const t = await setup();
  const a = await t.join('writer_a');
  const b = await t.join('reader_b');
  const ids = [];
  for (const title of ['첫 글', '둘째 글', '셋째 글']) ids.push((await t.ok('POST', '/posts', post({ title }), a.token)).id);
  const mid = await t.ok('GET', `/posts/${ids[1]}`, null, b.token);
  assert.equal(mid.prev.title, '첫 글');
  assert.equal(mid.next.title, '셋째 글');
  assert.equal(mid.bookmarked, false);
  assert.equal((await t.ok('GET', `/posts/${ids[0]}`, null, b.token)).prev, null);
  await t.ok('POST', `/posts/${ids[0]}/bookmark`, { on: true }, b.token);
  await t.ok('POST', `/posts/${ids[2]}/bookmark`, { on: true }, b.token);
  assert.equal((await t.ok('GET', `/posts/${ids[0]}`, null, b.token)).bookmarked, true);
  let marks = await t.ok('GET', '/me/bookmarks', null, b.token);
  assert.deepEqual(marks.map((x) => x.title).sort(), ['셋째 글', '첫 글']);
  await t.ok('POST', `/posts/${ids[0]}/bookmark`, { on: false }, b.token);
  await t.ok('DELETE', `/posts/${ids[2]}`, null, a.token);
  marks = await t.ok('GET', '/me/bookmarks', null, b.token);
  assert.equal(marks.length, 0); // 지운 글은 목록에서 빠짐
  await t.ok('POST', `/posts/${ids[1]}/comments`, { body: '좋은 글이네요' }, b.token);
  const mine = await t.ok('GET', '/me/comments', null, b.token);
  assert.equal(mine.length, 1);
  assert.equal(mine[0].postTitle, '둘째 글');
  assert.equal((await t.ok('GET', '/me/comments', null, a.token)).length, 0);
});

test('답글·댓글 수정·답글 있는 댓글 삭제', async () => {
  const t = await setup();
  const a = await t.join('author_a');
  const b = await t.join('reply_b');
  const c = await t.join('reply_c');
  const { id } = await t.ok('POST', '/posts', post(), a.token);
  const top = await t.ok('POST', `/posts/${id}/comments`, { body: '질문 있어요' }, b.token);
  const rep = await t.ok('POST', `/posts/${id}/comments`, { body: '저도 궁금해요', parentId: top.id }, c.token);
  await t.fail(400, 'POST', `/posts/${id}/comments`, { body: '답글의 답글', parentId: rep.id }, a.token);
  await t.fail(404, 'POST', `/posts/${id}/comments`, { body: '없는 댓글', parentId: 'nope' }, a.token);
  const bn = await t.ok('GET', '/notifications', null, b.token);
  assert.equal(bn[0].type, 'reply');
  assert.ok((await t.ok('GET', '/notifications', null, a.token)).every((n) => n.type === 'comment'));
  // 수정
  await t.fail(403, 'PATCH', `/posts/${id}/comments/${top.id}`, { body: '남이 고침' }, c.token);
  await t.ok('PATCH', `/posts/${id}/comments/${top.id}`, { body: '질문 있어요(수정)' }, b.token);
  let cs = await t.ok('GET', `/posts/${id}/comments`, null, a.token);
  assert.equal(cs.find((x) => x.id === top.id).body, '질문 있어요(수정)');
  assert.ok(cs.find((x) => x.id === top.id).editedAt);
  assert.equal(cs.find((x) => x.id === rep.id).parentId, top.id);
  // 답글 있는 댓글은 '삭제된 댓글'로 남음
  await t.ok('DELETE', `/posts/${id}/comments/${top.id}`, null, b.token);
  cs = await t.ok('GET', `/posts/${id}/comments`, null, a.token);
  assert.equal(cs.length, 2);
  assert.equal(cs.find((x) => x.id === top.id).deleted, true);
  assert.equal(cs.find((x) => x.id === top.id).body, '');
  assert.equal((await t.ok('GET', `/posts/${id}`, null, a.token)).commentCount, 1);
  assert.equal((await t.ok('GET', '/me/comments', null, b.token)).length, 0);
  await t.ok('DELETE', `/posts/${id}/comments/${rep.id}`, null, c.token);
  assert.equal((await t.ok('GET', `/posts/${id}`, null, a.token)).commentCount, 0);
});

test('회원 차단', async () => {
  const t = await setup();
  const adm = await t.join('admin');
  const a = await t.join('block_a');
  const b = await t.join('block_b');
  const { id } = await t.ok('POST', '/posts', post({ title: 'b의 글' }), b.token);
  await t.ok('POST', '/posts', post({ title: 'a의 글' }), a.token);
  await t.ok('POST', `/posts/${id}/comments`, { body: 'b의 댓글' }, b.token);
  await t.fail(400, 'POST', '/me/blocks', { uid: a.me.uid }, a.token);
  await t.fail(400, 'POST', '/me/blocks', { uid: adm.me.uid }, a.token);
  await t.ok('POST', '/me/blocks', { uid: b.me.uid }, a.token);
  assert.deepEqual((await t.ok('GET', '/me/blocks', null, a.token)).map((x) => x.nickname), ['block_b']);
  assert.deepEqual((await t.ok('GET', '/posts', null, a.token, {})).map((x) => x.title), ['a의 글']);
  assert.equal((await t.ok('GET', '/posts', null, adm.token, {})).length, 2);
  const cs = await t.ok('GET', `/posts/${id}/comments`, null, a.token);
  assert.equal(cs[0].blocked, true);
  assert.equal(cs[0].body, '');
  await t.ok('POST', '/me/blocks', { uid: b.me.uid, on: false }, a.token);
  assert.equal((await t.ok('GET', '/posts', null, a.token, {})).length, 2);
  // 탈퇴하면 내 스크랩·차단·알림도 지워짐
  await t.ok('POST', '/me/blocks', { uid: b.me.uid }, a.token);
  await t.ok('DELETE', '/me', { password: 'tsPass_01' }, a.token);
  assert.deepEqual(await t.store.query({ pk: `U#${a.me.uid}`, limit: 100 }), []);
});

test('투표: 한 번만, 결과 공개 시점, 마감, 수정해도 유지', async () => {
  let clock = Date.now();
  const t = await setup({ now: () => clock });
  const a = await t.join('poll_a'), b = await t.join('poll_b'), c = await t.join('poll_c');
  const poll = { options: ['수학', '영어', '국어'], multi: false, days: 3 };
  await t.fail(400, 'POST', '/posts', post({ poll: { ...poll, options: ['하나'] } }), a.token);
  await t.fail(400, 'POST', '/posts', post({ poll: { ...poll, options: ['같음', '같음'] } }), a.token);
  await t.fail(400, 'POST', '/posts', post({ poll: { ...poll, days: 0 } }), a.token);
  await t.fail(400, 'POST', '/posts', post({ poll: { ...poll, options: [{ x: 1 }, '둘'] } }), a.token);
  await t.fail(400, 'POST', '/posts', post({ board: 'data', category: 'note', source: '직접 작성', poll }), a.token);
  const { id } = await t.ok('POST', '/posts', post({ poll }), a.token);
  const list = await t.ok('GET', '/posts', null, null, { board: 'talk' });
  assert.equal(list.find((x) => x.id === id).hasPoll, true);
  // 투표 전에는 결과가 안 보이고, 글쓴이는 보임
  assert.equal((await t.ok('GET', `/posts/${id}`, null, b.token)).poll.counts, null);
  assert.deepEqual((await t.ok('GET', `/posts/${id}`, null, a.token)).poll.counts, [0, 0, 0]);
  await t.fail(400, 'POST', `/posts/${id}/vote`, { choices: [0, 1] }, b.token);
  await t.fail(400, 'POST', `/posts/${id}/vote`, { choices: [3] }, b.token);
  await t.fail(400, 'POST', `/posts/${id}/vote`, { choices: ['0'] }, b.token);
  await t.fail(400, 'POST', `/posts/${id}/vote`, { choices: [] }, b.token);
  await t.fail(401, 'POST', `/posts/${id}/vote`, { choices: [1] });
  const r = await t.ok('POST', `/posts/${id}/vote`, { choices: [1] }, b.token);
  assert.deepEqual(r.counts, [0, 1, 0]); assert.deepEqual(r.mine, [1]); assert.equal(r.voters, 1);
  await t.fail(409, 'POST', `/posts/${id}/vote`, { choices: [0] }, b.token);
  // 글을 고쳐도 투표는 그대로
  await t.ok('PATCH', `/posts/${id}`, post({ title: '고친 제목', poll: { options: ['바꿈', '시도'], days: 30 } }), a.token);
  const after = (await t.ok('GET', `/posts/${id}`, null, b.token)).poll;
  assert.deepEqual(after.options, ['수학', '영어', '국어']); assert.deepEqual(after.counts, [0, 1, 0]);
  // 마감 뒤에는 투표 불가, 결과 공개
  clock += 3 * 86400000 + 1;
  await t.fail(400, 'POST', `/posts/${id}/vote`, { choices: [0] }, c.token);
  const closed = (await t.ok('GET', `/posts/${id}`, null, c.token)).poll;
  assert.equal(closed.closed, true); assert.deepEqual(closed.counts, [0, 1, 0]);
  // 복수 선택
  const m = await t.ok('POST', '/posts', post({ poll: { options: ['가', '나', '다'], multi: true, days: 1 } }), a.token);
  await t.fail(400, 'POST', `/posts/${m.id}/vote`, { choices: [2, 0, 0] }, c.token);
  assert.deepEqual((await t.ok('POST', `/posts/${m.id}/vote`, { choices: [2, 0] }, c.token)).counts, [1, 0, 1]);
  // 글을 지우면 투표 기록도 함께 지워짐
  await t.ok('DELETE', `/posts/${m.id}`, null, a.token);
  assert.equal((await t.store.query({ pk: `P#${m.id}`, limit: 10 })).length, 0);
});

test('댓글 @아이디 언급 알림, 나를 차단한 사람에게는 알림 없음', async () => {
  const t = await setup();
  const a = await t.join('ment_a'), b = await t.join('ment_b'), c = await t.join('ment_c'), d = await t.join('ment_d');
  const { id } = await t.ok('POST', '/posts', post(), a.token);
  const notes = async (x) => t.ok('GET', '/notifications', null, x.token);
  // c, d 언급(메일 주소·없는 아이디·글쓴이 중복은 무시)
  await t.ok('POST', `/posts/${id}/comments`, { body: '@ment_c @ment_d 같이 가요 @ment_a @nobody_here test@ment_c.com' }, b.token);
  assert.deepEqual((await notes(a)).map((n) => n.type), ['comment']);
  assert.deepEqual((await notes(c)).map((n) => n.type), ['mention']);
  assert.deepEqual((await notes(d)).map((n) => n.type), ['mention']);
  // d 가 b 를 차단하면 b 의 언급 알림이 가지 않음
  await t.ok('POST', '/me/blocks', { uid: b.me.uid }, d.token);
  await t.ok('POST', `/posts/${id}/comments`, { body: '@ment_d 다시 불러요' }, b.token);
  assert.equal((await notes(d)).length, 1);
  // a 가 b 를 차단하면 내 글 댓글 알림도 없음
  await t.ok('POST', '/me/blocks', { uid: b.me.uid }, a.token);
  await t.ok('POST', `/posts/${id}/comments`, { body: '또 댓글' }, b.token);
  assert.equal((await notes(a)).length, 2); // 차단 전 댓글 2개만
  // 숨긴 글에서는 언급 알림 없음
  const admin = await t.join('ment_admin');
  await t.store.update(`U#${admin.me.uid}`, 'PROFILE', { set: { role: 'admin' } });
  await t.ok('POST', `/posts/${id}/hide`, { hidden: true }, (await t.ok('POST', '/auth/login', { username: 'ment_admin', password: 'tsPass_01' })).idToken);
  await t.ok('POST', `/posts/${id}/comments`, { body: '@ment_c 숨긴 글' }, a.token);
  assert.equal((await notes(c)).length, 1);
});

test('보안: 가입 확인은 인증번호를 받은 번호로만, 탈퇴하면 번호 잠금 풀림', async () => {
  const t = await setup();
  const base = { password: 'tsPass_01', realName: '홍길동', gender: '여', age: 45, memberType: '학부모', childGrade: '고2', agreeRules: true, agreePrivacy: true };
  await t.ok('POST', '/auth/start', { username: 'sec_evil', password: 'tsPass_01', phone: '010-1111-1111' });
  // 다른 사람 번호로 확인 → 거절, 그 번호는 잠기지 않음
  await t.fail(400, 'POST', '/auth/confirm', { ...base, username: 'sec_evil', phone: '010-2222-2222', code: '123456' });
  assert.equal(await t.store.get('PHONE#+821022222222', 'PHONE'), null);
  await t.ok('POST', '/auth/start', { username: 'sec_victim', password: 'tsPass_01', phone: '010-2222-2222' });
  // 만 14세 미만: 보호자 번호를 자기 번호로 넣으면 거절(본인 번호가 고정되므로)
  await t.ok('POST', '/auth/start', { username: 'sec_kid', password: 'tsPass_01', phone: '010-4444-5555' });
  await t.ok('POST', '/auth/guardian/start', { phone: '010-4444-5555', childName: '어린이' });
  const kid = { ...base, username: 'sec_kid', code: '123456', age: 12, memberType: '학생', grade: '중1', childGrade: '', guardianName: '엄마', guardianPhone: '010-4444-5555', guardianCode: '123456' };
  await t.fail(400, 'POST', '/auth/confirm', { ...kid, phone: '010-7777-8888' });
  await t.fail(400, 'POST', '/auth/confirm', { ...kid, phone: '010-4444-5555' });
  // 정상 가입 뒤 탈퇴하면 같은 번호로 다시 가입 가능
  const r = await t.ok('POST', '/auth/confirm', { ...base, username: 'sec_evil', phone: '010-1111-1111', code: '123456' });
  await t.ok('DELETE', '/me', { password: 'tsPass_01' }, r.idToken);
  assert.equal(await t.store.get('PHONE#+821011111111', 'PHONE'), null);
  await t.ok('POST', '/auth/start', { username: 'sec_again', password: 'tsPass_01', phone: '010-1111-1111' });
});

test('보안: 인증번호를 동시에 많이 넣어도 5번까지만 확인', async () => {
  const t = await setup({ demo: false });
  await t.ok('POST', '/auth/find-id/start', { phone: '010-1212-3434' });
  const real = t.texts.at(-1).text.match(/(\d{6})/)[1];
  const guesses = Array.from({ length: 30 }, (_, i) => String(100000 + i)).filter((g) => g !== real);
  guesses.splice(20, 0, real);
  const rs = await Promise.all(guesses.map((code) => t.call('POST', '/auth/find-id/confirm', { phone: '010-1212-3434', code })));
  assert.equal(rs.filter((r) => r.status === 200).length, 0);
  assert.equal((await t.call('POST', '/auth/find-id/confirm', { phone: '010-1212-3434', code: real })).status, 400);
});

test('보안: 정지된 관리자는 관리자 기능을 쓸 수 없음', async () => {
  const t = await setup();
  const owner = await t.join('admin');
  const rogue = await t.join('sec_rogue');
  const sock = await t.join('sec_sock');
  await t.ok('PATCH', `/users/${rogue.me.uid}`, { role: 'admin' }, owner.token);
  await t.ok('GET', '/users', null, rogue.token, { private: '1' });
  await t.ok('PATCH', `/users/${rogue.me.uid}`, { banned: true }, owner.token);
  await t.fail(403, 'GET', '/users', null, rogue.token, { private: '1' });
  await t.fail(403, 'GET', `/users/${sock.me.uid}/private`, null, rogue.token);
  await t.fail(403, 'PATCH', `/users/${sock.me.uid}`, { role: 'admin' }, rogue.token);
});
