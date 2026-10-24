import test from 'node:test';
import assert from 'node:assert/strict';
import { createRelay } from '../scripts/aiRelay.js';

test('laptop relay requires its private key and only forwards validated AI prompts',async t=>{
  let calls=0;
  const server=createRelay('a'.repeat(64),async(prompt,options)=>{calls++;assert.equal(prompt,'Find games');assert.equal(options.json,true);return '{"recommendations":[]}';}).listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));
  t.after(()=>{server.closeAllConnections();return new Promise(resolve=>server.close(resolve));});
  async function call(token,prompt='Find games') {
    return fetch(`http://127.0.0.1:${server.address().port}/generate`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({prompt,json:true})});
  }
  assert.equal((await call('wrong')).status,401);assert.equal(calls,0);
  assert.equal((await call('a'.repeat(64),'')).status,400);
  const result=await call('a'.repeat(64));assert.equal(result.status,200);assert.equal((await result.json()).response,'{"recommendations":[]}');
});
