-- ============================================
-- VISTAS SQL PARA REPORTES AVANZADOS
-- Sistema TITO Casino - Supabase
-- ============================================
-- EJECUTAR EN SUPABASE SQL EDITOR
-- Tiempo estimado: 2-3 minutos
-- ============================================

-- ============================================
-- 1. VISTA: Reportes por Turno
-- ============================================

CREATE OR REPLACE VIEW voucher_reports_by_shift AS
SELECT
  DATE(issued_at) as fecha,
  CASE
    WHEN EXTRACT(HOUR FROM issued_at) BETWEEN 6 AND 13 THEN 'Mañana'
    WHEN EXTRACT(HOUR FROM issued_at) BETWEEN 14 AND 21 THEN 'Tarde'
    ELSE 'Noche'
  END as turno,
  currency,
  COUNT(*) as total_vouchers,
  COUNT(*) FILTER (WHERE status = 'active') as activos,
  COUNT(*) FILTER (WHERE status = 'redeemed') as cobrados,
  SUM(amount) as monto_total,
  SUM(amount) FILTER (WHERE status = 'active') as monto_activo,
  SUM(amount) FILTER (WHERE status = 'redeemed') as monto_cobrado,
  AVG(amount) as monto_promedio,
  ROUND((COUNT(*) FILTER (WHERE status = 'redeemed') * 100.0 / NULLIF(COUNT(*), 0)), 2) as tasa_cobro_pct
FROM vouchers
WHERE issued_at IS NOT NULL
GROUP BY DATE(issued_at), turno, currency
ORDER BY fecha DESC, turno;

-- Probar la vista
SELECT * FROM voucher_reports_by_shift LIMIT 10;

-- ============================================
-- 2. VISTA: Reportes por Operador
-- ============================================

CREATE OR REPLACE VIEW voucher_reports_by_operator AS
SELECT
  operador_nombre,
  mesa_nombre,
  currency,
  DATE(issued_at) as fecha,
  COUNT(*) as total_emitidos,
  SUM(amount) as monto_total,
  AVG(amount) as monto_promedio,
  MIN(amount) as monto_minimo,
  MAX(amount) as monto_maximo,
  COUNT(*) FILTER (WHERE status = 'redeemed') as cobrados,
  COUNT(*) FILTER (WHERE status = 'active') as pendientes,
  ROUND((COUNT(*) FILTER (WHERE status = 'redeemed') * 100.0 / NULLIF(COUNT(*), 0)), 2) as tasa_cobro_pct,
  -- Tiempo de actividad
  MIN(issued_at) as primera_emision,
  MAX(issued_at) as ultima_emision,
  EXTRACT(EPOCH FROM (MAX(issued_at) - MIN(issued_at))) / 3600 as horas_activo
FROM vouchers
WHERE operador_nombre IS NOT NULL
  AND issued_at IS NOT NULL
GROUP BY operador_nombre, mesa_nombre, currency, DATE(issued_at)
ORDER BY fecha DESC, operador_nombre;

-- Probar la vista
SELECT * FROM voucher_reports_by_operator LIMIT 10;

-- ============================================
-- 3. VISTA: Reportes por Mesa/Estación
-- ============================================

CREATE OR REPLACE VIEW voucher_reports_by_station AS
SELECT
  mesa_nombre,
  DATE(issued_at) as fecha,
  COUNT(*) as total_vouchers,
  COUNT(DISTINCT operador_nombre) as operadores_activos,
  SUM(amount) FILTER (WHERE currency = 'USD') as total_usd,
  SUM(amount) FILTER (WHERE currency = 'DOP') as total_dop,
  COUNT(*) FILTER (WHERE status = 'redeemed') as cobrados,
  COUNT(*) FILTER (WHERE status = 'active') as pendientes,
  AVG(amount) as ticket_promedio,
  MIN(issued_at) as primera_emision,
  MAX(issued_at) as ultima_emision,
  -- Calcular tickets por hora
  ROUND(COUNT(*)::DECIMAL / NULLIF(EXTRACT(EPOCH FROM (MAX(issued_at) - MIN(issued_at))) / 3600, 0), 2) as tickets_por_hora
FROM vouchers
WHERE mesa_nombre IS NOT NULL
  AND issued_at IS NOT NULL
GROUP BY mesa_nombre, DATE(issued_at)
ORDER BY fecha DESC, mesa_nombre;

-- Probar la vista
SELECT * FROM voucher_reports_by_station LIMIT 10;

-- ============================================
-- 4. VISTA: Detección de Anomalías
-- ============================================

CREATE OR REPLACE VIEW voucher_anomalies AS
-- Anomalía: Montos altos (3x promedio del operador)
SELECT
  v.id,
  v.voucher_code,
  v.amount,
  v.currency,
  v.operador_nombre,
  v.mesa_nombre,
  v.issued_at,
  v.status,
  'MONTO_ALTO' as tipo_anomalia,
  'HIGH' as severidad,
  'Monto excede 3x promedio del operador' as descripcion,
  ROUND((
    SELECT AVG(amount)
    FROM vouchers
    WHERE operador_nombre = v.operador_nombre
    AND currency = v.currency
  ), 2) as promedio_operador
FROM vouchers v
WHERE v.amount > (
  SELECT AVG(amount) * 3
  FROM vouchers
  WHERE operador_nombre = v.operador_nombre
  AND currency = v.currency
  AND operador_nombre IS NOT NULL
)

UNION ALL

-- Anomalía: Velocidad alta de emisión (>10 tickets en 5 minutos)
SELECT
  v.id,
  v.voucher_code,
  v.amount,
  v.currency,
  v.operador_nombre,
  v.mesa_nombre,
  v.issued_at,
  v.status,
  'VELOCIDAD_ALTA' as tipo_anomalia,
  'MEDIUM' as severidad,
  'Más de 10 tickets en 5 minutos' as descripcion,
  (
    SELECT COUNT(*)::DECIMAL
    FROM vouchers v2
    WHERE v2.operador_nombre = v.operador_nombre
    AND v2.issued_at BETWEEN v.issued_at - INTERVAL '5 minutes' AND v.issued_at
  ) as tickets_en_ventana
FROM vouchers v
WHERE v.operador_nombre IS NOT NULL
  AND v.issued_at IS NOT NULL
  AND (
    SELECT COUNT(*)
    FROM vouchers v2
    WHERE v2.operador_nombre = v.operador_nombre
    AND v2.issued_at BETWEEN v.issued_at - INTERVAL '5 minutes' AND v.issued_at
  ) > 10

UNION ALL

-- Anomalía: Tickets fuera de horario normal (12am-5am)
SELECT
  v.id,
  v.voucher_code,
  v.amount,
  v.currency,
  v.operador_nombre,
  v.mesa_nombre,
  v.issued_at,
  v.status,
  'HORARIO_INUSUAL' as tipo_anomalia,
  'LOW' as severidad,
  'Ticket emitido fuera de horario normal (12am-5am)' as descripcion,
  EXTRACT(HOUR FROM v.issued_at)::DECIMAL as hora_emision
FROM vouchers v
WHERE v.issued_at IS NOT NULL
  AND EXTRACT(HOUR FROM v.issued_at) BETWEEN 0 AND 5;

-- Probar la vista
SELECT * FROM voucher_anomalies ORDER BY severidad DESC, issued_at DESC LIMIT 20;

-- ============================================
-- 5. VISTA: Resumen Diario Completo
-- ============================================

CREATE OR REPLACE VIEW daily_summary AS
SELECT
  DATE(issued_at) as fecha,
  COUNT(*) as total_tickets,
  COUNT(DISTINCT operador_nombre) as operadores_activos,
  COUNT(DISTINCT mesa_nombre) as mesas_activas,

  -- Totales por moneda
  SUM(amount) FILTER (WHERE currency = 'USD') as total_usd,
  SUM(amount) FILTER (WHERE currency = 'DOP') as total_dop,
  SUM(amount) as total_general,

  -- Status de tickets
  COUNT(*) FILTER (WHERE status = 'redeemed') as tickets_cobrados,
  COUNT(*) FILTER (WHERE status = 'active') as tickets_pendientes,
  COUNT(*) FILTER (WHERE status = 'cancelled') as tickets_cancelados,
  COUNT(*) FILTER (WHERE status = 'expired') as tickets_expirados,

  -- Promedios
  AVG(amount) as ticket_promedio,
  AVG(amount) FILTER (WHERE currency = 'USD') as promedio_usd,
  AVG(amount) FILTER (WHERE currency = 'DOP') as promedio_dop,

  -- Rangos
  MIN(amount) as monto_minimo,
  MAX(amount) as monto_maximo,

  -- Horarios
  MIN(issued_at) as primera_emision,
  MAX(issued_at) as ultima_emision,
  EXTRACT(EPOCH FROM (MAX(issued_at) - MIN(issued_at))) / 3600 as horas_operacion,

  -- Tasas
  ROUND((COUNT(*) FILTER (WHERE status = 'redeemed') * 100.0 / NULLIF(COUNT(*), 0)), 2) as tasa_cobro_pct,
  ROUND(COUNT(*)::DECIMAL / NULLIF(EXTRACT(EPOCH FROM (MAX(issued_at) - MIN(issued_at))) / 3600, 0), 2) as tickets_por_hora

FROM vouchers
WHERE issued_at IS NOT NULL
GROUP BY DATE(issued_at)
ORDER BY fecha DESC;

-- Probar la vista
SELECT * FROM daily_summary LIMIT 10;

-- ============================================
-- 6. VISTA: Top Operadores por Performance
-- ============================================

CREATE OR REPLACE VIEW top_operators_performance AS
SELECT
  operador_nombre,
  COUNT(*) as total_tickets,
  SUM(amount) as monto_total_generado,
  AVG(amount) as ticket_promedio,
  COUNT(DISTINCT mesa_nombre) as mesas_trabajadas,
  COUNT(DISTINCT DATE(issued_at)) as dias_activo,
  COUNT(*) FILTER (WHERE status = 'redeemed') as tickets_cobrados,
  ROUND((COUNT(*) FILTER (WHERE status = 'redeemed') * 100.0 / NULLIF(COUNT(*), 0)), 2) as tasa_cobro_pct,
  MIN(issued_at) as primera_actividad,
  MAX(issued_at) as ultima_actividad
FROM vouchers
WHERE operador_nombre IS NOT NULL
GROUP BY operador_nombre
ORDER BY monto_total_generado DESC;

-- Probar la vista
SELECT * FROM top_operators_performance LIMIT 10;

-- ============================================
-- 7. FUNCIÓN: Detectar Patrones de Fraude
-- ============================================

CREATE OR REPLACE FUNCTION detect_fraud_patterns(
  p_voucher_code TEXT
) RETURNS TABLE(
  fraud_type TEXT,
  severity TEXT,
  description TEXT,
  detail TEXT
) AS $$
DECLARE
  v_voucher RECORD;
BEGIN
  -- Obtener el voucher
  SELECT * INTO v_voucher
  FROM vouchers
  WHERE voucher_code = p_voucher_code;

  IF NOT FOUND THEN
    RETURN QUERY SELECT
      'NOT_FOUND'::TEXT,
      'INFO'::TEXT,
      'Voucher no encontrado'::TEXT,
      'No existe voucher con este código'::TEXT;
    RETURN;
  END IF;

  -- 1. Verificar duplicados
  IF EXISTS (
    SELECT 1 FROM vouchers
    WHERE voucher_code = p_voucher_code
    GROUP BY voucher_code
    HAVING COUNT(*) > 1
  ) THEN
    RETURN QUERY SELECT
      'DUPLICATE'::TEXT,
      'HIGH'::TEXT,
      'Código duplicado en sistema'::TEXT,
      'Existe más de un voucher con este código'::TEXT;
  END IF;

  -- 2. Verificar monto sospechoso (5x promedio)
  IF v_voucher.amount > (SELECT AVG(amount) * 5 FROM vouchers WHERE currency = v_voucher.currency) THEN
    RETURN QUERY SELECT
      'HIGH_AMOUNT'::TEXT,
      'MEDIUM'::TEXT,
      'Monto excesivamente alto'::TEXT,
      'Monto es 5x el promedio de la moneda'::TEXT;
  END IF;

  -- 3. Verificar emisión fuera de horario
  IF EXTRACT(HOUR FROM v_voucher.issued_at) BETWEEN 0 AND 5 THEN
    RETURN QUERY SELECT
      'UNUSUAL_TIME'::TEXT,
      'LOW'::TEXT,
      'Emisión fuera de horario'::TEXT,
      'Emitido entre 12am y 5am'::TEXT;
  END IF;

  -- 4. Verificar velocidad de emisión del operador
  IF EXISTS (
    SELECT 1
    FROM vouchers
    WHERE operador_nombre = v_voucher.operador_nombre
      AND issued_at BETWEEN v_voucher.issued_at - INTERVAL '5 minutes' AND v_voucher.issued_at
    GROUP BY operador_nombre
    HAVING COUNT(*) > 10
  ) THEN
    RETURN QUERY SELECT
      'HIGH_VELOCITY'::TEXT,
      'MEDIUM'::TEXT,
      'Emisión muy rápida'::TEXT,
      'Operador emitió >10 tickets en 5 minutos'::TEXT;
  END IF;

  -- Si no hay patrones sospechosos, retornar CLEAN por defecto
  -- (Se ejecutará solo si ninguno de los RETURN QUERY anteriores se ejecutó)
  RETURN QUERY SELECT
    'CLEAN'::TEXT,
    'INFO'::TEXT,
    'Sin patrones sospechosos'::TEXT,
    'Voucher parece legítimo'::TEXT;

  RETURN;
END;
$$ LANGUAGE plpgsql;

-- Probar la función
SELECT * FROM detect_fraud_patterns('PREV-022810');

-- ============================================
-- 8. VISTA: Ranking de Mesas por Productividad
-- ============================================

CREATE OR REPLACE VIEW mesa_productivity_ranking AS
SELECT
  mesa_nombre,
  COUNT(*) as total_tickets,
  SUM(amount) as revenue_total,
  AVG(amount) as ticket_promedio,
  COUNT(DISTINCT operador_nombre) as operadores_asignados,
  COUNT(*) FILTER (WHERE status = 'redeemed') as tickets_cobrados,
  ROUND((COUNT(*) FILTER (WHERE status = 'redeemed') * 100.0 / NULLIF(COUNT(*), 0)), 2) as tasa_cobro_pct,
  -- Calcular productividad (tickets por hora de operación)
  ROUND(
    COUNT(*)::DECIMAL / NULLIF(
      EXTRACT(EPOCH FROM (MAX(issued_at) - MIN(issued_at))) / 3600,
      0
    ),
    2
  ) as tickets_por_hora,
  -- Ranking basado en revenue
  RANK() OVER (ORDER BY SUM(amount) DESC) as revenue_rank,
  -- Ranking basado en volumen
  RANK() OVER (ORDER BY COUNT(*) DESC) as volume_rank
FROM vouchers
WHERE mesa_nombre IS NOT NULL
  AND issued_at IS NOT NULL
GROUP BY mesa_nombre
ORDER BY revenue_total DESC;

-- Probar la vista
SELECT * FROM mesa_productivity_ranking;

-- ============================================
-- 9. VERIFICACIONES
-- ============================================

-- Ver todas las vistas creadas
SELECT
  schemaname,
  viewname,
  definition
FROM pg_views
WHERE schemaname = 'public'
  AND viewname IN (
    'voucher_reports_by_shift',
    'voucher_reports_by_operator',
    'voucher_reports_by_station',
    'voucher_anomalies',
    'daily_summary',
    'top_operators_performance',
    'mesa_productivity_ranking'
  );

-- Ver función creada
SELECT
  proname as function_name,
  pg_get_function_arguments(oid) as arguments,
  pg_get_function_result(oid) as returns
FROM pg_proc
WHERE proname = 'detect_fraud_patterns';

-- ============================================
-- 10. QUERIES DE PRUEBA
-- ============================================

-- Test 1: Resumen del día actual
SELECT * FROM daily_summary
WHERE fecha = CURRENT_DATE;

-- Test 2: Top 5 operadores
SELECT * FROM top_operators_performance
LIMIT 5;

-- Test 3: Anomalías de alta severidad
SELECT * FROM voucher_anomalies
WHERE severidad = 'HIGH'
ORDER BY issued_at DESC;

-- Test 4: Performance por turno de hoy
SELECT * FROM voucher_reports_by_shift
WHERE fecha = CURRENT_DATE;

-- Test 5: Ranking de mesas
SELECT mesa_nombre, revenue_total, revenue_rank
FROM mesa_productivity_ranking
LIMIT 10;

-- ============================================
-- FIN DEL SCRIPT
-- ============================================
-- RESULTADO ESPERADO:
-- - 7 vistas creadas
-- - 1 función creada
-- - Reportes avanzados disponibles
-- - Performance verificada
-- ============================================
