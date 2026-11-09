import type { D1Database, R2Bucket } from "../../types/cloudflare-runtime";
import { GALLERY_AUDIT_PREFIX, downloadGalleryAuditJob, readGalleryAuditItem, readGalleryAuditJob, type AuditWorld } from "./gallery-api-audit-job.ts";
import { prepareGalleryAuditEntry, readGalleryAuditApply } from "./gallery-audit-apply.ts";
import { buildAcceptedGalleryContract, compareGalleryContracts, parseOrderedJson, type GalleryContract } from "./supplier-gallery-contract.ts";
import { supplierNonMediaFactsMatch } from "./supplier-detail-contract.ts";
import { catalogContentIntegrityIssues } from "./supplier-catalog-sync.ts";
import { validSupplierDetailProof } from "./supplier-detail-contract.ts";
import { spaMediaWithinGuard, finishSupplierCatalogRun, type SupplierCatalogEntry } from "./supplier-catalog-store.ts";
import { acceptGalleryGeneration, galleryGenerationEntry, galleryGenerationIds, galleryGenerationState, renewGalleryGeneration, stageGalleryEntry, startGalleryGeneration } from "./gallery-audit-generation-store.ts";

type Warning={supplierId:number;issues:string[]};
export type GalleryApplyState={version:1;jobId:string;world:AuditWorld;runId:string;state:'reserved'|'accepted'|'not_accepted';phase:'initialize'|'prepare'|'accept'|'verify'|'complete'|'error';cursor:number;verifyCursor:number;total:number;ids:number[];baselineRunId?:string;recovery:boolean;changed:number;skipped:number;verified:number;sourceWarnings:Warning[];verificationIssues:Warning[];lease?:{owner:string;until:string};errorCode?:string;createdAt:string;deadline:string;finishedAt?:string};
type Prepared=Awaited<ReturnType<typeof prepareGalleryAuditEntry>>&{jobId:string;world:AuditWorld;baselineRunId:string;baselineFingerprint:string};
const key=(id:string,world:AuditWorld)=>`${GALLERY_AUDIT_PREFIX}${id}/apply/${world}.bounded.json`;
const preparedKey=(state:GalleryApplyState,id:number)=>`${GALLERY_AUDIT_PREFIX}${state.jobId}/apply/prepared/${state.world}-${id}.json`;
const metadata={contentType:'application/json',cacheControl:'private, no-store'};
const hash=async(value:string)=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(x=>x.toString(16).padStart(2,'0')).join('');
function sameFacts(world:AuditWorld,next:SupplierCatalogEntry,current:SupplierCatalogEntry) {
  if(world!=='spa')return supplierNonMediaFactsMatch(next,current);
  // Package presentation follows API order; business facts remain keyed by ID.
  const before=current.summary as {packages?:Array<{id:number}>},after=next.summary as {packages?:Array<{id:number}>};
  if(!Array.isArray(before.packages)||!Array.isArray(after.packages)||before.packages.length!==after.packages.length)return false;
  const byId=new Map(after.packages.map(value=>[value.id,value]));
  if(byId.size!==after.packages.length||before.packages.some(value=>!byId.has(value.id)))return false;
  return supplierNonMediaFactsMatch({...next,summary:{...after,packages:before.packages.map(value=>byId.get(value.id))}},current);
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
        const result=await prepareGalleryAuditEntry({current,source,wire,listing,bucket,world,jobId});
        if(!result.entry||!sameFacts(world,result.entry,current))throw Error('gallery_nonmedia_facts_changed');
        const issues=catalogContentIntegrityIssues(world,[current],[result.entry]);
        if(issues.length&&!await validSupplierDetailProof(result.entry.detailProof,result.entry,new Date(),current))throw Error('catalog_content_requires_review');
        // Per-entry no-loss is stricter than the native aggregate five-percent guard.
        if(world==='spa'&&!spaMediaWithinGuard([current],[result.entry])){result.entry=current;result.api=undefined;result.changed=0;result.skipped=1;result.sourceWarnings.push({supplierId:id,issues:['unverified_spa_media_loss_preserved']});}
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
    const message=cause instanceof Error&&/^[a-z_]{3,100}$/.test(cause.message)?cause.message:'gallery_apply_step_failed';
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
