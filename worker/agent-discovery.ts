/** Public, read-only discovery documentation. This grants no tool or account access. */
export function agentDiscoveryManifest(origin: string) {
  const publisher = new URL(origin).hostname;
  return {
    entries: [{
      "@context": "https://agenticresourcediscovery.org/context/v1",
      identifier: `urn:air:${publisher}:guide:place-discovery`,
      displayName: "VII public place discovery",
      type: 'text/markdown; profile="urn:air:agent-skills"',
      url: `${origin}/agent-guide.md`,
      description: "Read-only guidance for discovering places and reading current supplier availability on VII.",
      representativeQueries: ["Find a vacation place in Israel", "Check the published availability of a place on VII"],
      capabilities: ["PublicPlaceDiscovery", "PublicAvailabilityReading"],
    }],
  };
}

const guide = `---
name: vii-public-place-discovery
description: Find places on VII and read their current published information without making a booking or sending an enquiry.
---

# VII public place discovery

Choose the relevant world: /vacations, /events, /spas or /hourly.
Use the visible search controls to select a region, dates and party size.
Keep these selections when opening a result and its unit galleries.
Read the place and unit information separately. Do not substitute one unit's photographs or amenities for another.
Read availability for the selected dates and party. A missing price or a failed request does not establish that a place is unavailable.
Confirm a current price and availability in the booking flow before representing an offer as bookable.
Phone and WhatsApp actions are contact handoffs, not completed bookings or sent messages.
This guide provides public browsing instructions only. It exposes no private API, account permission or autonomous purchase capability.
`;

export function serveAgentDiscovery(request: Request, origin: string, build: string) {
  const path = new URL(request.url).pathname;
  if (path !== "/.well-known/ard.json" && path !== "/agent-guide.md") return null;
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response(null, { status: 405, headers: { Allow: "GET, HEAD" } });
  }
  const manifest = path === "/.well-known/ard.json";
  return new Response(request.method === "HEAD" ? null : manifest ? JSON.stringify(agentDiscoveryManifest(origin)) : guide, {
    headers: {
      "Content-Type": manifest ? "application/json; charset=utf-8" : "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=300",
      "X-Content-Type-Options": "nosniff",
      "X-VII-App-Build": build,
    },
  });
}
