const {analyze}=require('./service');
async function handleAnalyze(req,res){
 const send=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
 if(req.method!=='POST'){res.setHeader('Allow','POST');return send(405,{error:'Используйте POST.'});}
 const chunks=[];let bytes=0;
 try{
  for await(const chunk of req){bytes+=chunk.length;if(bytes>65536)return send(413,{error:'Слишком большой запрос.'});chunks.push(chunk);}
  let input;try{input=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{return send(400,{error:'Ожидался JSON.'});}
  const result=await analyze(input);send(200,result);
 }catch{if(!res.headersSent)send(400,{error:'Проверьте описание и поля задачи.'});}
}
module.exports={handleAnalyze};
