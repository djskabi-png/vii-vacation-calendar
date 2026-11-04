# V800 performance evidence and safe next step

Date: 2026-11-04

## Observed baseline

The bounded anonymous HTML measurements in `VII_SPEED_BASELINE_20261104.json` recorded first-request TTFB of 3.41s for `/`, 6.90s for `/search`, 5.07s for `/events`, and 3.67s for `/business?id=vacation-164`. The repeat requests were R2 hits with TTFB of 2.44s, 2.47s, 2.47s and 4.03s. This is a single FRA station and is not a field percentile.

The repeat response exposed `X-VII-Cache-Read-Ms` values of about 544 to 555ms for `/` and `/search`. Therefore R2 read time is material, but does not explain the full 2.4 to 4.0s response time. No TTL increase or privacy relaxation is justified by these measurements.

## Actual request chain

The current Worker entry is `worker/index.ts`:

1. `worker/index.ts` performs only small request-bound imports before the cache decision. The application router is a true dynamic import at `appHandler()` (the `vinext/server/app-router-entry` import).
2. Legacy and managed redirects run before public cache lookup. Managed redirect lookup is only considered for paths accepted by `shouldCheckRedirect`, so current public routes do not pay that D1 lookup.
3. `publicCachePolicy()` and then `readPublicCache()` in `worker/public-response-cache.ts` try memory, Cloudflare Cache API with a 50ms budget, and R2 with a 750ms budget.
4. On a miss, the Worker invokes the dynamic app router. The response is then transformed for canonical/locale output and queued for cache storage using `ctx.waitUntil()`.
5. Scheduled catalog, quality, capability and map work is already dynamically imported only from `scheduled()` and is not part of ordinary HTML requests.

## Startup and source evidence

The saved startup audit found the earlier 6,654,130-byte, 58-module static graph was reduced to 314,546 bytes across 14 modules by deferring localized HTML helpers. The compiled startup budget is 1MiB and is guarded by `scripts/verify-worker-startup-budget.mjs`. This is a source/build guard, not a latency guarantee.

## Cloudflare feasibility check

`pnpm exec wrangler whoami` succeeded with the existing OAuth account `45b2f6dcf2cfe44204d2c470cbe682d9`; the token reports `zone (read)` and Worker route/script write scopes. The official Cloudflare API lookup for `spaplus.co` succeeded and identified active zone `f1d778343394ef4f56bbcb089793a22a`, plan `Free Website`. The zone route listing succeeded, but contains no `vii.spaplus.co/*` route. It contains `spaplus.co/assets/*`, `spaplus.co/ca/*`, `app.spaplus.co/*` and other unrelated VII subdomain routes. The zone settings and DNS-record API calls returned authorization errors despite the OAuth scope report, so Cache Rules, DNS target and Site/Pages ownership remain unverified. No DNS, route, zone rule, binding, or paid resource was changed.

## Safe next implementation

The next causal experiment should be a Cloudflare edge cache in front of only anonymous, eligible HTML/RSC discovery responses, with the existing Worker policy as the source of truth for exclusions. The current route inventory does not show a route for `vii.spaplus.co`, so this cannot safely be implemented as a Worker route on the inspected zone yet. It must first be staged on the actual Site/Pages/gateway that owns `vii.spaplus.co`, then measured with the same four paths and private-cookie/transactional adversarial requests. A production rule must not be enabled until exact ownership, invalidation on build ID, query/header variant identity, and private-request bypass are verified.

No source change is warranted in this checkpoint: the remaining delay is primarily Worker/edge startup and storage-path latency, and changing application data loaders without a discriminating trace risks content loss or stale/private responses.
