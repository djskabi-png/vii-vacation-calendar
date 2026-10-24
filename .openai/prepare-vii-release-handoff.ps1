param(
  [Parameter(Mandatory = $true)][ValidateRange(1, 99999)][int]$VersionNumber,
  [Parameter(Mandatory = $true)][ValidatePattern('^[A-Za-z0-9._/-]+$')][string]$Branch,
  [Parameter(Mandatory = $true)][ValidateNotNullOrEmpty()][string]$Summary,
  [Parameter(Mandatory = $true)][ValidateRange(1, 99999)][int]$FocusedTests,
  [Parameter(Mandatory = $true)][ValidateRange(1, 99999)][int]$FullTests,
  [Parameter(Mandatory = $true)][ValidateNotNullOrEmpty()][string]$RollbackVersionId,
  [Parameter(Mandatory = $true)][ValidateNotNullOrEmpty()][string]$RollbackDeploymentId,
  [Parameter(Mandatory = $true)][ValidateRange(1, 9999)][int]$EnvironmentRevision
)

$ErrorActionPreference = "Stop"
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
$remoteSha = Invoke-GitCommand rev-parse "refs/remotes/origin/$Branch"
if (-not $remoteSha -or $remoteSha -ne $commit) {
  throw "origin/$Branch does not match HEAD. Push and verify the exact source before publication."
}

$previousVersion = $VersionNumber - 1
$prompt = @"
המשך את אותו פרויקט VII ופרסם פעם אחת בלבד גרסת production חדשה v$VersionNumber לאחר v$previousVersion. המשתמש אישר במפורש לסיים ולפרסם.

$Summary

מקור רשמי: repo djskabi-png/vii-vacation-calendar, branch $Branch, source commit מדויק $commit, tree מדויק $tree. ראש origin כבר נדחף ונבדק. הבנייה המקומית עברה, $FocusedTests בדיקות ממוקדות עברו ו-$FullTests מתוך $FullTests בדיקות האתר עברו. המשך במסלול remote build fallback המוכח, בלי לערוך קוד.

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
  rollback_version_id = $RollbackVersionId
  rollback_deployment_id = $RollbackDeploymentId
  environment_revision = $EnvironmentRevision
  focused_tests = $FocusedTests
  full_tests = $FullTests
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
