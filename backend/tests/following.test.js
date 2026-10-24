import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { Types } from 'mongoose';
import Account from '../models/Account.js';
import Profile from '../models/Profile.js';
import profiles from '../routes/profiles.js';

test('following is private, one-way, idempotent, identity-protected, and counts existing lists', async t=>{
  const oldFollow=new Types.ObjectId();
  const a=new Profile({account:new Types.ObjectId(),name:'Alex',major:'CS',friends:[oldFollow]});
  const b=new Profile({account:new Types.ObjectId(),name:'Maya',major:'CS'});
  const stored=[a,b];
  t.mock.method(Account,'findOne',async()=>({_id:a.account}));
  t.mock.method(Profile,'findOne',async query=>stored.find(item=>String(item.account)===String(query.account)));
  t.mock.method(Profile,'exists',async query=>stored.find(item=>String(item._id)===String(query._id)) || null);
  t.mock.method(Profile,'findById',id=>({select:async()=>stored.find(item=>String(item._id)===String(id)) || null}));
  t.mock.method(Profile,'countDocuments',async query=>stored.filter(item=>item.friends.some(id=>String(id)===String(query.friends))).length);
  t.mock.method(Profile,'findByIdAndUpdate',async(id,change)=>{
    assert.equal(String(id),String(a._id),'only the signed-in profile can be changed');
    const added=change.$addToSet?.friends, removed=change.$pull?.friends;
    if(added && !a.friends.some(id=>String(id)===String(added))) a.friends.push(added);
    if(removed) a.friends=a.friends.filter(id=>String(id)!==String(removed));
    return a;
  });
  const app=express(); app.use(express.json()); app.use('/profiles',profiles);
  const server=app.listen(0,'127.0.0.1'); await new Promise(resolve=>server.once('listening',resolve));
  t.after(()=>{server.closeAllConnections();return new Promise(resolve=>server.close(resolve));});
  async function request(path,method='GET',authenticated=true) {
    const response=await fetch(`http://127.0.0.1:${server.address().port}/profiles${path}`,{method,
      headers:{'Content-Type':'application/json',...(authenticated?{Authorization:`Bearer ${'a'.repeat(64)}`}:{})},
      ...(method==='PUT'?{body:JSON.stringify({profileId:b._id,friends:[]})}:{})});
    return {status:response.status,body:await response.json()};
  }
  assert.equal((await request(`/${b._id}/follow`,'PUT',false)).status,401);
  assert.equal((await request('/invalid/follow','PUT')).status,400);
  assert.equal((await request(`/${String(a._id).toUpperCase()}/follow`,'PUT')).status,400);
  assert.equal((await request(`/${new Types.ObjectId()}/follow`,'PUT')).status,404);
  for(let i=0;i<2;i++) {
    const followed=await request(`/${b._id}/follow`,'PUT');
    assert.equal(followed.status,200); assert.equal(followed.body.isFollowing,true);
    assert.deepEqual(followed.body.following,[String(oldFollow),String(b._id)]);
  }
  assert.equal(a.friends.length,2); assert.equal(b.friends.length,0,'following is not mutual');
  const target=await request(`/${b._id}/social`);
  assert.deepEqual(target.body,{followers:1,following:0,isFollowing:true});
  assert.equal((await request(`/${a._id}/social`)).body.following,2,'old lists need no migration');
  assert.equal((await request(`/${new Types.ObjectId()}/social`)).status,404);
  for(let i=0;i<2;i++) assert.equal((await request(`/${b._id}/follow`,'DELETE')).body.isFollowing,false);
  assert.deepEqual(a.friends.map(String),[String(oldFollow)]);
  assert.deepEqual((await request(`/${b._id}/social`)).body,{followers:0,following:0,isFollowing:false});
});
