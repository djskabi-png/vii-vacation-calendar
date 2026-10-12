import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const paths = {
  vacations: "../app/data/sergey-public-catalog.json",
  events: "../app/data/sergey-public-catalog.json",
  rooms: "../app/data/sergey-hourly-catalog.json",
  spa: "../app/data/spaplus-catalog.json",
};

export function summarizeWorld(world, catalog, now = new Date()) {
  const entries = world === "spa" ? catalog.sites
    : world === "rooms" ? catalog.places
      : catalog.places?.filter((place) => place.world === world);
  const fetchedAt = catalog.fetchedAt || catalog.generatedAt;
  const fetchedMs = Date.parse(fetchedAt);
  if (!Array.isArray(entries) || !entries.length || !Number.isFinite(fetchedMs) || fetchedMs > now.getTime()) {
    throw new Error(`${world}: missing entries or invalid snapshot timestamp`);
  }
  const ids = entries.map((entry) => world === "spa" ? entry.id : entry.supplierId);
  if (ids.some((id) => !Number.isSafeInteger(id) || id <= 0) || new Set(ids).size !== ids.length) {
    throw new Error(`${world}: missing or duplicate supplier IDs`);
  }
  const withImages = entries.filter((entry) => world === "spa" ? Boolean(entry.image) : entry.images?.length > 0).length;
  const withPrices = world === "spa"
    ? entries.filter((site) => site.packages?.some((pack) => pack.price > 0)).length
    : world === "rooms"
      ? entries.filter((place) => place.rooms?.some((room) => room.rates?.some((rate) => rate.weekday || rate.weekend))).length
      : null;
  return {
    world,
    source: catalog.source || "spaplus-api",
    fetchedAt,
    ageHours: Math.round(((now.getTime() - fetchedMs) / 3_600_000) * 10) / 10,
    count: entries.length,
    withImages,
    withPrices,
    ids: ids.sort((a, b) => a - b),
  };
}

export async function readBaseline(now = new Date()) {
  const catalogs = new Map();
  for (const [world, path] of Object.entries(paths)) {
    if (!catalogs.has(path)) catalogs.set(path, JSON.parse(await readFile(new URL(path, import.meta.url), "utf8")));
  }
  return Object.entries(paths).map(([world, path]) => summarizeWorld(world, catalogs.get(path), now));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const baseline = await readBaseline();
    process.stdout.write(`${JSON.stringify(baseline.map(({ ids, ...summary }) => summary), null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
