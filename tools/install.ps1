[CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'Low')]
param(
    [string]$DshExe = $env:DSH_DESKTOP_EXE,
    [string]$DshHome = $env:DSH_HOME,
    [string]$PackagePath
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Protect-InstallerOutput([string]$Text) {
    $Text = [regex]::Replace($Text, '(?i)([?&](?:k|token|access_token)=)[^\s&#]+', '$1[hidden]')
    $Text = [regex]::Replace($Text, '(?im)(authorization["'']?\s*[:=]\s*["'']?)(?:Bearer\s+)?[^\s,"''}]+', '$1[hidden]')
    $Text = [regex]::Replace($Text, '(?im)((?:x-companion-token|authorization|token)["'']?\s*[:=]\s*["'']?)[^\s,"''}]+', '$1[hidden]')
    return $Text
}

function ConvertTo-WindowsArgument([string]$Value) {
    # Start-Process joins ArgumentList into one Windows command line. Escape
    # embedded quotes and trailing backslashes before quoting every argument.
    $escaped = [regex]::Replace($Value, '(\\*)"', '$1$1\"')
    $escaped = [regex]::Replace($escaped, '(\\+)$', '$1$1')
    return '"' + $escaped + '"'
}

function Show-InstallerLog([string]$Path) {
    if (Test-Path -LiteralPath $Path -PathType Leaf) {
        foreach ($line in @(Get-Content -LiteralPath $Path -Encoding UTF8 -Tail 60)) {
            if (-not [string]::IsNullOrWhiteSpace($line)) { Write-Host (Protect-InstallerOutput $line) }
        }
    }
}

function Get-InstallerSha256([string]$Path) {
    # Read directly so -WhatIf cannot suppress Windows PowerShell's internal
    # property expansion in Get-FileHash. This function never writes a file.
    $stream = [IO.File]::OpenRead($Path)
    $sha = [Security.Cryptography.SHA256]::Create()
    try { return ([BitConverter]::ToString($sha.ComputeHash($stream))).Replace('-', '').ToLowerInvariant() }
    finally { $sha.Dispose(); $stream.Dispose() }
}

function Test-RemoteControlV04([string]$Version) {
    if ($Version -notmatch '^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$') { throw 'The runtime package has an invalid version.' }
    $baseVersion = [Version](($Version -split '[-+]')[0])
    return $baseVersion -ge [Version]'0.4.0'
}

function Get-RemoteRuntimeArtifacts([string]$Version) {
    $artifacts = @('index.js', 'client.js', 'cordis.patch.yml', 'lib\controller.js', 'lib\store.js', 'lib\transport.js', 'lib\tools.js', 'companion\index.js', 'companion\lib\desktop-backend.mjs')
    if (Test-RemoteControlV04 $Version) {
        $artifacts += @('window.js', 'lib\connection-code.js', 'lib\tunnel.js', 'lib\tunnel-worker.mjs', 'lib\window-manager.js', 'lib\window-page.js', 'companion\lib\control-access.mjs', 'companion\lib\desktop-input.mjs', 'companion\lib\desktop-errors.mjs', 'companion\lib\desktop-helper.mjs', 'companion\lib\desktop-service.mjs', 'companion\lib\desktop-win32.mjs', 'companion\lib\desktop-png.mjs', 'vendor\cloudflared.exe', 'vendor\CLOUDFLARED-LICENSE.txt')
    }
    return $artifacts
}

function Assert-RemoteRuntimeArtifacts([string]$Directory, [string]$Version) {
    foreach ($relative in @(Get-RemoteRuntimeArtifacts $Version)) {
        $artifact = Join-Path $Directory $relative
        if (-not (Test-Path -LiteralPath $artifact -PathType Leaf) -or (Get-Item -LiteralPath $artifact).Length -eq 0) { throw ("Runtime artifact {0} is missing or empty. Extract the complete release, or build and prepare the source package before installing." -f $relative) }
    }
    if ((Test-RemoteControlV04 $Version) -and (Get-InstallerSha256 (Join-Path $Directory 'vendor\cloudflared.exe')) -cne '4d2490e74082c5d48dbfedaf92576fa5bd1702379ab88eb7faa0cfbe8dc891b6') {
        throw 'The secure connection helper failed its integrity check. Re-extract the complete Remote Control release before installing.'
    }
}

function Get-PackedArtifactSha256([string]$Tar, [string]$Archive, [string]$Entry) {
    # Hash the raw binary stream without PowerShell text conversion or extracting
    # into the profile. This also keeps packed -WhatIf verification read-only.
    $info = [Diagnostics.ProcessStartInfo]::new()
    $info.FileName = $Tar
    $info.Arguments = (@('-xOf', $Archive, $Entry) | ForEach-Object { ConvertTo-WindowsArgument $_ }) -join ' '
    $info.UseShellExecute = $false
    $info.CreateNoWindow = $true
    $info.RedirectStandardOutput = $true
    $info.RedirectStandardError = $true
    $process = [Diagnostics.Process]::new()
    $process.StartInfo = $info
    $sha = [Security.Cryptography.SHA256]::Create()
    try {
        if (-not $process.Start()) { throw 'Could not verify the packed connection helper.' }
        $errors = $process.StandardError.ReadToEndAsync()
        $hash = ([BitConverter]::ToString($sha.ComputeHash($process.StandardOutput.BaseStream))).Replace('-', '').ToLowerInvariant()
        $process.WaitForExit()
        $null = $errors.GetAwaiter().GetResult()
        if ($process.ExitCode -ne 0) { throw 'Could not read the packed connection helper.' }
        return $hash
    } finally { $sha.Dispose(); $process.Dispose() }
}

function Get-ReloadGuardPlan([string]$BundleRoot, [string]$HomeDirectory, [string]$ProfileDirectory) {
    $patch = Join-Path $ProfileDirectory 'cordis.patch.yml'
    $text = if (Test-Path -LiteralPath $patch -PathType Leaf) { [IO.File]::ReadAllText($patch) } else { '' }
    $target = Join-Path $HomeDirectory 'patches\file-upload-reload-fix\index.mjs'
    $source = Join-Path $BundleRoot 'tools\reload-fix\index.mjs'
    if ($text.Contains('fileUploadResolverReloadSafe')) { return @{ Required = $false; Patch = $patch; Source = $source; Target = $target } }
    if (-not (Test-Path -LiteralPath $source -PathType Leaf)) { throw 'The required reload guard is missing from tools\reload-fix\index.mjs. Extract the complete release bundle before installing.' }
    if (Test-Path -LiteralPath $target) {
        if (-not (Test-Path -LiteralPath $target -PathType Leaf) -or (Get-InstallerSha256 $source) -cne (Get-InstallerSha256 $target)) {
            throw 'A different reload guard already exists under DSH_HOME\patches\file-upload-reload-fix. It will not be overwritten. Review that local guard before installing.'
        }
    }
    return @{ Required = $true; Patch = $patch; Source = $source; Target = $target }
}

function Install-ReloadGuard($Plan) {
    $text = if (Test-Path -LiteralPath $Plan.Patch -PathType Leaf) { [IO.File]::ReadAllText($Plan.Patch) } else { '' }
    if ($text.Contains('fileUploadResolverReloadSafe')) { return }
    if (Test-Path -LiteralPath $Plan.Target) {
        if (-not (Test-Path -LiteralPath $Plan.Target -PathType Leaf) -or (Get-InstallerSha256 $Plan.Source) -cne (Get-InstallerSha256 $Plan.Target)) { throw 'The existing reload guard changed during installation; no existing guard was overwritten.' }
    } else {
        New-Item -ItemType Directory -Path (Split-Path -Parent $Plan.Target) -Force | Out-Null
        [IO.File]::Copy($Plan.Source, $Plan.Target, $false)
    }
    $uri = ([System.Uri]::new([IO.Path]::GetFullPath($Plan.Target))).AbsoluteUri.Replace("'", "''")
    $lines = @(
        '# DSH 0.2.1-rc.2 compatibility: release the upload resolver on profile reload.',
        '# Keep SessionController behind the guard so startup/reload order is explicit.',
        '- insert:',
        '    - id: file-upload-reload-fix',
        ("      name: '{0}'" -f $uri),
        '- id: session-controller',
        '  inject:',
        '    - fileUploadResolverReloadSafe'
    )
    $prefix = if ($text.Length -gt 0 -and -not $text.EndsWith("`n")) { "`r`n" } else { '' }
    [IO.File]::AppendAllText($Plan.Patch, $prefix + ($lines -join "`r`n") + "`r`n", [Text.UTF8Encoding]::new($false))
    Write-Host ("Installed the reload guard: {0}" -f $Plan.Target)
}

function Assert-InstalledRemoteControl([string]$ProfileDirectory) {
    $manifest = Get-Content -LiteralPath (Join-Path $ProfileDirectory 'package.json') -Raw | ConvertFrom-Json
    $dependencies = $manifest.PSObject.Properties['dependencies']
    $dependency = if ($null -ne $dependencies -and $null -ne $dependencies.Value) { $dependencies.Value.PSObject.Properties['dsh-remote-control'] } else { $null }
    if ($null -eq $dependency -or $dependency.Value -isnot [string] -or [string]::IsNullOrWhiteSpace($dependency.Value)) { throw 'Installation verification failed: the desktop profile has no dsh-remote-control dependency.' }
    $dsh = $manifest.PSObject.Properties['dsh']
    $profile = if ($null -ne $dsh -and $null -ne $dsh.Value) { $dsh.Value.PSObject.Properties['profile'] } else { $null }
    $bundles = if ($null -ne $profile -and $null -ne $profile.Value) { $profile.Value.PSObject.Properties['bundles'] } else { $null }
    if ($null -eq $bundles -or @($bundles.Value) -cnotcontains 'dsh-remote-control') { throw 'Installation verification failed: dsh-remote-control is missing from the desktop profile bundle list.' }
    $installed = Join-Path $ProfileDirectory 'node_modules\dsh-remote-control'
    $installedManifestPath = Join-Path $installed 'package.json'
    if (-not (Test-Path -LiteralPath $installedManifestPath -PathType Leaf)) { throw 'Installation verification failed: the installed runtime package is missing from node_modules.' }
    $installedManifest = Get-Content -LiteralPath $installedManifestPath -Raw | ConvertFrom-Json
    $name = $installedManifest.PSObject.Properties['name']
    if ($null -eq $name -or $name.Value -cne 'dsh-remote-control') { throw 'Installation verification failed: the installed runtime package has an unexpected name.' }
    Assert-RemoteRuntimeArtifacts $installed $installedManifest.version
}

function Get-PackedPackagePlan([string]$Archive, [string]$HomeDirectory) {
    $tar = Join-Path $env:SystemRoot 'System32\tar.exe'
    if (-not (Test-Path -LiteralPath $tar -PathType Leaf)) { throw 'Windows tar.exe is required to unpack the release archive. Use an extracted source bundle with its prebuilt client instead.' }
    $entries = @(& $tar -tf $Archive 2>$null)
    if ($LASTEXITCODE -ne 0 -or $entries.Count -eq 0 -or $entries.Count -gt 4096) { throw 'The selected .tgz is not a readable Remote Control release archive.' }
    foreach ($entry in $entries) {
        $normalized = $entry.Replace('\', '/')
        if ($normalized -notmatch '^package(?:/|$)' -or $normalized.Contains(':') -or $normalized -match '[\x00-\x1f]' -or @($normalized.Split('/') | Where-Object { $_ -eq '..' -or $_ -eq '.' }).Count -gt 0) { throw 'The release archive contains an unsafe file path.' }
    }
    $details = @(& $tar -tvf $Archive 2>$null)
    if ($LASTEXITCODE -ne 0 -or @($details | Where-Object { $_ -notmatch '^[d-]' }).Count -gt 0) { throw 'The release archive must contain only regular files and directories.' }
    $json = @(& $tar -xOf $Archive 'package/package.json' 2>$null) -join "`n"
    if ($LASTEXITCODE -ne 0) { throw 'The release archive is missing package/package.json.' }
    $metadata = $json | ConvertFrom-Json
    if ($metadata.name -cne 'dsh-remote-control' -or $metadata.version -notmatch '^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$') { throw 'The release archive has an unexpected package name or version.' }
    $normalizedEntries = @($entries | ForEach-Object { $_.Replace('\', '/') })
    foreach ($relative in @(Get-RemoteRuntimeArtifacts $metadata.version)) {
        $entryName = 'package/' + $relative.Replace('\', '/')
        if ($normalizedEntries -cnotcontains $entryName) { throw ("The release archive is incomplete: {0} is missing." -f $relative) }
    }
    if ((Test-RemoteControlV04 $metadata.version) -and (Get-PackedArtifactSha256 $tar $Archive 'package/vendor/cloudflared.exe') -cne '4d2490e74082c5d48dbfedaf92576fa5bd1702379ab88eb7faa0cfbe8dc891b6') {
        throw 'The packed secure connection helper failed its integrity check. Use a complete verified Remote Control release.'
    }
    $hash = Get-InstallerSha256 $Archive
    $parent = Join-Path $HomeDirectory 'plugins\dsh-remote-control'
    $target = Join-Path $parent ($metadata.version + '-' + $hash.Substring(0, 16))
    return @{ Archive = $Archive; Tar = $tar; Hash = $hash; Version = $metadata.version; Parent = $parent; Target = $target }
}

function Assert-PackedRuntime($Plan, [string]$Directory) {
    $manifestPath = Join-Path $Directory 'package.json'
    if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) { throw 'The unpacked runtime is missing package.json.' }
    $metadata = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
    if ($metadata.name -cne 'dsh-remote-control' -or $metadata.version -cne $Plan.Version) { throw 'The unpacked runtime package name or version does not match the archive.' }
    Assert-RemoteRuntimeArtifacts $Directory $metadata.version
}

function Install-PackedRuntime($Plan) {
    if (Test-Path -LiteralPath $Plan.Target) {
        $marker = Join-Path $Plan.Target '.archive-sha256'
        if (-not (Test-Path -LiteralPath $marker -PathType Leaf) -or [IO.File]::ReadAllText($marker).Trim() -cne $Plan.Hash) { throw 'The archive runtime cache already exists with unknown content. It will not be overwritten; review that folder before installing.' }
        Assert-PackedRuntime $Plan $Plan.Target
        Write-Host ("Using the existing archive runtime: {0}" -f $Plan.Target)
        return
    }
    New-Item -ItemType Directory -Path $Plan.Parent -Force | Out-Null
    $stage = $Plan.Target + '.staging-' + [Guid]::NewGuid().ToString('N')
    New-Item -ItemType Directory -Path $stage | Out-Null
    try {
        # Extract only into our new staging directory, then publish it locally
        # with an atomic rename. DSH receives a short stable link instead of the
        # pnpm archive-store path that fails during source/archive transitions.
        & $Plan.Tar -xf $Plan.Archive -C $stage --strip-components 1 --no-same-owner --no-same-permissions
        if ($LASTEXITCODE -ne 0) { throw 'Windows tar could not unpack the release archive.' }
        Assert-PackedRuntime $Plan $stage
        [IO.File]::WriteAllText((Join-Path $stage '.archive-sha256'), $Plan.Hash, [Text.UTF8Encoding]::new($false))
        [IO.Directory]::Move($stage, $Plan.Target)
        Write-Host ("Unpacked archive runtime: {0}" -f $Plan.Target)
    } finally {
        $resolvedStage = [IO.Path]::GetFullPath($stage)
        $resolvedParent = [IO.Path]::GetFullPath($Plan.Parent).TrimEnd('\') + '\'
        if ($resolvedStage.StartsWith($resolvedParent, [StringComparison]::OrdinalIgnoreCase) -and (Split-Path $resolvedStage -Leaf).Contains('.staging-') -and (Test-Path -LiteralPath $resolvedStage -PathType Container)) { Remove-Item -LiteralPath $resolvedStage -Recurse -Force -ErrorAction SilentlyContinue }
    }
}

function Invoke-RemoteControlInstall {
    $bundleRoot = Split-Path -Parent $PSScriptRoot
    if ([string]::IsNullOrWhiteSpace($DshExe)) {
        if ([string]::IsNullOrWhiteSpace($env:LOCALAPPDATA)) { throw 'LOCALAPPDATA is unavailable. Run with -DshExe "C:\path\DeepSeek Harness.exe".' }
        $DshExe = Join-Path $env:LOCALAPPDATA 'Programs\DeepSeek Harness\DeepSeek Harness.exe'
    }
    if (-not (Test-Path -LiteralPath $DshExe -PathType Leaf)) { throw 'DeepSeek Harness is not installed at the expected path. Install it first, or pass -DshExe "C:\path\DeepSeek Harness.exe".' }
    $resolvedExe = (Resolve-Path -LiteralPath $DshExe).ProviderPath
    $appRoot = Split-Path -Parent $resolvedExe
    $asar = Join-Path $appRoot 'resources\app.asar'
    if (-not (Test-Path -LiteralPath $asar -PathType Leaf)) { throw 'The selected application does not contain resources\app.asar. Select the installed DeepSeek Harness.exe.' }
    # Electron resolves files inside its ASAR; Windows Test-Path cannot inspect
    # this virtual path. Validate the container above and let its CLI load it.
    $cli = Join-Path $asar 'dsh\node_modules\@deepseek-ai\dsh-desktop-host\lib\cli.js'
    if ([string]::IsNullOrWhiteSpace($DshHome)) { $DshHome = Join-Path ([Environment]::GetFolderPath('UserProfile')) '.dsh' }
    $resolvedHome = [IO.Path]::GetFullPath($DshHome)
    $profile = Join-Path $resolvedHome 'profiles\desktop'
    if (-not (Test-Path -LiteralPath (Join-Path $profile 'package.json') -PathType Leaf)) { throw 'The desktop profile is missing. Open DeepSeek Harness once, then rerun this installer. For a custom home, pass -DshHome "C:\path\to\.dsh".' }

    if ([string]::IsNullOrWhiteSpace($PackagePath)) {
        $dist = Join-Path $bundleRoot 'dist'
        $archives = @()
        if (Test-Path -LiteralPath $dist -PathType Container) {
            $archives = @(Get-ChildItem -LiteralPath $dist -Filter 'dsh-remote-control-*.tgz' -File | Sort-Object LastWriteTimeUtc, Name -Descending)
        }
        $PackagePath = if ($archives.Count -gt 0) { $archives[0].FullName } else { Join-Path $bundleRoot 'packages\remote-control' }
    }
    if ($PackagePath -match '^(?:https?|ftp):|^\\\\') { throw 'PackagePath must be an extracted local source folder or local .tgz file.' }
    if (-not (Test-Path -LiteralPath $PackagePath)) { throw 'The plugin package is missing. Keep tools beside dist or packages\remote-control in the extracted bundle.' }
    $selected = (Resolve-Path -LiteralPath $PackagePath).ProviderPath
    $packedPlan = $null
    if (Test-Path -LiteralPath $selected -PathType Container) {
        $manifest = Join-Path $selected 'package.json'
        if (-not (Test-Path -LiteralPath $manifest -PathType Leaf)) { throw 'The source folder is missing package.json.' }
        $metadata = Get-Content -LiteralPath $manifest -Raw | ConvertFrom-Json
        if ($metadata.name -ne 'dsh-remote-control') { throw 'The source folder is not the dsh-remote-control package.' }
        Assert-RemoteRuntimeArtifacts $selected $metadata.version
        $specifier = 'link:' + $selected
        $kind = 'Source link (keep this folder in place)'
    } else {
        if ([IO.Path]::GetExtension($selected) -ne '.tgz' -or (Get-Item -LiteralPath $selected).Length -eq 0) { throw 'The selected archive must be a nonempty local .tgz file.' }
        $packedPlan = Get-PackedPackagePlan $selected $resolvedHome
        $specifier = 'link:' + $packedPlan.Target
        $kind = 'Packed archive (stable per-user runtime)'
    }

    $cliArguments = @('--expose-internals', $cli, 'plugin', '--profile', 'desktop', 'add', $specifier)
    $argumentLine = ($cliArguments | ForEach-Object { ConvertTo-WindowsArgument $_ }) -join ' '
    $backupParent = Join-Path $resolvedHome 'remote-control\backups'
    $guardPlan = Get-ReloadGuardPlan $bundleRoot $resolvedHome $profile
    Write-Host 'DSH Remote Control installer'
    Write-Host ("Application: {0}" -f $resolvedExe)
    Write-Host ("Profile:     {0}" -f $profile)
    Write-Host ("Package:     {0}" -f $specifier)
    if ($null -ne $packedPlan) { Write-Host ("Archive:     {0}" -f $packedPlan.Archive) }
    Write-Host ("Mode:        {0}" -f $kind)
    Write-Host ("Backups:     {0}" -f $backupParent)
    if ($guardPlan.Required) { Write-Host ("Reload guard: install {0} and append its two profile patch entries after backup." -f $guardPlan.Target) }
    else { Write-Host 'Reload guard: existing profile marker found; preserve its guard and patch exactly.' }
    Write-Host ('Command: ELECTRON_RUN_AS_NODE=1 ' + (ConvertTo-WindowsArgument $resolvedExe) + ' ' + $argumentLine)
    if (-not $PSCmdlet.ShouldProcess($profile, 'Back up profile files and register DSH Remote Control')) { return }

    $stamp = (Get-Date).ToString('yyyyMMdd-HHmmss-fff') + '-' + [Guid]::NewGuid().ToString('N').Substring(0, 8)
    $backup = Join-Path $backupParent ('desktop-' + $stamp)
    New-Item -ItemType Directory -Path $backup -Force | Out-Null
    foreach ($name in @('package.json', 'cordis.patch.yml', 'pnpm-lock.yaml')) {
        $existing = Join-Path $profile $name
        if (Test-Path -LiteralPath $existing -PathType Leaf) { Copy-Item -LiteralPath $existing -Destination (Join-Path $backup $name) -ErrorAction Stop }
    }
    Write-Host ("Profile backup: {0}" -f $backup)
    if ($null -ne $packedPlan) { Install-PackedRuntime $packedPlan }
    if ($guardPlan.Required) { Install-ReloadGuard $guardPlan }
    Write-Host 'Registering the plugin with the bundled DSH CLI...'
    $logBase = Join-Path ([IO.Path]::GetTempPath()) ('dsh-remote-control-install-' + [Guid]::NewGuid().ToString('N'))
    $stdout = $logBase + '.stdout.log'
    $stderr = $logBase + '.stderr.log'
    $oldElectron = [Environment]::GetEnvironmentVariable('ELECTRON_RUN_AS_NODE', 'Process')
    $oldHome = [Environment]::GetEnvironmentVariable('DSH_HOME', 'Process')
    $process = $null
    try {
        [Environment]::SetEnvironmentVariable('ELECTRON_RUN_AS_NODE', '1', 'Process')
        [Environment]::SetEnvironmentVariable('DSH_HOME', $resolvedHome, 'Process')
        $process = Start-Process -FilePath $resolvedExe -ArgumentList $argumentLine -WorkingDirectory $bundleRoot -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr -PassThru
        # Windows PowerShell can lose ExitCode for a GUI-subsystem executable
        # unless its native handle is opened and retained before it exits.
        $retainedHandle = $process.Handle
        $elapsed = [Diagnostics.Stopwatch]::StartNew()
        $nextProgress = 15
        while (-not $process.WaitForExit(1000)) {
            if ($elapsed.Elapsed.TotalSeconds -ge $nextProgress) {
                Write-Host ("Still registering the plugin ({0}s)..." -f [int]$elapsed.Elapsed.TotalSeconds)
                $nextProgress += 15
            }
        }
        $process.WaitForExit()
        $exitCode = $process.ExitCode
        Show-InstallerLog $stdout
        Show-InstallerLog $stderr
        if ($null -eq $exitCode) { throw ("Windows did not provide the DSH command exit status. Your profile backup is at {0}." -f $backup) }
        if ($exitCode -ne 0) { throw ("The DSH plugin command failed with exit code {0}. Your profile backup is at {1}." -f $exitCode, $backup) }
        Assert-InstalledRemoteControl $profile
        Write-Host 'Installation verified: the desktop dependency, bundle registration, and runtime files are present.'
        Write-Host 'Open the Remote Control sidebar entry. If it is missing, close DSH normally and reopen it when your active work is finished.'
        Write-Host 'Device sharing starts off. See docs\SETUP.md to enable it and pair another computer.'
    } finally {
        [Environment]::SetEnvironmentVariable('ELECTRON_RUN_AS_NODE', $oldElectron, 'Process')
        [Environment]::SetEnvironmentVariable('DSH_HOME', $oldHome, 'Process')
        if ($null -ne $process) { $process.Dispose() }
        foreach ($path in @($stdout, $stderr)) { if (Test-Path -LiteralPath $path -PathType Leaf) { Remove-Item -LiteralPath $path -Force -ErrorAction SilentlyContinue } }
    }
}

try { Invoke-RemoteControlInstall }
catch { Write-Error (Protect-InstallerOutput $_.Exception.Message); exit 1 }
