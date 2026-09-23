const {validateInput}=require('./schema');
const fields=require('./fields');
function buildCard(raw){
 const input=validateInput(raw);
 const card={...input.fields,context:input.fields.context||input.draft,confirmed:Object.fromEntries(fields.map(([key])=>[key,false]))};
 return {card,requiresConfirmation:true,missingFields:fields.filter(([key])=>!card[key]).map(([key])=>key)};
}
module.exports={buildCard};
