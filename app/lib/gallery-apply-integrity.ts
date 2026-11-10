import type { D1Database, R2Bucket } from '../../types/cloudflare-runtime';
import {galleryGenerationEntryWire,galleryGenerationState,galleryRun} from './gallery-audit-generation-store.ts';
import type {GalleryApplyState} from './gallery-audit-bounded-apply.ts';
const hash=async(v:string)=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v)))].map(x=>x.toString(16).padStart(2,'0')).join('');
const numeric=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)?v:null;
const stats=(summary:unknown,detail:unknown)=>{
 const s=summary&&typeof summary==='object'?summary as Record<string,unknown>:{};
 const d=detail&&typeof detail==='object'?detail as Record<string,unknown>:{};
 const reviews=Array.isArray(d.reviews)?d.reviews:[],scores=reviews.map(r=>r&&typeof r==='object'?numeric((r as Record<string,unknown>).score):null).filter((v):v is number=>v!==null&&v>0&&v<=10);
 return {summary:{score:numeric(s.score),reviews:numeric(s.reviews)},detail:{reviewsCount:reviews.length,scoreAverage:scores.length?scores.reduce((a,b)=>a+b,0)/scores.length:null}};
};
export async function readGalleryApplyIntegrity({db,bucket,state,jobId,world,supplierId}:{db:D1Database;bucket:R2Bucket;state:GalleryApplyState;jobId:string;world:string;supplierId:number}){
 if(!['vacations','events','rooms','spa'].includes(world)||state.jobId!==jobId||state.world!==world||state.state!=='accepted'||state.phase!=='complete'||!state.baselineRunId||state.runId!==`gallery-${jobId}-${world}`||!Number.isSafeInteger(supplierId)||supplierId<1||!state.ids.includes(supplierId))throw Error('gallery_integrity_request_invalid');
 const w=state.world,before=await galleryGenerationState(db,w);
 if(!before||!before.activeRunId)throw Error('gallery_integrity_state_unavailable');
 const run=await galleryRun(db,w,state.runId);if(run?.status!=='accepted')throw Error('gallery_integrity_run_unaccepted');
 const [baseline,target,object]=await Promise.all([galleryGenerationEntryWire(db,w,state.baselineRunId,supplierId),galleryGenerationEntryWire(db,w,state.runId,supplierId),bucket.get(`vii-gallery-audit/v1/${jobId}/apply/prepared/${world}-${supplierId}.json`)]);
 if(!baseline||!target||!object||!Number.isSafeInteger(object.size)||object.size<1||object.size>2_000_000)throw Error('gallery_integrity_entry_unavailable');
 const raw=await object.text();if(new TextEncoder().encode(raw).length!==object.size)throw Error('gallery_integrity_prepared_size');
 const p=JSON.parse(raw),e=p?.entry;
 if(p.jobId!==jobId||p.world!==world||p.baselineRunId!==state.baselineRunId||e?.supplierId!==supplierId||typeof p.baselineFingerprint!=='string'||!/^[a-f0-9]{64}$/.test(p.baselineFingerprint))throw Error('gallery_integrity_prepared_invalid');
 const decode=(row:{summaryJson:string;detailJson:string|null})=>{if(new TextEncoder().encode(row.summaryJson+(row.detailJson||'')).length>1_800_000)throw Error('gallery_integrity_row_size');return {supplierId,summary:JSON.parse(row.summaryJson),detail:row.detailJson?JSON.parse(row.detailJson):undefined};};
 const a=decode(baseline),b=decode(target),c={supplierId,summary:e.summary,detail:e.detail},af=await hash(JSON.stringify(a)),bf=await hash(JSON.stringify(b)),pf=await hash(JSON.stringify(c));
 const after=await galleryGenerationState(db,w);if(!after||before.activeRunId!==after.activeRunId||before.activeCount!==after.activeCount)throw Error('gallery_integrity_pointer_changed');
 return {ok:true,jobId,world,supplierId,baselineRunId:state.baselineRunId,targetRunId:state.runId,activeRunId:after.activeRunId,baseline:{...stats(a.summary,a.detail),fingerprint:af},target:{...stats(b.summary,b.detail),fingerprint:bf},prepared:{...stats(c.summary,c.detail),baselineFingerprint:p.baselineFingerprint,entryFingerprint:pf},baselineChangedSincePreparation:af!==p.baselineFingerprint,targetMatchesPrepared:bf===pf};
}
