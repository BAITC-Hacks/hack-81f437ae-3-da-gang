const fields=require('./fields');
const keys=fields.map(f=>f[0]);
function validateInput(value){
 if(!value||typeof value.draft!=='string'||value.draft.trim().length<10||value.draft.length>12000)throw new Error('Описание должно содержать от 10 до 12000 символов.');
 const clean={draft:value.draft.trim(),fields:{}};
 if(value.fields!==undefined&&(!value.fields||typeof value.fields!=='object'||Array.isArray(value.fields)))throw new Error('fields должен быть объектом.');
 for(const key of keys){const text=value.fields?.[key]??'';if(typeof text!=='string'||text.length>4000)throw new Error('Некорректное поле: '+key);clean.fields[key]=text.trim();}
 return clean;
}
function validateOutput(raw){
 const value=typeof raw==='string'?JSON.parse(raw):raw;
 if(!value||!Array.isArray(value.questions)||value.questions.length<3||value.questions.length>7)throw new Error('Нужно от 3 до 7 вопросов.');
 const questions=value.questions.map(q=>{
  if(!q||!keys.includes(q.field)||typeof q.text!=='string'||!q.text.trim()||q.text.length>600)throw new Error('Некорректный вопрос.');
  return {field:q.field,text:q.text.trim()};
 });
 if(new Set(questions.map(q=>q.field)).size!==questions.length)throw new Error('Поля вопросов не должны повторяться.');
 // Only questions are accepted; model-supplied scores or confirmations are discarded.
 return {questions};
}
module.exports={validateInput,validateOutput};
