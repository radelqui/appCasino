#!/usr/bin/env node

/**
 * CodeWiki Setup Master Script
 * Setup end-to-end automatizado
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Colors
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(`${colors.cyan}${prompt}${colors.reset}`, (answer) => {
      resolve(answer.trim());
    });
  });
}

function exec(command, silent = true) {
  try {
    const result = execSync(command, {
      encoding: 'utf-8',
      stdio: silent ? 'pipe' : 'inherit'
    });
    return { success: true, output: result };
  } catch (error) {
    return { success: false, error: error.message, output: error.stdout };
  }
}

async function showWelcome() {
  console.clear();
  log('\n╔════════════════════════════════════════════════════════════════╗', 'cyan');
  log('║                                                                ║', 'cyan');
  log('║       🚀 CodeWiki → NotebookLM Setup Wizard 🚀                ║', 'cyan');
  log('║                                                                ║', 'cyan');
  log('║    Automated setup for Markdown → Google Docs sync            ║', 'cyan');
  log('║                                                                ║', 'cyan');
  log('╚════════════════════════════════════════════════════════════════╝', 'cyan');
  log('', 'reset');
  log('This wizard will guide you through:', 'yellow');
  log('  ✓ Prerequisites verification', 'green');
  log('  ✓ GitHub repository setup', 'green');
  log('  ✓ Google Cloud configuration', 'green');
  log('  ✓ Secrets configuration', 'green');
  log('  ✓ First workflow trigger', 'green');
  log('', 'reset');

  const ready = await question('Ready to start? (yes/no): ');
  return ready.toLowerCase() === 'yes' || ready.toLowerCase() === 'y';
}

async function checkPrerequisites() {
  log('\n📋 Step 1: Checking Prerequisites', 'cyan');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');

  const checks = [];

  // Check Git
  log('Checking Git...', 'yellow');
  const gitCheck = exec('git --version');
  if (gitCheck.success) {
    log('  ✓ Git installed', 'green');
    checks.push({ name: 'Git', passed: true });
  } else {
    log('  ✗ Git not installed', 'red');
    checks.push({ name: 'Git', passed: false, error: 'Not installed' });
  }

  // Check Node.js
  log('Checking Node.js...', 'yellow');
  const nodeCheck = exec('node --version');
  if (nodeCheck.success) {
    const version = nodeCheck.output.trim();
    log(`  ✓ Node.js installed (${version})`, 'green');
    checks.push({ name: 'Node.js', passed: true });
  } else {
    log('  ✗ Node.js not installed', 'red');
    checks.push({ name: 'Node.js', passed: false, error: 'Not installed' });
  }

  // Check GitHub CLI
  log('Checking GitHub CLI...', 'yellow');
  const ghCheck = exec('gh --version');
  if (ghCheck.success) {
    const version = ghCheck.output.split('\n')[0];
    log(`  ✓ GitHub CLI installed (${version})`, 'green');

    // Check auth
    const authCheck = exec('gh auth status');
    if (authCheck.success) {
      log('  ✓ GitHub CLI authenticated', 'green');
      checks.push({ name: 'GitHub CLI', passed: true });
    } else {
      log('  ⚠ GitHub CLI not authenticated', 'yellow');
      checks.push({ name: 'GitHub CLI', passed: false, error: 'Not authenticated' });
    }
  } else {
    log('  ✗ GitHub CLI not installed', 'red');
    checks.push({ name: 'GitHub CLI', passed: false, error: 'Not installed' });
  }

  // Check if in git repo
  log('Checking Git repository...', 'yellow');
  const repoCheck = exec('git rev-parse --is-inside-work-tree');
  if (repoCheck.success) {
    log('  ✓ Inside Git repository', 'green');
    checks.push({ name: 'Git Repository', passed: true });
  } else {
    log('  ✗ Not a Git repository', 'red');
    checks.push({ name: 'Git Repository', passed: false, error: 'Not in a repo' });
  }

  // Check if GitHub repo
  log('Checking GitHub remote...', 'yellow');
  const remoteCheck = exec('git remote get-url origin');
  if (remoteCheck.success && remoteCheck.output.includes('github.com')) {
    log('  ✓ GitHub repository detected', 'green');
    checks.push({ name: 'GitHub Remote', passed: true });
  } else {
    log('  ✗ Not a GitHub repository', 'red');
    checks.push({ name: 'GitHub Remote', passed: false, error: 'No GitHub remote' });
  }

  // Summary
  const failed = checks.filter(c => !c.passed);

  if (failed.length > 0) {
    log('\n❌ Prerequisites check failed:', 'red');
    failed.forEach(check => {
      log(`  ✗ ${check.name}: ${check.error}`, 'red');
    });

    log('\n📚 Installation guides:', 'cyan');
    if (failed.some(c => c.name === 'Git')) {
      log('  Git: https://git-scm.com/downloads', 'yellow');
    }
    if (failed.some(c => c.name === 'Node.js')) {
      log('  Node.js: https://nodejs.org/', 'yellow');
    }
    if (failed.some(c => c.name === 'GitHub CLI')) {
      log('  GitHub CLI: https://cli.github.com/', 'yellow');
      log('  After install, run: gh auth login', 'yellow');
    }

    return false;
  }

  log('\n✅ All prerequisites met!', 'green');
  return true;
}

function getRepoInfo() {
  try {
    const remoteUrl = exec('git remote get-url origin').output.trim();
    let match;
    if (remoteUrl.startsWith('https://')) {
      match = remoteUrl.match(/github\.com\/([^\/]+)\/([^\/\.]+)/);
    } else if (remoteUrl.startsWith('git@')) {
      match = remoteUrl.match(/github\.com:([^\/]+)\/([^\/\.]+)/);
    }

    if (match) {
      return {
        owner: match[1],
        repo: match[2],
        full: `${match[1]}/${match[2]}`,
        url: `https://github.com/${match[1]}/${match[2]}`
      };
    }
    return null;
  } catch (error) {
    return null;
  }
}

async function setupGoogleCloud() {
  log('\n☁️  Step 2: Google Cloud Setup', 'cyan');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');

  log('\nYou need:', 'yellow');
  log('  1. Google Cloud Project with Service Account', 'yellow');
  log('  2. Drive API and Docs API enabled', 'yellow');
  log('  3. Service Account JSON key downloaded', 'yellow');
  log('  4. Google Drive folder created and shared with service account', 'yellow');

  log('\n📖 Detailed guide:', 'cyan');
  log('  See: CODEWIKI_SETUP.md (Step 1 & 2)', 'reset');

  const hasSetup = await question('\nHave you completed Google Cloud setup? (yes/no): ');

  if (hasSetup.toLowerCase() !== 'yes' && hasSetup.toLowerCase() !== 'y') {
    log('\n⏸️  Paused. Complete Google Cloud setup first.', 'yellow');
    log('Follow: CODEWIKI_SETUP.md', 'cyan');
    return false;
  }

  return true;
}

async function configureSecrets() {
  log('\n🔐 Step 3: Configure GitHub Secrets', 'cyan');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');

  log('\nWe need:', 'yellow');
  log('  1. Path to Service Account JSON file', 'yellow');
  log('  2. Google Drive Folder ID', 'yellow');

  const useScript = await question('\nUse automated setup script? (yes/no): ');

  if (useScript.toLowerCase() === 'yes' || useScript.toLowerCase() === 'y') {
    log('\n🚀 Running setup-github-secrets.js...', 'cyan');
    const result = exec('node .github/scripts/setup-github-secrets.js', false);

    if (result.success) {
      return true;
    } else {
      log('\n❌ Automated setup failed', 'red');
      return false;
    }
  } else {
    log('\n📖 Manual setup:', 'cyan');
    log('1. Go to: https://github.com/[owner]/[repo]/settings/secrets/actions', 'yellow');
    log('2. Click "New repository secret"', 'yellow');
    log('3. Add GOOGLE_CREDENTIALS (paste entire JSON)', 'yellow');
    log('4. Add GOOGLE_FOLDER_ID (paste folder ID)', 'yellow');

    const done = await question('\nSecrets configured? (yes/no): ');
    return done.toLowerCase() === 'yes' || done.toLowerCase() === 'y';
  }
}

async function verifySetup() {
  log('\n✅ Step 4: Verify Setup', 'cyan');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');

  log('\n🔍 Checking secrets...', 'yellow');
  const secretsCheck = exec('gh secret list');

  if (secretsCheck.success) {
    const output = secretsCheck.output;
    const hasCredentials = output.includes('GOOGLE_CREDENTIALS');
    const hasFolderId = output.includes('GOOGLE_FOLDER_ID');

    if (hasCredentials && hasFolderId) {
      log('  ✓ GOOGLE_CREDENTIALS found', 'green');
      log('  ✓ GOOGLE_FOLDER_ID found', 'green');
      return true;
    } else {
      if (!hasCredentials) log('  ✗ GOOGLE_CREDENTIALS not found', 'red');
      if (!hasFolderId) log('  ✗ GOOGLE_FOLDER_ID not found', 'red');
      return false;
    }
  } else {
    log('  ⚠ Cannot verify secrets (need repo access)', 'yellow');
    const manualConfirm = await question('Are you sure secrets are set? (yes/no): ');
    return manualConfirm.toLowerCase() === 'yes' || manualConfirm.toLowerCase() === 'y';
  }
}

async function triggerFirstRun() {
  log('\n🚀 Step 5: First Workflow Run', 'cyan');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');

  const trigger = await question('\nTrigger workflow now? (yes/no): ');

  if (trigger.toLowerCase() === 'yes' || trigger.toLowerCase() === 'y') {
    log('\n🔄 Triggering workflow...', 'yellow');

    const result = exec('gh workflow run codewiki-sync.yml', false);

    if (result.success) {
      log('\n✅ Workflow triggered!', 'green');

      await new Promise(resolve => setTimeout(resolve, 3000));

      log('\n👀 Opening workflow in browser...', 'cyan');
      exec('gh run view --web', false);

      return true;
    } else {
      log('\n❌ Failed to trigger workflow', 'red');
      return false;
    }
  } else {
    log('\n⏭️  Skipped. You can trigger later with:', 'yellow');
    log('  gh workflow run codewiki-sync.yml', 'reset');
    return true;
  }
}

async function showSummary(repoInfo) {
  log('\n═══════════════════════════════════════════════════', 'green');
  log('✅ Setup Complete!', 'green');
  log('═══════════════════════════════════════════════════', 'green');

  log('\n📝 What was configured:', 'cyan');
  log(`  • Repository: ${repoInfo.full}`, 'yellow');
  log('  • GitHub Secrets: GOOGLE_CREDENTIALS, GOOGLE_FOLDER_ID', 'yellow');
  log('  • Workflow: codewiki-sync.yml', 'yellow');

  log('\n🎯 Next Steps:', 'cyan');
  log('\n1. Test the sync:', 'yellow');
  log('   echo "# Test CodeWiki" > TEST_SYNC.md', 'reset');
  log('   git add TEST_SYNC.md', 'reset');
  log('   git commit -m "test: CodeWiki sync"', 'reset');
  log('   git push', 'reset');

  log('\n2. Monitor workflow:', 'yellow');
  log('   node .github/scripts/manage-workflow.js --watch', 'reset');
  log('   # or', 'reset');
  log('   gh run watch', 'reset');

  log('\n3. Import to NotebookLM:', 'yellow');
  log('   • Go to: https://notebooklm.google.com', 'reset');
  log('   • Create notebook', 'reset');
  log('   • Add source → Google Drive → Select your CodeWiki folder', 'reset');

  log('\n📚 Useful Commands:', 'cyan');
  log('  • List runs:      gh run list --workflow=codewiki-sync.yml', 'yellow');
  log('  • Watch run:      gh run watch', 'yellow');
  log('  • View logs:      gh run view --log', 'yellow');
  log('  • Manage:         node .github/scripts/manage-workflow.js', 'yellow');

  log('\n📖 Documentation:', 'cyan');
  log('  • CODEWIKI_README.md      - Overview', 'yellow');
  log('  • CODEWIKI_SETUP.md       - Detailed setup', 'yellow');
  log('  • CODEWIKI_QUICKSTART.md  - Quick reference', 'yellow');

  log('\n🎉 Happy documenting!', 'green');
  log('', 'reset');
}

async function main() {
  // Welcome
  if (!await showWelcome()) {
    log('\n👋 Setup cancelled', 'yellow');
    rl.close();
    process.exit(0);
  }

  // Prerequisites
  if (!await checkPrerequisites()) {
    rl.close();
    process.exit(1);
  }

  // Get repo info
  const repoInfo = getRepoInfo();
  if (!repoInfo) {
    log('\n❌ Could not determine repository info', 'red');
    rl.close();
    process.exit(1);
  }

  log('\n📦 Repository:', 'cyan');
  log(`  ${repoInfo.full}`, 'yellow');
  log(`  ${repoInfo.url}`, 'reset');

  // Google Cloud setup
  if (!await setupGoogleCloud()) {
    rl.close();
    process.exit(1);
  }

  // Configure secrets
  if (!await configureSecrets()) {
    rl.close();
    process.exit(1);
  }

  // Verify
  if (!await verifySetup()) {
    log('\n❌ Setup verification failed', 'red');
    rl.close();
    process.exit(1);
  }

  // Trigger first run
  await triggerFirstRun();

  // Summary
  await showSummary(repoInfo);

  rl.close();
}

// Run
if (require.main === module) {
  main().catch((error) => {
    log(`\n❌ Error: ${error.message}`, 'red');
    rl.close();
    process.exit(1);
  });
}

module.exports = { main };
