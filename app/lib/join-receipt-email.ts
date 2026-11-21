type JoinReceiptEnvironment = {
  VII_JOIN_EMAIL_PROVIDER?: string;
  VII_JOIN_EMAIL_API_KEY?: string;
  VII_JOIN_EMAIL_FROM?: string;
  VII_QUALITY_EMAIL_PROVIDER?: string;
  VII_QUALITY_EMAIL_API_KEY?: string;
  VII_QUALITY_EMAIL_FROM?: string;
};

type JoinReceiptInput = {
  submissionId: string;
  email: string;
  name: string;
  organization?: string;
  world?: string;
  reference: string;
};

type JoinReceiptResult =
  | { status: "sent"; providerMessageId: string }
  | { status: "disabled" | "failed" | "unknown"; providerMessageId: null; reason: string };

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function configuration(env: JoinReceiptEnvironment) {
  const provider = (env.VII_JOIN_EMAIL_PROVIDER || env.VII_QUALITY_EMAIL_PROVIDER || "").trim().toLowerCase();
  const apiKey = (env.VII_JOIN_EMAIL_API_KEY || env.VII_QUALITY_EMAIL_API_KEY || "").trim();
  const from = (env.VII_JOIN_EMAIL_FROM || env.VII_QUALITY_EMAIL_FROM || "").trim();
  return { provider, apiKey, from, configured: provider === "resend" && Boolean(apiKey && from) };
}

function clean(value: string | undefined, maximum = 180) {
  return String(value || "").replace(/[\r\n\t]+/g, " ").replace(/\s{2,}/g, " ").trim().slice(0, maximum);
}

export async function deliverJoinReceipt(
  input: JoinReceiptInput,
  env: JoinReceiptEnvironment = process.env,
  fetcher: typeof fetch = fetch,
): Promise<JoinReceiptResult> {
  const email = clean(input.email, 320).toLowerCase();
  if (!emailPattern.test(email)) return { status: "failed", providerMessageId: null, reason: "invalid_recipient" };
  const configured = configuration(env);
  if (!configured.configured) return { status: "disabled", providerMessageId: null, reason: "email_provider_not_configured" };

  const name = clean(input.name) || "שלום";
  const organization = clean(input.organization);
  const world = clean(input.world);
  const reference = clean(input.reference) || clean(input.submissionId);
  const text = [
    `${name}, בקשת ההצטרפות שלכם ל־VII התקבלה.`,
    organization ? `שם העסק: ${organization}` : "",
    world ? `תחום: ${world}` : "",
    `מספר פנייה: ${reference}`,
    "הפרטים הועברו לצוות המתאים. נציג יחזור אליכם לאחר בדיקה, לפני כל התחייבות או חיוב.",
    "אין צורך להשיב למייל זה.",
  ].filter(Boolean).join("\n\n");

  try {
    const response = await fetcher("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${configured.apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `vii-join-receipt:${clean(input.submissionId, 100)}`,
      },
      body: JSON.stringify({
        from: configured.from,
        to: [email],
        subject: "בקשת ההצטרפות שלכם ל־VII התקבלה",
        text,
      }),
      signal: AbortSignal.timeout(8_000),
    });
    const payload = await response.json().catch(() => null) as { id?: unknown } | null;
    const providerMessageId = typeof payload?.id === "string" ? payload.id : null;
    if (!response.ok || !providerMessageId) {
      return { status: "failed", providerMessageId: null, reason: `provider_http_${response.status}` };
    }
    return { status: "sent", providerMessageId };
  } catch (error) {
    return {
      status: "unknown",
      providerMessageId: null,
      reason: error instanceof Error ? error.message.slice(0, 160) : "provider_request_unknown",
    };
  }
}
