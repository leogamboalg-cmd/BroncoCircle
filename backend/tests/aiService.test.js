import test from 'node:test';
import assert from 'node:assert/strict';
import { askAI } from '../services/aiService.js';

test('Render AI calls the HTTPS laptop relay with a server-only key',async t=>{
  const oldUrl=process.env.AI_RELAY_URL,oldToken=process.env.AI_RELAY_TOKEN;
  process.env.AI_RELAY_URL='https://laptop.example';process.env.AI_RELAY_TOKEN='private-test-key';
  t.after(()=>{
    if(oldUrl===undefined) delete process.env.AI_RELAY_URL;else process.env.AI_RELAY_URL=oldUrl;
    if(oldToken===undefined) delete process.env.AI_RELAY_TOKEN;else process.env.AI_RELAY_TOKEN=oldToken;
  });
  t.mock.method(globalThis,'fetch',async(url,options)=>{
    assert.equal(String(url),'https://laptop.example/generate');
    assert.equal(options.headers.Authorization,'Bearer private-test-key');
    assert.deepEqual(JSON.parse(options.body),{prompt:'Find games',json:true});
    return new Response(JSON.stringify({response:'{"recommendations":[]}'}));
  });
  assert.equal(await askAI('Find games',{json:true}),'{"recommendations":[]}');
  process.env.AI_RELAY_URL='http://laptop.example';await assert.rejects(askAI('Find games'),/HTTPS/);
});
