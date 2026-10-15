# VII launch readiness, 15 October 2026

## Decision

The candidate is ready to be published to the temporary host for final live verification. The old-domain cutover is not yet approved.

The requested migration work is complete in the candidate:

- The shared administration layout now authorizes the session before rendering any administration shell.
- The live old sitemap was reconciled to 2,710 unique URLs.
- All 2,313 legacy `/s/` search pages were fetched and exported.
- All 2,313 search pages have a stable new ASCII URL, public publication record, administrator editing path and sitemap membership.
- All 2,313 legacy search URLs have a direct one-hop mapping to their matching new page.
- The complete legacy inventory contains 3,526 classified sources: 3,075 direct redirects and 451 explicit gone outcomes.
- The complete build and all 723 automated tests pass.
- The Hebrew font source audit passes.

## Exact identities

- Candidate source commit: `e7839b227881258df39ec4a4cab1acb77ebc050d`
- Current verified temporary-host release before this candidate: Site version 423, production commit `a6d9679abba2445c097e03441e7027be2a2ca134`
- Rollback target for the candidate publication: Site version 423
- Temporary verification host: `https://vii.spaplus.co`
- Future primary hosts after a separate cutover instruction: `https://www.vii.co.il` and `https://vii.co.il`

## Launch matrix

| Family | Status | Evidence or exact blocker |
| --- | --- | --- |
| Administration pre-auth protection | Candidate passed | Three session states pass. Built `/admin`, `/admin/search-pages`, `/admin/catalog-sync` and `/admin/redirects` redirect before returning shell text. The current live version still exposes the shell and must be replaced by the candidate before launch. |
| Legacy search-page export | Passed | 2,313 of 2,313 live `/s/` URLs fetched. 2,291 supplied title, H1 and description; 22 supplied title and H1 but omitted description, so the candidate records a conservative description derived from the source H1. No fetch failure and no target collision. |
| Search-page publication and CMS control | Candidate passed | 2,313 generated published records; database edits override the generated record and first edit materializes only that page into D1 with existing version controls. |
| Complete legacy URL classification | Passed | 3,526 total sources: 3,075 redirects, 451 gone. No source remains unclassified in the inventory. |
| Redirect safety | Candidate passed | All 2,313 legacy search sources map to unique final search-page targets; none remains in the gone set. Tests reject active-route, system-path and external redirect targets. Full old-domain HTTP evidence is possible only after cutover. |
| Sitemap, canonical and robots generation | Candidate passed | Search pages paginate into three sitemap files; candidate tests verify primary-domain canonical output, staging `noindex`, primary robots and sitemap host consistency. Live candidate verification is still required after publication. |
| Local build and regression | Passed | `pnpm test`: 723 passed, 0 failed. |
| Hebrew typography source | Passed | The account typography audit reports no prohibited Hebrew font source. Cold and warm computed-font evidence on the exact candidate remains part of live QA. |
| Performance | Not verified for launch | The build still reports client chunks over 500 KB, led by generated translation and catalog chunks. Exact candidate Core Web Vitals and cold mobile navigation on the future primary domain have not been measured. |
| Complete CMS promise | Not launch-approved | Current administration is strong but still lacks proven end-to-end control, preview, version, public reflection and rollback for every navigation, footer, static page, image metadata, localized field, schema, robots, sitemap and analytics field. |
| Roles and least privilege | Not launch-approved | Administrator allowlist works, but owner, editor, viewer and regional roles and their persistence/audit matrix are not implemented and verified. |
| Analytics, consent and migration measurement | Not launch-approved | No exact-candidate proof yet for GA4/GTM consent scenarios, event dictionary, realtime events, Search Console ownership, sitemap submission, Bing submission or launch monitoring dashboards. |
| Booking, leads, WhatsApp and supplier integrations | Automated coverage passed, live launch evidence incomplete | Source tests cover booking, lead, WhatsApp and supplier failure states. Exact-candidate production journeys, persistence, delivery identifiers and reconciliation still require live checks. |
| Accessibility and legal truth | Not legally approved | Official Israeli sources returned 403 in this environment. Operator facts, a real screen-reader audit, manual keyboard/zoom/contrast review, statement truth and independent inspection of the exact deployed release are missing. The accessibility widget does not replace this gate. |
| Privacy, terms, cancellation and public trust | Partially passed | Public routes and consent controls exist. Exact operator/legal review, cookie inventory, third-party embed inventory, image-rights evidence and policy accuracy remain unverified. |
| DNS, TLS, email DNS and rollback | Cutover pending | The old domain has not been changed. Before cutover, record DNS values and TTL, verify TLS, preserve MX/SPF/DKIM/DMARC, identify the exact origin switch, and rehearse restoration to the old runtime. |
| Independent release review | Missing | A material public launch requires independent functional and visual review on the exact deployed candidate, desktop and 390-pixel mobile. |

## Required work before moving the old domain

1. Publish the candidate once to the temporary host and verify the anonymous admin redirect, an allowed administrator session, representative migrated search pages, all three search-page sitemaps and representative 301 targets.
2. Run the full public search and responsive matrix on the exact deployed candidate, including desktop, 390 by 844 mobile, low-height viewport, reload, back, resize and language transitions.
3. Complete real booking, lead, WhatsApp and supplier failure/recovery journeys without test or demo data entering production reporting.
4. Reconcile GA4, GTM consent behavior, Search Console, Bing, sitemap submission and redirect monitoring.
5. Complete an independent accessibility and legal-truth review for Israel, including the public statement and physical accessibility arrangements where applicable.
6. Close or explicitly defer with owner approval every incomplete CMS and role-control item.
7. Capture current DNS, CDN, TLS and email records; lower TTL if appropriate; define the exact cutover and rollback command; confirm version 423 remains restorable.
8. Receive a distinct final instruction to replace the old-domain runtime.

## Cutover rule

Do not move the old domain while any release-critical row above is not launch-approved. Candidate publication to `vii.spaplus.co` does not itself authorize DNS or origin changes for `www.vii.co.il` or `vii.co.il`.
