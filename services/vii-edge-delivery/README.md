# VII public edge delivery

Live at `https://vii.spaplus.co` as an additional public-delivery layer. The application remains the existing Sites project with its existing D1, environment32, domains, roles and data. This worker is not the transactional authority.

Verified 2026-11-05: application v803, source `03e543e427b37369ef45f4b8b78abeadbd8b9a0a`, public build `23d09ac6-01b9-472b-8e95-2e3039c2ca8f`. The proven binding before the warming change is edge source `c92b77ea`, worker version `70873de6-31b1-48ef-a0b2-7aeff1c25761`, namespace `v9`. Route verification retained all21 unrelated routes and confirmed quota fail-open. The current v10 warming source requires its own deployment receipt before being described as live.

Only `vii.spaplus.co/*` is attached in zone `spaplus.co`. The existing VII CNAME still points to `custom-domains.chatgpt.site`, with proxy enabled. The other21 routes were compared and retained. No DNS value, other DNS record, SSL setting, billing plan, account permission or application data was changed.

## Privacy and request semantics

Public HTML and public RSC are fetched as anonymous representations. Only documented Cloudflare infrastructure cookies can reach those upstream reads. The three actual VII login-cookie names are discarded from public upstream requests, and arbitrary identity headers are not forwarded. Account state is loaded by the existing client provider and uncached APIs. Unknown cookies still bypass. Private paths, API, account, admin, booking, POST and server actions retain their original method, body, Origin and credentials and never enter the shared cache.

Production forwarding preserves the public origin. `workers.dev` probes use the verified Site alias. Both forwarding paths preserve original301 redirects with `redirect: manual`. Locale and framework routing variants have separate keys and RSC keeps its MIME. Admission rejects unknown Set-Cookie, private/no-store policy, unsupported Vary, wrong build, expired/missing origin expiry, non200 and oversized bodies. No price or availability decision is promoted from this cache into booking authority.

A public read-only GET which receives a transient5xx or non-abort network failure gets exactly one changed retry with no-cache and without conditional headers. All query intent is retained. Dated party fields children/rooms affect the eligibility decision only; they are never removed from the upstream URL. Private/API/action/POST traffic never retries here, and a second failure is returned. Explicit cancellation never retries.

## Required release procedure

The release alignment tool is the only supported way to change the Edge build binding. It updates the runtime constant and Wrangler configuration together, rejects an already-divergent source, and fails public verification when any representative route reports a different build, `build_mismatch`, a non-HIT warm response or a warm-header budget breach.

```powershell
node services/vii-edge-delivery/scripts/release-alignment.mjs --source-only
node services/vii-edge-delivery/scripts/release-alignment.mjs --suspend pending-vNEXT-UNIQUE
# Publish the exact approved managed Site and read its public X-VII-App-Build.
node services/vii-edge-delivery/scripts/release-alignment.mjs --bind ACTUAL-PUBLIC-BUILD-UUID
node --test services/vii-edge-delivery/test/*.test.mjs
pnpm --dir services/vii-edge-delivery exec wrangler deploy
node services/vii-edge-delivery/scripts/release-alignment.mjs --verify-public
```

Never edit only one expected-build definition and never deploy the final worker without the last command passing. A suspended worker is a deliberate fail-open state, not a completed release.

1. Before a new main Site deployment, suspend old edge cache admission by setting its expected build to a unique pending release sentinel. This avoids serving older HTML while the new assets change. Do not reuse the previous build identifier for a new release.
2. Publish the exact approved cumulative main source, wait for terminal status, then observe the actual public build using a fresh unique public `release` query. Update EXPECTED_BUILD in source and configuration to that exact observed ID.
3. Run `node --test services/vii-edge-delivery/test/*.test.mjs`, deploy this exact worker source once, and wait for its terminal result. The route in wrangler.toml is intentionally limited to VII. A supported worker redeploy can replace its own route ID.
4. Run the route guard. Wrangler does not retain the quota fail-open flag automatically. The cache-only worker must bypass to the existing origin at quota exhaustion rather than turn the application into a1027 page:

```powershell
python services/vii-edge-delivery/scripts/verify_public_route.py --repair-fail-open --receipt .qa-output/NEW-UNIQUE-route-receipt.json
```

The guard repairs only the exact existing VII route flag, records before writing, compares all unrelated routes, never creates/deletes a route and never writes DNS. An uncertain write is not retried. Its default invocation is read-only. Public verification uses the project's working Node HTTP path, since the host's urllib proxy route can fail before origin.

5. Verify a cold and warm public response with real infrastructure cookies and recognized login cookies, correct build and MIME, no identity leakage, original301/query intent, uncached quote/API and a real authenticated admin read. Record HTTP timings as HTTP samples, never field P75 or complete browser page load.

Rollback requires coordinated artifact identities. Suspend edge admission first, restore the approved Site version with environment32, observe its actual build, then rebind edge to that build. For an edge-only failure, remove only the owned VII route and restore only VII's proxy setting to DNS only, keeping the same CNAME and TTL. Never modify other routes or records.

## Verification

29 actual handler/source tests cover privacy, signed-in public shells, mixed cookies, Origin/body/action retention, cache expiry/build isolation, cache failure, RSC variants, redirects, bounded public recovery and cancellation. Internal retention follows the original hard expiry, while client freshness remains capped. Aging HITs queue the same admission path without delaying the client, with coalescing, a two-request cap, a30-second cooldown and a15-second abort. Refresh metadata is removed from client responses. Failed refreshes never extend the old expiry.

For an intentional admission suspension, pass `--suspended-origin-build ACTUAL_CURRENT_BUILD` to the route guard while configuration contains the unique pending sentinel. This validates the expected `build_mismatch` bypass rather than incorrectly requiring a normal MISS at this stage. A normal final binding still requires the new exact build and MISS.

## Bounded public warming

The installed two-minute Cron keeps eight fixed anonymous HTML shells warm through the same admission path visitors use. Reads are sequential, each has a10-second deadline and the pass stops after two origin MISSes, the first rejection or30seconds. This makes ordinary steady-state HIT maintenance cheap while preventing a cache outage or build mismatch from recreating the former66-document origin fan-out. The start route rotates every cycle. Holiday/discovery snapshots retain their separate ten-minute sub-cadence. APIs, accounts, admin, checkout and dated search are excluded, and a pending build suspends all warming.

Known ordinary browser HTML Accept headers share the same cache identity; unknown content negotiation and every RSC framework variant remain separate. Four actual tests cover warming, variant identity, failure isolation and cancellation in addition to the29 existing handler tests.

Cloudflare Cache API entries belong to the executing data center. A successful Cron run does not prove every visitor location is warm. Verify the real public response and timings separately. Cron configuration can take up to15minutes to propagate, and history can lag30minutes. Official references: https://developers.cloudflare.com/workers/configuration/cron-triggers/ and https://developers.cloudflare.com/workers/runtime-apis/handlers/scheduled/ . No catalog synchronization or transactional authority is moved into this trigger.
