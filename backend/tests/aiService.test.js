import test from 'node:test';
import assert from 'node:assert/strict';
import { askAI } from '../services/aiService.js';
import ollama from 'ollama';

test('event recommendations request a complete structured JSON object from laptop Ollama',async t=>{
  t.mock.method(ollama,'chat',async request=>{
    assert.equal(request.format.type,'object');
    assert.deepEqual(request.format.required,['recommendations']);
    assert.equal(request.format.properties.recommendations.maxItems,3);
    assert.ok(request.options.num_predict>=500);
    return {message:{content:'{"recommendations":[{"id":"soccer","reason":"A soccer game."}]}'}};
  });
  const answer=await askAI('Recommend up to 3 campus events for soccer',{json:true,localOnly:true});
  assert.equal(JSON.parse(answer).recommendations[0].id,'soccer');
});

test('recommendation schema restricts model IDs to the actual event catalog',async t=>{
  t.mock.method(ollama,'chat',async request=>{
    assert.deepEqual(request.format.properties.recommendations.items.properties.id.enum,['soccer-actual']);
    return {message:{content:'{"recommendations":[]}'}};
  });
  await askAI('Recommend up to 3 campus events\n'+JSON.stringify({events:[{id:'soccer-actual'}]}),{json:true,localOnly:true});
});

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
