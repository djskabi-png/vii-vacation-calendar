import type { D1Database, R2Bucket } from "../../types/cloudflare-runtime";
import { GALLERY_AUDIT_PREFIX, downloadGalleryAuditJob, readGalleryAuditItem, readGalleryAuditJob, type AuditWorld } from "./gallery-api-audit-job.ts";
import { prepareGalleryAuditEntry, readGalleryAuditApply } from "./gallery-audit-apply.ts";
import { buildAcceptedGalleryContract, compareGalleryContracts, parseOrderedJson, type GalleryContract } from "./supplier-gallery-contract.ts";
import { isQuarantinedGalleryMedia,legacyGalleryFilename } from "./legacy-gallery-media.ts";
import { reviewableGallerySourceFailure } from "./gallery-source-media-failure.ts";
import { catalogContentIntegrityIssues } from "./supplier-catalog-sync.ts";
import { validSupplierDetailProof } from "./supplier-detail-contract.ts";
import { spaMediaWithinGuard, finishSupplierCatalogRun, type SupplierCatalogEntry } from "./supplier-catalog-store.ts";
import { acceptGalleryGeneration, galleryGenerationEntry, galleryGenerationIds, galleryGenerationState, renewGalleryGeneration, stageGalleryEntry, startGalleryGeneration, recoverGalleryPreparation } from "./gallery-audit-generation-store.ts";

type Warning={supplierId:number;issues:string[]};
export type GalleryApplyState={version:1;jobId:string;world:AuditWorld;runId:string;state:'reserved'|'accepted'|'not_accepted';phase:'initialize'|'prepare'|'accept'|'verify'|'complete'|'error';cursor:number;verifyCursor:number;total:number;ids:number[];baselineRunId?:string;recovery:boolean;factsRecoveryUsed?:boolean;sourceRecoveryUsed?:boolean;recoveryWindowUsed?:boolean;recoveryIntent?:{errorCode:string;cursor:number;baselineRunId:string};changed:number;skipped:number;verified:number;sourceWarnings:Warning[];verificationIssues:Warning[];lease?:{owner:string;until:string};errorCode?:string;createdAt:string;deadline:string;finishedAt?:string};
type Prepared=Awaited<ReturnType<typeof prepareGalleryAuditEntry>>&{jobId:string;world:AuditWorld;baselineRunId:string;baselineFingerprint:string};
const key=(id:string,world:AuditWorld)=>`${GALLERY_AUDIT_PREFIX}${id}/apply/${world}.bounded.json`;
const preparedKey=(state:GalleryApplyState,id:number)=>`${GALLERY_AUDIT_PREFIX}${state.jobId}/apply/prepared/${state.world}-${id}.json`;
const metadata={contentType:'application/json',cacheControl:'private, no-store'};
const hash=async(value:string)=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(x=>x.toString(16).padStart(2,'0')).join('');
export function galleryNonMediaFactsMatch(world:AuditWorld,next:SupplierCatalogEntry,current:SupplierCatalogEntry) {
  const project=(entry:SupplierCatalogEntry)=>{
    const value=structuredClone(entry) as unknown as Record<string,unknown>;delete value.detailProof;
    const clean=(item:unknown)=>{if(!item||typeof item!=='object'||Array.isArray(item))return;const row=item as Record<string,unknown>;for(const name of ['image','images','gallery','galleryGroups'])delete row[name];for(const name of ['rooms','packages'])if(Array.isArray(row[name])){for(const child of row[name])clean(child);if(world==='spa'&&name==='packages')row[name].sort((a,b)=>Number(a.id)-Number(b.id));}};
    clean(value.summary);clean(value.detail);return value;
  };
  return JSON.stringify(project(next))===JSON.stringify(project(current));
}
function quarantineFree(entry:SupplierCatalogEntry):SupplierCatalogEntry {
  const clean=(value:unknown):unknown=>typeof value==='string'&&isQuarantinedGalleryMedia(value)?'':Array.isArray(value)?value.filter(x=>!isQuarantinedGalleryMedia(x)).map(clean):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([k,v])=>[k,clean(v)])):value;
  return clean(entry) as SupplierCatalogEntry;
}
function sourceFallback(current:SupplierCatalogEntry,normalized:unknown,code:string):Awaited<ReturnType<typeof prepareGalleryAuditEntry>> {
  const collect=(value:unknown,out:Set<string>)=>{if(typeof value==='string'){const name=legacyGalleryFilename(value);if(name)out.add(name);}else if(Array.isArray(value))value.forEach(x=>collect(x,out));else if(value&&typeof value==='object')for(const [name,child]of Object.entries(value))if(['image','images','gallery','galleryGroups','rooms','packages','summary','detail','pictures'].includes(name))collect(child,out);};
  const before=new Set<string>(),after=new Set<string>();collect(current,before);collect(normalized,after);
  return {entry:current,api:undefined,changed:0,skipped:1,sourceWarnings:[{supplierId:current.supplierId,issues:[`unverified_source_media:${code}`,...[...after].filter(name=>!before.has(name)).map(name=>`unverified_candidate_media:${name}`)]}]};
}
export async function recoverBoundedGalleryApply({db,bucket,jobId,world}:{db:D1Database;bucket:R2Bucket;jobId:string;world:AuditWorld}) {
  const object=await bucket.get(key(jobId,world));if(!object)throw Error('gallery_apply_not_started');const state=JSON.parse(await object.text()) as GalleryApplyState;
  const code=state.errorCode,sourceFailure=reviewableGallerySourceFailure(code),hardDeadline=Date.parse(state.createdAt)+120*60_000;
  if(state.jobId!==jobId||state.world!==world||state.phase!=='error'||state.state!=='not_accepted'||(!sourceFailure&&code!=='gallery_nonmedia_facts_changed')||(sourceFailure?state.sourceRecoveryUsed:state.factsRecoveryUsed)||!state.baselineRunId||state.verifyCursor!==0||state.cursor>=state.total||!Number.isFinite(hardDeadline)||hardDeadline<=Date.now()||Date.parse(state.deadline)<=Date.now()&&state.recoveryWindowUsed)throw Error('gallery_facts_recovery_requires_review');
  if(state.lease&&Date.parse(state.lease.until)>Date.now())throw Error('gallery_apply_step_in_progress');
  const reconcileRunning=!!state.recoveryIntent&&state.recoveryIntent.errorCode===code&&state.recoveryIntent.cursor===state.cursor&&state.recoveryIntent.baselineRunId===state.baselineRunId;
  state.recoveryIntent={errorCode:code!,cursor:state.cursor,baselineRunId:state.baselineRunId};
  state.lease={owner:crypto.randomUUID(),until:new Date(Date.now()+120_000).toISOString()};
  const lease=await bucket.put(key(jobId,world),JSON.stringify(state),{onlyIf:{etagMatches:object.etag},httpMetadata:metadata});if(!lease)throw Error('gallery_apply_step_in_progress');
  try{
    await recoverGalleryPreparation(db,{world,runId:state.runId,baseline:state.baselineRunId,expectedIds:state.ids,expectedStagedIds:state.ids.slice(0,state.cursor),expectedError:code,reconcileRunning});
    if(sourceFailure){const id=state.ids[state.cursor],current=await galleryGenerationEntry(db,world,state.baselineRunId,id);if(!current)throw Error('gallery_baseline_entry_missing');
      const source=await readGalleryAuditItem(bucket,jobId,world,id),fallback:Prepared={...sourceFallback(current,source?.normalized,code!),jobId,world,baselineRunId:state.baselineRunId,baselineFingerprint:await hash(JSON.stringify(current))};
      const old=await bucket.get(preparedKey(state,id));if(old){if(await old.text()!==JSON.stringify(fallback))throw Error('gallery_recovery_prepared_changed');}
      else if(!await bucket.put(preparedKey(state,id),JSON.stringify(fallback),{onlyIf:{etagDoesNotMatch:'*'},httpMetadata:metadata}))throw Error('gallery_prepared_write_uncertain');
      state.sourceRecoveryUsed=true;
    }else state.factsRecoveryUsed=true;
    if(!state.recoveryWindowUsed){state.deadline=new Date(hardDeadline).toISOString();state.recoveryWindowUsed=true;}
    state.phase='prepare';state.state='reserved';delete state.recoveryIntent;delete state.errorCode;delete state.finishedAt;
  }
  finally{delete state.lease;const saved=await bucket.put(key(jobId,world),JSON.stringify(state),{onlyIf:{etagMatches:lease.etag},httpMetadata:metadata});if(!saved)throw Error('gallery_apply_progress_uncertain');}
  return state;
}
export async function readBoundedGalleryApply(bucket:R2Bucket,jobId:string,world:AuditWorld):Promise<GalleryApplyState|null>{const object=await bucket.get(key(jobId,world));return object?JSON.parse(await object.text()):null;}

export async function startBoundedGalleryApply({db,bucket,jobId,world,recovery=false}:{db:D1Database;bucket:R2Bucket;jobId:string;world:AuditWorld;recovery?:boolean}) {
  const existing=await readBoundedGalleryApply(bucket,jobId,world);if(existing)return existing;
  const old=await readGalleryAuditApply(bucket,jobId,world);
  if(old&&(!recovery||old.state!=='reserved'))throw Error('gallery_existing_apply_requires_reconciliation');
  const job=await readGalleryAuditJob(bucket,jobId);
  if(!job||job.state!=='complete'||job.completed!==job.total)throw Error('gallery_audit_not_complete');
  const now=new Date();
  const state:GalleryApplyState={version:1,jobId,world,runId:`gallery-${jobId}-${world}`,state:'reserved',phase:'initialize',cursor:0,verifyCursor:0,total:0,ids:[],recovery,changed:0,skipped:0,verified:0,sourceWarnings:[],verificationIssues:[],createdAt:now.toISOString(),deadline:new Date(now.getTime()+60*60_000).toISOString()};
  await bucket.put(key(jobId,world),JSON.stringify(state),{onlyIf:{etagDoesNotMatch:'*'},httpMetadata:metadata});
  const saved=await readBoundedGalleryApply(bucket,jobId,world);if(!saved)throw Error('gallery_apply_reservation_uncertain');return saved;
}
function checkPrepared(state:GalleryApplyState,value:Prepared,id:number) {
  if(value.jobId!==state.jobId||value.world!==state.world||value.baselineRunId!==state.baselineRunId||value.entry?.supplierId!==id)throw Error('gallery_prepared_identity_mismatch');
}
export async function stepBoundedGalleryApply({db,bucket,jobId,world}:{db:D1Database;bucket:R2Bucket;jobId:string;world:AuditWorld}) {
  const object=await bucket.get(key(jobId,world));if(!object)throw Error('gallery_apply_not_started');
  const state=JSON.parse(await object.text()) as GalleryApplyState;
  if(state.jobId!==jobId||state.world!==world)throw Error('gallery_apply_identity_mismatch');
  if(state.phase==='complete'||state.phase==='error')return state;
  if(state.lease&&Date.parse(state.lease.until)>Date.now())throw Error('gallery_apply_step_in_progress');
  if(Date.parse(state.deadline)<=Date.now())throw Error('gallery_apply_deadline');
  state.lease={owner:crypto.randomUUID(),until:new Date(Date.now()+120_000).toISOString()};
  const lease=await bucket.put(key(jobId,world),JSON.stringify(state),{onlyIf:{etagMatches:object.etag},httpMetadata:metadata});if(!lease)throw Error('gallery_apply_step_in_progress');
  delete state.errorCode;
  try {
    if(state.phase==='initialize') {
      const pinned=await startGalleryGeneration(db,world,state.runId,state.recovery);
      state.baselineRunId=pinned.activeRunId;state.ids=await galleryGenerationIds(db,world,pinned.activeRunId);
      if(state.ids.length!==pinned.activeCount||new Set(state.ids).size!==state.ids.length)throw Error('gallery_active_generation_incomplete');
      const findings=(await downloadGalleryAuditJob(bucket,jobId)).trim().split('\n').slice(1).map(line=>JSON.parse(line) as {world:string;supplierId:number});
      const wanted=new Set(findings.filter(x=>x.world===world).map(x=>x.supplierId));
      if(state.ids.some(id=>!wanted.has(id)))throw Error('gallery_audit_baseline_inventory_changed');
      state.total=state.ids.length;state.phase='prepare';
    } else if(state.phase==='prepare') {
      await renewGalleryGeneration(db,world,state.runId,state.baselineRunId!);
      const id=state.ids[state.cursor],current=await galleryGenerationEntry(db,world,state.baselineRunId!,id);
      if(!current)throw Error('gallery_baseline_entry_missing');
      const fingerprint=await hash(JSON.stringify(current));
      const stored=await bucket.get(preparedKey(state,id));
      let prepared:Prepared;
      if(stored){prepared=JSON.parse(await stored.text());checkPrepared(state,prepared,id);if(prepared.baselineFingerprint!==fingerprint)throw Error('gallery_baseline_entry_changed');}
      else {
        const source=await readGalleryAuditItem(bucket,jobId,world,id);let wire:string|undefined,listing:unknown;
        if(world==='vacations'||world==='events') {
          if(source?.api&&source.normalized&&source.acceptedContract&&source.normalizedContract) {
            const expectedRawKey=`${GALLERY_AUDIT_PREFIX}${jobId}/raw/${world}-${id}.json`;
            if(source.rawKey!==expectedRawKey)throw Error('invalid_gallery_source_reference');
            const raw=await bucket.get(expectedRawKey);if(!raw)throw Error('gallery_source_snapshot_missing');wire=await raw.text();
            const listObject=await bucket.get(`${GALLERY_AUDIT_PREFIX}${jobId}/context/${world}.json`);if(!listObject)throw Error('gallery_source_snapshot_missing');
            const list=parseOrderedJson(await listObject.text()) as {places?:Array<{siteID:number}>};listing=list.places?.find(x=>Number(x.siteID)===id);
          }
        }
        let result:Awaited<ReturnType<typeof prepareGalleryAuditEntry>>;
        try{result=await prepareGalleryAuditEntry({current,source,wire,listing,bucket,world,jobId});}
        catch(cause){const code=cause instanceof Error?cause.message:'';if(!reviewableGallerySourceFailure(code))throw cause;result=sourceFallback(current,source?.normalized,code);}
        if(!result.entry||!galleryNonMediaFactsMatch(world,result.entry,current))throw Error('gallery_nonmedia_facts_changed');
        const issues=catalogContentIntegrityIssues(world,[current],[result.entry]);
        if(issues.length&&!await validSupplierDetailProof(result.entry.detailProof,result.entry,new Date(),current))throw Error('catalog_content_requires_review');
        // Per-entry no-loss is stricter than the native aggregate five-percent guard.
        if(world==='spa'&&!spaMediaWithinGuard([quarantineFree(current)],[result.entry])){result.entry=current;result.api=undefined;result.changed=0;result.skipped=1;result.sourceWarnings.push({supplierId:id,issues:['unverified_spa_media_loss_preserved']});}
        prepared={...result,jobId,world,baselineRunId:state.baselineRunId!,baselineFingerprint:fingerprint};
        const saved=await bucket.put(preparedKey(state,id),JSON.stringify(prepared),{onlyIf:{etagDoesNotMatch:'*'},httpMetadata:metadata});if(!saved)throw Error('gallery_prepared_write_uncertain');
      }
      await stageGalleryEntry(db,state.runId,world,state.baselineRunId!,prepared.entry);
      state.changed+=prepared.changed;state.skipped+=prepared.skipped;state.sourceWarnings.push(...prepared.sourceWarnings);
      state.cursor++;if(state.cursor===state.total)state.phase='accept';
    } else if(state.phase==='accept') {
      const live=await galleryGenerationState(db,world);
      if(live?.activeRunId!==state.runId)await renewGalleryGeneration(db,world,state.runId,state.baselineRunId!);
      await acceptGalleryGeneration(db,{runId:state.runId,world,baselineRunId:state.baselineRunId!,expectedIds:state.ids,changed:state.changed,finishedAt:new Date().toISOString()});
      state.phase='verify';
    } else if(state.phase==='verify') {
      const live=await galleryGenerationState(db,world);if(live?.activeRunId!==state.runId)throw Error('gallery_postverify_generation_changed');
      for(const id of state.ids.slice(state.verifyCursor,state.verifyCursor+4)) {
        const object=await bucket.get(preparedKey(state,id));if(!object)throw Error('gallery_prepared_missing');
        const prepared=JSON.parse(await object.text()) as Prepared;checkPrepared(state,prepared,id);
        const accepted=await galleryGenerationEntry(db,world,state.runId,id);
        if(!accepted||JSON.stringify([accepted.summary,accepted.detail])!==JSON.stringify([prepared.entry.summary,prepared.entry.detail]))throw Error('gallery_postverify_staged_changed');
        if(prepared.api){const comparison=compareGalleryContracts(prepared.api,await buildAcceptedGalleryContract(world,accepted));const issues=comparison.issues.filter(x=>!x.startsWith('unverified_empty_owner_media:')&&!x.startsWith('unverified_quarantined_api_media:'));if(issues.length)state.verificationIssues.push({supplierId:id,issues});else state.verified++;}
        state.verifyCursor++;
      }
      if(state.verifyCursor===state.total){state.phase='complete';state.state='accepted';state.finishedAt=new Date().toISOString();}
    }
  } catch(cause) {
    const live=await galleryGenerationState(db,world);
    const message=cause instanceof Error&&/^[a-z_0-9]{3,100}$/.test(cause.message)?cause.message:'gallery_apply_step_failed';
    state.errorCode=message;
    if(live?.activeRunId===state.runId){state.phase='verify';}
    else if(!state.baselineRunId&&message==='gallery_catalog_lock_busy'){
      // Initialization did not acquire the lock. Never release another live
      // invocation's lease, including a legacy request with this same run ID.
      state.phase='initialize';
    }else{state.phase='error';state.state='not_accepted';if(state.baselineRunId)await finishSupplierCatalogRun(db,{id:state.runId,world,status:'failed',errorCode:message,finishedAt:new Date().toISOString()});}
  }
  delete state.lease;
  const saved=await bucket.put(key(jobId,world),JSON.stringify(state),{onlyIf:{etagMatches:lease.etag},httpMetadata:metadata});if(!saved)throw Error('gallery_apply_progress_uncertain');
  return state;
}
