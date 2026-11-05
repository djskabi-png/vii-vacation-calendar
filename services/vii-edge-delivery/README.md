# VII public edge delivery

Live at `https://vii.spaplus.co` as an additional public-delivery layer. The application remains the existing Sites project with its existing D1, environment32, domains, roles and data. This worker is not the transactional authority.

Verified 2026-11-05: application v800, source `d255fe2636bb60fc3b095537244046949139760d`, public build `905d5f64-da48-41ed-a232-1ef715e320bc`; edge worker version `6bdea555-20b1-40e9-88fc-faab685fe742`, cache namespace `v6`.

Only `vii.spaplus.co/*` is attached in zone `spaplus.co`. The existing VII CNAME still points to `custom-domains.chatgpt.site`, with proxy enabled. The other21 routes were compared and retained. No DNS value, other DNS record, SSL setting, billing plan, account permission or application data was changed.

## Privacy and request semantics

Public HTML and public RSC are fetched as anonymous representations. Only documented Cloudflare infrastructure cookies can reach those upstream reads. The three actual VII login-cookie names are discarded from public upstream requests, and arbitrary identity headers are not forwarded. Account state is loaded by the existing client provider and uncached APIs. Unknown cookies still bypass. Private paths, API, account, admin, booking, POST and server actions retain their original method, body, Origin and credentials and never enter the shared cache.

Production forwarding preserves the public origin. `workers.dev` probes use the verified Site alias. Both forwarding paths preserve original301 redirects with `redirect: manual`. Locale and framework routing variants have separate keys and RSC keeps its MIME. Admission rejects unknown Set-Cookie, private/no-store policy, unsupported Vary, wrong build, expired/missing origin expiry, non200 and oversized bodies. No price or availability decision is promoted from this cache into booking authority.

A public read-only GET which receives a transient5xx or non-abort network failure gets exactly one changed retry with no-cache and without conditional headers. All query intent is retained. Dated party fields children/rooms affect the eligibility decision only; they are never removed from the upstream URL. Private/API/action/POST traffic never retries here, and a second failure is returned. Explicit cancellation never retries.

## Required release procedure

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

24 actual handler/source tests cover privacy, signed-in public shells, mixed cookies, Origin/body/action retention, cache expiry/build isolation, cache failure, RSC variants, redirects, bounded public recovery and cancellation. The public report lives in `project_knowledge/release_evidence/comprehensive-20261105/`.
