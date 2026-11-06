param(
  [Parameter(Mandatory = $true)][ValidateRange(1, 99999)][int]$VersionNumber,
  [Parameter(Mandatory = $true)][ValidatePattern('^[A-Za-z0-9._/-]+$')][string]$Branch,
  [Parameter(Mandatory = $true)][ValidateNotNullOrEmpty()][string]$Summary,
  [Parameter(Mandatory = $true)][ValidateRange(1, 99999)][int]$FocusedTests,
  [Parameter(Mandatory = $true)][ValidateRange(1, 99999)][int]$FullTests,
  [Parameter(Mandatory = $false)][ValidateRange(0, 99999)][int]$FullTestsSkipped = 0,
  [Parameter(Mandatory = $true)][ValidateNotNullOrEmpty()][string]$CandidateManifestPath,
  [Parameter(Mandatory = $true)][ValidateNotNullOrEmpty()][string]$RollbackVersionId,
  [Parameter(Mandatory = $true)][ValidateNotNullOrEmpty()][string]$RollbackDeploymentId,
  [Parameter(Mandatory = $true)][ValidateRange(1, 9999)][int]$EnvironmentRevision
)

$ErrorActionPreference = "Stop"
$FullTestsPassed = $FullTests - $FullTestsSkipped
if ($FullTestsPassed -lt 0) { throw "FullTestsSkipped cannot exceed FullTests." }
$project = (Resolve-Path -LiteralPath "$PSScriptRoot\..").Path
$projectId = "appgprj_6a71ccdca27481918bf04dd329d3eb21"
$publicationChat = "https://chatgpt.com/g/g-p-6ab2e9ea51548191856f299d727d8611-vii/c/6ad6ad51-1850-83ed-9b72-689fddf553fb"
$outputDirectory = Join-Path $project "project_knowledge\release_handoffs"
$outputPath = Join-Path $outputDirectory "v$VersionNumber.json"

function Invoke-GitCommand([Parameter(ValueFromRemainingArguments = $true)][string[]]$GitArguments) {
  $result = & git.exe -C $project @GitArguments
  if ($LASTEXITCODE -ne 0) { throw "Git validation failed: git $($GitArguments -join ' ')" }
  return ($result | Out-String).Trim()
}

if (Test-Path -LiteralPath $outputPath) {
  throw "Release handoff v$VersionNumber already exists. Inspect the existing outcome instead of creating a duplicate."
}

$status = Invoke-GitCommand status --porcelain --untracked-files=normal
if ($status) { throw "The release source is not clean. Commit or remove unrelated changes before preparing publication." }

$commit = Invoke-GitCommand rev-parse HEAD
$tree = Invoke-GitCommand show -s --format=%T HEAD
$buildIdentity = (& node.exe (Join-Path $project "scripts\release-build-identity.mjs") $project)
if ($LASTEXITCODE -ne 0 -or -not $buildIdentity -or $buildIdentity -notmatch '^[a-f0-9-]{36}$') {
  throw "Deployable build identity could not be derived from the frozen source inputs."
}
$manifestAbsolute = (Resolve-Path -LiteralPath $CandidateManifestPath -ErrorAction Stop).Path
$manifestResult = (& node.exe (Join-Path $project "scripts\release-candidate-manifest.mjs") $manifestAbsolute --root $project | ConvertFrom-Json)
if ($LASTEXITCODE -ne 0 -or $manifestResult.status -ne "passed" -or $manifestResult.publicationApproved -ne $true) {
  throw "Candidate manifest is not publication-approved: $($manifestResult.failures -join ', ')"
}
$manifest = Get-Content -LiteralPath $manifestAbsolute -Raw | ConvertFrom-Json
if ($manifest.candidate.source -ne $commit -or $manifest.candidate.tree -ne $tree -or [int]$manifest.candidate.environmentRevision -ne $EnvironmentRevision -or $manifest.candidate.buildIdentity -ne $buildIdentity) {
  throw "Candidate manifest identity does not match the frozen source, environment or build identity."
}
$artifactDigest = $manifest.candidate.artifact.sha256
if ($artifactDigest -notmatch '^[a-f0-9]{64}$') { throw "Candidate manifest artifact digest is missing or invalid." }
$testReceipts = @($manifest.evidencePaths | ForEach-Object {
  Get-Content -LiteralPath (Join-Path $project $_) -Raw | ConvertFrom-Json
} | Where-Object { $_.engine -eq 'local-test' })
$fullReceipt = @($testReceipts | Where-Object { $_.suite -eq 'full' })
$focusedReceipt = @($testReceipts | Where-Object { $_.suite -eq 'focused' })
if ($fullReceipt.Count -ne 1 -or $focusedReceipt.Count -ne 1) { throw "Exactly one full and one focused verified test receipt are required." }
if ($fullReceipt[0].totalCount -ne $FullTests -or $fullReceipt[0].passedCount -ne $FullTestsPassed -or $fullReceipt[0].skippedCount -ne $FullTestsSkipped -or $fullReceipt[0].failedCount -ne 0 -or $fullReceipt[0].cancelledCount -ne 0 -or $focusedReceipt[0].passedCount -ne $FocusedTests -or $focusedReceipt[0].failedCount -ne 0 -or $focusedReceipt[0].cancelledCount -ne 0) {
  throw "Requested test counts do not match the verified candidate receipts."
}
$remoteSha = Invoke-GitCommand rev-parse "refs/remotes/origin/$Branch"
if (-not $remoteSha -or $remoteSha -ne $commit) {
  throw "origin/$Branch does not match HEAD. Push and verify the exact source before publication."
}

$previousVersion = $VersionNumber - 1
$prompt = @"
המשך את אותו פרויקט VII ופרסם פעם אחת בלבד גרסת production חדשה v$VersionNumber לאחר v$previousVersion. המשתמש אישר במפורש לסיים ולפרסם.

$Summary

מקור רשמי: repo djskabi-png/vii-vacation-calendar, branch $Branch, source commit מדויק $commit, tree מדויק $tree, deployable build identity $buildIdentity, artifact SHA-256 $artifactDigest. ראש origin כבר נדחף ונבדק. הבנייה המקומית עברה, $FocusedTests בדיקות ממוקדות עברו ו-$FullTestsPassed עברו מתוך $FullTests, עם $FullTestsSkipped בדיקות שסומנו skip. המשך במסלול remote build fallback המוכח, בלי לערוך קוד. לפני deployment חובה לאמת שהארטיפקט המרוחק תואם בדיוק ל-SHA-256 הזה.

לפני שינוי אמת שאין כבר version או deployment עבור source commit זה ושאין פעולה ממתינה או לא ודאית. v$previousVersion הפעילה וה-rollback היא Version ID $RollbackVersionId, Deployment ID $RollbackDeploymentId. אמת את העץ המנוהל, שמור version אחת בלבד ופרוס deployment אחד בלבד. אם תוצאה לא ודאית, בדוק אותה ואל תנסה שוב.

אין לשנות DB, schema, secrets, env, schedules, DNS, domains, sharing, permissions, catalog data, הגדרות גישה או תוכן CMS. אין לבצע הזמנות, לידים, שיחות, WhatsApp, חוות דעת, תשלומים או שליחת מייל. שמור environment revision $EnvironmentRevision. המתן ל-succeeded ודווח מספר גרסה, Version ID, Deployment ID, source commit, managed commit, tree, environment revision, URL ציבורי וזהות rollback.
"@.Trim()

New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
$receipt = [ordered]@{
  schema_version = 1
  release = "v$VersionNumber"
  project_id = $projectId
  branch = $Branch
  source_commit = $commit
  tree = $tree
  build_identity = $buildIdentity
  candidate_manifest = $CandidateManifestPath
  artifact_sha256 = $artifactDigest
  rollback_version_id = $RollbackVersionId
  rollback_deployment_id = $RollbackDeploymentId
  environment_revision = $EnvironmentRevision
  focused_tests = $FocusedTests
  full_tests = $FullTests
  full_tests_passed = $FullTestsPassed
  full_tests_skipped = $FullTestsSkipped
  publication_chat = $publicationChat
  prompt = $prompt
  state = "prepared_not_published"
  prepared_at = (Get-Date).ToUniversalTime().ToString("o")
}
$json = $receipt | ConvertTo-Json -Depth 5
[System.IO.File]::WriteAllText($outputPath, $json + [Environment]::NewLine, [System.Text.UTF8Encoding]::new($false))
Write-Output "RELEASE_HANDOFF_READY"
Write-Output $outputPath
Write-Output $publicationChat
Write-Output $prompt
