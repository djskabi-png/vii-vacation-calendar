import { markWhatsAppHandoff } from "../../../lib/whatsapp-lead-storage.ts";

const headers = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" };

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== new URL(request.url).host) return Response.json({ error: "forbidden" }, { status: 403, headers });
  const body = await request.json().catch(() => null) as { submissionId?: unknown; reference?: unknown } | null;
  const submissionId = typeof body?.submissionId === "string" ? body.submissionId.trim() : "";
  const reference = typeof body?.reference === "string" ? body.reference.trim() : "";
  if (!submissionId || !reference || submissionId.length > 100 || reference.length > 100) {
    return Response.json({ error: "invalid_request" }, { status: 400, headers });
  }
  try {
    const recorded = await markWhatsAppHandoff(submissionId, reference);
    return Response.json({ recorded }, { status: recorded ? 200 : 404, headers });
  } catch {
    return Response.json({ error: "handoff_unavailable" }, { status: 503, headers });
  }
}
