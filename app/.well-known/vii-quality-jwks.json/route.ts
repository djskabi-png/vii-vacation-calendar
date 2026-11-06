import { qualityAttestationPublicJwk } from "../../lib/quality-attestation.ts";

export async function GET() {
  try {
    const key = await qualityAttestationPublicJwk();
    return Response.json({ keys: [key] }, { headers: { "Cache-Control": "public, max-age=60", "X-Robots-Tag": "noindex, nofollow" } });
  } catch {
    return Response.json({ error: "attestation_unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
