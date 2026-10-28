// AWS Lambda 진입점: API Gateway(HTTP API) 요청 → core.mjs 규칙 → DynamoDB·S3·Cognito
import { createHash, createPublicKey, verify as rsaVerify } from 'node:crypto';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient, GetCommand, PutCommand, UpdateCommand, DeleteCommand, QueryCommand,
  BatchGetCommand, BatchWriteCommand, TransactWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import { S3Client, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  CognitoIdentityProviderClient, SignUpCommand, ConfirmSignUpCommand, AdminGetUserCommand, AdminDeleteUserCommand,
  AdminInitiateAuthCommand, AdminSetUserPasswordCommand, ForgotPasswordCommand, ConfirmForgotPasswordCommand, RevokeTokenCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { createApp, ApiError, Conflict } from './core.mjs';

const { TABLE, BUCKET, USER_POOL_ID, CLIENT_ID, SMS_DAILY_MAX, QNA_OPEN, AWS_REGION, DYNAMO_ENDPOINT } = process.env;

/* ---------------- DynamoDB 저장소 ---------------- */
export function createDynamoStore(table, client) {
  const doc = DynamoDBDocumentClient.from(client, { marshallOptions: { removeUndefinedValues: true } });
  const isConflict = (e) => e?.name === 'ConditionalCheckFailedException'
    || (e?.name === 'TransactionCanceledException' && (e.CancellationReasons || []).some((r) => r?.Code === 'ConditionalCheckFailed'));
  const wrap = async (p) => { try { return await p; } catch (e) { if (isConflict(e)) throw new Conflict(e.message); throw e; } };

  function updateParams(pk, sk, { set = {}, add = {}, remove = [] } = {}, opts = {}) {
    const names = {}, values = {};
    let i = 0;
    const n = (k) => { const t = `#n${i++}`; names[t] = k; return t; };
    const v = (x) => { const t = `:v${i++}`; values[t] = x; return t; };
    const parts = [];
    const sets = Object.entries(set).filter(([, x]) => x !== undefined).map(([k, x]) => `${n(k)} = ${v(x)}`);
    if (sets.length) parts.push(`SET ${sets.join(', ')}`);
    const adds = Object.entries(add).map(([k, x]) => `${n(k)} ${v(x)}`);
    if (adds.length) parts.push(`ADD ${adds.join(', ')}`);
    if (remove.length) parts.push(`REMOVE ${remove.map(n).join(', ')}`);
    const conds = [];
    if (!opts.upsert) conds.push('attribute_exists(pk)');
    for (const [k, x] of Object.entries(opts.ifEq || {})) conds.push(`${n(k)} = ${v(x)}`);
    for (const [k, x] of Object.entries(opts.ifBelow || {})) { const t = n(k); conds.push(`(attribute_not_exists(${t}) OR ${t} < ${v(x)})`); }
    const p = { TableName: table, Key: { pk, sk }, UpdateExpression: parts.join(' '), ExpressionAttributeNames: names };
    if (Object.keys(values).length) p.ExpressionAttributeValues = values;
    if (conds.length) p.ConditionExpression = conds.join(' AND ');
    return p;
  }
  const chunk = (a, n) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

  return {
    async get(pk, sk) { return (await doc.send(new GetCommand({ TableName: table, Key: { pk, sk } }))).Item || null; },
    async getMany(keys) {
      const found = new Map();
      for (const part of chunk(keys, 100)) {
        let req = { [table]: { Keys: part.map(([pk, sk]) => ({ pk, sk })) } };
        for (let tries = 0; req && Object.keys(req).length && tries < 6; tries++) {
          const r = await doc.send(new BatchGetCommand({ RequestItems: req }));
          for (const it of r.Responses?.[table] || []) found.set(`${it.pk}\u0001${it.sk}`, it);
          req = r.UnprocessedKeys && Object.keys(r.UnprocessedKeys).length ? r.UnprocessedKeys : null;
          if (req) await new Promise((res) => setTimeout(res, 50 * 2 ** tries));
        }
      }
      return keys.map(([pk, sk]) => found.get(`${pk}\u0001${sk}`) || null);
    },
    async put(item, opts = {}) {
      await wrap(doc.send(new PutCommand({ TableName: table, Item: item, ...(opts.ifNotExists ? { ConditionExpression: 'attribute_not_exists(pk)' } : {}) })));
    },
    async update(pk, sk, patch, opts = {}) {
      const r = await wrap(doc.send(new UpdateCommand({ ...updateParams(pk, sk, patch, opts), ReturnValues: 'ALL_NEW' })));
      return r.Attributes;
    },
    async del(pk, sk, opts = {}) {
      await wrap(doc.send(new DeleteCommand({ TableName: table, Key: { pk, sk }, ...(opts.ifExists ? { ConditionExpression: 'attribute_exists(pk)' } : {}) })));
    },
    async delMany(keys) {
      for (const part of chunk(keys, 25)) {
        let req = { [table]: part.map(([pk, sk]) => ({ DeleteRequest: { Key: { pk, sk } } })) };
        for (let tries = 0; req && tries < 6; tries++) {
          const r = await doc.send(new BatchWriteCommand({ RequestItems: req }));
          req = r.UnprocessedItems && Object.keys(r.UnprocessedItems).length ? r.UnprocessedItems : null;
          if (req) await new Promise((res) => setTimeout(res, 50 * 2 ** tries));
        }
      }
    },
    async query({ index, pk, skBegins, skLt, skGt, desc, limit = 100 }) {
      const P = index ? `${index}pk` : 'pk', S = index ? `${index}sk` : 'sk';
      const p = { TableName: table, KeyConditionExpression: '#p = :p', ExpressionAttributeNames: { '#p': P }, ExpressionAttributeValues: { ':p': pk }, ScanIndexForward: !desc };
      if (index) p.IndexName = index;
      if (skBegins) { p.KeyConditionExpression += ' AND begins_with(#s, :s)'; p.ExpressionAttributeNames['#s'] = S; p.ExpressionAttributeValues[':s'] = skBegins; }
      else if (skLt) { p.KeyConditionExpression += ' AND #s < :s'; p.ExpressionAttributeNames['#s'] = S; p.ExpressionAttributeValues[':s'] = skLt; }
      else if (skGt) { p.KeyConditionExpression += ' AND #s > :s'; p.ExpressionAttributeNames['#s'] = S; p.ExpressionAttributeValues[':s'] = skGt; }
      const out = [];
      let start;
      do {
        const r = await doc.send(new QueryCommand({ ...p, Limit: Math.min(1000, limit - out.length), ExclusiveStartKey: start }));
        out.push(...(r.Items || []));
        start = r.LastEvaluatedKey;
      } while (start && out.length < limit);
      return out.slice(0, limit);
    },
    async transact(ops) {
      const items = ops.map((o) => {
        if (o.put) return { Put: { TableName: table, Item: o.put, ...(o.ifNotExists ? { ConditionExpression: 'attribute_not_exists(pk)' } : {}) } };
        if (o.update) return { Update: updateParams(o.update.pk, o.update.sk, o.update.patch, { upsert: o.ifExists === false, ifEq: o.ifEq }) };
        return { Delete: { TableName: table, Key: { pk: o.del.pk, sk: o.del.sk }, ...(o.ifExists ? { ConditionExpression: 'attribute_exists(pk)' } : {}) } };
      });
      await wrap(doc.send(new TransactWriteCommand({ TransactItems: items })));
    },
  };
}

/* ---------------- S3 파일 ---------------- */
export function createS3Files(bucket, s3) {
  const ascii = (s) => s.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return {
    // 브라우저가 S3로 바로 올립니다(크기·형식은 서명 조건으로 묶음)
    async presignUpload({ key, type, size }) {
      return createPresignedPost(s3, {
        Bucket: bucket, Key: key, Expires: 600,
        Conditions: [['content-length-range', 1, size], ['eq', '$Content-Type', type]],
        Fields: { 'Content-Type': type },
      });
    },
    async presignGet({ key, name, type, download }) {
      const disp = `${download ? 'attachment' : 'inline'}; filename="${ascii(name)}"; filename*=UTF-8''${encodeURIComponent(name)}`;
      return getSignedUrl(s3, new GetObjectCommand({ Bucket: bucket, Key: key, ResponseContentType: type, ResponseContentDisposition: disp }), { expiresIn: 3600 });
    },
    async remove(key) { await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key })); },
  };
}

/* ---------------- Cognito 로그인 ---------------- */
export function createCognitoIdp({ poolId, clientId, region, client }) {
  const iss = `https://cognito-idp.${region}.amazonaws.com/${poolId}`;
  const err = (status, code, message) => new ApiError(status, code, message);
  const MAP = {
    UsernameExistsException: () => err(409, 'username-taken', '이미 쓰고 있는 아이디입니다.'),
    InvalidPasswordException: () => err(400, 'weak-password', '비밀번호가 너무 쉽습니다. 8자 이상으로 정해 주세요.'),
    CodeMismatchException: () => err(400, 'invalid-code', '인증번호가 맞지 않아요.'),
    ExpiredCodeException: () => err(400, 'invalid-code', '인증번호 시간이 지났어요. 다시 받아 주세요.'),
    CodeDeliveryFailureException: () => err(502, 'sms-failed', '인증 문자를 보내지 못했어요. 번호를 확인하고 다시 시도해 주세요.'),
    TooManyRequestsException: () => err(429, 'too-many-requests', '요청이 너무 많아요. 잠시 후 다시 시도해 주세요.'),
    LimitExceededException: () => err(429, 'too-many-requests', '요청이 너무 많아요. 잠시 후 다시 시도해 주세요.'),
    TooManyFailedAttemptsException: () => err(429, 'too-many-requests', '시도 횟수를 넘었어요. 잠시 후 다시 시도해 주세요.'),
    NotAuthorizedException: () => err(401, 'invalid-credential', '아이디 또는 비밀번호가 맞지 않습니다.'),
    UserNotFoundException: () => err(401, 'invalid-credential', '아이디 또는 비밀번호가 맞지 않습니다.'),
    UserNotConfirmedException: () => err(401, 'invalid-credential', '아이디 또는 비밀번호가 맞지 않습니다.'),
    InvalidParameterException: () => err(400, 'invalid', '입력값을 확인해 주세요.'),
  };
  const send = async (cmd) => {
    try { return await client.send(cmd); } catch (e) { const f = MAP[e.name]; if (f) throw f(); throw e; }
  };
  const payload = (jwt) => JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString());
  const attr = (u, n) => (u.UserAttributes || []).find((a) => a.Name === n)?.Value;

  let keys = null, keysAt = 0;
  async function jwks(force) {
    if (!keys || force) {
      if (force && Date.now() - keysAt < 60000) return keys;
      const r = await fetch(`${iss}/.well-known/jwks.json`);
      const j = await r.json();
      keys = new Map(j.keys.map((k) => [k.kid, createPublicKey({ key: k, format: 'jwk' })]));
      keysAt = Date.now();
    }
    return keys;
  }

  return {
    async status(username) {
      try {
        const u = await client.send(new AdminGetUserCommand({ UserPoolId: poolId, Username: username }));
        return u.UserStatus === 'UNCONFIRMED' ? 'unconfirmed' : 'confirmed';
      } catch (e) { if (e.name === 'UserNotFoundException') return 'none'; throw e; }
    },
    // 가입 시작 때 적어 인증번호를 보낸 번호
    async phoneOf(username) {
      try {
        return attr(await client.send(new AdminGetUserCommand({ UserPoolId: poolId, Username: username })), 'phone_number') || null;
      } catch (e) { if (e.name === 'UserNotFoundException') return null; throw e; }
    },
    async remove(username) {
      try { await client.send(new AdminDeleteUserCommand({ UserPoolId: poolId, Username: username })); } catch (e) { if (e.name !== 'UserNotFoundException') throw e; }
    },
    async signUp({ username, password, phone }) {
      await send(new SignUpCommand({ ClientId: clientId, Username: username, Password: password, UserAttributes: [{ Name: 'phone_number', Value: phone }] }));
    },
    async confirm(username, code) {
      try {
        await send(new ConfirmSignUpCommand({ ClientId: clientId, Username: username, ConfirmationCode: code }));
      } catch (e) { if (e.code === 'invalid-credential') throw err(400, 'invalid-code', '인증번호가 맞지 않거나 시간이 지났어요.'); throw e; }
      const u = await client.send(new AdminGetUserCommand({ UserPoolId: poolId, Username: username }));
      return { sub: attr(u, 'sub'), phone: attr(u, 'phone_number') };
    },
    async login(username, password) {
      const r = await send(new AdminInitiateAuthCommand({ UserPoolId: poolId, ClientId: clientId, AuthFlow: 'ADMIN_USER_PASSWORD_AUTH', AuthParameters: { USERNAME: username, PASSWORD: password } }));
      const a = r.AuthenticationResult;
      if (!a) throw err(401, 'invalid-credential', '아이디 또는 비밀번호가 맞지 않습니다.');
      return { idToken: a.IdToken, refreshToken: a.RefreshToken, expiresIn: a.ExpiresIn, sub: payload(a.IdToken).sub };
    },
    async refresh(refreshToken) {
      try {
        const r = await client.send(new AdminInitiateAuthCommand({ UserPoolId: poolId, ClientId: clientId, AuthFlow: 'REFRESH_TOKEN_AUTH', AuthParameters: { REFRESH_TOKEN: refreshToken } }));
        return { idToken: r.AuthenticationResult.IdToken, expiresIn: r.AuthenticationResult.ExpiresIn };
      } catch (e) {
        if (['NotAuthorizedException', 'UserNotFoundException', 'InvalidParameterException'].includes(e.name)) throw err(401, 'session-expired', '다시 로그인해 주세요.');
        throw e;
      }
    },
    async setPassword(username, password) {
      await send(new AdminSetUserPasswordCommand({ UserPoolId: poolId, Username: username, Password: password, Permanent: true }));
    },
    // 비밀번호 찾기: 가입한 휴대폰으로 인증번호(없는 아이디여도 같은 응답)
    async forgot(username) {
      const r = await send(new ForgotPasswordCommand({ ClientId: clientId, Username: username }));
      return { destination: r.CodeDeliveryDetails?.Destination || '' };
    },
    async confirmForgot(username, code, password) {
      try {
        await send(new ConfirmForgotPasswordCommand({ ClientId: clientId, Username: username, ConfirmationCode: code, Password: password }));
      } catch (e) { if (e.code === 'invalid-credential') throw err(400, 'invalid-code', '인증번호가 맞지 않거나 시간이 지났어요.'); throw e; }
    },
    async revoke(refreshToken) { await client.send(new RevokeTokenCommand({ ClientId: clientId, Token: refreshToken })); },
    // ID 토큰 확인(RS256 서명·발급처·앱·만료)
    async verify(token) {
      const [h, p, s] = String(token).split('.');
      if (!s) return null;
      const header = JSON.parse(Buffer.from(h, 'base64url').toString());
      const claims = JSON.parse(Buffer.from(p, 'base64url').toString());
      if (header.alg !== 'RS256') return null;
      let key = (await jwks()).get(header.kid);
      if (!key) key = (await jwks(true)).get(header.kid);
      if (!key || !rsaVerify('RSA-SHA256', Buffer.from(`${h}.${p}`), key, Buffer.from(s, 'base64url'))) return null;
      if (claims.iss !== iss || claims.aud !== clientId || claims.token_use !== 'id' || claims.exp * 1000 < Date.now()) return null;
      return { sub: claims.sub, username: claims['cognito:username'], phone: claims.phone_number };
    },
  };
}

/* ---------------- 문자(아이디 찾기 인증번호) ---------------- */
export function createSnsSms(sns) {
  return {
    async send(phone, text) {
      try {
        await sns.send(new PublishCommand({ PhoneNumber: phone, Message: text, MessageAttributes: { 'AWS.SNS.SMS.SMSType': { DataType: 'String', StringValue: 'Transactional' } } }));
      } catch (e) {
        console.error('sms', e.name, e.message);
        throw new ApiError(502, 'sms-failed', '인증 문자를 보내지 못했어요. 잠시 후 다시 시도해 주세요.');
      }
    },
  };
}

/* ---------------- 처리기 ---------------- */
let app = null;
function getApp() {
  if (!app) {
    const ddb = new DynamoDBClient(DYNAMO_ENDPOINT ? { endpoint: DYNAMO_ENDPOINT } : {});
    app = createApp({
      store: createDynamoStore(TABLE, ddb),
      files: createS3Files(BUCKET, new S3Client({})),
      idp: createCognitoIdp({ poolId: USER_POOL_ID, clientId: CLIENT_ID, region: AWS_REGION, client: new CognitoIdentityProviderClient({}) }),
      sms: createSnsSms(new SNSClient({})),
      env: { qnaOpen: QNA_OPEN === 'true', smsDailyMax: parseInt(SMS_DAILY_MAX, 10) || 300 },
    });
  }
  return app;
}

// API Gateway(HTTP API, payload 2.0) 요청을 앱 요청으로 바꿉니다
export const makeHandler = (appOf) => async (event) => {
  const method = event.requestContext?.http?.method || 'GET';
  const path = (event.rawPath || '/').replace(/^\/api(?=\/|$)/, '');
  let body = null;
  if (event.body) {
    try { body = JSON.parse(event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString() : event.body); } catch { body = null; }
  }
  const auth = event.headers?.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  const res = await appOf().handle({ method, path, query: event.queryStringParameters || {}, body, token });
  const json = JSON.stringify(res.body);
  const headers = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' };
  if (method === 'GET') headers.etag = `"${createHash('sha1').update(json).digest('base64url')}"`;
  return { statusCode: res.status, headers, body: json };
};

export const handler = makeHandler(getApp);
