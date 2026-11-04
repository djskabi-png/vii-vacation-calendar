# Speed implementation: exact truth and release gates

Requested outcome: fast discovery and navigation across VII without removing businesses, units, galleries, content, filters or authoritative booking checks. Cloudflare remains approved. Airbnb is the product ambition, not a measured benchmark or equivalence claim.

## Measured mechanisms

- Prior public four-path HTML sample: TTFB3.4to6.9seconds; repeat R2hits2.4to4seconds. Fresh investigation observed R2reads364to613ms while TTFB3.12to7.45seconds. This disproves an R2-only explanation. Small samples through the test station are not Israeli field percentiles.
- The Worker eagerly imported the app router, scheduler work, translation dictionaries and catalog dependencies before checking its public response cache. Moving the application and background jobs behind their actual use produced real dynamic chunks in the first compiled artifact.
- A further source dependency walk found6,654,130bytes across58local static dependencies. Moving unchanged localization helpers/dictionaries behind the non-Hebrew origin-HTML branch reduced this to314,546bytes/14modules. Source bytes are not runtime memory or public latency; the final compiled graph and public measurements must verify the effect.
- New-tab intent previously warmed both Flight and a complete HTML document. It now warms the document only; same-tab intent uses the router only. Document speculation is capped at2active plus6queued, deduplicated for60seconds, bounded to8seconds and2MiB of streamed bytes, and cancelled on disposal. Private/API/booking paths remain excluded; slow connections/saveData behavior is retained.
- An attempted lazy raw-JSON detail import was rejected: the bundler emitted a missing runtime path. Catalog/detail/home-deal source edits were reverted to the verified baseline. The application boundary already defers that data until an origin request needs the app. Existing detail merge, fallback and accepted removals remain unchanged. A compiled literal-import gate now rejects missing static or dynamic paths.

## Preservation evidence

Actual tests execute the worker request function with controlled dependency loaders, not a mirrored implementation: a HIT initializes no app loader; concurrent MISS requests share one loader; import failure does not retry internally and can recover on a later explicit request; private cookies bypass public lookup; locale and Flight metadata are retained.

Actual catalog/detail/review tests preserve accepted generation, removal, bundle fallback, gallery ownership and review ordering. Actual navigation tests execute the component's anchor handler and scheduler, including new-tab vs same-tab, repeated intent, concurrency, timeout, cancellation and excluded routes.

The compiled startup graph now has a1MiB build budget. The checker follows every static local import/reexport and ignores true dynamic dependencies. A positive fixture accepts a small entry with a large lazy dependency; a negative fixture rejects that dependency when made static. This is a regression guard, not a guarantee about every performance characteristic.

## Validation incident and corrected procedure

The first build and full suite were incorrectly run together. Several tests read the compiled artifact while the builder replaced it, and asset pruning raced with artifact checks. The build's compilation stages completed, but postprocessing failed on a missing file; the full invocation reported1939pass/64fail/7cancelled/1skip. These are not release-ready results and are not relabelled as a green suite. Local D1 timeouts were also observed under this busy host.

Final procedure: freeze production source, run an isolated full build and startup gate, then run tests against the immutable completed artifact. Only causally discriminated retries are allowed. Exact-source remote build remains mandatory before publication; one saved version and one deployment with v798rollback and environment32 preserved.

## Remaining gates

Final compiled graph, completed isolated build, final runtime tests, cumulative protected-source integrity, independent review and exact public desktop/mobile journeys are pending. No claim that this release is already public is made by this document.

The whole-site field targets remain LCP≤2.5s, INP≤200ms, CLS≤0.1 at the defined field percentiles, warm public TTFB≤500msP95 from Israel, and prepared navigation≤300ms for suitable local data paths. They require a comparable field baseline, not extrapolation from one station. Cold renders, supplier failure recovery, image transforms, scheduler execution, memory profiling and48to72hour release observation remain explicit workstreams until verified.

## Additional architecture improvement considered

Cloudflare documents a cache before Worker execution, separate from the per-data-center Cache API. It could remove Worker startup cost from a public HIT. It is not enabled here: managed Site support, build invalidation, all cookie/session exclusions and existing routing variants must first be demonstrated. Turning it on without an authenticated-request design could defeat the current fail-closed policy. A gateway dedicated to eligible anonymous discovery is a candidate if post-release measurements still show hosting overhead. No DNS, binding, paid plan or infrastructure migration was changed.

Official references inspected4November2026: [Workers Cache](https://developers.cloudflare.com/workers/cache/), [Cache API](https://developers.cloudflare.com/workers/runtime-apis/cache/), [Next prefetching](https://github.com/vercel/next.js/blob/canary/docs/01-app/02-guides/optimizing-prefetching.mdx). These support architecture choices; they do not establish which features are enabled on VII.

## Final local validation and isolated image delivery

The second isolated full suite reported 2015 passed,13 failed,1 skipped. Three failures were source-location checks after moving localization; ten exposed the missing bundled JSON runtime path. Those source edits were reverted, and localization checks now follow the unchanged helper into its new module. No rendered outcome assertions were weakened.

The final isolated build passed with300585bytes across3static modules, including the <=1MiB compiled static startup budget and all literal imports across268server modules. The following immutable-artifact suite reported2039passed,1failed,1skipped of2041tests. Its only failure was the gallery component test harness resolving a new local child import through Node instead of its existing dependency injection. The harness now injects that child without changing displayed-image/index/open assertions. A final verification run is required.

Isolated public service https://vii-public-images.djskabi.workers.dev uses native Cloudflare Images. Original JPEG130680bytes at1027x678 became WebP66270bytes at640x422, with different verified hashes and correct MIME. No upscaling; fullscreen originals remain intact. Latest deployed service version2edfd8ed-b124-4e58-98ec-638671ee727e serves the exact original immediately on cold cache and warms the native variant with waitUntil. Native cold synchronous encoding was measured slower and is not on the visitor critical path. Cache HIT returns the transformed image. Per-isolate admission limits are not a global billing ceiling. No paid plan, DNS, authentication, D1/R2 data or existing Site bindings were changed. Main Site integration remains pending publication.

Public-surface scope: existing public photos and same Cloudflare provider only; no new personal fields, cookies, refunds, terms, forms, consent, bookings or delivery. Image identity/rights unchanged; no generated media. Existing alt/button labels and original404behavior preserved. CORS is for already-public media only. No legal accessibility compliance or whole-platform readiness claim is made.

Independent checker approved the scoped main performance diff and isolated Images service. Browser fetch is expected to honor AbortSignal for the navigation concurrency bound; a non-cooperative injected operation can outlive its scheduler slot. This assumption is documented, not a universal task concurrency guarantee. Latest native1600requested variant retained source dimensions1027x678 (no upscaling), but q88 output158320bytes is larger than original130680bytes. The640variant reduction does not establish a reduction for every high-quality variant. Latest actual async HIT returned200WebP in571ms atDUS; cold302timings includedstation/POPstartup and are not fieldpercentiles.

Final full isolated immutable-artifact invocation completed:2041total,2040passed,0failed,0cancelled,1skipped,293152ms. Exact source9c1600f64d87ef20c31b7e1f3593bbdf2026ce5c,tree074a5d10c54b4dfbe1ee0f3394ed5415fd9e58ef pushed and fetched explicitly. Protected gate8ancestors/15capabilities passed. Main v799 publication has NOT been attempted: CUA stopped the entire turn on Windows URL safety verification before mobile QA. Direct Sites connector returned project_not_found, confirming wrong workspace. Main remains v798 at last verified read. Prepared receipt v799.json is pending, not a deployment. Public after measurements and actual deployed mobile/gallery journeys remain NOT VERIFIED.
