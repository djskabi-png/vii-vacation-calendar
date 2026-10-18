import {authorizedAdminSession} from '../../../lib/admin-session.ts';
import {backendSchemaInventoryResponse} from '../../../lib/backend-schema-inventory.ts';
import type {D1Database} from '../../../../types/cloudflare-runtime';
export const dynamic='force-dynamic';
const dependencies={
 authorized:async(request:Request)=>!!await authorizedAdminSession(request),
 database:async():Promise<D1Database>=>{
  const {env}=await import('cloudflare:workers');
  const db=(env as unknown as {DB?:D1Database}).DB;
  if(!db)throw Error('database_unavailable');
  return db;
 },
};
export function GET(request:Request){return backendSchemaInventoryResponse(request,dependencies);}
export function POST(request:Request){return backendSchemaInventoryResponse(request,dependencies);}
export function PUT(request:Request){return backendSchemaInventoryResponse(request,dependencies);}
export function DELETE(request:Request){return backendSchemaInventoryResponse(request,dependencies);}
export function PATCH(request:Request){return backendSchemaInventoryResponse(request,dependencies);}
export function OPTIONS(request:Request){return backendSchemaInventoryResponse(request,dependencies);}
export function HEAD(request:Request){return backendSchemaInventoryResponse(request,dependencies);}
