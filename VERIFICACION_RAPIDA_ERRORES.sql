-- ============================================
-- VERIFICACIÓN RÁPIDA POST-CORRECCIÓN
-- ============================================
-- Ejecutar: sqlite3 Caja/data/casino.db < VERIFICACION_RAPIDA_ERRORES.sql
-- ============================================

.mode column
.headers on
.width 30 15 10 10 25 10

.print ''
.print '================================================================'
.print 'VERIFICACIÓN RÁPIDA - ERRORES CRÍTICOS'
.print '================================================================'
.print ''

-- ============================================
-- VERIFICACIÓN 1: Campo hash_seguridad
-- ============================================
.print '1. VERIFICACIÓN CAMPO hash_seguridad'
.print '   (Debe existir para que funcione el INSERT)'
.print ''

SELECT
  CASE
    WHEN COUNT(*) > 0 THEN '✅ EXISTE'
    ELSE '❌ NO EXISTE - EJECUTAR: ALTER TABLE tickets ADD COLUMN hash_seguridad TEXT;'
  END as status
FROM pragma_table_info('tickets')
WHERE name = 'hash_seguridad';

-- ============================================
-- VERIFICACIÓN 2: Conteo tickets PREV-
-- ============================================
.print ''
.print '================================================================'
.print '2. TICKETS PREV- EN SQLite'
.print '================================================================'
.print ''

SELECT
  COUNT(*) as total_prev_tickets,
  CASE
    WHEN COUNT(*) = 0 THEN '❌ NO HAY TICKETS PREV- (ERROR CONFIRMADO)'
    ELSE '✅ HAY TICKETS PREV-'
  END as status
FROM tickets
WHERE code LIKE 'PREV-%';

-- ============================================
-- VERIFICACIÓN 3: Últimos tickets creados
-- ============================================
.print ''
.print '================================================================'
.print '3. ÚLTIMOS 5 TICKETS CREADOS (CUALQUIER TIPO)'
.print '================================================================'
.print ''

SELECT
  code,
  amount,
  currency,
  estado,
  datetime(fecha_emision, 'localtime') as fecha,
  CASE WHEN sincronizado = 1 THEN 'SI' ELSE 'NO' END as sync,
  CASE WHEN hash_seguridad IS NOT NULL THEN 'SI' ELSE 'NO' END as tiene_hash
FROM tickets
ORDER BY id DESC
LIMIT 5;

-- ============================================
-- VERIFICACIÓN 4: Tickets de HOY
-- ============================================
.print ''
.print '================================================================'
.print '4. TICKETS DE HOY'
.print '================================================================'
.print ''

SELECT
  COUNT(*) as total_hoy,
  SUM(CASE WHEN estado = 'emitido' THEN 1 ELSE 0 END) as emitidos,
  SUM(CASE WHEN estado = 'usado' THEN 1 ELSE 0 END) as usados,
  SUM(CASE WHEN sincronizado = 1 THEN 1 ELSE 0 END) as sincronizados
FROM tickets
WHERE DATE(fecha_emision) = DATE('now', 'localtime');

-- ============================================
-- VERIFICACIÓN 5: Tickets sin hash_seguridad
-- ============================================
.print ''
.print '================================================================'
.print '5. TICKETS SIN hash_seguridad'
.print '================================================================'
.print ''

SELECT
  COUNT(*) as total_sin_hash,
  CASE
    WHEN COUNT(*) > 0 THEN '⚠️ HAY TICKETS SIN HASH (necesitan actualización)'
    ELSE '✅ TODOS LOS TICKETS TIENEN HASH'
  END as status
FROM tickets
WHERE hash_seguridad IS NULL;

-- ============================================
-- VERIFICACIÓN 6: Índices en tabla tickets
-- ============================================
.print ''
.print '================================================================'
.print '6. ÍNDICES EN TABLA tickets'
.print '================================================================'
.print ''

SELECT
  name,
  CASE
    WHEN name LIKE '%code%' THEN '✅ Índice en code (RECOMENDADO)'
    ELSE 'Otro índice'
  END as tipo
FROM sqlite_master
WHERE type = 'index'
  AND tbl_name = 'tickets';

-- ============================================
-- VERIFICACIÓN 7: Constraints UNIQUE
-- ============================================
.print ''
.print '================================================================'
.print '7. CÓDIGOS DUPLICADOS (Si hay, causa error en INSERT)'
.print '================================================================'
.print ''

SELECT
  code,
  COUNT(*) as duplicados
FROM tickets
GROUP BY code
HAVING COUNT(*) > 1;

.print ''
.print 'Si no aparece nada arriba: ✅ No hay códigos duplicados'
.print ''

-- ============================================
-- VERIFICACIÓN 8: Tickets recientes con detalle
-- ============================================
.print ''
.print '================================================================'
.print '8. DETALLE ÚLTIMOS 3 TICKETS PREV-'
.print '================================================================'
.print ''

SELECT
  id,
  code,
  amount || ' ' || currency as monto,
  estado,
  mesa,
  datetime(fecha_emision, 'localtime') as fecha,
  CASE WHEN sincronizado = 1 THEN 'SI' ELSE 'NO' END as sync,
  CASE WHEN hash_seguridad IS NOT NULL THEN 'SI' ELSE 'NO' END as hash
FROM tickets
WHERE code LIKE 'PREV-%'
ORDER BY id DESC
LIMIT 3;

-- ============================================
-- RESUMEN Y RECOMENDACIONES
-- ============================================
.print ''
.print '================================================================'
.print 'RESUMEN Y DIAGNÓSTICO'
.print '================================================================'
.print ''
.print 'INTERPRETACIÓN DE RESULTADOS:'
.print ''
.print '1. Si hash_seguridad NO EXISTE:'
.print '   -> EJECUTAR: ALTER TABLE tickets ADD COLUMN hash_seguridad TEXT;'
.print ''
.print '2. Si total_prev_tickets = 0:'
.print '   -> ERROR CONFIRMADO: Tickets no se guardan'
.print '   -> SOLUCIÓN: Revisar logs de Electron con nuevo logging detallado'
.print ''
.print '3. Si total_hoy = 0:'
.print '   -> No se están creando tickets hoy'
.print '   -> Verificar si la app está funcionando'
.print ''
.print '4. Si hay duplicados:'
.print '   -> Causa probable del error de INSERT'
.print '   -> SOLUCIÓN: Mejorar generación de códigos únicos'
.print ''
.print '5. Si hay tickets sin hash:'
.print '   -> Tickets antiguos antes de la corrección'
.print '   -> OPCIONAL: Actualizar con UPDATE tickets SET hash_seguridad = ...'
.print ''
.print '================================================================'
.print ''
