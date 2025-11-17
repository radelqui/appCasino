#!/usr/bin/env node

/**
 * Gestión de Workflow de CodeWiki
 * - Ejecutar workflow manualmente
 * - Monitorear workflow en tiempo real
 * - Ver historial de ejecuciones
 */

const { execSync } = require('child_process');
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
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function exec(command, silent = false) {
  try {
    const result = execSync(command, {
      encoding: 'utf-8',
      stdio: silent ? 'pipe' : 'inherit'
    });
    return { success: true, output: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function checkGitHubCLI() {
  const result = exec('gh --version', true);
  return result.success;
}

function checkGitHubAuth() {
  const result = exec('gh auth status', true);
  return result.success;
}

async function listWorkflowRuns() {
  log('\n📊 Recent Workflow Runs', 'cyan');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');

  const result = exec(
    'gh run list --workflow=codewiki-sync.yml --limit 10',
    false
  );

  if (!result.success) {
    log('✗ Failed to fetch workflow runs', 'red');
    return null;
  }

  return result;
}

async function getLatestRun() {
  const result = exec(
    'gh run list --workflow=codewiki-sync.yml --limit 1 --json databaseId,status,conclusion,createdAt,headBranch',
    true
  );

  if (!result.success) {
    return null;
  }

  try {
    const runs = JSON.parse(result.output);
    return runs[0] || null;
  } catch (error) {
    return null;
  }
}

async function triggerWorkflow() {
  log('\n🚀 Triggering Workflow', 'cyan');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');

  const result = exec('gh workflow run codewiki-sync.yml', false);

  if (result.success) {
    log('\n✓ Workflow triggered successfully!', 'green');
    log('\nWaiting for workflow to start...', 'yellow');

    // Wait a bit for workflow to appear
    await new Promise(resolve => setTimeout(resolve, 3000));

    const latestRun = await getLatestRun();
    if (latestRun) {
      log(`\n📝 Run ID: ${latestRun.databaseId}`, 'cyan');
      log(`📅 Started: ${new Date(latestRun.createdAt).toLocaleString()}`, 'cyan');
      log(`🌿 Branch: ${latestRun.headBranch}`, 'cyan');
      log(`⏳ Status: ${latestRun.status}`, 'yellow');

      log('\nTo watch in real-time, run:', 'yellow');
      log(`  gh run watch ${latestRun.databaseId}`, 'reset');
      log('\nOr view in browser:', 'yellow');
      log('  gh run view --web', 'reset');
    }
  } else {
    log('\n✗ Failed to trigger workflow', 'red');
    log('Make sure you have push permissions to the repository', 'yellow');
  }

  return result.success;
}

async function watchWorkflow() {
  log('\n👀 Watching Latest Workflow', 'cyan');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');

  const latestRun = await getLatestRun();

  if (!latestRun) {
    log('✗ No workflow runs found', 'red');
    log('Trigger a workflow first:', 'yellow');
    log('  node manage-workflow.js --trigger', 'reset');
    return;
  }

  log(`\n📝 Watching Run ID: ${latestRun.databaseId}`, 'cyan');
  log(`📅 Started: ${new Date(latestRun.createdAt).toLocaleString()}`, 'cyan');
  log(`🌿 Branch: ${latestRun.headBranch}\n`, 'cyan');

  const result = exec(`gh run watch ${latestRun.databaseId}`, false);

  if (result.success) {
    log('\n✅ Workflow completed!', 'green');

    // Show summary
    log('\n📊 Viewing workflow summary...', 'cyan');
    exec(`gh run view ${latestRun.databaseId}`, false);
  }
}

async function viewWorkflowLogs() {
  log('\n📜 Latest Workflow Logs', 'cyan');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');

  const latestRun = await getLatestRun();

  if (!latestRun) {
    log('✗ No workflow runs found', 'red');
    return;
  }

  log(`\n📝 Run ID: ${latestRun.databaseId}`, 'cyan');
  log(`📅 Started: ${new Date(latestRun.createdAt).toLocaleString()}`, 'cyan');
  log(`⏳ Status: ${latestRun.status}`, 'yellow');
  log(`📋 Conclusion: ${latestRun.conclusion || 'In progress'}\n`, 'yellow');

  exec(`gh run view ${latestRun.databaseId} --log`, false);
}

async function showMenu() {
  log('\n🔧 CodeWiki Workflow Manager', 'magenta');
  log('═══════════════════════════════════════════════════', 'magenta');
  log('\nWhat would you like to do?\n', 'cyan');
  log('1. List recent workflow runs', 'yellow');
  log('2. Trigger workflow manually', 'yellow');
  log('3. Watch latest workflow (live)', 'yellow');
  log('4. View latest workflow logs', 'yellow');
  log('5. Open latest workflow in browser', 'yellow');
  log('0. Exit\n', 'yellow');

  return new Promise((resolve) => {
    rl.question(`${colors.cyan}Select an option: ${colors.reset}`, (answer) => {
      resolve(answer.trim());
    });
  });
}

async function openInBrowser() {
  log('\n🌐 Opening in Browser', 'cyan');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');

  const result = exec('gh run view --web', false);

  if (!result.success) {
    log('✗ Failed to open browser', 'red');
  }
}

async function interactiveMode() {
  let running = true;

  while (running) {
    const choice = await showMenu();

    switch (choice) {
      case '1':
        await listWorkflowRuns();
        break;

      case '2':
        await triggerWorkflow();
        break;

      case '3':
        await watchWorkflow();
        break;

      case '4':
        await viewWorkflowLogs();
        break;

      case '5':
        await openInBrowser();
        break;

      case '0':
        log('\n👋 Goodbye!', 'cyan');
        running = false;
        break;

      default:
        log('\n⚠️  Invalid option', 'red');
    }

    if (running) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  rl.close();
}

async function main() {
  const args = process.argv.slice(2);

  // Check prerequisites
  if (!checkGitHubCLI()) {
    log('✗ GitHub CLI (gh) not installed', 'red');
    log('Install from: https://cli.github.com/', 'yellow');
    process.exit(1);
  }

  if (!checkGitHubAuth()) {
    log('✗ GitHub CLI not authenticated', 'red');
    log('Run: gh auth login', 'yellow');
    process.exit(1);
  }

  // Parse arguments
  if (args.length === 0) {
    // Interactive mode
    await interactiveMode();
  } else {
    // CLI mode
    const command = args[0];

    switch (command) {
      case '--list':
      case '-l':
        await listWorkflowRuns();
        rl.close();
        break;

      case '--trigger':
      case '-t':
        await triggerWorkflow();
        rl.close();
        break;

      case '--watch':
      case '-w':
        await watchWorkflow();
        rl.close();
        break;

      case '--logs':
        await viewWorkflowLogs();
        rl.close();
        break;

      case '--browser':
      case '-b':
        await openInBrowser();
        rl.close();
        break;

      case '--help':
      case '-h':
        log('\n🔧 CodeWiki Workflow Manager', 'magenta');
        log('═══════════════════════════════════════════════════', 'magenta');
        log('\nUsage:', 'cyan');
        log('  node manage-workflow.js [option]\n', 'yellow');
        log('Options:', 'cyan');
        log('  --list, -l       List recent workflow runs', 'yellow');
        log('  --trigger, -t    Trigger workflow manually', 'yellow');
        log('  --watch, -w      Watch latest workflow (live)', 'yellow');
        log('  --logs           View latest workflow logs', 'yellow');
        log('  --browser, -b    Open latest workflow in browser', 'yellow');
        log('  --help, -h       Show this help message', 'yellow');
        log('\nInteractive mode:', 'cyan');
        log('  node manage-workflow.js', 'yellow');
        log('  (no arguments = interactive menu)\n', 'reset');
        rl.close();
        break;

      default:
        log(`\n✗ Unknown option: ${command}`, 'red');
        log('Run with --help for usage', 'yellow');
        rl.close();
        process.exit(1);
    }
  }
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
