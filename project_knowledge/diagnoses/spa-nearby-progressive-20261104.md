# Spa weekday discovery, browser proximity and progressive business reports

Date: 2026-11-04. Candidate v797. This record precedes publication and does not establish a live result.

## Requested outcomes

Seven permanent upcoming-weekday spa pages, true browser-origin nearest-first sorting in every result world, and the already requested progressive business report. Preserve the cumulative v796 event, availability, media and Cloudflare authority fixes. Whole-site performance architecture remains a separate phased workstream described in `../performance/VII_SPEED_PLAN_20261104.md`.

## Observed causes and repairs

- Nearby search previously resolved browser coordinates to a city/region label, then submitted a normal search without a distance sort. The replacement retains a validated point in tab session storage for at most15minutes, deduplicates and bounds requests, and submits whole-country `sort=nearest`. Coordinates are never added to URLs, analytics or a server request. Permission denial shows a retry state instead of pretending an approximate city is the browser point.
- All seven result families expose the localized nearest option: vacations, events, spa, hourly, providers, attractions and trails. Sorting is global on the complete filtered inventory before progressive display. Unknown positions remain visible after known distances. Equal distances preserve source order. Distances are straight-line using available points, some of which are city centers. Trails use explicitly disclosed regional centers when precise trailheads are absent.
- SPA weekday routes are `/spas/day/sunday` through `/spas/day/saturday`. They have localized metadata, breadcrumb, three FAQs and sitemap entries. Invalid slugs return404 instead of silently rendering Sunday.
- Weekday dates use the next eligible Israel deal day. After14:00, the current weekday resolves to its next-week occurrence. The retained client computes from the live clock rather than trusting a stale SSR absolute date. Both route identity and selected date participate in client request scope.
- Rail API responses still cap20offers per audience. Full pages request all offers for one selected date, retaining seven dates as tab metadata. Explicit calendar-today pages retain today's date after the discovery cutoff; only discovery/weekday rollover advances. Price and availability remain supplier-derived and final booking revalidates.
- Business performance previously mounted921business rows and23727DOM nodes. The candidate separates overview/businesses/sales/contacts/history, defers snapshots and contacts, renders at most50business/contact rows, preserves global filtering/sorting/CSV, aborts superseded scopes, and avoids loading full catalog JSON merely for inventory identities. An existing analytics LIMIT500 was removed and the report-cache generation bumped to prevent reuse of truncated reports.

## Verification before publication

- Initial full run:2017cases;2008passed,5assertion failures,3local D1 timeouts,1existing skip.
- The five assertion failures were resolved without removing behavior coverage: update the intentional report cache generation; inject the actual newly imported date function into an existing API fixture; connect all new copy to the localization system; update source contracts for shared geolocation and the optional nearest flag. Actual submission tests cover desktop/mobile and all four search modes.
- All three timed-out D1 cases passed in a single isolated serial retry:12tests passed, zero failures/cancellations. No timeout was increased and no production or schema setting changed.
- Final corrected-family run:86passed, zero failures/cancellations. Includes every originally failing assertion, actual spa API selected-date/full30offers/rail20/14:00 tests, localization completeness, actual search submission, complete proximity order, and actual progressive report behavior/handler tests. Combined case matrix therefore verifies2016activecases, with the one existing skip retained. This is an aggregate of the original full run plus explicit focused reruns, not a claim that the original full invocation was entirely green.
- Local production build passed before the final request-identity/today-date reinforcement and copy relocation. Publication requires a successful remote build of the exact final frozen source; the earlier local build alone is not exact-source approval.
- Independent source review found no remaining inventory/privacy/date-scope blocker. Exact public UI, mobile, metadata, navigation and authenticated report checks remain required after deployment.

Evidence logs are local, ignored QA output: `v797-full-tests.log`, `v797-d1-serial-retry.log`, `v797-corrected-family.log`, `v797-build.log`. No cookies, contact records or credentials are included in this managed record.

## Publication constraints and open work

Preflight at15:19Israel confirmed active succeeded publicv796, source1d56f95d1319c6f49fcd1a76ec2e38c22ea07b0b, environment32 and Cloudflare mode, with no pending deployment. Save/deploy one exact candidate only after source protection and final build checks. Preserve bindings, PUBLIC audience and environment32. Do not change schema, secrets, scheduler, DNS, domains or supplier data. Do not send leads/messages or make bookings.

This candidate does not close the historical memory-allocation investigation, full-site latency targets, observed scheduler execution, backups/restore or general launch approval. No new media, tracking, payment, refund or transaction flow is introduced. Existing privacy, consent, terms, media provenance and accessibility surfaces remain in place; scoped keyboard/RTL/mobile verification is required, and no legal-compliance certification is claimed.
