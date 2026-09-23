const fields=require('../fields');
async function generate({input}){
 const ordered=[...fields.filter(([k])=>!input.fields[k]),...fields.filter(([k])=>input.fields[k])];
 return {questions:ordered.map(([field,,,text])=>({field,text:input.fields[field]?'Уточните или подтвердите: '+text:text}))};
}
module.exports={generate};
