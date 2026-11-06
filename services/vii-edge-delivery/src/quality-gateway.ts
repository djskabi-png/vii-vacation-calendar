import { readJsonBody, RequestBodyError } from "../../../shared/request-body.ts";
import { readPrivateJpeg } from "../../../shared/private-jpeg.ts";

export type QualityGatewayEnvironment = {
  QUALITY_CONTROL_ENABLED?: string;
  QUALITY_CONTROL?: { fetch(request: Request): Promise<Response> };
};
const origin = "https://vii.spaplus.co";
const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" };
export async function qualityGateway(request: Request, env: QualityGatewayEnvironment, sourceFetch: typeof fetch = fetch): Promise<Response | null> {
  const url = new URL(request.url);
  if (env.QUALITY_CONTROL_ENABLED !== "true" || url.pathname !== "/api/admin/quality") return null;
  if (url.origin !== origin || !env.QUALITY_CONTROL) return Response.json({ error: "quality_gateway_unavailable" }, { status: 503, headers });
  if (!["GET", "POST"].includes(request.method)) return Response.json({ error: "method_not_allowed" }, { status: 405, headers });
  if (!request.headers.get("cookie")) return Response.json({ error: "forbidden" }, { status: 403, headers });
  if (request.method === "POST" && request.headers.get("origin") !== origin) return Response.json({ error: "invalid_origin" }, { status: 403, headers });
  try {
    let body: string | undefined;
    if (request.method === "POST") {
      if (!/^application\/json(?:;|$)/i.test(request.headers.get("content-type") || "")) return Response.json({ error: "json_required" }, { status: 415, headers });
      body = JSON.stringify(await readJsonBody(request));
    }
    const bodyHash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body || "")))].map(x => x.toString(16).padStart(2, "0")).join("");
    const nonce = crypto.randomUUID().replaceAll("-", "");
    // This subrequest uses the existing public origin so session/CSRF checks
    // remain authoritative at the managed Site. Its cookie goes no further.
    const authorization = await sourceFetch(new Request(`${origin}/api/admin/quality-attestation`, {
      method: "POST", redirect: "manual", signal: AbortSignal.timeout(5000),
      headers: { "Content-Type": "application/json", "Origin": origin, "Cookie": request.headers.get("cookie")! },
      body: JSON.stringify({ method: request.method, path: url.pathname + url.search, bodyHash, nonce }),
    }));
    if (!authorization.ok) return Response.json({ error: authorization.status === 403 ? "forbidden" : "quality_authorization_unavailable" }, { status: authorization.status === 403 ? 403 : 503, headers });
    const authorizationBody = await readJsonBody<{ token?: unknown }>(new Request("https://private.invalid", { method: "POST", body: authorization.body, duplex: "half" } as RequestInit));
    if (typeof authorizationBody.token !== "string" || authorizationBody.token.length > 4096) throw new Error("invalid_attestation_response");
    const forwarded = new Request(request.url, { method: request.method, signal: AbortSignal.timeout(8000),
      headers: { "Content-Type": "application/json", "X-VII-Quality-Attestation": authorizationBody.token, "X-VII-Quality-Nonce": nonce }, ...(body ? { body } : {}) });
    const response = await env.QUALITY_CONTROL.fetch(forwarded);
    // Never forward a private service cookie, cache admission header or body
    // from an authorization failure into the original visitor response.
    const evidence = request.method === "GET" && url.searchParams.get("evidence") === "1";
    if (evidence && response.ok) {
      try{return await readPrivateJpeg(response,{signal:request.signal});}
      catch{return Response.json({error:'invalid_evidence_response'},{status:502,headers});}
    }
    return new Response(response.body, { status: response.status, headers: { ...headers, "Content-Type": "application/json" } });
  } catch (error) {
    return Response.json({ error: error instanceof RequestBodyError ? error.message : "quality_gateway_unavailable" }, { status: error instanceof RequestBodyError ? error.status : 503, headers });
  }
}
