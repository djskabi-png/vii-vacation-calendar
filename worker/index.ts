/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import enTranslations from "../app/i18n/translations.en.generated.json";
import ruTranslations from "../app/i18n/translations.ru.generated.json";
import frTranslations from "../app/i18n/translations.fr.generated.json";
import hourlyUiTranslations from "../app/data/hourly-ui-translations.json";
import providerJoinTranslations from "../app/data/provider-join-translations.json";
import spaUiTranslations from "../app/data/spa-ui-translations.json";
import worldDepthTranslations from "../app/data/world-depth-translations.json";
import visitorUiTranslations from "../app/data/visitor-ui-translations.json";
import catalogAdminTranslations from "../app/data/catalog-admin-translations.json";
import { runSupplierCatalogScheduleTick } from "../app/lib/supplier-catalog-retry-runner.ts";
import { legacyDisposition, looksLikeUninventoriedLegacyPath } from "../app/lib/legacy-route-map.ts";
import { redirectForUrl, shouldCheckRedirect } from "../app/lib/admin-redirects.ts";
import { publicCachePolicy, readPublicCache, refreshPublicCacheAhead, storePublicCache } from "./public-response-cache.ts";
import { rewriteCanonicalStream } from "./stream-canonical.ts";
import { rewriteOriginStream } from "./stream-origin.ts";
import { editorialWorldLinks } from "../app/data/editorial-world-links";
import { localizedSpaSearchSource } from "../app/data/spa-search-landings.ts";

declare const __VII_CACHE_BUILD_ID__: string;
const publicCacheBuild = typeof __VII_CACHE_BUILD_ID__ === "string" ? __VII_CACHE_BUILD_ID__ : "local";

const temporaryOrigin = "https://vii.spaplus.co";
const primaryOrigin = "https://www.vii.co.il";

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

type PublicLocale = "he" | "en" | "ru" | "fr";
type TranslationDictionary = Record<string, string>;

const serverTranslations: Record<Exclude<PublicLocale, "he">, TranslationDictionary> = {
  en: { ...enTranslations, ...Object.fromEntries(Object.entries(hourlyUiTranslations).map(([key, value]) => [key, value.en])), ...Object.fromEntries(Object.entries(providerJoinTranslations).map(([key, value]) => [key, value.en])), ...Object.fromEntries(Object.entries(spaUiTranslations).map(([key, value]) => [key, value.en])), ...Object.fromEntries(Object.entries(catalogAdminTranslations).map(([key, value]) => [key, value.en])) },
  ru: { ...ruTranslations, ...Object.fromEntries(Object.entries(hourlyUiTranslations).map(([key, value]) => [key, value.ru])), ...Object.fromEntries(Object.entries(providerJoinTranslations).map(([key, value]) => [key, value.ru])), ...Object.fromEntries(Object.entries(spaUiTranslations).map(([key, value]) => [key, value.ru])), ...Object.fromEntries(Object.entries(catalogAdminTranslations).map(([key, value]) => [key, value.ru])) },
  fr: { ...frTranslations, ...Object.fromEntries(Object.entries(hourlyUiTranslations).map(([key, value]) => [key, value.fr])), ...Object.fromEntries(Object.entries(providerJoinTranslations).map(([key, value]) => [key, value.fr])), ...Object.fromEntries(Object.entries(spaUiTranslations).map(([key, value]) => [key, value.fr])), ...Object.fromEntries(Object.entries(catalogAdminTranslations).map(([key, value]) => [key, value.fr])) },
};

for (const locale of ["en", "ru", "fr"] as const) {
  Object.assign(serverTranslations[locale], Object.fromEntries(Object.entries(worldDepthTranslations).map(([key, value]) => [key, value[locale]])), Object.fromEntries(Object.entries(visitorUiTranslations).map(([key, value]) => [key, value[locale]])));
}

function translateServerText(value: string, locale: PublicLocale) {
  if (locale === "he" || !/[\u0590-\u05ff]/.test(value)) return value;
  const leading = value.match(/^\s*/)?.[0] || "";
  const trailing = value.match(/\s*$/)?.[0] || "";
  const core = value.slice(leading.length, value.length - trailing.length);
  if (!core) return value;
  // Metadata templates append the brand after the page title. Prefer the same
  // reviewed headline as the UI over an older machine-translated full string.
  const brandSuffix = " | וי פור ויקיישן";
  const headline = core.endsWith(brandSuffix) ? core.slice(0, -brandSuffix.length) : "";
  const reviewedHeadline = (visitorUiTranslations as Record<string, Partial<Record<PublicLocale, string>>>)[headline]?.[locale];
  if (reviewedHeadline) return `${leading}${reviewedHeadline} | ${serverTranslations[locale]["וי פור ויקיישן"] || "VII Vacation"}${trailing}`;
  if (headline) {
    const localizedHeadline = localizedSpaSearchSource(headline, locale) || serverTranslations[locale][headline];
    if (localizedHeadline) return `${leading}${localizedHeadline} | VII Vacation${trailing}`;
  }
  return `${leading}${localizedSpaSearchSource(core, locale) || serverTranslations[locale][core] || core}${trailing}`;
}

function localizeStructuredUrl(value: string, locale: Exclude<PublicLocale, "he">) {
  try {
    const url = new URL(value);
    if (url.origin !== "https://vii.spaplus.co") return value;
    if (/^\/(?:api|_next|assets|media|sitemaps)(?:\/|$)|^\/(?:favicon\.ico|robots\.txt|sitemap\.xml|feed\.xml|vii-logo\.png|og-v2\.png)$/.test(url.pathname)) return value;
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
    ctx.waitUntil(runSupplierCatalogScheduleTick(env.DB, { now: new Date(controller.scheduledTime) }).then(({ primary, retries }) => {
      for (const result of [...retries, ...(primary ? [primary] : [])]) if (result.status !== "accepted" && result.status !== "skipped") {
        console.error("VII scheduled catalog sync did not publish", result.id, result.errorCode);
      }
    }));
  },
  async fetch(request: Request, env: Env, ctx: ExecutionContext, refreshPublic = false): Promise<Response> {
    const url = new URL(request.url);
    const primary = url.hostname === "www.vii.co.il" || url.hostname === "vii.co.il";
    if (request.method === "GET" || request.method === "HEAD") {
      if (env.DB && shouldCheckRedirect(url.pathname)) {
        try {
          const managed = await redirectForUrl(env.DB, url);
          if (managed?.status === 301 && managed.target_path) return Response.redirect(new URL(managed.target_path, primary ? primaryOrigin : temporaryOrigin), 301);
          if (managed?.status === 410) return goneResponse(request);
        } catch (error) {
          console.error("VII managed redirect lookup failed", error);
        }
      }
      const legacy = legacyDisposition(url);
      if (legacy?.status === 301) return Response.redirect(new URL(legacy.target, primary ? primaryOrigin : temporaryOrigin), 301);
      if (legacy?.status === 410 || (primary && shouldCheckRedirect(url.pathname) && looksLikeUninventoriedLegacyPath(url.pathname))) return goneResponse(request);
    }
    if (url.hostname === "vii.co.il") {
      return Response.redirect(`${primaryOrigin}${url.pathname}${url.search}`, 301);
    }

    const cachePolicy = await publicCachePolicy(request, url, publicCacheBuild);
    if (cachePolicy && !refreshPublic) {
      const lookupStarted = performance.now();
      try {
        const cached = await readPublicCache(cachePolicy, env, ctx);
        if (cached) {
          cached.headers.set("X-VII-Cache-Read-Ms", String(Math.round(performance.now() - lookupStarted)));
          cached.headers.set("X-VII-Cache-Refresh", refreshPublicCacheAhead(cached, cachePolicy, ctx,
            () => worker.fetch(request, env, ctx, true)));
          return cached;
        }
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
      return storePublicCache(output, cachePolicy?.kind !== "document" ? cachePolicy : null, env, ctx);
    }

    const locale = (localeMatch?.[1] || "he") as PublicLocale;
    const makeLocaleLinks = (currentHref: string) => {
      const canonicalUrl = new URL(currentHref || url.pathname, url.origin);
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
      if (!primary) {
        const output = await withLaunchSeo(transformed, url, false);
        output.headers.set("X-VII-Html-Transform", "native-stream");
        return storePublicCache(output, cachePolicy, env, ctx);
      }
      const output = rewriteOriginStream(transformed, temporaryOrigin, primaryOrigin);
      output.headers.set("X-VII-Html-Transform", "native-stream");
      return storePublicCache(output, cachePolicy, env, ctx);
    }

    // The standalone Vinext production server used by local QA does not
    // expose Cloudflare's HTMLRewriter. Keep the same output contract there
    // so raw-HTML SEO checks exercise the exact locale behavior.
    if (locale === "he" && cachePolicy?.kind === "document") {
      const canonical = rewriteCanonicalStream(response, makeLocaleLinks);
      const output = primary ? rewriteOriginStream(canonical, temporaryOrigin, primaryOrigin) : canonical;
      return storePublicCache(await withLaunchSeo(output, url, primary), cachePolicy, env, ctx);
    }
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
