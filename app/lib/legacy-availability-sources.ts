export type LegacyAvailabilitySource = {
  slug: string;
  siteId: string;
  sourceUrl: string;
};

// Compatibility identifiers for six early listings that predate the generic
// supplier-source projection. Runtime availability is fetched exclusively from
// the official Biz calendar/search API; sourceUrl is diagnostic only.
export const legacyAvailabilitySources: Record<string, LegacyAvailabilitySource> = {
  "hilat-hanof": { slug: "hilat-hanof", siteId: "11", sourceUrl: "https://bizonline.co.il/api/ai/vii/vacations/11/calendar" },
  "vacation-vila-harel": { slug: "vacation-vila-harel", siteId: "2229", sourceUrl: "https://bizonline.co.il/api/ai/vii/vacations/2229/calendar" },
  "vacation-villa-esem-harimon": { slug: "vacation-villa-esem-harimon", siteId: "296", sourceUrl: "https://bizonline.co.il/api/ai/vii/vacations/296/calendar" },
  "vacation-gesthouse-royal": { slug: "vacation-gesthouse-royal", siteId: "1406", sourceUrl: "https://bizonline.co.il/api/ai/vii/vacations/1406/calendar" },
  "vacation-villa-yotam": { slug: "vacation-villa-yotam", siteId: "470", sourceUrl: "https://bizonline.co.il/api/ai/vii/vacations/470/calendar" },
  "vacation-villa-circle": { slug: "vacation-villa-circle", siteId: "1772", sourceUrl: "https://bizonline.co.il/api/ai/vii/vacations/1772/calendar" },
};

export function legacyAvailabilitySourceFor(slug: string) {
  return legacyAvailabilitySources[slug] || null;
}
