-- ═══════════════════════════════════════════════════════════════════════════
-- MIGRACIÓN OPTIMIZADA - Sistema Casino TITO
-- Fecha: 31 de Octubre de 2024
-- ═══════════════════════════════════════════════════════════════════════════
-- IMPORTANTE: Este script solo agrega campos y funcionalidad faltante
-- NO elimina ni modifica datos existentes
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════
-- PASO 1: VERIFICACIÓN INICIAL
-- ═══════════════════════════════════════════════════════════════════════════
-- Ejecutar estas queries primero para ver el estado actual:

/*
-- Verificar estructura de operadores
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'operadores'
ORDER BY ordinal_position;

-- Verificar estructura de vouchers
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'vouchers'
ORDER BY ordinal_position;

-- Verificar estructura de audit_log
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'audit_log'
ORDER BY ordinal_position;
*/

-- ═══════════════════════════════════════════════════════════════════════════
-- PASO 2: MEJORAR TABLA OPERADORES
-- ═══════════════════════════════════════════════════════════════════════════

-- Agregar campos para compatibilidad con SQLite
ALTER TABLE operadores
  ADD COLUMN IF NOT EXISTS codigo TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS pin TEXT,
  ADD COLUMN IF NOT EXISTS mesa_asignada TEXT;

-- Crear índice para búsquedas por código
CREATE INDEX IF NOT EXISTS idx_operadores_codigo ON operadores(codigo);

-- Actualizar operadores existentes con códigos automáticos (solo si no tienen)
UPDATE operadores
SET codigo = 'OP' || LPAD(id::TEXT, 3, '0')
WHERE codigo IS NULL;

-- Asignar PINs temporales (cambiar después por seguridad)
UPDATE operadores
SET pin = '1234'
WHERE pin IS NULL AND activo = true;

-- Comentario: Los operadores inactivos pueden no tener PIN
COMMENT ON COLUMN operadores.pin IS 'PIN de acceso para operadores activos (cambiar valor por defecto)';

-- ═══════════════════════════════════════════════════════════════════════════
-- PASO 3: MEJORAR TABLA VOUCHERS
-- ═══════════════════════════════════════════════════════════════════════════

-- Agregar campos para QR y auditoría
ALTER TABLE vouchers
  ADD COLUMN IF NOT EXISTS qr_data TEXT,
  ADD COLUMN IF NOT EXISTS qr_hash TEXT,
  ADD COLUMN IF NOT EXISTS mesa_nombre TEXT,
  ADD COLUMN IF NOT EXISTS operador_nombre TEXT,
  ADD COLUMN IF NOT EXISTS customer_notes TEXT;

-- Crear índices para mejorar performance
CREATE INDEX IF NOT EXISTS idx_vouchers_mesa_nombre ON vouchers(mesa_nombre);
CREATE INDEX IF NOT EXISTS idx_vouchers_qr_hash ON vouchers(qr_hash);

-- Actualizar mesa_nombre basado en issued_at_station_id (si existe relación)
-- Fix: station_number es TEXT, no necesita LPAD si ya está formateado
UPDATE vouchers v
SET mesa_nombre = s.station_number
FROM stations s
WHERE v.issued_at_station_id = s.id
  AND v.mesa_nombre IS NULL
  AND s.station_type = 'mesa';

-- Comentarios para documentación
COMMENT ON COLUMN vouchers.qr_data IS 'Datos del código QR (JSON con code, amount, currency, timestamp, hash)';
COMMENT ON COLUMN vouchers.qr_hash IS 'Hash SHA-256 para validación del QR';
COMMENT ON COLUMN vouchers.mesa_nombre IS 'Nombre de la mesa en formato P01, P02, etc';
COMMENT ON COLUMN vouchers.operador_nombre IS 'Nombre del operador que emitió el voucher';

-- ═══════════════════════════════════════════════════════════════════════════
-- PASO 4: MEJORAR TABLA AUDIT_LOG
-- ═══════════════════════════════════════════════════════════════════════════

-- Verificar si tiene todos los campos necesarios
ALTER TABLE audit_log
  ADD COLUMN IF NOT EXISTS station_id BIGINT REFERENCES stations(id),
  ADD COLUMN IF NOT EXISTS ip_address TEXT;

-- Crear índices faltantes
CREATE INDEX IF NOT EXISTS idx_audit_log_station_id ON audit_log(station_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_event_type ON audit_log(event_type);

-- ═══════════════════════════════════════════════════════════════════════════
-- PASO 5: FUNCIONES Y TRIGGERS DE AUDITORÍA
-- ═══════════════════════════════════════════════════════════════════════════

-- Función para registrar cambios en vouchers automáticamente
CREATE OR REPLACE FUNCTION log_voucher_changes()
RETURNS TRIGGER AS $$
BEGIN
    -- Registrar creación de voucher
    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit_log (
            event_type,
            voucher_id,
            user_id,
            station_id,
            details,
            created_at
        ) VALUES (
            'voucher_issued',
            NEW.id,
            NEW.issued_by_user_id,
            NEW.issued_at_station_id,
            jsonb_build_object(
                'voucher_code', NEW.voucher_code,
                'amount', NEW.amount,
                'currency', NEW.currency,
                'mesa_nombre', NEW.mesa_nombre,
                'operador_nombre', NEW.operador_nombre
            ),
            NOW()
        );
        RETURN NEW;
    END IF;

    -- Registrar cambios de estado
    IF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
        INSERT INTO audit_log (
            event_type,
            voucher_id,
            user_id,
            station_id,
            details,
            created_at
        ) VALUES (
            CASE NEW.status
                WHEN 'redeemed' THEN 'voucher_redeemed'
                WHEN 'cancelled' THEN 'voucher_cancelled'
                WHEN 'expired' THEN 'voucher_expired'
                ELSE 'voucher_updated'
            END,
            NEW.id,
            COALESCE(NEW.redeemed_by_user_id, NEW.issued_by_user_id),
            COALESCE(NEW.redeemed_at_station_id, NEW.issued_at_station_id),
            jsonb_build_object(
                'voucher_code', NEW.voucher_code,
                'old_status', OLD.status,
                'new_status', NEW.status,
                'amount', NEW.amount,
                'currency', NEW.currency,
                'redeemed_at', NEW.redeemed_at
            ),
            NOW()
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crear trigger (eliminar primero si existe)
DROP TRIGGER IF EXISTS trigger_audit_vouchers ON vouchers;
CREATE TRIGGER trigger_audit_vouchers
    AFTER INSERT OR UPDATE ON vouchers
    FOR EACH ROW
    EXECUTE FUNCTION log_voucher_changes();

-- ═══════════════════════════════════════════════════════════════════════════
-- PASO 6: VISTAS ÚTILES PARA ESTADÍSTICAS
-- ═══════════════════════════════════════════════════════════════════════════

-- Vista para estadísticas del día actual
CREATE OR REPLACE VIEW vouchers_stats_today AS
SELECT
    COUNT(*) AS total_vouchers,
    COUNT(*) FILTER (WHERE status = 'active') AS activos,
    COUNT(*) FILTER (WHERE status = 'redeemed') AS canjeados,
    COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelados,
    COUNT(*) FILTER (WHERE status = 'expired') AS expirados,
    COALESCE(SUM(amount) FILTER (WHERE currency = 'DOP'), 0) AS total_dop,
    COALESCE(SUM(amount) FILTER (WHERE currency = 'USD'), 0) AS total_usd,
    COALESCE(SUM(amount) FILTER (WHERE currency = 'DOP' AND status = 'redeemed'), 0) AS canjeado_dop,
    COALESCE(SUM(amount) FILTER (WHERE currency = 'USD' AND status = 'redeemed'), 0) AS canjeado_usd,
    COALESCE(SUM(amount) FILTER (WHERE currency = 'DOP' AND status = 'active'), 0) AS pendiente_dop,
    COALESCE(SUM(amount) FILTER (WHERE currency = 'USD' AND status = 'active'), 0) AS pendiente_usd
FROM vouchers
WHERE DATE(issued_at) = CURRENT_DATE;

-- Vista para estadísticas por mesa
CREATE OR REPLACE VIEW vouchers_stats_by_mesa AS
SELECT
    COALESCE(mesa_nombre, 'Sin Mesa') AS mesa,
    COUNT(*) AS total_vouchers,
    COUNT(*) FILTER (WHERE status = 'active') AS activos,
    COUNT(*) FILTER (WHERE status = 'redeemed') AS canjeados,
    COALESCE(SUM(amount) FILTER (WHERE currency = 'DOP'), 0) AS total_dop,
    COALESCE(SUM(amount) FILTER (WHERE currency = 'USD'), 0) AS total_usd,
    COALESCE(SUM(amount) FILTER (WHERE status = 'redeemed'), 0) AS total_canjeado
FROM vouchers
WHERE DATE(issued_at) = CURRENT_DATE
GROUP BY COALESCE(mesa_nombre, 'Sin Mesa')
ORDER BY total_canjeado DESC;

-- Vista para actividad reciente
CREATE OR REPLACE VIEW vouchers_recent_activity AS
SELECT
    v.id,
    v.voucher_code,
    v.amount,
    v.currency,
    v.status,
    v.mesa_nombre,
    v.operador_nombre,
    v.issued_at,
    v.redeemed_at,
    u_issued.full_name AS issued_by_name,
    u_redeemed.full_name AS redeemed_by_name,
    s_issued.station_name AS issued_at_station_name,
    s_redeemed.station_name AS redeemed_at_station_name
FROM vouchers v
LEFT JOIN users u_issued ON v.issued_by_user_id = u_issued.id
LEFT JOIN users u_redeemed ON v.redeemed_by_user_id = u_redeemed.id
LEFT JOIN stations s_issued ON v.issued_at_station_id = s_issued.id
LEFT JOIN stations s_redeemed ON v.redeemed_at_station_id = s_redeemed.id
ORDER BY COALESCE(v.redeemed_at, v.issued_at) DESC
LIMIT 50;

-- ═══════════════════════════════════════════════════════════════════════════
-- PASO 7: FUNCIONES ÚTILES PARA LA APLICACIÓN
-- ═══════════════════════════════════════════════════════════════════════════

-- Función para obtener estadísticas de un rango de fechas
CREATE OR REPLACE FUNCTION get_vouchers_stats(
    fecha_desde TIMESTAMPTZ,
    fecha_hasta TIMESTAMPTZ
)
RETURNS TABLE (
    total_vouchers BIGINT,
    activos BIGINT,
    canjeados BIGINT,
    cancelados BIGINT,
    total_dop NUMERIC,
    total_usd NUMERIC,
    canjeado_dop NUMERIC,
    canjeado_usd NUMERIC,
    pendiente_dop NUMERIC,
    pendiente_usd NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(*)::BIGINT AS total_vouchers,
        COUNT(*) FILTER (WHERE status = 'active')::BIGINT AS activos,
        COUNT(*) FILTER (WHERE status = 'redeemed')::BIGINT AS canjeados,
        COUNT(*) FILTER (WHERE status = 'cancelled')::BIGINT AS cancelados,
        COALESCE(SUM(amount) FILTER (WHERE currency = 'DOP'), 0) AS total_dop,
        COALESCE(SUM(amount) FILTER (WHERE currency = 'USD'), 0) AS total_usd,
        COALESCE(SUM(amount) FILTER (WHERE currency = 'DOP' AND status = 'redeemed'), 0) AS canjeado_dop,
        COALESCE(SUM(amount) FILTER (WHERE currency = 'USD' AND status = 'redeemed'), 0) AS canjeado_usd,
        COALESCE(SUM(amount) FILTER (WHERE currency = 'DOP' AND status = 'active'), 0) AS pendiente_dop,
        COALESCE(SUM(amount) FILTER (WHERE currency = 'USD' AND status = 'active'), 0) AS pendiente_usd
    FROM vouchers
    WHERE issued_at BETWEEN fecha_desde AND fecha_hasta;
END;
$$ LANGUAGE plpgsql;

-- Función para limpiar logs antiguos (retener 90 días)
CREATE OR REPLACE FUNCTION clean_old_audit_logs()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM audit_log
    WHERE created_at < NOW() - INTERVAL '90 days'
    AND event_type NOT IN ('voucher_cancelled', 'user_created');

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════════════════════
-- PASO 8: VERIFICACIÓN FINAL
-- ═══════════════════════════════════════════════════════════════════════════

-- Verificar tablas y registros
SELECT
    'users' AS tabla,
    COUNT(*) AS registros
FROM users
UNION ALL
SELECT
    'operadores' AS tabla,
    COUNT(*) AS registros
FROM operadores
UNION ALL
SELECT
    'stations' AS tabla,
    COUNT(*) AS registros
FROM stations
UNION ALL
SELECT
    'vouchers' AS tabla,
    COUNT(*) AS registros
FROM vouchers
UNION ALL
SELECT
    'audit_log' AS tabla,
    COUNT(*) AS registros
FROM audit_log
ORDER BY tabla;

-- Verificar estadísticas del día
SELECT * FROM vouchers_stats_today;

-- Verificar estadísticas por mesa
SELECT * FROM vouchers_stats_by_mesa;

-- Verificar actividad reciente
SELECT
    voucher_code,
    amount,
    currency,
    status,
    mesa_nombre,
    issued_at
FROM vouchers_recent_activity
LIMIT 10;

-- ═══════════════════════════════════════════════════════════════════════════
-- ✅ MIGRACIÓN COMPLETADA
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Cambios aplicados:
--
-- 1. ✅ Tabla operadores mejorada con codigo, pin, mesa_asignada
-- 2. ✅ Tabla vouchers mejorada con qr_data, qr_hash, mesa_nombre
-- 3. ✅ Tabla audit_log mejorada con station_id, ip_address
-- 4. ✅ Trigger de auditoría automática creado
-- 5. ✅ Vistas de estadísticas creadas
-- 6. ✅ Funciones útiles implementadas
-- 7. ✅ Índices optimizados agregados
--
-- Próximos pasos:
--
-- 1. Ejecutar: node scripts/verify-supabase-schema.js
-- 2. Probar crear un voucher desde la app
-- 3. Verificar que se registra en audit_log
-- 4. Revisar las vistas de estadísticas
--
-- ═══════════════════════════════════════════════════════════════════════════
