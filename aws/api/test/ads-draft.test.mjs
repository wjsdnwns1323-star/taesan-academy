import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runAdsDraft, AI_MODEL } from '../ads-draft.mjs';

const NOW = Date.UTC(2026, 9, 30);
const store = () => { const m = new Map(); return { m, put: async (x) => m.set(`${x.pk}/${x.sk}`, x) }; };
const res = (body, ok = true) => ({ ok, status: ok ? 200 : 500, json: async () => body });
const secrets = { bandToken: 'b', bandKey: 'k', aiKey: 'a' };

test('광고 초안: 최근 밴드 글만 AI에 보내고, 규칙에 맞는 광고만 저장', async () => {
  const s = store(), calls = [];
  const fetchFn = async (url, init) => {
    calls.push({ url, init });
    if (url.startsWith('https://openapi.band.us/')) return res({ result_code: 1, result_data: { items: [
      { content: '국어 1% 완성반 11.21(토) 개강', created_at: NOW - 86400000 },
      { content: '오래된 글', created_at: NOW - 30 * 86400000 },
    ] } });
    return res({ content: [{ type: 'tool_use', name: 'save_ads', input: { items: [
      { title: '국어 1% 완성반', short: '국어 1%', hook: '국어 1% 완성반 개강', when: '11.21(토) 개강', tag: '예비고1', by: '국어 김태현', who: ['kim-taehyun'], post: 0 },
      { title: '가'.repeat(80), short: '', hook: '너무 긴 제목', when: '', tag: '', by: '', post: 0 },
    ] } }] });
  };
  const out = await runAdsDraft({ store: s, secrets, fetchFn, now: () => NOW });
  assert.deepEqual(out, { saved: true, posts: 1, items: 1 });
  const body = JSON.parse(calls[1].init.body);
  assert.equal(body.model, AI_MODEL);
  assert.ok(body.messages[0].content.includes('국어 1% 완성반') && !body.messages[0].content.includes('오래된 글'));
  assert.equal(calls[1].init.headers['x-api-key'], 'a');
  const d = s.m.get('ADSDRAFT/latest');
  assert.equal(d.items[0].hook, '국어 1% 완성반 개강');
  assert.deepEqual(d.items[0].who, ['kim-taehyun']);
});

test('광고 초안: 최근 글이 없으면 AI를 부르지 않음, 밴드 오류는 실패', async () => {
  let ai = 0;
  const fetchFn = async (url) => (url.includes('band') ? res({ result_code: 1, result_data: { items: [] } }) : (ai++, res({})));
  assert.deepEqual(await runAdsDraft({ store: store(), secrets, fetchFn, now: () => NOW }), { saved: false, posts: 0 });
  assert.equal(ai, 0);
  await assert.rejects(runAdsDraft({ store: store(), secrets, fetchFn: async () => res({}, false), now: () => NOW }));
});
