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
const homeCacheTtlMs = 60_000;

function cacheableHomeRequest(request: Request, url: URL) {
  if (request.method !== "GET" || url.search) return false;
  if (!/^\/(?:en|ru|fr)?$/.test(url.pathname)) return false;
  if (request.headers.has("Cookie") || request.headers.has("Authorization")) return false;
  // RSC responses are shaped by the current router tree and must remain
  // request-specific. Only cache complete anonymous HTML documents.
  if (request.headers.get("RSC") || request.headers.get("Next-Router-State-Tree")) return false;
  return (request.headers.get("Accept") || "").includes("text/html");
}

function homeCacheKey(url: URL) {
  // The Sites deployment does not permit Workers Cache API access. UPLOADS is
  // the already-bound R2 bucket and gives this tiny, short-lived document
  // cache the same shared scope without exposing a visitor-specific key.
  return `runtime-cache/homepage/v1${url.pathname === "/" ? "/he" : url.pathname}`;
}

function homeCacheHeaders(response: Response, state: "HIT" | "MISS", expiresAt = Date.now() + homeCacheTtlMs) {
  const headers = new Headers(response.headers);
  headers.delete("content-length");
  headers.set("Cache-Control", "public, max-age=60, s-maxage=60, stale-while-revalidate=30");
  headers.set("X-VII-Home-Cache", state);
  headers.set("X-VII-Home-Cache-Until", String(expiresAt));
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

async function readCachedHome(cacheKey: string, env: Env) {
  if (!env.UPLOADS) return null;
  const cached = await env.UPLOADS.get(cacheKey);
  if (!cached) return null;
  const expiresAt = Number(cached.customMetadata?.expiresAt);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return null;
  const headers = new Headers({
    "Content-Type": cached.httpMetadata?.contentType || "text/html; charset=utf-8",
  });
  if (cached.httpMetadata?.contentLanguage === "staging") headers.set("X-Robots-Tag", "noindex");
  return homeCacheHeaders(new Response(cached.body, {
    headers,
  }), "HIT", expiresAt);
}

function storeCachedHome(response: Response, cacheKey: string | null, env: Env, ctx: ExecutionContext) {
  if (!cacheKey || !env.UPLOADS || response.status !== 200 || response.headers.has("Set-Cookie")) return response;
  const cacheable = homeCacheHeaders(response, "MISS");
  const expiresAt = cacheable.headers.get("X-VII-Home-Cache-Until")!;
  const isStaging = cacheable.headers.get("X-Robots-Tag") === "noindex";
  ctx.waitUntil(env.UPLOADS.put(cacheKey, cacheable.clone().body, {
    httpMetadata: {
      contentType: cacheable.headers.get("Content-Type") || "text/html; charset=utf-8",
      contentLanguage: isStaging ? "staging" : undefined,
    },
    customMetadata: { expiresAt },
  }).catch((error) => {
    console.error("VII homepage cache write failed", error);
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

    const cacheKey = cacheableHomeRequest(request, url) ? homeCacheKey(url) : null;
    if (cacheKey) {
      try {
        const cached = await readCachedHome(cacheKey, env);
        if (cached) return cached;
      } catch (error) {
        console.error("VII homepage cache read failed", error);
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
      return withLaunchSeo(response, url, primary);
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
      if (!primary) return storeCachedHome(await withLaunchSeo(transformed, url, false), cacheKey, env, ctx);
      const headers = new Headers(transformed.headers);
      headers.delete("content-length");
      const html = (await transformed.text()).replaceAll(temporaryOrigin, primaryOrigin);
      return storeCachedHome(new Response(html, { status: transformed.status, statusText: transformed.statusText, headers }), cacheKey, env, ctx);
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
    return storeCachedHome(new Response(primary ? output.replaceAll(temporaryOrigin, primaryOrigin) : output, {
      status: response.status, statusText: response.statusText, headers,
    }), cacheKey, env, ctx);
  },
};

export default worker;
