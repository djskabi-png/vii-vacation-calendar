import { readWorldAvailability } from "../../../lib/world-availability.ts";

export async function GET() {
  return Response.json({ worlds: await readWorldAvailability() }, {
    headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" },
  });
}
