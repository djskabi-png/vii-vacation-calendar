import spa from '../data/spaplus-catalog.json' with {type:'json'};
export function entries(){return spa.sites.map(summary=>({supplierId:summary.id,summary}));}
