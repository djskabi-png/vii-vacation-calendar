# VII API candidate release review — 2026-10-05

## Decision: do not publish

Reviewed candidate `99b825231a89a590e43ee421fb2188bba7e7fc82` from
`djskabi-png/vii-vacation-calendar`, branch `review/vii-sergey-api-only-20261005`,
against the existing production Site checkout. No Site creation, version save,
deployment, domain, sharing, ownership or production data mutation was performed.
The existing Site was re-read and remains active and public with its previous deployment.

## Data provenance and limits

The committed catalog is a snapshot fetched at `2026-10-05T10:29:43.514Z`,
not continuous API synchronization. It contains 581 vacation and 130 event places.
The candidate does not supply authorized date prices, availability or confirmed booking.
Six records remain excluded for invalid coordinates; no coordinates were guessed.
The raw supplier export and staging report are not committed to this candidate.
Public galleries are capped at 12 images. The two source audit documents remain authoritative:

- `VII_SUPPLIER_STAGING_AUDIT_2026-10-05.md`
- `VII_MAX_API_INTEGRATION_STATUS_2026-10-05.md`

## Corrections prepared in this review

- Supplier vacation booking ignores URL-supplied prices and cannot become online-ready from them.
- Event attendance requests no longer filter venues using their largest lodging-unit capacity.
- Event regional results use the shared region matcher. Areas without a clean regional route retain their location query.
- Stale unsupported event types cannot silently empty results or claim an unverified type in the heading.
- Event structured data omits total attendee capacity when only unit occupancy is known.
- Lodging structured data omits inferred whole-place/suite taxonomy and accommodation occupancy for snapshot records.
- Vacation inquiry guest controls do not reject a group solely because it exceeds one unit's capacity.
- Cards and details do not claim whole-place rental solely because one unit was reported.
- Missing descriptions fall back only to the actual place name, city and area; source snapshot data is unchanged.
- Empty accommodation-category pages preserve a supported regional search when redirecting.
- Verified legacy IDs redirect only when their source URL exactly matches a record in the same supplier world.
  Legacy prices are discarded. Unapproved name aliases were not guessed.
- Added English, Russian and French translations for the candidate's 33 new static phrases.
- Catalog validation no longer requires an ignored temporary staging report.
- Added five functional release regression tests and retained the positive booking authorization guard in its existing test.
- Repaired the development preview command and allowed preview host without changing public UI.

## Validation evidence

- Production build succeeded during `pnpm test`.
- Initial complete candidate suite: 447 tests, 425 passed, 22 failed.
  One additional failure versus the supplied 426/447 report came from its missing ignored staging report.
- Final focused command passed **24/24**:
  `node --test tests/booking-mode-contract.test.mjs tests/supplier-release-regressions.test.mjs tests/sergey-*.test.mjs tests/max-compounds-api.test.mjs tests/property-detail-mobile-gallery-controls.test.mjs tests/localization-completeness.test.mjs`
- Subsequent complete-suite attempts still failed and did not complete the enlarged sitemap crawl.
  Do not describe their partial test counts as a completed 452-test run.
  The sitemap/browser release gates are not collectively satisfied.
- Development browser QA inspected `/business?id=vacation-1` (אחוזת דוריאל)
  and `/events/place/event-2` (סטאר לופט) at desktop and within 390px-wide viewports.
  Supplier images loaded, both mobile next controls advanced the counters from 1/12 to 2/12,
  arrows pointed in the correct direction, and desktop retained five visible gallery images.
  Physical touch swipes were not exercised; the focused gallery control test passed.
- Static localization completeness passed for English, Russian and French.
- `git diff --check` passed.
- No post-deployment live-domain checks were performed because no deployment was made.

## Required before another release attempt

1. Written supplier/business approval for public use of the supplier images and data.
2. Approved old-link mappings and treatment for records absent from the supplier export.
   Unapproved aliases include `aqua-resort`, `sol-gilgal`, `black-loft`, `fiesta`,
   and `details-events`. Missing verified vacations include `vacation-tepers-estate`,
   `vacation-aqua-sol-dreamy-rent`, and `vacation-ahuzat-shaked`.
3. Verified accommodation taxonomy or an explicitly accepted general-search fallback,
   with obsolete taxonomy/deal assumptions reconciled in the remaining tests and content.
4. Verified total event capacities or a fully accepted inquiry-only event contract.
   Do not reinterpret a room's maximum guest count as total attendee capacity.
5. The authorized source export/full gallery contract, confirmation of the 12-image limit,
   and a completed sitemap crawl, canonical metadata and localized/mobile release review.
6. Reconcile genuine legacy route/content regressions and approved obsolete test expectations,
   then complete the entire suite successfully. Some current tests hardcode former sample
   IDs, manual deals, multi-world offerings and gallery implementation strings.
   These must not be made green by restoring unsupported prices, taxonomy or identities.
7. Only then save/deploy to the existing production Site and directly validate the live
   `/search`, `/events/search`, and real vacation/event detail pages.

The unauthorized Max credential described in the source audit is not a prerequisite
for an honest snapshot-only inquiry catalog. A permitted API and verified contract are
required before introducing authorized quotes, live availability or confirmed bookings.
