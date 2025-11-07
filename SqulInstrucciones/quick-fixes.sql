-- ═══════════════════════════════════════════════════════════════════════════
-- CORRECCIONES RÁPIDAS - Ejecutar si hay errores
-- ═══════════════════════════════════════════════════════════════════════════

-- Si el script completo falla, puedes ejecutar estas secciones individualmente

-- ═══════════════════════════════════════════════════════════════════════════
-- SECCIÓN 1: Solo agregar columnas (lo más básico)
-- ═══════════════════════════════════════════════════════════════════════════

-- Operadores
ALTER TABLE operadores ADD COLUMN IF NOT EXISTS codigo TEXT;
ALTER TABLE operadores ADD COLUMN IF NOT EXISTS pin TEXT;
ALTER TABLE operadores ADD COLUMN IF NOT EXISTS mesa_asignada TEXT;

-- Vouchers
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS qr_data TEXT;
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS qr_hash TEXT;
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS mesa_nombre TEXT;
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS operador_nombre TEXT;
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS customer_notes TEXT;

-- Audit Log
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS station_id BIGINT;
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS ip_address TEXT;

-- ═══════════════════════════════════════════════════════════════════════════
-- SECCIÓN 2: Crear índices básicos
-- ═══════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_operadores_codigo ON operadores(codigo);
CREATE INDEX IF NOT EXISTS idx_vouchers_mesa_nombre ON vouchers(mesa_nombre);
CREATE INDEX IF NOT EXISTS idx_vouchers_qr_hash ON vouchers(qr_hash);
CREATE INDEX IF NOT EXISTS idx_audit_log_station_id ON audit_log(station_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_event_type ON audit_log(event_type);

-- ═══════════════════════════════════════════════════════════════════════════
-- SECCIÓN 3: Actualizar datos (OPCIONAL - ejecutar después)
-- ═══════════════════════════════════════════════════════════════════════════

-- Asignar códigos a operadores que no tienen
UPDATE operadores
SET codigo = 'OP' || LPAD(id::TEXT, 3, '0')
WHERE codigo IS NULL;

-- Asignar PINs temporales (cambiar después)
UPDATE operadores
SET pin = '1234'
WHERE pin IS NULL AND activo = true;

-- Actualizar mesa_nombre desde stations
UPDATE vouchers v
SET mesa_nombre = s.station_number
FROM stations s
WHERE v.issued_at_station_id = s.id
  AND v.mesa_nombre IS NULL
  AND s.station_type = 'mesa';

-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFICACIÓN RÁPIDA
-- ═══════════════════════════════════════════════════════════════════════════

-- Ver columnas de operadores
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'operadores'
ORDER BY ordinal_position;

-- Ver columnas de vouchers
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'vouchers'
ORDER BY ordinal_position;

-- Ver columnas de audit_log
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'audit_log'
ORDER BY ordinal_position;
