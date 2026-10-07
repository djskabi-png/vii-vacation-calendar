import { mkdir, readFile, writeFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { parseFragment } from "parse5";
import { supplierDisplayDescription } from "../app/data/supplier-display-text.ts";
import { supplierContactNumber } from "../app/lib/supplier-contact.ts";
import { assertCatalogCoverage } from "./sergey-catalog-coverage.mjs";

const root = new URL("../", import.meta.url);
const input = process.env.VII_SERGEY_RAW_PATH || new URL("tmp/vii-sergey-stage-20261005/raw.json.gz", root);
const output = new URL("app/data/sergey-public-catalog.json", root);
const detailOutput = new URL("app/data/sergey-place-details.json", root);
const report = new URL("tmp/vii-sergey-stage-20261005/public-catalog-report.json", root);
const source = JSON.parse(gunzipSync(await readFile(input)));
const cities = new Map(source.locations.cities.map((city) => [city.id, city]));
const areas = new Map(source.locations.areas.map((area) => [area.id, area.title]));
const rejected = [];
const details = {};

function plainText(html) {
  if (typeof html !== "string") return "";
  const walk = (node) => node.nodeName === "#text" ? node.value : (node.childNodes || []).map(walk).join(["p", "br", "li"].includes(node.nodeName) ? "\n" : " ");
  return walk(parseFragment(html)).replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n\n").trim();
}

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
  const phone = supplierContactNumber(raw.contact?.phone);
  const whatsapp = supplierContactNumber(raw.contact?.whatsapp);
  const score = typeof raw.reviews?.score === "number" && raw.reviews.score > 0 ? raw.reviews.score : undefined;
  const reviews = Number.isSafeInteger(raw.reviews?.count) && raw.reviews.count > 0 ? raw.reviews.count : undefined;
  const description = typeof raw.meta?.description === "string" ? raw.meta.description.trim() : "";
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  if (!name) {
    rejected.push({ world, supplierId, reason: "missing_name" });
    return [];
  }
  const slug = `${world === "vacations" ? "vacation" : "event"}-${supplierId}`;
  details[slug] = {
    images,
    summary: supplierDisplayDescription({ description: plainText(raw.summary), name, location: city.title, area: areas.get(city.area) || "" }),
    policy: {
      checkIn: raw.policy?.checkIn || "",
      checkOut: raw.policy?.checkOut || "",
      checkOutSat: raw.policy?.checkOutSat || "",
      remarks: plainText(raw.policy?.remarks),
    },
    rooms: rooms.map((room) => ({
      name: room.roomName?.trim() || "יחידת אירוח",
      quantity: Number.isSafeInteger(room.roomCount) && room.roomCount > 0 ? room.roomCount : 1,
      guests: Number.isSafeInteger(room.maxGuests) && room.maxGuests > 0 ? room.maxGuests : 0,
      bedrooms: Number.isSafeInteger(room.bedrooms) && room.bedrooms > 0 ? room.bedrooms : 0,
      features: unique((room.spaces || []).flatMap((space) => (space.features || []).map((feature) => feature.description?.trim()))),
    })),
    reviews: (raw.reviews?.list || []).filter((review) => Number.isSafeInteger(review.id) && (typeof review.text === "string" || typeof review.score === "number")).map((review) => ({
      id: review.id,
      author: typeof review.author === "string" ? review.author.trim() : "אורח",
      title: typeof review.title === "string" ? review.title.trim() : "",
      text: typeof review.text === "string" ? review.text.trim() : "",
      date: review.added || "",
      score: typeof review.score === "number" ? review.score : undefined,
      response: typeof review.response === "string" ? review.response.trim() : "",
      pictureFiles: Array.isArray(review.pictures) ? review.pictures.filter((picture) => typeof picture === "string" && /^[a-zA-Z0-9_.-]+\.(?:jpe?g|png|webp)$/i.test(picture)) : [],
    })),
    sourceUrl: raw.page_url,
  };
  return [{
    supplierId,
    world,
    sourceUrl: raw.page_url,
    slug,
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
    ...(phone || whatsapp ? { contact: { ...(phone ? { phone } : {}), ...(whatsapp ? { whatsapp } : {}) } } : {}),
    ...(world === "events" ? { eventTypes: [] } : {}),
  }];
});

const result = { source: "sergey-vii-api", fetchedAt: source.fetchedAt, places };
const previousCatalog = JSON.parse(await readFile(output));
assertCatalogCoverage(
  Object.fromEntries(["vacations", "events"].map((world) => [world, previousCatalog.places.filter((place) => place.world === world).length])),
  Object.fromEntries(["vacations", "events"].map((world) => [world, places.filter((place) => place.world === world).length])),
);
await mkdir(new URL("tmp/vii-sergey-stage-20261005/", root), { recursive: true });
await writeFile(output, `${JSON.stringify(result)}\n`);
await writeFile(detailOutput, `${JSON.stringify({ source: "sergey-vii-api", fetchedAt: source.fetchedAt, details })}\n`);
await writeFile(report, `${JSON.stringify({ fetchedAt: source.fetchedAt, accepted: {
  vacations: places.filter((place) => place.world === "vacations").length,
  events: places.filter((place) => place.world === "events").length,
}, galleryImageLimit: 12, rejected }, null, 2)}\n`);
console.log(JSON.stringify({ accepted: places.length, rejected }));
