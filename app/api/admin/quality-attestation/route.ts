import { authorizedAdminSession } from "../../../lib/admin-session.ts";
import { createQualityAttestation, deployedQualityBuildIdentity } from "../../../lib/quality-attestation.ts";
import { readJsonBody, RequestBodyError } from "../../../../shared/request-body.ts";

const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };
export async function POST(request: Request) {
  const origin = new URL(request.url).origin;
  if (request.headers.get("origin") !== origin || request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") return Response.json({ error: "invalid_origin_or_content_type" }, { status: 403, headers });
  let body: { method?: unknown; path?: unknown; bodyHash?: unknown; nonce?: unknown } | null;
  try { body = await readJsonBody(request); }
  catch (error) { return Response.json({ error: error instanceof RequestBodyError ? error.message : "invalid_json" }, { status: error instanceof RequestBodyError ? error.status : 400, headers }); }
  if ((body?.method !== "GET" && body?.method !== "POST") || typeof body.path !== "string" || !/^\/api\/admin\/quality(?:\?|$)/.test(body.path) || body.path.length > 2048 || typeof body.bodyHash !== "string" || typeof body.nonce !== "string") return Response.json({ error: "invalid_attestation_request" }, { status: 400, headers });
  // Permission is evaluated against the exact target operation. Issuing a
  // read-only attestation must not require edit permission just because the
  // gateway uses POST to request that attestation.
  const target = new Request(new URL(body.path, origin), { method: body.method, headers: request.headers });
  const session = await authorizedAdminSession(target).catch(() => null);
  if (!session) return Response.json({ error: "forbidden" }, { status: 403, headers });
  try { const token = await createQualityAttestation(session, { origin, target: body.path, method: body.method, bodyHash: body.bodyHash, nonce: body.nonce, buildId: deployedQualityBuildIdentity() }); return Response.json({ token }, { headers }); }
  catch { return Response.json({ error: "attestation_unavailable" }, { status: 503, headers }); }
}
