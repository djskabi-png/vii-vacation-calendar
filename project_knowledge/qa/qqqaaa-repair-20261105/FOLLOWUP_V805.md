# Memory and cold-read follow-up

Candidate source only. Public baseline is v804, source885dcb2d7a91364bc7e9164c70ca1ca040e9f41e, actual build336139b4-c31d-4ebf-b461-6ac9b3b69bb9. Edge v12 is eb1e95f7-8813-4799-91ae-7fb8052600b4, source160db8e7. Fail-open and all21 unrelated routes verified.

## Reproduced memory failure

One authorized manual vacation pull started13:51:13.073UTC under run manual_1793886672884_vacations_cddadd62360d4b5bb9d509e37d60c89d. The browser connection failed. An owning-Site production log records exceededMemory on /api/admin/catalog-sync at13:51:47.279UTC,2062ms CPU/34409ms wall, runtime9db490de-802e-4cc6-b975-bb5be299bc9c. No HTTP status or allocation stack was exposed. A fresh D1-backed read preserved the577-place accepted generation and showed the original running lease until14:06:13.073UTC. No repeated click, forced unlock or duplicate pull was performed.

This confirms the failure mechanism, not the exact allocating stack. Candidate changes remove independently proven allocation multipliers:

- Publication formerly serialized both complete pinned generations, parsed nested inventories, then parsed both complete generations again. It now validates the original pinned objects and the same staged-ID inventory, removal/media proofs and atomic pointer swap.
- Accepted rows are parsed one keyset page at a time, rather than accumulating all raw JSON strings before constructing the complete object generation.
- The sync runtime no longer statically imports all bundled worlds and7.46MB of place-detail JSON. A loader resolves the immutable fallback only when the authoritative accepted generation is absent.
- Vacation detail batches are capped at4 for manual and scheduled refresh. No business, unit, gallery or feature is omitted from publication: unrefreshed entries keep accepted detail.
- Integrity checks skip identical immutable detail references; unchanged pinned objects are not serialized solely to prove equality.

Actual SQLite tests verify zero serialization of supplied full-detail objects at publish, complete body preservation, lazy first-generation fallback, accepted-generation reuse, duplicate/removal/partial-content rejection and atomic visibility.

## Public cold-read work

readWorldAvailability now performs only SELECT on public reads. Schema creation remains in the administrative writer. The15-second cache, disabled-world behavior, existing failure fallback and post-save fresh read remain unchanged. Three tests run the actual compiled function, not copied logic.

## Still required

## Additional observed SPA recovery defect

On public v804 the Friday couple page remained on catalog fallback405packages after its two followups. A direct supplier-backed public availability read returned365rows/18261bytes in3081ms, with57available sites for November6. This ruled out the1MB payload-limit hypothesis in that sample. The SPA fallback response permitted browser caching for60seconds while client followups used the default HTTP cache, so the new bounded retry could repeatedly receive the same temporary response without reaching refreshed data. Client cache admission alone did not govern browser HTTP caching.

Candidate source changes both fallback responses and client reads to no-store. An explicit full-date page has an8-second finite availability budget within the10-second client deadline; compact rails retain the1.2-second first-response budget. Pending responses contain no invented dated catalog offers. The actual component remains loading during its two bounded followups, preserves a previous verified result, and reaches a retryable error when no verified result exists after the bound. Actual handler and effect tests cover these cases.

The first v805 build was correctly blocked by unresolved literal JSON imports after an attempted dynamic JSON import with attributes. The source now defers small TypeScript baseline modules whose JSON imports are static and supported; the guard is unchanged. A clean rebuilt artifact is required.

Build/full tests, independent review, exact cumulative publication, observed successful bounded sync after original-run reconciliation, public regression and final61-check sweep. The staged schedule probe is a separate operation; do not duplicate it or present inline execution as unattended proof. Full weekly detail coverage also remains open: the existing three-slot schedule and rotating detail subset cannot establish weekly completeness from a configured job alone.
