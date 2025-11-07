-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRACIÓN MÍNIMA Y SEGURA
-- Solo agrega lo estrictamente necesario
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════
-- PASO 1: AGREGAR COLUMNAS A OPERADORES
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE operadores ADD COLUMN IF NOT EXISTS codigo TEXT;
ALTER TABLE operadores ADD COLUMN IF NOT EXISTS pin TEXT;
ALTER TABLE operadores ADD COLUMN IF NOT EXISTS mesa_asignada TEXT;

-- ═══════════════════════════════════════════════════════════════════════════
-- PASO 2: AGREGAR COLUMNAS A VOUCHERS
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS qr_data TEXT;
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS qr_hash TEXT;
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS mesa_nombre TEXT;
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS operador_nombre TEXT;
ALTER TABLE vouchers ADD COLUMN IF NOT EXISTS customer_notes TEXT;

-- ═══════════════════════════════════════════════════════════════════════════
-- PASO 3: CREAR ÍNDICES
-- ═══════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_operadores_codigo ON operadores(codigo);
CREATE INDEX IF NOT EXISTS idx_vouchers_mesa_nombre ON vouchers(mesa_nombre);
CREATE INDEX IF NOT EXISTS idx_vouchers_qr_hash ON vouchers(qr_hash);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);

-- ═══════════════════════════════════════════════════════════════════════════
-- PASO 4: ACTUALIZAR DATOS (si no tienen valores)
-- ═══════════════════════════════════════════════════════════════════════════

-- Asignar códigos automáticos a operadores
UPDATE operadores
SET codigo = 'OP' || LPAD(id::TEXT, 3, '0')
WHERE codigo IS NULL;

-- Asignar PINs temporales (CAMBIAR DESPUÉS POR SEGURIDAD)
UPDATE operadores
SET pin = '1234'
WHERE pin IS NULL AND activo = true;

-- Actualizar mesa_nombre en vouchers desde stations
UPDATE vouchers v
SET mesa_nombre = s.station_number
FROM stations s
WHERE v.issued_at_station_id = s.id
  AND v.mesa_nombre IS NULL
  AND s.station_type = 'mesa';

-- ═══════════════════════════════════════════════════════════════════════════
-- VERIFICACIÓN
-- ═══════════════════════════════════════════════════════════════════════════

-- Ver operadores con sus nuevos códigos
SELECT id, nombre, codigo, pin, activo
FROM operadores
ORDER BY id;

-- Ver vouchers con mesa_nombre
SELECT id, voucher_code, amount, currency, status, mesa_nombre
FROM vouchers
ORDER BY issued_at DESC
LIMIT 5;

-- Contar registros
SELECT 'operadores' AS tabla, COUNT(*) AS registros FROM operadores
UNION ALL
SELECT 'vouchers' AS tabla, COUNT(*) AS registros FROM vouchers
UNION ALL
SELECT 'audit_log' AS tabla, COUNT(*) AS registros FROM audit_log;

-- ═══════════════════════════════════════════════════════════════════════════
-- ✅ COMPLETADO
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Si todo funcionó correctamente, deberías ver:
-- 1. Operadores con códigos OP001, OP002, OP003
-- 2. Vouchers con mesa_nombre poblado
-- 3. Conteo de registros en todas las tablas
--
-- Próximo paso: Ejecutar node scripts/verify-supabase-schema.js
-- ═══════════════════════════════════════════════════════════════════════════
