-- ═══════════════════════════════════════════════════════════
-- DIAGNÓSTICO PRE-IMPLEMENTACIÓN: audit_log constraint
-- ═══════════════════════════════════════════════════════════
-- PROPÓSITO: Ejecutar estas queries ANTES de implementar el fix
--            para entender el estado actual del sistema
--
-- CÓMO USAR:
--   1. Copiar todo este archivo
--   2. Pegar en Supabase SQL Editor
--   3. Ejecutar
--   4. Guardar resultados para comparar después del fix
--
-- TIEMPO: ~30 segundos
-- ═══════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════
-- 1. CONSTRAINT ACTUAL
-- ═══════════════════════════════════════════════════════════
-- Ver qué actions están permitidas actualmente

SELECT
  conname AS nombre_constraint,
  pg_get_constraintdef(oid) AS definicion_actual
FROM pg_constraint
WHERE conrelid = 'audit_log'::regclass
  AND conname = 'audit_log_action_check';

-- ESPERADO:
--   CHECK (action IN ('user_login', 'voucher_created', 'voucher_redeemed'))
--
-- Si retorna vacío: NO hay constraint (muy mal)
-- Si retorna 3 actions: Es el constraint original (esperado)

-- ═══════════════════════════════════════════════════════════
-- 2. ESTRUCTURA DE LA TABLA
-- ═══════════════════════════════════════════════════════════
-- Ver todas las columnas de audit_log

SELECT
  column_name,
  data_type,
  character_maximum_length,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'audit_log'
ORDER BY ordinal_position;

-- ESPERADO:
--   id, created_at, action, user_id, user_role, station_id,
--   voucher_id, details, ip_address, etc.

-- ═══════════════════════════════════════════════════════════
-- 3. TODOS LOS CONSTRAINTS
-- ═══════════════════════════════════════════════════════════
-- Ver si hay otros constraints que puedan causar problemas

SELECT
  conname AS constraint_name,
  CASE contype
    WHEN 'c' THEN 'CHECK'
    WHEN 'f' THEN 'FOREIGN KEY'
    WHEN 'p' THEN 'PRIMARY KEY'
    WHEN 'u' THEN 'UNIQUE'
    WHEN 't' THEN 'TRIGGER'
    ELSE contype::text
  END AS constraint_type,
  pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'audit_log'::regclass
ORDER BY contype;

-- ESPERADO:
--   - PRIMARY KEY en id
--   - CHECK en action (el que vamos a modificar)
--   - Posiblemente FOREIGN KEY en user_id, station_id, voucher_id

-- ═══════════════════════════════════════════════════════════
-- 4. ACTIONS USADAS ACTUALMENTE (DATOS REALES)
-- ═══════════════════════════════════════════════════════════
-- Ver qué actions se están intentando registrar

SELECT
  action,
  COUNT(*) AS cantidad_total,
  COUNT(*) * 100.0 / SUM(COUNT(*)) OVER () AS porcentaje,
  MIN(created_at) AS primera_vez,
  MAX(created_at) AS ultima_vez,
  CASE
    WHEN action IN ('user_login', 'voucher_created', 'voucher_redeemed')
    THEN '✅ PERMITIDA'
    ELSE '❌ BLOQUEADA'
  END AS estado_actual
FROM audit_log
GROUP BY action
ORDER BY cantidad_total DESC;

-- ANÁLISIS:
--   - Actions con '✅ PERMITIDA': Se están registrando OK
--   - Actions con '❌ BLOQUEADA': Están fallando silenciosamente
--
-- ESPERADO:
--   user_login: Muchos registros ✅
--   voucher_created: Pocos o ninguno (código no lo usa) ✅
--   voucher_redeemed: Muchos registros ✅
--
-- PROBLEMA ESPERADO:
--   voucher_issued: NO debería aparecer (fallando silenciosamente) ❌
--   user_created: NO debería aparecer (fallando) ❌
--   operator_created: NO debería aparecer (fallando) ❌
--   etc.

-- ═══════════════════════════════════════════════════════════
-- 5. ACTIONS QUE ESTÁN FALLANDO
-- ═══════════════════════════════════════════════════════════
-- Detectar actions que NO están en el constraint actual

WITH constraint_actions AS (
  SELECT unnest(ARRAY['user_login', 'voucher_created', 'voucher_redeemed']) AS allowed_action
)
SELECT
  action AS action_bloqueada,
  COUNT(*) AS intentos_registrados
FROM audit_log
WHERE action NOT IN (SELECT allowed_action FROM constraint_actions)
GROUP BY action
ORDER BY intentos_registrados DESC;

-- Si retorna resultados: Hay actions que pasaron antes del constraint
-- Si retorna vacío: O bien el constraint siempre existió, o bien
--                   los errores son silenciosos y no hay registros

-- NOTA: Lo más probable es que retorne VACÍO porque las inserciones
--       fallan silenciosamente y nunca llegan a la tabla

-- ═══════════════════════════════════════════════════════════
-- 6. ACTIVIDAD RECIENTE (ÚLTIMAS 24 HORAS)
-- ═══════════════════════════════════════════════════════════
-- Ver qué events se han registrado recientemente

SELECT
  action,
  COUNT(*) AS registros_24h,
  MIN(created_at) AS mas_antiguo,
  MAX(created_at) AS mas_reciente
FROM audit_log
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY action
ORDER BY registros_24h DESC;

-- ANÁLISIS:
--   - Si solo ves 2-3 actions: Constraint está funcionando (mal, pero funcionando)
--   - Si ves muchas actions: Constraint no existe o fue removido
--   - Si no ves nada: No hay actividad o tabla vacía

-- ═══════════════════════════════════════════════════════════
-- 7. ESTADÍSTICAS DE LA TABLA
-- ═══════════════════════════════════════════════════════════
-- Tamaño y cantidad de registros

SELECT
  pg_size_pretty(pg_total_relation_size('audit_log')) AS tamaño_total,
  pg_size_pretty(pg_relation_size('audit_log')) AS tamaño_tabla,
  pg_size_pretty(pg_indexes_size('audit_log')) AS tamaño_indices,
  COUNT(*) AS total_registros,
  MIN(created_at) AS registro_mas_antiguo,
  MAX(created_at) AS registro_mas_reciente,
  AGE(MAX(created_at), MIN(created_at)) AS antiguedad
FROM audit_log;

-- ANÁLISIS:
--   - Tamaño < 10MB: Lock será < 50ms (excelente)
--   - Tamaño 10-100MB: Lock será ~50-200ms (aceptable)
--   - Tamaño > 100MB: Lock será ~200-500ms (programar en madrugada)
--   - Tamaño > 1GB: Lock será > 500ms (requiere planificación)

-- ═══════════════════════════════════════════════════════════
-- 8. ÍNDICES EXISTENTES
-- ═══════════════════════════════════════════════════════════
-- Ver índices que podrían afectar performance del ALTER TABLE

SELECT
  indexname AS nombre_indice,
  indexdef AS definicion
FROM pg_indexes
WHERE tablename = 'audit_log'
ORDER BY indexname;

-- ANÁLISIS:
--   - Más índices = Mayor lock time
--   - Índices en 'action': Pueden ser afectados por el constraint

-- ═══════════════════════════════════════════════════════════
-- 9. PERMISOS DEL USUARIO ACTUAL
-- ═══════════════════════════════════════════════════════════
-- Verificar que tienes permisos para ALTER TABLE

SELECT
  current_user AS usuario_actual,
  has_table_privilege('audit_log', 'INSERT') AS puede_insert,
  has_table_privilege('audit_log', 'UPDATE') AS puede_update,
  has_table_privilege('audit_log', 'DELETE') AS puede_delete,
  has_schema_privilege('public', 'CREATE') AS puede_crear_en_public,
  pg_has_role(current_user, 'postgres', 'MEMBER') AS es_superuser;

-- NECESARIO PARA ALTER TABLE:
--   - puede_crear_en_public: true (o ser owner de la tabla)
--   - es_superuser: true (o ser owner de la tabla)
--
-- Si no tienes permisos, usa service_role key en Supabase

-- ═══════════════════════════════════════════════════════════
-- 10. LOCKS ACTIVOS (si ALTER TABLE falla o se queda colgado)
-- ═══════════════════════════════════════════════════════════
-- Ver queries que están usando audit_log actualmente

SELECT
  pid,
  usename AS usuario,
  application_name AS app,
  client_addr AS ip,
  state AS estado,
  wait_event_type AS tipo_espera,
  wait_event AS evento_espera,
  query_start,
  state_change,
  LEFT(query, 100) AS query_truncada
FROM pg_stat_activity
WHERE datname = current_database()
  AND (
    query ILIKE '%audit_log%'
    OR query ILIKE '%INSERT INTO%'
  )
  AND state = 'active'
  AND pid <> pg_backend_pid()  -- Excluir esta query
ORDER BY query_start;

-- ANÁLISIS:
--   - Si retorna resultados: Hay queries activas en audit_log
--     ESPERAR a que terminen antes de ejecutar ALTER TABLE
--   - Si retorna vacío: Seguro ejecutar ALTER TABLE

-- ═══════════════════════════════════════════════════════════
-- 11. RESUMEN EJECUTIVO
-- ═══════════════════════════════════════════════════════════
-- Un solo query con toda la info importante

SELECT
  -- Constraint
  (SELECT COUNT(*) FROM pg_constraint WHERE conrelid = 'audit_log'::regclass AND conname = 'audit_log_action_check') AS constraint_existe,
  (SELECT COUNT(DISTINCT action) FROM audit_log) AS actions_diferentes_en_datos,

  -- Datos
  COUNT(*) AS total_registros,
  pg_size_pretty(pg_total_relation_size('audit_log')) AS tamaño,
  MIN(created_at) AS mas_antiguo,
  MAX(created_at) AS mas_reciente,

  -- Actividad reciente
  (SELECT COUNT(*) FROM audit_log WHERE created_at > NOW() - INTERVAL '1 hour') AS registros_ultima_hora,
  (SELECT COUNT(*) FROM audit_log WHERE created_at > NOW() - INTERVAL '24 hours') AS registros_ultimo_dia,

  -- Locks
  (SELECT COUNT(*) FROM pg_stat_activity WHERE query ILIKE '%audit_log%' AND state = 'active' AND pid <> pg_backend_pid()) AS queries_activas

FROM audit_log;

-- INTERPRETACIÓN RÁPIDA:
--   constraint_existe = 1: OK, existe (esperado)
--   constraint_existe = 0: PROBLEMA, no hay constraint
--   actions_diferentes_en_datos = 2-3: Solo las permitidas actualmente
--   actions_diferentes_en_datos > 3: Constraint no siempre existió
--   tamaño < 10MB: Implementación rápida
--   queries_activas = 0: Seguro proceder
--   queries_activas > 0: ESPERAR o ejecutar en madrugada

-- ═══════════════════════════════════════════════════════════
-- 12. DISTRIBUCIÓN POR HORA (últimas 24h)
-- ═══════════════════════════════════════════════════════════
-- Detectar horas de bajo tráfico para programar mantenimiento

SELECT
  EXTRACT(HOUR FROM created_at) AS hora_del_dia,
  COUNT(*) AS cantidad_registros,
  COUNT(DISTINCT action) AS actions_diferentes,
  ARRAY_AGG(DISTINCT action ORDER BY action) AS actions_usadas
FROM audit_log
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY EXTRACT(HOUR FROM created_at)
ORDER BY hora_del_dia;

-- ANÁLISIS:
--   - Buscar hora con menor cantidad_registros
--   - Esa es la mejor hora para ejecutar el fix
--   - Típicamente: 3-5 AM (madrugada)

-- ═══════════════════════════════════════════════════════════
-- FIN DEL DIAGNÓSTICO
-- ═══════════════════════════════════════════════════════════

-- PRÓXIMOS PASOS:
--
-- 1. Analizar resultados de estas queries
-- 2. Identificar mejor hora para mantenimiento (query 12)
-- 3. Verificar permisos (query 9)
-- 4. Hacer backup de estructura actual
-- 5. Ejecutar fix-audit-log-constraint-OPTIMIZADO.sql
-- 6. Verificar éxito
-- 7. Monitorear 24 horas
--
-- DOCUMENTACIÓN:
--   c:\appCasino\ANALISIS_VIABILIDAD_FIX_AUDIT_LOG_CONSTRAINT.md
--   c:\appCasino\RESUMEN_AUDIT_LOG_CONSTRAINT.md
--   c:\appCasino\SqulInstrucciones\fix-audit-log-constraint-OPTIMIZADO.sql
