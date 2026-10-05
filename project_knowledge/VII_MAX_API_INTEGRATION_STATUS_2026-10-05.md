# Max API integration status

Checked: 5 October 2026. Scope: VII vacations and events. No supplier writes or public deployment were made.

## Correspondence and contract

- Max Kuliev sent `Vii Compounds API.mhtml` on 28 September and the public [Vii Compounds API documentation](https://bizonline.co.il/api/partner/v1/compounds/docs) on 29 September. The documentation URL returned HTTP 200 during this audit.
- The documented API requires `X-API-Key` or Bearer authentication, and the key is limited to authorized site IDs. An unauthenticated site request returned HTTP 401.
- The documented operations cover a compound site profile, dated search, quote, site and room vacancy, booking creation/status/cancellation, and an optional payment-link flow. This is a nightly accommodation contract, not an events catalog contract.
- A key in Max's separate `ביז API` email was sent for a Web2 integrator's testing. It was not used or copied into VII. A dedicated VII key and its allowed site list were not found in the local configuration and are not confirmed by Adir.
- Sergey's later `Vii Frontend API.mhtml` and ZIP delivery attempts were stripped by the recipient mail gateway. A readable copy or direct link is still needed to verify the complete frontend contract, especially events and writeback.
- Adir approved one email to Max requesting a VII-specific key, permitted site IDs, readable full guide, events/booking scope and sandbox. Gmail verified the sent message as `1a10b9029d5d3a37` on 5 October. No supplier reply has been received yet.
- Adir subsequently forwarded a token received from Max via WhatsApp. It matches the already-held Sergey catalog token. Read-only requests with both documented authentication headers to Max's site 457 endpoint returned HTTP 401 (`unauthorized`), while the same token returned HTTP 200 from Sergey's VII locations endpoint (1,245 cities, 25 areas). The token therefore does not currently grant Max partner API access. It was not stored in the repository or repeated in this report.

## Existing VII data path

- Public vacation and event records currently come from `app/data/site-data.ts` and `app/data/verified-catalog.json`, not from Max's live partner API.
- The read-only Sergey `/api/ai/vii` audit earlier on this date verified 584 active vacation and 132 active event records, with active detail responses. A fresh authenticated list check later on 5 October returned 793 vacation records with 585 active and 164 event records with 132 active. See `VII_VACATIONS_EVENTS_API_AUDIT_2026-10-05.md`. This proves supplier catalog availability, not VII ingestion, live prices, booking, or publication; the one-record vacation change also demonstrates why synchronization is necessary.
- No verified one-to-one mapping between those canonical VII places and Max's authorized compound site IDs is present. The Max API docs do not describe an all-sites discovery feed.
- Existing booking actions are not a verified Max booking writeback. No live booking or payment was created in this task.

## Local implementation and verification

- `app/lib/max-compounds-api.ts` is a server-side, read-only Max client for site profile, search, quote, vacancy, and booking-status reads. It requires `VII_MAX_COMPOUNDS_API_KEY`, uses the documented host and response envelope, applies a bounded timeout, does not cache requests, and returns explicit errors without exposing the key.
- `app/lib/sergey-vii-api.ts` reads VII-authorized live vacation/event catalogs, locations and place details. The VII token was verified from Sergey's email to Adir, used only in ephemeral read-only checks, and not saved to the repository or a local environment file.
- Seven focused mocked transport/permission tests passed across the two clients. The local Vinext production build passed. No public route was switched to either adapter because source mapping, publication rights, authorized Max access and the complete transaction contract remain unverified.
- A temporary noindex API preview returned HTTP 200 for both lists and sample detail pages, but its browser CSS did not load under the local production server and the development server stalled during dependency optimization. The preview routes were removed; this is not visual or end-to-end approval.
- A broad project test run encountered failures in existing media/gallery contract tests and was stopped before completion. It is not evidence of whole-site regression approval; the new adapter is not imported by public routes.
- The full-project TypeScript check is currently blocked by a syntax error in the pre-existing generated `.next/dev/types/validator.ts`; a scoped check of the new client passed.

## Activation gate

1. Confirm a VII-owned Max partner key and its allowed site IDs in a server-side secret store. Verify one permitted read, one denied read, and a current dated search and quote without exposing credentials.
2. Obtain a readable frontend/events API contract and confirm the source-of-truth split between Sergey's catalog and Max's transaction endpoints, including IDs and media rights.
3. Build the VII canonical persistence and ID mapping, reconcile the 717 active supplier records already imported into local staging, and handle changes, deactivation, media, SEO metadata and old-to-new URLs.
4. Integrate search, detail, availability, booking and error states across the affected public routes. Verify real API provenance for each visible claim, reload/persistence behavior, desktop/mobile flows, and representative production scenarios before any release.

Current result: both read-only adapters are locally tested, and a local API-only catalog candidate now replaces the vacation and event exports with 711 validated supplier records from the 5 October source snapshot. See `VII_SUPPLIER_STAGING_AUDIT_2026-10-05.md` for the six quarantined records and remaining route, rights, synchronization, visual and transaction gaps. This is **not a continuously synchronized or publicly activated API-only site**. The administration system remains the next project phase, not a claimed existing component.
