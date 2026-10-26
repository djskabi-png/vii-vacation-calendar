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
  contacts?: ConversionContact[];
};

export type ConversionOrder = {
  orderID: string;
  orderIDBySite: string | null;
  created: string;
  price: number;
};

export type ConversionContact = {
  source: ConversionSource;
  id: number;
  domainID: number | null;
  time: string;
  phone: string | null;
  /** Server-only matching aid. It is deliberately non-enumerable and never serialized to the browser. */
  internalEmail?: string | null;
  details: { status?: string; duration?: number; date?: string | null; guests?: number };
  order: ConversionOrder | null;
  delay: number | null;
  moreOrders: string[];
};

export class ViiConversionsError extends Error {
  readonly code: string;
  readonly status: number | null;
  readonly diagnostic: string | null;

  constructor(code: string, status: number | null, diagnostic: string | null = null) {
    super(`VII conversions: ${code}`);
    this.name = "ViiConversionsError";
    this.code = code;
    this.status = status;
    this.diagnostic = diagnostic;
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
    || !(row.medianDelay === null || nonNegative(row.medianDelay))) return null;
  return {
    contacts: Number(row.contacts), identified: Number(row.identified), converted: Number(row.converted),
    rate: row.rate === null ? null : Number(row.rate), customers: Number(row.customers),
    orders: Number(row.orders), revenue: Number(row.revenue), medianDelay: row.medianDelay === null ? null : Number(row.medianDelay),
  };
}

function invalidBucketField(value: unknown, prefix: string) {
  const row = object(value);
  if (!integer(row.contacts)) return `${prefix}.contacts`;
  if (!integer(row.identified)) return `${prefix}.identified`;
  if (!integer(row.converted)) return `${prefix}.converted`;
  if (!integer(row.customers)) return `${prefix}.customers`;
  if (!integer(row.orders)) return `${prefix}.orders`;
  if (!nonNegative(row.revenue)) return `${prefix}.revenue`;
  if (!(row.rate === null || (nonNegative(row.rate) && Number(row.rate) <= 100))) return `${prefix}.rate`;
  if (!(row.medianDelay === null || nonNegative(row.medianDelay))) return `${prefix}.medianDelay`;
  return null;
}

function shortText(value: unknown, maximum: number) {
  return typeof value === "string" && value.length <= maximum ? value : null;
}

function order(value: unknown): ConversionOrder | null | undefined {
  if (value === null) return null;
  const row = object(value);
  const orderID = typeof row.orderID === "string" || typeof row.orderID === "number" ? String(row.orderID) : "";
  const orderIDBySite = row.orderIDBySite === null ? null : typeof row.orderIDBySite === "string" || typeof row.orderIDBySite === "number" ? String(row.orderIDBySite) : undefined;
  if (!orderID || orderID.length > 100 || orderIDBySite === undefined || (orderIDBySite !== null && orderIDBySite.length > 100)
    || !shortText(row.created, 50) || !nonNegative(row.price)) return undefined;
  return { orderID, orderIDBySite, created: String(row.created), price: Number(row.price) };
}

function invalidOrderField(value: unknown, prefix: string) {
  if (value === null) return null;
  const row = object(value);
  const orderID = typeof row.orderID === "string" || typeof row.orderID === "number" ? String(row.orderID) : "";
  const orderIDBySite = row.orderIDBySite === null ? null : typeof row.orderIDBySite === "string" || typeof row.orderIDBySite === "number" ? String(row.orderIDBySite) : undefined;
  if (!orderID || orderID.length > 100) return `${prefix}.orderID`;
  if (orderIDBySite === undefined || (orderIDBySite !== null && orderIDBySite.length > 100)) return `${prefix}.orderIDBySite`;
  if (!shortText(row.created, 50)) return `${prefix}.created`;
  if (!nonNegative(row.price)) return `${prefix}.price`;
  return null;
}

function invalidContactField(value: unknown) {
  const row = object(value);
  if (!(row.source === "whatsapp" || row.source === "maskyoo" || row.source === "form")) return "contacts.item.source";
  if (!Number.isSafeInteger(row.id) || Number(row.id) < 0) return "contacts.item.id";
  if (!(row.domainID === null || Number.isSafeInteger(row.domainID))) return "contacts.item.domainID";
  if (!shortText(row.time, 50)) return "contacts.item.time";
  if (!(row.phone == null || (typeof row.phone === "string" && row.phone.length <= 40)
    || (Number.isSafeInteger(row.phone) && Number(row.phone) >= 0))) return "contacts.item.phone";
  if (!(row.email == null || (typeof row.email === "string" && row.email.length <= 254))) return "contacts.item.email";
  if (!(row.delay === null || integer(row.delay))) return "contacts.item.delay";
  if (!Array.isArray(row.moreOrders)) return "contacts.item.moreOrders";
  const orderField = invalidOrderField(row.order, "contacts.item.order");
  if (orderField) return orderField;
  const moreOrders = row.moreOrders.map((id) => typeof id === "string" || typeof id === "number" ? String(id) : "");
  if (moreOrders.some((id) => !id || id.length > 100)) return "contacts.item.moreOrders.item";
  const rawDetails = object(row.details);
  if (row.source === "maskyoo") {
    if (!shortText(rawDetails.status, 40)) return "contacts.item.details.status";
    if (!integer(rawDetails.duration)) return "contacts.item.details.duration";
  } else if (row.source === "whatsapp") {
    if (!(rawDetails.date === null || (typeof rawDetails.date === "string" && (/^\d{4}-\d{2}-\d{2}$/.test(rawDetails.date) || rawDetails.date === "")))) return "contacts.item.details.date";
    if (!(rawDetails.guests === undefined || integer(rawDetails.guests))) return "contacts.item.details.guests";
  }
  return "contacts.item";
}

function contact(value: unknown): ConversionContact | null {
  const row = object(value);
  if (!(row.source === "whatsapp" || row.source === "maskyoo" || row.source === "form") || !Number.isSafeInteger(row.id) || Number(row.id) < 0
    || !(row.domainID === null || Number.isSafeInteger(row.domainID)) || !shortText(row.time, 50)
    || !(row.phone == null || (typeof row.phone === "string" && row.phone.length <= 40)
      || (Number.isSafeInteger(row.phone) && Number(row.phone) >= 0))
    || !(row.email == null || (typeof row.email === "string" && row.email.length <= 254))
    || !(row.delay === null || integer(row.delay)) || !Array.isArray(row.moreOrders)) return null;
  const matchedOrder = order(row.order);
  if (matchedOrder === undefined) return null;
  const moreOrders = row.moreOrders.map((id) => typeof id === "string" || typeof id === "number" ? String(id) : "");
  if (moreOrders.some((id) => !id || id.length > 100)) return null;
  const rawDetails = object(row.details);
  const details: ConversionContact["details"] = {};
  if (row.source === "maskyoo") {
    const status = shortText(rawDetails.status, 40);
    if (!status || !integer(rawDetails.duration)) return null;
    details.status = status;
    details.duration = Number(rawDetails.duration);
  } else if (row.source === "whatsapp") {
    if (!(rawDetails.date === null || (typeof rawDetails.date === "string" && (/^\d{4}-\d{2}-\d{2}$/.test(rawDetails.date) || rawDetails.date === "")))
      || !(rawDetails.guests === undefined || integer(rawDetails.guests))) return null;
    details.date = rawDetails.date === "" ? null : rawDetails.date as string | null;
    if (rawDetails.guests !== undefined) details.guests = Number(rawDetails.guests);
  }
  const result: ConversionContact = {
    source: row.source, id: Number(row.id), domainID: row.domainID === null ? null : Number(row.domainID), time: String(row.time),
    phone: row.phone == null ? null : String(row.phone), details, order: matchedOrder,
    delay: row.delay === null ? null : Number(row.delay), moreOrders,
  };
  Object.defineProperty(result, "internalEmail", { value: row.email == null ? null : String(row.email), enumerable: false });
  return result;
}

function sanitized(raw: unknown, expected: { siteID: number; from: string; till: string }, includeContacts: boolean): ConversionSummary {
  const value = object(raw);
  const sourceSummary = object(value.summary);
  const all = bucket(sourceSummary.all);
  const whatsapp = bucket(sourceSummary.whatsapp);
  const maskyoo = bucket(sourceSummary.maskyoo);
  const form = bucket(sourceSummary.form);
  const sourceClicks = object(value.clicks);
  const invalidField = value.siteID !== expected.siteID ? "siteID"
    : value.from !== expected.from ? "from"
    : value.till !== expected.till ? "till"
    : typeof value.created !== "string" || !value.created ? "created"
    : !(value.domainID === null || Number.isSafeInteger(value.domainID)) ? "domainID"
    : !integer(value.count) ? "count"
    : !all ? invalidBucketField(sourceSummary.all, "summary.all") || "summary.all"
    : !whatsapp ? invalidBucketField(sourceSummary.whatsapp, "summary.whatsapp") || "summary.whatsapp"
    : !maskyoo ? invalidBucketField(sourceSummary.maskyoo, "summary.maskyoo") || "summary.maskyoo"
    : !form ? invalidBucketField(sourceSummary.form, "summary.form") || "summary.form"
    : !integer(sourceClicks.whatsapp) ? "clicks.whatsapp"
    : !integer(sourceClicks.showphone) ? "clicks.showphone"
    : !integer(sourceClicks.phone) ? "clicks.phone"
    : null;
  if (invalidField) throw new ViiConversionsError("invalid_response", null, invalidField);
  const contacts = includeContacts ? Array.isArray(value.contacts) ? value.contacts.map(contact) : null : undefined;
  if (includeContacts && (!contacts || contacts.some((item) => !item) || contacts.length !== Number(value.count))) {
    const invalidIndex = contacts?.findIndex((item) => !item) ?? -1;
    throw new ViiConversionsError("invalid_response", null, !contacts ? "contacts" : invalidIndex >= 0 ? invalidContactField((value.contacts as unknown[])[invalidIndex]) : "contacts.count");
  }
  return {
    siteID: expected.siteID, from: expected.from, till: expected.till,
    domainID: value.domainID === null ? null : Number(value.domainID), created: value.created,
    count: Number(value.count), summary: { all, whatsapp, maskyoo, form },
    clicks: { whatsapp: Number(sourceClicks.whatsapp), showphone: Number(sourceClicks.showphone), phone: Number(sourceClicks.phone) },
    ...(includeContacts ? { contacts: contacts as ConversionContact[] } : {}),
  };
}

export function parseViiConversionSummary(raw: unknown, expected: { siteID: number; from: string; till: string }, includeContacts = false) {
  return sanitized(raw, expected, includeContacts);
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
  includeContacts?: boolean;
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
  return sanitized(raw, { siteID, from, till }, options.includeContacts === true);
}
