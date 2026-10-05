import { readFile, writeFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";

const root = new URL("../", import.meta.url);
const input = new URL("tmp/vii-sergey-stage-20261005/raw.json.gz", root);
const output = new URL("app/data/sergey-public-catalog.json", root);
const report = new URL("tmp/vii-sergey-stage-20261005/public-catalog-report.json", root);
const source = JSON.parse(gunzipSync(await readFile(input)));
const cities = new Map(source.locations.cities.map((city) => [city.id, city]));
const areas = new Map(source.locations.areas.map((area) => [area.id, area.title]));
const rejected = [];

function imageUrl(value) {
  if (typeof value !== "string" || !value.startsWith("/gallery/")) return null;
  return new URL(value, "https://www.vii.co.il").href;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function galleryImages(galleries) {
  return unique(Object.values(galleries || {}).flatMap((gallery) =>
    Array.isArray(gallery?.pictures) ? gallery.pictures.map(imageUrl) : []));
}

function featuresFor(place) {
  const roomFeatures = (place.rooms || []).flatMap((room) =>
    (room.spaces || []).flatMap((space) =>
      (space.features || []).map((feature) => feature.description?.trim())));
  return unique([...(place.highlights || []).filter((item) => typeof item === "string"), ...roomFeatures]).slice(0, 24);
}

function validIsraelCoordinates(lat, lng) {
  return typeof lat === "number" && typeof lng === "number"
    && Number.isFinite(lat) && Number.isFinite(lng)
    && lat >= 29 && lat <= 34 && lng >= 34 && lng <= 36;
}

const places = source.details.flatMap(({ world, supplierId, raw }) => {
  if (!raw?.active || raw.id !== supplierId || !["vacations", "events"].includes(world)) {
    rejected.push({ world, supplierId, reason: "identity_or_status" });
    return [];
  }
  const city = cities.get(raw.location?.city);
  const images = galleryImages(raw.galleries);
  const lat = raw.gps?.lat;
  const lng = raw.gps?.long;
  const rooms = Array.isArray(raw.rooms) ? raw.rooms : [];
  if (!city?.title || !images.length || !rooms.length || !validIsraelCoordinates(lat, lng)) {
    rejected.push({ world, supplierId, reason: !validIsraelCoordinates(lat, lng) ? "invalid_coordinates" : "missing_required_field" });
    return [];
  }
  const units = rooms.reduce((total, room) => total + (Number.isSafeInteger(room.roomCount) && room.roomCount > 0 ? room.roomCount : 1), 0);
  const capacity = Math.max(...rooms.map((room) => Number.isSafeInteger(room.maxGuests) && room.maxGuests > 0 ? room.maxGuests : 0));
  if (!capacity) {
    rejected.push({ world, supplierId, reason: "missing_capacity" });
    return [];
  }
  const phone = typeof raw.contact?.phone === "string" && /^[+\d()\s-]{7,24}$/.test(raw.contact.phone)
    ? raw.contact.phone : undefined;
  const score = typeof raw.reviews?.score === "number" && raw.reviews.score > 0 ? raw.reviews.score : undefined;
  const reviews = Number.isSafeInteger(raw.reviews?.count) && raw.reviews.count > 0 ? raw.reviews.count : undefined;
  const description = typeof raw.meta?.description === "string" ? raw.meta.description.trim() : "";
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  if (!name) {
    rejected.push({ world, supplierId, reason: "missing_name" });
    return [];
  }
  return [{
    supplierId,
    world,
    sourceUrl: raw.page_url,
    slug: `${world === "vacations" ? "vacation" : "event"}-${supplierId}`,
    name,
    location: city.title,
    area: areas.get(city.area) || "",
    type: world === "vacations" ? "מקום אירוח" : "מקום לאירועים",
    units,
    guests: capacity,
    capacityScope: "unit",
    image: images[0],
    images: images.slice(0, 12),
    description,
    features: featuresFor(raw),
    audiences: [],
    badges: [],
    lat,
    lng,
    scenario: units > 1 ? "multi" : "single",
    ...(score ? { score } : {}),
    ...(reviews ? { reviews } : {}),
    ...(phone ? { contact: { phone } } : {}),
    ...(world === "events" ? { eventTypes: [] } : {}),
  }];
});

const result = { source: "sergey-vii-api", fetchedAt: source.fetchedAt, places };
await writeFile(output, `${JSON.stringify(result)}\n`);
await writeFile(report, `${JSON.stringify({ fetchedAt: source.fetchedAt, accepted: {
  vacations: places.filter((place) => place.world === "vacations").length,
  events: places.filter((place) => place.world === "events").length,
}, galleryImageLimit: 12, rejected }, null, 2)}\n`);
console.log(JSON.stringify({ accepted: places.length, rejected }));
