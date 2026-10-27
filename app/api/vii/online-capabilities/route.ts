import { readCachedOnlineCapabilities } from "../../../lib/online-booking-capability-cache.ts";
import { capabilityProbe, onlineCapabilitiesFromSearch, publicOnlineCapabilities, validOnlineCapabilities, type OnlineCapabilityMap } from "../../../lib/online-booking-capability.ts";
import { publishedSupplierIds, runtimeCatalogDatabase } from "../../../lib/published-supplier-ids.ts";
import { liveSupplierSearch } from "../../../lib/vii-live-search.ts";
import { supplierToken } from "../../../lib/vii-supplier-token.ts";

const headers = { "Cache-Control": "public, max-age=300, s-maxage=1800, stale-while-revalidate=2592000" };
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
  const now = Date.now();
  const published = publishedSupplierIds("vacations");
  return onlineCapabilitiesResponse(request, {
    read: async () => {
      try { return await readCachedOnlineCapabilities(await runtimeCatalogDatabase()); }
      catch {
        // Normal public discovery remains a provider-free snapshot read. When
        // that storage path is unavailable, recover once from the supplier's
        // explicit capability flag instead of blanking the online filter.
        const probe = capabilityProbe(now);
        const till = new Date(Date.parse(`${probe.from}T00:00:00Z`) + probe.nights * 86_400_000).toISOString().slice(0, 10);
        const result = await liveSupplierSearch({ world: "vacations", from: probe.from, till, guests: 2,
          rooms: [{ adults: 2 }], token: await supplierToken(), publishedIds: await published });
        return { value: onlineCapabilitiesFromSearch(result, now) };
      }
    },
    published: () => published,
    now: () => now,
  });
}
