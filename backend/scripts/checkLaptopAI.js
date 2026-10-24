import { readFile } from 'node:fs/promises';
import { askAI } from '../services/aiService.js';
import { recommendEvents } from '../services/eventRecommendations.js';
const url=process.argv[2];
if(!url) throw new Error('Usage: node scripts/checkLaptopAI.js https://your-tunnel.trycloudflare.com');
const token=(await readFile(new URL('../.ai-relay.env',import.meta.url),'utf8')).match(/^AI_RELAY_TOKEN=(\S+)$/m)?.[1];
if(!token) throw new Error('Start npm run ai:relay first.');
process.env.AI_RELAY_URL=url; process.env.AI_RELAY_TOKEN=token;
if(process.argv.includes('--recommend')) {
  const result=await recommendEvents('I like soccer',[
    {id:'soccer',title:'Indoor Soccer',category:'Sports',location:'BRIC',description:'A small soccer game.',start:'2030-11-01T18:00:00-08:00',spots:5},
    {id:'coffee',title:'Coffee catch-up',category:'Coffee',location:'BSC',description:'Meet for coffee.',start:'2030-11-01T18:00:00-08:00',spots:3}
  ],async prompt=>{const answer=await askAI(prompt,{json:true});if(process.argv.includes('--raw')) console.log('Model JSON:',answer);return answer;});
  console.log(JSON.stringify(result));
  process.exitCode=result.mode==='ai'?0:1;
} else {
const response=await askAI('Return only JSON with this exact shape: {"connected":true}',{json:true});
const result=JSON.parse(response);
if(result.connected!==true) throw new Error('AI returned an unexpected response.');
console.log('Public tunnel → authenticated laptop relay → Ollama: connected.');
}
