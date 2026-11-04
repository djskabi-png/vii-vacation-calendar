# Event discovery: inventory independent of price

Status: event inventory and preset-navigation repair verified on publicv796. Whole-site launch readiness is not approved.

## Root cause and primary contract

The current primary supplier guide at https://bizonline.co.il/api/ai/vii/Vii-Frontend.html#ev-search defines `days[].morning/evening.freeUnits`. The cell's `available` flag combines inventory and price. A positive free-unit count can therefore coexist with `available:false`, `reason:no_prices` and no price. The old adapter read only top-level availability, minPrice and cheapest, dropping these real free venues. This explains the observed two priced offers versus twelve legacy cards.

The guide's event calendar and final vacancy contracts are at #ev-calendar and #ev-stay. The earlier inference that no supported price-independent signal existed was incorrect. The old AJAX was checked on two dates and changed venue identities, contradicting a fixed-card-cohort hypothesis. It remains comparison evidence, not a production dependency.

Guest eligibility is already applied by bulk search: below ten guests it does not filter halls; from ten upward maxGuests must be strictly greater than requested guests. Do not reinterpret public display capacity or apply a different >= comparison locally.

## Truth model

| Source evidence | Normalized result | Action |
| --- | --- | --- |
| Positive freeUnits, cell.available=true, valid positive price and roomID | Available with verified quote | Preserve exact venue/date/slot/party/room |
| Positive freeUnits without that verified quote | Available without price | Venue-level phone/WhatsApp; no price or room identity invented |
| All requested slots have zero freeUnits | Unavailable | Exclude from availability discovery |
| Null/missing/invalid freeUnits or no_availability | Unknown | Never label available |
| Conflicting duplicate day identity | Unknown contract failure | Do not choose arbitrary positive data |

Crucially, roomID and price can describe an occupied advertising floor when no priced free room exists. Positive freeUnits alone must not attach that room ID or price to another free room. Search/calendar still require final vacancy confirmation for a whole booking block; this change does not add event checkout or place a booking.

## Cloudflare data and cache design

Reuse the existing durable D1 discovery cache rather than add a second writable source. Each version3 snapshot is keyed by exact date and party size, owns both slots and retains normalized per-slot evidence. Region and requested slot are local projections of one bulk event search. The same loader serves the scheduler and a lease-protected cold recovery; visitors never fan out over venue calendars.

Freshness is five minutes, with accepted stale data bounded to one hour and disclosed in the UI. A stale read goes through the coordinated refresh path. The provider deadline for discovery is eight seconds, with no extra provider retry added. A failed refresh preserves only the same still-valid context; successful empty inventory replaces old availability. Detail/transactional search remains outside discovery caching.

Versioned backend keys and a version marker in browser request identity reject the old two-offer generation. Backend and browser validators check date, party and source-evidence age. The browser rejects cross-region and expired data. Existing cache leases, admission limits, cooldown, payload bounds and last-owner checks remain in place.

The complete matching set is retained through both API and UI. Event-specific deduplication has no editorial20 cap. For more than20 offers the API reads the complete accepted catalog once, because the shared selected-summary reader intentionally limits previews to20. The response records matched and visible cardinalities and missing-public-card exclusions. No private notes are projected.

## Pages and public controls

Preserve /events/last-minute and add /events/thursday and /events/friday, each with its own preset, canonical, title, metadata, content and visible FAQ/schema. All three are linked and included in localized sitemaps and recurring quality checks. Regional discovery links preserve their validated region on the target page. Transactional party/slot filters do not create duplicate indexable pages.

Homepage, event-world and regional rails keep their quick tabs. Full pages expose party and morning/evening controls. Submission applies the complete filter selection. Confirmed unpriced venues retain phone and WhatsApp actions, and card links carry date, slot and party without a made-up room ID.

## Verification contract

Focused tests cover real raw provider day shapes, absent price/room, occupied-floor quotes, zero/null/malformed inventory, exact dates and slots, conflicting days, both-slot retention, wrong party, expired/old-generation snapshots and35-venue API-to-card completeness despite the preview-reader cap. Existing event, region, date-boundary, transactional-cache and landing contracts are expanded rather than removed.

Before public completion: final build and full suite, independent review, one frozen cumulative release, three-preset old/current/API identity comparison, desktop/mobile visible card and contact checks, unique link navigation, full-page slot/party application and exact release provenance. Existing administration/Cloudflare authority and vacation behavior must remain protected.

## Exact public evidence and navigation correction

v795 deployed successfully from973fbf1c9c2a2ca80741d185cfde32620a307e27 with environment32. Public November5 discovery returned36venues,34unpriced; November6 returned35venues,33unpriced. Each contained all12legacy venues and every normalized confirmed source ID, with no public-card exclusions. November4 comparison initially encountered one503; the discriminating serial probe returned source200in4022ms and discovery200in1949ms, then a fresh cache read returned36venues and matched all12legacy IDs. The failure log had21.09s wall time but no cause, so provider timeout is only a hypothesis.

Natural-destination navigation exposed a separate retained-client-state defect: Thursday to Friday changed the heading but still queried Thursday. The route fixedPreset must win immediately over selectedPreset retained in React state, before effects run. The v796 candidate derives date and pagePath from activePreset=fixedPreset||selectedPreset. A harness executes the actual client TSX with retained Thursday/date/party50 state across forward/back preset changes and the14:00 boundary. Final v796 public navigation verification remains required.

Separate platform risk: Sites logs recorded exceededMemory on six requests across starting-prices and public/RSC routes after v795. No allocation cause was exposed; this is not attributed to the event adapter without evidence and prevents a whole-site launch-readiness claim. The Russian Thursday route had one20s probe timeout; a later focused read returned200with Russian title/canonical in7032ms. Platform-wide memory and latency need the separately requested performance investigation.

## Final v796 result

Public deployment appgdep_6aeb1f925d10819197d0b4a6a0b9d2b1 succeeded with source1d56f95d1319c6f49fcd1a76ec2e38c22ea07b0b, manageddf816f755cf8929a2a063f84d1d53702f0100711 and environment32. The retained-state navigation defect is closed in the actual390px browser: Thursday50/25venues/Nov5 to Friday50/24/Nov6, backThursday50/25/Nov5, lastminuteafter14Nov5, thenreload20/36venues. Desktop event rail35Fridaycards advances beyond the first visible cards and links to its uniqueFridaypage. All3presetlinks were observed. UnpricedStarLoftcontactmodalopenedcorrectly; noleadmessagewas submitted.

Exactv796 discovery read returned36Nov5/35Nov6 with34/33unpriced,no missingpubliccards andzero invalidoffers. The FridayD1snapshot survived deployment, was servedstale once, then backgroundrefreshed from11:51:20Z to12:11:30Z andreadfresh. This proves on-demand background recovery, not scheduled execution. Independentpublic3page200/title/canonical/FAQ review passed. Productionbuild and1987-case suitepassed1986/0fail/1existingskip.

Accepted-capability source protection now includesv796 plus the eventinventory and actualretained-client-state tests. QQQAAA already invokes the expandedlegacy/source/cardidentity comparison. The broaderplatformmemory/latencyfinding remainsopen and is not hidden by this scopedfunctionalapproval.
