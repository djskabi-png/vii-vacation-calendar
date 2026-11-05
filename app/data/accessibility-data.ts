export const VERIFIED_ACCESSIBILITY_FEATURE = "נגישות לנכים";
export const VERIFIED_ACCESSIBILITY_FEATURE_ALIASES = [
  VERIFIED_ACCESSIBILITY_FEATURE,
  "נגישות מלאה לנכים",
  "נגיש לנכים",
  "מקום נגיש לנכים",
] as const;

export type PlaceAccessibility = {
  status: "accessible";
  label: string;
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

export function getPlaceAccessibility(features: readonly string[] | null | undefined, source?: {
  filterIds?: readonly string[];
  featureGroups?: readonly { items: readonly string[] }[];
}): PlaceAccessibility | null {
  const structured = source?.featureGroups?.flatMap(group => group.items) || [];
  const qualified = [...new Set([...structured, ...(features || [])].filter(label => /^נגישות לנכים\s+-\s+.+/u.test(normalizeFeature(label))))];
  const verified = Array.isArray(source?.filterIds) ? source.filterIds.includes("accessible")
    : hasVerifiedAccessibilityFeature([...(features || []), ...structured]) || qualified.length > 0;
  if (!verified) return null;

  return {
    status: "accessible",
    label: qualified[0] || VERIFIED_ACCESSIBILITY_FEATURE,
    summary: "המאפיין נגישות לנכים מופיע בנתוני המקום.",
    arrangements: qualified,
    sourceLabel: "מקור האימות: מאפייני המקום",
  };
}
