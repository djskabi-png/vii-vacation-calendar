import storedManifest from '../../../app/data/legacy-gallery-media.json' with {type:'json'};
const storedFiles=new Set(storedManifest.files);
const ORIGIN = "https://vii.spaplus.co";
const MAX_SOURCE_BYTES = 12 * 1024 * 1024;
const WIDTHS = new Set([384, 640, 750, 828, 960, 1280, 1600]);
const FORMATS = new Set(["auto", "webp", "avif", "jpeg"]);
const QUALITIES = new Set([75, 82, 85, 88]);
type ImagesBinding = { input(stream: ReadableStream): { transform(options: Record<string, unknown>): { output(options: { format: string; quality: number }): Promise<{ response(): Response }> } } };
type Env = { IMAGES?: ImagesBinding };
type Context = { waitUntil(promise: Promise<unknown>): void };
type EdgeCache = { match(request: Request): Promise<Response | undefined>; put(request: Request, response: Response): Promise<void> };
function sourcePath(value: string | null) { return value && /^\/api\/vii\/media\/[a-f0-9]{8,128}\.(?:jpe?g|png|webp|avif)$/i.test(value) ? value : null; }
function legacySource(path: string) { const file=path.slice('/api/vii/media/'.length); return `https://www.vii.co.il/gallery/${file}`; }
function fallback(path: string, reason = "unavailable",original=`${ORIGIN}${path}`) { return new Response(null, { status: 302, headers: { Location: original, "Cache-Control": "no-store", "X-VII-Image-Engine": "source-fallback", "X-VII-Image-Fallback": reason } }); }
function bad(message: string) { return new Response(message, { status: 400, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } }); }
function forMethod(response: Response, method: string) { return method === "HEAD" ? new Response(null, { status: response.status, headers: response.headers }) : response; }
function boundedBody(body: ReadableStream<Uint8Array>) {
  let total = 0;
  return body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({ transform(chunk, controller) {
    total += chunk.byteLength;
    if (total > MAX_SOURCE_BYTES) { controller.error(new Error("image_too_large")); return; }
    controller.enqueue(chunk);
  } }));
}
async function bounded<T>(operation: Promise<T>, ms: number) {
  if (ms <= 0) {
    // A non-positive budget is an explicit test/guard override: do not let a
    // synchronously-resolved transform win the race by a microtask.
    await Promise.resolve();
    throw new Error("timeout");
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([operation, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("timeout")), ms); })]); }
  finally { if (timer) clearTimeout(timer); }
}
/** No cookies, credentials or arbitrary origin URLs are forwarded. */
export function createImageHandler(options: { sourceFetch?: typeof fetch; edge?: () => EdgeCache | undefined; sourceMs?: number; transformMs?: number; firstResponseMs?: number; cacheMs?: number; cacheWriteMs?: number; now?: () => number; maxAdmissions?: number; storedSource?:(path:string)=>boolean } = {}) {
  // Per-isolate overload containment, not an account-wide billing ceiling.
  const active = new Set<string>();
  const recent = new Map<string, number>();
  const now = options.now ?? Date.now;
  let windowStart = now(), admitted = 0;
  return { async fetch(request: Request, env: Env, ctx?: Context): Promise<Response> {
    if (request.method !== "GET" && request.method !== "HEAD") return new Response(null, { status: 405, headers: { Allow: "GET, HEAD", "Cache-Control": "no-store" } });
    const url = new URL(request.url);
    if ([...url.searchParams.keys()].some(key => !["url", "w", "q", "format"].includes(key) || url.searchParams.getAll(key).length !== 1)) return forMethod(bad("ambiguous_image_parameters"), request.method);
    const path = sourcePath(url.searchParams.get("url"));
    if (!path) return forMethod(bad("invalid_image_source"), request.method);
    // New supplier uploads cannot exist in the immutable migration manifest.
    // Their cold fallback must use their own fixed public supplier filename,
    // rather than the main route that intentionally rejects unknown files.
    const original=(options.storedSource?.(path)??storedFiles.has(path.slice('/api/vii/media/'.length)))?`${ORIGIN}${path}`:legacySource(path);
    const originalFallback=(reason?:string)=>fallback(path,reason,original);
    const width = Number(url.searchParams.get("w") || "");
    if (!Number.isInteger(width) || !WIDTHS.has(width)) return forMethod(bad("invalid_image_width"), request.method);
    const requestedFormat = (url.searchParams.get("format") || "auto").toLowerCase();
    if (!FORMATS.has(requestedFormat)) return forMethod(bad("invalid_image_format"), request.method);
    const format = requestedFormat === "auto" ? (request.headers.get("Accept")?.includes("image/avif") ? "avif" : "webp") : requestedFormat;
    const quality = Number(url.searchParams.get("q") || 85);
    if (!QUALITIES.has(quality)) return forMethod(bad("invalid_image_quality"), request.method);
    const keyUrl = new URL("/__vii-image-cache", url.origin);
    keyUrl.search = new URLSearchParams({ path, width: String(width), format, quality: String(quality) }).toString();
    const key = new Request(keyUrl);
    const edge = options.edge?.() ?? (globalThis as unknown as { caches?: { default?: EdgeCache } }).caches?.default;
    const hit = edge ? await bounded(edge.match(key), options.cacheMs ?? 50).catch(() => undefined) : undefined;
    if (hit) return forMethod(hit, request.method);
    const images = env.IMAGES;
    if (!images) return originalFallback("binding");
    if (request.method === "HEAD") return originalFallback();
    const at = now();
    if (at - windowStart >= 60_000) { windowStart = at; admitted = 0; }
    const last = recent.get(key.url);
    if (active.size >= 4 || active.has(key.url) || admitted >= (options.maxAdmissions ?? 120) || (last !== undefined && at - last < 2000)) return originalFallback();
    active.add(key.url); admitted++;
    recent.delete(key.url); recent.set(key.url, at);
    while (recent.size > 256) recent.delete(recent.keys().next().value!);
    const transform = async () => {
      let stage = "source";
      try {
      const sourceMs = options.sourceMs ?? 8000;
      const fetchSource=(url:string)=> (options.sourceFetch ?? fetch)(url, { headers: { Accept: "image/*" }, redirect: "manual", signal: AbortSignal.timeout(sourceMs) });
      let source = await bounded(fetchSource(original), sourceMs);
      if (source.status===404&&original!==legacySource(path)) source=await bounded(fetchSource(legacySource(path)),sourceMs);
      if (!source.ok) return originalFallback(`source-${source.status}`);
      if (!source.body || !/^image\/(?:jpeg|png|webp|avif)(?:;|$)/i.test(source.headers.get("Content-Type") || "") || Number(source.headers.get("Content-Length") || 0) > MAX_SOURCE_BYTES) return originalFallback("source-content");
      stage = "transform";
      const outputFormat = `image/${format}`;
      const transformed = await bounded(images.input(boundedBody(source.body)).transform({ width, fit: "scale-down" }).output({ format: outputFormat, quality }), options.transformMs ?? 8000);
      const response = transformed.response();
      if (!response.ok || !response.body || response.headers.get("Content-Type")?.split(";")[0] !== outputFormat) return originalFallback("transform-content");
      const headers = new Headers({ "Content-Type": outputFormat, "Cache-Control": "public, max-age=31536000, immutable", "Vary": "Accept", "X-VII-Image-Engine": "cloudflare-images", "Access-Control-Allow-Origin": "*" });
      const result = new Response(response.body, { status: 200, headers });
      return forMethod(result, request.method);
    } catch (error) {
      const message = error instanceof Error ? `${error.name}: ${error.message}` : "unknown";
      console.warn("VII image processing fallback", stage, message.replace(/https?:\/\/\S+/g, "[url]").slice(0, 240));
      return originalFallback(stage);
    }
    finally { active.delete(key.url); }
    };
    if (ctx) {
      if (!edge) { active.delete(key.url); return originalFallback("cache-unavailable"); }
      const work = transform();
      const early = await bounded(work, options.firstResponseMs ?? 350).catch(() => undefined);
      if (early) {
        if (early.headers.get("X-VII-Image-Engine") === "cloudflare-images") {
          ctx.waitUntil(bounded(edge.put(key, early.clone()), options.cacheWriteMs ?? 1500).catch(() => undefined));
        }
        return early;
      }
      ctx.waitUntil(work.then(async result => {
        // After the foreground deadline no client consumes this body. Store the
        // original stream rather than retaining an unread tee branch.
        if (result.headers.get("X-VII-Image-Engine") === "cloudflare-images") await bounded(edge.put(key, result), options.cacheWriteMs ?? 1500);
      }).catch(() => undefined));
      return originalFallback("warming");
    }
    return transform();
  } };
}
export default createImageHandler();
