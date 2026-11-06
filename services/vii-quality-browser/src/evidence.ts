const SOURCE = /^[a-f0-9]{40}$/;
const JOB = /^[A-Za-z0-9_-]{8,120}$/;
const DEVICE = /^(desktop|mobile)$/;
const SCENARIO = /^[a-z0-9-]{1,80}$/;
export const MAX_EVIDENCE_BYTES = 1_000_000;
const MAX_READ_MS = 2_000;
export type EvidenceStore = { get(key: string): Promise<{ body: ReadableStream<Uint8Array>; size?:number; httpMetadata?: { contentType?: string }; customMetadata?: Record<string,string> } | null> };
export function evidenceKey(input: { sourceVersion: string; jobId: string; device: string; scenario: string }) {
  if (!SOURCE.test(input.sourceVersion) || !JOB.test(input.jobId) || !DEVICE.test(input.device) || !SCENARIO.test(input.scenario)) throw new Error("evidence_identity_invalid");
  return `qqqaaa/failures/${input.sourceVersion}/${input.jobId}/${input.device}-${input.scenario}.jpg`;
}
export function parseEvidenceKey(key: string) {
  const match = /^qqqaaa\/failures\/([a-f0-9]{40})\/([A-Za-z0-9_-]{8,120})\/(desktop|mobile)-([a-z0-9-]{1,80})\.jpg$/.exec(key);
  return match ? { sourceVersion: match[1], jobId: match[2], device: match[3], scenario: match[4] } : null;
}
export async function readEvidence(store: EvidenceStore, input: { sourceVersion: string; jobId: string; device: string; scenario: string }, options:{signal?:AbortSignal;timeoutMs?:number}={}) {
  const key = evidenceKey(input),chunks:Uint8Array[]=[];
  let reader:ReadableStreamDefaultReader<Uint8Array>|undefined,size=0,expired=false;
  let timer:ReturnType<typeof setTimeout>|undefined;
  const cancel=()=>{if(reader)void reader.cancel().catch(()=>undefined);};
  const abort=()=>{expired=true;cancel();};
  let rejectAbort:()=>void=()=>undefined;
  const abortListener=()=>{abort();rejectAbort();};
  const work=(async()=>{
    if(options.signal?.aborted)throw new Error('evidence_read_cancelled');
    const object=await store.get(key);
    if(!object)return null;
    if(expired){void object.body.cancel().catch(()=>undefined);throw new Error('evidence_read_timeout');}
    if(object.httpMetadata?.contentType!=='image/jpeg'){void object.body.cancel().catch(()=>undefined);return null;}
    if(object.size!==undefined&&(!Number.isSafeInteger(object.size)||object.size<4||object.size>MAX_EVIDENCE_BYTES)){void object.body.cancel().catch(()=>undefined);throw new Error('evidence_too_large');}
    reader=object.body.getReader();
    while(true){const part=await reader.read();if(expired)throw new Error('evidence_read_timeout');if(part.done)break;size+=part.value.byteLength;if(size>MAX_EVIDENCE_BYTES)throw new Error('evidence_too_large');chunks.push(part.value);}
    return true;
  })();
  let found;
  try{
    found=await Promise.race([work,new Promise<never>((_,reject)=>{
      rejectAbort=()=>reject(new Error('evidence_read_cancelled'));
      timer=setTimeout(()=>{abort();reject(new Error('evidence_read_timeout'));},Math.min(MAX_READ_MS,Math.max(1,options.timeoutMs??MAX_READ_MS)));
      options.signal?.addEventListener('abort',abortListener,{once:true});if(options.signal?.aborted)abortListener();
    })]);
  }finally{expired=true;if(timer)clearTimeout(timer);options.signal?.removeEventListener('abort',abortListener);cancel();try{reader?.releaseLock();}catch{}}
  if(!found)return null;
  const body = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  if (body.length < 4 || body[0] !== 0xff || body[1] !== 0xd8 || body[body.length - 2] !== 0xff || body[body.length - 1] !== 0xd9) return null;
  return { body, key };
}
