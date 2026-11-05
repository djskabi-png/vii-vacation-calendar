import sergey from '../data/sergey-public-catalog.json' with {type:'json'};
import details from '../data/sergey-place-details.json' with {type:'json'};
export function entries(world:'vacations'|'events'){return sergey.places.filter(summary=>summary.world===world).map(summary=>({supplierId:summary.supplierId,summary,
 detail:(details.details as Record<string,unknown>)[`${world==='vacations'?'vacation':'event'}-${summary.supplierId}`]||null}));}
