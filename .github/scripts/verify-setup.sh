#!/bin/bash

# CodeWiki Setup Verification Script
# Verifica que todo esté configurado correctamente antes de hacer push

set -e

echo "🔍 CodeWiki Setup Verification"
echo "================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0
WARNINGS=0

# Function to print status
print_status() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓${NC} $2"
    else
        echo -e "${RED}✗${NC} $2"
        ERRORS=$((ERRORS + 1))
    fi
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
    WARNINGS=$((WARNINGS + 1))
}

echo "📁 Checking files..."
echo "-------------------"

# Check if workflow file exists
if [ -f ".github/workflows/codewiki-sync.yml" ]; then
    print_status 0 "GitHub Actions workflow exists"
else
    print_status 1 "GitHub Actions workflow NOT found"
    echo "   Expected: .github/workflows/codewiki-sync.yml"
fi

# Check if sync script exists
if [ -f ".github/scripts/sync-to-drive.js" ]; then
    print_status 0 "Sync script exists"
else
    print_status 1 "Sync script NOT found"
    echo "   Expected: .github/scripts/sync-to-drive.js"
fi

# Check if package.json exists
if [ -f ".github/scripts/package.json" ]; then
    print_status 0 "package.json exists"
else
    print_status 1 "package.json NOT found"
    echo "   Expected: .github/scripts/package.json"
fi

echo ""
echo "🔐 Checking GitHub Secrets..."
echo "-----------------------------"

# Check if we're in a git repo
if ! git rev-parse --is-inside-work-tree > /dev/null 2>&1; then
    print_status 1 "Not a git repository"
    echo "   Run this script from the root of your git repository"
    exit 1
fi

# Check if we have gh CLI
if command -v gh &> /dev/null; then
    print_status 0 "GitHub CLI (gh) is installed"

    # Check if authenticated
    if gh auth status &> /dev/null; then
        print_status 0 "GitHub CLI is authenticated"

        # Try to list secrets (requires admin access)
        echo ""
        echo "   Attempting to check secrets (requires repo admin access)..."

        if gh secret list &> /dev/null; then
            SECRETS=$(gh secret list 2>/dev/null || echo "")

            if echo "$SECRETS" | grep -q "GOOGLE_CREDENTIALS"; then
                print_status 0 "GOOGLE_CREDENTIALS secret is set"
            else
                print_status 1 "GOOGLE_CREDENTIALS secret NOT found"
                echo "   Go to: Settings → Secrets and variables → Actions"
            fi

            if echo "$SECRETS" | grep -q "GOOGLE_FOLDER_ID"; then
                print_status 0 "GOOGLE_FOLDER_ID secret is set"
            else
                print_status 1 "GOOGLE_FOLDER_ID secret NOT found"
                echo "   Go to: Settings → Secrets and variables → Actions"
            fi
        else
            print_warning "Cannot access secrets (need admin permissions)"
            echo "   Manually verify in: Settings → Secrets and variables → Actions"
        fi
    else
        print_warning "GitHub CLI not authenticated"
        echo "   Run: gh auth login"
    fi
else
    print_warning "GitHub CLI (gh) not installed"
    echo "   Manually verify secrets in: Settings → Secrets and variables → Actions"
    echo "   Install gh CLI: https://cli.github.com/"
fi

echo ""
echo "📝 Checking Markdown files..."
echo "-----------------------------"

# Count markdown files
MD_COUNT=$(find . -name "*.md" \
    -not -path "*/node_modules/*" \
    -not -path "*/.git/*" \
    -not -path "*/dist/*" \
    -not -path "*/build/*" \
    2>/dev/null | wc -l | tr -d ' ')

if [ "$MD_COUNT" -gt 0 ]; then
    print_status 0 "Found $MD_COUNT Markdown files to sync"
    echo ""
    echo "   Files that will be synced:"
    find . -name "*.md" \
        -not -path "*/node_modules/*" \
        -not -path "*/.git/*" \
        -not -path "*/dist/*" \
        -not -path "*/build/*" \
        2>/dev/null | head -10 | while read file; do
        echo "   - $file"
    done
    if [ "$MD_COUNT" -gt 10 ]; then
        echo "   ... and $((MD_COUNT - 10)) more"
    fi
else
    print_warning "No Markdown files found"
    echo "   The workflow will run but won't sync anything"
fi

echo ""
echo "🔧 Checking workflow syntax..."
echo "------------------------------"

# Basic YAML syntax check
if [ -f ".github/workflows/codewiki-sync.yml" ]; then
    if command -v yamllint &> /dev/null; then
        if yamllint -d relaxed .github/workflows/codewiki-sync.yml &> /dev/null; then
            print_status 0 "Workflow YAML syntax is valid"
        else
            print_status 1 "Workflow YAML has syntax errors"
            echo "   Run: yamllint .github/workflows/codewiki-sync.yml"
        fi
    else
        print_warning "yamllint not installed (optional)"
        echo "   Install: pip install yamllint"

        # Basic check for obvious issues
        if grep -q "name:" .github/workflows/codewiki-sync.yml; then
            print_status 0 "Workflow has required 'name' field"
        else
            print_status 1 "Workflow missing 'name' field"
        fi
    fi
fi

echo ""
echo "📊 Summary"
echo "=========="

if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✅ All checks passed!${NC}"
    echo ""
    echo "You're ready to push and trigger the workflow."
    echo ""
    echo "Next steps:"
    echo "1. Commit and push your changes:"
    echo "   $ git add .github/"
    echo "   $ git commit -m 'feat: Add CodeWiki sync pipeline'"
    echo "   $ git push"
    echo ""
    echo "2. Check workflow status:"
    echo "   $ gh run list --workflow=codewiki-sync.yml --limit 1"
    echo ""
    echo "3. View your docs in Drive:"
    echo "   https://drive.google.com/drive/folders/YOUR_FOLDER_ID"
    exit 0
elif [ $ERRORS -eq 0 ]; then
    echo -e "${YELLOW}⚠ $WARNINGS warnings (non-critical)${NC}"
    echo ""
    echo "You can proceed, but some optional features may not work."
    exit 0
else
    echo -e "${RED}❌ $ERRORS errors, $WARNINGS warnings${NC}"
    echo ""
    echo "Please fix the errors above before proceeding."
    echo ""
    echo "Need help? Check the documentation:"
    echo "- CODEWIKI_SETUP.md for detailed setup instructions"
    echo "- CODEWIKI_QUICKSTART.md for quick start guide"
    exit 1
fi
