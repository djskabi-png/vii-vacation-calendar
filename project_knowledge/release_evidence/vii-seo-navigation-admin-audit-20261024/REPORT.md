# VII SEO, navigation, language and administration audit

Date: 2026-10-24

Candidate: local branch `plan/vii-continuous-quality-20261023`, based on commit `b1f4519` plus the changes in this audit. Production was not published by this task.

## Completed repairs

1. Holiday sitemap entries now expand each indexable holiday into Hebrew, English, French and Russian URLs. With the current 19-holiday inventory this changes the family from 19 Hebrew-only URLs to 76 localized URLs.
2. Dynamic holiday and guide pages now derive their canonical and Open Graph URL from the active locale path.
3. Guide metadata and Article structured data now use the active language and localized copy instead of a fixed Hebrew URL and `he-IL` schema language.
4. `robots.txt` now explicitly excludes `/admin/`, `/account/`, `/booking/`, `/api/`, `/handoff/` and `/favorites/` from crawling.
5. The public SEO crawler now follows the sitemap index into every child URL, checks duplicates, status, H1, canonical, language, all hreflang values, visible/schema breadcrumbs and relevant page schema. A slow page or child sitemap is reported without aborting the rest of the audit.
6. Recurring production QA now checks the English, French and Russian home routes in addition to Hebrew and checks every child sitemap, not only the sitemap index.
7. The administration shell received an additive VII Control visual layer: data-grid background, restrained teal glow, orbit treatment, glass surfaces and reduced-motion fallback. No administration behavior or permission boundary was changed.

## Verified evidence

- Production sitemap index: 8 child files, 8,212 unique URLs at the time of the audit.
- Bounded public crawl after fixing false positives: 80 of 80 URLs passed, zero duplicates and zero child-sitemap failures.
- Complete stored legacy inventory: 3,528 known sources, 3,105 redirects, 423 explicit gone responses, 2,341 migrated search pages and zero remaining known non-place issues.
- Full candidate test suite before the final additive QA registry and CSS changes: 1,546 passed, 0 failed.
- Focused post-change tests: recurring language/sitemap QA, quality incidents, dynamic localized metadata, sitemap descent and administration contracts all passed.
- Final candidate build passed and generated all public, administration and API routes.
- Production recovered after the bounded crawler was stopped: `/` returned 200 in 1,253 ms, `/sitemap.xml` returned 200 in 1,863 ms and `/robots.txt` returned 200 in 33 ms.
- Resource hygiene passed with no owned process left running.

## URL and breadcrumb conclusion

The breadcrumb hierarchy change does not itself change a page URL. It changes the visible and structured hierarchy to Home, World, Region, City, Place. Therefore it does not require a new 301 merely because the breadcrumb gained a city level. A 301 is required only when the canonical page address changes.

The migrated search-page destinations already use ASCII canonical paths and their stored legacy sources map directly to those destinations. The complete known inventory audit passed. No generic homepage catch-all was introduced.

## Language coverage

- Public shell and supported content routes have unique `/en`, `/fr` and `/ru` addresses, self canonicals and hreflang links.
- Candidate holiday pages are included in all four language sitemap families.
- The 2,341 migrated legacy search pages remain Hebrew-only because their source content has no approved translated editorial equivalent. They must not be duplicated into foreign-language sitemaps with invented or literal translations.
- The administration system is an internal Hebrew operational product; it is not a public multilingual crawl surface.

## Exact remaining blockers

1. The available legacy source union contains 3,528 URLs. The platform plan estimates a historic universe of roughly 20,000 to 30,000 URLs. A complete Search Console export or old-server log export is still unavailable, so historic URLs outside the stored union cannot truthfully be certified.
2. A full live HTML crawl of all 8,212 production URLs was stopped after it materially slowed public Worker responses. The safe proof is the complete sitemap-structure audit, complete stored redirect inventory, the 80-page public content crawl and recurring per-sitemap monitors. A full live crawl should run against an isolated release candidate or throttled replica, not against customer traffic.
3. Public redirect HTTP sampling timed out during the same resource-pressure window. Static inventory, worker routing code and automated redirect tests passed, but this run did not obtain fresh public HTTP evidence for the sampled old URLs.
4. Search Console, GA4 and GTM connections are still displayed as not connected or not verified in the Growth Center. Code cannot truthfully mark them connected without account-level evidence.
5. The candidate has not been deployed. Production therefore still has the prior 19-URL Hebrew-only holiday sitemap and the prior administration styling until an explicitly authorized release is published and rechecked.

## Explicit exclusions

Accessibility and typography audits were excluded by the user and were not used as completion evidence.
