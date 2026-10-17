import quarantinedDescriptions from "../data/catalog-description-quarantine.json" with { type: "json" };

export function safeHourlyDescription(place: { id: string; description?: string | null }) {
  // These are source-match records, never public copy or replacement descriptions.
  const quarantined = (quarantinedDescriptions as Record<string, string>)[place.id];
  return quarantined && place.description === quarantined ? "" : place.description || "";
}
