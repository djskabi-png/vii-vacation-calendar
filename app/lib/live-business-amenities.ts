import { buildSergeyAmenityIndex, sergeyAmenityGroups } from "./sergey-amenities.ts";

export type LiveBusinessAmenityGroup = { title: string; items: string[] };

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

export async function fetchLiveBusinessAmenities({ supplierId, token, fetchImpl = fetch }: {
  supplierId: number;
  token: string;
  fetchImpl?: typeof fetch;
}): Promise<LiveBusinessAmenityGroup[]> {
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
  if (detailGroups.length) return detailGroups;

  // Biz may publish the shared place taxonomy in the list contract before the
  // detail contract catches up. The list still carries official amenity IDs;
  // use it only when the detail contract has no usable shared groups. Room
  // amenities are deliberately never used here.
  const listResponse = await fetchImpl("https://bizonline.co.il/api/ai/vii/vacations", {
    headers,
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });
  if (!listResponse.ok) throw new Error("supplier_amenities_unavailable");
  return sergeyAmenityGroups(listSharedAmenities(await listResponse.json(), supplierId), index);
}
