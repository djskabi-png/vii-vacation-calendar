# VII super-admin capability matrix

This file separates implementation evidence from deployment evidence. Site version 400 was verified live at `vii.spaplus.co` on 13 October 2026. The additional hourly heading fix in commit `88ad67d` was not yet part of that version at the time of this check.

| Capability | Current local implementation | Remaining acceptance evidence |
| --- | --- | --- |
| Single `/admin` entry and navigation | Built, links to operational modules | Live page opened in an authenticated browser; mobile and write-path checks remain |
| Catalog synchronization | Existing admin module retained | Live dashboard and public search showed vacations 578, events 130, hourly 24, spa 159; one active event (ID 373) has no supplier photo and is withheld, inactive supplier records are not in the public catalog |
| Booking/review audit | Existing admin module retained; overview counts and recent events added | Live dashboard showed one vacation booking with supplier ID and zero VII review records; historical supplier review delivery is not reconciled |
| WhatsApp leads | Existing admin module retained; overview count added | Verify persistence and lead lifecycle |
| Promotion drafts | Existing admin module retained | Public ranking integration remains separate and unverified |
| Search submissions | New consent-gated D1 event and 1/7/30-day admin report | Live report opened with zero tracked searches; production consent, reload, timezone and traffic reconciliation remain; no historic backfill |
| Legacy URL redirects | New guarded 301/410 editor, audit records and proxy lookup for non-current paths | A unique test path survived reload, returned 301 when enabled, and returned 404 after disabling; the full old-URL inventory and real migration mappings remain |
| Search landing content | New title/description draft, publish, version history for spa, event-region and hourly-region pages | A Sharon hourly-page edit survived publish and changed the browser title, but version 400 still showed the old visible H1 and description; the client override fix is pending public verification, as are other page families and rollback |
| Site activity | Overview shows recent bookings, reviews, leads, syncs and promotion draft events | Dedicated history, filters, pagination, incidents, search/redirect/content events |
| Permissions and users | Existing Google sign-in and admin allowlist | Team roles and least-privilege tests; not built |
| Full CMS | Not built | Navigation, footer, all static pages, media, image metadata, localized content, schema, robots, sitemap |
| Analytics and SEO | Search report and existing front-end SEO retained | GA4/GSC/Tag Manager reconciliation and migration monitoring |

Release gate: version 400 makes the initial super-admin live, but it is not the complete requested system. The live `/admin` route opened for a permitted account and the overview API denied an anonymous request with 403. One redirect write and rollback were verified; other writes and their public effects still need checks. Do not call the old-site migration ready without a complete old-URL inventory and equivalent mappings. No new Site should be created to bypass access to the existing one.
