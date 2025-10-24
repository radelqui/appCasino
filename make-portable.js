#!/usr/bin/env node
const { spawnSync } = require('child_process');
const path = require('path');

function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32', ...opts });
  if (res.status !== 0) {
    console.error(`Command failed: ${cmd} ${args.join(' ')}`);
    process.exit(res.status || 1);
  }
}

console.log('[portable] Building React bundle...');
run('npm', ['run', 'react-build']);

console.log('[portable] Packaging Electron app (portable target)...');
run('npx', ['electron-builder', '--config', 'electron-builder.portable.json', '--win', 'portable']);

console.log('[portable] Done. Check the dist/ folder for CasinoVouchers.exe');
