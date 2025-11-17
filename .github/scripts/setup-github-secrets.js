#!/usr/bin/env node

/**
 * Configuración automática de GitHub Secrets
 * Configura GOOGLE_CREDENTIALS y GOOGLE_FOLDER_ID automáticamente
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Colors for console
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
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

async function checkGitHubCLI() {
  try {
    execSync('gh --version', { stdio: 'ignore' });
    return true;
  } catch (error) {
    return false;
  }
}

async function checkGitHubAuth() {
  try {
    execSync('gh auth status', { stdio: 'ignore' });
    return true;
  } catch (error) {
    return false;
  }
}

function getRepoInfo() {
  try {
    const remoteUrl = execSync('git remote get-url origin', { encoding: 'utf-8' }).trim();

    // Parse GitHub URL (https or ssh)
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
        full: `${match[1]}/${match[2]}`
      };
    }

    return null;
  } catch (error) {
    return null;
  }
}

async function setGitHubSecret(secretName, secretValue) {
  try {
    // GitHub CLI requires the secret value via stdin
    const result = execSync(
      `gh secret set ${secretName}`,
      {
        input: secretValue,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe']
      }
    );
    return true;
  } catch (error) {
    log(`Error setting secret ${secretName}: ${error.message}`, 'red');
    return false;
  }
}

async function getGoogleCredentials() {
  log('\n📁 Google Service Account Credentials', 'cyan');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');

  const credentialsPath = await question(
    'Enter path to your Service Account JSON file\n' +
    '(e.g., /path/to/credentials.json): '
  );

  if (!fs.existsSync(credentialsPath)) {
    log('✗ File not found!', 'red');
    return null;
  }

  try {
    const credentials = fs.readFileSync(credentialsPath, 'utf-8');
    JSON.parse(credentials); // Validate JSON
    log('✓ Valid JSON file', 'green');
    return credentials;
  } catch (error) {
    log('✗ Invalid JSON file', 'red');
    return null;
  }
}

async function getGoogleFolderId() {
  log('\n📂 Google Drive Folder', 'cyan');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');
  log('Your folder URL looks like:', 'yellow');
  log('https://drive.google.com/drive/folders/1a2b3c4d5e6f7g8h9i0j', 'yellow');
  log('                                            ^^^^^^^^^^^^^^^^^^^^', 'yellow');
  log('                                            This is the Folder ID\n', 'yellow');

  const folderId = await question('Enter your Google Drive Folder ID: ');

  if (!folderId || folderId.length < 20) {
    log('✗ Invalid Folder ID (too short)', 'red');
    return null;
  }

  log('✓ Folder ID accepted', 'green');
  return folderId;
}

async function main() {
  log('\n🚀 CodeWiki GitHub Secrets Setup', 'magenta');
  log('═══════════════════════════════════════════════════', 'magenta');
  log('This script will configure GitHub secrets automatically\n', 'magenta');

  // Check prerequisites
  log('📋 Checking prerequisites...', 'cyan');

  if (!await checkGitHubCLI()) {
    log('✗ GitHub CLI (gh) not installed', 'red');
    log('\nInstall it from: https://cli.github.com/', 'yellow');
    process.exit(1);
  }
  log('✓ GitHub CLI installed', 'green');

  if (!await checkGitHubAuth()) {
    log('✗ GitHub CLI not authenticated', 'red');
    log('\nRun: gh auth login', 'yellow');
    process.exit(1);
  }
  log('✓ GitHub CLI authenticated', 'green');

  const repoInfo = getRepoInfo();
  if (!repoInfo) {
    log('✗ Not a GitHub repository', 'red');
    log('Run this script from a GitHub repository', 'yellow');
    process.exit(1);
  }
  log(`✓ Repository: ${repoInfo.full}`, 'green');

  // Get credentials
  const credentials = await getGoogleCredentials();
  if (!credentials) {
    log('\n❌ Setup cancelled (invalid credentials)', 'red');
    rl.close();
    process.exit(1);
  }

  const folderId = await getGoogleFolderId();
  if (!folderId) {
    log('\n❌ Setup cancelled (invalid folder ID)', 'red');
    rl.close();
    process.exit(1);
  }

  // Confirm before setting secrets
  log('\n📝 Summary', 'cyan');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');
  log(`Repository:  ${repoInfo.full}`, 'yellow');
  log(`Credentials: ${credentials.length} bytes (JSON)`, 'yellow');
  log(`Folder ID:   ${folderId}`, 'yellow');
  log('', 'reset');

  const confirm = await question('Proceed with setting secrets? (yes/no): ');

  if (confirm.toLowerCase() !== 'yes' && confirm.toLowerCase() !== 'y') {
    log('\n⚠️  Setup cancelled by user', 'yellow');
    rl.close();
    process.exit(0);
  }

  // Set secrets
  log('\n🔐 Setting GitHub secrets...', 'cyan');

  log('Setting GOOGLE_CREDENTIALS...', 'yellow');
  if (await setGitHubSecret('GOOGLE_CREDENTIALS', credentials)) {
    log('✓ GOOGLE_CREDENTIALS set successfully', 'green');
  } else {
    log('✗ Failed to set GOOGLE_CREDENTIALS', 'red');
    rl.close();
    process.exit(1);
  }

  log('Setting GOOGLE_FOLDER_ID...', 'yellow');
  if (await setGitHubSecret('GOOGLE_FOLDER_ID', folderId)) {
    log('✓ GOOGLE_FOLDER_ID set successfully', 'green');
  } else {
    log('✗ Failed to set GOOGLE_FOLDER_ID', 'red');
    rl.close();
    process.exit(1);
  }

  // Success!
  log('\n✅ Setup completed successfully!', 'green');
  log('═══════════════════════════════════════════════════', 'green');
  log('\n📝 Next steps:', 'cyan');
  log('1. Verify secrets are set:', 'yellow');
  log('   gh secret list\n', 'reset');
  log('2. Make a change to any .md file and push:', 'yellow');
  log('   echo "# Test" >> TEST.md', 'reset');
  log('   git add TEST.md', 'reset');
  log('   git commit -m "test: CodeWiki sync"', 'reset');
  log('   git push\n', 'reset');
  log('3. Watch the workflow run:', 'yellow');
  log('   gh run watch\n', 'reset');
  log('4. Check your docs in Google Drive:', 'yellow');
  log(`   https://drive.google.com/drive/folders/${folderId}\n`, 'reset');

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
