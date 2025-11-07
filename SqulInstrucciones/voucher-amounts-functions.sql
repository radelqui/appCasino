-- ============================================
-- FUNCIONES Y VISTAS PARA VALIDACIÓN DE MONTOS
-- Sistema TITO Casino - Supabase
-- ============================================
-- EJECUTAR EN SUPABASE SQL EDITOR
-- ============================================

-- ============================================
-- 1. FUNCIÓN: Validar montos de vouchers
-- ============================================

CREATE OR REPLACE FUNCTION validate_voucher_amount(
  p_amount DECIMAL,
  p_currency TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_min DECIMAL;
  v_max DECIMAL;
BEGIN
  -- Límites para USD
  IF p_currency = 'USD' THEN
    v_min := 5;
    v_max := 10000;
  -- Límites para DOP
  ELSIF p_currency = 'DOP' THEN
    v_min := 50;
    v_max := 500000;
  ELSE
    -- Moneda no soportada
    RETURN FALSE;
  END IF;

  -- Validar que el monto esté dentro del rango
  RETURN p_amount >= v_min AND p_amount <= v_max;
END;
$$ LANGUAGE plpgsql;

-- Probar la función
SELECT validate_voucher_amount(100, 'USD');  -- TRUE
SELECT validate_voucher_amount(3, 'USD');    -- FALSE (muy pequeño)
SELECT validate_voucher_amount(20000, 'USD'); -- FALSE (muy grande)
SELECT validate_voucher_amount(1000, 'DOP'); -- TRUE
SELECT validate_voucher_amount(30, 'DOP');   -- FALSE (muy pequeño)

-- ============================================
-- 2. VISTA: Estadísticas por moneda
-- ============================================

CREATE OR REPLACE VIEW voucher_stats_by_currency AS
SELECT
  currency,
  COUNT(*) as total_vouchers,
  COUNT(*) FILTER (WHERE status = 'active') as active_vouchers,
  COUNT(*) FILTER (WHERE status = 'redeemed') as redeemed_vouchers,
  COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_vouchers,
  COUNT(*) FILTER (WHERE status = 'expired') as expired_vouchers,

  -- Estadísticas de montos
  MIN(amount) as min_amount,
  MAX(amount) as max_amount,
  AVG(amount) as avg_amount,

  -- Totales por monto
  SUM(amount) as total_amount,
  SUM(amount) FILTER (WHERE status = 'active') as active_amount,
  SUM(amount) FILTER (WHERE status = 'redeemed') as redeemed_amount,

  -- Porcentajes
  ROUND((COUNT(*) FILTER (WHERE status = 'redeemed') * 100.0 / NULLIF(COUNT(*), 0)), 2) as redemption_rate_pct,
  ROUND((SUM(amount) FILTER (WHERE status = 'redeemed') * 100.0 / NULLIF(SUM(amount), 0)), 2) as amount_redeemed_pct

FROM vouchers
GROUP BY currency;

-- Probar la vista
SELECT * FROM voucher_stats_by_currency;

-- ============================================
-- 3. VISTA: Valores preestablecidos más usados
-- ============================================

CREATE OR REPLACE VIEW popular_voucher_amounts AS
SELECT
  currency,
  amount,
  COUNT(*) as usage_count,
  COUNT(*) FILTER (WHERE status = 'active') as active_count,
  COUNT(*) FILTER (WHERE status = 'redeemed') as redeemed_count,
  ROUND((COUNT(*) FILTER (WHERE status = 'redeemed') * 100.0 / NULLIF(COUNT(*), 0)), 2) as redemption_rate_pct
FROM vouchers
GROUP BY currency, amount
ORDER BY currency, usage_count DESC;

-- Probar la vista
SELECT * FROM popular_voucher_amounts LIMIT 20;

-- ============================================
-- 4. FUNCIÓN: Sugerir valores preestablecidos
-- ============================================

-- Función que sugiere los montos más usados para una moneda
CREATE OR REPLACE FUNCTION get_suggested_amounts(p_currency TEXT, p_limit INT DEFAULT 6)
RETURNS TABLE(
  amount DECIMAL,
  usage_count BIGINT,
  redemption_rate DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    v.amount,
    COUNT(*)::BIGINT as usage_count,
    ROUND((COUNT(*) FILTER (WHERE v.status = 'redeemed') * 100.0 / NULLIF(COUNT(*), 0)), 2) as redemption_rate
  FROM vouchers v
  WHERE v.currency = p_currency
  GROUP BY v.amount
  ORDER BY COUNT(*) DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Probar la función
SELECT * FROM get_suggested_amounts('USD');
SELECT * FROM get_suggested_amounts('DOP');

-- ============================================
-- 5. VISTA: Vouchers fuera de rango
-- ============================================

CREATE OR REPLACE VIEW vouchers_out_of_range AS
SELECT
  id,
  voucher_code,
  amount,
  currency,
  status,
  created_at,
  CASE
    WHEN currency = 'USD' AND amount < 5 THEN 'USD: Monto muy pequeño (< $5)'
    WHEN currency = 'USD' AND amount > 10000 THEN 'USD: Monto muy grande (> $10,000)'
    WHEN currency = 'DOP' AND amount < 50 THEN 'DOP: Monto muy pequeño (< $50)'
    WHEN currency = 'DOP' AND amount > 500000 THEN 'DOP: Monto muy grande (> $500,000)'
    ELSE 'Otro problema'
  END as issue
FROM vouchers
WHERE
  (currency = 'USD' AND (amount < 5 OR amount > 10000)) OR
  (currency = 'DOP' AND (amount < 50 OR amount > 500000));

-- Probar la vista
SELECT * FROM vouchers_out_of_range;

-- ============================================
-- 6. FUNCIÓN: Validar ticket antes de insertar
-- ============================================

-- Trigger function para validar antes de insertar
CREATE OR REPLACE FUNCTION validate_voucher_before_insert()
RETURNS TRIGGER AS $$
BEGIN
  -- Validar que el monto es válido para la moneda
  IF NOT validate_voucher_amount(NEW.amount, NEW.currency) THEN
    RAISE EXCEPTION 'Monto inválido: % % está fuera del rango permitido', NEW.amount, NEW.currency;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- OPCIONAL: Crear trigger para validación automática
-- NOTA: Solo descomentar si se quiere validación estricta
-- DROP TRIGGER IF EXISTS validate_voucher_amount_trigger ON vouchers;
-- CREATE TRIGGER validate_voucher_amount_trigger
--   BEFORE INSERT OR UPDATE ON vouchers
--   FOR EACH ROW
--   EXECUTE FUNCTION validate_voucher_before_insert();

-- ============================================
-- 7. VERIFICACIONES
-- ============================================

-- Ver todas las funciones creadas
SELECT
  proname as function_name,
  pg_get_function_arguments(oid) as arguments,
  pg_get_function_result(oid) as returns
FROM pg_proc
WHERE proname IN (
  'validate_voucher_amount',
  'get_suggested_amounts',
  'validate_voucher_before_insert'
);

-- Ver todas las vistas creadas
SELECT
  schemaname,
  viewname,
  definition
FROM pg_views
WHERE schemaname = 'public'
  AND viewname IN (
    'voucher_stats_by_currency',
    'popular_voucher_amounts',
    'vouchers_out_of_range'
  );

-- ============================================
-- 8. QUERIES ÚTILES PARA LA APP
-- ============================================

-- Obtener estadísticas por moneda
SELECT * FROM voucher_stats_by_currency;

-- Obtener montos más populares para botones rápidos
SELECT * FROM get_suggested_amounts('USD', 6);
SELECT * FROM get_suggested_amounts('DOP', 6);

-- Verificar si hay vouchers fuera de rango
SELECT COUNT(*) as count_out_of_range
FROM vouchers_out_of_range;

-- Ver vouchers fuera de rango
SELECT * FROM vouchers_out_of_range;

-- Validar un monto antes de crear voucher
SELECT validate_voucher_amount(100, 'USD') as is_valid;

-- ============================================
-- FIN DEL SCRIPT
-- ============================================
-- RESULTADO ESPERADO:
-- - 3 funciones creadas
-- - 3 vistas creadas
-- - Validación de montos disponible
-- - Estadísticas en tiempo real
-- - Sugerencias de valores preestablecidos
-- ============================================
