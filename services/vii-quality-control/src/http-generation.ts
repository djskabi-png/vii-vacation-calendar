export type GenerationResult={status:'passed'}|{status:'blocked';reason:'target_generation_invalid'|'target_generation_unavailable'|'observed_build_mismatch'};
const BUILD=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;

/** One anonymous generation probe per HTTP job slice, never an authenticated
 * user request. A failed probe must not manufacture passing content checks. */
export async function verifyHttpTargetBuild(input:{origin:string;buildId:string;signal?:AbortSignal;timeoutMs?:number},fetcher:typeof fetch=fetch):Promise<GenerationResult>{
 if(input.origin!=='https://vii.spaplus.co'||!BUILD.test(input.buildId))return{status:'blocked',reason:'target_generation_invalid'};
 if(input.signal?.aborted)return{status:'blocked',reason:'target_generation_unavailable'};
 const timeout=new AbortController(),signal=input.signal?AbortSignal.any([input.signal,timeout.signal]):timeout.signal;
 let timer:ReturnType<typeof setTimeout>|undefined,onAbort:(()=>void)|undefined,response:Response|undefined,finished=false;
 try{
  const pending=Promise.resolve().then(()=>fetcher(input.origin+'/',{method:'GET',redirect:'manual',signal,headers:{Accept:'text/html','User-Agent':'VII-Quality-Generation/1.0'}})).then(value=>{response=value;if(finished)void value.body?.cancel().catch(()=>undefined);return value;});
  response=await Promise.race([pending,new Promise<never>((_,reject)=>{
   onAbort=()=>reject(new Error('generation_probe_cancelled'));signal.addEventListener('abort',onAbort,{once:true});
   timer=setTimeout(()=>timeout.abort(),Math.max(1,Math.min(4000,input.timeoutMs??4000)));if(signal.aborted)onAbort();
  })]);
  const observed=response.headers.get('X-VII-App-Build')??response.headers.get('X-VII-Cache-Build');
  if(response.status!==200||!/\btext\/html\b/i.test(response.headers.get('Content-Type')??'')||!BUILD.test(observed??''))return{status:'blocked',reason:'target_generation_unavailable'};
  try{verifyHttpResponseBuild(response,input.buildId);return{status:'passed'};}catch{return{status:'blocked',reason:'observed_build_mismatch'};}
 }catch{return{status:'blocked',reason:'target_generation_unavailable'};}
 finally{finished=true;if(timer)clearTimeout(timer);if(onAbort)signal.removeEventListener('abort',onAbort);void response?.body?.cancel().catch(()=>undefined);timeout.abort();}
}

/** Recheck the actual response too: one route may retain an older edge entry
 * even when the probe already observes the new active generation. */
export function verifyHttpResponseBuild(response:Response,buildId:string){
 const app=response.headers.get('X-VII-App-Build'),cache=response.headers.get('X-VII-Cache-Build'),observed=app??cache,html=/\btext\/html\b/i.test(response.headers.get('Content-Type')??'');
 if(!BUILD.test(buildId)||app&&app!==buildId||cache&&cache!==buildId||html&&!observed){void response.body?.cancel().catch(()=>undefined);throw new Error(observed?'observed_build_mismatch':'target_generation_unavailable');}
 return response;
}
