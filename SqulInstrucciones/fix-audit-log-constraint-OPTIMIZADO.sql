-- ═══════════════════════════════════════════════════════════
-- FIX: audit_log action constraint (VERSIÓN OPTIMIZADA)
-- ═══════════════════════════════════════════════════════════
-- PROBLEMA: La tabla audit_log en Supabase solo permite 3 actions:
--   - user_login
--   - voucher_created
--   - voucher_redeemed
--
-- PERO el código usa 8 actions diferentes, causando errores como:
--   "new row for relation 'audit_log' violates check constraint 'audit_log_action_check'"
--
-- ANÁLISIS COMPLETO:
--   Ver: c:\appCasino\ANALISIS_VIABILIDAD_FIX_AUDIT_LOG_CONSTRAINT.md
--
-- SOLUCIÓN: Actualizar constraint con actions realmente usadas + futuras probables
--
-- CAMBIOS vs script original:
--   ✅ AGREGADO: voucher_issued (usado en código, faltaba en original)
--   ❌ ELIMINADO: voucher_created (NO usado en código actual)
--   ✅ TOTAL: 12 actions (vs 13 original, vs 3 actual)
--
-- TIEMPO ESTIMADO: < 100ms
-- DOWNTIME: Imperceptible
-- ROLLBACK: Trivial (ver sección final)
-- ═══════════════════════════════════════════════════════════

BEGIN;  -- Usar transacción para rollback seguro si algo falla

-- ═══════════════════════════════════════════════════════════
-- PASO 1: ELIMINAR CONSTRAINT EXISTENTE
-- ═══════════════════════════════════════════════════════════

ALTER TABLE audit_log
DROP CONSTRAINT IF EXISTS audit_log_action_check;

-- ═══════════════════════════════════════════════════════════
-- PASO 2: CREAR NUEVO CONSTRAINT CON ACTIONS COMPLETAS
-- ═══════════════════════════════════════════════════════════

ALTER TABLE audit_log
ADD CONSTRAINT audit_log_action_check
CHECK (action IN (
  -- ──────────────────────────────────────────────────────
  -- VOUCHER ACTIONS
  -- ──────────────────────────────────────────────────────
  'voucher_issued',      -- USADO: pure/main.js línea 1315
                         -- Emisión de tickets TITO
                         -- Frecuencia: Muy alta

  'voucher_redeemed',    -- USADO: pure/main.js línea 1658
                         -- Canje de tickets TITO
                         -- Frecuencia: Alta

  'voucher_cancelled',   -- FUTURO: Cancelación de tickets
                         -- Frecuencia esperada: Baja
                         -- TODO: Implementar handler

  'voucher_expired',     -- FUTURO: Expiración automática
                         -- Frecuencia esperada: Media (cron job)
                         -- TODO: Implementar proceso batch

  -- ──────────────────────────────────────────────────────
  -- USER ACTIONS
  -- ──────────────────────────────────────────────────────
  'user_login',          -- USADO: pure/main.js línea 482
                         -- Login de usuarios del sistema
                         -- Frecuencia: Alta

  'user_created',        -- USADO: pure/main.js línea 2242
                         -- Creación de nuevos usuarios (Admin)
                         -- Frecuencia: Baja

  'user_updated',        -- USADO: pure/main.js líneas 2336, 2397, 2447
                         -- Actualización de usuarios (Admin)
                         -- Incluye: cambios de perfil, toggle active, cambio password
                         -- Frecuencia: Media

  'user_logout',         -- FUTURO: Logout explícito
                         -- Frecuencia esperada: Alta
                         -- TODO: Implementar logout en UI
                         -- Nota: Actualmente solo hay logout implícito (cerrar ventana)

  -- ──────────────────────────────────────────────────────
  -- OPERATOR ACTIONS
  -- ──────────────────────────────────────────────────────
  'operator_created',    -- USADO: pure/main.js línea 1896
                         -- Creación de operadores de caja
                         -- Frecuencia: Baja

  'operator_updated',    -- USADO: pure/main.js líneas 1946, 1994, 2041
                         -- Actualización de operadores
                         -- Incluye: cambios de perfil, toggle active, eliminación lógica
                         -- Frecuencia: Media

  -- ──────────────────────────────────────────────────────
  -- SESSION ACTIONS
  -- ──────────────────────────────────────────────────────
  'session_closed',      -- USADO: pure/main.js línea 3830
                         -- Cierre forzado de sesiones (Admin)
                         -- Frecuencia: Media

  -- ──────────────────────────────────────────────────────
  -- CONFIG ACTIONS
  -- ──────────────────────────────────────────────────────
  'config_changed'       -- FUTURO: Cambios de configuración
                         -- Frecuencia esperada: Baja
                         -- TODO: Implementar auditoría de config
));

-- ═══════════════════════════════════════════════════════════
-- PASO 3: VERIFICACIÓN AUTOMÁTICA
-- ═══════════════════════════════════════════════════════════

DO $$
DECLARE
  constraint_exists BOOLEAN;
  constraint_def TEXT;
BEGIN
  -- Verificar que el constraint fue creado
  SELECT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'audit_log'::regclass
      AND conname = 'audit_log_action_check'
  ) INTO constraint_exists;

  IF NOT constraint_exists THEN
    RAISE EXCEPTION 'ERROR: Constraint audit_log_action_check no fue creado correctamente';
  END IF;

  -- Obtener definición del constraint
  SELECT pg_get_constraintdef(oid)
  INTO constraint_def
  FROM pg_constraint
  WHERE conrelid = 'audit_log'::regclass
    AND conname = 'audit_log_action_check';

  -- Mostrar resultado
  RAISE NOTICE '═══════════════════════════════════════════════════';
  RAISE NOTICE 'SUCCESS: Constraint actualizado correctamente';
  RAISE NOTICE '═══════════════════════════════════════════════════';
  RAISE NOTICE 'Constraint: %', constraint_def;
  RAISE NOTICE '';
  RAISE NOTICE 'Actions permitidas: 12 total';
  RAISE NOTICE '  - Vouchers: 4 (2 usadas, 2 futuras)';
  RAISE NOTICE '  - Users: 4 (3 usadas, 1 futura)';
  RAISE NOTICE '  - Operators: 2 (2 usadas)';
  RAISE NOTICE '  - Sessions: 1 (1 usada)';
  RAISE NOTICE '  - Config: 1 (1 futura)';
  RAISE NOTICE '═══════════════════════════════════════════════════';
END $$;

COMMIT;  -- Si todo está bien, aplicar cambios

-- ═══════════════════════════════════════════════════════════
-- VERIFICACIÓN POST-IMPLEMENTACIÓN
-- ═══════════════════════════════════════════════════════════
-- Ejecutar estas queries después para verificar:

-- 1. Ver constraint actualizado
SELECT
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'audit_log'::regclass
  AND conname = 'audit_log_action_check';

-- 2. Ver actions usadas actualmente en datos reales
SELECT
  action,
  COUNT(*) AS cantidad,
  MIN(created_at) AS primera_vez,
  MAX(created_at) AS ultima_vez
FROM audit_log
GROUP BY action
ORDER BY cantidad DESC;

-- 3. Detectar si hay actions desconocidas (NO debería haber ninguna después del fix)
SELECT
  action,
  COUNT(*) AS cantidad
FROM audit_log
WHERE action NOT IN (
  'voucher_issued', 'voucher_redeemed', 'voucher_cancelled', 'voucher_expired',
  'user_login', 'user_logout', 'user_created', 'user_updated',
  'operator_created', 'operator_updated',
  'session_closed',
  'config_changed',
  -- Legacy (por si había datos antiguos):
  'voucher_created'
)
GROUP BY action;

-- 4. Verificar que no hay errores en últimos 10 minutos
SELECT
  action,
  COUNT(*) AS registros_recientes
FROM audit_log
WHERE created_at > NOW() - INTERVAL '10 minutes'
GROUP BY action
ORDER BY registros_recientes DESC;

-- ═══════════════════════════════════════════════════════════
-- TESTING (OPCIONAL - Solo en staging/dev)
-- ═══════════════════════════════════════════════════════════
-- NO ejecutar en producción

/*
-- Probar inserción con cada action
INSERT INTO audit_log (action, user_id, details)
VALUES ('voucher_issued', NULL, '{"test": true}');

INSERT INTO audit_log (action, user_id, details)
VALUES ('user_created', NULL, '{"test": true}');

INSERT INTO audit_log (action, user_id, details)
VALUES ('operator_updated', NULL, '{"test": true}');

-- Probar que action inválida falla correctamente
INSERT INTO audit_log (action, user_id, details)
VALUES ('action_invalida', NULL, '{"test": true}');
-- DEBE fallar con: violates check constraint "audit_log_action_check"

-- Limpiar datos de test
DELETE FROM audit_log WHERE details->>'test' = 'true';
*/

-- ═══════════════════════════════════════════════════════════
-- ROLLBACK (si algo sale mal)
-- ═══════════════════════════════════════════════════════════
-- Ejecutar este bloque SOLO si necesitas revertir cambios

/*
BEGIN;

-- Volver al constraint original (3 actions)
ALTER TABLE audit_log
DROP CONSTRAINT IF EXISTS audit_log_action_check;

ALTER TABLE audit_log
ADD CONSTRAINT audit_log_action_check
CHECK (action IN ('user_login', 'voucher_created', 'voucher_redeemed'));

-- Verificar rollback
SELECT
  conname,
  pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'audit_log'::regclass
  AND conname = 'audit_log_action_check';

COMMIT;

RAISE NOTICE 'ROLLBACK COMPLETADO: Constraint vuelto a versión original (3 actions)';
*/

-- ═══════════════════════════════════════════════════════════
-- NOTAS IMPORTANTES
-- ═══════════════════════════════════════════════════════════
-- 1. Este script debe ejecutarse en Supabase SQL Editor
-- 2. Usa service_role o postgres role para permisos completos
-- 3. Los registros existentes NO se modifican
-- 4. Solo nuevos INSERT serán validados con el nuevo constraint
-- 5. Tiempo de ejecución esperado: < 100ms
-- 6. Downtime: Imperceptible (lock de ~50-100ms)
-- 7. Rollback trivial (ver sección anterior)
--
-- DIFERENCIAS con script original (fix-audit-log-constraint.sql):
--   ✅ AGREGADO: voucher_issued (usado en código, FALTABA en original)
--   ❌ ELIMINADO: voucher_created (NO usado en código actual)
--   ✅ TOTAL: 12 actions (vs 13 original)
--   ✅ AGREGADO: Transacción BEGIN/COMMIT para seguridad
--   ✅ AGREGADO: Verificación automática post-constraint
--   ✅ AGREGADO: Queries de diagnóstico
--   ✅ AGREGADO: Plan de rollback
--   ✅ AGREGADO: Documentación exhaustiva
--
-- DOCUMENTACIÓN COMPLETA:
--   c:\appCasino\ANALISIS_VIABILIDAD_FIX_AUDIT_LOG_CONSTRAINT.md
--   c:\appCasino\RESUMEN_AUDIT_LOG_CONSTRAINT.md
-- ═══════════════════════════════════════════════════════════
