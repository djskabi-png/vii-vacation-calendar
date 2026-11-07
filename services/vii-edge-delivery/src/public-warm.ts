export const publicWarmRoutes = Object.freeze(["/", "/events", "/spas", "/hourly", "/search", "/providers", "/trails", "/attractions"]);
const browserRscHashes:Record<string,string>={"/":"KsQaSH2L7Z4e6Q5N","/events":"zkS6omdGqgfCMlsE","/spas":"SUw32WOW_LzIbw0P","/hourly":"5gqXZVlY2FBD7V01","/search":"hEdSYtBncL1HUmIT","/providers":"fVB6U_iOKdUZnnY3","/trails":"inFMqFrRJT8v6E5h","/attractions":"okZjvgKglkbPfXLp","/business":"iH5GzKL3Zr4VGpJv"};
// Hashes are the Vinext createRscRequestUrl SHA-256/96-bit digest of the
// exact navigation headers: 0,0,0,0,<interception-context>,0,0.
const publicWarmRscPairs=[
  ...publicWarmRoutes.filter(path=>path!=='/').map(path=>({target:path,context:'/'})),
  ...publicWarmRoutes.filter(path=>path!=='/').map(context=>({target:'/',context})),
  {target:'/',context:'/business'},
];
export const publicWarmRequests: ReadonlyArray<{path:string;headers:Record<string,string>}> = Object.freeze([
  ...publicWarmRoutes.map(path=>({path,headers:{Accept:'text/html'} as Record<string,string>})),
  ...publicWarmRscPairs.map(({target,context})=>({path:`${target==='/'?'/.rsc':`${target}.rsc`}?_rsc=${browserRscHashes[context]}`,headers:{Accept:'text/x-component',RSC:'1','X-Vinext-Interception-Context':context} as Record<string,string>})),
]);
type Context = { waitUntil(promise: Promise<unknown>): unknown };

/** Fixed anonymous HTML and ordinary navigation reads only. The caller supplies the SAME cache
 * admission path as a visitor; this cannot warm APIs or transactional reads. */
export async function warmPublicDocuments(read: (request: Request, ctx: Context) => Promise<Response>, ctx: Context) {
  const started = Date.now();
  const report = { attempted: 0, completed: 0, failed: 0, elapsedMs: 0 };
  for (const target of publicWarmRequests) {
    const remaining = 90_000 - (Date.now() - started);
    if (remaining <= 0) break;
    const controller = new AbortController();
    const tasks = new Set<Promise<unknown>>();
    const ownedContext = { waitUntil(promise: Promise<unknown>) {
      tasks.add(promise); ctx.waitUntil(promise);
      void promise.finally(() => tasks.delete(promise)).catch(() => undefined);
    } };
    let timer: ReturnType<typeof setTimeout> | undefined;
    report.attempted++;
    const work = (async () => {
      const response = await read(new Request(`https://vii.spaplus.co${target.path}`, {
        method: "GET", headers: target.headers, signal: controller.signal,
      }), ownedContext);
      const reader = response.body?.getReader();
      let bytes = 0;
      try {
        if (reader) while (true) {
          const part = await reader.read(); if (part.done) break;
          bytes += part.value.byteLength;
          if (bytes > 2 * 1024 * 1024) throw new Error("warm_document_oversize");
        }
      } finally { reader?.releaseLock(); }
      while (tasks.size) await Promise.allSettled([...tasks]);
      // A 200 can still be rejected for a mismatched build, private response or
      // unsupported variant. It is not evidence of a warmed cache entry.
      if (!response.ok || !["HIT", "MISS"].includes(response.headers.get("X-VII-Edge-Delivery") || "") || response.headers.has("X-VII-Edge-Cache-Skip")) throw new Error("warm_document_not_admitted");
    })().then(() => true, () => false);
    const deadline = new Promise<false>(resolve => { timer = setTimeout(() => {
      controller.abort(new DOMException("Public warming deadline", "TimeoutError")); resolve(false);
    }, Math.min(10_000, remaining)); });
    try { if (await Promise.race([work, deadline])) report.completed++; else report.failed++; }
    finally { if (timer) clearTimeout(timer); controller.abort(); }
  }
  report.elapsedMs = Date.now() - started;
  return report;
}
