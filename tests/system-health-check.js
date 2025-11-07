#!/usr/bin/env node
/**
 * SYSTEM HEALTH CHECK - Test completo del sistema
 * Detecta problemas que pueden causar bloqueos ANTES de que ocurran
 */
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const Database = require('better-sqlite3');
const path = require('path');

// Colores para output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(emoji, message, color = colors.reset) {
  console.log(`${color}${emoji} ${message}${colors.reset}`);
}

// Resultados globales
const results = {
  passed: 0,
  failed: 0,
  warnings: 0,
  tests: []
};

function addTest(name, status, message = '') {
  results.tests.push({ name, status, message });
  if (status === 'pass') results.passed++;
  else if (status === 'fail') results.failed++;
  else if (status === 'warn') results.warnings++;
}

// ═══════════════════════════════════════════════════════════
// TEST 1: Variables de entorno
// ═══════════════════════════════════════════════════════════
async function testEnvironmentVariables() {
  console.log('\n[TEST 1] Variables de entorno');
  console.log('─'.repeat(60));

  const required = [
    'SUPABASE_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'SUPABASE_ANON_KEY'
  ];

  let allPresent = true;

  for (const varName of required) {
    if (process.env[varName]) {
      log('✅', `${varName}: Configurada`);
    } else {
      log('❌', `${varName}: FALTA`, colors.red);
      allPresent = false;
    }
  }

  if (allPresent) {
    addTest('Variables de entorno', 'pass');
  } else {
    addTest('Variables de entorno', 'fail', 'Faltan variables críticas');
  }

  return allPresent;
}

// ═══════════════════════════════════════════════════════════
// TEST 2: Conexión a Supabase
// ═══════════════════════════════════════════════════════════
async function testSupabaseConnection() {
  console.log('\n[TEST 2] Conexión a Supabase');
  console.log('─'.repeat(60));

  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Test simple query
    const { data, error } = await supabase
      .from('users')
      .select('count')
      .limit(1);

    if (error) {
      log('❌', `Error: ${error.message}`, colors.red);
      addTest('Conexión Supabase', 'fail', error.message);
      return false;
    }

    log('✅', 'Conexión exitosa');
    addTest('Conexión Supabase', 'pass');
    return true;
  } catch (err) {
    log('❌', `Error: ${err.message}`, colors.red);
    addTest('Conexión Supabase', 'fail', err.message);
    return false;
  }
}

// ═══════════════════════════════════════════════════════════
// TEST 3: Constraint de audit_log
// ═══════════════════════════════════════════════════════════
async function testAuditLogConstraint() {
  console.log('\n[TEST 3] Constraint de audit_log');
  console.log('─'.repeat(60));

  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Intentar insertar con action 'voucher_issued'
    const testAction = 'voucher_issued';
    const { data, error } = await supabase
      .from('audit_log')
      .insert({
        action: testAction,
        user_id: '00000000-0000-0000-0000-000000000000',
        details: { test: true, timestamp: new Date().toISOString() }
      })
      .select();

    if (error) {
      if (error.message.includes('violates check constraint')) {
        log('❌', 'Constraint NO actualizado - causará bloqueos!', colors.red);
        log('💡', 'Ejecutar: SqulInstrucciones/fix-audit-log-constraint.sql', colors.yellow);
        addTest('audit_log constraint', 'fail', 'Constraint desactualizado');
        return false;
      } else {
        log('⚠️', `Error inesperado: ${error.message}`, colors.yellow);
        addTest('audit_log constraint', 'warn', error.message);
        return true; // No es el error que buscamos
      }
    }

    // Limpiar el registro de test
    if (data && data[0]) {
      await supabase
        .from('audit_log')
        .delete()
        .eq('id', data[0].id);
    }

    log('✅', 'Constraint actualizado correctamente');
    addTest('audit_log constraint', 'pass');
    return true;
  } catch (err) {
    log('❌', `Error: ${err.message}`, colors.red);
    addTest('audit_log constraint', 'fail', err.message);
    return false;
  }
}

// ═══════════════════════════════════════════════════════════
// TEST 4: SQLite Database
// ═══════════════════════════════════════════════════════════
async function testSQLiteDatabase() {
  console.log('\n[TEST 4] Base de datos SQLite');
  console.log('─'.repeat(60));

  try {
    const dbPath = path.join(__dirname, '..', 'data', 'casino.db');
    const db = new Database(dbPath, { readonly: true });

    // Verificar tablas críticas
    const tables = ['tickets', 'users', 'sessions'];
    let allTablesExist = true;

    for (const table of tables) {
      const result = db.prepare(`
        SELECT name FROM sqlite_master
        WHERE type='table' AND name=?
      `).get(table);

      if (result) {
        log('✅', `Tabla ${table}: Existe`);
      } else {
        log('❌', `Tabla ${table}: NO EXISTE`, colors.red);
        allTablesExist = false;
      }
    }

    // Verificar integridad
    const integrity = db.pragma('integrity_check');
    if (integrity[0].integrity_check === 'ok') {
      log('✅', 'Integridad de BD: OK');
    } else {
      log('❌', 'Integridad de BD: CORRUPTA', colors.red);
      allTablesExist = false;
    }

    db.close();

    if (allTablesExist) {
      addTest('SQLite Database', 'pass');
      return true;
    } else {
      addTest('SQLite Database', 'fail', 'Tablas faltantes o corrupción');
      return false;
    }
  } catch (err) {
    log('❌', `Error: ${err.message}`, colors.red);
    addTest('SQLite Database', 'fail', err.message);
    return false;
  }
}

// ═══════════════════════════════════════════════════════════
// TEST 5: Sync Worker Timeouts
// ═══════════════════════════════════════════════════════════
async function testSyncWorkerConfig() {
  console.log('\n[TEST 5] Configuración de Sync Worker');
  console.log('─'.repeat(60));

  try {
    const mainJs = require('fs').readFileSync(
      path.join(__dirname, '..', 'pure', 'main.js'),
      'utf8'
    );

    // Verificar flag de control
    if (mainJs.includes('syncWorkerRunning')) {
      log('✅', 'Flag de control: Implementado');
    } else {
      log('❌', 'Flag de control: FALTA', colors.red);
      addTest('Sync Worker config', 'fail', 'Falta flag de control');
      return false;
    }

    // Verificar timeout por ticket
    if (mainJs.includes('Promise.race') && mainJs.includes('setTimeout')) {
      log('✅', 'Timeout por ticket: Implementado');
    } else {
      log('⚠️', 'Timeout por ticket: FALTA', colors.yellow);
      addTest('Sync Worker config', 'warn', 'Sin timeout por operación');
      return true;
    }

    addTest('Sync Worker config', 'pass');
    return true;
  } catch (err) {
    log('❌', `Error: ${err.message}`, colors.red);
    addTest('Sync Worker config', 'fail', err.message);
    return false;
  }
}

// ═══════════════════════════════════════════════════════════
// TEST 6: PDF Generator
// ═══════════════════════════════════════════════════════════
async function testPDFGenerator() {
  console.log('\n[TEST 6] Generador de PDF');
  console.log('─'.repeat(60));

  try {
    const pdfLib = require('pdf-lib');
    log('✅', 'pdf-lib: Instalada');

    // Verificar que el generador existe
    const pdfGenPath = path.join(__dirname, '..', 'src', 'main', 'utils', 'pdf-generator.js');
    const fs = require('fs');

    if (fs.existsSync(pdfGenPath)) {
      log('✅', 'pdf-generator.js: Existe');

      // Leer y verificar estructura básica
      const content = fs.readFileSync(pdfGenPath, 'utf8');

      if (content.includes('generateTicketPDF')) {
        log('✅', 'Función generateTicketPDF: Existe');
      } else {
        log('❌', 'Función generateTicketPDF: NO ENCONTRADA', colors.red);
        addTest('PDF Generator', 'fail', 'Función generateTicketPDF falta');
        return false;
      }

      // Verificar manejo de errores
      if (content.includes('try') && content.includes('catch')) {
        log('✅', 'Manejo de errores: Implementado');
      } else {
        log('⚠️', 'Manejo de errores: DÉBIL', colors.yellow);
      }

      addTest('PDF Generator', 'pass');
      return true;
    } else {
      log('❌', 'pdf-generator.js: NO EXISTE', colors.red);
      addTest('PDF Generator', 'fail', 'Archivo pdf-generator.js no existe');
      return false;
    }
  } catch (err) {
    log('❌', `Error: ${err.message}`, colors.red);
    addTest('PDF Generator', 'fail', err.message);
    return false;
  }
}

// ═══════════════════════════════════════════════════════════
// TEST 7: Usuarios de Auth
// ═══════════════════════════════════════════════════════════
async function testAuthUsers() {
  console.log('\n[TEST 7] Usuarios de Auth');
  console.log('─'.repeat(60));

  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

    // Probar login con admin@test.com
    const { data, error } = await supabase.auth.signInWithPassword({
      email: 'admin@test.com',
      password: 'Casino2024!'
    });

    if (error) {
      log('❌', `Login falló: ${error.message}`, colors.red);
      addTest('Usuarios Auth', 'fail', `Login admin@test.com falló: ${error.message}`);
      return false;
    }

    log('✅', 'Login admin@test.com: OK');

    // Sign out
    await supabase.auth.signOut();

    addTest('Usuarios Auth', 'pass');
    return true;
  } catch (err) {
    log('❌', `Error: ${err.message}`, colors.red);
    addTest('Usuarios Auth', 'fail', err.message);
    return false;
  }
}

// ═══════════════════════════════════════════════════════════
// TEST 8: Dependencias NPM
// ═══════════════════════════════════════════════════════════
async function testNPMDependencies() {
  console.log('\n[TEST 8] Dependencias NPM');
  console.log('─'.repeat(60));

  const critical = [
    '@supabase/supabase-js',
    'better-sqlite3',
    'electron',
    'pdf-lib',
    'qrcode'
  ];

  let allInstalled = true;

  for (const pkg of critical) {
    try {
      require(pkg);
      log('✅', `${pkg}: Instalado`);
    } catch (err) {
      log('❌', `${pkg}: NO INSTALADO`, colors.red);
      allInstalled = false;
    }
  }

  if (allInstalled) {
    addTest('Dependencias NPM', 'pass');
    return true;
  } else {
    addTest('Dependencias NPM', 'fail', 'Faltan paquetes críticos');
    log('💡', 'Ejecutar: npm install', colors.yellow);
    return false;
  }
}

// ═══════════════════════════════════════════════════════════
// RESUMEN FINAL
// ═══════════════════════════════════════════════════════════
function printSummary() {
  console.log('\n' + '═'.repeat(60));
  console.log('RESUMEN DE HEALTH CHECK');
  console.log('═'.repeat(60));

  console.log(`\n${colors.green}✅ Passed: ${results.passed}${colors.reset}`);
  console.log(`${colors.red}❌ Failed: ${results.failed}${colors.reset}`);
  console.log(`${colors.yellow}⚠️  Warnings: ${results.warnings}${colors.reset}`);

  const total = results.passed + results.failed + results.warnings;
  const score = Math.round((results.passed / total) * 100);

  console.log(`\n📊 Score: ${score}%`);

  if (results.failed > 0) {
    console.log(`\n${colors.red}❌ SISTEMA CON PROBLEMAS CRÍTICOS${colors.reset}`);
    console.log('\nTests fallidos:');
    results.tests
      .filter(t => t.status === 'fail')
      .forEach(t => {
        console.log(`  - ${t.name}: ${t.message}`);
      });
  } else if (results.warnings > 0) {
    console.log(`\n${colors.yellow}⚠️  SISTEMA CON ADVERTENCIAS${colors.reset}`);
    console.log('\nAdvertencias:');
    results.tests
      .filter(t => t.status === 'warn')
      .forEach(t => {
        console.log(`  - ${t.name}: ${t.message}`);
      });
  } else {
    console.log(`\n${colors.green}✅ SISTEMA SALUDABLE - NO HAY PROBLEMAS${colors.reset}`);
  }

  console.log('\n' + '═'.repeat(60));

  return results.failed === 0;
}

// ═══════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════
async function main() {
  console.log('═'.repeat(60));
  console.log('🏥 SYSTEM HEALTH CHECK');
  console.log('═'.repeat(60));
  console.log('Detectando problemas que pueden causar bloqueos...\n');

  await testEnvironmentVariables();
  await testSupabaseConnection();
  await testAuditLogConstraint();
  await testSQLiteDatabase();
  await testSyncWorkerConfig();
  await testPDFGenerator();
  await testAuthUsers();
  await testNPMDependencies();

  const healthy = printSummary();

  process.exit(healthy ? 0 : 1);
}

main().catch(err => {
  console.error('\n❌ Error fatal en health check:', err.message);
  process.exit(1);
});
