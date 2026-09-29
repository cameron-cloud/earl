# run-earl-spike.ps1 - download and start the Earl v2 W0 spike (throwaway test build, not for users).
#
# Paste this one line into Windows PowerShell (no admin needed, works with the default execution policy):
#   irm https://github.com/cameron-cloud/earl/releases/download/spike-w0/run-earl-spike.ps1 | iex
#
# Start options: set EARL_SPIKE_ARGS in the same window first, then run the line above again.
#   $env:EARL_SPIKE_ARGS = '--mode=canvas'      start in canvas mode (default is layers)
#   $env:EARL_SPIKE_ARGS = '--layered-alpha'    fallback if Earl does not show up at all
#   Other flags: --still, --no-hud, --keylog (see SPIKE_W0.md). Several can go in one string.
#   Remove-Item Env:EARL_SPIKE_ARGS             back to normal
#   $env:EARL_SPIKE_INSTALLER = '1'             use the per-user installer instead of the plain exe
#
# Written for Windows PowerShell 5.1. Keep this file plain ASCII: irm decodes a release
# asset as Latin-1, so any other character would arrive garbled. Everything runs inside
# one script block so nothing leaks into the caller's session and no "exit" can close
# the window.

& {
    $ErrorActionPreference = 'Stop'
    $ProgressPreference = 'SilentlyContinue'   # the progress bar makes Invoke-WebRequest very slow in 5.1

    $base     = 'https://github.com/cameron-cloud/earl/releases/download/spike-w0'
    $oneLiner = "irm $base/run-earl-spike.ps1 | iex"
    $docUrl   = 'https://github.com/cameron-cloud/earl/blob/spike/overlay/SPIKE_W0.md'
    $dir      = Join-Path $env:USERPROFILE 'Downloads\earl-spike'

    # SHA-256 of the release assets (CI run 36614346811, commit 06b4e1f on spike/overlay).
    $exeFile   = @{ Name = 'earl-spike.exe';                 Sha = 'FD1EBC2DF525B00EBAEE3057D004EC390174E8AFED42EF8C1B9113B5CB4C371F' }
    $setupFile = @{ Name = 'earl-spike-0.0.1-x64-setup.exe'; Sha = '3E9957985FB46D2987A6BA4FBEF4889A2B2CA6D1647FE4F4CBB0C9EF09725B12' }

    function Get-SpikeFile($f) {
        $path = Join-Path $dir $f.Name
        if ((Test-Path -LiteralPath $path) -and ((Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash -eq $f.Sha)) {
            Write-Host "  $($f.Name) is already downloaded."
        } else {
            Write-Host "  Downloading $($f.Name) ..."
            $part = "$path.part"
            Invoke-WebRequest -Uri "$base/$($f.Name)" -OutFile $part -UseBasicParsing
            $hash = (Get-FileHash -LiteralPath $part -Algorithm SHA256).Hash
            if ($hash -ne $f.Sha) {
                Remove-Item -LiteralPath $part -Force
                throw "$($f.Name) failed its checksum (got $hash). Run the command again."
            }
            Move-Item -LiteralPath $part -Destination $path -Force
        }
        Unblock-File -LiteralPath $path
        return $path
    }

    function Test-WebView2 {
        $id = '{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}'
        foreach ($key in "HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\$id",
                         "HKLM:\SOFTWARE\Microsoft\EdgeUpdate\Clients\$id",
                         "HKCU:\Software\Microsoft\EdgeUpdate\Clients\$id") {
            $pv = (Get-ItemProperty -Path $key -Name pv -ErrorAction SilentlyContinue).pv
            if ($pv -and $pv -ne '0.0.0.0') { return $true }
        }
        return $false
    }

    try {
        Write-Host ''
        Write-Host 'Earl v2 spike (W0 test build)' -ForegroundColor Cyan
        [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
        New-Item -ItemType Directory -Path $dir -Force | Out-Null

        $spikeArgs = @()
        if ($env:EARL_SPIKE_ARGS) { $spikeArgs = @($env:EARL_SPIKE_ARGS -split '\s+' | Where-Object { $_ }) }

        $useInstaller = ($env:EARL_SPIKE_INSTALLER -eq '1')
        if (-not $useInstaller -and -not (Test-WebView2)) {
            Write-Host '  WebView2 runtime not found, so using the per-user installer (it fetches WebView2).'
            $useInstaller = $true
        }

        # Only one duck on screen: close an older spike copy and the normal Earl.
        $old = @(Get-Process -Name 'earl-spike' -ErrorAction SilentlyContinue)
        if ($old.Count -gt 0) {
            Write-Host '  Closing the Earl spike that is already running ...'
            $old | Stop-Process -Force -ErrorAction SilentlyContinue
            $old | Wait-Process -Timeout 10 -ErrorAction SilentlyContinue
        }
        $v1 = @(Get-Process -Name 'earl' -ErrorAction SilentlyContinue)
        if ($v1.Count -gt 0) {
            Write-Host '  Closing the normal Earl (start him again from the Start menu when you are done) ...'
            $v1 | Stop-Process -Force -ErrorAction SilentlyContinue
        }

        $exe = Get-SpikeFile $exeFile

        if ($useInstaller) {
            $setup = Get-SpikeFile $setupFile
            Write-Host '  Installing Earl Spike for this user only (no admin needed) ...'
            $inst = Start-Process -FilePath $setup -ArgumentList '/S' -Wait -PassThru
            if ($inst.ExitCode -ne 0) { throw "The installer failed (exit code $($inst.ExitCode))." }
            $candidates = @()
            $uninst = Get-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\Earl Spike' -ErrorAction SilentlyContinue
            if ($uninst -and $uninst.InstallLocation) { $candidates += Join-Path $uninst.InstallLocation.Trim('"') 'earl-spike.exe' }
            $candidates += Join-Path $env:LOCALAPPDATA 'Earl Spike\earl-spike.exe'
            $candidates += Join-Path $env:LOCALAPPDATA 'Programs\Earl Spike\earl-spike.exe'
            $installed = $candidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
            if (-not $installed) { throw 'Installed, but could not find earl-spike.exe. Start "Earl Spike" from the Start menu.' }
            $exe = $installed
        }

        $shown = if ($spikeArgs.Count -gt 0) { " $($spikeArgs -join ' ')" } else { '' }
        Write-Host "  Starting $exe$shown"
        $startParams = @{ FilePath = $exe; WorkingDirectory = (Split-Path -Parent $exe); PassThru = $true }
        if ($spikeArgs.Count -gt 0) { $startParams.ArgumentList = $spikeArgs }
        $proc = Start-Process @startParams

        try { Start-Process $docUrl } catch { Write-Host "  Open the checklist yourself: $docUrl" }

        Start-Sleep -Seconds 4
        if ($proc.HasExited) {
            Write-Host ''
            Write-Host "The spike closed right after starting (exit code $($proc.ExitCode))." -ForegroundColor Yellow
            Write-Host '  Try the fallback: $env:EARL_SPIKE_ARGS = ''--layered-alpha'', then run the command again.'
            Write-Host '  Or the installer: $env:EARL_SPIKE_INSTALLER = ''1'', then run the command again.'
        }

        Write-Host ''
        Write-Host 'Next steps' -ForegroundColor Green
        Write-Host '  1. If Windows says "Windows protected your PC": click More info > Run anyway.'
        Write-Host '  2. Earl walks along the taskbar. His tray icon may hide under the ^ arrow near the clock.'
        Write-Host '  3. Switch modes: tray icon > Renderer: layers / Renderer: canvas (starts in layers).'
        Write-Host '  4. Quit: tray icon > Quit Earl spike.'
        Write-Host '  5. Work through the checklist that just opened in your browser and send back the results table.'
        Write-Host ''
        Write-Host 'Start options (type one in this window, then run the command again)' -ForegroundColor Green
        Write-Host '  $env:EARL_SPIKE_ARGS = ''--mode=canvas''     start in canvas mode'
        Write-Host '  $env:EARL_SPIKE_ARGS = ''--layered-alpha''   if Earl does not show up at all (note it in the table)'
        Write-Host '  Remove-Item Env:EARL_SPIKE_ARGS             back to normal'
        Write-Host "  The command: $oneLiner"
        Write-Host "  Files: $dir"
        Write-Host ''
    } catch {
        Write-Host ''
        Write-Host "Earl spike did not start: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "  Files: $dir"
        Write-Host "  Try again with: $oneLiner" -ForegroundColor Yellow
        Write-Host ''
    }
}
