import { readFile, writeFile } from "node:fs/promises";
import { parseFragment } from "parse5";

const root = "https://bizonline.co.il/api/ai/vii";
const token = process.env.SERGEY_VII_API_TOKEN;
if (!token) throw new Error("SERGEY_VII_API_TOKEN is required");

async function get(path) {
  const response = await fetch(`${root}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return response.json();
}

function plainText(value) {
  if (typeof value !== "string") return "";
  const walk = (node) => node.nodeName === "#text" ? node.value : (node.childNodes || []).map(walk).join(" ");
  return walk(parseFragment(value)).replace(/\s+/g, " ").trim();
}

function pictures(galleries) {
  return [...new Set(Object.values(galleries || {}).flatMap((gallery) =>
    Array.isArray(gallery?.pictures) ? gallery.pictures : []))]
    .filter((path) => typeof path === "string" && /^\/gallery\/[\w.-]+$/.test(path))
    .map((path) => new URL(path, "https://www.vii.co.il").href);
}

function positive(value) {
  return Number.isSafeInteger(value) && value > 0 ? value : null;
}

function rates(basePrices) {
  if (!basePrices || Array.isArray(basePrices)) return [];
  return [
    { duration: "שעה", weekday: positive(basePrices.hourPriceWeekday), weekend: positive(basePrices.hourPriceWeekend) },
    { duration: "שעתיים", weekday: positive(basePrices.twoHourPriceWeekday), weekend: positive(basePrices.twoHourPriceWeekend) },
    { duration: "3 שעות", weekday: positive(basePrices.threeHourPriceWeekday), weekend: positive(basePrices.threeHourPriceWeekend) },
  ].filter((rate) => rate.weekday || rate.weekend);
}

const [listing, locations] = await Promise.all([get("/rooms"), get("/rooms/locations")]);
if (!Array.isArray(listing.places) || !Array.isArray(locations.cities) || !Array.isArray(locations.areas)) {
  throw new Error("Invalid rooms catalog or locations");
}
const active = listing.places.filter((place) => place.active === true);
if (!active.length || active.length !== new Set(active.map((place) => place.siteID)).size) {
  throw new Error("Missing or duplicate active rooms");
}
const outputPath = new URL("../app/data/sergey-hourly-catalog.json", import.meta.url);
try {
  const previous = JSON.parse(await readFile(outputPath, "utf8"));
  if (Array.isArray(previous.places) && active.length < Math.ceil(previous.places.length * 0.8)) {
    throw new Error(`Rooms catalog coverage collapsed from ${previous.places.length} to ${active.length}`);
  }
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}
const cities = new Map(locations.cities.map((city) => [city.id, city]));
const areas = new Map(locations.areas.map((area) => [area.id, area.title]));
const places = [];
for (const entry of active) {
  const detail = await get(`/rooms/${entry.siteID}`);
  if (detail.id !== entry.siteID || detail.active !== true || !String(detail.name || "").trim()) {
    throw new Error(`Invalid identity for room site ${entry.siteID}`);
  }
  const city = cities.get(detail.location?.city);
  const rooms = Array.isArray(detail.rooms) ? detail.rooms.map((room) => ({
    id: room.roomID,
    name: String(room.roomName || "").trim(),
    count: positive(room.roomCount),
    maxGuests: positive(room.maxGuests),
    features: [...new Set((room.spaces || []).flatMap((space) =>
      (space.features || []).map((feature) => plainText(feature.description))).filter(Boolean))],
    rates: rates(room.basePrices),
  })) : [];
  places.push({
    id: `hourly-${detail.id}`,
    supplierId: detail.id,
    name: detail.name.trim(),
    sourceUrl: detail.page_url,
    location: city?.title || "",
    area: areas.get(city?.area) || "",
    description: plainText(detail.meta?.description) || plainText(detail.summary),
    images: pictures(detail.galleries),
    phone: typeof detail.contact?.phone === "string" ? detail.contact.phone : "",
    whatsapp: typeof detail.contact?.whatsapp === "string" ? detail.contact.whatsapp : "",
    lat: detail.gps?.lat,
    lng: detail.gps?.long,
    score: typeof detail.reviews?.score === "number" && Number.isFinite(detail.reviews.score) && detail.reviews.score > 0 ? detail.reviews.score : null,
    reviewCount: positive(detail.reviews?.count) || 0,
    rooms,
  });
}

const output = { source: "sergey-vii-api/rooms", fetchedAt: new Date().toISOString(), places };
await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify({ fetchedAt: output.fetchedAt, active: places.length, withRooms: places.filter((place) => place.rooms.length).length, withImages: places.filter((place) => place.images.length).length, withRates: places.filter((place) => place.rooms.some((room) => room.rates.length)).length }));
