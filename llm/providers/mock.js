const fields=require('../fields');
async function generate({input}){
 const ordered=[...fields.filter(([k])=>!input.fields[k]),...fields.filter(([k])=>input.fields[k])];
 const draft=input.draft.toLowerCase();
 const domain=/кофе|выпеч|ресторан/.test(draft)?{data:'Есть ли история продаж, закупок и списаний? За какой период?',success:'Как будете измерять снижение списаний или точность закупок?'}:/курьер|достав|логист/.test(draft)?{data:'Есть ли история заказов, маршрутов и времени доставки?',success:'Что нужно улучшить: время доставки, загрузку курьеров или стоимость маршрута?'}:/студент|абитуриент|обучен/.test(draft)?{data:'Какие учебные материалы или проверенные ответы доступны команде?',users:'Кто будет пользоваться решением: студенты, преподаватели или сотрудники?'}:{};
 return {questions:ordered.map(([field,,,text])=>({field,text:input.fields[field]?'Уточните или подтвердите: '+text:domain[field]||text}))};
}
module.exports={generate};
