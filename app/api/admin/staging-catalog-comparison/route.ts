import {authorizedAdminSession} from '../../../lib/admin-session.ts';
import {createStagingCatalogClient,readStagingCatalogConfiguration} from '../../../../infrastructure/http/staging-catalog-client.mjs';
import {CATALOG_SHADOW_EXPECTED} from '../../../../infrastructure/postgres/catalog-shadow-expected.mjs';
import type {D1Database} from '../../../../types/cloudflare-runtime';

export const dynamic='force-dynamic';
const handle=createStagingCatalogClient({
 authorize:async(request:Request)=>!!await authorizedAdminSession(request),
 diagnostics:(code:string)=>console.error(`[vii-stage-catalog] ${code}`),
 expectedWorlds:CATALOG_SHADOW_EXPECTED,
 getCredentials:async()=>{
  let workerValue:string|undefined;
  try{const {env}=await import('cloudflare:workers');workerValue=(env as unknown as {VII_STAGE_CATALOG_CONFIG?:string}).VII_STAGE_CATALOG_CONFIG;}catch{/* existing server-only process channel remains available */}
  return readStagingCatalogConfiguration(workerValue,process.env.VII_STAGE_CATALOG_CONFIG);
 },
 getCurrentGenerations:async()=>{
  const {env}=await import('cloudflare:workers');
  const db=(env as unknown as {DB?:D1Database}).DB;
  if(!db)throw Error('source_unavailable');
  const result=await db.prepare(`SELECT world,active_run_id AS activeRunId,active_count AS activeCount,
   lock_run_id AS lockRunId,lock_until AS lockUntil FROM supplier_catalog_state ORDER BY world`).all();
  if(!result.success||!Array.isArray(result.results))throw Error('source_unavailable');
  return result.results;
 },
});
export function GET(request:Request){return handle(request);}
export function POST(request:Request){return handle(request);}
export function PUT(request:Request){return handle(request);}
export function DELETE(request:Request){return handle(request);}
export function PATCH(request:Request){return handle(request);}
export function OPTIONS(request:Request){return handle(request);}
export function HEAD(request:Request){return handle(request);}
