import { getHomeHolidays } from "../../../lib/vii-home-holidays";
import { supplierToken } from "../../../lib/vii-supplier-token";
import { applyHolidayDisplaySettings, readHomeDisplaySettings } from "../../../lib/home-display-settings.ts";
import { isContentLocale } from "../../../lib/content-studio.ts";
import type { D1Database } from "../../../../types/cloudflare-runtime";
import { legacyHolidaySearchPath } from "../../../lib/search-opportunities.ts";

export async function GET(request: Request) {
  try {
    const holidays = (await getHomeHolidays({ token: await supplierToken() })).map((holiday) => ({
      ...holiday,
      href: legacyHolidaySearchPath(holiday.name) || undefined,
    }));
    const params = new URL(request.url).searchParams;
    if (params.get("all") === "1") return Response.json({ holidays }, { headers: { "Cache-Control": "no-store" } });
    const requestedLocale = params.get("locale");
    const locale = isContentLocale(requestedLocale) ? requestedLocale : "he";
    let settings;
    try {
      const runtime = await import("cloudflare:workers");
      settings = await readHomeDisplaySettings((runtime.env as unknown as { DB?: D1Database }).DB, locale);
    } catch { settings = await readHomeDisplaySettings(undefined, locale); }
    return Response.json({ holidays: applyHolidayDisplaySettings(holidays, settings), limit: settings.holidayLimit }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "supplier_unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
