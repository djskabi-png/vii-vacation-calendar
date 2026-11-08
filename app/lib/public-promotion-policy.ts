export const publicPromotionWorlds=['vacations','events','rooms','spa'] as const;
export type PublicPromotionWorld=typeof publicPromotionWorlds[number];
export type PublicPromotionWeight={world:PublicPromotionWorld;supplierId:number;weight:number};
export function promotionSupplierId(value:string|number){
 const id=typeof value==='number'?value:Number(value.match(/(?:^|[-:])(\d+)(?::\d+)?$/)?.[1]);
 return Number.isSafeInteger(id)&&id>0?id:0;
}
export function publicPromotionWeights(value:unknown):PublicPromotionWeight[]{
 if(!Array.isArray(value))return [];
 const map=new Map<string,PublicPromotionWeight>();
 for(const row of value.slice(0,10000)){
  if(!row||!publicPromotionWorlds.includes(row.world)||!Number.isSafeInteger(row.supplierId)||row.supplierId<1||!Number.isInteger(row.weight)||row.weight<1||row.weight>5)continue;
  const key=`${row.world}:${row.supplierId}`,old=map.get(key);if(!old||old.weight<row.weight)map.set(key,{world:row.world,supplierId:row.supplierId,weight:row.weight});
 }
 return [...map.values()];
}
