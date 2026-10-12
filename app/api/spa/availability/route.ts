const headers = { "Cache-Control": "public, max-age=60, s-maxage=300" };

async function token() {
  try {
    const runtime = await import("cloudflare:workers");
    const value = (runtime.env as unknown as Record<string, string | undefined>).BIZONLINE_SPA_AVAILABILITY_TOKEN;
    if (value) return value;
  } catch { /* Local development has no Cloudflare binding. */ }
  return process.env.BIZONLINE_SPA_AVAILABILITY_TOKEN || "";
}

export async function GET() {
  const key = await token();
  if (!key) return Response.json({ error: "availability_not_configured" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  try {
    const url = new URL("https://www.bizonline.co.il/api/spaplus/get.php");
    url.searchParams.set("act", "availability");
    url.searchParams.set("key", key);
    const response = await fetch(url, { signal: AbortSignal.timeout(12_000) });
    if (!response.ok) throw new Error("supplier_response");
    const body = await response.json() as { status?: unknown; data?: { availability?: unknown } };
    if (body.status !== "OK" || !Array.isArray(body.data?.availability)) throw new Error("supplier_shape");
    const availability = body.data.availability.flatMap((row: unknown) => {
      if (!row || typeof row !== "object") return [];
      const entry = row as { siteID?: unknown; dateList?: unknown };
      if (!Number.isSafeInteger(entry.siteID) || !Array.isArray(entry.dateList)) return [];
      return entry.dateList.flatMap((day: unknown) => {
        if (!day || typeof day !== "object") return [];
        const value = day as { date?: unknown; available?: unknown };
        return typeof value.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.date) && typeof value.available === "number" && Number.isFinite(value.available)
          ? [{ siteID: entry.siteID as number, date: value.date, available: value.available }]
          : [];
      });
    });
    return Response.json({ availability }, { headers });
  } catch {
    return Response.json({ error: "supplier_unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
