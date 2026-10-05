# VII supplier staging audit

Checked on 5 October 2026 against the authenticated live Sergey VII API. This is staging evidence, not a public release or proof of Max booking access.

## Staged source

- The importer `scripts/stage-sergey-vii-catalog.mjs` read both world lists, the location lookup, and every active detail record with six concurrent read-only requests and no automatic retries.
- The complete run passed: 585 active VACATIONS and 132 active EVENTS, 717 distinct world-scoped supplier IDs and 717 detail records. Every accepted record had a usable supplier gallery image, a city, coordinates and at least one room. The run took 24 seconds.
- Raw source payloads and the list/lookup responses were retained in `tmp/vii-sergey-stage-20261005/raw.json.gz` (1,806,872 bytes). The normalized discovery index is in `tmp/vii-sergey-stage-20261005/catalog.json`; `manifest.json` records the raw SHA-256 hash and counts. The token is in none of these files.
- 27 active detail names differ from their list names. The normalized index preserves both names rather than silently choosing one for search.
- 12 active records lack a supplier SEO title or description. VII editorial metadata is required before publication.

## Existing site mapping

- All 15 existing verified event entries matched an active supplier record by their original source URL.
- Twelve of 15 existing verified vacation entries matched an active supplier record by their original source URL. The source URLs for `vacation-tepers-estate`, `vacation-aqua-sol-dreamy-rent`, and `vacation-ahuzat-shaked` do not appear anywhere in the current vacation list, active or inactive. These pages must not be removed, merged or claimed API-backed without a supplier/business decision.
- Seven of the nine active hand-authored vacation entries have exact supplier-name matches. The remaining two have unique supplier aliases: `aqua-resort` to supplier ID 2566 and `sol-gilgal` to supplier ID 871. Their IDs require a final human-approved mapping, not name-only automatic publication.
- Six of the nine active hand-authored event entries have exact supplier-name matches. The remaining three have plausible unique supplier aliases: `black-loft` to 287, `fiesta` to 1978 and `details-events` to 2239. These also require a final mapping check. The inactive local entries were not treated as publication candidates.

## Capability and contract gaps

| World | Active | `has_prices` flag | `has_availability` flag |
| --- | ---: | ---: | ---: |
| VACATIONS | 585 | 161 | 214 |
| EVENTS | 132 | 22 | 34 |

These are supplier capability flags, not verified final prices or availability. The current list/detail API has not established a date-specific quote, booking writeback, or review writeback contract. Max's documented partner API has these operations for nightly compounds, but the token Adir forwarded returned HTTP 401 on Max's site 457 endpoint while remaining valid for Sergey's catalog API. Max partner authorization, its allowed site list and ID mapping are still pending. The full frontend guide was stripped from the recipient email and a readable replacement is pending.

## Activation decision

Do not replace current public search and place routes yet. Before doing so, resolve the three missing existing vacations, approve the five alias mappings, preserve existing URLs and VII-owned editorial fields, and verify media rights. Then feed the accepted canonical snapshot into the existing search and detail components, test changes and removals, and test dated quote/booking paths separately. The administration system remains the next phase after this data and transaction flow is verified.

## API-only local candidate

- After Adir explicitly requested supplier-only vacation and event content, `scripts/build-sergey-public-catalog.mjs` converted the authenticated source snapshot into `app/data/sergey-public-catalog.json`. The public `properties` and `eventPlaces` exports now read only this generated supplier catalog in the local checkout. No live domain deployment was made.
- The candidate contains 581 vacation and 130 event places. Six source records were quarantined for missing, swapped or out-of-country coordinates: vacation IDs 927, 1156, 2234 and 2434; event IDs 2148 and 2684. The builder does not guess corrected coordinates.
- The snapshot preserves supplier/world IDs, source URLs, catalog fetch time, name, city, area, image URLs, room count, the maximum reported single-room capacity, description where supplied, reported features, score and phone. It does not publish invented prices, dated availability or booking confirmation. The shared search and detail route probes returned HTTP 200 and displayed supplier names locally. Eight focused tests and a Vinext build passed.
- This is a static imported snapshot, not continuous API synchronization. Each place currently exposes up to 12 supplier gallery images; full gallery loading, the seven missing vacation descriptions, source image rights, taxonomy, old URL mapping and regular refresh remain open.
- The local Vinext production server returned page HTML for CSS asset requests. Vinext development dependency optimization stalled, and a Wrangler local worker accepted a port but did not answer page requests. Therefore responsive visual QA and browser interaction approval were not obtained. The exact public domain remains unchanged.
- The accessible catalog contract does not provide a verified accommodation/event taxonomy, date-specific final price, confirmed availability or booking writeback. Unsupported type and price controls were hidden on the generic local vacation search, and stale homepage deal cards were removed; related legacy landing URLs and content still require a full route-family audit before publication.
