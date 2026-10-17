import { readSpaAvailability } from "../../../lib/spa-availability.ts";
const headers = { "Cache-Control": "public, max-age=60, s-maxage=300" };

export async function GET() {
  try {
    return Response.json({ availability: await readSpaAvailability() }, { headers });
  } catch (error) {
    const missing = error instanceof Error && error.message === "availability_not_configured";
    return Response.json({ error: missing ? "availability_not_configured" : "supplier_unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
