# Phase nine: proof of unchanged build-unit inputs

Local tooling under tools/ is outside the managed Site's deployment inputs.
Changing release bookkeeping must not itself invalidate the Site cache epoch.
The existing Site input namespace remains56aa19f5-e92b-ea34-5c93-fa95cb68863d.

The unit-input reader resolves actual immutable Git tree/blob identities for
the managed Site, private controller, browser, Edge and image delivery. The
Site inventory includes retained application/build/static/configuration inputs
and staged migrations. Private units include their owned source/configuration,
package locks, declared browser-definition inputs and transitive local imports.
Missing/link dependencies, opaque dynamic imports and unsupported aliases fail
closed instead of silently omitting their inputs.

An immutable-artifact reuse check independently verifies the actual clean Git
state, frozen target HEAD, receipt source tree and ancestry, both historical
and target input fingerprints, receipt freshness and the actual archive digest
inside the workspace. The source commit itself is not hashed into the input
fingerprint: a documentation-only or unrelated private change can retain the
exact Site archive. Source, inputs and archive remain distinct identities.

Tests create real isolated Git repositories and ancestor commits, proving
retention after docs/private changes and rejection after media/transitive
changes, a missing dependency, forged/missing digest, changed archive bytes,
dirty tree, stale receipt, non-ancestor tree, alias and opaque import.

This primitive does not yet alter the existing global candidate/publication
gate. Schema-one release validation remains fail-closed. Per-unit orchestration
and live provisioning evidence must be integrated and independently tested
before they can approve publication. An input fingerprint is not a build,
release test, rollback proof or public deployment receipt.
