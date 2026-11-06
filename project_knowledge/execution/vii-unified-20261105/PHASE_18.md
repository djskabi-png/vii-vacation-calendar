# Phase 18: reusable service artifacts and bounded event result projection

Status: local implementation and focused verification. No public deployment,
RUM activation, production configuration change or publication approval.
Unified V and QQQAAA core continues; document 3 remains deferred.

## Changes

- The private quality controller takes the application build generation from
  trusted runtime configuration. It no longer requires recompilation solely
  because the managed Site generation changes. Caller JSON cannot select that
  generation. Queued jobs from a different target remain blocked.
- The experience summary panel renders at most 25 rows per page. An actual
  component test traverses all 720 synthetic rows without loss. The load action
  uses the existing administration style, and explanatory text is collapsible.
- The schema-two evidence admission tool uses the committed impact graph and
  acceptance policy, actual clean source/tree, exact artifact digests and
  transitive input fingerprints. Unchanged consumer artifacts can be retained
  for compatibility verification without rebuilding or publishing them.
- Admission checks configuration and rollback coverage, referenced raw evidence
  integrity, affected HTTP/local/browser/interface observations, current source,
  build/artifact/environment identity, desktop/mobile coverage and independent
  reviewer identity. Source-only tooling changes still need their local tests.
- Local JSON receipt integrity does not establish runner provenance. The tool
  explicitly returns `verificationOnly`, never publication approval or a verified
  public release. Connecting the private durable QQQAAA authority remains required.
  This boundary was added after independent review identified the false-authority
  risk. No new secret or self-signed trust root was introduced.
- Worker packaging captures exact dry-run modules, without runtime configuration
  or credentials. Audit checks original source/tree/input identity, module paths,
  bounded sizes, digests, entrypoint, imports, runtime compatibility and parity
  with the actual tested compiled directory. Output creation refuses overwrite.
  Configuration and private bindings require separate provider readback.
- Event search result joins for 21 through 100 offers read only matching summary
  rows. SQL chunks contain at most 98 IDs plus world/generation, keeping the
  statement within 100 bindings. All chunks pin the same accepted generation.
  Editorial overlays remain fresh, and missing accepted businesses are excluded.
  The existing at-most-20 preview path and complete over-100 fallback remain.

## Focused observations

- Release admission and unit reuse: 11 tests passed in the initial focused run.
- After source-only, raw evidence and Worker audit changes, the expanded root
  run passed 34 of 35 tests. The remaining check found an unowned newly affected
  catalog-store file. Ownership was added to the catalog-source family; the
  seven-test impact suite then passed. This was a real gate finding, not a
  production failure.
- Worker package tests include exact bytes, tested-directory mismatch, overwrite,
  missing/opaque/external imports, incompatible Node imports, invalid syntax,
  missing handler, path/digest/source substitutions and fixture rejection.
- Event/catalog/regional focused suite: 39 passed, zero failures or skips.
  Actual SQLite tests use 1,000 rows, select 40 and 100 identities, enforce SQL
  binding limits, rotate the active generation between chunks and verify that
  every returned row still belongs to the original generation. Actual projection
  execution checks editorial edits, accepted removals, bounded fallback and
  no unrelated full-world projection. Route execution retains all 35 offers.
- Independent code review found no material regression in the final event
  projection or Worker package implementation. This is local review, not live
  provisioning or public acceptance.

## Not established by this phase

The frozen build, exact candidate packages, integrated authority seal, public
speed improvements, real RUM collection, complete business database/media restore
and full core release acceptance still need their own evidence. Historical
phase-17 build/package evidence is preserved, not re-labelled as current.
The selected-workspace publication access obstacle recorded in phase 17 remains
pending. No alternate owner chat has been created without the requested consent.
