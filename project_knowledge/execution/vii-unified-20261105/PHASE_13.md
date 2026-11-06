# Phase thirteen: remove server data from the search client

The exact phase-eight compiled manifest identifies the6,864,710byte JS file as
`app/search/page.tsx`. This is uncompressed compiled size, not measured network
transfer or navigation time. A diagnostic esbuild dependency report traced
three unintended browser-data paths. That diagnostic is an approximation;
the next actual Vinext build must establish the real new artifact size.

## Boundaries and preservation

1. Canonical URL construction imported the entire7,638,912byte legacy search
publication source just to compute a map. The original derivation now lives
in an authoring/source module. The browser receives a deterministic177,843byte
lookup containing all1,388 canonical keys/paths, preserving the exact rule,
type/location normalization and tie selection. Full publication prose remains
available to server SEO/editorial readers. Transactional parameter behavior
is unchanged.
2. Pure location URL construction imported a module that also initialized
server catalog reads. `world-location-path.ts` now owns only pure path/slug
construction. `world-location-pages.ts` retains inventory reads and reexports
the compatible path function. Client consumers import the pure module.
3. The unavailable-place notice imported the complete supplier catalog merely
to resolve historical aliases and retired labels. A3,328byte generated index
preserves those exact outcomes. The full static catalogs remain on the server.
Unknown and inherited prototype names remain unknown, never fabricated places.

The generator has explicit `--write` and `--check` modes. The production build
checks both committed projections before compiling and fails if stale. It
does not rewrite a frozen candidate during build. Any catalog/editorial source
update that changes these lookups requires generation, review and commit.

## Evidence before freeze

All1,388 source-derived canonical keys compare equal to the browser lookup.
Every verified/retired identity across both worlds compares equal to the
preserved original alias/place/href algorithms, including unknown/prototype
keys. Existing dated/undated parameter, qualified-feature and geography cases
pass. Actual esbuild search-client dependency inventory excludes all raw
publication/supplier/verified catalogs and server catalog readers. The pure URL
module measured178,024bytes in a UTF-8 diagnostic bundle, below250KB.

The first budget test correctly exposed the remaining server-catalog import
through location paths; changing text encoding did not fix it. Separating
that actual server dependency did. Two older geography tests mocked a moved
module path and inspected a constant's former file. Their harness now uses
the real pure URL implementation and verifies all four actual route results.
No product contract was weakened to make them green. The final affected run
passed28/28 and full TypeScript passed. Logs:
`.qa-output/phase13-location-harness-repaired.log`,
`phase13-complete-typecheck.log`. Failed observations remain separate.

Independent read-only comparison against the prechange source found no
functional blocker within this data-boundary change. It is not full release
approval. No public performance improvement is claimed before deployment.

The Site's runtime inputs intentionally change now. The older phase-eight
archive remains preserved history and retention-test input; it cannot be
reused as the new application artifact. Freeze and build once, run the full
suite on that output, inspect real desktop/mobile search navigation, then
package/audit the same bytes before publication. Document3 remains deferred.
