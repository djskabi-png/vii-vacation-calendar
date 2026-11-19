$ErrorActionPreference = "Stop"
node scripts/lead-intake-release-gate.mjs
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
node scripts/login-access-release-gate.mjs
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
node scripts/generate-market-copy-manifest.mjs
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
node scripts/prepare-production-static.mjs
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& ".\node_modules\.bin\vinext.cmd" build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
node scripts/lead-intake-release-gate.mjs --bundle
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
node scripts/login-access-release-gate.mjs --bundle
exit $LASTEXITCODE
