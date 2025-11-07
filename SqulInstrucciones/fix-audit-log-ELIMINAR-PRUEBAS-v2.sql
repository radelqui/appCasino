-- ═══════════════════════════════════════════════════════════
-- FIX: audit_log constraint - ELIMINANDO REGISTROS DE PRUEBA v2
-- ═══════════════════════════════════════════════════════════
-- DIAGNÓSTICO:
--   - 2,170 registros con 'voucher_created' (DE PRUEBA)
--   - Estos registros impiden crear el nuevo constraint
--
-- SOLUCIÓN:
--   1. ELIMINAR registros de prueba (voucher_created)
--   2. Aplicar nuevo constraint con 12 actions
--
-- CONFIRMADO POR USUARIO: Los registros se pueden eliminar
--
-- TIEMPO ESTIMADO: 1-2 segundos
-- DOWNTIME: Imperceptible (~50ms)
-- ═══════════════════════════════════════════════════════════

BEGIN;

-- ═══════════════════════════════════════════════════════════
-- PASO 1: BACKUP DE SEGURIDAD
-- ═══════════════════════════════════════════════════════════

CREATE TEMP TABLE audit_log_backup_pruebas AS
SELECT *
FROM audit_log
WHERE action = 'voucher_created';

DO $$
DECLARE
  count_to_delete INTEGER;
BEGIN
  SELECT COUNT(*) INTO count_to_delete
  FROM audit_log
  WHERE action = 'voucher_created';

  RAISE NOTICE '═══════════════════════════════════════════════════';
  RAISE NOTICE 'REGISTROS A ELIMINAR: % voucher_created', count_to_delete;
  RAISE NOTICE '═══════════════════════════════════════════════════';
  RAISE NOTICE 'Backup temporal creado: audit_log_backup_pruebas';
  RAISE NOTICE '';
END $$;

-- ═══════════════════════════════════════════════════════════
-- PASO 2: ELIMINAR REGISTROS DE PRUEBA
-- ═══════════════════════════════════════════════════════════

DELETE FROM audit_log
WHERE action = 'voucher_created';

DO $$
DECLARE
  remaining INTEGER;
  deleted INTEGER;
BEGIN
  SELECT COUNT(*) INTO remaining
  FROM audit_log
  WHERE action = 'voucher_created';

  SELECT COUNT(*) INTO deleted
  FROM audit_log_backup_pruebas;

  RAISE NOTICE '═══════════════════════════════════════════════════';
  RAISE NOTICE 'RESULTADO DE ELIMINACIÓN';
  RAISE NOTICE '═══════════════════════════════════════════════════';
  RAISE NOTICE 'Registros eliminados: %', deleted;
  RAISE NOTICE 'Registros restantes con voucher_created: %', remaining;

  IF remaining > 0 THEN
    RAISE EXCEPTION 'ERROR: Aún quedan % registros con voucher_created', remaining;
  END IF;

  RAISE NOTICE '✅ TODOS LOS REGISTROS ELIMINADOS';
  RAISE NOTICE '';
END $$;

-- ═══════════════════════════════════════════════════════════
-- PASO 3: ELIMINAR CONSTRAINT VIEJO Y CREAR NUEVO
-- ═══════════════════════════════════════════════════════════

ALTER TABLE audit_log
DROP CONSTRAINT IF EXISTS audit_log_action_check;

ALTER TABLE audit_log
ADD CONSTRAINT audit_log_action_check
CHECK (action IN (
  -- VOUCHER ACTIONS
  'voucher_issued',      -- USADO en código (línea 1315)
  'voucher_redeemed',    -- USADO en código (línea 1658)
  'voucher_cancelled',   -- FUTURO
  'voucher_expired',     -- FUTURO

  -- USER ACTIONS
  'user_login',          -- USADO en código (línea 482)
  'user_created',        -- USADO en código (línea 2242)
  'user_updated',        -- USADO en código (líneas 2336, 2397, 2447)
  'user_logout',         -- FUTURO

  -- OPERATOR ACTIONS
  'operator_created',    -- USADO en código (línea 1896)
  'operator_updated',    -- USADO en código (líneas 1946, 1994, 2041)

  -- SESSION ACTIONS
  'session_closed',      -- USADO en código (línea 3830)

  -- CONFIG ACTIONS
  'config_changed'       -- FUTURO
));

-- ═══════════════════════════════════════════════════════════
-- PASO 4: VERIFICACIÓN FINAL
-- ═══════════════════════════════════════════════════════════

DO $$
DECLARE
  constraint_exists BOOLEAN;
  total_registros INTEGER;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'audit_log'::regclass
      AND conname = 'audit_log_action_check'
  ) INTO constraint_exists;

  IF NOT constraint_exists THEN
    RAISE EXCEPTION 'ERROR: Constraint no fue creado';
  END IF;

  SELECT COUNT(*) INTO total_registros FROM audit_log;

  RAISE NOTICE '═══════════════════════════════════════════════════';
  RAISE NOTICE 'VERIFICACIÓN FINAL';
  RAISE NOTICE '═══════════════════════════════════════════════════';
  RAISE NOTICE '✅ Constraint anterior eliminado';
  RAISE NOTICE '✅ Constraint nuevo creado con 12 actions';
  RAISE NOTICE '✅ Registros restantes en audit_log: %', total_registros;
  RAISE NOTICE '';
  RAISE NOTICE 'Actions permitidas: 12 total';
  RAISE NOTICE '  - Vouchers: 4 (2 usadas, 2 futuras)';
  RAISE NOTICE '  - Users: 4 (3 usadas, 1 futura)';
  RAISE NOTICE '  - Operators: 2 (2 usadas)';
  RAISE NOTICE '  - Sessions: 1 (1 usada)';
  RAISE NOTICE '  - Config: 1 (1 futura)';
  RAISE NOTICE '═══════════════════════════════════════════════════';
END $$;

COMMIT;

-- ═══════════════════════════════════════════════════════════
-- VERIFICACIÓN POST-IMPLEMENTACIÓN
-- ═══════════════════════════════════════════════════════════

-- Ver registros restantes por action
SELECT
  action,
  COUNT(*) AS cantidad
FROM audit_log
GROUP BY action
ORDER BY cantidad DESC;

-- Ver constraint actualizado
SELECT
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'audit_log'::regclass
  AND conname = 'audit_log_action_check';

-- Verificar que NO queden registros problemáticos (debe retornar 0 filas)
SELECT
  action,
  COUNT(*) AS cantidad
FROM audit_log
WHERE action NOT IN (
  'voucher_issued', 'voucher_redeemed', 'voucher_cancelled', 'voucher_expired',
  'user_login', 'user_logout', 'user_created', 'user_updated',
  'operator_created', 'operator_updated',
  'session_closed',
  'config_changed'
)
GROUP BY action;

-- ═══════════════════════════════════════════════════════════
-- RESULTADO ESPERADO
-- ═══════════════════════════════════════════════════════════
--
-- Registros ANTES:
--   voucher_created:  2,170 (ELIMINADOS)
--   user_login:          31
--   voucher_redeemed:    23
--   voucher_issued:      11
--   operator_updated:     2
--   ─────────────────────────
--   TOTAL:            2,237 registros
--
-- Registros DESPUÉS:
--   user_login:          31
--   voucher_redeemed:    23
--   voucher_issued:      11
--   operator_updated:     2
--   ─────────────────────────
--   TOTAL:               67 registros
--
-- Eliminados: 2,170 registros de prueba
-- Constraint: 12 actions permitidas (voucher_created NO incluido)
--
-- ═══════════════════════════════════════════════════════════
