# VII release channel

VII production releases use one fail-closed handoff rather than repeated ad hoc pushes.

1. Work from a clean candidate based on the exact active public source.
2. Build once and run the focused and complete regression suites.
3. Push the exact commit to a dedicated `origin/release/...` branch.
4. Run `.openai/prepare-vii-release-handoff.ps1`. It refuses a dirty tree, an unpushed commit and a duplicate version number.
5. Open the existing Site from Sites settings and choose `Edit`. This opens the durable `Publish VII Release` conversation with the correct Sites workspace.
6. Send the generated prompt once. The prompt requires a preflight for an existing version or deployment, one save, one deployment, an unchanged environment revision and a terminal `succeeded` result.
7. Record the returned version and deployment IDs in the handoff receipt and verify the exact public destination. Never retry an uncertain mutation. Inspect the existing outcome first.

The direct Sites connector and the `sites` Git remote are optional fast paths. Their failure must not cause repeated writes. The durable publication conversation is the proven fallback because it owns the correct workspace and can use remote build fallback from the verified Git commit.

## Owner-controlled Cloudflare verification

A push to `migration/vii-owned-cloudflare-staging-20261125` starts two independent jobs in `VII owned Cloudflare staging`. The staging job uses a credential restricted to the private Worker. The production qualification job builds the same source and runs the full regression suite without deployment credentials. Its run summary reports the exact Git commit and the suite result.

Public promotion requires a verified production data restore, working supplier synchronization, and a rollback that preserves the deployed application and data. A successful private deployment alone does not qualify a commit for production. The public route stays on the live Sites origin until those conditions pass.

For an authorized export of the four active catalog generations, run `node infrastructure/cloudflare/verify-active-catalog-restore.mjs <snapshot.ndjson>` locally. It restores the records in memory and compares a fresh application export with the source hash. Keep the snapshot out of Git and CI artifacts. This verifies the active catalog export only. Historical generations, accounts, bookings, CMS and media require separate recovery evidence.

Once an authorized full source database snapshot and a separate snapshot from the restored target are available, compare them locally with `node infrastructure/cloudflare/verify-d1-restore.mjs SOURCE.sqlite RESTORED.sqlite`. This checks schema, indexes, SQLite integrity, foreign keys, and table row contents independent of insertion order. Keep both inputs outside the repository and record their origin separately. The comparator does not verify that either file came from the stated environment, or that the R2 objects were restored.

For independently downloaded R2 exports that preserve object keys one-to-one, compare the bytes with `node infrastructure/cloudflare/verify-r2-restore.mjs SOURCE_DIR RESTORED_DIR SOURCE_OBJECT_COUNT`. Take the count from a complete, authorized listing of the source bucket at the backup point. Compare the source and restored bucket identities and object metadata separately, then verify gallery and review-media delivery through the application. Keep bucket contents outside Git and CI artifacts.

The Flight compatibility check uses the captured browser registry of the current public predecessor, v928. Before a later public promotion, bind the check to that release’s verified predecessor archive and keep an actual predecessor tab open for the post-deployment browser check. Historical v822 replay remains available with `VII_FLIGHT_PREDECESSOR=v822`.

Use the clean CI build for release qualification. A shared or linked `node_modules` outside the checkout changes Vinext’s framework reference IDs. The staging job runs the predecessor compatibility check against the same build output it uploads.
