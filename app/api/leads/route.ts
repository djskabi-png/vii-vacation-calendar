const upstream = "https://app.spaplus.co/api/integrations/vii-leads";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
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

  const isVacationJoin = payload.purpose === "join" && payload.world === "vacation";
  if (isVacationJoin && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(payload.email || ""))) {
    return json({ success: false, error: "valid_email_required" }, 400);
  }

  const isWhatsAppEnquiry = payload.purpose === "whatsapp_enquiry";
  if (
    isWhatsAppEnquiry &&
    (!payload.placeId ||
      !payload.placeName ||
      !/^\d{4}-\d{2}-\d{2}$/.test(String(payload.requestedDate || "")))
  ) {
    return json({ success: false, error: "missing_whatsapp_enquiry_context" }, 400);
  }

  const secret = process.env.VII_LEADS_SECRET?.trim();
  if (!secret || secret.length < 32) {
    return json({ success: false, error: "lead_service_not_configured" }, 503);
  }

  try {
    const forwardedPayload = { ...payload };
    delete forwardedPayload.notificationRequest;
    const response = await fetch(upstream, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-VII-Leads-Secret": secret,
      },
      body: JSON.stringify({
        ...forwardedPayload,
        sourceSite: "vii.co.il",
        sourceHost: "vii.spaplus.co",
        sourceBrand: "VII",
        ...(isWhatsAppEnquiry
          ? {
              notificationRequest: {
                channel: "sms",
                recipientSource: "verified_place_contact",
                template: "vii_whatsapp_lead",
              },
            }
          : {}),
      }),
      signal: AbortSignal.timeout(12_000),
    });
    const result = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    if (!response.ok || !result?.success) {
      return json({ success: false, error: "upstream_rejected" }, 502);
    }
    return json({
      success: true,
      reference: result.reference || "",
      emailDelivered: result.emailDelivered === true,
    });
  } catch {
    return json({ success: false, error: "upstream_unavailable" }, 502);
  }
}
