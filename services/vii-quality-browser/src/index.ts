import { launch } from '@cloudflare/playwright';
import { runBrowserJob, validJob, type BrowserEnvironment } from './engine.ts';
type Env = BrowserEnvironment & { BROWSER: Parameters<typeof launch>[0] };

// No workers.dev URL, preview URL or public route is configured. This endpoint
// is for an authenticated controller's private Service Binding, never a browser.
export default { async fetch(request:Request,env:Env) {
  const headers={'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow'};
  if(request.method!=='POST')return Response.json({error:'method_not_allowed'},{status:405,headers});
  if(!request.headers.get('content-type')?.includes('application/json'))return Response.json({error:'json_required'},{status:415,headers});
  const reader=request.body?.getReader();if(!reader)return Response.json({error:'invalid_job'},{status:400,headers});
  let body='',bytes=0;const decoder=new TextDecoder();
  try {
    while(true){const part=await reader.read();if(part.done)break;bytes+=part.value.byteLength;if(bytes>8_192){await reader.cancel();return Response.json({error:'body_too_large'},{status:413,headers});}body+=decoder.decode(part.value,{stream:true});}
    body+=decoder.decode();const job=JSON.parse(body);
    if(!validJob(job))return Response.json({error:'invalid_job'},{status:400,headers});
    if(!env.BROWSER)return Response.json({error:'browser_binding_unavailable'},{status:503,headers});
    const result=await runBrowserJob(job,env,{launch:()=>launch(env.BROWSER)},request.signal);
    return Response.json(result,{headers});
  } catch { return Response.json({error:'browser_job_not_verified'},{status:422,headers}); }
  finally { reader.releaseLock(); }
} };
