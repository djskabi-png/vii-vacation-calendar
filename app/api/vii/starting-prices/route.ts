import { cachedDiscovery } from "../../../lib/discovery-offer-cache.ts";
import { publishedSupplierIds, runtimeCatalogDatabase } from "../../../lib/published-supplier-ids.ts";
import { supplierToken } from "../../../lib/vii-supplier-token.ts";
import { fetchStartingPriceCatalog, publishedStartingPrices, readAcceptedStartingPriceCatalog, validStartingPriceMap, type StartingPriceMap, type StartingPriceWorld } from "../../../lib/supplier-starting-price.ts";

const headers = { "Cache-Control": "no-store" };
type Dependencies = {
  published: (world: StartingPriceWorld) => Promise<ReadonlySet<number>>;
  read: (world: StartingPriceWorld) => Promise<{ value: StartingPriceMap; cache?: unknown }>;
};

export async function startingPricesResponse(request: Request, dependencies: Dependencies) {
  const params = new URL(request.url).searchParams;
  const world = params.get("world");
  if ((world !== "vacations" && world !== "events") || [...params.keys()].some(key => key !== "world") || params.getAll("world").length !== 1) {
    return Response.json({ error: "invalid_request" }, { status: 400, headers });
  }
  try {
    // Publication is checked anew, after cache lookup: a removed venue cannot return via stale prices.
    const cached = await dependencies.read(world);
    if (!validStartingPriceMap(world, cached.value)) throw new Error("invalid_prices");
    const ids = await dependencies.published(world);
    return Response.json({ world, prices: publishedStartingPrices(world, cached.value, ids), cache: cached.cache }, { headers });
  } catch {
    return Response.json({ world, prices: {}, error: "starting_prices_unavailable" }, { status: 503, headers });
  }
}

export async function GET(request: Request) {
  const database = await runtimeCatalogDatabase();
  return startingPricesResponse(request, {
    published: world => publishedSupplierIds(world, database),
    read: async world => cachedDiscovery({
      key: ["supplier-starting-prices", 5, world],
      db: database,
      load: async () => {
        if (database) {
          try {
            // A complete accepted generation with no seasonal fields is a
            // valid empty price catalog. Do not call the remote supplier just
            // because the accepted projection contains zero prices.
            return await readAcceptedStartingPriceCatalog(database, world);
          } catch {
            // A missing or temporarily unreadable accepted generation may be
            // rebuilt from the bounded authenticated supplier source below.
          }
        }
        // A generation created while the old projection was active can be
        // complete yet contain no seasonal price fields. Rebuild the bounded
        // public price cache from the authenticated supplier source instead
        // of publishing a misleading empty map.
        const fallback = await fetchStartingPriceCatalog(world, await supplierToken());
        // A complete active catalog may legitimately contain no seasonal
        // advertising prices. An empty, validated map means "no starting
        // price published", not an infrastructure failure.
        return fallback;
      },
      validate: value => validStartingPriceMap(world, value),
    }),
  });
}
