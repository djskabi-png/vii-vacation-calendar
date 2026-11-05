/** The URL has two historical representations of accessibility. Keep one
 * selection so the quick chip, drawer, count and removal action agree. */
export function vacationFeatureSelection(params: URLSearchParams) {
  const features = [...new Set((params.get("features") || "").split(",").filter(Boolean))];
  return {
    accessibleOnly: params.get("accessible") === "1" || features.includes("accessible"),
    extras: features.filter(id => id !== "accessible"),
  };
}
