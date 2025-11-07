-- ═══════════════════════════════════════════════════════════
-- DIAGNÓSTICO: Estructura de la tabla audit_log
-- ═══════════════════════════════════════════════════════════
-- PROPÓSITO:
--   Identificar EXACTAMENTE qué columnas tiene la tabla audit_log
--   para poder corregir el script de diagnóstico
--
-- TIEMPO: < 1 segundo
-- ═══════════════════════════════════════════════════════════

-- Opción 1: Ver estructura completa de la tabla
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'audit_log'
ORDER BY ordinal_position;

-- Opción 2: Describir tabla (sintaxis PostgreSQL)
\d audit_log;

-- Opción 3: Ver primeros registros para identificar columnas
SELECT *
FROM audit_log
LIMIT 5;

-- Opción 4: Contar registros totales
SELECT COUNT(*) AS total_registros
FROM audit_log;

-- ═══════════════════════════════════════════════════════════
-- NOTAS
-- ═══════════════════════════════════════════════════════════
-- Una vez identifiques las columnas reales, podremos corregir
-- el script DIAGNOSTICO-audit-log-ANTES-DE-FIX.sql
--
-- Columnas esperadas (pueden variar):
--   - id
--   - action
--   - user_id
--   - details (o metadata, o data)
--   - created_at (o timestamp, o fecha, o date_created)
--   - ip_address (opcional)
--   - user_agent (opcional)
-- ═══════════════════════════════════════════════════════════
