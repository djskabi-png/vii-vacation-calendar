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
