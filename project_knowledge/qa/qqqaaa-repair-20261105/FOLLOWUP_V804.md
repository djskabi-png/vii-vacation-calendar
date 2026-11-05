# Candidate follow-up, 5 November 2026

This is candidate source, not evidence of publication.

## Root-cause evidence and correction

The previous map-click scroll delta came from the CUA locator centering a target in the viewport. On public v803, Escape and Enter on the already centered marker both preserved document scrollY2113. That delta is not proof of an application scroll regression. The reversible preventScroll hardening remains independently tested.

Public v803 was observed with actual build23d09ac6-01b9-472b-8e95-2e3039c2ca8f. Edge v10 sourcecd90cebd deployed as687cc941-ac97-4ac7-8f57-0f92de47022c. A fresh route readback confirmed fail-open, all21 unrelated routes retained, HTTP200 and matching build. The first v10 public guard assertion failed without recording its probe details; its exact response is unknown. Two subsequent independent reads matched the build. The guard now records observations before assertions and persists read-only receipts. Do not label the first failure diagnosed or erase it.

Cloudflare readback confirms the */2 minute trigger. Execution and cross-location performance require separate observation. Cache API is local to a data center.

Actual filtered Wrangler tail then observed a scheduled invocation of that exact worker version: outcome ok,8attempted/8completed/0failed,18579ms elapsed and107ms CPU, with no exceptions. Evidence: `.qa-output/qqqaaa-v803-edge-warming-runtime.log`. A separate real browser-Accept sample returned MISS8960ms then HIT210ms at the same actual public build. This confirms shared HTML variant identity, not acceptable cold latency or global warm coverage. Cold-origin latency remains open.

## Supplier contract

The official guide https://bizonline.co.il/api/ai/vii/Vii-Frontend.html was fetched directly, HTTP200,126756bytes. The Site page section describes everything shown on the place page, separate from the list's up-to-six-photo preview. It defines gallery IDs, ordered pictures and explicit room-gallery arrays. It provides response api_version and created, not field tombstones or individual deletion events.

The former monotonic content guard required every old filename forever. That prevents legitimate supplier gallery edits from replacing the16-day-old generation. The new server-only full-detail proof requires the supported protocol, a fresh response, matching supplier identity, explicit valid gallery/amenity/space fields, trusted image paths and exact room-ID agreement with the list. The normalized fingerprint is rechecked before content replacement. Partial, old, mismatched or changed data keeps the guard active. Raw fingerprints are provenance receipts from the trusted client, not cryptographic upstream attestations. No raw payload or contact is persisted in diagnostics.

Readonly public v803 comparisons proved the complete previous-inactive intersection for all7 events and36 vacations, with zero unknown activity. An exact reviewed transition accepts only132to127 and577to547 with those same IDs and no unit removal from any retained place. Both orchestration and storage recompute the check; no HTTP force flag or general threshold relaxation exists. Other generations retain the normal removal limits. Archived generations are preserved.

## Other fixes

- SPA catalog fallback schedules at most two followups,2seconds then4seconds, with cleanup on unmount/key change. Three tests execute the actual effect for the limit, verification stop, key reset, cancellation, late response and retained useful data.
- Removed unnecessary technical SPA availability copy, retaining the selected date and truthful action states.
- Current legacy page /events/Oshiya_Resort explicitly identifies supplier2112 but returned404 on the new host. The generated inventory and generator now include its direct canonical redirect, retaining booking state. This does not move the old domain or claim its DNS cutover.

Remaining gates: exact frozen build/full tests, independent source review, public full-detail acceptance and catalog readback, unattended scheduling identity, browser desktop/mobile regression, final read-only61-check sweep, resource cleanup and task-contract finish. None is implied by this candidate document.
