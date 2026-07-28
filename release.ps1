#!/usr/bin/env pwsh
# Create an annotated tag and push it (triggers GitHub Actions -> GHCR build).
# Version is derived entirely from git tags -- no VERSION file or package.json to keep
# in sync, since BleWebler is a static site with no build step or npm dependencies.
# Run from repo root: .\release.ps1 [options] <major|minor|patch|rc> [prerelease]

[CmdletBinding()]
param(
  [Parameter(Mandatory = $false, Position = 0)]
  [ValidateSet('major', 'minor', 'patch', 'rc')]
  [string]$Type = 'patch',

  [Parameter(Mandatory = $false, Position = 1)]
  [string]$PreRelease = '',

  [Alias('k')]
  [switch]$KeepBaseVersion
)

$ErrorActionPreference = 'Stop'

Write-Host 'BleWebler release' -ForegroundColor Cyan
Write-Host '===================================' -ForegroundColor Cyan

$ScriptDir = $PSScriptRoot
Set-Location -LiteralPath $ScriptDir

# Version comes from the latest "vX.Y.Z" tag reachable in this repo. No tags yet?
# Start from 0.0.0 so the chosen bump type (patch/minor/major) sets the first version.
$latestTag = git tag -l 'v*' --sort=-v:refname | Select-Object -First 1
$currentVersion = if ($latestTag) { $latestTag.TrimStart('v') } else { '0.0.0' }

if ($currentVersion -notmatch '^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$') {
  Write-Host "Invalid version derived from latest tag '$latestTag': $currentVersion" -ForegroundColor Red
  exit 1
}

function Get-NextPrerelease {
  param([string]$Existing, [string]$DefaultPrefix = 'rc')

  if ([string]::IsNullOrWhiteSpace($Existing)) {
    return "$($DefaultPrefix)1"
  }

  if ($Existing -match '^([A-Za-z]+)\.?([0-9]+)$') {
    $prefix = $Matches[1]
    $num = [int]$Matches[2]
    return "$prefix$($num + 1)"
  }

  return "$($Existing)1"
}

$currentPrerelease = ''
if ($currentVersion -match '^\d+\.\d+\.\d+-(.+)$') {
  $currentPrerelease = $Matches[1]
}

if ($Type -eq 'rc') {
  $KeepBaseVersion = $true
  if (-not $PreRelease) {
    $PreRelease = Get-NextPrerelease -Existing $currentPrerelease -DefaultPrefix 'rc'
    Write-Host "Auto-incremented prerelease to '$PreRelease'" -ForegroundColor Yellow
  }
}

if ($KeepBaseVersion -and -not $PreRelease) {
  $PreRelease = Get-NextPrerelease -Existing $currentPrerelease -DefaultPrefix 'rc'
  Write-Host "Auto-incremented prerelease to '$PreRelease'" -ForegroundColor Yellow
}

$baseVersion = $currentVersion.Split('-')[0]
$versionParts = $baseVersion -split '\.'
[int]$major = $versionParts[0]
[int]$minor = $versionParts[1]
[int]$patch = $versionParts[2]

function Get-ReleaseInfo {
  param([string]$ReleaseType)

  $newMajor = $major
  $newMinor = $minor
  $newPatch = $patch

  if ($KeepBaseVersion -or $ReleaseType -eq 'rc') {
    $releaseTypeName = 'Prerelease'
    $newVersion = $baseVersion
    if ($PreRelease) {
      $newVersion = "$baseVersion-$PreRelease"
    }
  }
  else {
    switch ($ReleaseType) {
      'major' {
        $newMajor++
        $newMinor = 0
        $newPatch = 0
        $releaseTypeName = 'Major'
      }
      'minor' {
        $newMinor++
        $newPatch = 0
        $releaseTypeName = 'Minor'
      }
      'patch' {
        $newPatch++
        $releaseTypeName = 'Patch'
      }
      Default { throw "Invalid release type: $ReleaseType" }
    }

    $newVersion = "$newMajor.$newMinor.$newPatch"
    if ($PreRelease) {
      $newVersion = "$newVersion-$PreRelease"
    }
  }

  $tag = "v$newVersion"

  return @{
    Version = $newVersion
    Tag     = $tag
    Type    = $releaseTypeName
  }
}

function Confirm-Release {
  param([string]$ReleaseType)

  $releaseInfo = Get-ReleaseInfo $ReleaseType

  Write-Host 'Release Information:' -ForegroundColor Yellow
  Write-Host "  Current Version: $currentVersion" -ForegroundColor White
  Write-Host "  Release Type: $($releaseInfo.Type)" -ForegroundColor White
  Write-Host "  New Version: $($releaseInfo.Version)" -ForegroundColor Green
  Write-Host "  Tag: $($releaseInfo.Tag)" -ForegroundColor Cyan
  if ($PreRelease) {
    Write-Host "  Pre-Release: $PreRelease" -ForegroundColor Cyan
  }
  Write-Host ''

  $existingTags = git tag -l
  if ($existingTags -contains $releaseInfo.Tag) {
    Write-Host "Tag $($releaseInfo.Tag) already exists" -ForegroundColor Red
    return $false
  }

  # Use subexpression so PS7+ does not parse $($releaseInfo.Version)? as a variable name
  Write-Host "Do you want to create $($releaseInfo.Type) release $($releaseInfo.Version)? (y/N)" -ForegroundColor Yellow
  $response = Read-Host

  if ($response -match '^[Yy]$') {
    return $releaseInfo
  }

  return $false
}

$status = git -C $ScriptDir status --porcelain
if ($status) {
  Write-Host 'You have uncommitted changes' -ForegroundColor Yellow
  Write-Host 'Please commit or stash your changes before creating a release.' -ForegroundColor Yellow
  exit 1
}

if (-not $KeepBaseVersion -and $Type -ne 'rc') {
  $releaseTypes = @('patch', 'minor', 'major')
  $currentIndex = 0

  for ($i = 0; $i -lt $releaseTypes.Length; $i++) {
    if ($releaseTypes[$i] -eq $Type) {
      $currentIndex = $i
      break
    }
  }

  $releaseInfo = $null
  for ($i = $currentIndex; $i -lt $releaseTypes.Length; $i++) {
    $releaseType = $releaseTypes[$i]
    $releaseInfo = Confirm-Release $releaseType

    if ($releaseInfo) {
      $Type = $releaseType
      break
    }

    if ($i -lt $releaseTypes.Length - 1) {
      Write-Host 'Trying next release type...' -ForegroundColor Cyan
    }
    else {
      Write-Host 'Release cancelled' -ForegroundColor Yellow
      exit 0
    }
  }

  if (-not $releaseInfo) {
    Write-Host 'Release cancelled' -ForegroundColor Yellow
    exit 0
  }
}
else {
  $releaseInfo = Confirm-Release $Type
  if (-not $releaseInfo) {
    Write-Host 'Release cancelled' -ForegroundColor Yellow
    exit 0
  }
}

$releaseInfo = Get-ReleaseInfo $Type

Write-Host "Creating tag $($releaseInfo.Tag)..." -ForegroundColor Yellow
git tag -a $releaseInfo.Tag -m "$($releaseInfo.Type) release version $($releaseInfo.Version)"

if ($LASTEXITCODE -ne 0) {
  Write-Host 'Failed to create tag' -ForegroundColor Red
  exit 1
}

$currentBranch = (git rev-parse --abbrev-ref HEAD).Trim()
Write-Host "Pushing branch '$currentBranch' and tag to origin..." -ForegroundColor Yellow
git push origin $currentBranch
if ($LASTEXITCODE -ne 0) {
  Write-Host 'Failed to push branch' -ForegroundColor Red
  exit 1
}

git push origin $releaseInfo.Tag
if ($LASTEXITCODE -ne 0) {
  Write-Host 'Failed to push tag' -ForegroundColor Red
  exit 1
}

Write-Host ''
Write-Host "$($releaseInfo.Type) release $($releaseInfo.Version) created and pushed successfully!" -ForegroundColor Green
Write-Host ''
Write-Host 'What happens next (GitHub Actions):' -ForegroundColor Cyan
Write-Host '  1. Workflow runs on tag push (Release)'
Write-Host '  2. Docker image is pushed to GitHub Container Registry (ghcr.io)'
Write-Host '  3. After the job succeeds, pull with:'
Write-Host ''

$remote = ''
try { $remote = (git config --get remote.origin.url).Trim() } catch { $remote = '' }

$owner = ''
$repo = ''
if ($remote -match 'git@github\.com:([^/]+)/([^/.]+)(\.git)?$') {
  $owner = $Matches[1]
  $repo = $Matches[2] -replace '\.git$', ''
}
elseif ($remote -match 'github\.com[:/]([^/]+)/([^/.]+)(\.git)?$') {
  $owner = $Matches[1]
  $repo = $Matches[2] -replace '\.git$', ''
}

if ($owner -and $repo) {
  $ghRepoLc = "$owner/$repo".ToLowerInvariant()
  $imageName = "ghcr.io/$ghRepoLc"
}
else {
  $imageName = 'ghcr.io/<owner>/<repo>'
}

Write-Host "     docker pull ${imageName}:$($releaseInfo.Tag)" -ForegroundColor DarkGray
Write-Host "     docker pull ${imageName}:latest" -ForegroundColor DarkGray
Write-Host ''
if ($owner -and $repo) {
  $repoLc = $repo.ToLowerInvariant()
  Write-Host "Packages: https://github.com/$owner/$repo/pkgs/container/$repoLc" -ForegroundColor Cyan
}
Write-Host ''
