/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";
import enTranslations from "../app/i18n/translations.en.generated.json";
import ruTranslations from "../app/i18n/translations.ru.generated.json";
import frTranslations from "../app/i18n/translations.fr.generated.json";

type PublicLocale = "he" | "en" | "ru" | "fr";
type TranslationDictionary = Record<string, string>;

const serverTranslations: Record<Exclude<PublicLocale, "he">, TranslationDictionary> = {
  en: enTranslations,
  ru: ruTranslations,
  fr: frTranslations,
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
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

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
      return response;
    }

    const locale = (localeMatch?.[1] || "he") as PublicLocale;
    const makeLocaleLinks = (currentHref: string) => {
      const canonicalUrl = new URL(currentHref || url.pathname, url.origin);
      const basePathname = canonicalUrl.pathname.replace(/^\/(en|ru|fr)(?=\/|$)/, "") || "/";
      const basePath = `${basePathname}${canonicalUrl.search}`;
      const localizedPath = locale === "he"
        ? basePath
        : `/${locale}${basePathname === "/" ? "" : basePathname}${canonicalUrl.search}`;
      const publicOrigin = "https://vii.spaplus.co";
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

      return rewriter.transform(response);
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
    return new Response(translateSeoHtml(rewritten, locale), response);
  },
};

export default worker;
