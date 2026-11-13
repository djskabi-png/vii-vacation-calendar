import { withServerRequestReads } from "../app/lib/server-request-reads.ts";
import { PUBLIC_CATALOG_NAVIGATION_HEADER, isCatalogNavigationHintCandidate } from '../shared/public-catalog-navigation.ts';
import type { PublicLocale } from "./localized-html.ts";
/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import { legacyDisposition, looksLikeUninventoriedLegacyPath } from "../app/lib/legacy-route-map.ts";
import {canonicalLocationDestination} from '../app/lib/canonical-location-redirect.ts';
import { redirectRecordForUrl, shouldCheckRedirect } from "../app/lib/admin-redirects.ts";
import { publicCachePolicy, readPublicCache, refreshPublicCacheAhead, storePublicCache } from "./public-response-cache.ts";
import { rewriteCanonicalStream } from "./stream-canonical.ts";
import { rewriteOriginStream } from "./stream-origin.ts";
import { editorialWorldLinks } from "../app/data/editorial-world-links";
import { cloudflareDatabaseForEnv } from "../app/lib/runtime-database.ts";
import { deploymentMediaAliases } from "../app/lib/deployment-media-aliases.generated.ts";
import { optimizedMediaSource } from "./optimized-media-source.ts";
import { transformResponsiveImage, type NativeImageBinding } from "./responsive-image-transform.ts";

declare const __VII_CACHE_BUILD_ID__: string;
const publicCacheBuild = typeof __VII_CACHE_BUILD_ID__ === "string" ? __VII_CACHE_BUILD_ID__ : "local";
let appHandlerPromise: Promise<any> | undefined;
function appHandler() {
  return appHandlerPromise ||= import("vinext/server/app-router-entry").then(module => module.default).catch(error => {
    appHandlerPromise = undefined;
    throw error;
  });
}

const temporaryOrigin = "https://vii.spaplus.co";
const primaryOrigin = "https://www.vii.co.il";

function appendServerTiming(response: Response, entries: string[]) {
  const headers = new Headers(response.headers);
  const current = headers.get("Server-Timing");
  headers.set("Server-Timing", [...(current ? [current] : []), ...entries].join(", "));
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function goneResponse(request: Request) {
  const body = request.method === "HEAD" ? null : "העמוד הישן הוסר ואין לו עמוד חלופי מדויק.";
  return new Response(body, { status: 410, headers: {
    "Cache-Control": "public, max-age=300, s-maxage=86400",
    "Content-Type": "text/plain; charset=utf-8",
    "X-Robots-Tag": "noindex, follow",
  } });
}

function withLaunchSeo(response: Response, url: URL, primary: boolean) {
  const headers = new Headers(response.headers);
  const type = headers.get("content-type") || "";
  const sitemapDocument = url.pathname === "/sitemap.xml" || url.pathname.startsWith("/sitemaps/");
  if (!primary && (type.includes("text/html") || sitemapDocument)) {
    headers.set("X-Robots-Tag", "noindex");
  }
  if (primary && (url.pathname === "/robots.txt" || sitemapDocument) &&
      (type.includes("text/plain") || type.includes("xml"))) {
    headers.delete("content-length");
    return response.text().then((body) => new Response(body.replaceAll(temporaryOrigin, primaryOrigin), {
      status: response.status, statusText: response.statusText, headers,
    }));
  }
  const body = [204, 205, 304].includes(response.status) ? null : response.body;
  return Promise.resolve(new Response(body, { status: response.status, statusText: response.statusText, headers }));
}

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  UPLOADS: R2Bucket;
  IMAGES?: NativeImageBinding;
  VII_AWS_DB_ENDPOINT?: string;
  VII_AWS_DB_TOKEN?: string;
  VII_AWS_DB_MODE?: string;
  VII_STATIC_MAP_PROVIDER?: string;
  VII_MAPBOX_STATIC_TOKEN?: string;
  VII_MAPTILER_API_KEY?: string;
  VII_QUALITY_ORIGIN?: string;
  VII_QUALITY_EMAIL_PROVIDER?: string;
  VII_QUALITY_EMAIL_API_KEY?: string;
  VII_QUALITY_EMAIL_FROM?: string;
  VII_QUALITY_EMAIL_RECIPIENTS?: string;
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

// Image security config. SVG sources with .svg extension auto-skip the
// optimization endpoint on the client side (served directly, no proxy).
// To route SVGs through the optimizer (with security headers), set
// dangerouslyAllowSVG: true in next.config.js and uncomment below:
// const imageConfig: ImageConfig = { dangerouslyAllowSVG: true };

const worker = {
  async scheduled(controller: { scheduledTime: number }, env: Env, ctx: ExecutionContext) {
    const { runQualityChecks, flushQueuedQualityNotifications } = await import("../app/lib/quality-platform.ts");
    const { runSupplierCatalogScheduleTick } = await import("../app/lib/supplier-catalog-retry-runner.ts");
    const { cachedOnlineCapabilities } = await import("../app/lib/online-booking-capability-cache.ts");
    const { bundledMapSnapshotCandidates } = await import("../app/lib/map-snapshot-catalog.ts");
    const [{ warmVacationDiscoveryCache }, { warmEventDiscoveryCache }, { warmHolidayDiscoveryCache }, { isWeeklyMapSnapshotWindow, reconcileMapSnapshots }] = await Promise.all([
      import("../app/lib/warm-vacation-discovery-cache.ts"), import("../app/lib/warm-event-discovery-cache.ts"), import("../app/lib/warm-holiday-discovery-cache.ts"), import("../app/lib/map-snapshot-store.ts"),
    ]);
    const database = cloudflareDatabaseForEnv(env);
    if (!database) throw new Error("scheduled_database_unavailable");
    const { resumeDueQualityJobs } = await import("../app/lib/quality-job-platform.ts");
    ctx.waitUntil(resumeDueQualityJobs(database, env).catch(() => {
      console.error("VII quality job resume unavailable");
    }));
    ctx.waitUntil(flushQueuedQualityNotifications(database, env).catch(() => {
      console.error("VII quality notification outbox unavailable");
    }));
    const scheduledAt = new Date(controller.scheduledTime);
    ctx.waitUntil(runQualityChecks(database, {
      origin: env.VII_QUALITY_ORIGIN || temporaryOrigin,
      trigger: "scheduled",
      scheduledAt,
      releaseId: publicCacheBuild,
      actor: "cloudflare-scheduler",
      notificationEnv: env,
    }).catch((error) => {
      console.error("VII automatic quality run unavailable", error);
    }));
    // One shared, leased daily probe, not a probe per visitor or geography.
    ctx.waitUntil(cachedOnlineCapabilities(database).catch(() => {
      console.error("VII online capability refresh unavailable");
    }));
    // Refresh the active discovery keys on every ten-minute tick. The vacation
    // warmer is deliberately bounded to the five visible period keys, so this
    // no longer launches the former seven-day cross product.
    ctx.waitUntil(Promise.allSettled([
      warmVacationDiscoveryCache(database, scheduledAt),
      warmEventDiscoveryCache(database, scheduledAt),
    ]).then((results) => {
      if (results[0].status === "rejected") console.error("VII vacation discovery refresh unavailable");
      if (results[1].status === "rejected") console.error("VII event discovery refresh unavailable");
    }));
    // All visible holiday rails need an accepted snapshot before a visitor
    // opens a distant tab. Run with the existing10-minute tick, independently
    // of the near-date half-hour batch. The loader shares the request lease.
    ctx.waitUntil(warmHolidayDiscoveryCache(database, scheduledAt).catch(() => {
      console.error('VII holiday discovery refresh unavailable');
    }));
    if (isWeeklyMapSnapshotWindow(scheduledAt)) {
      ctx.waitUntil(reconcileMapSnapshots({
        db: database,
        bucket: env.UPLOADS,
        env,
        candidates: bundledMapSnapshotCandidates(),
        now: scheduledAt,
        limit: 50,
      }).then((result) => {
        if (result.failed) console.error("VII weekly map snapshot reconciliation incomplete", result.failed, result.failures.slice(0, 5));
      }).catch((error) => {
        console.error("VII weekly map snapshot reconciliation unavailable", error);
      }));
    }
    ctx.waitUntil(runSupplierCatalogScheduleTick(database, { now: new Date(controller.scheduledTime) }).then(({ scheduled, retries }) => {
      for (const result of [...retries, ...scheduled]) if (result.status !== "accepted" && result.status !== "skipped") {
        console.error("VII scheduled catalog sync did not publish", result.id, result.errorCode);
      }
    }));
  },
  async fetch(request: Request, env: Env, ctx: ExecutionContext, refreshPublic = false): Promise<Response> {
    return withServerRequestReads(async () => {
    const workerStarted = performance.now();
    // Vinext's local production server does not provide Cloudflare bindings.
    // Keep the public bundled-data paths testable locally while production
    // continues to receive the real Env object from Cloudflare.
    env = env || ({} as Env);
    const database = cloudflareDatabaseForEnv(env);
    const url = new URL(request.url);
    const mediaAlias = deploymentMediaAliases[url.pathname];
    if ((request.method === "GET" || request.method === "HEAD") && mediaAlias) {
      return Response.redirect(new URL(mediaAlias, url.origin), 308);
    }
    // Maintenance belongs to the scheduled handler above. Starting catalog
    // synchronization and the sitewide QA runner from every customer HTML
    // request made ordinary navigation pay for unrelated background work and
    // could exhaust the Worker request budget. Public requests now render only
    // their requested page; the scheduler remains the single durable owner.
    const primary = url.hostname === "www.vii.co.il" || url.hostname === "vii.co.il";
    if (request.method === "GET" || request.method === "HEAD") {
      let managedOverride = false;
      if (database && shouldCheckRedirect(url.pathname)) {
        try {
          const managed = await redirectRecordForUrl(database, url);
          managedOverride = Boolean(managed);
          if (managed && !managed.deleted && managed.active && managed.status === 301 && managed.target_path) {const destination=new URL(managed.target_path, primary ? primaryOrigin : temporaryOrigin);return Response.redirect(canonicalLocationDestination(destination)||destination,301);}
          if (managed && !managed.deleted && managed.active && managed.status === 410) return goneResponse(request);
        } catch (error) {
          console.error("VII managed redirect lookup failed", error);
        }
      }
      const legacy = managedOverride ? null : legacyDisposition(url);
      if (legacy?.status === 301) return Response.redirect(new URL(legacy.target, primary ? primaryOrigin : temporaryOrigin), 301);
      if (legacy?.status === 410 || (primary && shouldCheckRedirect(url.pathname) && looksLikeUninventoriedLegacyPath(url.pathname))) return goneResponse(request);
    }
    if (url.hostname === "vii.co.il") {
      return Response.redirect(`${primaryOrigin}${url.pathname}${url.search}`, 301);
    }

    // Public verification keys must remain addressable independently of the
    // framework's route discovery for dot-prefixed directories. The private
    // quality service verifies delegated admin requests against this endpoint.
    // Dot-directory discovery must not depend on app-router filesystem traversal.
    if (url.pathname === "/.well-known/ard.json" || url.pathname === "/agent-guide.md") {
      const { serveAgentDiscovery } = await import("./agent-discovery.ts");
      return serveAgentDiscovery(request, primary ? primaryOrigin : temporaryOrigin, publicCacheBuild)!;
    }

    if (url.pathname === "/.well-known/vii-quality-jwks.json") {
      if (request.method !== "GET" && request.method !== "HEAD") {
        return new Response(null, { status: 405, headers: { Allow: "GET, HEAD", "Cache-Control": "no-store" } });
      }
      const { GET } = await import("../app/.well-known/vii-quality-jwks.json/route.ts");
      const response = await GET();
      response.headers.set("X-VII-App-Build", publicCacheBuild);
      return request.method === "HEAD" ? new Response(null, { status: response.status, headers: response.headers }) : response;
    }

    // Preserve the normal host/redirect policy before the manifest-bound
    // public photo fast path. Streaming R2 bytes does not need the app router.
    if ((request.method === "GET" || request.method === "HEAD") && url.pathname.startsWith("/api/vii/media/")) {
      const { servePublicGalleryMedia } = await import("./public-gallery-media.ts");
      return servePublicGalleryMedia(request, env.UPLOADS, env.ASSETS, env.DB);
    }

    const policyStarted = performance.now();
    const ordinaryCachePolicy = await publicCachePolicy(request, url, publicCacheBuild);
    const policyMs = Math.round(performance.now() - policyStarted);
    const catalogNavigation = ordinaryCachePolicy?.kind === 'navigation' && isCatalogNavigationHintCandidate(request);
    // A thin model depends on a caller-local fresh snapshot. It can never be
    // stored under the ordinary rich Flight cache identity.
    const cachePolicy = catalogNavigation ? null : ordinaryCachePolicy;
    let cacheLookupMs = 0;
    const withRequestTiming = (output: Response) => appendServerTiming(output, [
      `vii-worker-policy;dur=${policyMs}`,
      `vii-cache-lookup;dur=${cacheLookupMs}`,
      `vii-worker-entry;dur=${Math.round(performance.now() - workerStarted)}`,
    ]);
    if (cachePolicy && !refreshPublic) {
      const lookupStarted = performance.now();
      try {
        const cached = await readPublicCache(cachePolicy, env, ctx);
        cacheLookupMs = Math.round(performance.now() - lookupStarted);
        if (cached) {
          const cacheReadMs = cacheLookupMs;
          cached.headers.set("X-VII-Cache-Read-Ms", String(cacheReadMs));
          // Keep the cache tier visible in browser/server timing traces. This
          // is diagnostic only and does not alter cache eligibility or body.
          cached.headers.set("Server-Timing", `vii-cache;dur=${cacheReadMs}`);
          const timed = appendServerTiming(cached, [
            `vii-worker-policy;dur=${policyMs}`,
            `vii-worker-entry;dur=${Math.round(performance.now() - workerStarted)}`,
          ]);
          timed.headers.set("X-VII-Cache-Refresh", refreshPublicCacheAhead(timed, cachePolicy, ctx,
            () => worker.fetch(request, env, ctx, true)));
          return timed;
        }
      } catch (error) {
        cacheLookupMs = Math.round(performance.now() - lookupStarted);
        console.error("VII public cache read failed", cachePolicy.kind, error);
      }
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: async (path) => (await optimizedMediaSource(path, env.UPLOADS, env.ASSETS, env.DB))
          || env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: (body, options) => transformResponsiveImage(body, options, env.IMAGES),
      }, allowedWidths);
    }

    // Vinext resolves locale-prefixed routes through Next rewrites, but the
    // root layout still needs the original request path to render the correct
    // server-side lang/dir, canonical URL and hreflang alternates. Forwarding
    // these values as internal request headers preserves the URL and query
    // string, so search and filter routes keep working normally.
    // Vinext asks for React Server Component payloads by appending `.rsc` to
    // the public pathname.  Treat that suffix as a transport detail.  Passing
    // `/en.rsc` to the application made the locale detector fall back to
    // Hebrew and also leaked the transport URL into canonical/OG metadata.
    const documentPathname = url.pathname.endsWith(".rsc")
      ? url.pathname.slice(0, -4) || "/"
      : url.pathname;
    const localeMatch = documentPathname.match(/^\/(en|ru|fr)(?:\/|$)/);
    const requestHeaders = new Headers(request.headers);
    if (!catalogNavigation) requestHeaders.delete(PUBLIC_CATALOG_NAVIGATION_HEADER);
    requestHeaders.set("x-vii-pathname", documentPathname);
    requestHeaders.set("x-vii-locale", localeMatch?.[1] || "he");

    const appLoadStarted = performance.now();
    const handler = await appHandler();
    const appLoadMs = Math.round(performance.now() - appLoadStarted);
    const appRenderStarted = performance.now();
    const response = await handler.fetch(new Request(request, { headers: requestHeaders }), env, ctx);
    // Generation identity belongs to the application, including uncached HTML.
    // Cache admission stays separate and must not be implied by this header.
    response.headers.set("X-VII-App-Build", publicCacheBuild);
    if (catalogNavigation) {
      response.headers.set('Cache-Control', 'private, no-store');
      response.headers.delete('Expires');
      response.headers.set('X-VII-Catalog-Navigation', 'client-fresh');
    }
    // Separate lazy module startup from time spent producing response headers.
    // These fixed numeric metrics contain no URL, SQL, identity or user input.
    response.headers.append("Server-Timing", `vii-app-load;dur=${appLoadMs}, vii-app-render;dur=${Math.round(performance.now() - appRenderStarted)}`);
    // API routes can report a more precise runtime origin such as the accepted
    // D1 fallback used during an Aurora incident. Preserve that evidence and
    // only supply the configured database mode when the route did not.
    if (!response.headers.has("X-VII-Data-Origin")) {
      response.headers.set("X-VII-Data-Origin", "cloudflare-d1");
    }
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) {
      // Vite gives every compiled asset a content hash. Let the browser keep
      // those immutable files locally so returning visitors and world changes
      // do not revalidate the same JavaScript, CSS and fonts on every visit.
      if (url.pathname.startsWith("/assets/")) {
        const headers = new Headers(response.headers);
        headers.set("Cache-Control", "public, max-age=31536000, immutable");
        return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
      }
      const output = await withLaunchSeo(response, url, primary);
      const timedOutput = appendServerTiming(output, [
        `vii-worker-policy;dur=${policyMs}`,
        `vii-cache-lookup;dur=${cacheLookupMs}`,
        `vii-worker-entry;dur=${Math.round(performance.now() - workerStarted)}`,
      ]);
      return storePublicCache(timedOutput, cachePolicy?.kind !== "document" ? cachePolicy : null, env, ctx);
    }

    const locale = (localeMatch?.[1] || "he") as PublicLocale;
    // Cache hits and Hebrew origin responses never initialize language dictionaries.
    const seo = locale === "he" ? undefined : await import("./localized-html.ts");
    const translateServerText = seo?.translateServerText ?? ((text: string) => text);
    const localizeStructuredData = seo?.localizeStructuredData ?? ((value: unknown) => value);
    const translateSeoHtml = seo?.translateSeoHtml ?? ((html: string) => html);
    const makeLocaleLinks = (currentHref: string) => {
      const canonicalUrl = new URL(currentHref || documentPathname, url.origin);
      const basePathname = canonicalUrl.pathname.replace(/^\/(en|ru|fr)(?=\/|$)/, "") || "/";
      const basePath = `${basePathname}${canonicalUrl.search}`;
      const hebrewOnlyArticle = editorialWorldLinks.some(article => basePathname.replace(/\/$/, "") === `/guides/${article.slug}`);
      const localizedPath = locale === "he" || hebrewOnlyArticle
        ? basePath
        : `/${locale}${basePathname === "/" ? "" : basePathname}${canonicalUrl.search}`;
      const publicOrigin = primary ? primaryOrigin : temporaryOrigin;
      const canonical = new URL(localizedPath, publicOrigin).toString();
      const alternatePaths: Record<string, string> = hebrewOnlyArticle ? { "he-IL": basePath, "x-default": basePath } : {
        "he-IL": basePath,
        en: `/en${basePathname === "/" ? "" : basePathname}${canonicalUrl.search}`,
        ru: `/ru${basePathname === "/" ? "" : basePathname}${canonicalUrl.search}`,
        fr: `/fr${basePathname === "/" ? "" : basePathname}${canonicalUrl.search}`,
        "x-default": basePath,
      };
      const alternates = Object.entries(alternatePaths)
        .map(([hrefLang, path]) => `<link rel="alternate" hreflang="${hrefLang}" href="${new URL(path, publicOrigin)}">`)
        .join("");
      return { canonical, alternates };
    };

    if (typeof HTMLRewriter !== "undefined") {
      const rewriter = new HTMLRewriter()
        // The application already emits a complete locale-aware alternate set.
        // Replace it at the worker boundary instead of appending a second set.
        // This also normalizes absolute production origins without duplicate
        // hreflang entries in raw HTML or the rendered document.
        .on('link[rel="alternate"][hreflang]', {
          element(element) {
            element.remove();
          },
        })
        .on('link[rel="canonical"]', {
          element(element) {
            const links = makeLocaleLinks(element.getAttribute("href") || documentPathname);
            element.setAttribute("href", links.canonical);
            element.after(links.alternates, { html: true });
          },
        });

      if (locale !== "he") {
        let structuredData = "";
        rewriter
          .on("title", {
            text(text) {
              const translated = translateServerText(text.text, locale);
              if (translated !== text.text) text.replace(translated);
            },
          })
          .on('meta[content]', {
            element(element) {
              const content = element.getAttribute("content");
              if (!content) return;
              const translated = translateServerText(content, locale);
              if (translated !== content) element.setAttribute("content", translated);
            },
          })
          .on('script[type="application/ld+json"]', {
            text(text) {
              structuredData += text.text;
              text.remove();
              if (!text.lastInTextNode) return;
              try {
                text.after(JSON.stringify(localizeStructuredData(JSON.parse(structuredData), locale)), { html: false });
              } catch {
                text.after(structuredData, { html: false });
              } finally {
                structuredData = "";
              }
            },
          });
      }

      const transformed = rewriter.transform(response);
      if (!primary) {
        const output = await withLaunchSeo(transformed, url, false);
        output.headers.set("X-VII-Html-Transform", "native-stream");
        return storePublicCache(withRequestTiming(output), cachePolicy, env, ctx);
      }
      const output = rewriteOriginStream(transformed, temporaryOrigin, primaryOrigin);
      output.headers.set("X-VII-Html-Transform", "native-stream");
      return storePublicCache(appendServerTiming(output, [`vii-worker-policy;dur=${policyMs}`, `vii-cache-lookup;dur=${cacheLookupMs}`, `vii-worker-entry;dur=${Math.round(performance.now() - workerStarted)}`]), cachePolicy, env, ctx);
    }

    // The standalone Vinext production server used by local QA does not
    // expose Cloudflare's HTMLRewriter. Keep the same output contract there
    // so raw-HTML SEO checks exercise the exact locale behavior.
    if (locale === "he" && cachePolicy?.kind === "document") {
      const canonical = rewriteCanonicalStream(response, makeLocaleLinks);
      const output = primary ? rewriteOriginStream(canonical, temporaryOrigin, primaryOrigin) : canonical;
      return storePublicCache(withRequestTiming(await withLaunchSeo(output, url, primary)), cachePolicy, env, ctx);
    }
    const html = await response.text();
    const htmlWithoutAlternates = html.replace(
      /<link\b(?=[^>]*\brel=["']alternate["'])(?=[^>]*\bhreflang=)[^>]*>/gi,
      "",
    );
    const rewritten = htmlWithoutAlternates.replace(
      /<link rel="canonical" href="([^"]+)"\s*\/?>/,
      (_match, currentHref: string) => {
        const links = makeLocaleLinks(currentHref);
        return `<link rel="canonical" href="${links.canonical}">${links.alternates}`;
      },
    );
    const output = translateSeoHtml(rewritten, locale);
    const headers = new Headers(response.headers);
    headers.delete("content-length");
    if (!primary) headers.set("X-Robots-Tag", "noindex");
    return storePublicCache(withRequestTiming(new Response(primary ? output.replaceAll(temporaryOrigin, primaryOrigin) : output, {
      status: response.status, statusText: response.statusText, headers,
    })), cachePolicy, env, ctx);
    }, ctx);
  },
};

export default worker;
