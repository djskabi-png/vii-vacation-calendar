# VII supplier API field reconciliation, 2026-10-22

Source reviewed: the current official VII frontend API documentation and the three supported supplier catalogs. This note records product fields only and contains no credentials or private message content.

| Source | Authoritative fields now consumed | Product use | Evidence rule |
| --- | --- | --- | --- |
| `vacations/types` | property types, shared amenities, room amenities, room types, parent amenity hierarchy, `shown` | search facets, visible place facts and room facts | `shown:false` remains searchable but is not presented as a visible amenity |
| `events/types` | venue types, shared amenities, room amenities, room types and hierarchy | event search, venue detail and unit detail | numeric and object-shaped values resolve through the same index |
| `rooms/types` | room types, shared amenities, room amenities and hierarchy | hourly search and detail | shared and unit amenities are preserved separately before display merging |
| vacation/event/room detail | gallery groups, image order, room image ownership, room area, quantity, `basisGuests`, `maxGuests`, `maxAdults`, `maxKids`, `showKidsAndAdults` | gallery grouping, unit cards, price-basis copy and capacity copy | supplier ordering is preserved; capacity is not substituted for included guests |
| vacation starting prices | winter and summer starting prices | undated cards and place pages | shown only when the supplier supplies a positive value; date intent suppresses static starting prices |
| vacation calendar | `minNights`, `closedArrival` | restriction messaging | an exact number is shown only when returned for the selected arrival |
| vacation vacancy | availability, price, room, online-booking support and possible `min_nights` rejection | dated result, quote and booking handoff | source failure is never converted to available or occupied |
| booking response | `orderType`, `approvalRequired`, `created`, supplier failure code | confirmation and distinct recovery copy | commercial success is not claimed without an explicitly authorized test booking |

## Minimum-stay resolution

1. Preserve the exact `min_nights` count when the vacancy response supplies it.
2. If the rejection omits the count, read the official calendar for the selected room and arrival.
3. If the calendar is temporarily unavailable, perform a bounded authoritative vacancy probe of up to seven nights.
4. If no exact count is verified, show a truthful generic minimum-stay restriction and never invent a number.

## Accessibility source

The exact amenity `נגישות לנכים` is the verification source. When it is absent, the place page renders no negative claim and no “not verified” claim. When present, the page may identify the amenity and its source while recommending confirmation of personally important arrangements before booking.

## Known external limitation

The public vacation calendar endpoint returned a supplier-side failure during the audit window for representative ranges while the quote path still responded. The implemented bounded fallback prevents an endless loader and attempts to recover the exact rule from authoritative calls. This does not prove a real booking can be completed and does not authorize creation of a commercial order.
