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
  const app = createApp({ store, files, idp, env: { demo: true, ...env } });
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
    await ok('POST', '/auth/start', { username, password: 'password1', phone });
    const r = await ok('POST', '/auth/confirm', {
      username, password: 'password1', phone, code: '123456', realName: '홍길동', gender: '여', age: 45,
      memberType: '학부모', childGrade: '고2', agreeRules: true, agreePrivacy: true, ...extra,
    });
    return { token: r.idToken, me: r.me, refresh: r.refreshToken };
  };
  return { store, app, call, ok, fail, join, removed };
}

const post = (over = {}) => ({ board: 'talk', category: 'daily', title: '안녕하세요', body: '본문입니다', images: [], files: [], source: '', ...over });

test('회원가입: 인증·검증·중복', async () => {
  const t = await setup();
  await t.fail(400, 'POST', '/auth/start', { username: 'AB', password: 'password1', phone: '010-1111-2222' });
  await t.fail(400, 'POST', '/auth/start', { username: 'mom01', password: 'short', phone: '010-1111-2222' });
  await t.fail(400, 'POST', '/auth/start', { username: 'mom01', password: 'password1', phone: '02-123-4567' });
  await t.ok('POST', '/auth/start', { username: 'mom01', password: 'password1', phone: '010-1111-2222' });
  const base = { username: 'mom01', password: 'password1', phone: '010-1111-2222', realName: '김엄마', gender: '여', age: 44, memberType: '학부모', childGrade: '중3', agreeRules: true, agreePrivacy: true };
  await t.fail(400, 'POST', '/auth/confirm', { ...base, code: '000000' });
  await t.fail(400, 'POST', '/auth/confirm', { ...base, code: '123456', agreePrivacy: false });
  await t.fail(400, 'POST', '/auth/confirm', { ...base, code: '123456', childGrade: '' });
  const r = await t.ok('POST', '/auth/confirm', { ...base, code: '123456' });
  assert.equal(r.me.username, 'mom01');
  assert.equal(r.me.grade, '학부모');
  assert.equal(r.me.role, 'member');
  assert.ok(r.idToken && r.refreshToken);
  // 같은 아이디·같은 번호는 다시 못 씀
  assert.equal((await t.fail(409, 'POST', '/auth/start', { username: 'mom01', password: 'password1', phone: '010-9999-2222' })).error, 'username-taken');
  assert.equal((await t.fail(409, 'POST', '/auth/start', { username: 'mom02', password: 'password1', phone: '01011112222' })).error, 'phone-taken');
  // 다시 확인해도 기존 계정이 지워지지 않음
  await t.fail(400, 'POST', '/auth/confirm', { ...base, code: '123456' });
  await t.ok('POST', '/auth/login', { username: 'mom01', password: 'password1' });
  // 만 14세 미만은 보호자 동의
  await t.ok('POST', '/auth/start', { username: 'kid01', password: 'password1', phone: '010-3333-4444' });
  const kid = { username: 'kid01', password: 'password1', phone: '010-3333-4444', code: '123456', realName: '어린이', gender: '남', age: 13, memberType: '학생', grade: '중1', agreeRules: true, agreePrivacy: true };
  await t.fail(400, 'POST', '/auth/confirm', kid);
  const k = await t.ok('POST', '/auth/confirm', { ...kid, guardianConsent: true });
  assert.equal(k.me.grade, '중1');
  const priv = await t.ok('GET', `/users/${k.me.uid}/private`, null, k.idToken);
  assert.equal(priv.guardianConsent, true);
  assert.equal(priv.childGrade, '');
});

test('확인 안 한 가입은 다시 시작할 수 있음', async () => {
  const t = await setup();
  await t.ok('POST', '/auth/start', { username: 'half01', password: 'password1', phone: '010-5555-6666' });
  await t.ok('POST', '/auth/start', { username: 'half01', password: 'password2', phone: '010-5555-7777' });
  const r = await t.ok('POST', '/auth/confirm', { username: 'half01', password: 'password2', phone: '010-5555-7777', code: '123456', realName: '반쪽', gender: '남', age: 17, memberType: '학생', grade: '고1', agreeRules: true, agreePrivacy: true });
  assert.equal(r.me.username, 'half01');
});

test('문자 발송 횟수 제한', async () => {
  const t = await setup({ smsDailyMax: 3 });
  for (let i = 0; i < 3; i++) await t.ok('POST', '/auth/start', { username: `user0${i}`, password: 'password1', phone: `010-7000-000${i}` });
  assert.equal((await t.fail(429, 'POST', '/auth/start', { username: 'user09', password: 'password1', phone: '010-7000-0009' })).error, 'too-many-requests');
  const t2 = await setup();
  for (let i = 0; i < 5; i++) await t2.ok('POST', '/auth/start', { username: `same0${i}`, password: 'password1', phone: '010-7000-1111' });
  await t2.fail(429, 'POST', '/auth/start', { username: 'same09', password: 'password1', phone: '010-7000-1111' });
});

test('로그인·토큰 갱신·비밀번호 변경·탈퇴', async () => {
  const t = await setup();
  const a = await t.join('papa01');
  await t.fail(401, 'POST', '/auth/login', { username: 'papa01', password: 'wrongpass' });
  const l = await t.ok('POST', '/auth/login', { username: 'PAPA01 ', password: 'password1' });
  assert.equal(l.me.uid, a.me.uid);
  const r = await t.ok('POST', '/auth/refresh', { refreshToken: l.refreshToken });
  assert.ok(r.idToken);
  await t.fail(401, 'POST', '/auth/refresh', { refreshToken: 'nope' });
  assert.equal((await t.ok('GET', '/me', null, r.idToken)).username, 'papa01');
  assert.equal((await t.fail(401, 'GET', '/me', null, 'demo.garbage')).error, 'session-expired');
  await t.fail(401, 'POST', '/auth/password', { oldPassword: 'bad', newPassword: 'newpassword' }, a.token);
  await t.fail(400, 'POST', '/auth/password', { oldPassword: 'password1', newPassword: 'short' }, a.token);
  await t.ok('POST', '/auth/password', { oldPassword: 'password1', newPassword: 'newpassword' }, a.token);
  await t.fail(401, 'POST', '/auth/login', { username: 'papa01', password: 'password1' });
  await t.ok('POST', '/auth/login', { username: 'papa01', password: 'newpassword' });
  // 탈퇴하면 같은 번호로 다시 가입 가능
  await t.fail(401, 'DELETE', '/me', { password: 'password1' }, a.token);
  await t.ok('DELETE', '/me', { password: 'newpassword' }, a.token);
  await t.fail(401, 'POST', '/auth/login', { username: 'papa01', password: 'newpassword' });
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
  await h('POST', '/auth/start', { username: 'order1', password: 'password1', phone: '010-2222-3333' });
  const { body: { idToken } } = await h('POST', '/auth/confirm', { username: 'order1', password: 'password1', phone: '010-2222-3333', code: '123456', realName: '순서', gender: '남', age: 18, memberType: '학생', grade: '고3', agreeRules: true, agreePrivacy: true });
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
