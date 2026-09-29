# Sets up Azure Artifact Signing for tauri build. See action.yml.
$ErrorActionPreference = 'Stop'

# Pinned signing client (Microsoft first-party NuGet package) and its SHA-256.
$ClientPackage = 'microsoft.artifactsigning.client'
$ClientVersion = '1.0.128'
$ClientSha256 = '74bd7d27e6ce1051409c38d9b46bc8df0400ecd643d51ffbf2ac00869061e40b'

$required = 'AZURE_TENANT_ID', 'AZURE_CLIENT_ID', 'AZURE_CLIENT_SECRET',
  'AZURE_SIGNING_ENDPOINT', 'AZURE_SIGNING_ACCOUNT', 'AZURE_SIGNING_PROFILE'
$missing = @($required | Where-Object { -not [Environment]::GetEnvironmentVariable($_) })
if ($missing.Count -gt 0) {
  $names = $missing -join ', '
  Write-Output "::warning title=Unsigned build::Windows code signing is not set up (missing: $names). This build is UNSIGNED, and Smart App Control may block it. See the M0.2 PR for the Azure Artifact Signing setup."
  "enabled=false" >> $env:GITHUB_OUTPUT
  "config=" >> $env:GITHUB_OUTPUT
  "### Unsigned build`nWindows code signing is not set up (missing: $names)." >> $env:GITHUB_STEP_SUMMARY
  exit 0
}

$work = Join-Path $env:RUNNER_TEMP 'earl-signing'
New-Item -ItemType Directory -Force -Path $work | Out-Null

$nupkg = Join-Path $work "$ClientPackage.$ClientVersion.zip"
$url = "https://api.nuget.org/v3-flatcontainer/$ClientPackage/$ClientVersion/$ClientPackage.$ClientVersion.nupkg"
Invoke-WebRequest -Uri $url -OutFile $nupkg -UseBasicParsing
$actual = (Get-FileHash -Algorithm SHA256 -Path $nupkg).Hash.ToLowerInvariant()
if ($actual -ne $ClientSha256) { throw "Signing client hash mismatch: got $actual" }
$client = Join-Path $work 'client'
Expand-Archive -Path $nupkg -DestinationPath $client -Force
$dlib = Join-Path $client 'bin\x64\Azure.CodeSigning.Dlib.dll'
if (-not (Test-Path $dlib)) { throw "Signing dlib not found at $dlib" }

# Newest x64 signtool from the Windows SDK on the runner (the dlib needs 10.0.22621 or later).
$signtool = Get-ChildItem 'C:\Program Files (x86)\Windows Kits\10\bin\*\x64\signtool.exe' |
  Sort-Object { [version]($_.Directory.Parent.Name) } -Descending |
  Select-Object -First 1
if (-not $signtool) { throw 'signtool.exe not found in the Windows SDK' }

# Only EnvironmentCredential (AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET) is tried.
$metadata = Join-Path $work 'metadata.json'
@{
  Endpoint               = $env:AZURE_SIGNING_ENDPOINT
  CodeSigningAccountName = $env:AZURE_SIGNING_ACCOUNT
  CertificateProfileName = $env:AZURE_SIGNING_PROFILE
  ExcludeCredentials     = @(
    'ManagedIdentityCredential', 'WorkloadIdentityCredential', 'SharedTokenCacheCredential',
    'VisualStudioCredential', 'VisualStudioCodeCredential', 'AzureCliCredential',
    'AzurePowerShellCredential', 'AzureDeveloperCliCredential', 'InteractiveBrowserCredential'
  )
} | ConvertTo-Json | Set-Content -Path $metadata -Encoding utf8

"EARL_SIGNTOOL=$($signtool.FullName)" >> $env:GITHUB_ENV
"EARL_SIGN_DLIB=$dlib" >> $env:GITHUB_ENV
"EARL_SIGN_METADATA=$metadata" >> $env:GITHUB_ENV

$config = Join-Path $work 'tauri.signing.conf.json'
@{
  bundle = @{
    windows = @{
      signCommand = @{
        cmd  = 'pwsh'
        args = @('-NoProfile', '-NonInteractive', '-File', (Join-Path $env:GITHUB_ACTION_PATH 'sign.ps1'), '%1')
      }
    }
  }
} | ConvertTo-Json -Depth 6 | Set-Content -Path $config -Encoding utf8

Write-Output "Signing with $($signtool.FullName) and $ClientPackage $ClientVersion"
"enabled=true" >> $env:GITHUB_OUTPUT
"config=$config" >> $env:GITHUB_OUTPUT
