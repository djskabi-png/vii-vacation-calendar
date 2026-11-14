/**
 * Availability is a rolling supplier snapshot, not a snapshot for one
 * calendar day. A date-scoped key created a cold cache every afternoon even
 * though the accepted payload already contains the following dates.
 */
export const spaDiscoveryAvailabilityCacheKey = ["spa-discovery-availability", "rolling"] as const;
