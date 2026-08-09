/** Cloudflare Worker entry point for the vinext-starter template. */
import { handleImageOptimization, DEFAULT_DEVICE_SIZES, DEFAULT_IMAGE_SIZES } from "vinext/server/image-optimization";
import handler from "vinext/server/app-router-entry";

interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
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
    if (!contentType.includes("text/html")) return response;

    const locale = localeMatch?.[1] || "he";
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
      return new HTMLRewriter()
        .on('link[rel="canonical"]', {
          element(element) {
            const links = makeLocaleLinks(element.getAttribute("href") || url.pathname);
            element.setAttribute("href", links.canonical);
            element.after(links.alternates, { html: true });
          },
        })
        .transform(response);
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
    return new Response(rewritten, response);
  },
};

export default worker;
