const API_ROOT = "https://bizonline.co.il/api/ai/vii";
const REQUEST_TIMEOUT_MS = 15_000;

export type ConversionWorld = "vacations" | "events" | "rooms";
export type ConversionSource = "whatsapp" | "maskyoo" | "form";
export type ConversionFilter = "yes" | "no";

export type ConversionBucket = {
  contacts: number;
  identified: number;
  converted: number;
  rate: number | null;
  customers: number;
  orders: number;
  revenue: number;
  medianDelay: number | null;
};

export type ConversionSummary = {
  siteID: number;
  from: string;
  till: string;
  domainID: number | null;
  created: string;
  count: number;
  summary: Record<"all" | ConversionSource, ConversionBucket>;
  clicks: Record<"whatsapp" | "showphone" | "phone", number>;
};

export class ViiConversionsError extends Error {
  readonly code: string;
  readonly status: number | null;

  constructor(code: string, status: number | null) {
    super(`VII conversions: ${code}`);
    this.name = "ViiConversionsError";
    this.code = code;
    this.status = status;
  }
}

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function dayNumber(value: string) {
  return Date.parse(`${value}T00:00:00Z`) / 86_400_000;
}

function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function nonNegative(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function integer(value: unknown) {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}

function bucket(value: unknown): ConversionBucket | null {
  const row = object(value);
  if (![row.contacts, row.identified, row.converted, row.customers, row.orders].every(integer)
    || !nonNegative(row.revenue)
    || !(row.rate === null || (nonNegative(row.rate) && Number(row.rate) <= 100))
    || !(row.medianDelay === null || integer(row.medianDelay))) return null;
  return {
    contacts: Number(row.contacts), identified: Number(row.identified), converted: Number(row.converted),
    rate: row.rate === null ? null : Number(row.rate), customers: Number(row.customers),
    orders: Number(row.orders), revenue: Number(row.revenue), medianDelay: row.medianDelay === null ? null : Number(row.medianDelay),
  };
}

function sanitized(raw: unknown, expected: { siteID: number; from: string; till: string }): ConversionSummary {
  const value = object(raw);
  const sourceSummary = object(value.summary);
  const all = bucket(sourceSummary.all);
  const whatsapp = bucket(sourceSummary.whatsapp);
  const maskyoo = bucket(sourceSummary.maskyoo);
  const form = bucket(sourceSummary.form);
  const sourceClicks = object(value.clicks);
  if (value.siteID !== expected.siteID || value.from !== expected.from || value.till !== expected.till
    || typeof value.created !== "string" || !value.created
    || !(value.domainID === null || Number.isSafeInteger(value.domainID)) || !integer(value.count)
    || !all || !whatsapp || !maskyoo || !form
    || !integer(sourceClicks.whatsapp) || !integer(sourceClicks.showphone) || !integer(sourceClicks.phone)) {
    throw new ViiConversionsError("invalid_response", null);
  }
  return {
    siteID: expected.siteID, from: expected.from, till: expected.till,
    domainID: value.domainID === null ? null : Number(value.domainID), created: value.created,
    count: Number(value.count), summary: { all, whatsapp, maskyoo, form },
    clicks: { whatsapp: Number(sourceClicks.whatsapp), showphone: Number(sourceClicks.showphone), phone: Number(sourceClicks.phone) },
  };
}

export function conversionTarget(placeId: string, world: string): { world: ConversionWorld; siteID: number } | null {
  const match = /^(?:vacation|event|events|hourly|room|rooms)-(\d+)$/.exec(placeId.trim());
  if (!match) return null;
  const siteID = Number(match[1]);
  if (!Number.isSafeInteger(siteID) || siteID < 1) return null;
  const normalized = world.trim().toLowerCase();
  if (normalized === "vacation" || normalized === "vacations") return { world: "vacations", siteID };
  if (normalized === "event" || normalized === "events") return { world: "events", siteID };
  if (normalized === "hourly" || normalized === "room" || normalized === "rooms") return { world: "rooms", siteID };
  return null;
}

export async function fetchViiConversions(options: {
  world: ConversionWorld;
  siteID: number;
  from: string;
  till: string;
  token: string;
  source?: ConversionSource;
  converted?: ConversionFilter;
  sectionOnly?: boolean;
  fetchImpl?: typeof fetch;
}): Promise<ConversionSummary> {
  const { world, siteID, from, till } = options;
  if (!(["vacations", "events", "rooms"] as const).includes(world) || !Number.isSafeInteger(siteID) || siteID < 1
    || !validDate(from) || !validDate(till) || dayNumber(till) < dayNumber(from) || dayNumber(till) - dayNumber(from) > 365
    || (options.source !== undefined && !(["whatsapp", "maskyoo", "form"] as const).includes(options.source))
    || (options.converted !== undefined && !(["yes", "no"] as const).includes(options.converted))) {
    throw new ViiConversionsError("invalid_request", null);
  }
  const token = options.token.trim();
  if (!token) throw new ViiConversionsError("supplier_unavailable", null);
  const params = new URLSearchParams({ from, till });
  if (options.source) params.set("src", options.source);
  if (options.converted) params.set("conv", options.converted);
  if (options.sectionOnly) params.set("domain", "section");
  let response: Response;
  try {
    response = await (options.fetchImpl ?? fetch)(`${API_ROOT}/${world}/${siteID}/conversions?${params}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    throw new ViiConversionsError("supplier_unavailable", null);
  }
  if (response.status === 404) throw new ViiConversionsError("not_supported", 404);
  if (response.status === 422) throw new ViiConversionsError("invalid_request", 422);
  if (!response.ok) throw new ViiConversionsError("supplier_unavailable", response.status);
  let raw: unknown;
  try { raw = await response.json(); } catch { throw new ViiConversionsError("invalid_response", response.status); }
  return sanitized(raw, { siteID, from, till });
}
