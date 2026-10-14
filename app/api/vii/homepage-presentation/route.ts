import type { D1Database } from "../../../../types/cloudflare-runtime";
import { readHomepagePresentation } from "../../../lib/homepage-presentation";
import type { ContentLocale } from "../../../lib/content-studio";

const locales = new Set<ContentLocale>(["he", "en", "ru", "fr"]);

export async function GET(request: Request) {
  const localeValue = new URL(request.url).searchParams.get("locale") as ContentLocale | null;
  const locale = localeValue && locales.has(localeValue) ? localeValue : "he";
  let db: D1Database | undefined;
  try {
    const runtime = await import("cloudflare:workers");
    db = (runtime.env as unknown as { DB?: D1Database }).DB;
  } catch {
    db = undefined;
  }
  return Response.json(await readHomepagePresentation(db, locale), {
    headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" },
  });
}
