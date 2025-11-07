-- ============================================
-- DIAGNÓSTICO: Por qué los vouchers PREV- no se guardan en SQLite
-- ============================================

.mode column
.headers on
.width 20 10 10 15 25 10

-- 1. ESTRUCTURA DE TABLA
.print ''
.print '================================================================'
.print '1. ESTRUCTURA DE TABLA tickets'
.print '================================================================'
.print ''
PRAGMA table_info(tickets);

-- 2. CONTAR TICKETS PREV-
.print ''
.print '================================================================'
.print '2. TICKETS PREV- EN SQLite'
.print '================================================================'
.print ''
SELECT COUNT(*) as total_prev_tickets FROM tickets WHERE code LIKE 'PREV-%';

.print ''
.print 'Últimos 5 tickets PREV-:'
.print ''
SELECT
  code,
  amount,
  currency,
  estado,
  datetime(fecha_emision, 'localtime') as fecha,
  sincronizado
FROM tickets
WHERE code LIKE 'PREV-%'
ORDER BY id DESC
LIMIT 5;

-- 3. ÍNDICES Y CONSTRAINTS
.print ''
.print '================================================================'
.print '3. CONSTRAINTS Y ÍNDICES'
.print '================================================================'
.print ''
SELECT name, type, sql
FROM sqlite_master
WHERE type IN ('index', 'trigger')
  AND tbl_name = 'tickets';

-- 4. TICKETS SIN SINCRONIZAR
.print ''
.print '================================================================'
.print '4. TICKETS SIN SINCRONIZAR'
.print '================================================================'
.print ''
SELECT COUNT(*) as total_sin_sincronizar
FROM tickets
WHERE sincronizado = 0;

.print ''
.print 'Últimos 5 tickets sin sincronizar:'
.print ''
SELECT
  code,
  amount,
  currency,
  estado,
  datetime(fecha_emision, 'localtime') as fecha
FROM tickets
WHERE sincronizado = 0
ORDER BY id DESC
LIMIT 5;

-- 5. TICKETS DE HOY
.print ''
.print '================================================================'
.print '5. TICKETS DE HOY'
.print '================================================================'
.print ''
SELECT COUNT(*) as total_hoy
FROM tickets
WHERE DATE(fecha_emision) = DATE('now', 'localtime');

.print ''
.print 'Desglose por estado:'
.print ''
SELECT
  estado,
  COUNT(*) as cantidad,
  SUM(CASE WHEN currency = 'DOP' THEN amount ELSE 0 END) as total_dop,
  SUM(CASE WHEN currency = 'USD' THEN amount ELSE 0 END) as total_usd
FROM tickets
WHERE DATE(fecha_emision) = DATE('now', 'localtime')
GROUP BY estado;

-- 6. VERIFICAR SI EXISTE hash_seguridad
.print ''
.print '================================================================'
.print '6. VERIFICACIÓN DE CAMPO hash_seguridad'
.print '================================================================'
.print ''
SELECT
  name,
  type,
  [notnull],
  dflt_value
FROM pragma_table_info('tickets')
WHERE name = 'hash_seguridad';

-- 7. ÚLTIMOS 10 TICKETS CREADOS
.print ''
.print '================================================================'
.print '7. ÚLTIMOS 10 TICKETS CREADOS (CUALQUIER TIPO)'
.print '================================================================'
.print ''
SELECT
  id,
  code,
  amount,
  currency,
  estado,
  datetime(fecha_emision, 'localtime') as fecha,
  sincronizado,
  CASE
    WHEN hash_seguridad IS NOT NULL THEN 'SI'
    ELSE 'NO'
  END as tiene_hash
FROM tickets
ORDER BY id DESC
LIMIT 10;

.print ''
.print '================================================================'
.print 'RESUMEN'
.print '================================================================'
.print ''
.print 'Si total_prev_tickets = 0 pero total_hoy > 0:'
.print '  -> Los tickets se están creando pero con otro formato de código'
.print ''
.print 'Si total_prev_tickets = 0 y total_hoy = 0:'
.print '  -> NO se están guardando tickets en SQLite'
.print '  -> Revisar try-catch en main.js línea 1420'
.print ''
.print 'Si hash_seguridad no aparece en la tabla:'
.print '  -> Ejecutar ALTER TABLE para agregar el campo'
.print ''
