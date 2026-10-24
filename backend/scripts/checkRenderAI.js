// Temporary diagnostic account, removed from the existing DB in finally.
import { randomUUID } from 'node:crypto';
import { ObjectId } from 'mongodb';
import { connectDB, db } from '../db.js';
const origin='https://broncocircle-1.onrender.com';
const email=`ai-check-${randomUUID()}@example.test`;
let accountId,profileId;
async function request(path,body,token) {
  const response=await fetch(origin+'/api'+path,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(40000)});
  const data=await response.json();
  if(!response.ok) throw new Error(`Diagnostic request ${path}: HTTP ${response.status}`);
  return data;
}
try {
  await connectDB(); if(!db) throw new Error('Database required for diagnostic cleanup.');
  const session=await request('/auth/signup',{name:'Temporary AI check',email,password:randomUUID()+'!aA1'});
  accountId=new ObjectId(session.account._id);
  const profile=await request('/profiles',{name:'Temporary AI check',major:'Testing',interests:['Sports']},session.token);
  profileId=new ObjectId(profile._id);
  const status=await fetch(origin+'/api/ai/status',{headers:{Authorization:`Bearer ${session.token}`},signal:AbortSignal.timeout(10000)});
  if(status.ok) console.log('Render relay settings:',JSON.stringify(await status.json()));
  const tomorrow=new Date(Date.now()+86400000).toISOString();
  const result=await request('/ai/recommend-events',{query:'I like soccer',events:[{id:'soccer-test',title:'Indoor Soccer',category:'Sports',location:'BRIC',description:'A friendly soccer game',start:tomorrow,spots:5}]},session.token);
  console.log('Render AI diagnostic:',JSON.stringify(result));
} finally {
  if(db) {
    if(profileId) await db.collection('profiles').deleteOne({_id:profileId,account:accountId});
    if(accountId) await db.collection('accounts').deleteOne({_id:accountId,email});
    await db.client.close();
    console.log('Temporary diagnostic records cleaned up.');
  }
}
