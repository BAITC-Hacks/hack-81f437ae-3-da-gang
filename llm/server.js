const http=require('node:http');
const {handleAnalyze}=require('./route');
const server=http.createServer((req,res)=>{
 if(req.url.split('?')[0]==='/api/llm/analyze')return handleAnalyze(req,res);
 res.writeHead(req.url==='/'?200:404,{'Content-Type':'application/json; charset=utf-8'});
 res.end(JSON.stringify(req.url==='/'?{service:'Sana Quest LLM',endpoint:'POST /api/llm/analyze',provider:process.env.LLM_PROVIDER||'mock'}:{error:'Not found'}));
});
if(require.main===module)server.listen(process.env.PORT||3001,'127.0.0.1',()=>console.log('LLM API: http://localhost:'+(process.env.PORT||3001)));
module.exports=server;
