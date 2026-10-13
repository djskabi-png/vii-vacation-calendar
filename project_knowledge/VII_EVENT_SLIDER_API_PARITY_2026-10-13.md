# Event last-minute slider: old site versus supplier API

Checked on 13 October 2026 against the public old and new sites and the authenticated Sergey API. No token or personal information is stored here.

## Observed old-site behavior

- `https://www.vii.co.il/events/` displays a `ברגע האחרון` slider for 13-14 October, plus `פנוי לחמישי` and `פנוי לשישי` tabs.
- Its legacy AJAX endpoint `POST /events/ajax_popularDeals.php` returned HTTP 200 and included Galaxy Loft (supplier ID 779), Star Loft (2), Rose Gold (1085) and Black Loft (287). The cards label these venues available; only some show a price.

## Observed new API behavior

- The new `/events` rail requires `available: true` and a positive `minTotal`, so it displays no cards for the tested date.
- `POST /api/vii/live-search` for 13-14 October, 20 guests and 3 hours returned zero confirmed available venues, 80 unknown and 9 unavailable. IDs 2 and 287 returned `available: null, reason: no_prices`; IDs 779 and 1085 returned `available: false`.
- Authenticated `GET /api/ai/vii/events/{siteID}/calendar?from=2026-10-13&till=2026-10-16` for IDs 2, 287, 779 and 1085 returned zero allowed starts and zero free starts for all four days. A later diagnostic request timed out; do not infer a broader outage from that one timeout.
- The published guide `https://bizonline.co.il/api/ai/vii/Vii-Frontend.html#ev-search` defines `available: null` as unknown, including `no_prices`; it does not authorize labeling those venues available.

## Required resolution

The old slider and the authenticated API disagree. Sergey/BizOnline must either expose the legacy last-minute availability signal in the supported VII API with its date/slot semantics, or correct the event search/calendar responses for these example IDs. Once a supported source confirms availability, the new slider should reproduce the old date tabs, show a price only when verified, and route no-price venues to phone/contact rather than online booking. Do not use the old AJAX endpoint as a permanent dependency: it is tied to the domain that will be migrated.
