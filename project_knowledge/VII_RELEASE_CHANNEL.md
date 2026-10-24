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
