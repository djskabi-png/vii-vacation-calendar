import type { ContentLocale, ManagedLink } from './content-studio';

type ChromePayload = { primary?: ManagedLink[] | null; secondary?: ManagedLink[] | null; contextual?: ManagedLink[] | null; worlds?: ManagedLink[] | null; service?: ManagedLink[] | null };
type Flight = { controller: AbortController; subscribers: number; promise: Promise<ChromePayload | null> };
const flights = new Map<string,Flight>();
const abortReason = (signal?: AbortSignal) => signal?.reason ?? new DOMException('Aborted','AbortError');

/** Header and footer share only a concurrent public read. Completed responses
 * are not retained here; HTTP cache headers remain the sole freshness policy.
 * One unmounted consumer cannot cancel the other consumer's request. */
export function publicChrome(locale: ContentLocale, signal?: AbortSignal): Promise<ChromePayload | null> {
  if (signal?.aborted) return Promise.reject(abortReason(signal));
  if (!['he','en','fr','ru'].includes(locale)) return Promise.reject(new Error('invalid_locale'));
  const url=`/api/content/chrome?locale=${locale}`;
  let flight=flights.get(url);
  if (!flight) {
    const controller=new AbortController();
    flight={controller,subscribers:0,promise:Promise.resolve(null)};
    const owned=flight;
    owned.promise=(async()=>{
      const timer=setTimeout(()=>controller.abort(new DOMException('Timed out','TimeoutError')),8_000);
      try {
        const response=await fetch(url,{signal:controller.signal,headers:{Accept:'application/json'}});
        if (!response.ok) return null;
        const value=await response.json() as unknown;
        if (!value || typeof value!=='object' || Array.isArray(value)) return null;
        const payload=value as ChromePayload;
        if (Object.values(payload).some(item=>item!==null && item!==undefined && !Array.isArray(item))) return null;
        return payload;
      } finally { clearTimeout(timer); }
    })();
    flights.set(url,owned);
    const clean=()=>{if(flights.get(url)===owned)flights.delete(url)};
    void owned.promise.then(clean,clean);
  }
  const selected=flight;
  selected.subscribers++;
  return new Promise((resolve,reject)=>{
    let settled=false;
    const finish=()=>{settled=true;selected.subscribers--;signal?.removeEventListener('abort',cancel)};
    const cancel=()=>{
      if(settled)return;
      finish();reject(abortReason(signal));
      if(!selected.subscribers){if(flights.get(url)===selected)flights.delete(url);selected.controller.abort(abortReason(signal))}
    };
    signal?.addEventListener('abort',cancel,{once:true});
    selected.promise.then(value=>{if(!settled){finish();resolve(structuredClone(value))}},error=>{if(!settled){finish();reject(error)}});
    if(signal?.aborted)cancel();
  });
}
