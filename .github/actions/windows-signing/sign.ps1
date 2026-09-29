# Signs one file with Azure Artifact Signing. Tauri runs this through
# bundle.windows.signCommand (see setup.ps1) for every binary it signs.
param([Parameter(Mandatory = $true)][string]$Path)
$ErrorActionPreference = 'Stop'

& $env:EARL_SIGNTOOL sign /v /fd SHA256 /tr 'http://timestamp.acs.microsoft.com' /td SHA256 `
  /dlib $env:EARL_SIGN_DLIB /dmdf $env:EARL_SIGN_METADATA $Path
if ($LASTEXITCODE -ne 0) { throw "signtool failed with exit code $LASTEXITCODE for $Path" }
