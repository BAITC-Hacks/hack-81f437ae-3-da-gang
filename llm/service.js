const {validateInput,validateOutput}=require('./schema');
const {buildMessages}=require('./prompts');
const mock=require('./providers/mock');
const remote=require('./providers/remote');
async function analyze(raw,{provider=process.env.LLM_PROVIDER||'mock',generate,timeoutMs=15000}={}){
 const input=validateInput(raw);
 if(!['mock','remote'].includes(provider))throw new Error('Неизвестный LLM_PROVIDER.');
 const controller=new AbortController();let timer;
 try{
  const response=await Promise.race([
   Promise.resolve().then(()=>(generate||(provider==='mock'?mock.generate:remote.generate))({input,messages:buildMessages(input),signal:controller.signal})),
   new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new Error('LLM_TIMEOUT'));},timeoutMs);})
  ]);
  return {...validateOutput(response),mode:provider,fallback:false};
 }catch{
  return {...validateOutput(await mock.generate({input})),mode:'mock',fallback:true,warning:'Модель недоступна или вернула некорректный ответ. Использованы демонстрационные вопросы.'};
 }finally{clearTimeout(timer);}
}
module.exports={analyze};
