import type { D1Database } from '../../types/cloudflare-runtime';
import type { ProfessorIntent, ProfessorMetric, ProfessorPlace, ProfessorRange, ProfessorWorld } from './admin-professor-intent.ts';
import {professorPeriodBounds} from './professor-period-bounds.ts';

export type ProfessorBusinessRow = ProfessorPlace & { values: Partial<Record<ProfessorMetric, number | null>>; bizSavedAt?: string };
const worldAliases:Record<string,ProfessorWorld>={vacation:'vacations',vacations:'vacations',event:'events',events:'events',hourly:'rooms',room:'rooms',rooms:'rooms',spa:'spa'};
const key=(world:string,id:number|string)=>`${worldAliases[world]||world}:${id}`;
type Coverage={world:string;siteID:number;fromDay:string;tillDay:string;savedAt?:string};

/** Daily and overlapping snapshots can jointly cover a period. Gaps remain unknown. */
export function coveredProfessorPeriod(rows:Coverage[],from:string,till:string){
 let next=from;
 for(const row of [...rows].sort((a,b)=>a.fromDay.localeCompare(b.fromDay))){
  if(row.tillDay<next)continue;
  if(row.fromDay>next)return false;
  if(row.tillDay>=till)return true;
  const date=new Date(row.tillDay+'T12:00:00Z');date.setUTCDate(date.getUTCDate()+1);next=date.toISOString().slice(0,10);
 }
 return false;
}

export async function readProfessorBusinessBreakdown(db:D1Database,bizDb:D1Database,range:ProfessorRange,bizRange:ProfessorRange|null,intent:ProfessorIntent,places:ProfessorPlace[]):Promise<ProfessorBusinessRow[]>{
 const selected=places.filter(place=>(!intent.world||place.world===intent.world)&&(!intent.place||place.placeId===intent.place.placeId&&place.world===intent.place.world));
 const rows:ProfessorBusinessRow[]=selected.map(place=>({...place,values:Object.fromEntries(intent.metrics.map(metric=>[metric,metric.startsWith('biz')?null:0])) as ProfessorBusinessRow['values']}));
 const byPlace=new Map(rows.map(row=>[`${row.world}:${row.placeId}`,row]));
 const bySupplier=new Map(rows.filter(row=>row.siteID).map(row=>[key(row.world,row.siteID!),row]));
 const findPlace=(world:string,placeId:string)=>byPlace.get(key(world,placeId))||bySupplier.get(key(world,Number(placeId.match(/\d+$/)?.[0])));
 const requested=new Set(intent.metrics);
 const {since,until}=professorPeriodBounds(range.from,range.till);
 if(intent.metrics.some(metric=>['impressions','pageViews','phone','whatsapp'].includes(metric))){
  const result=await db.prepare(`SELECT world,place_id AS placeId,
   SUM(CASE WHEN name='impression' THEN 1 ELSE 0 END) AS impressions,
   SUM(CASE WHEN name='page_view' THEN 1 ELSE 0 END) AS pageViews,
   SUM(CASE WHEN name IN ('phone_reveal','phone_click') THEN 1 ELSE 0 END) AS phone,
   SUM(CASE WHEN name IN ('whatsapp_lead','whatsapp_handoff') THEN 1 ELSE 0 END) AS whatsapp
   FROM vii_business_events WHERE created_at>=? AND created_at<? AND internal=0 GROUP BY world,place_id`).bind(since,until).all<{world:string;placeId:string;impressions:number;pageViews:number;phone:number;whatsapp:number}>();
  for(const value of result.results){const row=findPlace(value.world,value.placeId);if(row)for(const metric of ['impressions','pageViews','phone','whatsapp'] as const)if(requested.has(metric))row.values[metric]=(row.values[metric]||0)+Number(value[metric]||0);}
 }
 if(requested.has('viiBookings')){
  const result=await db.prepare(`SELECT world,place_id AS placeId,COUNT(*) AS total FROM vii_booking_audit WHERE created_at>=? AND created_at<? GROUP BY world,place_id`).bind(since,until).all<{world:string;placeId:string;total:number}>();
  for(const value of result.results){const row=findPlace(value.world,value.placeId);if(row)row.values.viiBookings=(row.values.viiBookings||0)+Number(value.total||0);}
 }
 if(intent.metrics.some(metric=>metric.startsWith('biz'))&&bizRange){
  const coverage=await bizDb.prepare(`SELECT world,site_id AS siteID,from_day AS fromDay,till_day AS tillDay,saved_at AS savedAt FROM vii_biz_conversion_coverage_v1 WHERE from_day<=? AND till_day>=?`).bind(bizRange.till,bizRange.from).all<Coverage>();
  const groups=new Map<string,Coverage[]>();
  for(const value of coverage.results){const k=key(value.world,value.siteID);groups.set(k,[...(groups.get(k)||[]),value]);}
  const covered=new Set([...groups].filter(([,values])=>coveredProfessorPeriod(values,bizRange.from,bizRange.till)).map(([k])=>k));
  for(const k of covered){const row=bySupplier.get(k);if(row&&row.world!=='spa'){row.bizSavedAt=groups.get(k)?.map(value=>value.savedAt||'').sort().at(-1);for(const metric of intent.metrics)if(metric.startsWith('biz'))row.values[metric]=0;}}
  if(requested.has('bizCalls')||requested.has('bizWhatsapp')){
   const result=await bizDb.prepare(`SELECT world,site_id AS siteID,SUM(CASE WHEN source='maskyoo' THEN 1 ELSE 0 END) AS calls,SUM(CASE WHEN source='whatsapp' THEN 1 ELSE 0 END) AS whatsapp FROM vii_biz_conversion_contacts_v1 WHERE contact_day>=? AND contact_day<=? GROUP BY world,site_id`).bind(bizRange.from,bizRange.till).all<{world:string;siteID:number;calls:number;whatsapp:number}>();
   for(const value of result.results){const k=key(value.world,value.siteID),row=bySupplier.get(k);if(row&&covered.has(k)&&row.world!=='spa'){if(requested.has('bizCalls'))row.values.bizCalls=(row.values.bizCalls||0)+Number(value.calls||0);if(requested.has('bizWhatsapp'))row.values.bizWhatsapp=(row.values.bizWhatsapp||0)+Number(value.whatsapp||0);}}
  }
  if(requested.has('bizOrders')||requested.has('bizRevenue')){
   const result=await bizDb.prepare(`SELECT world,site_id AS siteID,COUNT(*) AS orders,COALESCE(SUM(price),0) AS revenue FROM (SELECT world,site_id,order_id,MAX(order_price) AS price FROM vii_biz_conversion_contacts_v1 WHERE contact_day>=? AND contact_day<=? AND order_id IS NOT NULL GROUP BY world,site_id,order_id) GROUP BY world,site_id`).bind(bizRange.from,bizRange.till).all<{world:string;siteID:number;orders:number;revenue:number}>();
   for(const value of result.results){const k=key(value.world,value.siteID),row=bySupplier.get(k);if(row&&covered.has(k)&&row.world!=='spa'){if(requested.has('bizOrders'))row.values.bizOrders=(row.values.bizOrders||0)+Number(value.orders||0);if(requested.has('bizRevenue'))row.values.bizRevenue=(row.values.bizRevenue||0)+Number(value.revenue||0);}}
  }
 }
 const first=intent.metrics[0];
 return rows.sort((a,b)=>a.values[first]==null?b.values[first]==null?a.name.localeCompare(b.name,'he'):1:b.values[first]==null?-1:Number(b.values[first])-Number(a.values[first])||a.name.localeCompare(b.name,'he'));
}
