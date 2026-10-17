export type SpaAvailabilityRow = { siteID: number; date: string; available: number };
async function token() {
  try {
    const runtime = await import("cloudflare:workers");
    const value = (runtime.env as unknown as Record<string, string | undefined>).BIZONLINE_SPA_AVAILABILITY_TOKEN;
    if (value) return value;
  } catch { /* Local development has no Cloudflare binding. */ }
  return process.env.BIZONLINE_SPA_AVAILABILITY_TOKEN || "";
}
export async function readSpaAvailability(): Promise<SpaAvailabilityRow[]> {
  const key = await token();
  if (!key) throw new Error("availability_not_configured");
  const url = new URL("https://www.bizonline.co.il/api/spaplus/get.php");
  url.searchParams.set("act", "availability"); url.searchParams.set("key", key);
  const response = await fetch(url, { signal: AbortSignal.timeout(12_000) });
  if (!response.ok) throw new Error("supplier_response");
  const body = await response.json() as { status?: unknown; data?: { availability?: unknown } };
  if (body.status !== "OK" || !Array.isArray(body.data?.availability)) throw new Error("supplier_shape");
  return body.data.availability.flatMap((row: unknown) => {
    if (!row || typeof row !== "object") return [];
    const entry = row as { siteID?: unknown; dateList?: unknown };
    if (!Number.isSafeInteger(entry.siteID) || !Array.isArray(entry.dateList)) return [];
    return entry.dateList.flatMap((day: unknown) => {
      if (!day || typeof day !== "object") return [];
      const value = day as { date?: unknown; available?: unknown };
      return typeof value.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.date) && typeof value.available === "number" && Number.isFinite(value.available) ? [{ siteID: entry.siteID as number, date: value.date, available: value.available }] : [];
    });
  });
}
