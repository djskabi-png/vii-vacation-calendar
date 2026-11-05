import hourly from '../data/sergey-hourly-catalog.json' with {type:'json'};
export function entries(){return hourly.places.map(summary=>({supplierId:summary.supplierId,summary}));}
