-- ============================================
-- MEJORAS DE SEGURIDAD Y PERFORMANCE
-- Ejecutar en Supabase SQL Editor
-- ============================================

-- ============================================
-- 1. CREAR ÍNDICES
-- ============================================

-- Índices en tabla vouchers
CREATE INDEX IF NOT EXISTS idx_vouchers_code ON vouchers(voucher_code);
CREATE INDEX IF NOT EXISTS idx_vouchers_status ON vouchers(status);
CREATE INDEX IF NOT EXISTS idx_vouchers_issued_at ON vouchers(issued_at);
CREATE INDEX IF NOT EXISTS idx_vouchers_created_at ON vouchers(created_at);

-- Índices en tabla users
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Índices en tabla operadores
CREATE INDEX IF NOT EXISTS idx_operadores_codigo ON operadores(codigo);
CREATE INDEX IF NOT EXISTS idx_operadores_activo ON operadores(activo);

-- Índices en tabla stations
CREATE INDEX IF NOT EXISTS idx_stations_number ON stations(station_number);
CREATE INDEX IF NOT EXISTS idx_stations_active ON stations(is_active);

-- ============================================
-- 2. TRIGGER updated_at
-- ============================================

-- Crear función para actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger en tabla vouchers
DROP TRIGGER IF EXISTS update_vouchers_updated_at ON vouchers;
CREATE TRIGGER update_vouchers_updated_at
BEFORE UPDATE ON vouchers
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 3. ROW LEVEL SECURITY (RLS)
-- ============================================

-- Habilitar RLS en tabla vouchers
ALTER TABLE vouchers ENABLE ROW LEVEL SECURITY;

-- Política 1: Service role tiene acceso completo
DROP POLICY IF EXISTS "Service role full access" ON vouchers;
CREATE POLICY "Service role full access"
ON vouchers
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Política 2: Usuarios autenticados pueden leer vouchers
DROP POLICY IF EXISTS "Authenticated users can read vouchers" ON vouchers;
CREATE POLICY "Authenticated users can read vouchers"
ON vouchers
FOR SELECT
TO authenticated
USING (true);

-- Política 3: Usuarios autenticados pueden crear vouchers
DROP POLICY IF EXISTS "Authenticated users can create vouchers" ON vouchers;
CREATE POLICY "Authenticated users can create vouchers"
ON vouchers
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- Política 4: Usuarios autenticados pueden actualizar vouchers
DROP POLICY IF EXISTS "Authenticated users can update vouchers" ON vouchers;
CREATE POLICY "Authenticated users can update vouchers"
ON vouchers
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- ============================================
-- 4. VERIFICACIONES
-- ============================================

-- Verificar índices creados
SELECT
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('vouchers', 'users', 'operadores', 'stations')
ORDER BY tablename, indexname;

-- Verificar triggers
SELECT
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND event_object_table = 'vouchers';

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
  AND tablename = 'vouchers';

-- Verificar que RLS está habilitado
SELECT
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename = 'vouchers';
