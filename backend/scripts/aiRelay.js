import express from 'express';
import { timingSafeEqual, randomBytes } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { askAI } from '../services/aiService.js';

export function createRelay(token, generate = (prompt,options)=>askAI(prompt,{...options,localOnly:true})) {
  if (!token || token.length < 32) throw new Error('Relay token must be at least 32 characters.');
  const app=express(); let busy=false;
  app.use((req,res,next)=>{
    const provided=Buffer.from(req.headers.authorization||''), expected=Buffer.from(`Bearer ${token}`);
    if(provided.length!==expected.length || !timingSafeEqual(provided,expected)) return res.status(401).json({error:'Unauthorized'});
    next();
  });
  app.use(express.json({limit:'100kb'}));
  app.post('/generate',async(req,res)=>{
    const prompt=req.body?.prompt;
    if(typeof prompt!=='string' || !prompt.trim() || prompt.length>60000) return res.status(400).json({error:'Invalid prompt'});
    if(busy) return res.status(429).json({error:'AI is busy. Try again shortly.'});
    busy=true;
    try {return res.json({response:await generate(prompt,{json:req.body.json===true})});}
    catch {return res.status(503).json({error:'Local AI is unavailable. Check Ollama.'});}
    finally {busy=false;}
  });
  return app;
}

if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  const secretFile=new URL('../.ai-relay.env',import.meta.url);
  let token=process.env.AI_RELAY_TOKEN;
  if(!token) {
    try {token=(await readFile(secretFile,'utf8')).match(/^AI_RELAY_TOKEN=(\S+)$/m)?.[1];} catch(error) {if(error.code!=='ENOENT') throw error;}
    if(!token) {token=randomBytes(32).toString('hex');await writeFile(secretFile,`AI_RELAY_TOKEN=${token}\n`,{mode:0o600,flag:'wx'});}
  }
  createRelay(token).listen(4010,'127.0.0.1',()=>{
    console.log('Laptop AI relay running at http://127.0.0.1:4010');
    console.log('Private key is stored in backend/.ai-relay.env. Copy it only into Render AI_RELAY_TOKEN.');
  });
}
