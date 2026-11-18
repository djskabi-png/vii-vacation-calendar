# Kira and Liran reconciliation ledger

Candidate source: `c8cbda44a8f1565d6cbac4b9f07bd249f326e741` plus the uncommitted fixes in `release/v919-final-fixes-20261118`.

This ledger distinguishes implementation evidence from public-release evidence. No production publication is claimed.

## Kira

| ID | Candidate result | Evidence or remaining condition |
|---|---|---|
| KIRA-01 | Verified existing contract | Back, reload, stale-navigation and selection-state regression tests passed. Public end-to-end remains unverified while the current origin returns 500/503. |
| KIRA-02 | Verified existing contract | Map selection, focus, card-marker synchronization, resize and list-return tests passed across the affected map family. |
| KIRA-03 | Improved in candidate | Sitemap work now runs in parallel. Exact public catalog reads are cached and same-build stale data can survive an origin failure. Public performance acceptance requires deployment and cold/warm measurements. |
| KIRA-04 | Fixed in candidate | Only exact anonymous `GET /api/catalog` variants enter shared cache. Auth, cookies, POST, duplicate keys and unknown queries fail closed or bypass. Edge tests passed. |
| KIRA-05 | Fixed in candidate | Sitemap inventory sources execute in parallel and the sitemap response has a versioned 15-minute data cache. Build and sitemap tests passed. |
| KIRA-06 | Candidate localization repaired | Local locale tests pass. The latest public audit could not close this item because repeated public 503 responses replaced the application UI. |
| KIRA-07 | Fixed in candidate | Gallery counts are localized in HE, EN, RU and FR. Original Hebrew business names are explicitly marked as original-source content instead of being mistaken for interface leakage. |
| KIRA-08 | Fixed in candidate | Long Russian SPA audience controls use a bounded mobile horizontal rail without pushing controls offscreen. Visual public confirmation awaits deployment. |
| KIRA-09 | Not authorized | Domain, DNS, TLS and canonical cutover were not requested in this turn. Requires a frozen candidate, rollback identity and a separate publication instruction. |
| KIRA-10 | Decision required before cutover | Temporary-host noindex stays intentional. Final primary-domain crawler and AI-bot policy must be selected and verified only at cutover. |
| KIRA-11 | Not verified | Owner-level version history and matching runtime logs were not available through the current local source. This cannot be inferred from build output. |
| KIRA-12 | Fixed locally | `.gitattributes` now fixes LF text policy and protects binary files. The generated thumbnail manifest was normalized deterministically. The committed candidate is clean and `qa:release-source` passes. |

## Liran

| ID | Candidate result | Evidence or remaining condition |
|---|---|---|
| LIRAN-01 | Partly present, API expansion required | Admin catalog comparison already identifies additions, changes and removals. A final parity report still needs the supplier to return per-identity rejection reasons for date, minimum stay, availability and price. |
| LIRAN-02 | UI contract ready, API gap | The UI preserves a supplied minimum-stay restriction. The bulk API currently omits it for rejected short stays, so the missing Silvester identities cannot yet be classified correctly. |
| LIRAN-03 | Fixed in candidate | Unit-scoped records now pass the same guest-capacity predicate as property-scoped records. Known two-guest units no longer match four guests. Unknown capacity remains unknown rather than invented. |
| LIRAN-04 | Source truth reconciled | Current source has two explicit central no-treatment day packages. Both may be shown; treatment packages may not be broadened into this search. |
| LIRAN-05 | Verified existing contract | Event discovery uses the complete uncapped accepted generation and retains confirmed unpriced venues with contact flow. |
| LIRAN-06 | Verified existing contract | Draft, applied and URL state retention tests passed for filtering, back, reload and fixed semantic routes. |
| LIRAN-07 | Verified existing presentation | Search and result filters have separate semantic and visual regions; mobile contracts prevent a duplicated search action. |
| LIRAN-08 | Verified existing contract | Progressive results have bounded append behavior, stable identities and accessible fallback controls. |
| LIRAN-09 | Verified existing atomic contract | Event seed, generation and result replacement tests prevent count/card generation mixing and temporary false-zero states. |
| LIRAN-10 | Improved in candidate | Exact catalog caching and stale-if-error protect world transitions from origin overload. Public timing acceptance requires deployment. |
| LIRAN-11 | Verified and normalized | Discovery thumbnails are generated at 192px with deterministic hashes and dimensions. The manifest line-ending drift was repaired and the build now passes. |
| LIRAN-12 | Verified existing contract | Place, unit, representative and legacy gallery ownership tests pass without cross-unit borrowing. |
| LIRAN-13 | Verified existing contract | Representative source order and full source membership are retained; compact cards do not import the entire gallery payload. |
| LIRAN-14 | Verified existing contract | Full galleries preserve all valid supplier images and use lazy presentation instead of a ten-image data cap. |
| LIRAN-15 | Known mappings work, upstream contract incomplete | Verified supplier-video tests pass for known records. Events still need a first-class upstream `videos[]` field with identity and verification status instead of legacy inference. |
| LIRAN-16 | Verified with live source data | Enrico event units 4511 and 4512 expose their own name, capacity, media and facts, and the unit projection tests preserve them. |
| LIRAN-17 | Verified with live source data | Enrico unit types are present and retained as explicit supplier identities. |
| LIRAN-18 | Verified existing contract | Feature groups preserve category, place/unit owner and hidden parent search identity without duplicating a unit feature onto the place. |
| LIRAN-19 | Supplier verification still required | VII has the mapping boundary, but a current Rooms VIP source timestamp and a real-place parity fixture were not available in this run. Free-text inference remains prohibited. |
| LIRAN-20 | Verified with live source data | Event feature groups are present for the sample and the shared categorized projection tests pass. |
| LIRAN-21 | Verified existing contract | Expandable text and desktop/mobile layout tests cover long text, real overflow and non-clipped containers. Public 200-percent zoom remains a release visual check. |
| LIRAN-22 | Correct local fallback, supplier failure remains | `vacation-279` live calendar returns upstream 404. The candidate truth model keeps it phone/WhatsApp-only and does not offer online booking. Supplier calendar identity must be repaired. |
| LIRAN-23 | Verified existing contract | Availability completion anchors and focuses the result surface and exposes success, unavailable, timeout and retry states. |
| LIRAN-24 | Structurally verified, reported identity missing | Package ID, audience and price basis stay tied through card, detail and booking tests. The original WhatsApp report did not preserve the exact package identity needed for current live-price parity. |
| LIRAN-25 | UI ready, API gap | Separate night price renders when supplied. The checked Spa House records have no night field, so VII correctly does not invent one. |
| LIRAN-26 | Verified existing contract | Date ranges use an isolated left-to-right value inside localized surrounding text. Typography source audit passed. |
| LIRAN-27 | Verified source contract | Email sharing builds an encoded canonical URL and has a fallback path. Real OS mail-client launch remains a device acceptance check. |
| LIRAN-28 | Verified existing workflow | Long reviews use a bounded safety limit, persist as pending and remain unpublished until moderation. Management queue contracts passed. |
| LIRAN-29 | Fixed locally, delivery service requirement remains | All join worlds now require a valid email and the UI claims delivery only on `emailDelivered=true`. The delivery service must guarantee one idempotent receipt and durable request ID. |

## API work that belongs outside the VII frontend

1. **Bulk vacation availability** for LIRAN-01 and LIRAN-02: return every candidate with `siteId`, `unitId`, requested dates, truth state, rejection reason, `minimumNights` at arrival and price truth. A short requested stay must not erase a place that is available only under a longer minimum.
2. **Vacation calendar identity** for LIRAN-22: repair the supplier mapping for site 279 so calendar lookup no longer returns 404. Until then it remains contact-only.
3. **Rooms VIP night rates** for LIRAN-19 and LIRAN-25: expose a distinct verified night-price field, source timestamp and unit owner. Never derive it from hourly rates.
4. **Supplier videos** for LIRAN-15: expose `videos[]` per place or unit, including stable identity, URL, media type and active/verified state.
5. **Join receipt delivery** for LIRAN-29: create one lead and one receipt under the same idempotency key and return `requestId` plus truthful `emailDelivered`.

## Verification snapshot

- Production build: passed after deterministic manifest normalization.
- Source-integrity gate: passed on the clean committed candidate; this is not publication approval.
- Focused edge cache tests: 48 passed.
- Affected-family regression batches: 173 passed before the full suite.
- Full test suite reached 3,426 tests: 3,422 passed, 3 failed and 1 skipped. Two stale expectation failures were corrected and their focused suites now pass. The remaining browser-worker failure is an unavailable local `@cloudflare/playwright` package, not a public result.
- Public QQQAAA could not pass because the current public origin repeatedly returned 500/503. The run was stopped after the failure mechanism repeated to avoid adding load.
- No public deployment was performed.
