-- ═══════════════════════════════════════════════════════════
-- MIGRACIÓN: SINCRONIZACIÓN DE ESQUEMAS
-- Sistema Casino TITO - appCasino311025
-- Fecha: 31 de Octubre de 2024
-- ═══════════════════════════════════════════════════════════
-- Ejecutar este script en Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════
-- 1️⃣ ACTUALIZAR TABLA DE OPERADORES
-- ═══════════════════════════════════════════════════════════
-- Agregar campos faltantes para compatibilidad con SQLite

-- Agregar campo 'codigo' (código único del operador)
ALTER TABLE operadores
ADD COLUMN IF NOT EXISTS codigo TEXT UNIQUE;

-- Agregar campo 'pin' (PIN de acceso para operadores)
ALTER TABLE operadores
ADD COLUMN IF NOT EXISTS pin TEXT;

-- Agregar campo 'mesa_asignada' (una sola mesa principal)
ALTER TABLE operadores
ADD COLUMN IF NOT EXISTS mesa_asignada TEXT;

-- Crear índice para búsquedas rápidas por código
CREATE INDEX IF NOT EXISTS idx_operadores_codigo ON operadores(codigo);

-- Actualizar operadores existentes con códigos (si no tienen)
UPDATE operadores SET codigo = 'OP' || LPAD(id::TEXT, 3, '0') WHERE codigo IS NULL;

-- ═══════════════════════════════════════════════════════════
-- 2️⃣ CREAR TABLA DE AUDITORÍA
-- ═══════════════════════════════════════════════════════════
-- Tabla para registrar todos los eventos del sistema

CREATE TABLE IF NOT EXISTS audit_logs (
    id BIGSERIAL PRIMARY KEY,
    tipo_evento TEXT NOT NULL,                    -- Tipo de evento (ticket_creado, login, etc)
    voucher_code TEXT,                            -- Código del voucher relacionado
    user_id UUID REFERENCES auth.users(id),       -- Usuario que realizó la acción
    descripcion TEXT,                             -- Descripción del evento
    fecha TIMESTAMPTZ DEFAULT NOW(),              -- Fecha y hora del evento
    datos_adicionales JSONB,                      -- Datos adicionales en formato JSON
    ip_address TEXT,                              -- Dirección IP del cliente
    user_agent TEXT,                              -- User agent del navegador
    session_id TEXT,                              -- ID de sesión
    nivel_criticidad TEXT CHECK(nivel_criticidad IN ('BAJO', 'MEDIO', 'ALTO', 'CRITICO')) DEFAULT 'MEDIO',
    modulo TEXT,                                  -- Módulo del sistema (TICKETS, USUARIOS, etc)
    accion TEXT,                                  -- Acción específica (CREATE, UPDATE, DELETE, LOGIN)
    resultado TEXT CHECK(resultado IN ('EXITO', 'FALLO', 'ADVERTENCIA')) DEFAULT 'EXITO'
);

-- Índices para optimizar consultas de auditoría
CREATE INDEX IF NOT EXISTS idx_audit_fecha ON audit_logs(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_voucher ON audit_logs(voucher_code);
CREATE INDEX IF NOT EXISTS idx_audit_criticidad ON audit_logs(nivel_criticidad);
CREATE INDEX IF NOT EXISTS idx_audit_modulo ON audit_logs(modulo);
CREATE INDEX IF NOT EXISTS idx_audit_tipo ON audit_logs(tipo_evento);

-- Crear función para limpiar logs antiguos (retener 90 días)
CREATE OR REPLACE FUNCTION clean_old_audit_logs()
RETURNS void AS $$
BEGIN
    DELETE FROM audit_logs
    WHERE fecha < NOW() - INTERVAL '90 days'
    AND nivel_criticidad NOT IN ('CRITICO', 'ALTO');
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════
-- 3️⃣ MEJORAR TABLA DE VOUCHERS
-- ═══════════════════════════════════════════════════════════
-- Agregar campos adicionales para compatibilidad con SQLite

-- Agregar campo para nombre de mesa (formato P01, P02, etc)
ALTER TABLE vouchers
ADD COLUMN IF NOT EXISTS mesa_nombre TEXT;

-- Agregar campo para nombre de operador (para auditoría)
ALTER TABLE vouchers
ADD COLUMN IF NOT EXISTS operador_nombre TEXT;

-- Agregar índice para búsquedas por mesa
CREATE INDEX IF NOT EXISTS idx_vouchers_mesa ON vouchers(mesa_nombre);

-- Actualizar mesa_nombre basado en issued_at_station_id
UPDATE vouchers
SET mesa_nombre = 'P' || LPAD(issued_at_station_id::TEXT, 2, '0')
WHERE mesa_nombre IS NULL AND issued_at_station_id IS NOT NULL;

-- ═══════════════════════════════════════════════════════════
-- 4️⃣ CREAR FUNCIÓN DE AUDITORÍA AUTOMÁTICA
-- ═══════════════════════════════════════════════════════════
-- Función para registrar cambios en vouchers automáticamente

CREATE OR REPLACE FUNCTION log_voucher_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit_logs (
            tipo_evento,
            voucher_code,
            user_id,
            descripcion,
            datos_adicionales,
            nivel_criticidad,
            modulo,
            accion,
            resultado
        ) VALUES (
            'voucher_created',
            NEW.voucher_code,
            NEW.issued_by_user_id,
            'Voucher creado: ' || NEW.currency || ' ' || NEW.amount,
            jsonb_build_object(
                'amount', NEW.amount,
                'currency', NEW.currency,
                'station_id', NEW.issued_at_station_id,
                'mesa_nombre', NEW.mesa_nombre
            ),
            'MEDIO',
            'VOUCHERS',
            'CREATE',
            'EXITO'
        );
    ELSIF TG_OP = 'UPDATE' THEN
        -- Solo registrar si el estado cambió
        IF OLD.status != NEW.status THEN
            INSERT INTO audit_logs (
                tipo_evento,
                voucher_code,
                user_id,
                descripcion,
                datos_adicionales,
                nivel_criticidad,
                modulo,
                accion,
                resultado
            ) VALUES (
                'voucher_status_changed',
                NEW.voucher_code,
                NEW.redeemed_by_user_id,
                'Estado cambiado: ' || OLD.status || ' → ' || NEW.status,
                jsonb_build_object(
                    'status_anterior', OLD.status,
                    'status_nuevo', NEW.status,
                    'amount', NEW.amount,
                    'currency', NEW.currency,
                    'redeemed_at', NEW.redeemed_at
                ),
                CASE
                    WHEN NEW.status = 'redeemed' THEN 'MEDIO'
                    WHEN NEW.status = 'cancelled' THEN 'ALTO'
                    ELSE 'BAJO'
                END,
                'VOUCHERS',
                'UPDATE',
                'EXITO'
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crear trigger para auditar cambios en vouchers
DROP TRIGGER IF EXISTS trigger_audit_vouchers ON vouchers;
CREATE TRIGGER trigger_audit_vouchers
AFTER INSERT OR UPDATE ON vouchers
FOR EACH ROW
EXECUTE FUNCTION log_voucher_changes();

-- ═══════════════════════════════════════════════════════════
-- 5️⃣ CREAR VISTAS PARA ESTADÍSTICAS
-- ═══════════════════════════════════════════════════════════

-- Vista para estadísticas del día
CREATE OR REPLACE VIEW vouchers_stats_today AS
SELECT
    COUNT(*) AS total_vouchers,
    COUNT(*) FILTER (WHERE status = 'active') AS activos,
    COUNT(*) FILTER (WHERE status = 'redeemed') AS canjeados,
    COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelados,
    SUM(amount) FILTER (WHERE currency = 'DOP') AS total_dop,
    SUM(amount) FILTER (WHERE currency = 'USD') AS total_usd,
    SUM(amount) FILTER (WHERE currency = 'DOP' AND status = 'redeemed') AS canjeado_dop,
    SUM(amount) FILTER (WHERE currency = 'USD' AND status = 'redeemed') AS canjeado_usd
FROM vouchers
WHERE DATE(issued_at) = CURRENT_DATE;

-- Vista para estadísticas por mesa
CREATE OR REPLACE VIEW vouchers_stats_by_mesa AS
SELECT
    COALESCE(mesa_nombre, 'P' || LPAD(issued_at_station_id::TEXT, 2, '0')) AS mesa,
    COUNT(*) AS total_vouchers,
    COUNT(*) FILTER (WHERE status = 'active') AS activos,
    COUNT(*) FILTER (WHERE status = 'redeemed') AS canjeados,
    SUM(amount) FILTER (WHERE currency = 'DOP') AS total_dop,
    SUM(amount) FILTER (WHERE currency = 'USD') AS total_usd
FROM vouchers
WHERE DATE(issued_at) = CURRENT_DATE
GROUP BY COALESCE(mesa_nombre, 'P' || LPAD(issued_at_station_id::TEXT, 2, '0'))
ORDER BY mesa;

-- ═══════════════════════════════════════════════════════════
-- 6️⃣ POLÍTICAS DE SEGURIDAD RLS (Row Level Security)
-- ═══════════════════════════════════════════════════════════

-- Habilitar RLS en tablas sensibles
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Política para que los usuarios solo vean sus propios logs
CREATE POLICY "Users can view own audit logs"
ON audit_logs FOR SELECT
USING (auth.uid() = user_id OR
       auth.jwt() -> 'user_metadata' ->> 'role' IN ('admin', 'auditor'));

-- Política para insertar logs (solo el sistema)
CREATE POLICY "System can insert audit logs"
ON audit_logs FOR INSERT
WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════
-- 7️⃣ FUNCIONES ÚTILES PARA REPORTES
-- ═══════════════════════════════════════════════════════════

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
    canjeado_usd NUMERIC
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
        COALESCE(SUM(amount) FILTER (WHERE currency = 'USD' AND status = 'redeemed'), 0) AS canjeado_usd
    FROM vouchers
    WHERE issued_at BETWEEN fecha_desde AND fecha_hasta;
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════
-- 8️⃣ VERIFICACIÓN FINAL
-- ═══════════════════════════════════════════════════════════

-- Verificar que todas las tablas existen
SELECT
    'vouchers' AS tabla,
    COUNT(*) AS registros
FROM vouchers
UNION ALL
SELECT
    'operadores' AS tabla,
    COUNT(*) AS registros
FROM operadores
UNION ALL
SELECT
    'users' AS tabla,
    COUNT(*) AS registros
FROM users
UNION ALL
SELECT
    'audit_logs' AS tabla,
    COUNT(*) AS registros
FROM audit_logs;

-- Verificar estadísticas del día
SELECT * FROM vouchers_stats_today;

-- Verificar estadísticas por mesa
SELECT * FROM vouchers_stats_by_mesa;

-- ═══════════════════════════════════════════════════════════
-- ✅ MIGRACIÓN COMPLETADA
-- ═══════════════════════════════════════════════════════════
-- Los siguientes cambios fueron aplicados:
--
-- 1. ✅ Tabla operadores actualizada con campos 'codigo' y 'pin'
-- 2. ✅ Tabla audit_logs creada para auditoría centralizada
-- 3. ✅ Tabla vouchers mejorada con 'mesa_nombre' y 'operador_nombre'
-- 4. ✅ Función de auditoría automática implementada
-- 5. ✅ Vistas de estadísticas creadas
-- 6. ✅ Políticas RLS configuradas
-- 7. ✅ Funciones de reporte implementadas
--
-- Próximos pasos:
-- - Ejecutar sincronización de operadores desde SQLite
-- - Verificar que los vouchers se sincronizan correctamente
-- - Probar las nuevas vistas de estadísticas
-- ═══════════════════════════════════════════════════════════
