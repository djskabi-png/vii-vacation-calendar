const BASE_URL = "https://bizonline.co.il/api/partner/v1/compounds";
const REQUEST_TIMEOUT_MS = 8_000;

type JsonObject = Record<string, unknown>;
type FetchLike = typeof fetch;

export class MaxCompoundsApiError extends Error {
  readonly code: string;
  readonly status: number | null;

  constructor(code: string, status: number | null) {
    super(`Max compounds API: ${code}`);
    this.name = "MaxCompoundsApiError";
    this.code = code;
    this.status = status;
  }
}

function positiveId(value: number) {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new MaxCompoundsApiError("invalid_id", null);
  }
  return value;
}

function date(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    throw new MaxCompoundsApiError("invalid_date", null);
  }
  return value;
}

function dateRange(from: string, till: string) {
  if (date(from) >= date(till)) {
    throw new MaxCompoundsApiError("invalid_date_range", null);
  }
}

function providerCode(body: unknown) {
  if (!body || typeof body !== "object" || !("error" in body)) return null;
  const error = body.error;
  if (!error || typeof error !== "object" || !("code" in error)) return null;
  return typeof error.code === "string" && /^[a-zA-Z0-9_-]{1,80}$/.test(error.code)
    ? error.code
    : null;
}

export function createMaxCompoundsClient(options: { apiKey: string; fetchImpl?: FetchLike }) {
  const apiKey = options.apiKey.trim();
  if (!apiKey) throw new MaxCompoundsApiError("missing_api_key", null);
  const fetchImpl = options.fetchImpl ?? fetch;

  async function request(path: string, payload?: JsonObject): Promise<unknown> {
    let response: Response;
    try {
      response = await fetchImpl(`${BASE_URL}${path}`, {
        method: payload ? "POST" : "GET",
        headers: {
          "X-API-Key": apiKey,
          Accept: "application/json",
          ...(payload ? { "Content-Type": "application/json" } : {}),
        },
        body: payload ? JSON.stringify(payload) : undefined,
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch {
      throw new MaxCompoundsApiError("transport_error", null);
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new MaxCompoundsApiError("invalid_response", response.status);
    }
    if (!body || typeof body !== "object" || !("ok" in body)) {
      throw new MaxCompoundsApiError("invalid_response", response.status);
    }
    if (!response.ok || body.ok !== true) {
      throw new MaxCompoundsApiError(providerCode(body) ?? "provider_error", response.status);
    }
    if (!("data" in body)) {
      throw new MaxCompoundsApiError("invalid_response", response.status);
    }
    return body.data;
  }

  return {
    site(siteId: number, lang: "he" | "en" = "he") {
      return request(`/sites/${positiveId(siteId)}?lang=${lang}`);
    },
    search(payload: JsonObject) {
      return request("/search", payload);
    },
    quote(payload: JsonObject) {
      return request("/quote", payload);
    },
    vacancy(siteId: number, from: string, till: string) {
      dateRange(from, till);
      return request(`/sites/${positiveId(siteId)}/vacancy?from=${from}&till=${till}`);
    },
    roomVacancy(siteId: number, roomId: number, from: string, till: string) {
      dateRange(from, till);
      return request(`/sites/${positiveId(siteId)}/rooms/${positiveId(roomId)}/vacancy?from=${from}&till=${till}`);
    },
    bookingStatus(bookingId: number) {
      return request(`/bookings/${positiveId(bookingId)}`);
    },
  };
}

export function maxCompoundsClientFromEnv() {
  return createMaxCompoundsClient({ apiKey: process.env.VII_MAX_COMPOUNDS_API_KEY ?? "" });
}
