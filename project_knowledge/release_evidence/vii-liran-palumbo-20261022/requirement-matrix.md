# VII Liran and Palumbo reconciliation, 2026-10-22

This matrix contains normalized product requirements only. It intentionally excludes raw private messages, unrelated products and unverified interpretations of screenshots or audio.

| ID | Requirement | Current evidence | Release gate |
| --- | --- | --- | --- |
| LP-01 | Place and unit galleries preserve the supplier-defined gallery grouping, picture order and unit ownership | Public Aqua and Sun Boutique checks found missing images and mismatched unit counts | Exact gallery counts, order and unit isolation verified against the API for representative places |
| LP-02 | Unit cards expose the full room specification and room-specific amenities | One five-bedroom example passed, API amenity IDs were previously dropped | Shared and room amenities resolve through each world types endpoint and display without hidden items |
| LP-03 | No dates are preselected on a clean entry | Public clean entry passed | Reload and direct-link tests pass on desktop and mobile |
| LP-04 | When the authoritative API enforces a minimum stay, state the number instead of a generic failure | Vacancy rejection previously lost minNights; calendar endpoint currently returns 503 in production | Calendar or bounded authoritative vacancy check returns and displays the exact minimum without hardcoding |
| LP-05 | Price scope uses basisGuests while capacity uses maxGuests and adult/child limits | Aqua showed 14 included instead of source value 10 | Quote, card and checkout use the correct field for each purpose |
| LP-06 | Arrival preference controls never overlap explanatory text | Public desktop audit found overlap | Desktop and mobile visual check passes at narrow and wide widths |
| LP-07 | Final booking errors are clear and the booking response preserves authoritative status fields | Final live booking was not exercised | Safe non-production or explicitly authorized booking test proves success and all failure states |
| LP-08 | Accessibility is shown only when the official accessibility amenity or verified editorial source exists | Generic navigation link had no target; product rule defines the amenity as the source | Accessibility label, filter and place section follow the verified source and never claim absence without evidence |
| LP-09 | Desktop floating contact controls remain available through the complete place page without obscuring content | Controls disappeared near the footer | Top, middle and footer checks pass with keyboard and pointer |
| LP-10 | Online booking and amenity filters change results and persist in the URL | Online and pool passed; other amenities were missing because API IDs were dropped | Representative parent, child, hidden and shared amenities pass in all supported worlds |
| LP-11 | Price filters accept typed values, persist after apply, change the result count and survive reload/back | Public audit found values reset and results returned to the full catalog | URL, chip, dialog and result set remain consistent after reload and back |
| LP-12 | Contact buttons meet the accepted desktop and mobile size and readability standard | Not verified against the reported target | Exact public visual check passes on desktop and iPhone viewport |
| LP-13 | Holiday pages default to a couple and offer explicit party and real-time availability controls | Default and ordering were reported incorrect | Holiday direct links pass with no stale query and couple default |
| LP-14 | Region sliders appear after the result list and sample up to 20 relevant eligible places | Earlier layout and randomization were reported inconsistent | Relevance, placement, count, navigation and reload behavior pass |
| LP-15 | The world switcher states the current world and makes changing worlds explicit | Current control was described as a generic search button | Every world shows the current label and accessible switch action |
| LP-16 | Starting prices are always present without dates when the supplier supplies them | API exposes winter and summer starting prices | Cards and detail pages show the correct seasonal starting price without inventing one |
| LP-17 | Online-booking campaign parameters retain the booking action but are excluded from canonical URLs | Legacy st1 behavior was requested | Direct link, canonical, reload and share-link tests pass |
| LP-18 | VII Control permission screens expose only authorized editable sections and save reliably | The verified screenshot is `/admin/users` in VII Control and showed a load/save failure | Central route-and-verb authorization, version-conflict handling, D1 grant/audit persistence and protected-owner tests pass; public owner-session read and a reversible test grant still require production verification |
| LP-19 | Horizontal amenity rows are scrollable by mouse, touch and keyboard | Prior regression was reported on Villa River | Pointer, touch, wheel and keyboard checks pass without hidden unreachable content |
| LP-20 | Promotional media sections use real approved supplier media and only eligible advertising businesses | API availability of video fields is unproven | No slideshow is presented as a video; eligibility source and media rights are verified |
| LP-21 | Spa and vacation availability sections fail fast to stable cached content and never remain in an indefinite skeleton | Public mobile screenshots showed stuck skeletons | Timeout, supplier failure, reload and offline-cache checks pass |
| LP-22 | Event availability sliders contain all eligible results rather than a hardcoded three | Public section showed three while more were expected | Eligible count and horizontal continuation are verified from current source data |
| LP-23 | Missing card images never render a broken or empty media panel | Rose Gold screenshot showed a missing image | Image fallback, alternate source and error recovery pass on representative cards |
| LP-24 | Date searches distinguish available, occupied and unverified states | Public examples collapsed occupied into a generic inquiry state | Authoritative available, occupied, restriction and source-failure cases each render distinctly |
| LP-25 | Unit counts remain stable after hydration and reload | Reported count appeared briefly and disappeared | SSR, hydration, reload and live-detail fallback use one preserved value |
| LP-26 | Representative galleries use the supplier-designated main gallery rather than random pictures | Reported on multiple places | Main media matches API gallery order and missing-main fallback is deterministic |
| LP-27 | Breadcrumbs include the correct world, area, city and place where each value exists | City was missing on a place page | Desktop/mobile navigation and structured data use the same canonical hierarchy |
| LP-28 | Availability modules across the site share one bounded loading, success, empty, restriction and failure contract | Multiple availability families showed inconsistent failures | Family-wide component matrix passes for vacation, events and spa |
| LP-29 | Vacation place breadcrumbs include area and city before the place when both exist | Villa Altos showed the area but omitted the displayed city | Visible breadcrumbs and structured data carry the same area, city and place hierarchy |
| LP-30 | Amenity-chip rows on vacation cards have no redundant arrows | The original screenshot identifies the small controls beside the amenity row, not the image-gallery controls | `HorizontalChipRail` keeps mouse, touch and keyboard scrolling with no amenity-arrow controls; image-gallery controls remain available |
| LP-31 | Holiday discovery uses a compact flexible date flow rather than a dense duplicate search-card grid | Hanukkah was reported as visually crowded and unclear | Holiday pages offer the shared flexible-date search including the accepted ±3-day option |
| LP-32 | Card WhatsApp and phone actions remain fully visible at narrow widths | A vacation card on `/vacations/north` clipped the WhatsApp action | iPhone-width visual check shows complete labels and independent actions |
| LP-33 | Shared place links carry a representative supplier image when the destination supports previews | Shared links were reported without representative media | public metadata and the share preview use deterministic approved supplier media |

## Explicit exclusions pending evidence

- Production permission verification must not change a real grant without an authorized reversible test account and scope matrix.
- Marketing-video messaging feedback is not a functional defect unless the approved media and eligibility source are present.
- A real final booking is not submitted without an explicit safe test identity and booking authorization.
- A property-specific minimum stay is never hardcoded when the supplier API returns a different rule.
