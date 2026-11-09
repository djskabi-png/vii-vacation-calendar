import type { D1Database } from "../../types/cloudflare-runtime";
import { beginSupplierCatalogRun, type SupplierCatalogEntry, type SupplierCatalogWorld } from "./supplier-catalog-store.ts";

export type GalleryGenerationState = { activeRunId: string; activeCount: number; lockRunId: string | null; lockUntil: string | null };
export async function galleryGenerationState(db: D1Database, world: SupplierCatalogWorld) {
  return db.prepare(`SELECT active_run_id AS activeRunId,active_count AS activeCount,lock_run_id AS lockRunId,lock_until AS lockUntil FROM supplier_catalog_state WHERE world=?`).bind(world).first<GalleryGenerationState>();
}
export async function galleryRun(db:D1Database,world:SupplierCatalogWorld,runId:string) {
  return db.prepare(`SELECT status,error_code AS errorCode FROM supplier_catalog_runs WHERE id=? AND world=?`).bind(runId,world).first<{status:string;errorCode:string|null}>();
}
export async function galleryGenerationIds(db:D1Database,world:SupplierCatalogWorld,runId:string) {
  return (await db.prepare(`SELECT supplier_id AS supplierId FROM supplier_catalog_entries WHERE run_id=? AND world=? ORDER BY supplier_id`).bind(runId,world).all<{supplierId:number}>()).results.map(x=>x.supplierId);
}
export async function galleryGenerationEntry(db:D1Database,world:SupplierCatalogWorld,runId:string,supplierId:number):Promise<SupplierCatalogEntry|null> {
  const value=await db.prepare(`SELECT summary_json AS summaryJson,detail_json AS detailJson FROM supplier_catalog_entries WHERE run_id=? AND world=? AND supplier_id=?`).bind(runId,world,supplierId).first<{summaryJson:string;detailJson:string|null}>();
  return value?{supplierId,summary:JSON.parse(value.summaryJson),detail:value.detailJson?JSON.parse(value.detailJson):undefined}:null;
}
export async function startGalleryGeneration(db:D1Database,world:SupplierCatalogWorld,runId:string,recovery:boolean) {
  const now=new Date(), existing=await galleryRun(db,world,runId), state=await galleryGenerationState(db,world);
  if(!state?.activeRunId||state.activeCount<1)throw Error("missing_catalog_baseline");
  if(state.activeRunId===runId)throw Error("gallery_generation_already_accepted");
  if(existing) {
    const count=await db.prepare(`SELECT COUNT(*) AS count FROM supplier_catalog_entries WHERE run_id=? AND world=?`).bind(runId,world).first<{count:number}>();
    if(!recovery||count?.count!==0||!['running','requested','skipped','failed'].includes(existing.status)||existing.status==='failed'&&existing.errorCode!=='lease_expired')throw Error("gallery_legacy_recovery_requires_review");
    if(state.lockRunId&&state.lockUntil&&Date.parse(state.lockUntil)>now.getTime())throw Error("gallery_catalog_lock_busy");
    const lock=await db.prepare(`UPDATE supplier_catalog_state SET lock_run_id=?,lock_until=? WHERE world=? AND active_run_id=? AND (lock_run_id IS NULL OR lock_until<=?)`).bind(runId,new Date(now.getTime()+120_000).toISOString(),world,state.activeRunId,now.toISOString()).run();
    if(lock.meta.changes!==1)throw Error("gallery_catalog_lock_busy");
    const updated=await db.prepare(`UPDATE supplier_catalog_runs SET status='running',finished_at=NULL,error_code=NULL WHERE id=? AND world=? AND status IN ('running','requested','skipped','failed') AND EXISTS(SELECT 1 FROM supplier_catalog_state WHERE world=? AND lock_run_id=?)`).bind(runId,world,world,runId).run();
    if(updated.meta.changes!==1)throw Error("gallery_recovery_race");
  } else if(!await beginSupplierCatalogRun(db,{id:runId,world,source:'gallery-audit',startedAt:now.toISOString(),lockUntil:new Date(now.getTime()+120_000).toISOString()}))throw Error("gallery_catalog_lock_busy");
  const pinned=await galleryGenerationState(db,world);
  if(!pinned||pinned.lockRunId!==runId||pinned.activeRunId!==state.activeRunId)throw Error("gallery_generation_changed");
  return pinned;
}
export async function renewGalleryGeneration(db:D1Database,world:SupplierCatalogWorld,runId:string,baseline:string) {
  const update=await db.prepare(`UPDATE supplier_catalog_state SET lock_until=? WHERE world=? AND lock_run_id=? AND active_run_id=? AND EXISTS(SELECT 1 FROM supplier_catalog_runs WHERE id=? AND world=? AND status='running')`).bind(new Date(Date.now()+120_000).toISOString(),world,runId,baseline,runId,world).run();
  if(update.meta.changes!==1)throw Error("gallery_generation_lock_lost");
}
export async function recoverGalleryPreparation(db:D1Database,input:{world:SupplierCatalogWorld;runId:string;baseline:string;expectedIds:number[];expectedStagedIds:number[]}) {
  const state=await galleryGenerationState(db,input.world),run=await galleryRun(db,input.world,input.runId),ids=await galleryGenerationIds(db,input.world,input.runId),baselineIds=await galleryGenerationIds(db,input.world,input.baseline),now=new Date();
  if(!state||state.activeRunId!==input.baseline||run?.status!=='failed'||run.errorCode!=='gallery_nonmedia_facts_changed'||JSON.stringify(ids)!==JSON.stringify(input.expectedStagedIds)||JSON.stringify(baselineIds)!==JSON.stringify(input.expectedIds)||state.activeCount!==input.expectedIds.length||state.lockRunId&&state.lockUntil&&Date.parse(state.lockUntil)>now.getTime())throw Error('gallery_facts_recovery_requires_review');
  const results=await db.batch([
    db.prepare(`UPDATE supplier_catalog_state SET lock_run_id=?,lock_until=? WHERE world=? AND active_run_id=? AND (lock_run_id IS NULL OR lock_until<=?) AND EXISTS(SELECT 1 FROM supplier_catalog_runs WHERE id=? AND world=? AND status='failed' AND error_code='gallery_nonmedia_facts_changed')`).bind(input.runId,new Date(now.getTime()+120_000).toISOString(),input.world,input.baseline,now.toISOString(),input.runId,input.world),
    db.prepare(`UPDATE supplier_catalog_runs SET status='running',finished_at=NULL,error_code=NULL WHERE id=? AND world=? AND status='failed' AND error_code='gallery_nonmedia_facts_changed' AND EXISTS(SELECT 1 FROM supplier_catalog_state WHERE world=? AND active_run_id=? AND lock_run_id=?)`).bind(input.runId,input.world,input.world,input.baseline,input.runId),
  ]);
  if(results.some(x=>x.meta.changes!==1))throw Error('gallery_facts_recovery_race');
}
export async function stageGalleryEntry(db:D1Database,runId:string,world:SupplierCatalogWorld,baseline:string,entry:SupplierCatalogEntry) {
  if(!Number.isSafeInteger(entry.supplierId)||entry.supplierId<1)throw Error("invalid_gallery_stage");
  const summary=JSON.stringify(entry.summary),detail=entry.detail===undefined?null:JSON.stringify(entry.detail);
  if(!summary||new TextEncoder().encode(summary+(detail||'')).length>1_800_000)throw Error("catalog_entry_too_large");
  await db.prepare(`INSERT OR IGNORE INTO supplier_catalog_entries(id,run_id,world,supplier_id,summary_json,detail_json) SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM supplier_catalog_state WHERE world=? AND lock_run_id=? AND active_run_id=? AND lock_until>?) AND EXISTS(SELECT 1 FROM supplier_catalog_runs WHERE id=? AND world=? AND status='running')`).bind(`${runId}:${world}:${entry.supplierId}`,runId,world,entry.supplierId,summary,detail,world,runId,baseline,new Date().toISOString(),runId,world).run();
  const staged=await galleryGenerationEntry(db,world,runId,entry.supplierId);
  if(!staged||JSON.stringify(staged.summary)!==summary||(staged.detail===undefined?null:JSON.stringify(staged.detail))!==detail)throw Error("gallery_stage_uncertain");
}
export async function acceptGalleryGeneration(db:D1Database,input:{runId:string;world:SupplierCatalogWorld;baselineRunId:string;expectedIds:number[];changed:number;finishedAt:string}) {
  const state=await galleryGenerationState(db,input.world),run=await galleryRun(db,input.world,input.runId);
  if(state?.activeRunId===input.runId&&run?.status==='accepted')return;
  if(!state||state.lockRunId!==input.runId||state.activeRunId!==input.baselineRunId||run?.status!=='running'||!state.lockUntil||Date.parse(state.lockUntil)<=Date.now())throw Error("gallery_active_generation_changed");
  const ids=await galleryGenerationIds(db,input.world,input.runId),baselineIds=await galleryGenerationIds(db,input.world,input.baselineRunId);
  if(!ids.length||JSON.stringify(ids)!==JSON.stringify(input.expectedIds)||JSON.stringify(ids)!==JSON.stringify(baselineIds)||ids.length!==state.activeCount)throw Error("gallery_candidate_count_mismatch");
  const results=await db.batch([
    db.prepare(`UPDATE supplier_catalog_state SET active_run_id=?,active_count=?,accepted_at=?,lock_run_id=NULL,lock_until=NULL WHERE world=? AND lock_run_id=? AND active_run_id=? AND lock_until>? AND EXISTS(SELECT 1 FROM supplier_catalog_runs WHERE id=? AND world=? AND status='running')`).bind(input.runId,ids.length,input.finishedAt,input.world,input.runId,input.baselineRunId,input.finishedAt,input.runId,input.world),
    db.prepare(`UPDATE supplier_catalog_runs SET status='accepted',finished_at=?,before_count=?,candidate_count=?,added_count=0,changed_count=?,removed_count=0 WHERE id=? AND world=? AND status='running' AND EXISTS(SELECT 1 FROM supplier_catalog_state WHERE world=? AND active_run_id=?)`).bind(input.finishedAt,ids.length,ids.length,input.changed,input.runId,input.world,input.world,input.runId),
  ]);
  if(results.some(result=>result.meta.changes!==1))throw Error("gallery_accept_cas_failed");
}
