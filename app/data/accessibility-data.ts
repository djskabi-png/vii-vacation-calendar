export const VERIFIED_ACCESSIBILITY_FEATURE = "נגישות לנכים";

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
  const expected = normalizeFeature(VERIFIED_ACCESSIBILITY_FEATURE);
  return Boolean(features?.some((feature) => normalizeFeature(feature) === expected));
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
