-- ═══════════════════════════════════════════════════════════
-- DIAGNÓSTICO: audit_log ANTES DE APLICAR FIX
-- ═══════════════════════════════════════════════════════════
-- PROPÓSITO:
--   Identificar EXACTAMENTE qué registros causan el error:
--   "check constraint audit_log_action_check is violated by some row"
--
-- EJECUTAR ESTE SCRIPT PRIMERO, ANTES DE APLICAR NINGÚN FIX
--
-- TIEMPO: ~10 segundos
-- ═══════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════
-- 1. INFORMACIÓN GENERAL DE LA TABLA
-- ═══════════════════════════════════════════════════════════

SELECT
  'Total de registros en audit_log' AS descripcion,
  COUNT(*) AS cantidad
FROM audit_log

UNION ALL

SELECT
  'Registros de las últimas 24 horas',
  COUNT(*)
FROM audit_log
WHERE created_at > NOW() - INTERVAL '24 hours'

UNION ALL

SELECT
  'Registros de la última semana',
  COUNT(*)
FROM audit_log
WHERE created_at > NOW() - INTERVAL '7 days'

UNION ALL

SELECT
  'Primer registro',
  NULL
FROM audit_log
ORDER BY created_at ASC
LIMIT 1;

-- ═══════════════════════════════════════════════════════════
-- 2. CONSTRAINT ACTUAL
-- ═══════════════════════════════════════════════════════════

SELECT
  'CONSTRAINT ACTUAL' AS tipo,
  conname AS nombre,
  pg_get_constraintdef(oid) AS definicion
FROM pg_constraint
WHERE conrelid = 'audit_log'::regclass
  AND conname = 'audit_log_action_check';

-- ═══════════════════════════════════════════════════════════
-- 3. ACTIONS ACTUALMENTE PERMITIDAS (si existe constraint)
-- ═══════════════════════════════════════════════════════════

-- Extraer actions permitidas del constraint actual
WITH constraint_def AS (
  SELECT pg_get_constraintdef(oid) AS def
  FROM pg_constraint
  WHERE conrelid = 'audit_log'::regclass
    AND conname = 'audit_log_action_check'
)
SELECT
  'Actions permitidas actualmente' AS info,
  def
FROM constraint_def;

-- ═══════════════════════════════════════════════════════════
-- 4. TODAS LAS ACTIONS USADAS EN LOS DATOS REALES
-- ═══════════════════════════════════════════════════════════

SELECT
  action,
  COUNT(*) AS cantidad,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) AS porcentaje,
  MIN(created_at) AS primera_vez,
  MAX(created_at) AS ultima_vez,
  COUNT(DISTINCT user_id) AS usuarios_unicos
FROM audit_log
GROUP BY action
ORDER BY cantidad DESC;

-- ═══════════════════════════════════════════════════════════
-- 5. REGISTROS QUE VIOLARÍAN EL NUEVO CONSTRAINT
-- ═══════════════════════════════════════════════════════════

-- Estas son las actions que queremos permitir en el nuevo constraint:
WITH actions_nuevas AS (
  SELECT unnest(ARRAY[
    'voucher_issued', 'voucher_redeemed', 'voucher_cancelled', 'voucher_expired',
    'user_login', 'user_logout', 'user_created', 'user_updated',
    'operator_created', 'operator_updated',
    'session_closed',
    'config_changed'
  ]) AS action
)
SELECT
  '⚠️  REGISTROS PROBLEMÁTICOS' AS tipo,
  al.action,
  COUNT(*) AS cantidad,
  MIN(al.created_at) AS primera_vez,
  MAX(al.created_at) AS ultima_vez
FROM audit_log al
WHERE al.action NOT IN (SELECT action FROM actions_nuevas)
GROUP BY al.action
ORDER BY cantidad DESC;

-- ═══════════════════════════════════════════════════════════
-- 6. ANÁLISIS: voucher_created vs voucher_issued
-- ═══════════════════════════════════════════════════════════

SELECT
  '¿Usa voucher_created?' AS pregunta,
  CASE
    WHEN COUNT(*) > 0 THEN '✅ SÍ - Migrar a voucher_issued'
    ELSE '❌ NO - No requiere migración'
  END AS respuesta,
  COUNT(*) AS cantidad
FROM audit_log
WHERE action = 'voucher_created'

UNION ALL

SELECT
  '¿Usa voucher_issued?',
  CASE
    WHEN COUNT(*) > 0 THEN '✅ SÍ - Ya usa el correcto'
    ELSE '❌ NO - No hay registros aún'
  END,
  COUNT(*)
FROM audit_log
WHERE action = 'voucher_issued';

-- ═══════════════════════════════════════════════════════════
-- 7. MUESTRA DE REGISTROS PROBLEMÁTICOS (primeros 10)
-- ═══════════════════════════════════════════════════════════

WITH actions_nuevas AS (
  SELECT unnest(ARRAY[
    'voucher_issued', 'voucher_redeemed', 'voucher_cancelled', 'voucher_expired',
    'user_login', 'user_logout', 'user_created', 'user_updated',
    'operator_created', 'operator_updated',
    'session_closed',
    'config_changed'
  ]) AS action
)
SELECT
  id,
  action,
  user_id,
  created_at,
  details
FROM audit_log
WHERE action NOT IN (SELECT action FROM actions_nuevas)
ORDER BY created_at DESC
LIMIT 10;

-- ═══════════════════════════════════════════════════════════
-- 8. RECOMENDACIONES BASADAS EN LOS DATOS
-- ═══════════════════════════════════════════════════════════

WITH actions_problematicas AS (
  SELECT action, COUNT(*) AS cantidad
  FROM audit_log
  WHERE action NOT IN (
    'voucher_issued', 'voucher_redeemed', 'voucher_cancelled', 'voucher_expired',
    'user_login', 'user_logout', 'user_created', 'user_updated',
    'operator_created', 'operator_updated',
    'session_closed',
    'config_changed'
  )
  GROUP BY action
)
SELECT
  '══════════════════════════════════════════════' AS separador

UNION ALL

SELECT '📋 RECOMENDACIONES'

UNION ALL

SELECT '══════════════════════════════════════════════'

UNION ALL

SELECT
  CASE
    WHEN EXISTS (SELECT 1 FROM actions_problematicas WHERE action = 'voucher_created') THEN
      '✅ MIGRAR: voucher_created → voucher_issued'
    ELSE ''
  END

UNION ALL

SELECT
  CASE
    WHEN EXISTS (SELECT 1 FROM actions_problematicas WHERE action NOT IN ('voucher_created')) THEN
      '⚠️  HAY OTRAS ACTIONS DESCONOCIDAS - Revisar manualmente'
    ELSE ''
  END

UNION ALL

SELECT
  CASE
    WHEN (SELECT COUNT(*) FROM actions_problematicas) = 0 THEN
      '✅ NO HAY REGISTROS PROBLEMÁTICOS - Puedes aplicar el constraint directamente'
    ELSE
      '❌ HAY ' || (SELECT SUM(cantidad) FROM actions_problematicas)::TEXT ||
      ' REGISTROS PROBLEMÁTICOS - Requiere migración'
  END;

-- ═══════════════════════════════════════════════════════════
-- 9. SCRIPT SUGERIDO SEGÚN LOS DATOS
-- ═══════════════════════════════════════════════════════════

SELECT
  '══════════════════════════════════════════════' AS script_sugerido

UNION ALL

SELECT '📝 PRÓXIMO PASO'

UNION ALL

SELECT '══════════════════════════════════════════════'

UNION ALL

SELECT
  CASE
    WHEN (SELECT COUNT(*) FROM audit_log WHERE action NOT IN (
      'voucher_issued', 'voucher_redeemed', 'voucher_cancelled', 'voucher_expired',
      'user_login', 'user_logout', 'user_created', 'user_updated',
      'operator_created', 'operator_updated', 'session_closed', 'config_changed'
    )) > 0 THEN
      'Ejecutar: fix-audit-log-constraint-CON-MIGRACION.sql'
    ELSE
      'Ejecutar: fix-audit-log-constraint-OPTIMIZADO.sql'
  END;

-- ═══════════════════════════════════════════════════════════
-- INTERPRETACIÓN DE RESULTADOS
-- ═══════════════════════════════════════════════════════════
--
-- Sección 4: "TODAS LAS ACTIONS USADAS"
--   - Muestra qué actions existen actualmente en los datos
--   - Si ves 'voucher_created' aquí, necesitas migración
--
-- Sección 5: "REGISTROS PROBLEMÁTICOS"
--   - Si esta query retorna resultados, HAY PROBLEMA
--   - Necesitas ejecutar fix-audit-log-constraint-CON-MIGRACION.sql
--   - Si NO retorna nada, puedes usar fix-audit-log-constraint-OPTIMIZADO.sql
--
-- Sección 6: "voucher_created vs voucher_issued"
--   - Si usa voucher_created: Migrar a voucher_issued
--   - Si usa voucher_issued: Ya está correcto
--
-- Sección 9: "SCRIPT SUGERIDO"
--   - Te dice qué script ejecutar a continuación
--
-- ═══════════════════════════════════════════════════════════
