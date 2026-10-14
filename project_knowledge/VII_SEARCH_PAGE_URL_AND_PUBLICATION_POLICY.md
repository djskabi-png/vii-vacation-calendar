# VII search-page URL and publication policy

Status: approved implementation direction, 14 October 2026.

## Stable public URL model

Search-demand pages use one ASCII route identity across languages:

`/search/{world}/{english-slug}`

World segments are `vacations`, `events`, `spas`, and `hourly`. Hebrew is the default locale and has no language prefix. Approved localized editions use `/en`, `/ru`, or `/fr` before the same route identity. A localized URL is indexable only when its own localized edition is approved. The system must not advertise untranslated editions through hreflang.

Examples:

- `/search/spas/couples-tel-aviv`
- `/en/search/spas/couples-tel-aviv`
- `/search/events/family-events-haifa`

The public slug is ASCII lowercase kebab-case. Human-facing titles and content remain in the edition language. The slug is not regenerated after first publication unless an explicit redirect migration is approved.

## Draft and review identity

Pending, draft and review records do not own a public URL. Their durable address is the authenticated management address:

`/admin/search-pages?id={opportunity-id}`

The editor may show a future-public-URL preview, but that route must return no public content until publication. Admin and preview surfaces carry `noindex, nofollow`, private no-store caching and administrator authorization.

## Publication contract

“Published” is one atomic product state, not a visual label. It requires:

1. Complete approved content and metadata.
2. A valid unique URL derived from world, locale and slug.
3. `robotsIndex = true`.
4. A public route that returns HTTP 200 with matching canonical metadata.
5. Inclusion in the dynamic sitemap.
6. Exclusion of drafts, review rows, archived rows and future scheduled rows from both the public route and sitemap.
7. A retained immutable version record and actor audit entry.

Scheduled pages become public and indexable only after their scheduled instant. Unpublishing or archiving removes the page from the sitemap and public resolver; any redirect decision is separate and must not silently send unrelated traffic to the home page.

## Language clusters

Each language edition is independently reviewed. Canonical points to the edition itself. Hreflang contains only approved live editions in the same translation group, plus `x-default` pointing to Hebrew when Hebrew is live. Until translation-group persistence and localized editorial workflow are connected, search-demand sitemap entries expose only the approved edition and do not manufacture alternates.

## Required administration tools

The management system must expose the private editor URL, future public URL, active public URL, publication state, indexing state, sitemap state, canonical, locale, collision status, version history, scheduled time, publisher and last live verification. It must block publication on incomplete content, a URL collision, missing indexing approval or a non-live scheduled time.

