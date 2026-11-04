import type { D1Database } from "../../../../types/cloudflare-runtime";
import { readHomepagePresentation } from "../../../lib/homepage-presentation";
import type { ContentLocale } from "../../../lib/content-studio";
import { runtimeDatabase } from "../../../lib/runtime-database.ts";
import { isPopularSearchWorld } from "../../../lib/world-popular-search-defaults";

const locales = new Set<ContentLocale>(["he", "en", "ru", "fr"]);

export async function GET(request: Request) {
  const world = new URL(request.url).searchParams.get("world") || "vacation";
  if (!isPopularSearchWorld(world)) return Response.json({ error: "invalid_world" }, { status: 400 });
  const localeValue = new URL(request.url).searchParams.get("locale") as ContentLocale | null;
  const locale = localeValue && locales.has(localeValue) ? localeValue : "he";
  let db: D1Database | undefined;
  try {
    db = await runtimeDatabase();
  } catch {
    db = undefined;
  }
  return Response.json(await readHomepagePresentation(db, locale, world), {
    headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" },
  });
}
