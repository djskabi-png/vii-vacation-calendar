import { parse } from "parse5";
import { buildSergeyAmenityIndex, sergeyAmenityGroups } from "./sergey-amenities.ts";

export type LiveBusinessAmenityGroup = { title: string; items: string[] };
export type LiveBusinessAmenities = {
  groups: LiveBusinessAmenityGroup[];
  source: "biz-shared-amenities" | "legacy-vii-place-amenities";
};

type HtmlNode = {
  nodeName?: string;
  value?: string;
  attrs?: Array<{ name: string; value: string }>;
  childNodes?: HtmlNode[];
};

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function positiveId(value: unknown) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : 0;
}

function listSharedAmenities(value: unknown, supplierId: number) {
  const places = record(value).places;
  if (!Array.isArray(places)) return [];
  const place = places.map(record).find((item) => positiveId(item.siteID) === supplierId || positiveId(item.id) === supplierId);
  return Array.isArray(place?.shared_amenities) ? place.shared_amenities : [];
}

function nodeClass(node: HtmlNode) {
  return node.attrs?.find((attribute) => attribute.name === "class")?.value.split(/\s+/).filter(Boolean) ?? [];
}

function descendants(node: HtmlNode, predicate: (candidate: HtmlNode) => boolean): HtmlNode[] {
  const found: HtmlNode[] = [];
  for (const child of node.childNodes ?? []) {
    if (predicate(child)) found.push(child);
    found.push(...descendants(child, predicate));
  }
  return found;
}

function nodeText(node: HtmlNode): string {
  if (node.nodeName === "#text") return node.value ?? "";
  return (node.childNodes ?? []).map(nodeText).join(" ").replace(/\s+/g, " ").trim();
}

export function legacyViiAmenityGroups(html: string): LiveBusinessAmenityGroup[] {
  const document = parse(html) as unknown as HtmlNode;
  const section = descendants(document, (node) => nodeClass(node).includes("minisite-properties"))[0];
  if (!section) return [];
  const inner = descendants(section, (node) => nodeClass(node).includes("inner"))[0];
  if (!inner) return [];
  const groups: LiveBusinessAmenityGroup[] = [];
  for (const item of descendants(inner, (node) => nodeClass(node).includes("item"))) {
    const titleNode = descendants(item, (node) => nodeClass(node).includes("title"))[0];
    const listNode = descendants(item, (node) => node.nodeName === "ul")[0];
    const title = titleNode ? nodeText(titleNode).replace(/^\s*מידע\s*$/u, "") : "";
    if (!title || !listNode) continue;
    const items = [...new Set(descendants(listNode, (node) => node.nodeName === "li").map(nodeText).filter(Boolean))];
    if (items.length) groups.push({ title, items });
  }
  return groups;
}

function legacyPlaceUrl(value: unknown) {
  const candidate = typeof value === "string" ? value.trim() : "";
  if (!candidate) return "";
  try {
    const url = new URL(candidate);
    return url.protocol === "https:" && ["vii.co.il", "www.vii.co.il"].includes(url.hostname) ? url.toString() : "";
  } catch { return ""; }
}

export async function fetchLiveBusinessAmenities({ supplierId, token, fetchImpl = fetch }: {
  supplierId: number;
  token: string;
  fetchImpl?: typeof fetch;
}): Promise<LiveBusinessAmenities> {
  if (!Number.isSafeInteger(supplierId) || supplierId <= 0 || !token) throw new Error("invalid_amenity_request");
  const headers = { Authorization: `Bearer ${token}`, Accept: "application/json" };
  const [detailResponse, typesResponse] = await Promise.all([
    fetchImpl(`https://bizonline.co.il/api/ai/vii/vacations/${supplierId}`, {
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    }),
    fetchImpl("https://bizonline.co.il/api/ai/vii/vacations/types", {
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    }),
  ]);
  if (!detailResponse.ok || !typesResponse.ok) throw new Error("supplier_amenities_unavailable");
  const detail = record(await detailResponse.json());
  if (detail.active !== true || detail.id !== supplierId) throw new Error("invalid_supplier_place");
  const index = buildSergeyAmenityIndex(await typesResponse.json());
  const detailGroups = sergeyAmenityGroups(detail.shared_amenities, index);
  if (detailGroups.length) return { groups: detailGroups, source: "biz-shared-amenities" };

  // Biz may publish the shared place taxonomy in the list contract before the
  // detail contract catches up. The list still carries official amenity IDs;
  // use it only when the detail contract has no usable shared groups. Room
  // amenities are deliberately never used here.
  const legacyUrl = legacyPlaceUrl(detail.page_url);
  const [listResponse, legacyResponse] = await Promise.all([
    fetchImpl("https://bizonline.co.il/api/ai/vii/vacations", {
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    }),
    legacyUrl ? fetchImpl(legacyUrl, {
      headers: { Accept: "text/html" },
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    }).catch(() => null) : Promise.resolve(null),
  ]);
  if (!listResponse.ok) throw new Error("supplier_amenities_unavailable");
  const listGroups = sergeyAmenityGroups(listSharedAmenities(await listResponse.json(), supplierId), index);
  if (listGroups.length) return { groups: listGroups, source: "biz-shared-amenities" };
  if (legacyResponse?.ok) {
    const legacyGroups = legacyViiAmenityGroups(await legacyResponse.text());
    if (legacyGroups.length) return { groups: legacyGroups, source: "legacy-vii-place-amenities" };
  }
  return { groups: [], source: "biz-shared-amenities" };
}
