// Provider-independent extension point. Implement the SDK/HTTP call for your chosen model here.
// Contract: generate({messages, input, signal}) => JSON string or {questions:[{field,text}]}.
// Read credentials from process.env.LLM_API_KEY; never send them to the browser.
async function generate({messages,input,signal}){
 void messages;void input;void signal;
 throw new Error('REMOTE_PROVIDER_NOT_IMPLEMENTED');
}
module.exports={generate};
