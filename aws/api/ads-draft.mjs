// 매주 한 번(EventBridge): 태산학원 밴드 최근 글 → AI가 광고 문구 초안 → ADSDRAFT/latest 에 저장
// 관리자가 '광고' 칸에서 초안을 불러와 고치고 저장해야 사이트에 나옵니다(바로 게시하지 않음).
// 비밀 값(밴드 토큰·밴드 키·Claude API 키)은 SSM 파라미터(/taesan/...)에 두고 실행할 때만 읽습니다.
import { cleanAds } from './core.mjs';

const BAND_API = 'https://openapi.band.us';
const AI_API = 'https://api.anthropic.com/v1/messages';
export const AI_MODEL = 'claude-haiku-5-5';
const DAYS = 14;
const TEACHERS = ['lee-geonjun', 'kim-taehyun', 'kim-dohyun', 'choi-sunghoon', 'jeong-jikhan'];

const PROMPT = `너는 대전 태산학원의 홍보 담당이다. 아래는 학원 밴드에 최근 올라온 글이다.
이 글들로 사이트 광고 문구를 최대 10개 만든다.
- 글에 적힌 사실만 쓴다. 숫자·날짜·학교·강사 이름을 바꾸거나 지어내지 않는다. 가채점 실적이면 when 에 '가채점'을 넣는다.
- 개강·설명회·특강·실적처럼 학생·학부모가 궁금해할 소식을 고른다. 인사·잡담 글은 건너뛴다.
- title 은 사진 광고용 큰 제목(두 줄이면 \\n 으로 나눔, 40자 이하), short 는 짧은 제목(30자 이하), hook 은 한 줄 문구(30자 이하),
  when 은 날짜·장소(' · ' 로 구분, 40자 이하), tag 는 대상(예: 예비고1, 12자 이하), by 는 '과목 강사이름' 또는 '태산학원'(20자 이하).
- who 는 글에 나온 강사 중 사진이 있는 사람만: lee-geonjun(영어 이건준), kim-taehyun(국어 김태현), kim-dohyun(국어 김도현), choi-sunghoon(물리 최성훈), jeong-jikhan(통합사회 정직한).
- post 는 그 광고의 근거가 된 글 번호(아래 [n]).`;

const TOOL = {
  name: 'save_ads',
  description: '광고 문구 초안 저장',
  input_schema: {
    type: 'object',
    properties: {
      items: {
        type: 'array', maxItems: 10,
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' }, short: { type: 'string' }, hook: { type: 'string' }, when: { type: 'string' },
            tag: { type: 'string' }, by: { type: 'string' }, tone: { type: 'string', enum: ['navy', 'ink', 'teal'] },
            who: { type: 'array', items: { type: 'string', enum: TEACHERS } }, post: { type: 'integer' },
          },
          required: ['title', 'short', 'hook', 'when', 'tag', 'by', 'post'],
        },
      },
    },
    required: ['items'],
  },
};

async function json(fetchFn, url, init) {
  const r = await fetchFn(url, init);
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${new URL(url).host} ${r.status}`);
  return body;
}

// secrets: { bandToken, bandKey, aiKey }
export async function runAdsDraft({ store, secrets, fetchFn = fetch, now = Date.now }) {
  const q = new URLSearchParams({ access_token: secrets.bandToken, band_key: secrets.bandKey, locale: 'ko_KR' });
  const band = await json(fetchFn, `${BAND_API}/v2/band/posts?${q}`);
  if (band.result_code !== 1) throw new Error(`band result ${band.result_code}`);
  const since = now() - DAYS * 86400000;
  const posts = (band.result_data?.items || []).filter((p) => p.created_at >= since && p.content?.trim()).slice(0, 20);
  if (!posts.length) return { saved: false, posts: 0 };

  const text = posts.map((p, i) => `[${i}] (${new Date(p.created_at + 9 * 3600000).toISOString().slice(0, 10)})\n${p.content.slice(0, 1500)}`).join('\n\n');
  const ai = await json(fetchFn, AI_API, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': secrets.aiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: AI_MODEL, max_tokens: 4000, tools: [TOOL], tool_choice: { type: 'tool', name: 'save_ads' },
      messages: [{ role: 'user', content: `${PROMPT}\n\n${text}` }],
    }),
  });
  const raw = ai.content?.find((c) => c.type === 'tool_use')?.input?.items || [];
  // 글자 수가 넘친 광고는 버리고, 나머지만 저장(관리자가 검토)
  const t = now();
  const items = raw.flatMap((a, i) => {
    try { return cleanAds([{ ...a, id: `ai${t.toString(36)}${i}`, link: '' }]); } catch { return []; }
  });
  await store.put({ pk: 'ADSDRAFT', sk: 'latest', id: 'ads-draft', items, posts: posts.length, createdAt: t });
  return { saved: true, posts: posts.length, items: items.length };
}
