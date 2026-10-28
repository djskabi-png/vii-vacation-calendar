import { buildSergeyAmenityIndex, sergeyAmenityGroups } from "./sergey-amenities.ts";

export type LiveBusinessAmenityGroup = { title: string; items: string[] };

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
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
  return sergeyAmenityGroups(detail.shared_amenities, index);
}
