// Lambda 부분 시험: Cognito 토큰 확인, Cognito 오류 → 한국어 안내, S3 주소 발급, HTTP 요청 처리
// node --test aws/api/test/*.test.mjs (DynamoDB Local 이 있으면 DDB_ENDPOINT 로 함께 시험)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { S3Client } from '@aws-sdk/client-s3';
import { createCognitoIdp, createS3Files, makeHandler } from '../index.mjs';
import { createApp, createMemoryStore } from '../core.mjs';

const REGION = 'ap-northeast-2', POOL = 'ap-northeast-2_TEST', CLIENT = 'client123';
const ISS = `https://cognito-idp.${REGION}.amazonaws.com/${POOL}`;
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'k1', alg: 'RS256', use: 'sig' };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
function jwt(claims, { kid = 'k1', key = privateKey } = {}) {
  const h = b64({ alg: 'RS256', kid }), p = b64(claims);
  return `${h}.${p}.${sign('RSA-SHA256', Buffer.from(`${h}.${p}`), key).toString('base64url')}`;
}
let jwksCalls = 0;
globalThis.fetch = async (url) => {
  assert.equal(url, `${ISS}/.well-known/jwks.json`);
  jwksCalls++;
  return { json: async () => ({ keys: [jwk] }) };
};

// Cognito 흉내
function fakeCognito() {
  const users = new Map();
  const err = (name) => Object.assign(new Error(name), { name });
  let n = 0;
  return {
    users,
    async send(cmd) {
      const i = cmd.input, name = cmd.constructor.name;
      if (name === 'SignUpCommand') {
        assert.equal(i.ClientId, CLIENT);
        if (users.has(i.Username)) throw err('UsernameExistsException');
        users.set(i.Username, { sub: `sub-${++n}`, password: i.Password, phone: i.UserAttributes[0].Value, status: 'UNCONFIRMED', code: '654321' });
        return {};
      }
      const u = users.get(i.Username || i.AuthParameters?.USERNAME);
      if (name === 'ConfirmSignUpCommand') {
        if (!u) throw err('UserNotFoundException');
        if (u.status !== 'UNCONFIRMED') throw err('NotAuthorizedException');
        if (u.code !== i.ConfirmationCode) throw err('CodeMismatchException');
        u.status = 'CONFIRMED'; return {};
      }
      if (name === 'AdminGetUserCommand') {
        if (!u) throw err('UserNotFoundException');
        return { UserStatus: u.status, UserAttributes: [{ Name: 'sub', Value: u.sub }, { Name: 'phone_number', Value: u.phone }] };
      }
      if (name === 'AdminDeleteUserCommand') { if (!u) throw err('UserNotFoundException'); users.delete(i.Username); return {}; }
      if (name === 'AdminSetUserPasswordCommand') { u.password = i.Password; return {}; }
      if (name === 'AdminInitiateAuthCommand') {
        assert.equal(i.UserPoolId, POOL);
        if (i.AuthFlow === 'REFRESH_TOKEN_AUTH') {
          const who = [...users.entries()].find(([, x]) => `r-${x.sub}` === i.AuthParameters.REFRESH_TOKEN);
          if (!who) throw err('NotAuthorizedException');
          return { AuthenticationResult: { IdToken: idFor(who[0], who[1]), ExpiresIn: 3600 } };
        }
        if (!u) throw err('UserNotFoundException');
        if (u.status !== 'CONFIRMED') throw err('UserNotConfirmedException');
        if (u.password !== i.AuthParameters.PASSWORD) throw err('NotAuthorizedException');
        return { AuthenticationResult: { IdToken: idFor(i.AuthParameters.USERNAME, u), RefreshToken: `r-${u.sub}`, ExpiresIn: 3600 } };
      }
      throw new Error(`unexpected ${name}`);
    },
  };
}
const idFor = (username, u, over = {}) => jwt({ sub: u.sub, iss: ISS, aud: CLIENT, token_use: 'id', exp: Math.floor(Date.now() / 1000) + 3600, 'cognito:username': username, phone_number: u.phone, ...over });

test('토큰 확인: 서명·발급처·앱·종류·만료', async () => {
  const idp = createCognitoIdp({ poolId: POOL, clientId: CLIENT, region: REGION, client: fakeCognito() });
  const u = { sub: 's1', phone: '+821012345678' };
  assert.deepEqual(await idp.verify(idFor('mom01', u)), { sub: 's1', username: 'mom01', phone: '+821012345678' });
  assert.equal(await idp.verify(idFor('mom01', u, { aud: 'other' })), null);
  assert.equal(await idp.verify(idFor('mom01', u, { iss: 'https://evil' })), null);
  assert.equal(await idp.verify(idFor('mom01', u, { token_use: 'access' })), null);
  assert.equal(await idp.verify(idFor('mom01', u, { exp: Math.floor(Date.now() / 1000) - 10 })), null);
  const other = generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey;
  assert.equal(await idp.verify(jwt({ sub: 's1', iss: ISS, aud: CLIENT, token_use: 'id', exp: 9e9 }, { key: other })), null);
  assert.equal(await idp.verify(jwt({ sub: 's1', iss: ISS, aud: CLIENT, token_use: 'id', exp: 9e9 }, { kid: 'nope' })), null);
  const h = b64({ alg: 'none', kid: 'k1' }); const p = b64({ sub: 's1', iss: ISS, aud: CLIENT, token_use: 'id', exp: 9e9 });
  assert.equal(await idp.verify(`${h}.${p}.x`), null);
  assert.ok(jwksCalls <= 2, `jwks fetched ${jwksCalls} times`);
});

test('Cognito 가입·로그인 흐름이 HTTP 요청으로 동작', async () => {
  const cognito = fakeCognito();
  const store = process.env.DDB_ENDPOINT ? await (await import('./dynamo.mjs')).makeDynamoStore() : createMemoryStore();
  const files = createS3Files('files-bucket', new S3Client({ region: REGION, credentials: { accessKeyId: 'AKIAEXAMPLE', secretAccessKey: 'secret' } }));
  const app = createApp({ store, files, idp: createCognitoIdp({ poolId: POOL, clientId: CLIENT, region: REGION, client: cognito }), env: {} });
  const handler = makeHandler(() => app);
  const call = async (method, path, body, token, query) => {
    const r = await handler({ rawPath: `/api${path}`, requestContext: { http: { method } }, headers: token ? { authorization: `Bearer ${token}` } : {}, queryStringParameters: query,
      body: body ? Buffer.from(JSON.stringify(body)).toString('base64') : undefined, isBase64Encoded: true });
    assert.equal(r.headers['cache-control'], 'no-store');
    return { status: r.statusCode, body: JSON.parse(r.body) };
  };
  const acct = { username: 'mom01', password: 'password1', phone: '010-1234-5678' };
  assert.equal((await call('POST', '/auth/start', acct)).status, 200);
  assert.equal(cognito.users.get('mom01').phone, '+821012345678');
  const info = { ...acct, realName: '김엄마', gender: '여', age: 44, memberType: '학부모', childGrade: '고1', agreeRules: true, agreePrivacy: true };
  const wrong = await call('POST', '/auth/confirm', { ...info, code: '111111' });
  assert.equal(wrong.status, 400);
  assert.equal(wrong.body.error, 'invalid-code');
  const ok = await call('POST', '/auth/confirm', { ...info, code: '654321' });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  assert.equal(ok.body.me.uid, 'sub-1');
  // 다시 확인 → 기존 계정 유지
  assert.equal((await call('POST', '/auth/confirm', { ...info, code: '654321' })).status, 400);
  assert.ok(cognito.users.has('mom01'));
  // 로그인 실패·성공
  assert.equal((await call('POST', '/auth/login', { username: 'mom01', password: 'bad' })).body.error, 'invalid-credential');
  const login = await call('POST', '/auth/login', { username: 'mom01', password: 'password1' });
  assert.equal(login.status, 200);
  const me = await call('GET', '/me', null, login.body.idToken);
  assert.equal(me.body.username, 'mom01');
  assert.equal((await call('GET', '/me', null, 'bad.token.here')).body.error, 'session-expired');
  const rf = await call('POST', '/auth/refresh', { refreshToken: login.body.refreshToken });
  assert.equal(rf.status, 200);
  assert.equal((await call('POST', '/auth/refresh', { refreshToken: 'r-nope' })).body.error, 'session-expired');
  // 확인 안 한 가입은 지우고 다시
  await call('POST', '/auth/start', { username: 'half01', password: 'password1', phone: '010-2222-3333' });
  assert.equal((await call('POST', '/auth/start', { username: 'half01', password: 'password2', phone: '010-2222-4444' })).status, 200);
  assert.equal(cognito.users.get('half01').phone, '+821022224444');
  assert.equal((await call('POST', '/auth/start', { username: 'mom01', password: 'password1', phone: '010-9999-8888' })).body.error, 'username-taken');
  // 파일 주소
  const f = await call('POST', '/files', { name: '수학 자료.pdf', type: 'application/pdf', size: 1234 }, rf.body.idToken);
  assert.equal(f.status, 200);
  assert.match(f.body.upload.url, /files-bucket/);
  assert.equal(f.body.upload.fields['Content-Type'], 'application/pdf');
  const policy = JSON.parse(Buffer.from(f.body.upload.fields.Policy, 'base64').toString());
  assert.ok(policy.conditions.some((c) => Array.isArray(c) && c[0] === 'content-length-range' && c[2] === 1234));
  const g = await call('GET', `/files/${f.body.id}`, null, rf.body.idToken);
  const url = new URL(g.body.url);
  assert.equal(url.searchParams.get('response-content-type'), 'application/octet-stream');
  assert.match(url.searchParams.get('response-content-disposition'), /^attachment; filename="__ __.pdf"; filename\*=UTF-8''%EC%88%98/);
  // 비밀번호 변경·탈퇴
  assert.equal((await call('POST', '/auth/password', { oldPassword: 'password1', newPassword: 'password9' }, rf.body.idToken)).status, 200);
  assert.equal(cognito.users.get('mom01').password, 'password9');
  assert.equal((await call('DELETE', '/me', { password: 'password9' }, rf.body.idToken)).status, 200);
  assert.ok(!cognito.users.has('mom01'));
  assert.equal((await call('POST', '/auth/start', { username: 'mom02', password: 'password1', phone: '010-1234-5678' })).status, 200);
  // 없는 주소·잘못된 메서드
  assert.equal((await call('GET', '/nope')).status, 404);
  assert.equal((await call('DELETE', '/banners')).status, 405);
});
