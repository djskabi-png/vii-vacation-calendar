export type LegacyAvailabilitySource = {
  slug: string;
  siteId: string;
  sourceUrl: string;
};

// These identifiers were verified against the matching VII legacy property pages.
// A listing may only use this source when the old site still returns a dated quote.
export const legacyAvailabilitySources: Record<string, LegacyAvailabilitySource> = {
  "hilat-hanof": { slug: "hilat-hanof", siteId: "11", sourceUrl: "https://www.vii.co.il/hilat_hanof" },
  "vacation-vila-harel": { slug: "vacation-vila-harel", siteId: "2229", sourceUrl: "https://www.vii.co.il/vila_harel" },
  "vacation-villa-esem-harimon": { slug: "vacation-villa-esem-harimon", siteId: "296", sourceUrl: "https://www.vii.co.il/villa_esem_harimon" },
  "vacation-gesthouse-royal": { slug: "vacation-gesthouse-royal", siteId: "1406", sourceUrl: "https://www.vii.co.il/gesthouse_royal" },
  "vacation-villa-yotam": { slug: "vacation-villa-yotam", siteId: "470", sourceUrl: "https://www.vii.co.il/villa_yotam" },
  "vacation-villa-circle": { slug: "vacation-villa-circle", siteId: "1772", sourceUrl: "https://www.vii.co.il/Villa_Circle" },
};

export function legacyAvailabilitySourceFor(slug: string) {
  return legacyAvailabilitySources[slug] || null;
}
