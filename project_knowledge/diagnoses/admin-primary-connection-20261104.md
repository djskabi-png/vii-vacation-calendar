# Administration incident and Cloudflare authority, 4 November 2026

Status: shared root cause reproduced; Cloudflare-only source repair under verification, not yet deployed.

## Approved decision

Adir explicitly chose to remain on Cloudflare on 4 November 2026. Cloudflare D1 is the canonical database for the public site, administration, reports and scheduled maintenance. Do not request AWS login or reactivate Aurora for recovery. Retain historical migration tooling separately; do not create a second writable authority.

## Observed evidence

Authenticated owner reads reproduced eleven failures: content-queue, search-pages, quality, whatsapp-leads, users, geography, search-analytics, discovery-promotions, redirects, operations and content-studio with homepage type. The owner shell and reporting endpoints worked.

The Site environment had VII_AWS_DB_MODE=primary. Its configured bridge returned API Gateway 404. Canonical administration used that failed bridge; reporting could use the bound D1 database. Readiness observed 1,273 geography rows, 82 opportunities, 172 content items and catalog counts 577 vacation / 132 event / 53 hourly / 159 spa. These are observations, not proof of complete data or write health.

Under the explicit Cloudflare decision, only VII_AWS_DB_MODE was changed to cloudflare in Site Settings and persisted after reload. No secrets, permissions, catalog rows or user data were changed. Existing public runtime still failed geography before redeployment.

## Root repair

- runtimeDatabase, reports and public catalog select the bound D1 database without remote health probes.
- Worker requests and scheduled maintenance use the same selection function.
- Stale primary mode cannot reactivate AWS in production call sites.
- Origin metadata defaults to cloudflare-d1 while preserving a route's explicit origin.
- The legacy AWS adapter is retained only for migration tooling and its isolated tests.
- Missing D1 binding fails closed. No in-memory or invented-data substitute is introduced.

## Verification required

Nineteen focused tests passed, including stale primary mode, both adapter-bundle fallback identities, zero AWS calls and missing binding. Full build and suite, independent review, one exact deployment and authenticated route retest remain required. After connectivity: test safe draft saving and fresh readback, permissions denial and error/retry states. Never test actual sends, payments or user permission changes as a side effect.

## Publication access

Generic Sites connector is a different workspace and returns project_not_found. The existing authenticated VII Settings -> Edit route opens the correct durable release conversation. Use one frozen pushed commit and inspect any uncertain result before retrying.

The earlier AWS sign-in recovery instruction was incorrect for the approved architecture and is superseded by this decision.

## Source verification before deployment

Final production build passed. Complete source suite: 1,966 total, 1,965 passed, zero failures, one skipped. Focused authority/capability suite: 33 passed. Admin controls: 40 passed. Release baseline: 23 passed. Independent checker approved the final scoped source after identifying and fixing three direct adapter bypasses (both map snapshot APIs and review storage). The recursive guard now covers app and worker. These do not replace live deployment and save/readback evidence.
