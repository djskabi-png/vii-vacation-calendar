import { launch } from '@cloudflare/playwright';
import { runBrowserJob, validJob, type BrowserEnvironment } from './engine.ts';
import { readJsonBody, RequestBodyError } from './request-body.ts';
import { readEvidence } from './evidence.ts';
type Env = BrowserEnvironment & { BROWSER: Parameters<typeof launch>[0]; EVIDENCE?: { get(key: string): Promise<{ body: ReadableStream; httpMetadata?: { contentType?: string }; customMetadata?: Record<string, string> } | null> } };

// No workers.dev URL, preview URL or public route is configured. This endpoint
// is for an authenticated controller's private Service Binding, never a browser.
export default { async fetch(request:Request,env:Env) {
  const headers={'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow'};
  if(request.method==='GET' && new URL(request.url).pathname==='/evidence') {
    const url=new URL(request.url); const sourceVersion=url.searchParams.get('sourceVersion')||''; const jobId=url.searchParams.get('jobId')||''; const device=url.searchParams.get('device')||''; const scenario=url.searchParams.get('scenario')||'';
    try {
      const keys=['sourceVersion','jobId','device','scenario'];
      if(request.headers.has('cookie')||request.headers.has('authorization')||[...url.searchParams.keys()].some(key=>!keys.includes(key))||keys.some(key=>url.searchParams.getAll(key).length!==1)||!env.EVIDENCE || request.headers.get('X-VII-Quality-Evidence-Source')!==sourceVersion)return Response.json({error:'evidence_forbidden'},{status:403,headers});
      // Historical evidence remains readable after an engine release. Only the
      // private controller can reach this binding; it derives this tuple from
      // a persisted, definition-verified job rather than a caller-supplied key.
      const result=await readEvidence(env.EVIDENCE,{sourceVersion,jobId,device,scenario},{signal:request.signal});
      if(!result)return Response.json({error:'evidence_not_found'},{status:404,headers});
      return new Response(result.body,{status:200,headers:{'Cache-Control':'private, no-store','Content-Type':'image/jpeg','Content-Length':String(result.body.byteLength),'X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow'}});
    } catch(error) { const code=error instanceof Error ? error.message : ''; const status=code==='evidence_too_large'?413:code==='evidence_read_timeout'?408:403; return Response.json({error:status===413?'evidence_too_large':status===408?'evidence_read_timeout':'evidence_forbidden'},{status,headers}); }
  }
  if(request.method!=='POST')return Response.json({error:'method_not_allowed'},{status:405,headers});
  if(!/^application\/json(?:;|$)/i.test(request.headers.get('content-type') || ''))return Response.json({error:'json_required'},{status:415,headers});
  try {
    const job=await readJsonBody(request);
    if(!validJob(job))return Response.json({error:'invalid_job'},{status:400,headers});
    if(!env.BROWSER)return Response.json({error:'browser_binding_unavailable'},{status:503,headers});
    const result=await runBrowserJob(job,env,{launch:()=>launch(env.BROWSER)},request.signal);
    return Response.json(result,{headers});
  } catch(error) {
    if(error instanceof RequestBodyError)return Response.json({error:error.message},{status:error.status,headers});
    return Response.json({error:'browser_job_not_verified'},{status:422,headers});
  }
} };
