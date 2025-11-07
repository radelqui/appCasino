-- ═══════════════════════════════════════════════════════════
-- FIX: audit_log action constraint CON MIGRACIÓN DE DATOS
-- ═══════════════════════════════════════════════════════════
-- ERROR RECIBIDO:
--   "check constraint audit_log_action_check of relation audit_log
--    is violated by some row"
--
-- CAUSA:
--   Hay registros existentes en audit_log con actions que NO están
--   en la nueva lista permitida.
--
-- SOLUCIÓN:
--   1. Identificar registros problemáticos
--   2. Migrar/corregir datos existentes
--   3. Aplicar nuevo constraint
--
-- TIEMPO ESTIMADO: 1-2 minutos (depende de cantidad de registros)
-- ═══════════════════════════════════════════════════════════

BEGIN;

-- ═══════════════════════════════════════════════════════════
-- PASO 1: DIAGNÓSTICO - Identificar registros problemáticos
-- ═══════════════════════════════════════════════════════════

DO $$
DECLARE
  total_registros INTEGER;
  registros_invalidos INTEGER;
BEGIN
  -- Contar total de registros
  SELECT COUNT(*) INTO total_registros FROM audit_log;

  -- Contar registros con actions NO permitidas
  SELECT COUNT(*) INTO registros_invalidos
  FROM audit_log
  WHERE action NOT IN (
    'voucher_issued', 'voucher_redeemed', 'voucher_cancelled', 'voucher_expired',
    'user_login', 'user_logout', 'user_created', 'user_updated',
    'operator_created', 'operator_updated',
    'session_closed',
    'config_changed'
  );

  RAISE NOTICE '═══════════════════════════════════════════════════';
  RAISE NOTICE 'DIAGNÓSTICO INICIAL';
  RAISE NOTICE '═══════════════════════════════════════════════════';
  RAISE NOTICE 'Total de registros en audit_log: %', total_registros;
  RAISE NOTICE 'Registros con actions inválidas: %', registros_invalidos;
  RAISE NOTICE '';

  IF registros_invalidos > 0 THEN
    RAISE NOTICE '⚠️  SE REQUIERE MIGRACIÓN DE DATOS';
  ELSE
    RAISE NOTICE '✅ Todos los registros son válidos';
  END IF;
  RAISE NOTICE '═══════════════════════════════════════════════════';
END $$;

-- Ver detalle de actions problemáticas
SELECT
  action,
  COUNT(*) AS cantidad,
  MIN(created_at) AS primera_vez,
  MAX(created_at) AS ultima_vez,
  ARRAY_AGG(DISTINCT user_id) FILTER (WHERE user_id IS NOT NULL) AS user_ids
FROM audit_log
WHERE action NOT IN (
  'voucher_issued', 'voucher_redeemed', 'voucher_cancelled', 'voucher_expired',
  'user_login', 'user_logout', 'user_created', 'user_updated',
  'operator_created', 'operator_updated',
  'session_closed',
  'config_changed'
)
GROUP BY action
ORDER BY cantidad DESC;

-- ═══════════════════════════════════════════════════════════
-- PASO 2: MIGRACIÓN DE DATOS
-- ═══════════════════════════════════════════════════════════

-- Opción A: Migrar 'voucher_created' → 'voucher_issued'
-- (Si el sistema usaba voucher_created antes)
UPDATE audit_log
SET action = 'voucher_issued'
WHERE action = 'voucher_created';

-- Opción B: Agregar columna de backup ANTES de modificar
-- (Opcional, para auditoría completa)
-- ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS action_original TEXT;
-- UPDATE audit_log SET action_original = action WHERE action_original IS NULL;

-- Opción C: Eliminar registros con actions desconocidas
-- (Usar SOLO si son registros de prueba o erróneos)
-- CUIDADO: Esto elimina datos permanentemente
/*
DELETE FROM audit_log
WHERE action NOT IN (
  'voucher_issued', 'voucher_redeemed', 'voucher_cancelled', 'voucher_expired',
  'user_login', 'user_logout', 'user_created', 'user_updated',
  'operator_created', 'operator_updated',
  'session_closed',
  'config_changed',
  'voucher_created'  -- Permitir temporalmente para migración
);
*/

-- Opción D: Renombrar actions desconocidas a 'unknown_action'
-- (Preserva registros pero los marca como desconocidos)
/*
UPDATE audit_log
SET action = 'unknown_action'
WHERE action NOT IN (
  'voucher_issued', 'voucher_redeemed', 'voucher_cancelled', 'voucher_expired',
  'user_login', 'user_logout', 'user_created', 'user_updated',
  'operator_created', 'operator_updated',
  'session_closed',
  'config_changed',
  'voucher_created'
);

-- Si usas esta opción, agregar 'unknown_action' al constraint:
-- 'unknown_action'  -- Para registros históricos desconocidos
*/

-- ═══════════════════════════════════════════════════════════
-- PASO 3: VERIFICACIÓN POST-MIGRACIÓN
-- ═══════════════════════════════════════════════════════════

DO $$
DECLARE
  registros_invalidos INTEGER;
BEGIN
  -- Verificar que NO queden registros inválidos
  SELECT COUNT(*) INTO registros_invalidos
  FROM audit_log
  WHERE action NOT IN (
    'voucher_issued', 'voucher_redeemed', 'voucher_cancelled', 'voucher_expired',
    'user_login', 'user_logout', 'user_created', 'user_updated',
    'operator_created', 'operator_updated',
    'session_closed',
    'config_changed'
  );

  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════════════════';
  RAISE NOTICE 'VERIFICACIÓN POST-MIGRACIÓN';
  RAISE NOTICE '═══════════════════════════════════════════════════';
  RAISE NOTICE 'Registros con actions inválidas restantes: %', registros_invalidos;

  IF registros_invalidos > 0 THEN
    RAISE EXCEPTION '❌ ERROR: Aún quedan % registros inválidos. Revisa la migración.', registros_invalidos;
  ELSE
    RAISE NOTICE '✅ MIGRACIÓN EXITOSA: Todos los registros son válidos';
  END IF;
  RAISE NOTICE '═══════════════════════════════════════════════════';
  RAISE NOTICE '';
END $$;

-- ═══════════════════════════════════════════════════════════
-- PASO 4: ELIMINAR CONSTRAINT EXISTENTE
-- ═══════════════════════════════════════════════════════════

ALTER TABLE audit_log
DROP CONSTRAINT IF EXISTS audit_log_action_check;

RAISE NOTICE '✅ Constraint anterior eliminado';

-- ═══════════════════════════════════════════════════════════
-- PASO 5: CREAR NUEVO CONSTRAINT
-- ═══════════════════════════════════════════════════════════

ALTER TABLE audit_log
ADD CONSTRAINT audit_log_action_check
CHECK (action IN (
  -- VOUCHER ACTIONS
  'voucher_issued',      -- USADO: pure/main.js línea 1315
  'voucher_redeemed',    -- USADO: pure/main.js línea 1658
  'voucher_cancelled',   -- FUTURO
  'voucher_expired',     -- FUTURO

  -- USER ACTIONS
  'user_login',          -- USADO: pure/main.js línea 482
  'user_created',        -- USADO: pure/main.js línea 2242
  'user_updated',        -- USADO: pure/main.js líneas 2336, 2397, 2447
  'user_logout',         -- FUTURO

  -- OPERATOR ACTIONS
  'operator_created',    -- USADO: pure/main.js línea 1896
  'operator_updated',    -- USADO: pure/main.js líneas 1946, 1994, 2041

  -- SESSION ACTIONS
  'session_closed',      -- USADO: pure/main.js línea 3830

  -- CONFIG ACTIONS
  'config_changed'       -- FUTURO
));

RAISE NOTICE '✅ Nuevo constraint creado con 12 actions';

-- ═══════════════════════════════════════════════════════════
-- PASO 6: VERIFICACIÓN FINAL
-- ═══════════════════════════════════════════════════════════

DO $$
DECLARE
  constraint_exists BOOLEAN;
  constraint_def TEXT;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'audit_log'::regclass
      AND conname = 'audit_log_action_check'
  ) INTO constraint_exists;

  IF NOT constraint_exists THEN
    RAISE EXCEPTION 'ERROR: Constraint audit_log_action_check no fue creado';
  END IF;

  SELECT pg_get_constraintdef(oid)
  INTO constraint_def
  FROM pg_constraint
  WHERE conrelid = 'audit_log'::regclass
    AND conname = 'audit_log_action_check';

  RAISE NOTICE '═══════════════════════════════════════════════════';
  RAISE NOTICE 'SUCCESS: Constraint actualizado correctamente';
  RAISE NOTICE '═══════════════════════════════════════════════════';
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

-- Ver distribución de actions después del fix
SELECT
  action,
  COUNT(*) AS cantidad,
  MIN(created_at) AS primera_vez,
  MAX(created_at) AS ultima_vez
FROM audit_log
GROUP BY action
ORDER BY cantidad DESC;

-- Verificar constraint
SELECT
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'audit_log'::regclass
  AND conname = 'audit_log_action_check';

-- ═══════════════════════════════════════════════════════════
-- NOTAS IMPORTANTES
-- ═══════════════════════════════════════════════════════════
--
-- ERROR ORIGINAL:
--   El script anterior falló porque había registros con actions
--   que no están en la nueva lista.
--
-- SOLUCIÓN APLICADA:
--   1. Diagnosticar qué actions existen actualmente
--   2. Migrar 'voucher_created' → 'voucher_issued'
--   3. Verificar que no queden registros inválidos
--   4. Aplicar nuevo constraint
--
-- OPCIONES DE MIGRACIÓN:
--   - Opción A: Migrar voucher_created → voucher_issued (APLICADA)
--   - Opción B: Agregar columna action_original (backup)
--   - Opción C: Eliminar registros inválidos (DESTRUCTIVO)
--   - Opción D: Renombrar a 'unknown_action' (preserva datos)
--
-- ROLLBACK:
--   Si algo sale mal, ejecutar ROLLBACK; en vez de COMMIT;
--   El script usa transacción, así que no se aplican cambios hasta el COMMIT.
--
-- ANTES DE EJECUTAR:
--   1. Hacer backup de audit_log:
--      pg_dump -h xxx -U postgres -t audit_log > audit_log_backup.sql
--
--   2. Revisar el diagnóstico inicial del script
--      para saber qué actions existen
--
--   3. Decidir qué hacer con registros inválidos:
--      - ¿Migrar? (Opción A)
--      - ¿Eliminar? (Opción C)
--      - ¿Preservar con unknown_action? (Opción D)
--
-- ═══════════════════════════════════════════════════════════
