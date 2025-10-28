const Database = require('better-sqlite3');

const dbPath = 'C:\\appCasino\\data\\casino.db';
const db = new Database(dbPath);

// Asegurar llaves foráneas
db.exec('PRAGMA foreign_keys = ON');

// Crear usuario LEGACY si no existe
db.prepare(
  "INSERT OR IGNORE INTO users (id, email, full_name, role, is_active) VALUES ('LEGACY', 'legacy@local', 'Legacy User', 'caja', 1)"
).run();

// Migrar tickets legacy a vouchers evitando duplicados
const migrate = db.prepare(`
  INSERT INTO vouchers (
    id, voucher_code, amount, currency, status,
    qr_data, qr_hash, issued_by_user_id,
    issued_at_station_id, issued_at,
    redeemed_at, expires_at, synced
  )
  SELECT 
    LOWER(HEX(RANDOMBLOB(16))),
    ticket_number,
    valor,
    moneda,
    CASE estado 
      WHEN 'emitido' THEN 'active'
      WHEN 'canjeado' THEN 'redeemed'
      WHEN 'anulado' THEN 'cancelled'
      WHEN 'expirado' THEN 'expired'
      ELSE 'active'
    END,
    qr_data,
    hash_seguridad,
    'LEGACY',
    COALESCE((
      SELECT id FROM stations s 
      WHERE s.station_type = 'mesa' 
        AND s.station_number = CAST(REPLACE(COALESCE(mesa_id, 'P01'), 'P', '') AS INTEGER)
      LIMIT 1
    ), 1),
    created_at,
    redeemed_at,
    datetime(created_at, '+24 hours'),
    sincronizado
  FROM tickets_legacy
  WHERE ticket_number NOT IN (SELECT voucher_code FROM vouchers)
`);

try {
  const result = migrate.run();
  console.log(`✅ Migrados ${result.changes} tickets`);
} catch (err) {
  console.error('❌ Error en migración:', err.message);
}

// Verificar totales
try {
  const count = db.prepare('SELECT COUNT(*) as total FROM vouchers').get();
  console.log(`Total vouchers: ${count.total}`);
} catch (err) {
  console.error('❌ Error al contar vouchers:', err.message);
}

db.close();
