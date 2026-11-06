# Phase eleven: per-unit release preflight

The new asynchronous tool in `tools/release-unit-candidate.mjs` implements a
limited schema-two unit/artifact/provisioning preflight. It always returns
`publicationApproved:false`. The existing global schema-one gate remains
unchanged and blocking until full runtime/release evidence is integrated.

The actual frozen HEAD/tree and committed impact graph determine coverage.
The comparison base must equal the graph's tracked approved baseline and be
an actual ancestor. A caller cannot choose HEAD as its base to omit changes.
Every affected build unit appears exactly once. Unknown, extra or duplicate
units fail. No caller-supplied input patterns or clean/ancestry callbacks are
accepted. The phase-nine actual Git-input/artifact validator establishes
ancestry, transitive inputs, clean state and exact local artifact digest.

Each unit's audit must identify the original built source/tree, exact digest
and byte count, freshness and its required audit checks. This preserves a
real ancestor artifact's provenance rather than fabricating a current build.
Resource readbacks must match the committed private-resource contract,
account, worker, immutable version, disabled public access and required typed
bindings. Provider/secret bindings are excluded from this private scope.
The approved contract records the private quality D1, not the Site business
database. Evidence files resolve within the actual workspace, including
symlink resolution.

Five real isolated Git fixtures passed: exact two-unit ancestor reuse;
coverage and baseline manipulation; actual dirty state, changed transitive
dependency and nonancestor; actual artifact tampering/size/audit staleness;
wrong account, worker, mutable version, public access and DB/provider binding.
The tests deliberately use synthetic build/audit/provider receipts and actual
local artifact bytes. They do not establish actual Cloud resource readiness.
Logs: `.qa-output/phase11-unit-preflight-baseline-fenced.log`.

An initial specialist draft did not reuse the existing dependency closure,
trusted caller state and had only two insufficient tests. It was removed
before integration. The root implementation and executable attack fixtures
replace it. Independent read-only review found no blocker within the limited
preflight; root also added the baseline-selection attack and fence.

This tooling is outside `scripts/` to preserve unchanged Site runtime inputs.
The next integration still needs actual unit build/audit/readback receipts,
global runtime-family evidence, rollback and separate public acceptance.
No deployment or public publication is claimed by this preflight.
