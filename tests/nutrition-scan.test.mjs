import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const source = ts.transpileModule(readFileSync(new URL('../supabase/functions/nutrition-scan/index.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2023 } }).outputText;
function endpoint(body, configured = true, upstreamStatus = 200) {
  let handler, requests = [];
  const client = { auth: { getUser: async token => ({ data: { user: token === 'valid' ? { id: 'alice' } : null } }) } };
  new Function('require', 'exports', 'Deno', 'fetch', source)(() => ({ createClient: () => client }), {}, {
    env: { get: name => name === 'OPENAI_API_KEY' ? configured ? 'test-key' : undefined : 'test-config' },
    serve: fn => { handler = fn; },
  }, async (url, init) => { requests.push({ url, body: JSON.parse(init.body) }); return Response.json(body, { status: upstreamStatus }); });
  return { requests, call: (payload = { image: 'data:image/png;base64,AAAA' }, token = 'valid', method = 'POST') => handler(new Request('https://example.test/nutrition-scan', { method, headers: { Origin: 'https://pluto.test', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(method === 'POST' ? { body: JSON.stringify(payload) } : {}) })) };
}
const message = text => ({ type: 'message', content: [{ type: 'output_text', text }] });
test('label scanning parses REST output messages after non-message items and retains only bounded numbers', async () => {
  const api = endpoint({ status: 'completed', output: [{ type: 'reasoning' }, { type: 'message', content: [{ type: 'output_text', text: '{"name":" Oats ",' }, { type: 'output_text', text: '"energy":372,"protein":13.126,"carbs":null,"fat":-1,"fiber":10001}' }] }] });
  const response = await api.call();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'https://pluto.test');
  assert.deepEqual(await response.json(), { food: { name: 'Oats', energy: 372, protein: 13.13 } });
  assert.equal(api.requests.length, 1);
  assert.equal(api.requests[0].body.input[0].content[1].image_url, 'data:image/png;base64,AAAA');
});
test('label scanning rejects unauthenticated users, invalid images, and missing configuration before invoking the model', async () => {
  const api = endpoint({ output: [message('{}')] });
  for (const token of ['', 'invalid']) assert.equal((await api.call(undefined, token)).status, 401);
  assert.equal((await api.call({ image: 'https://example.test/photo.png' })).status, 400);
  assert.equal(api.requests.length, 0);
  const absent = endpoint({}, false);
  assert.equal((await absent.call()).status, 503);
  assert.equal(absent.requests.length, 0);
});
test('refusals, incomplete output, malformed JSON and upstream failures return a retriable error', async () => {
  for (const body of [{ output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'Unavailable' }] }] }, { status: 'incomplete', output: [message('{}')] }, { output: [message('broken')] }, { output_text: '{}' }]) {
    assert.equal((await endpoint(body).call()).status, 503);
  }
  assert.equal((await endpoint({}, true, 429).call()).status, 503);
});
