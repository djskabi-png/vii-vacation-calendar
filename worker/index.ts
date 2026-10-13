/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import enTranslations from "../app/i18n/translations.en.generated.json";
import ruTranslations from "../app/i18n/translations.ru.generated.json";
import frTranslations from "../app/i18n/translations.fr.generated.json";
import hourlyUiTranslations from "../app/data/hourly-ui-translations.json";
import providerJoinTranslations from "../app/data/provider-join-translations.json";
import spaUiTranslations from "../app/data/spa-ui-translations.json";
import catalogAdminTranslations from "../app/data/catalog-admin-translations.json";
import { scheduledCatalogWorld } from "../app/lib/supplier-catalog-schedule.ts";
import { syncSupplierCatalogWorld } from "../app/lib/supplier-catalog-runtime.ts";
import { legacyPlaceDestination } from "../app/lib/legacy-route-map.ts";

const temporaryOrigin = "https://vii.spaplus.co";
const primaryOrigin = "https://www.vii.co.il";
const publicCacheVersion = "v2";
type PublicCachePolicy = { key: string; kind: "document" | "data"; ttlSeconds: number; home: boolean };

const publicDocumentQueryKeys = new Set([
  "accessible", "area", "features", "flex", "from", "guests", "id", "location", "maxPrice", "minPrice",
  "months", "period", "pool", "sort", "source", "spa", "till", "to", "type", "types", "whole",
]);

function normalizedPublicQuery(url: URL, allowed: ReadonlySet<string>) {
  const entries: Array<[string, string]> = [];
  const seen = new Set<string>();
  for (const [key, value] of url.searchParams.entries()) {
    if (/^utm_(?:source|medium|campaign|term|content)$/.test(key)) continue;
    if (!allowed.has(key) || seen.has(key)) return null;
    seen.add(key);
    entries.push([key, value]);
  }
  entries.sort(([firstKey], [secondKey]) => firstKey.localeCompare(secondKey));
  const query = new URLSearchParams(entries).toString();
  return query ? `?${query}` : "";
}

function publicDocumentTtl(pathname: string) {
  const path = pathname.replace(/^\/(?:en|ru|fr)(?=\/|$)/, "") || "/";
  if (path === "/") return 60;
  if (/^\/(?:admin|account|favorites|booking|handoff|join)(?:\/|$)/.test(path)) return null;
  if (/^\/(?:business|search|hourly|events|spas|providers|attractions|activities|trails|destinations|guides|questions|corporate|gift-card|contact|accessibility)(?:\/|$)/.test(path)) return 180;
  if (/^\/(?:vacations|villas|luxury-suites|suite-complexes|vacation-apartments|discover\/place)(?:\/|$)/.test(path)) return 180;
  if (/^\/legal(?:\/|$)/.test(path)) return 900;
  return null;
}

function publicCachePolicy(request: Request, url: URL): PublicCachePolicy | null {
  if (request.method !== "GET") return null;
  if (request.headers.has("Cookie") || request.headers.has("Authorization")) return null;
  if (request.headers.get("RSC") || request.headers.get("Next-Router-State-Tree")) return null;
  if (url.pathname === "/api/catalog") {
    const query = normalizedPublicQuery(url, new Set(["id", "view", "world"]));
    if (query === null || !url.searchParams.get("world")) return null;
    return { key: `runtime-cache/public/${publicCacheVersion}/${url.hostname}/data${url.pathname}${query}`, kind: "data", ttlSeconds: 300, home: false };
  }
  if (!(request.headers.get("Accept") || "").includes("text/html")) return null;
  const ttlSeconds = publicDocumentTtl(url.pathname);
  if (!ttlSeconds) return null;
  const query = normalizedPublicQuery(url, publicDocumentQueryKeys);
  if (query === null || query.length > 600) return null;
  const home = /^\/(?:en|ru|fr)?$/.test(url.pathname);
  return {
    key: `runtime-cache/public/${publicCacheVersion}/${url.hostname}/document${url.pathname}${query}`,
    kind: "document",
    ttlSeconds,
    home,
  };
}

function publicCacheHeaders(response: Response, policy: PublicCachePolicy, state: "HIT" | "MISS", expiresAt = Date.now() + policy.ttlSeconds * 1000) {
  const headers = new Headers(response.headers);
  headers.delete("content-length");
  const browserTtl = Math.min(60, policy.ttlSeconds);
  headers.set("Cache-Control", `public, max-age=${browserTtl}, s-maxage=${policy.ttlSeconds}, stale-while-revalidate=${Math.min(120, policy.ttlSeconds)}`);
  headers.set(policy.kind === "document" ? "X-VII-Page-Cache" : "X-VII-Data-Cache", state);
  headers.set("X-VII-Cache-Until", String(expiresAt));
  if (policy.home) {
    headers.set("X-VII-Home-Cache", state);
    headers.set("X-VII-Home-Cache-Until", String(expiresAt));
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

async function readPublicCache(policy: PublicCachePolicy, env: Env | undefined) {
  if (!env?.UPLOADS) return null;
  const cached = await env.UPLOADS.get(policy.key);
  if (!cached) return null;
  const expiresAt = Number(cached.customMetadata?.expiresAt);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return null;
  const headers = new Headers({
    "Content-Type": cached.httpMetadata?.contentType || "text/html; charset=utf-8",
  });
  if (cached.httpMetadata?.contentLanguage === "staging") headers.set("X-Robots-Tag", "noindex");
  return publicCacheHeaders(new Response(cached.body, {
    headers,
  }), policy, "HIT", expiresAt);
}

function storePublicCache(response: Response, policy: PublicCachePolicy | null, env: Env | undefined, ctx: ExecutionContext) {
  if (!policy || !env?.UPLOADS || response.status !== 200 || response.headers.has("Set-Cookie")) return response;
  const contentType = response.headers.get("Content-Type") || "";
  if (policy.kind === "document" && !contentType.includes("text/html")) return response;
  if (policy.kind === "data" && !contentType.includes("application/json")) return response;
  const cacheable = publicCacheHeaders(response, policy, "MISS");
  const expiresAt = cacheable.headers.get("X-VII-Cache-Until")!;
  const isStaging = cacheable.headers.get("X-Robots-Tag") === "noindex";
  // HTMLRewriter emits a stream without a known length. Materializing the
  // bounded public response also gives R2 a deterministic content length.
  ctx.waitUntil(cacheable.clone().arrayBuffer().then((body) => env.UPLOADS.put(policy.key, body, {
    httpMetadata: {
      contentType: cacheable.headers.get("Content-Type") || "text/html; charset=utf-8",
      contentLanguage: isStaging ? "staging" : undefined,
    },
    customMetadata: { expiresAt },
  })).catch((error) => {
    console.error("VII public cache write failed", policy.kind, error);
  }));
  return cacheable;
}

function withLaunchSeo(response: Response, url: URL, primary: boolean) {
  const headers = new Headers(response.headers);
  const type = headers.get("content-type") || "";
  if (!primary && (type.includes("text/html") || url.pathname === "/sitemap.xml")) {
    headers.set("X-Robots-Tag", "noindex");
  }
  if (primary && (url.pathname === "/robots.txt" || url.pathname === "/sitemap.xml") &&
      (type.includes("text/plain") || type.includes("xml"))) {
    headers.delete("content-length");
    return response.text().then((body) => new Response(body.replaceAll(temporaryOrigin, primaryOrigin), {
      status: response.status, statusText: response.statusText, headers,
    }));
  }
  const body = [204, 205, 304].includes(response.status) ? null : response.body;
  return Promise.resolve(new Response(body, { status: response.status, statusText: response.statusText, headers }));
}

type PublicLocale = "he" | "en" | "ru" | "fr";
type TranslationDictionary = Record<string, string>;

const serverTranslations: Record<Exclude<PublicLocale, "he">, TranslationDictionary> = {
  en: { ...enTranslations, ...Object.fromEntries(Object.entries(hourlyUiTranslations).map(([key, value]) => [key, value.en])), ...Object.fromEntries(Object.entries(providerJoinTranslations).map(([key, value]) => [key, value.en])), ...Object.fromEntries(Object.entries(spaUiTranslations).map(([key, value]) => [key, value.en])), ...Object.fromEntries(Object.entries(catalogAdminTranslations).map(([key, value]) => [key, value.en])) },
  ru: { ...ruTranslations, ...Object.fromEntries(Object.entries(hourlyUiTranslations).map(([key, value]) => [key, value.ru])), ...Object.fromEntries(Object.entries(providerJoinTranslations).map(([key, value]) => [key, value.ru])), ...Object.fromEntries(Object.entries(spaUiTranslations).map(([key, value]) => [key, value.ru])), ...Object.fromEntries(Object.entries(catalogAdminTranslations).map(([key, value]) => [key, value.ru])) },
  fr: { ...frTranslations, ...Object.fromEntries(Object.entries(hourlyUiTranslations).map(([key, value]) => [key, value.fr])), ...Object.fromEntries(Object.entries(providerJoinTranslations).map(([key, value]) => [key, value.fr])), ...Object.fromEntries(Object.entries(spaUiTranslations).map(([key, value]) => [key, value.fr])), ...Object.fromEntries(Object.entries(catalogAdminTranslations).map(([key, value]) => [key, value.fr])) },
};

function translateServerText(value: string, locale: PublicLocale) {
  if (locale === "he" || !/[\u0590-\u05ff]/.test(value)) return value;
  const leading = value.match(/^\s*/)?.[0] || "";
  const trailing = value.match(/\s*$/)?.[0] || "";
  const core = value.slice(leading.length, value.length - trailing.length);
  if (!core) return value;
  return `${leading}${serverTranslations[locale][core] || core}${trailing}`;
}

function localizeStructuredUrl(value: string, locale: Exclude<PublicLocale, "he">) {
  try {
    const url = new URL(value);
    if (url.origin !== "https://vii.spaplus.co") return value;
    if (/^\/(?:api|_next|assets|media)(?:\/|$)|^\/(?:favicon\.ico|robots\.txt|sitemap\.xml|feed\.xml|vii-logo\.png|og-v2\.png)$/.test(url.pathname)) return value;
    const basePath = url.pathname.replace(/^\/(en|ru|fr)(?=\/|$)/, "") || "/";
    url.pathname = `/${locale}${basePath === "/" ? "" : basePath}`;
    return url.toString();
  } catch {
    return value;
  }
}

function localizeStructuredData(value: unknown, locale: Exclude<PublicLocale, "he">, key?: string, parentType?: string): unknown {
  if (key === "inLanguage") return locale;
  if (typeof value === "string") {
    const isPageUrl = ["@id", "mainEntityOfPage", "item", "urlTemplate"].includes(key || "")
      || (key === "url" && !["Organization", "WebSite", "ImageObject"].includes(parentType || ""));
    return translateServerText(isPageUrl ? localizeStructuredUrl(value, locale) : value, locale);
  }
  if (Array.isArray(value)) return value.map((item) => localizeStructuredData(item, locale, key, parentType));
  if (value && typeof value === "object") {
    const type = typeof (value as Record<string, unknown>)["@type"] === "string" ? (value as Record<string, string>)["@type"] : parentType;
    return Object.fromEntries(Object.entries(value).map(([entryKey, entryValue]) => [entryKey, localizeStructuredData(entryValue, locale, entryKey, type)]));
  }
  return value;
}

function translateSeoHtml(html: string, locale: PublicLocale) {
  if (locale === "he") return html;
  return html
    .replace(/<title>([^<]*)<\/title>/g, (_match, value: string) => `<title>${translateServerText(value, locale)}</title>`)
    .replace(/<meta([^>]*?)content="([^"]*)"([^>]*)>/g, (_match, before: string, value: string, after: string) => {
      const translated = translateServerText(value, locale).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
      return `<meta${before}content="${translated}"${after}>`;
    })
    .replace(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g, (match, value: string) => {
      try {
        return `<script type="application/ld+json">${JSON.stringify(localizeStructuredData(JSON.parse(value), locale))}</script>`;
      } catch {
        return match;
      }
    });
}

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  UPLOADS: R2Bucket;
  IMAGES: {
    input(stream: ReadableStream): {
      transform(options: Record<string, unknown>): {
        output(options: { format: string; quality: number }): Promise<{ response(): Response }>;
      };
    };
  };
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
  scheduled(controller: { scheduledTime: number }, env: Env, ctx: ExecutionContext) {
    const world = scheduledCatalogWorld(new Date(controller.scheduledTime));
    if (!world) return;
    ctx.waitUntil(syncSupplierCatalogWorld(env.DB, world, "scheduled").then((result) => {
      if (result.status !== "accepted" && result.status !== "skipped") {
        console.error("VII scheduled catalog sync did not publish", world, result.errorCode);
      }
    }));
  },
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const primary = url.hostname === "www.vii.co.il" || url.hostname === "vii.co.il";
    if (url.hostname === "vii.co.il") {
      return Response.redirect(`${primaryOrigin}${url.pathname}${url.search}`, 308);
    }
    if (request.method === "GET" || request.method === "HEAD") {
      const legacyDestination = legacyPlaceDestination(url.pathname);
      if (legacyDestination) return Response.redirect(new URL(legacyDestination, primary ? primaryOrigin : temporaryOrigin), 308);
    }

    const cachePolicy = publicCachePolicy(request, url);
    if (cachePolicy) {
      try {
        const cached = await readPublicCache(cachePolicy, env);
        if (cached) return cached;
      } catch (error) {
        console.error("VII public cache read failed", cachePolicy.kind, error);
      }
    }

    if (url.pathname === "/_vinext/image") {
      const allowedWidths = [...DEFAULT_DEVICE_SIZES, ...DEFAULT_IMAGE_SIZES];
      return handleImageOptimization(request, {
        fetchAsset: (path) => env.ASSETS.fetch(new Request(new URL(path, request.url))),
        transformImage: async (body, { width, format, quality }) => {
          const result = await env.IMAGES.input(body).transform(width > 0 ? { width } : {}).output({ format, quality });
          return result.response();
        },
      }, allowedWidths);
    }

    // Vinext resolves locale-prefixed routes through Next rewrites, but the
    // root layout still needs the original request path to render the correct
    // server-side lang/dir, canonical URL and hreflang alternates. Forwarding
    // these values as internal request headers preserves the URL and query
    // string, so search and filter routes keep working normally.
    const localeMatch = url.pathname.match(/^\/(en|ru|fr)(?:\/|$)/);
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-vii-pathname", url.pathname);
    requestHeaders.set("x-vii-locale", localeMatch?.[1] || "he");

    const response = await handler.fetch(new Request(request, { headers: requestHeaders }), env, ctx);
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
      return storePublicCache(output, cachePolicy?.kind === "data" ? cachePolicy : null, env, ctx);
    }

    const locale = (localeMatch?.[1] || "he") as PublicLocale;
    const makeLocaleLinks = (currentHref: string) => {
      const canonicalUrl = new URL(currentHref || url.pathname, url.origin);
      const basePathname = canonicalUrl.pathname.replace(/^\/(en|ru|fr)(?=\/|$)/, "") || "/";
      const basePath = `${basePathname}${canonicalUrl.search}`;
      const localizedPath = locale === "he"
        ? basePath
        : `/${locale}${basePathname === "/" ? "" : basePathname}${canonicalUrl.search}`;
      const publicOrigin = primary ? primaryOrigin : temporaryOrigin;
      const canonical = new URL(localizedPath, publicOrigin).toString();
      const alternatePaths: Record<string, string> = {
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
        .on('link[rel="canonical"]', {
          element(element) {
            const links = makeLocaleLinks(element.getAttribute("href") || url.pathname);
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
      if (!primary) return storePublicCache(await withLaunchSeo(transformed, url, false), cachePolicy, env, ctx);
      const headers = new Headers(transformed.headers);
      headers.delete("content-length");
      const html = (await transformed.text()).replaceAll(temporaryOrigin, primaryOrigin);
      return storePublicCache(new Response(html, { status: transformed.status, statusText: transformed.statusText, headers }), cachePolicy, env, ctx);
    }

    // The standalone Vinext production server used by local QA does not
    // expose Cloudflare's HTMLRewriter. Keep the same output contract there
    // so raw-HTML SEO checks exercise the exact locale behavior.
    const html = await response.text();
    const rewritten = html.replace(
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
    return storePublicCache(new Response(primary ? output.replaceAll(temporaryOrigin, primaryOrigin) : output, {
      status: response.status, statusText: response.statusText, headers,
    }), cachePolicy, env, ctx);
  },
};

export default worker;
