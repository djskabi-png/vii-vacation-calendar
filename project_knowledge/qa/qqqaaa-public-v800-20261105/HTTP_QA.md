# QQQAAA public HTTP audit

Date: 2026-11-05
Target: `https://vii.spaplus.co`
Scope: bounded read-only public HTTP checks. This is not browser LCP/CLS evidence.

## Observed

- `/`, `/en`, `/ru`, `/fr`, `/events`, `/spas`, `/hourly`, `/attractions`, `/trails` and `/business?id=vacation-74` returned HTTP 200.
- `/this-route-does-not-exist` returned HTTP 404.
- `/sitemap.xml` and `/robots.txt` returned HTTP 200.
- `/api/vii/home-holidays` returned six current holiday records, including Sigd (`id=114`).
- `/api/vii/home-holiday-deals?id=114&proof=verified-offers-v1&part=all&guests=2` returned HTTP 200, `availabilityStatus: verified`, a checked timestamp and populated deals.

## Policy clarification and HTTP findings

The public HTTP response sends `X-Robots-Tag: noindex` on the temporary `vii.spaplus.co` host by deliberate worker policy. The current source identifies `www.vii.co.il` as the primary SEO origin and applies `noindex` to the temporary origin. This is therefore not classified as a code defect, but primary-host SEO still requires a separate public check after cutover.

The 404 also carries `X-Robots-Tag: noindex`, which is expected for not-found pages. `robots.txt` on the temporary host allows `/` and points to the temporary sitemap, while disallowing private operational paths.

With `Accept: text/html`, the eight representative public routes returned the expected build `905d5f64-da48-41ed-a232-1ef715e320bc`. First requests were `X-VII-Edge-Delivery: MISS`; immediate second requests were `HIT`, with public cache headers and no private cookie forwarding. The search sample returned a deliberate 301 and was not admitted to cache.

## Limits

- Requests were intentionally gentle and read-only. No booking, payment, lead, message, admin mutation, catalog refresh or privileged action was attempted.
- Browser LCP/CLS, visual responsive behavior, screen-reader behavior and real-device P75 are outside this HTTP-only receipt.
- Some earlier Node fetch attempts timed out while curl reached the public edge; this is recorded as transport instability, not converted into a site-wide latency claim.

## Verdict

HTTP route availability, edge cold/warm behavior and holiday API behavior were observed. The temporary-host noindex is policy-consistent. Public SEO remains **pending primary-host verification**, not failed on this temporary host.

