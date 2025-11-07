-- ═══════════════════════════════════════════════════════════
-- DIAGNÓSTICO SIMPLE: audit_log en Supabase
-- ═══════════════════════════════════════════════════════════
-- ERROR RECIBIDO:
--   "column created_at does not exist"
--
-- SOLUCIÓN:
--   Primero identificar qué columnas tiene la tabla
--
-- TIEMPO: < 5 segundos
-- ═══════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════
-- PASO 1: Ver estructura de la tabla
-- ═══════════════════════════════════════════════════════════

SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'audit_log'
  AND table_schema = 'public'
ORDER BY ordinal_position;

-- ═══════════════════════════════════════════════════════════
-- PASO 2: Ver primeros 5 registros
-- ═══════════════════════════════════════════════════════════

SELECT *
FROM audit_log
LIMIT 5;

-- ═══════════════════════════════════════════════════════════
-- PASO 3: Contar registros por action
-- ═══════════════════════════════════════════════════════════

SELECT
  action,
  COUNT(*) AS cantidad
FROM audit_log
GROUP BY action
ORDER BY cantidad DESC;

-- ═══════════════════════════════════════════════════════════
-- PASO 4: Ver constraint actual (si existe)
-- ═══════════════════════════════════════════════════════════

SELECT
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'audit_log'::regclass
  AND contype = 'c'  -- check constraint
ORDER BY conname;

-- ═══════════════════════════════════════════════════════════
-- PASO 5: Identificar actions problemáticas
-- ═══════════════════════════════════════════════════════════

-- Actions que queremos permitir en el nuevo constraint:
SELECT
  action,
  COUNT(*) AS cantidad,
  CASE
    WHEN action IN (
      'voucher_issued', 'voucher_redeemed', 'voucher_cancelled', 'voucher_expired',
      'user_login', 'user_logout', 'user_created', 'user_updated',
      'operator_created', 'operator_updated',
      'session_closed',
      'config_changed'
    ) THEN '✅ Permitida'
    ELSE '❌ PROBLEMÁTICA - Requiere migración'
  END AS estado
FROM audit_log
GROUP BY action
ORDER BY
  CASE
    WHEN action NOT IN (
      'voucher_issued', 'voucher_redeemed', 'voucher_cancelled', 'voucher_expired',
      'user_login', 'user_logout', 'user_created', 'user_updated',
      'operator_created', 'operator_updated',
      'session_closed',
      'config_changed'
    ) THEN 0  -- Problemáticas primero
    ELSE 1
  END,
  cantidad DESC;

-- ═══════════════════════════════════════════════════════════
-- INTERPRETACIÓN DE RESULTADOS
-- ═══════════════════════════════════════════════════════════
--
-- PASO 1: "Ver estructura de la tabla"
--   Identifica qué columnas tiene realmente la tabla.
--   Busca columnas de timestamp: created_at, timestamp, fecha, etc.
--
-- PASO 3: "Contar registros por action"
--   Muestra TODAS las actions usadas actualmente.
--
-- PASO 5: "Identificar actions problemáticas"
--   Marca con ❌ las actions que causarán el error.
--   Si ves 'voucher_created' con ❌, necesitas migrar a 'voucher_issued'.
--
-- PRÓXIMOS PASOS:
--
-- Si hay actions problemáticas (marcadas con ❌):
--   → Ejecutar: fix-audit-log-constraint-CON-MIGRACION.sql
--
-- Si NO hay actions problemáticas (todas con ✅):
--   → Ejecutar: fix-audit-log-constraint-OPTIMIZADO.sql
--
-- CASO ESPECIAL: Si ves 'voucher_created':
--   Necesitas migrarla a 'voucher_issued' porque el código actual
--   usa 'voucher_issued' (línea 1315 de main.js)
--
-- ═══════════════════════════════════════════════════════════
