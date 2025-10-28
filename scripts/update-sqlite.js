// scripts/update-sqlite.js
// Utilidad para actualizar/migrar la base de datos SQLite al esquema unificado

const path = require('path');
const CasinoDatabase = require(path.join(__dirname, '..', 'SqulInstrucciones', 'database'));

function run() {
  console.log('============================================');
  console.log('🔧 ACTUALIZANDO SQLite - Esquema Idéntico para Sincronización');
  console.log('============================================');

  const dbPath = process.env.CASINO_DB_PATH || process.env.SQLITE_DB_PATH || path.join(process.cwd(), 'data', 'casino.db');
  const db = new CasinoDatabase(dbPath);

  try {
    // Forzar expiración de vouchers antiguos y asegurar esquema
    db.expireOldVouchers();
    console.log('✅ Esquema verificado y migración legacy aplicada cuando corresponde.');
    console.log('📁 Ruta de base de datos:', db.dbPath);
  } catch (err) {
    console.error('❌ Error durante la actualización:', err.message);
    process.exitCode = 1;
  } finally {
    db.close();
  }
}

if (require.main === module) {
  run();
}

module.exports = run;
