import { readCachedOnlineCapabilities } from "../../../lib/online-booking-capability-cache.ts";
import { publicOnlineCapabilities, validOnlineCapabilities, type OnlineCapabilityMap } from "../../../lib/online-booking-capability.ts";
import { publishedSupplierIds, runtimeCatalogDatabase } from "../../../lib/published-supplier-ids.ts";

const headers = { "Cache-Control": "public, max-age=300, s-maxage=3600, stale-while-revalidate=604800" };
const noStore = { "Cache-Control": "no-store" };
export async function onlineCapabilitiesResponse(request: Request, dependencies: {
  read: () => Promise<{ value: OnlineCapabilityMap }>;
  published: () => Promise<ReadonlySet<number>>;
  now?: () => number;
}) {
  if (new URL(request.url).search) return Response.json({ error: "invalid_request" }, { status: 400, headers: noStore });
  try {
    const cached = await dependencies.read();
    if (!validOnlineCapabilities(cached.value)) throw new Error("invalid_capabilities");
    const ids = await dependencies.published();
    return Response.json({ capabilities: publicOnlineCapabilities(cached.value, ids, dependencies.now?.()) }, { headers });
  } catch { return Response.json({ error: "capabilities_unavailable" }, { status: 503, headers: noStore }); }
}
export async function GET(request: Request) {
  return onlineCapabilitiesResponse(request, {
    read: async () => readCachedOnlineCapabilities(await runtimeCatalogDatabase()),
    published: () => publishedSupplierIds("vacations"),
  });
}
