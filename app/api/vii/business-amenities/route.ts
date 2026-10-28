import { fetchLiveBusinessAmenities } from "../../../lib/live-business-amenities.ts";
import { supplierToken } from "../../../lib/vii-supplier-token.ts";

const publicCache = {
  "Cache-Control": "public, max-age=300, s-maxage=21600, stale-while-revalidate=86400",
  "X-Content-Type-Options": "nosniff",
};
const noStore = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" };

export async function businessAmenitiesResponse(request: Request, dependencies: {
  token: () => Promise<string>;
  load: (supplierId: number, token: string) => Promise<{
    groups: Array<{ title: string; items: string[] }>;
    source: "biz-shared-amenities" | "legacy-vii-place-amenities";
  }>;
}) {
  const url = new URL(request.url);
  const supplierId = Number(url.searchParams.get("id"));
  if ([...url.searchParams.keys()].some((key) => !["id", "v"].includes(key))
      || (url.searchParams.has("v") && url.searchParams.get("v") !== "3")
      || !Number.isSafeInteger(supplierId) || supplierId <= 0) {
    return Response.json({ error: "invalid_request" }, { status: 400, headers: noStore });
  }
  try {
    const token = await dependencies.token();
    if (!token) throw new Error("supplier_token_unavailable");
    const result = await dependencies.load(supplierId, token);
    return Response.json({ supplierId, ...result }, { headers: publicCache });
  } catch {
    return Response.json({ error: "amenities_temporarily_unavailable" }, { status: 503, headers: noStore });
  }
}

export async function GET(request: Request) {
  return businessAmenitiesResponse(request, {
    token: supplierToken,
    load: (supplierId, token) => fetchLiveBusinessAmenities({ supplierId, token }),
  });
}
