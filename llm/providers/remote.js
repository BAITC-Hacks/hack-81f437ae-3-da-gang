// Ollama API: https://docs.ollama.com/api/chat
async function generate({messages,signal},{fetchImpl=fetch,env=process.env}={}){
 if(!env.LLM_MODEL)throw new Error('LLM_MODEL_REQUIRED');
 const url=new URL('/api/chat',env.LLM_BASE_URL||'http://127.0.0.1:11434');
 if(!['http:','https:'].includes(url.protocol))throw new Error('INVALID_PROVIDER_URL');
 const response=await fetchImpl(url,{method:'POST',signal,redirect:'error',headers:{'Content-Type':'application/json',...(env.LLM_API_KEY?{Authorization:'Bearer '+env.LLM_API_KEY}:{})},body:JSON.stringify({model:env.LLM_MODEL,messages,stream:false,format:'json'})});
 if(!response.ok)throw new Error('PROVIDER_HTTP_ERROR');
 const chunks=[];let size=0;
 for await(const chunk of response.body){size+=chunk.length;if(size>131072)throw new Error('PROVIDER_RESPONSE_TOO_LARGE');chunks.push(chunk);}
 const result=JSON.parse(Buffer.concat(chunks).toString('utf8'));
 if(typeof result.message?.content!=='string')throw new Error('INVALID_PROVIDER_RESPONSE');
 return result.message.content;
}
module.exports={generate};
