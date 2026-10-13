# VII super-admin capability matrix

This file records implementation evidence, not approval or deployment evidence. The current local checkout is not confirmed as the live release at `vii.spaplus.co`.

| Capability | Current local implementation | Remaining acceptance evidence |
| --- | --- | --- |
| Single `/admin` entry and navigation | Built, links to operational modules | Authenticated production desktop/mobile check |
| Catalog synchronization | Existing admin module retained | Live source counts, run/retry/failure check |
| Booking/review audit | Existing admin module retained; overview counts and recent events added | Verify complete historical records and delivery states in production |
| WhatsApp leads | Existing admin module retained; overview count added | Verify persistence and lead lifecycle |
| Promotion drafts | Existing admin module retained | Public ranking integration remains separate and unverified |
| Search submissions | New consent-gated D1 event and 1/7/30-day admin report | Production consent, reload, timezone and traffic reconciliation; no historic backfill |
| Legacy URL redirects | New guarded 301/410 editor, audit records and proxy lookup for non-current paths | Authenticated save, redirect response, rollback and full old-URL inventory against production |
| Search landing content | New title/description draft, publish, version history for spa, event-region and hourly-region pages | Authenticated save, public reflection, rollback, multilingual/other search-page families |
| Site activity | Overview shows recent bookings, reviews, leads, syncs and promotion draft events | Dedicated history, filters, pagination, incidents, search/redirect/content events |
| Permissions and users | Existing Google sign-in and admin allowlist | Team roles and least-privilege tests; not built |
| Full CMS | Not built | Navigation, footer, all static pages, media, image metadata, localized content, schema, robots, sitemap |
| Analytics and SEO | Search report and existing front-end SEO retained | GA4/GSC/Tag Manager reconciliation and migration monitoring |

Release gate: do not call the super-admin complete or live until this exact source is deployed to the existing VII Site, the live `/admin` route opens for a permitted account, unauthorized access is denied, each write survives reload, its public effect is checked, and rollback works. No new Site should be created to bypass access to the existing one.

