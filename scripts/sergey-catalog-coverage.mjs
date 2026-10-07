export function assertCatalogCoverage(previous, incoming) {
  for (const world of ["vacations", "events"]) {
    const before = previous[world];
    const after = incoming[world];
    if (!Number.isSafeInteger(before) || before < 1 || !Number.isSafeInteger(after) || after < 0) {
      throw new Error(`${world}: invalid catalog coverage`);
    }
    if (after < Math.ceil(before * 0.8)) {
      throw new Error(`${world}: active supplier coverage collapsed from ${before} to ${after}; import stopped`);
    }
  }
}
