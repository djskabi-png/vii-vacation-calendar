# Amenity parity audit, 30 public records

Status: read-only evidence complete for 30 public API records and 30 new-host redirect checks. This is an audit artifact, not a release approval.

The audit script completed 30 bounded public reads: 10 vacations, 10 events and 10 hourly records. It records sanitized supplier IDs, legacy paths, redirect inventory targets, API status, legacy `data-id` observations, feature labels, search-filter presence, room counts and gallery counts.

Important interpretation:

- HTTP 200 from a legacy URL is not proof that the returned page is the matching profile. The report therefore retains the legacy path and observed marker counts separately.
- `searchFilterIds: []` must not be interpreted as “the field was explicitly empty”. The report now includes `sourceSearchFilterIdsPresent`.
- The hourly response shape differs from vacations/events. Hourly rooms and their features are nested under the public summary projection. Any zero hourly counts in an older report are parser/schema observations, not proof that the supplier has no rooms or amenities.
- The redirect target in the report is the local redirect inventory target. It is not an HTTP 301 observation unless a separate redirect-manual request records status and `Location`.
- No contacts, reviews, tokens, raw HTML or private records are persisted.

Files:

- `.qa-output/audit-amenity-parity-30.mjs`
- `.qa-output/attribute-parity-30-20261105.json`
- `.qa-output/public-observed-amenity-id-title.json`

Observed results:

- 30/30 public catalog detail reads returned HTTP 200.
- 30/30 new-host requests to the observed legacy paths returned HTTP 301 with a `Location` matching the inventory destination.
- Hourly normalization is now reading `summary.rooms`; all 10 hourly records returned room facts and feature labels. The earlier zero-count result was a parser defect in the audit, not a product finding.
- Legacy hourly pages are HTML shells with a generic canonical and no reliable embedded supplier identity; they are retained as an explicit identity limitation, not treated as matching profile data.
- Vacation and event legacy HTML observations remain marker evidence only unless a stable title/site marker is present. No fuzzy label was promoted to a confirmed mismatch.
