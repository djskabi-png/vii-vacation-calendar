// Fixed, readonly, metadata-only SQL. All canonical timestamps are UTC, never
// session-timezone dependent. No input selects a world, table or SQL fragment.
export const SHADOW_SCHEMA='vii_stage_catalog_shadow';
export const SHADOW_ROLE='vii_stage_catalog_reader';
export const SHADOW_WORLDS=Object.freeze(['events','rooms','spa','vacations']);
const schema=SHADOW_SCHEMA;
export const SHADOW_MANIFEST_SQL=`WITH normalized AS (
 SELECT s.world,s.active_run_id,s.active_count,
  jsonb_build_object(
   'run',to_jsonb(r)||jsonb_build_object(
    'started_at',to_char(r.started_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    'finished_at',to_char(r.finished_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')),
   'state',to_jsonb(s)||jsonb_build_object(
    'accepted_at',to_char(s.accepted_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    'lock_until',to_char(s.lock_until AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')),
   'entries',COALESCE((SELECT jsonb_agg(to_jsonb(e) ORDER BY e.id COLLATE "C")
     FROM ${schema}.supplier_catalog_entries e WHERE e.world=s.world AND e.run_id=s.active_run_id),'[]'::jsonb)
  ) AS doc,
  (SELECT count(*) FROM ${schema}.supplier_catalog_entries e WHERE e.world=s.world) AS entry_count,
  (SELECT count(*) FROM ${schema}.supplier_catalog_runs r2 WHERE r2.world=s.world) AS run_count
 FROM ${schema}.supplier_catalog_state s
 JOIN ${schema}.supplier_catalog_runs r ON r.id=s.active_run_id AND r.world=s.world
)
SELECT jsonb_build_object('database',current_database(),'role',current_user,
 'readOnly',current_setting('transaction_read_only')='on',
 'worlds',COALESCE(jsonb_agg(jsonb_build_object('world',world,'activeRunId',active_run_id,
   'activeCount',active_count,'entryCount',entry_count,'runCount',run_count,
   'sha256',encode(sha256(convert_to(doc::text,'UTF8')),'hex')) ORDER BY world COLLATE "C"),'[]'::jsonb)
) AS manifest FROM normalized`;
function closed(value,keys){return value&&typeof value==='object'&&!Array.isArray(value)&&
 Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));}
export function validateShadowWorlds(worlds){
 if(!Array.isArray(worlds)||worlds.length!==4)throw Error('invalid_shadow_worlds');
 const seen=new Set();
 const rows=worlds.map(row=>{
  if(!closed(row,['world','activeRunId','activeCount','entryCount','runCount','sha256'])||
   !SHADOW_WORLDS.includes(row.world)||seen.has(row.world)||typeof row.activeRunId!=='string'||
   !/^[A-Za-z0-9_.:-]{1,300}$/.test(row.activeRunId)||
   !Number.isSafeInteger(row.activeCount)||row.activeCount<1||row.activeCount>5000||
   row.entryCount!==row.activeCount||row.runCount!==1||typeof row.sha256!=='string'||
   !/^[a-f0-9]{64}$/.test(row.sha256))throw Error('invalid_shadow_world');
  seen.add(row.world);
  return {world:row.world,activeRunId:row.activeRunId,activeCount:row.activeCount,
   entryCount:row.entryCount,runCount:1,sha256:row.sha256};
 });
 return rows.sort((a,b)=>SHADOW_WORLDS.indexOf(a.world)-SHADOW_WORLDS.indexOf(b.world));
}
export function validateShadowManifest(value){
 if(!closed(value,['database','role','readOnly','worlds'])||value.database!=='vii'||
  value.role!==SHADOW_ROLE||value.readOnly!==true)throw Error('invalid_shadow_identity');
 return {database:'vii',role:SHADOW_ROLE,readOnly:true,worlds:validateShadowWorlds(value.worlds)};
}
export function compareShadowManifest(value,expected,currentGenerations){
 const actual=validateShadowManifest(value),wanted=validateShadowWorlds(expected);
 if(!Array.isArray(currentGenerations)||currentGenerations.length!==4)throw Error('invalid_source_generations');
 const source=new Map();
 for(const row of currentGenerations){
  if(!closed(row,['world','activeRunId','activeCount','lockRunId','lockUntil'])||
   !SHADOW_WORLDS.includes(row.world)||source.has(row.world)||row.lockRunId!==null||row.lockUntil!==null)
   throw Error('invalid_source_generations');
  source.set(row.world,row);
 }
 for(let index=0;index<4;index++){
  const a=actual.worlds[index],e=wanted[index],s=source.get(e.world);
  if(s.activeRunId!==e.activeRunId||s.activeCount!==e.activeCount)throw Error('stale_source_generation');
  if(JSON.stringify(a)!==JSON.stringify(e))throw Error('shadow_parity_mismatch');
 }
 return {ok:true,databaseConnected:true,readOnly:true,projectedCatalogMatched:true,
  worlds:actual.worlds.map(({world,activeRunId,entryCount})=>({world,activeRunId,entries:entryCount})),
  rawWholeRowParity:false,publicSourceChanged:false,fullLaunchReady:false};
}
