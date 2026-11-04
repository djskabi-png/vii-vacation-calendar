# V800 isolated edge delivery experiment

The isolated Worker `vii-edge-delivery` was deployed only to:

`https://vii-edge-delivery.djskabi.workers.dev`

It is not attached to `vii.spaplus.co`, DNS, or any production route. It proxies only the verified Site origin and requires build `85bd2763-e953-4fba-bb88-71f1faafa510` before storing a response. The latest isolated deployment is version `048e217d-65fa-4861-a506-7b21ab3ed429`, cache namespace `v2`.

## Safety checks

- Anonymous HTML discovery responses only.
- Cookies, Authorization, server actions, API paths, admin/account/booking paths and unknown query keys bypass the experiment.
- A cookie request and an unknown-query request both returned `200` from the origin with no edge-delivery header, confirming bypass.
- Eligible cached requests contain no cookies or authorization. Bypass requests retain their ordinary request data when forwarded to the verified origin and are never cached.
- The reviewed version fails closed on unknown `Set-Cookie`, private/no-store cache controls, unsupported `Vary`, missing/expired upstream expiry, build mismatch and responses over 2MiB. It permits only the documented `__cf_bm`, `cf_clearance`, `__cflb` and `_cfuvid` infrastructure names, removes those cookies from the stored copy, and preserves them on the individual MISS response. The cache key includes build ID, URL and routing variants.

## Measurement

The four public routes returned valid `200` responses and the expected build ID in the earlier prototype. The origin cookie was verified as `__cf_bm`, a documented Cloudflare infrastructure cookie. After allowlisted sanitization, `/search` returned the cookie on the first MISS, omitted it on the HIT, and returned `X-VII-Edge-Delivery: HIT`. Two bounded warm requests measured approximately 458ms and 185ms at the test station. This is an isolated workers.dev result, not a production field percentile or approval to attach the Worker to the public domain.

The initial prototype did not demonstrate a warm hit because the origin cookie was treated as uncacheable. The reviewed version demonstrates a warm hit only after the narrowly verified infrastructure-cookie sanitization. No production change was made.

## Next decision

To continue safely, the cache must be tested on the actual Cloudflare Site/gateway that owns `vii.spaplus.co`, or through a Cloudflare-supported cache rule at that owner. The existing route inventory has no `vii.spaplus.co/*` Worker route, and Zone settings/DNS API reads were unauthorized. Production activation is blocked until the owning layer and cache behavior are identified.

## Final isolated sample

The latest four-route sample (`/`, `/search`, `/events`, `/business?id=vacation-164`) returned 200 and the expected origin build. MISS TTFB was 7.06, 5.95, 8.54 and 2.53 seconds; subsequent HIT TTFB was 169, 283, 177 and 105 milliseconds. HIT responses contained no Set-Cookie. These are single-station HTTP observations, not complete browser page loads or field percentiles. Nine runtime tests plus four source guards passed. Additional guards cover duplicate query bypass, locale identity, Cache API failures/timeouts, authoritative expiry and remaining TTL. A new main release requires rebinding EXPECTED_BUILD to the newly observed public build before any main-route activation.
