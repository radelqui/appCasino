// Verificar columnas en las bases de datos SQLite
const Database = require('better-sqlite3');
const path = require('path');

console.log('\n=== VERIFICACIÓN DE COLUMNAS EN BASES DE DATOS ===\n');

// Base de datos principal
const mainDbPath = path.join(__dirname, 'data', 'casino.db');
console.log(`📁 Verificando: ${mainDbPath}`);

try {
  const db = new Database(mainDbPath, { readonly: true });

  // Verificar tabla usuarios
  console.log('\n--- Tabla USUARIOS ---');
  const usuariosInfo = db.pragma('table_info(usuarios)');
  const hasUsuariosSincronizado = usuariosInfo.some(col => col.name === 'sincronizado');
  const hasUsuariosEmail = usuariosInfo.some(col => col.name === 'email');

  console.log(`Columna 'sincronizado': ${hasUsuariosSincronizado ? '✅ EXISTE' : '❌ NO EXISTE'}`);
  console.log(`Columna 'email': ${hasUsuariosEmail ? '✅ EXISTE' : '❌ NO EXISTE'}`);

  // Verificar tabla operadores
  console.log('\n--- Tabla OPERADORES ---');
  const operadoresInfo = db.pragma('table_info(operadores)');
  const hasOperadoresSincronizado = operadoresInfo.some(col => col.name === 'sincronizado');

  console.log(`Columna 'sincronizado': ${hasOperadoresSincronizado ? '✅ EXISTE' : '❌ NO EXISTE'}`);

  // Contar registros pendientes (si columnas existen)
  if (hasUsuariosSincronizado) {
    const pendingUsuarios = db.prepare('SELECT COUNT(*) as count FROM usuarios WHERE sincronizado = 0').get();
    console.log(`\n📊 Usuarios pendientes de sincronizar: ${pendingUsuarios.count}`);
  }

  if (hasOperadoresSincronizado) {
    const pendingOperadores = db.prepare('SELECT COUNT(*) as count FROM operadores WHERE sincronizado = 0').get();
    console.log(`📊 Operadores pendientes de sincronizar: ${pendingOperadores.count}`);
  }

  // Listar todas las columnas de usuarios
  console.log('\n--- Todas las columnas de USUARIOS ---');
  usuariosInfo.forEach(col => {
    console.log(`  - ${col.name} (${col.type})`);
  });

  // Listar todas las columnas de operadores
  console.log('\n--- Todas las columnas de OPERADORES ---');
  operadoresInfo.forEach(col => {
    console.log(`  - ${col.name} (${col.type})`);
  });

  db.close();
  console.log('\n✅ Verificación completa');

} catch (error) {
  console.error('❌ Error:', error.message);
}

// Base de datos de Caja
const cajaDbPath = path.join(__dirname, 'Caja', 'data', 'casino.db');
console.log(`\n\n📁 Verificando: ${cajaDbPath}`);

try {
  const db2 = new Database(cajaDbPath, { readonly: true });

  // Verificar tabla usuarios
  console.log('\n--- Tabla USUARIOS ---');
  const usuariosInfo2 = db2.pragma('table_info(usuarios)');
  const hasUsuariosSincronizado2 = usuariosInfo2.some(col => col.name === 'sincronizado');
  const hasUsuariosEmail2 = usuariosInfo2.some(col => col.name === 'email');

  console.log(`Columna 'sincronizado': ${hasUsuariosSincronizado2 ? '✅ EXISTE' : '❌ NO EXISTE'}`);
  console.log(`Columna 'email': ${hasUsuariosEmail2 ? '✅ EXISTE' : '❌ NO EXISTE'}`);

  // Verificar tabla operadores
  console.log('\n--- Tabla OPERADORES ---');
  const operadoresInfo2 = db2.pragma('table_info(operadores)');
  const hasOperadoresSincronizado2 = operadoresInfo2.some(col => col.name === 'sincronizado');

  console.log(`Columna 'sincronizado': ${hasOperadoresSincronizado2 ? '✅ EXISTE' : '❌ NO EXISTE'}`);

  db2.close();
  console.log('\n✅ Verificación completa');

} catch (error) {
  console.error('❌ Error:', error.message);
}

console.log('\n=== FIN DE VERIFICACIÓN ===\n');
