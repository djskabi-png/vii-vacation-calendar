import type { DiscoveryItem } from '../data/world-data';
import { spaPlusAudience } from '../data/spa-audience.ts';
import type { SpaPlusPackage } from '../data/spaplus';
import type { SpaSearchAudienceId } from '../data/spa-search-landings';

export type SpaPriceIndex = { all:number[] } & Partial<Record<SpaSearchAudienceId,number[]>>;
const audienceKeys={יחיד:'single',זוג:'couple',קבוצה:'group','יום כיף':'day-pass'} as const;
export function spaPackagePriceIndex(packages:SpaPlusPackage[]):SpaPriceIndex {
  const index:SpaPriceIndex={all:[]};
  for(const pack of packages){
    if(!Number.isFinite(pack.price)||pack.price<=0)continue;
    index.all.push(pack.price);
    const source=spaPlusAudience(pack);
    if(source!=='לא צוין')(index[audienceKeys[source]]??=[]).push(pack.price);
  }
  for(const key of Object.keys(index) as (keyof SpaPriceIndex)[])index[key]=[...new Set(index[key])].sort((a,b)=>a-b);
  return index;
}

export function pricedSpaSearchItem(item:DiscoveryItem,audience:SpaSearchAudienceId|'',min=0,max=Infinity):DiscoveryItem|null {
  const index=item.spaPackagePrices;
  if(!index)return min>0||Number.isFinite(max)?null:audience?{...item,priceLabel:undefined}:item;
  const prices=(audience?index[audience]||[]:index.all).filter(value=>Number.isFinite(value)&&value>0&&value>=min&&value<=max);
  if(!prices.length)return min>0||Number.isFinite(max)?null:{...item,priceLabel:undefined};
  return {...item,priceLabel:`החל מ ₪ ${Math.min(...prices).toLocaleString('he-IL')}`};
}

export function spaPriceQuery(params:URLSearchParams,minText:string,maxText:string) {
  const min=minText.trim()?Number(minText):0,max=maxText.trim()?Number(maxText):Infinity;
  if(!Number.isFinite(min)||(maxText.trim()&&!Number.isFinite(max))||min<0||max<0||Number.isNaN(max)||min>max)return null;
  const query=new URLSearchParams(params);
  if(min>0)query.set('minPrice',String(min));else query.delete('minPrice');
  if(Number.isFinite(max))query.set('maxPrice',String(max));else query.delete('maxPrice');
  return query;
}
