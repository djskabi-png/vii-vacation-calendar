/** Private evidence responses are byte bounded, never trusted by MIME/length alone. */
export async function readPrivateJpeg(response:Response,options:{signal?:AbortSignal;timeoutMs?:number}={}){
 const max=1_000_000,length=Number(response.headers.get('Content-Length'));
 if(response.status!==200||response.headers.get('Content-Type')?.toLowerCase().split(';')[0]!=='image/jpeg'||!Number.isSafeInteger(length)||length<4||length>max||!response.body){void response.body?.cancel().catch(()=>undefined);throw new Error('invalid_evidence_response');}
 const reader=response.body.getReader(),chunks:Uint8Array[]=[];let size=0,timer:ReturnType<typeof setTimeout>|undefined,expired=false,rejectAbort:()=>void=()=>undefined;
 const cancel=()=>{expired=true;void reader.cancel().catch(()=>undefined);};
 const onAbort=()=>{cancel();rejectAbort();};
 try{
  await Promise.race([(async()=>{while(true){const part=await reader.read();if(expired)throw new Error('invalid_evidence_response');if(part.done)break;size+=part.value.byteLength;if(size>max||size>length)throw new Error('invalid_evidence_response');chunks.push(part.value);}})(),new Promise<never>((_,reject)=>{
   rejectAbort=()=>reject(new Error('invalid_evidence_response'));timer=setTimeout(()=>{cancel();rejectAbort();},Math.max(1,Math.min(2000,options.timeoutMs??2000)));options.signal?.addEventListener('abort',onAbort,{once:true});if(options.signal?.aborted)onAbort();
  })]);
 }finally{if(timer)clearTimeout(timer);options.signal?.removeEventListener('abort',onAbort);cancel();try{reader.releaseLock();}catch{}}
 if(size!==length)throw new Error('invalid_evidence_response');
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
 if(bytes[0]!==0xff||bytes[1]!==0xd8||bytes[size-2]!==0xff||bytes[size-1]!==0xd9)throw new Error('invalid_evidence_response');
 return new Response(bytes,{headers:{'Cache-Control':'private, no-store','Content-Type':'image/jpeg','Content-Length':String(size),'X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow'}});
}
