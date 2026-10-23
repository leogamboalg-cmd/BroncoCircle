import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../../broncocircle/api.js', import.meta.url), 'utf8');
async function client(fetcher, hostname = 'localhost') {
  const stored = new Map();
  const sandbox = { window: {}, location: { hostname, protocol: 'http:' }, AbortSignal, FormData,
    sessionStorage: { getItem: key=>stored.get(key), setItem: (key,value)=>stored.set(key,value), removeItem: key=>stored.delete(key) },
    fetch: fetcher };
  vm.runInNewContext(source, sandbox);
  await sandbox.window.BroncoAPI.ready;
  return { api: sandbox.window.BroncoAPI, stored };
}
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

test('image upload sends multipart with bearer auth and lets the browser set the boundary', async()=>{
  let captured;
  const { api } = await client(async (url, options)=>{
    if (url === '/api/health') return json({ status: 'ok' });
    captured = options; return json({ imageUrl: 'https://example.test/photo.png' }, 201);
  });
  api.setToken('image-token');
  const upload = new FormData(); upload.append('image', new Blob(['image bytes'], { type: 'image/png' }), 'event.png');
  const result = await api.request('/uploads/image', { method: 'POST', body: upload, timeoutMs: 45000 });
  assert.equal(result.imageUrl, 'https://example.test/photo.png');
  assert.equal(captured.body, upload);
  assert.equal(captured.headers.Authorization, 'Bearer image-token');
  assert.equal(captured.headers['Content-Type'], undefined);
});

test('browser client uses bearer auth, sends JSON, and does not accept failed saves', async()=>{
  const calls = [];
  const { api, stored } = await client(async (url, options)=>{
    calls.push({ url, options });
    if (url === '/api/health') return json({ status: 'ok' });
    if (options.method === 'PUT') return json({ error: 'Could not save.' }, 503);
    return json({ name: 'Alex' });
  });
  assert.equal(api.mode, 'live'); api.setToken('test-token');
  assert.equal(stored.get('broncocircle-token'), 'test-token');
  assert.equal((await api.request('/profiles/me')).name, 'Alex');
  await assert.rejects(api.request('/posts/123/save', { method: 'PUT', body: { ignored: true } }), /Could not save/);
  assert.equal(calls[2].options.headers.Authorization, 'Bearer test-token');
  assert.equal(calls[2].options.headers['Content-Type'], 'application/json');
  assert.equal(calls[2].options.body, '{"ignored":true}');
  api.setToken(''); assert.equal(stored.has('broncocircle-token'), false);
});

test('Pacific times are device-independent, include DST, and reject invalid calendar times', async()=>{
  const { api } = await client(async()=>json({ status: 'ok' }));
  assert.equal(api.pacificTime('2030-11-10', '16:00'), '2030-11-11T00:00:00.000Z');
  assert.equal(api.pacificTime('2030-07-10', '16:00'), '2030-07-10T23:00:00.000Z');
  assert.throws(()=>api.pacificTime('2030-03-10', '02:30'), /valid Pacific/);
  assert.throws(()=>api.pacificTime('2030-02-30', '16:00'), /valid Pacific/);
  assert.equal(api.localParts('2030-11-11T00:00:00Z').date, '2030-11-10');
  assert.equal(api.localParts('2030-11-11T00:00:00Z').time, '16:00');
});

test('static hosting stays in demo mode; HTML and network failures cannot masquerade as successful API responses', async()=>{
  const github = await client(async()=>{ throw new Error('must not fetch'); }, 'example.github.io');
  assert.equal(github.api.mode, 'demo');
  const { api } = await client(async url=>url === '/api/health' ? json({ status: 'ok' }) : new Response('<html>not an API</html>'));
  await assert.rejects(api.request('/posts'), /could not complete/);
  const offline = await client(async url=>{ if (url === '/api/health') return json({ status: 'ok' }); throw new Error('offline'); });
  await assert.rejects(offline.api.request('/posts'), /changes have not been saved/);
});

test('expired and stale responses cannot overwrite another session', async()=>{
  let finish;
  const { api } = await client(async url=>url === '/api/health' ? json({ status: 'ok' }) : new Promise(resolve=>{ finish = resolve; }));
  api.setToken('old'); const request = api.request('/profiles/me');
  api.setToken('new'); finish(json({ error: 'Expired token' }, 401));
  await assert.rejects(request, error=>error.stale === true);
  assert.equal(api.token, 'new');
  const expired = api.request('/profiles/me'); finish(json({ error: 'Expired token' }, 401));
  await assert.rejects(expired, /Expired token/); assert.equal(api.token, '');
});
