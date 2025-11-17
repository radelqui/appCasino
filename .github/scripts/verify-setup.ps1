# CodeWiki Setup Verification Script (PowerShell)
# Verifica que todo esté configurado correctamente antes de hacer push

$ErrorActionPreference = "Continue"

Write-Host "🔍 CodeWiki Setup Verification" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

$Errors = 0
$Warnings = 0

# Function to print status
function Print-Status {
    param (
        [bool]$Success,
        [string]$Message
    )
    if ($Success) {
        Write-Host "✓ $Message" -ForegroundColor Green
    } else {
        Write-Host "✗ $Message" -ForegroundColor Red
        $script:Errors++
    }
}

function Print-Warning {
    param (
        [string]$Message
    )
    Write-Host "⚠ $Message" -ForegroundColor Yellow
    $script:Warnings++
}

Write-Host "📁 Checking files..." -ForegroundColor White
Write-Host "-------------------" -ForegroundColor White

# Check if workflow file exists
if (Test-Path ".github\workflows\codewiki-sync.yml") {
    Print-Status $true "GitHub Actions workflow exists"
} else {
    Print-Status $false "GitHub Actions workflow NOT found"
    Write-Host "   Expected: .github\workflows\codewiki-sync.yml" -ForegroundColor Gray
}

# Check if sync script exists
if (Test-Path ".github\scripts\sync-to-drive.js") {
    Print-Status $true "Sync script exists"
} else {
    Print-Status $false "Sync script NOT found"
    Write-Host "   Expected: .github\scripts\sync-to-drive.js" -ForegroundColor Gray
}

# Check if package.json exists
if (Test-Path ".github\scripts\package.json") {
    Print-Status $true "package.json exists"
} else {
    Print-Status $false "package.json NOT found"
    Write-Host "   Expected: .github\scripts\package.json" -ForegroundColor Gray
}

Write-Host ""
Write-Host "🔐 Checking GitHub Secrets..." -ForegroundColor White
Write-Host "-----------------------------" -ForegroundColor White

# Check if we're in a git repo
try {
    git rev-parse --is-inside-work-tree 2>&1 | Out-Null
    Print-Status $true "Git repository detected"
} catch {
    Print-Status $false "Not a git repository"
    Write-Host "   Run this script from the root of your git repository" -ForegroundColor Gray
    exit 1
}

# Check if we have gh CLI
if (Get-Command gh -ErrorAction SilentlyContinue) {
    Print-Status $true "GitHub CLI (gh) is installed"

    # Check if authenticated
    $ghAuthStatus = gh auth status 2>&1
    if ($LASTEXITCODE -eq 0) {
        Print-Status $true "GitHub CLI is authenticated"

        # Try to list secrets
        Write-Host ""
        Write-Host "   Attempting to check secrets (requires repo admin access)..." -ForegroundColor Gray

        $secrets = gh secret list 2>&1
        if ($LASTEXITCODE -eq 0) {
            if ($secrets -match "GOOGLE_CREDENTIALS") {
                Print-Status $true "GOOGLE_CREDENTIALS secret is set"
            } else {
                Print-Status $false "GOOGLE_CREDENTIALS secret NOT found"
                Write-Host "   Go to: Settings → Secrets and variables → Actions" -ForegroundColor Gray
            }

            if ($secrets -match "GOOGLE_FOLDER_ID") {
                Print-Status $true "GOOGLE_FOLDER_ID secret is set"
            } else {
                Print-Status $false "GOOGLE_FOLDER_ID secret NOT found"
                Write-Host "   Go to: Settings → Secrets and variables → Actions" -ForegroundColor Gray
            }
        } else {
            Print-Warning "Cannot access secrets (need admin permissions)"
            Write-Host "   Manually verify in: Settings → Secrets and variables → Actions" -ForegroundColor Gray
        }
    } else {
        Print-Warning "GitHub CLI not authenticated"
        Write-Host "   Run: gh auth login" -ForegroundColor Gray
    }
} else {
    Print-Warning "GitHub CLI (gh) not installed"
    Write-Host "   Manually verify secrets in: Settings → Secrets and variables → Actions" -ForegroundColor Gray
    Write-Host "   Install gh CLI: https://cli.github.com/" -ForegroundColor Gray
}

Write-Host ""
Write-Host "📝 Checking Markdown files..." -ForegroundColor White
Write-Host "-----------------------------" -ForegroundColor White

# Count markdown files
$mdFiles = Get-ChildItem -Path . -Recurse -Filter "*.md" -File |
    Where-Object {
        $_.FullName -notmatch "node_modules" -and
        $_.FullName -notmatch "\.git" -and
        $_.FullName -notmatch "dist" -and
        $_.FullName -notmatch "build"
    }

$mdCount = $mdFiles.Count

if ($mdCount -gt 0) {
    Print-Status $true "Found $mdCount Markdown files to sync"
    Write-Host ""
    Write-Host "   Files that will be synced:" -ForegroundColor Gray

    $mdFiles | Select-Object -First 10 | ForEach-Object {
        $relativePath = $_.FullName.Replace((Get-Location).Path, ".")
        Write-Host "   - $relativePath" -ForegroundColor Gray
    }

    if ($mdCount -gt 10) {
        Write-Host "   ... and $($mdCount - 10) more" -ForegroundColor Gray
    }
} else {
    Print-Warning "No Markdown files found"
    Write-Host "   The workflow will run but won't sync anything" -ForegroundColor Gray
}

Write-Host ""
Write-Host "🔧 Checking workflow syntax..." -ForegroundColor White
Write-Host "------------------------------" -ForegroundColor White

# Basic YAML syntax check
if (Test-Path ".github\workflows\codewiki-sync.yml") {
    $yamlContent = Get-Content ".github\workflows\codewiki-sync.yml" -Raw

    if ($yamlContent -match "name:") {
        Print-Status $true "Workflow has required 'name' field"
    } else {
        Print-Status $false "Workflow missing 'name' field"
    }

    if ($yamlContent -match "on:") {
        Print-Status $true "Workflow has 'on' trigger field"
    } else {
        Print-Status $false "Workflow missing 'on' trigger field"
    }
}

Write-Host ""
Write-Host "📊 Summary" -ForegroundColor White
Write-Host "==========" -ForegroundColor White

if ($Errors -eq 0 -and $Warnings -eq 0) {
    Write-Host "✅ All checks passed!" -ForegroundColor Green
    Write-Host ""
    Write-Host "You're ready to push and trigger the workflow." -ForegroundColor White
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor White
    Write-Host "1. Commit and push your changes:" -ForegroundColor Gray
    Write-Host "   git add .github/" -ForegroundColor Gray
    Write-Host "   git commit -m 'feat: Add CodeWiki sync pipeline'" -ForegroundColor Gray
    Write-Host "   git push" -ForegroundColor Gray
    Write-Host ""
    Write-Host "2. Check workflow status:" -ForegroundColor Gray
    Write-Host "   gh run list --workflow=codewiki-sync.yml --limit 1" -ForegroundColor Gray
    Write-Host ""
    Write-Host "3. View your docs in Drive:" -ForegroundColor Gray
    Write-Host "   https://drive.google.com/drive/folders/YOUR_FOLDER_ID" -ForegroundColor Gray
    exit 0
} elseif ($Errors -eq 0) {
    Write-Host "⚠ $Warnings warnings (non-critical)" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "You can proceed, but some optional features may not work." -ForegroundColor White
    exit 0
} else {
    Write-Host "❌ $Errors errors, $Warnings warnings" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please fix the errors above before proceeding." -ForegroundColor White
    Write-Host ""
    Write-Host "Need help? Check the documentation:" -ForegroundColor White
    Write-Host "- CODEWIKI_SETUP.md for detailed setup instructions" -ForegroundColor Gray
    Write-Host "- CODEWIKI_QUICKSTART.md for quick start guide" -ForegroundColor Gray
    exit 1
}
