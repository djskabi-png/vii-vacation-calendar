$ErrorActionPreference = "Stop"

$project = (Resolve-Path -LiteralPath "$PSScriptRoot\..").Path
$archive = Join-Path $PSScriptRoot "site-release-v308-spa-reviews.tar.gz"
$stage = Join-Path $env:TEMP "vii-v308-spa-reviews-stage"

if (Test-Path -LiteralPath $stage) {
  $resolvedStage = (Resolve-Path -LiteralPath $stage).Path
  $resolvedTemp = (Resolve-Path -LiteralPath $env:TEMP).Path
  if (-not $resolvedStage.StartsWith($resolvedTemp, [System.StringComparison]::OrdinalIgnoreCase)) { throw "Refusing to clear a stage outside the temporary directory." }
  Remove-Item -LiteralPath $resolvedStage -Recurse -Force
}

New-Item -ItemType Directory -Path (Join-Path $stage "dist\.openai") -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $project "dist\server") -Destination (Join-Path $stage "dist\server") -Recurse
Copy-Item -LiteralPath (Join-Path $project "dist\client") -Destination (Join-Path $stage "dist\client") -Recurse
Copy-Item -Path (Join-Path $project "dist\.openai\*") -Destination (Join-Path $stage "dist\.openai") -Recurse -Force
Copy-Item -LiteralPath (Join-Path $project ".openai\hosting.json") -Destination (Join-Path $stage "dist\.openai\hosting.json") -Force
if (Test-Path -LiteralPath $archive) { Remove-Item -LiteralPath $archive -Force }
tar.exe -C $stage -czf $archive dist
Get-Item -LiteralPath $archive | Select-Object FullName, Length
