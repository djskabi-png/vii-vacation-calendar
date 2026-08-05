const upstream = "https://app.spaplus.co/api/integrations/vii-leads";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request) {
  let payload: Record<string, unknown>;
  try {
    payload = await request.json() as Record<string, unknown>;
  } catch {
    return json({ success: false, error: "invalid_request" }, 400);
  }

  if (payload.honey) return json({ success: true });
  if (!payload.submissionId || !payload.name || !payload.phone || payload.privacyAccepted !== true) {
    return json({ success: false, error: "missing_required_fields" }, 400);
  }

  try {
    const response = await fetch(upstream, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({
        ...payload,
        sourceSite: "vii.co.il",
        sourceHost: "vii.spaplus.co",
      }),
      signal: AbortSignal.timeout(12_000),
    });
    const result = await response.json().catch(() => null) as Record<string, unknown> | null;
    if (!response.ok || !result?.success) return json({ success: false, error: "upstream_rejected" }, 502);
    return json({ success: true, reference: result.reference || "" });
  } catch {
    return json({ success: false, error: "upstream_unavailable" }, 502);
  }
}
