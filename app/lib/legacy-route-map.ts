import supplierCatalog from "../data/sergey-public-catalog.json" with { type: "json" };
import hourlyCatalog from "../data/sergey-hourly-catalog.json" with { type: "json" };

const destinations = new Map<string, string | null>();

function add(sourceUrl: string | undefined, destination: string) {
  if (!sourceUrl) return;
  const url = new URL(sourceUrl);
  if (url.hostname !== "www.vii.co.il" && url.hostname !== "vii.co.il") return;
  const key = url.pathname.toLowerCase().replace(/\/$/, "") || "/";
  if (destinations.has(key) && destinations.get(key) !== destination) {
    destinations.set(key, null);
  } else if (!destinations.has(key)) {
    destinations.set(key, destination);
  }
}

for (const place of supplierCatalog.places) {
  if (place.world === "vacations") add(place.sourceUrl, `/business?id=${place.slug}`);
  if (place.world === "events") add(place.sourceUrl, `/events/place/${place.slug}`);
}
for (const place of hourlyCatalog.places) add(place.sourceUrl, `/discover/place/${place.id}`);

export function legacyPlaceDestination(pathname: string) {
  return destinations.get(pathname.toLowerCase().replace(/\/$/, "") || "/") || null;
}
