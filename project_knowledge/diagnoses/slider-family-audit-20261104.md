# Slider family audit, 4 November 2026

Status: in progress. No all-world or production completion claim.

## Confirmed source findings

* Vacation last-minute cutoff was repaired in 5cda861d; event presets still always selected tomorrow. Both now use one currentDealDate function with the 14:00 Asia/Jerusalem cutoff.
* Spa state was not scoped to the region and clock that produced its payload. A region switch could keep cards from the previous region. The payload and status are now keyed together; a different context starts empty/loading, while a failed same-context refresh preserves accepted cards.
* Vacation last-good state lacked clock and locale dimensions. Both are now included.
* Vacation, holiday and spa HTTP request URLs now include the same clock identity as the client cache scope.
* Home vacation payloads now reject an unexpected response period.
* canonicalVerifiedSliderItems accepted every item for a zero cap because the loop could never reach length zero after pushing. A zero cap now returns an empty array.
* Holiday audience/period changes now clear the previous context's cards. A failed refresh of the same accepted context keeps the cards without a simultaneous error panel.
* Event normalization, API projection and cards now preserve explicitly confirmed availability with a missing price. Unknown no_prices remains unknown. Priced offers sort before confirmed unpriced offers; no price is invented and existing phone/WhatsApp controls remain available.

## Event availability parity, unresolved

Read-only comparison for Thursday 5 November 2026:

* Old /events/ajax_popularDeals.php returns 12 cards labelled available, most without a price.
* New /api/vii/live-search with guests=20 and includePlaces=true returns two priced offers: 779 and 1085.
* The normal new search endpoint returns 79 entries with reason no_prices and unknown availability. Several of the missing old IDs are in that cohort.
* no_prices does not establish availability. Do not mark unknown entries available or manufacture a price.
* The old endpoint has no guest parameter; parity of guest eligibility is also not established.
* Sites environment lookup for the retained project returned project_not_found in the current connector account. This is a connector route failure, not proof that supplier access is impossible.

Remaining: establish the supplier calendar-only event availability contract, compare all three event presets and guest context, and then carry independently verified unpriced availability through API and cards to phone/WhatsApp actions.

The local code path for independently verified unpriced availability is now implemented and covered by adapter and actual route-handler tests. The production input gap remains unresolved.

## Live parity gate

The new `pnpm qa:event-slider-parity` command is included in QQQAAA as `event-slider-legacy-api-parity`. It runs read-only comparisons for all three presets. Observed result on 4 November:

| Preset | Date | Legacy cards | New API confirmed | Legacy identities unresolved |
| --- | --- | --- | --- | --- |
| Last minute | 2026-11-04 | 12 | 2 | 10 |
| Thursday | 2026-11-05 | 12 | 2 | 10 |
| Friday | 2026-11-06 | 12 | 2 | 11 |

The gate returned nonzero and `not_verified`, as required. Counts do not prove that every old card fits the new 20-guest request. They identify a concrete discrepancy that still needs authoritative reconciliation. A historical audit at `project_knowledge/VII_EVENT_SLIDER_API_PARITY_2026-10-13.md` records the same upstream calendar/search discrepancy and forbids a permanent dependency on the migrating old AJAX endpoint.

## Verification boundaries

The focused slider family suite passed 111 tests before the additional confirmed-unpriced event path, and the affected event/route tests passed afterwards. Full builds succeeded. A first broad suite was invalidated by concurrent build output changes; the subsequent sequential suite found two outdated source-shape expectations, both corrected and independently rerun. Final sequential verification passed 1,964 tests, failed zero and skipped one, recorded in `.qa-output/slider-family-final-tests.log`. An additional 22 QQQAAA, boundary, media and date-context checks passed after adding the live parity gate.

No public deployment and no desktop/mobile browser signoff are claimed by this audit. Static hourly/attraction/trail/provider/review/video rail source guards were exercised; this is not complete live interaction evidence for those worlds.

## Family inventory and required verification

* Vacation: near dates, four weekend periods, region variants, permanent last-minute page.
* Holidays: homepage rail, individual holiday results, audience and period selection.
* Events: national and regional last-minute/Thursday/Friday rails, permanent event last-minute page.
* Spa: national/regional days and audiences, today/tomorrow pages.
* Static discovery: hourly rooms, attractions, trails, providers, editorial, reviews and video rails. They must not claim date-specific availability without proof.
* Shared controls/media: RTL/LTR arrows, bounds, disabled states, resize, streaming, verified business and unit photo identity.

Required before public-ready: focused regression, build, protected baseline, exact browser validation on desktop/mobile, old/new/provider event parity and deployed identity. Source checks alone do not close the remaining parity issue.
