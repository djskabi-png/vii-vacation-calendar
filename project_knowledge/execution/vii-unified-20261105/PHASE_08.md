# Phase eight: private evidence and immutable artifact audit

Local implementation, not yet deployed or fully qualified.

## Private historical evidence

The administration result can link to the existing authenticated quality API
by job ID. The private controller resolves the persisted terminal job and
receipt, verifies its immutable definition hash and constructs the exact
source/job/device/scenario evidence key. Caller-supplied keys and extra query
parameters are rejected. Historical screenshots remain addressable after a
new engine/source release and while execution is off. This does not bypass
the source's delegated read permission or the controller's authority flag.

The browser service exposes a narrow private GET endpoint to its Service
Binding. It reads only derived failure JPEG keys, never arbitrary URLs or R2
paths. Object lookup, body consumption, caller cancellation, late object
arrival and byte limits are bounded. JPEG boundary bytes, MIME and declared
length are checked. The controller and Edge recheck actual bytes and strip
non-allowlisted headers. Responses are private/no-store, nosniff and noindex.

Actual-workerd tests exercise controller-to-browser Service Binding and real
R2 with a synthetic persisted historical job while execution is off. Separate
actual source authorization tests bind the exact evidence query and reject
another job. Synthetic JPEG data is not a live cloud evidence-path result.
The earlier actual cloud screenshot was separately retrieved through R2 CLI.

## Archive audit

The release auditor opens the exact tar archive produced by the supported
Sites packager. It validates portable relative paths, duplicate/case-colliding
entries, regular file types, compressed/uncompressed limits and fixture
exclusion before extraction into an owned temporary directory. It checks
Site/binding/capability declarations against the retained manifest, compares
compiled file inventory and bytes against the tested dist output, compares
staged migrations to source, verifies RSC asset agreement, resolves compiled
server imports and checks the startup graph budget. It hashes the archive
without rebuilding or replacing framework-generated secrets. Owned extraction
directories are removed in finally.

Targeted checks have passed, including missing imports, altered bytes,
packaged QA wrappers, altered database bindings, omitted media, stalled image
lookups/streams, cancellation, cross-job evidence and historical retrieval.
Full frozen build/suite, packaged actual-candidate audit, compiled UI check
and independent final review remain required. No broader completion claim is
made by these targeted checks.
