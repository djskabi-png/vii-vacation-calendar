# Amenity parity audit, 30 public records

Status: partial and not a release approval.

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

The 30-row comparison remains unverified for definitive legacy/API attribute parity until each legacy response is identity-checked by title or supplier marker and the hourly schema is independently normalized.
