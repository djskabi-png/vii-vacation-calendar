# VII API revalidation — 2026-10-05

## Scope and authorization

Existing VII project: appgprj_6a71ccdca27481918bf04dd329d3eb21; production observed before publishing: Site version 340, public owner access, https://vii.spaplus.co. No new Site, sharing, ownership, domain, D1/R2 bindings or other-world catalog changes.

Adir explicitly reported approval from Sergey or Maxim to publish the API place data and images, and approved uploading the 23 prior correction files through the existing GitHub connector. This records the user's authorization, not an independently obtained license document.

The prior local review corrections (170b5e3c66970a2ac5d6ae54b7212375554df785) and sitemap-test correction (65f5cec42d935c62522ae060de26a442ab2e8240) were preserved through the GitHub connector in 02bbe737dc471c7c6b0c703fea36825203626735 on review/vii-sergey-api-only-20261005. The connector's branch read confirmed that SHA. Ordinary shell Git push was not retried.

## Historical reports preserved

VII_API_RELEASE_REVIEW_2026-10-05.md remains byte-for-byte unchanged, SHA-256 dbed742a3f2b1b2e159677fadebbb91baa01cda60411ec0cf1d5ce6f6bdb18b8. The original supplier audit, integration status and technical followup reports remain unchanged. Their historical blockers describe the situation at those review times; this document records the subsequent authorization and fixes.

## Verified corrections

- Public records remain exclusively the fetched supplier snapshot: 581 vacation places, 130 event places; fetchedAt 2026-10-05T10:29:43.514Z. The catalog JSON itself was not changed in this followup.
- Exact source URL identity remains the only automatic legacy-to-supplier mapping. All 27 such mappings (12 vacation, 15 event) are functionally checked.
- vacation-tepers-estate, vacation-aqua-sol-dreamy-rent and vacation-ahuzat-shaked redirect to the historically known region search with an unavailable-catalog message. Dates and guests are preserved; old prices are dropped.
- Other known old route labels without verified identity also lead to relevant search with an absence explanation. A small retired-route registry retains only world, slug, name and region; it supplies no public listing, photo, price, taxonomy or capacity. Unknown IDs still return 404.
- Legacy event, booking and unsupported accommodation-type redirects preserve locale. Unsupported accommodation taxonomy pages redirect to general/regional search and stay out of the sitemap.
- A largest-unit capacity cannot exclude a whole vacation/event place or authorize a whole-place booking. Search includes an explicit capacity clarification; unsupported whole-place, taxonomy, price and total-capacity sorting controls are hidden/ignored.
- Vacation region and guest query state applies during SSR, before hydration. Search structured data lists the filtered supplier records instead of the entire catalog on every filtered query.
- Event and vacation search SEO copy does not advertise unavailable taxonomy/capacity filtering. The exact supplier prefix 'תיאור שיווקי לעמוד בגוגל:' is removed only in the display description; original catalog source remains intact.
- Gallery behavior, navigation actions, desktop five-image layout and swipe handlers are retained. The 19 remaining failures mixed retired manual-listing/content/inline-gallery assertions with legacy-route compatibility gaps. The route gaps were fixed, and assertions were updated to test real source records and the shared gallery, with new functional coverage for missing/unknown routes, all verified identities, locale, prices, capacity and SSR filtering. No failing test was skipped.
- TypeScript fixes are type-only: nullable world navigation guard, illustrative quote return type, isolated generated Cloudflare Worker declarations, and a browser/Worker stream type bridge. Dependencies, bindings, review API runtime behavior and data are unchanged.

## Validation evidence

- Production build: pnpm build, exit 0. See validation/production-build-2026-10-05.txt.
- Full suite: node --test tests/*.test.mjs, 458 passed / 458, 0 failed, 0 skipped. Includes focused property-detail-mobile-gallery-controls.test.mjs and supplier/API tests. See validation/full-tests-2026-10-05.txt.
- TypeScript: pnpm exec tsc --noEmit --incremental false, exit 0. See validation/typescript-2026-10-05.txt.
- Sitemap crawl: all 1,052 canonical URLs returned complete HTML with expected status, title, description, canonical, one H1, indexability and valid JSON-LD; language alternatives checked by the suite.
- Browser preview: vacation-1 (אחוזת דוריאל) and event-2 (סטאר לופט) at 390px frames and 1,363px desktop. Mobile: one visible loaded image, five position dots, counter 1/12 -> 2/12 after next control on both pages; physical arrow glyph directions inspected. Desktop: five visible loaded images, mobile arrows hidden. Event full gallery opened with 12 photos and gallery fragment URL. Swipe handlers are covered by the focused source test; no physical touch-device swipe was performed.
- Browser search: 390px vacation search with guests=1000, old minPrice/types/whole parameters retained catalog results while unsupported controls were absent; event guests=1000 retained 130 records. No horizontal document overflow observed. Desktop legacy missing-place route showed its name and unavailable message, followed by center search with 53 places; event search visibly disclosed unit-only capacity.
- Temporary viewport QA file was removed before packaging.

## Remaining factual limits, handled without inventions

The original raw API export is not available in the checkout. This is a static fetched catalog, not live synchronization. Supplier gallery snapshots contain at most 12 photos per detail page (cards show a subset); no missing source photos were invented. Six quarantined coordinates remain without guessed replacements. Accommodation taxonomy, whole-place/event capacity, final prices, live availability and confirmed bookings are not verified by this snapshot. They are not supplied as approved values; the public flow requests confirmation directly from the place. Unverified legacy aliases are never silently assigned to another record. These source limitations remain recorded rather than rewritten as verified facts.

## Publication boundary

This report records pre-publication verification. A Site version and production success must be obtained separately and the live /search, /events/search, real vacation/event pages and missing-place redirects verified directly after publication before a production-success handoff.
