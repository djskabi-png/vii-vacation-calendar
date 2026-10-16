export type ActivityTaxonomyItem = { readonly id: string; readonly location?: string; readonly area?: string; readonly regionKey?: string; readonly features?: readonly string[]; readonly description?: string };

export const activityRegions = ["צפון", "כנרת", "מרכז ותל אביב", "ירושלים", "דרום ונגב", "אילת והסביבה"] as const;
export const activityTypes = ["שטח ואדרנלין", "טבע ורכיבה", "ים ושיט", "מים ומשפחה", "נחלים ומים", "אוכל ותרבות", "מדבר ושטח", "יצירה וקבוצות"] as const;

const explicitTypes: Record<string, (typeof activityTypes)[number]> = {
  "kfar-blum-kayaks": "ים ושיט", "aqua-kef": "מים ומשפחה", "hamat-gader": "מים ומשפחה",
  "haifa-museums": "אוכל ותרבות", "madatech-haifa": "יצירה וקבוצות", "safari-ramat-gan": "טבע ורכיבה",
  "luna-park-tel-aviv": "שטח ואדרנלין", "superland": "שטח ואדרנלין", "steinhardt-museum": "יצירה וקבוצות",
  "tel-aviv-museum": "אוכל ותרבות", "timna-park": "מדבר ושטח", "underwater-observatory": "ים ושיט",
  "dolphin-reef": "ים ושיט", "camel-ranch-eilat": "טבע ורכיבה", "carasso-science-park": "יצירה וקבוצות",
};

export function activityRegion(item: ActivityTaxonomyItem): (typeof activityRegions)[number] | null {
  const value = `${item.area || ""} ${item.location || ""}`;
  if (/כנרת|טבריה/.test(value)) return "כנרת";
  if (/חיפה|כרמל/.test(value)) return "צפון";
  if (/ירושלים|הרי יהודה/.test(value)) return "ירושלים";
  if (/מרכז|תל אביב|רמת גן|ראשון לציון/.test(value)) return "מרכז ותל אביב";
  if (/אילת|הערבה|נגב|באר שבע|דרום/.test(value)) return /אילת|הערבה/.test(value) ? "אילת והסביבה" : "דרום ונגב";
  if (/צפון|גליל|כפר בלום/.test(value)) return "צפון";
  return null;
}

export function activityType(item: ActivityTaxonomyItem): (typeof activityTypes)[number] | null {
  if (explicitTypes[item.id]) return explicitTypes[item.id];
  return (activityTypes as readonly string[]).includes(item.area || "") ? item.area as (typeof activityTypes)[number] : null;
}

export function activityMatchesTopic(item: ActivityTaxonomyItem, params: Readonly<Record<string, string>>) {
  return (!params.area || activityRegion(item) === params.area) && (!params.type || activityType(item) === params.type);
}

export function activityTaxonomy(item: ActivityTaxonomyItem) {
  return { region: activityRegion(item), type: activityType(item) };
}
