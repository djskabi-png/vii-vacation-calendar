export type AccessibilityStatus = "accessible" | "partially_accessible" | "not_accessible" | "unknown";

export type PlaceAccessibility = {
  status: AccessibilityStatus;
  summary: string;
  arrangements: string[];
  sourceLabel: string;
  verifiedAt?: string;
};

const informationNotProvided: PlaceAccessibility = {
  status: "unknown",
  summary: "טרם התקבל מבעל המקום מידע מאומת שמאפשר לקבוע אם המקום נגיש.",
  arrangements: [],
  sourceLabel: "המידע ממתין לאימות מול בעל המקום",
};

export const listingAccessibility: Record<string, PlaceAccessibility> = Object.fromEntries([
  "aqua-resort", "kesem-harimon", "ahuzat-or", "ar-suites", "sol-gilgal", "magic-garden-gefen", "anael-estate", "perfumes-villa", "rose-estate",
  "party-time", "black-loft", "sani-loft", "360-events", "loft-117", "fiesta", "details-events", "star-loft", "puzzle-club", "paphos-events",
].map((slug) => [slug, informationNotProvided]));

export function getPlaceAccessibility(slug: string): PlaceAccessibility {
  return listingAccessibility[slug] || informationNotProvided;
}

export const accessibilityLabels: Record<AccessibilityStatus, string> = {
  accessible: "נגישות מאומתת",
  partially_accessible: "נגישות חלקית",
  not_accessible: "המקום אינו נגיש",
  unknown: "מידע הנגישות טרם אומת",
};
