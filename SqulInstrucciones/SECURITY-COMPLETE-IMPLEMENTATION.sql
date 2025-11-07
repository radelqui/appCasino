-- ============================================
-- IMPLEMENTACIÓN COMPLETA DE SEGURIDAD
-- Sistema TITO Casino - Supabase
-- ============================================
-- EJECUTAR EN SUPABASE SQL EDITOR
-- Tiempo estimado: 2-3 minutos
-- ============================================

-- ============================================
-- PARTE 1: CREAR ÍNDICES (Performance)
-- ============================================

-- Índices en tabla VOUCHERS
CREATE INDEX IF NOT EXISTS idx_vouchers_code ON vouchers(voucher_code);
CREATE INDEX IF NOT EXISTS idx_vouchers_status ON vouchers(status);
CREATE INDEX IF NOT EXISTS idx_vouchers_issued_at ON vouchers(issued_at);
CREATE INDEX IF NOT EXISTS idx_vouchers_created_at ON vouchers(created_at);
CREATE INDEX IF NOT EXISTS idx_vouchers_currency ON vouchers(currency);
CREATE INDEX IF NOT EXISTS idx_vouchers_issued_by ON vouchers(issued_by_user_id);
CREATE INDEX IF NOT EXISTS idx_vouchers_redeemed_by ON vouchers(redeemed_by_user_id);

-- Índices en tabla USERS
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);

-- Índices en tabla OPERADORES
CREATE INDEX IF NOT EXISTS idx_operadores_codigo ON operadores(codigo);
CREATE INDEX IF NOT EXISTS idx_operadores_activo ON operadores(activo);

-- Índices en tabla STATIONS
CREATE INDEX IF NOT EXISTS idx_stations_number ON stations(station_number);
CREATE INDEX IF NOT EXISTS idx_stations_active ON stations(is_active);

-- Índices en tabla AUDIT_LOG
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_user_id ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_voucher_id ON audit_log(voucher_id);

-- ============================================
-- PARTE 2: TRIGGERS updated_at
-- ============================================

-- Crear función genérica para updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger a VOUCHERS
DROP TRIGGER IF EXISTS update_vouchers_updated_at ON vouchers;
CREATE TRIGGER update_vouchers_updated_at
  BEFORE UPDATE ON vouchers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Aplicar trigger a USERS
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Aplicar trigger a OPERADORES
DROP TRIGGER IF EXISTS update_operadores_updated_at ON operadores;
CREATE TRIGGER update_operadores_updated_at
  BEFORE UPDATE ON operadores
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Aplicar trigger a STATIONS
DROP TRIGGER IF EXISTS update_stations_updated_at ON stations;
CREATE TRIGGER update_stations_updated_at
  BEFORE UPDATE ON stations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- PARTE 3: ROW LEVEL SECURITY (RLS)
-- ============================================

-- ============================================
-- RLS para VOUCHERS
-- ============================================

-- Habilitar RLS
ALTER TABLE vouchers ENABLE ROW LEVEL SECURITY;

-- Política 1: Service role acceso completo (para backend/sync worker)
DROP POLICY IF EXISTS "Service role full access vouchers" ON vouchers;
CREATE POLICY "Service role full access vouchers"
  ON vouchers
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Política 2: Usuarios autenticados pueden leer vouchers
DROP POLICY IF EXISTS "Authenticated read vouchers" ON vouchers;
CREATE POLICY "Authenticated read vouchers"
  ON vouchers
  FOR SELECT
  TO authenticated
  USING (true);

-- Política 3: Usuarios autenticados pueden crear vouchers
DROP POLICY IF EXISTS "Authenticated create vouchers" ON vouchers;
CREATE POLICY "Authenticated create vouchers"
  ON vouchers
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- Política 4: Solo emisor o cajero puede actualizar
DROP POLICY IF EXISTS "Update own vouchers" ON vouchers;
CREATE POLICY "Update own vouchers"
  ON vouchers
  FOR UPDATE
  TO authenticated
  USING (
    issued_by_user_id = auth.uid() OR
    redeemed_by_user_id = auth.uid()
  );

-- ============================================
-- RLS para USERS
-- ============================================

-- Habilitar RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Política 1: Service role acceso completo
DROP POLICY IF EXISTS "Service role full access users" ON users;
CREATE POLICY "Service role full access users"
  ON users
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Política 2: Usuarios pueden ver su propio perfil
DROP POLICY IF EXISTS "Users read own profile" ON users;
CREATE POLICY "Users read own profile"
  ON users
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Política 3: Admins pueden ver todos los usuarios
DROP POLICY IF EXISTS "Admins read all users" ON users;
CREATE POLICY "Admins read all users"
  ON users
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users AS u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );

-- ============================================
-- RLS para OPERADORES
-- ============================================

-- Habilitar RLS
ALTER TABLE operadores ENABLE ROW LEVEL SECURITY;

-- Política 1: Service role acceso completo
DROP POLICY IF EXISTS "Service role full access operadores" ON operadores;
CREATE POLICY "Service role full access operadores"
  ON operadores
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Política 2: Usuarios autenticados pueden leer operadores
DROP POLICY IF EXISTS "Authenticated read operadores" ON operadores;
CREATE POLICY "Authenticated read operadores"
  ON operadores
  FOR SELECT
  TO authenticated
  USING (true);

-- ============================================
-- RLS para STATIONS
-- ============================================

-- Habilitar RLS
ALTER TABLE stations ENABLE ROW LEVEL SECURITY;

-- Política 1: Service role acceso completo
DROP POLICY IF EXISTS "Service role full access stations" ON stations;
CREATE POLICY "Service role full access stations"
  ON stations
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Política 2: Usuarios autenticados pueden leer stations
DROP POLICY IF EXISTS "Authenticated read stations" ON stations;
CREATE POLICY "Authenticated read stations"
  ON stations
  FOR SELECT
  TO authenticated
  USING (true);

-- ============================================
-- RLS para AUDIT_LOG
-- ============================================

-- Habilitar RLS
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Política 1: Service role acceso completo
DROP POLICY IF EXISTS "Service role full access audit" ON audit_log;
CREATE POLICY "Service role full access audit"
  ON audit_log
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Política 2: Auditores y admins pueden leer logs
DROP POLICY IF EXISTS "Auditors read logs" ON audit_log;
CREATE POLICY "Auditors read logs"
  ON audit_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'auditor')
    )
  );

-- ============================================
-- PARTE 4: ARREGLAR CONSTRAINTS
-- ============================================

-- Hacer qr_hash opcional (puede ser null)
ALTER TABLE vouchers ALTER COLUMN qr_hash DROP NOT NULL;

-- ============================================
-- PARTE 5: VERIFICACIONES
-- ============================================

-- Verificar índices creados
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('vouchers', 'users', 'operadores', 'stations', 'audit_log')
ORDER BY tablename, indexname;

-- Verificar triggers
SELECT
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND event_object_table IN ('vouchers', 'users', 'operadores', 'stations')
ORDER BY event_object_table, trigger_name;

-- Verificar políticas RLS
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('vouchers', 'users', 'operadores', 'stations', 'audit_log')
ORDER BY tablename, policyname;

-- Verificar que RLS está habilitado
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('vouchers', 'users', 'operadores', 'stations', 'audit_log')
ORDER BY tablename;

-- ============================================
-- PARTE 6: PRUEBA DE PERFORMANCE
-- ============================================

-- Probar índice en voucher_code
EXPLAIN ANALYZE
SELECT * FROM vouchers WHERE voucher_code = 'PREV-022810';

-- Probar índice en status
EXPLAIN ANALYZE
SELECT * FROM vouchers WHERE status = 'active' LIMIT 10;

-- Probar índice en created_at
EXPLAIN ANALYZE
SELECT * FROM vouchers ORDER BY created_at DESC LIMIT 10;

-- ============================================
-- FIN DEL SCRIPT
-- ============================================
-- RESULTADO ESPERADO:
-- - 18+ índices creados
-- - 4 triggers activos
-- - 12+ políticas RLS activas
-- - 5 tablas con RLS habilitado
-- - Performance mejorada 2-5x
-- ============================================
