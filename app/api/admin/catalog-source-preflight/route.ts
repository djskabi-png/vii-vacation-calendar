import {authorizedAdminSession} from '../../../lib/admin-session.ts';
import {createCatalogSourceAdminHandler} from '../../../../infrastructure/http/catalog-source-preflight.mjs';
export const dynamic='force-dynamic';
const handle=createCatalogSourceAdminHandler({
 authorize:async(request:Request)=>!!await authorizedAdminSession(request),
 getApiKey:async()=>{
  let value:string|undefined;
  try{const {env}=await import('cloudflare:workers');value=(env as unknown as {SERGEY_VII_API_TOKEN?:string}).SERGEY_VII_API_TOKEN;}catch{/* Existing server-only fallback. */}
  return value||process.env.SERGEY_VII_API_TOKEN;
 },
});
export function GET(request:Request){return handle(request);}
export function POST(request:Request){return handle(request);}
export function PUT(request:Request){return handle(request);}
export function DELETE(request:Request){return handle(request);}
export function PATCH(request:Request){return handle(request);}
export function OPTIONS(request:Request){return handle(request);}
export function HEAD(request:Request){return handle(request);}
