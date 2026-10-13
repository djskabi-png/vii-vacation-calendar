# VII super-admin capability matrix

This file separates implementation evidence from deployment evidence. Site version 399 was verified live at `vii.spaplus.co` on 13 October 2026; later commits `4d46373` and `a7094e4` were not part of that version at the time of this check.

| Capability | Current local implementation | Remaining acceptance evidence |
| --- | --- | --- |
| Single `/admin` entry and navigation | Built, links to operational modules | Live page opened in an authenticated browser; mobile and write-path checks remain |
| Catalog synchronization | Existing admin module retained | Live dashboard showed vacations 578, events 0, hourly 24, spa 159; event-sync repair is pending publication and live acceptance |
| Booking/review audit | Existing admin module retained; overview counts and recent events added | Live dashboard showed one vacation booking with supplier ID and zero VII review records; historical supplier review delivery is not reconciled |
| WhatsApp leads | Existing admin module retained; overview count added | Verify persistence and lead lifecycle |
| Promotion drafts | Existing admin module retained | Public ranking integration remains separate and unverified |
| Search submissions | New consent-gated D1 event and 1/7/30-day admin report | Live report opened with zero tracked searches; production consent, reload, timezone and traffic reconciliation remain; no historic backfill |
| Legacy URL redirects | New guarded 301/410 editor, audit records and proxy lookup for non-current paths | Live editor opened with zero saved redirects; live save/response/rollback and full old-URL inventory remain |
| Search landing content | New title/description draft, publish, version history for spa, event-region and hourly-region pages | Live editor opened with 22 default pages; live save, public reflection, rollback and other page families remain |
| Site activity | Overview shows recent bookings, reviews, leads, syncs and promotion draft events | Dedicated history, filters, pagination, incidents, search/redirect/content events |
| Permissions and users | Existing Google sign-in and admin allowlist | Team roles and least-privilege tests; not built |
| Full CMS | Not built | Navigation, footer, all static pages, media, image metadata, localized content, schema, robots, sitemap |
| Analytics and SEO | Search report and existing front-end SEO retained | GA4/GSC/Tag Manager reconciliation and migration monitoring |

Release gate: version 399 makes the initial super-admin live, but it is not the complete requested system. The live `/admin` route opened for a permitted account and the overview API denied an anonymous request with 403. Do not call writes verified until each survives reload, its public effect is checked, and rollback works. Do not call the old-site migration ready with zero saved redirects and no complete old-URL inventory. No new Site should be created to bypass access to the existing one.
