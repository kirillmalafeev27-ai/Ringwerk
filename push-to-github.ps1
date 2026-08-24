[CmdletBinding()]
param(
  [string]$RemoteUrl = "https://github.com/kirillmalafeev27-ai/Ringwerk.git",
  [string]$Branch = "main",
  [string]$Message = "Update Ringwerk"
)

$ErrorActionPreference = "Stop"

function Invoke-Git {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)

  & git @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "Command failed: git $($Arguments -join ' ')"
  }
}

$gitCommand = Get-Command git -ErrorAction SilentlyContinue
if (-not $gitCommand) {
  throw "Git is not installed or is not available in PATH. Install Git for Windows and run this script again."
}

# Work with the project that contains this script, regardless of the terminal's
# current directory. This prevents accidentally initialising or pushing a parent folder.
$projectDirectory = [System.IO.Path]::GetFullPath($PSScriptRoot)
Push-Location -LiteralPath $projectDirectory

try {
  if (-not (Test-Path -LiteralPath (Join-Path $projectDirectory ".git"))) {
    Write-Host "Initialising Git in $projectDirectory"
    Invoke-Git init -b $Branch
  }

  $remoteNames = @(& git remote)
  if ($LASTEXITCODE -ne 0) {
    throw "Could not read the repository remotes."
  }

  if ($remoteNames -contains "origin") {
    $originUrl = Invoke-Git remote get-url origin
    if ($originUrl.Trim() -ne $RemoteUrl) {
      Invoke-Git remote set-url origin $RemoteUrl
      Write-Host "Updated origin: $RemoteUrl"
    }
  } else {
    Invoke-Git remote add origin $RemoteUrl
    Write-Host "Added origin: $RemoteUrl"
  }

  Invoke-Git add --all

  & git diff --cached --quiet
  $diffExitCode = $LASTEXITCODE
  if ($diffExitCode -eq 1) {
    $userName = & git config --get user.name 2>$null
    $nameExitCode = $LASTEXITCODE
    $userEmail = & git config --get user.email 2>$null
    $emailExitCode = $LASTEXITCODE
    if ($nameExitCode -ne 0 -or $emailExitCode -ne 0 -or -not $userName -or -not $userEmail) {
      throw @"
Git needs your author name and email before the first commit. Run:

  git config --global user.name "Your Name"
  git config --global user.email "your-email@example.com"

Then start this script again.
"@
    }
    Invoke-Git commit -m $Message
  } elseif ($diffExitCode -ne 0) {
    throw "Could not inspect staged changes (git diff exit code $diffExitCode)."
  } else {
    Write-Host "Nothing new to commit."
  }

  & git rev-parse --verify HEAD *> $null
  if ($LASTEXITCODE -ne 0) {
    throw "The repository has no commit to push. Add at least one file and run the script again."
  }

  Invoke-Git branch -M $Branch
  Write-Host "Pushing $Branch to GitHub..."
  Invoke-Git push --set-upstream origin $Branch

  Write-Host "Done: $RemoteUrl" -ForegroundColor Green
} finally {
  Pop-Location
}
