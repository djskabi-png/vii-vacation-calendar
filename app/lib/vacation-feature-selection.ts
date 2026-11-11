/** The URL has two historical representations of accessibility. Keep one
 * selection so the quick chip, drawer, count and removal action agree. */
export function vacationFeatureSelection(params: URLSearchParams) {
  const features = [...new Set((params.get("features") || "").split(",").filter(Boolean))];
  // The party chooser stores the number of pets in its own URL field. Treat a
  // positive value as the canonical pet feature too, so the search results,
  // active chip, filter drawer and reset action all describe the same query.
  const pets = Number(params.get("pets"));
  if (Number.isFinite(pets) && pets > 0 && !features.includes("pets")) features.push("pets");
  return {
    accessibleOnly: params.get("accessible") === "1" || features.includes("accessible"),
    extras: features.filter(id => id !== "accessible"),
  };
}
