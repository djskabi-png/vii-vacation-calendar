export const VERIFIED_ACCESSIBILITY_FEATURE = "נגישות לנכים";
export const VERIFIED_ACCESSIBILITY_FEATURE_ALIASES = [
  VERIFIED_ACCESSIBILITY_FEATURE,
  "נגישות מלאה לנכים",
] as const;

export type PlaceAccessibility = {
  status: "accessible";
  summary: string;
  arrangements: string[];
  sourceLabel: string;
};

function normalizeFeature(feature: string) {
  return feature.normalize("NFKC").trim().replace(/\s+/g, " ");
}

export function hasVerifiedAccessibilityFeature(features: readonly string[] | null | undefined): boolean {
  const verified = new Set(VERIFIED_ACCESSIBILITY_FEATURE_ALIASES.map(normalizeFeature));
  return Boolean(features?.some((feature) => verified.has(normalizeFeature(feature))));
}

export function getPlaceAccessibility(features: readonly string[] | null | undefined): PlaceAccessibility | null {
  if (!hasVerifiedAccessibilityFeature(features)) return null;

  return {
    status: "accessible",
    summary: "המאפיין נגישות לנכים מופיע בנתוני המקום.",
    arrangements: [],
    sourceLabel: "מקור האימות: מאפייני המקום",
  };
}
