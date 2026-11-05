import { launch } from '@cloudflare/playwright';
import { runBrowserJob, validJob, type BrowserEnvironment } from './engine.ts';
import { readJsonBody, RequestBodyError } from './request-body.ts';
type Env = BrowserEnvironment & { BROWSER: Parameters<typeof launch>[0] };

// No workers.dev URL, preview URL or public route is configured. This endpoint
// is for an authenticated controller's private Service Binding, never a browser.
export default { async fetch(request:Request,env:Env) {
  const headers={'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow'};
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
