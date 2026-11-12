import { publicDiscoveryCachePolicy } from "../../shared/public-discovery-cache.ts";

declare const __VII_CACHE_BUILD_ID__: string;

const noStore = { "Cache-Control": "no-store" } as const;

function deployedBuildIdentity() {
  const build = typeof __VII_CACHE_BUILD_ID__ === "string" ? __VII_CACHE_BUILD_ID__ : "";
  return /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(build) ? build : null;
}

/**
 * Grant a short edge-cache lease only to an allow-listed anonymous discovery
 * request. Routes call this solely for a complete verified snapshot; partial,
 * refreshing and error responses stay no-store.
 */
export function verifiedPublicDiscoveryHeaders(request: Request, now = new Date(), build = deployedBuildIdentity()) {
  const policy = publicDiscoveryCachePolicy(request, now);
  if (!policy || !build) return noStore;
  return {
    "Cache-Control": `public, max-age=0, s-maxage=${policy.ttlSeconds}`,
    "X-VII-Cache-Build": build,
    "X-VII-Discovery-Verified": "1",
    "X-VII-Cache-Until": String(policy.expiresAt),
  };
}

