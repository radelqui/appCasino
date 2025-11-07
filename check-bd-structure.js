// Script para verificar estructura completa de bases de datos
require('dotenv').config();
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

console.log('═══════════════════════════════════════════════════════');
console.log('  VERIFICACIÓN DE ESTRUCTURA DE BASES DE DATOS');
console.log('═══════════════════════════════════════════════════════\n');

// ============================================
// 1. VERIFICAR SQLite
// ============================================
console.log('📦 SQLITE LOCAL\n');

try {
  const CasinoDatabase = require('./Caja/database');
  const dbPath = process.env.CASINO_DB_PATH || process.env.SQLITE_DB_PATH || path.join(process.cwd(), 'data', 'casino.db');

  console.log('Ruta:', dbPath);
  console.log('');

  const db = new CasinoDatabase(dbPath);

  // Verificar columnas de tickets
  console.log('─── TABLA: tickets ───');
  const ticketCols = db.db.prepare("PRAGMA table_info('tickets')").all();
  const ticketColNames = ticketCols.map(c => c.name);
  console.log('Columnas:', ticketColNames.join(', '));
  console.log('✓ sincronizado:', ticketColNames.includes('sincronizado') ? 'SÍ' : 'NO');

  const ticketCount = db.db.prepare('SELECT COUNT(*) as count FROM tickets').get();
  const ticketPending = db.db.prepare('SELECT COUNT(*) as count FROM tickets WHERE sincronizado = 0').get();
  console.log('Total tickets:', ticketCount.count);
  console.log('Pendientes sincronizar:', ticketPending.count);
  console.log('');

  // Verificar columnas de usuarios
  console.log('─── TABLA: usuarios ───');
  const userCols = db.db.prepare("PRAGMA table_info('usuarios')").all();
  const userColNames = userCols.map(c => c.name);
  console.log('Columnas:', userColNames.join(', '));
  console.log('✓ sincronizado:', userColNames.includes('sincronizado') ? 'SÍ' : 'NO');
  console.log('✓ email:', userColNames.includes('email') ? 'SÍ' : 'NO');

  try {
    const userCount = db.db.prepare('SELECT COUNT(*) as count FROM usuarios').get();
    const userPending = db.db.prepare('SELECT COUNT(*) as count FROM usuarios WHERE sincronizado = 0').get();
    console.log('Total usuarios:', userCount.count);
    console.log('Pendientes sincronizar:', userPending.count);

    // Mostrar usuarios pendientes
    if (userPending.count > 0) {
      const pendingUsers = db.db.prepare('SELECT id, username, role, sincronizado, email FROM usuarios WHERE sincronizado = 0 LIMIT 5').all();
      console.log('\nUsuarios pendientes:');
      pendingUsers.forEach(u => {
        console.log(`  - ${u.username} (${u.role}) [email: ${u.email || 'NULL'}]`);
      });
    }
  } catch (e) {
    console.log('Error columna sincronizado:', e.message);
  }
  console.log('');

  // Verificar columnas de operadores
  console.log('─── TABLA: operadores ───');
  const opCols = db.db.prepare("PRAGMA table_info('operadores')").all();
  const opColNames = opCols.map(c => c.name);
  console.log('Columnas:', opColNames.join(', '));
  console.log('✓ sincronizado:', opColNames.includes('sincronizado') ? 'SÍ' : 'NO');

  try {
    const opCount = db.db.prepare('SELECT COUNT(*) as count FROM operadores').get();
    const opPending = db.db.prepare('SELECT COUNT(*) as count FROM operadores WHERE sincronizado = 0').get();
    console.log('Total operadores:', opCount.count);
    console.log('Pendientes sincronizar:', opPending.count);

    // Mostrar operadores pendientes
    if (opPending.count > 0) {
      const pendingOps = db.db.prepare('SELECT id, codigo, nombre, sincronizado FROM operadores WHERE sincronizado = 0 LIMIT 5').all();
      console.log('\nOperadores pendientes:');
      pendingOps.forEach(op => {
        console.log(`  - ${op.codigo}: ${op.nombre}`);
      });
    }
  } catch (e) {
    console.log('Error columna sincronizado:', e.message);
  }

  db.close();

} catch (error) {
  console.error('❌ Error accediendo a SQLite:', error.message);
}

console.log('\n═══════════════════════════════════════════════════════\n');

// ============================================
// 2. VERIFICAR SUPABASE
// ============================================
console.log('☁️  SUPABASE CLOUD\n');

(async () => {
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Vouchers
    const { data: vouchers, error: vErr, count: vCount } = await supabase
      .from('vouchers')
      .select('*', { count: 'exact', head: true });

    console.log('─── TABLA: vouchers ───');
    console.log('Total:', vCount || 0);
    console.log('Error:', vErr ? vErr.message : 'Ninguno');
    console.log('');

    // Users
    const { data: users, error: uErr, count: uCount } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });

    console.log('─── TABLA: users ───');
    console.log('Total:', uCount || 0);
    console.log('Error:', uErr ? uErr.message : 'Ninguno');

    // Mostrar primeros 5 usuarios
    const { data: userList } = await supabase
      .from('users')
      .select('email, full_name, role')
      .limit(5);

    if (userList && userList.length > 0) {
      console.log('\nUsuarios en Supabase:');
      userList.forEach(u => {
        console.log(`  - ${u.email} (${u.full_name}) [${u.role}]`);
      });
    }
    console.log('');

    // Operadores
    const { data: ops, error: oErr, count: oCount } = await supabase
      .from('operadores')
      .select('*', { count: 'exact', head: true });

    console.log('─── TABLA: operadores ───');
    console.log('Total:', oCount || 0);
    console.log('Error:', oErr ? oErr.message : 'Ninguno');

    // Mostrar primeros operadores
    const { data: opList } = await supabase
      .from('operadores')
      .select('codigo, nombre, activo')
      .limit(5);

    if (opList && opList.length > 0) {
      console.log('\nOperadores en Supabase:');
      opList.forEach(op => {
        console.log(`  - ${op.codigo}: ${op.nombre} [${op.activo ? 'Activo' : 'Inactivo'}]`);
      });
    }

    console.log('\n═══════════════════════════════════════════════════════\n');

    // Resumen
    console.log('📊 RESUMEN COMPARATIVO\n');
    console.log('┌─────────────────┬──────────┬──────────┬──────────────┐');
    console.log('│ Tabla           │ SQLite   │ Supabase │ Pendientes   │');
    console.log('├─────────────────┼──────────┼──────────┼──────────────┤');

    const CasinoDatabase = require('./Caja/database');
    const dbPath = process.env.CASINO_DB_PATH || process.env.SQLITE_DB_PATH || path.join(process.cwd(), 'data', 'casino.db');
    const db = new CasinoDatabase(dbPath);

    const tCount = db.db.prepare('SELECT COUNT(*) as count FROM tickets').get().count;
    const tPending = db.db.prepare('SELECT COUNT(*) as count FROM tickets WHERE sincronizado = 0').get().count;
    const uCountLocal = db.db.prepare('SELECT COUNT(*) as count FROM usuarios').get().count;
    let uPendingLocal = 0;
    try {
      uPendingLocal = db.db.prepare('SELECT COUNT(*) as count FROM usuarios WHERE sincronizado = 0').get().count;
    } catch (e) {}
    const oCountLocal = db.db.prepare('SELECT COUNT(*) as count FROM operadores').get().count;
    let oPendingLocal = 0;
    try {
      oPendingLocal = db.db.prepare('SELECT COUNT(*) as count FROM operadores WHERE sincronizado = 0').get().count;
    } catch (e) {}

    console.log(`│ Tickets/Vouchers│ ${String(tCount).padStart(8)} │ ${String(vCount || 0).padStart(8)} │ ${String(tPending).padStart(12)} │`);
    console.log(`│ Usuarios        │ ${String(uCountLocal).padStart(8)} │ ${String(uCount || 0).padStart(8)} │ ${String(uPendingLocal).padStart(12)} │`);
    console.log(`│ Operadores      │ ${String(oCountLocal).padStart(8)} │ ${String(oCount || 0).padStart(8)} │ ${String(oPendingLocal).padStart(12)} │`);
    console.log('└─────────────────┴──────────┴──────────┴──────────────┘');

    db.close();

  } catch (error) {
    console.error('❌ Error accediendo a Supabase:', error.message);
  }
})();
