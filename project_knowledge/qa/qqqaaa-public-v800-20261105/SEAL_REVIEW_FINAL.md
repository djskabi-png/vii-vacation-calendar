# Independent Seal review

**Historical partial review, superseded by `INDEPENDENT_SOURCE_REVIEW.md` and the root report.** The claimed trail href-generation defect below was disproved by root CUA inspection: North/Center/South retained area queries; long-tail tags retained q/explore intent. The unrelated areaTags patch and its test were reverted. Root subsequently completed actual390 mobile samples for trails, hourly/map and business-performance; this review's mobile gap describes only this specialist's pass. Do not use the historical nine-test claim as current candidate evidence.

Date: 2026-11-05

## Verified

- The focused policy test passes 9/9 after the trails long-tail fix.
- The trails fix is narrow and source-level: additional `areaTags` become actionable `/trails?area=...` destinations rather than root links.
- The candidate diff also contains the previously reviewed SPA date/audience race fix and holiday cache policy change. Those were covered by their focused tests in the handoff, not independently re-run in this pass.

## Public observations

- CUA desktop inspection reached settled `/trails`, `/attractions`, `/corporate`, `/hourly`, and `/providers` pages without submitting forms or changing data.
- Public trails links were observed returning root `/trails` for several labels. This is the defect addressed in candidate source, but the public deployment was not rechecked after this candidate change.

## Not verified

- No independent 390px mobile viewport run was completed in this pass.
- No post-fix public click-through or screenshot was captured after the candidate change.
- No universal claim is made for every map, retry/back flow, business detail, booking path, or admin control.
- Candidate changes affecting catalog fallback, gallery media, map split scrolling, home deals, and event query retention require the parent’s build/full-suite/public checks before release.

## Seal result

`NOT_VERIFIED`: focused candidate regression is green, but public post-fix and mobile evidence are still missing.
