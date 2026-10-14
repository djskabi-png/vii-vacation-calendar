import { managedChrome } from "../../../lib/managed-public-content.ts";
import { isContentLocale } from "../../../lib/content-studio.ts";

export async function GET(request: Request) {
  try {
    const requestedLocale = new URL(request.url).searchParams.get("locale"); const locale = isContentLocale(requestedLocale) ? requestedLocale : "he";
    const [primary, secondary, contextual, worlds, service] = await Promise.all([
      managedChrome("navigation", "primary", locale), managedChrome("navigation", "secondary", locale),
      managedChrome("footer", "contextual", locale), managedChrome("footer", "worlds", locale), managedChrome("footer", "service", locale),
    ]);
    return Response.json({ primary: primary?.content.links || null, secondary: secondary?.content.links || null,
      contextual: contextual?.content.links || null, worlds: worlds?.content.links || null, service: service?.content.links || null },
    { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } });
  } catch (error) {
    console.error("VII managed chrome unavailable", error);
    return Response.json({ primary: null, secondary: null, contextual: null, worlds: null, service: null },
      { headers: { "Cache-Control": "public, max-age=30" } });
  }
}
