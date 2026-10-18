import { getDiscoveryHolidays } from "../../../lib/discovery-holidays.ts";
import { supplierToken } from "../../../lib/vii-supplier-token";
import { applyHolidayDisplaySettings, readHomeDisplaySettings } from "../../../lib/home-display-settings.ts";
import { isContentLocale } from "../../../lib/content-studio.ts";
import type { D1Database } from "../../../../types/cloudflare-runtime";
import { legacyHolidaySearchPath } from "../../../lib/search-opportunities.ts";
import { holidayWorldPath } from "../../../lib/holiday-world.ts";

async function displaySettings(locale: Parameters<typeof readHomeDisplaySettings>[1]) {
  try {
    const runtime = await import("cloudflare:workers");
    return await readHomeDisplaySettings((runtime.env as unknown as { DB?: D1Database }).DB, locale);
  } catch { return readHomeDisplaySettings(undefined, locale); }
}

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const requestedLocale = params.get("locale");
    const locale = isContentLocale(requestedLocale) ? requestedLocale : "he";
    const settingsPromise = params.get("all") === "1" ? null : displaySettings(locale);
    const holidays = (await getDiscoveryHolidays(await supplierToken())).map((holiday) => ({
      ...holiday,
      href: holidayWorldPath(holiday.name, holiday.id) || legacyHolidaySearchPath(holiday.name) || undefined,
    }));
    if (params.get("all") === "1") return Response.json({ holidays }, { headers: { "Cache-Control": "no-store" } });
    const settings = (await settingsPromise)!;
    return Response.json({ holidays: applyHolidayDisplaySettings(holidays, settings), limit: settings.holidayLimit }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "supplier_unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
