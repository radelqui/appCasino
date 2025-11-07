# 🔒 INSTRUCCIONES: IMPLEMENTAR MEJORAS DE SEGURIDAD

**Fecha**: 31 de octubre de 2025
**Tiempo estimado**: 5-10 minutos
**Prioridad**: ALTA

---

## 📋 RESUMEN

Este documento contiene instrucciones para implementar mejoras de seguridad y performance en la base de datos Supabase:

1. ✅ **10 índices** para optimizar queries
2. ✅ **Trigger updated_at** para auditoría
3. ✅ **Row Level Security (RLS)** para proteger datos

---

## 🚀 PASOS PARA EJECUTAR

### 1. Abrir Supabase SQL Editor

1. Ve a: https://supabase.com/dashboard/project/elagvnnamabrjptovzyq
2. Click en **"SQL Editor"** en el menú lateral
3. Click en **"New query"**

### 2. Copiar el script SQL

Abre el archivo: [`SqulInstrucciones/security-improvements.sql`](SqulInstrucciones/security-improvements.sql)

**O copia directamente este código:**

```sql
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
```

### 3. Ejecutar el script

1. Pega el código en el SQL Editor
2. Click en **"Run"** o presiona `Ctrl + Enter`
3. Espera a que termine la ejecución

### 4. Verificar resultados

Ejecuta este query de verificación:

```sql
-- Verificar índices creados
SELECT
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('vouchers', 'users', 'operadores', 'stations')
ORDER BY tablename, indexname;
```

**Resultado esperado**: Deberías ver 10+ índices listados.

---

## ✅ RESULTADOS ESPERADOS

### 1. Índices creados (10 total)

| Tabla | Índice | Columna |
|-------|--------|---------|
| vouchers | idx_vouchers_code | voucher_code |
| vouchers | idx_vouchers_status | status |
| vouchers | idx_vouchers_issued_at | issued_at |
| vouchers | idx_vouchers_created_at | created_at |
| users | idx_users_email | email |
| users | idx_users_role | role |
| operadores | idx_operadores_codigo | codigo |
| operadores | idx_operadores_activo | activo |
| stations | idx_stations_number | station_number |
| stations | idx_stations_active | is_active |

### 2. Trigger created

- ✅ Función: `update_updated_at_column()`
- ✅ Trigger: `update_vouchers_updated_at` en tabla `vouchers`

**Comportamiento**: Cada vez que se actualice un registro en `vouchers`, el campo `updated_at` se actualizará automáticamente.

### 3. RLS configurado

- ✅ RLS habilitado en tabla `vouchers`
- ✅ 4 políticas creadas:
  1. Service role: acceso total
  2. Usuarios autenticados: pueden leer
  3. Usuarios autenticados: pueden crear
  4. Usuarios autenticados: pueden actualizar

**Efecto**: Los usuarios anónimos ya NO podrán acceder a la tabla `vouchers`.

---

## 📊 BENEFICIOS

### Performance

- **Antes**: Queries ~90-130ms
- **Después**: Queries ~20-50ms (estimado)
- **Mejora**: 2-3x más rápido

### Seguridad

- ✅ Acceso anónimo bloqueado
- ✅ Solo usuarios autenticados pueden operar
- ✅ Service role mantiene acceso completo (para sync worker)

### Auditoría

- ✅ Campo `updated_at` se actualiza automáticamente
- ✅ Trazabilidad completa de cambios

---

## 🔍 VERIFICACIÓN POST-IMPLEMENTACIÓN

Después de ejecutar el script, verifica que todo funciona:

### 1. Verificar trigger

```sql
-- Crear voucher de prueba
INSERT INTO vouchers (voucher_code, amount, currency, status)
VALUES ('TEST-TRIGGER', 100, 'USD', 'active')
RETURNING created_at, updated_at;

-- Actualizar voucher
UPDATE vouchers
SET amount = 200
WHERE voucher_code = 'TEST-TRIGGER'
RETURNING created_at, updated_at;

-- El updated_at debe ser MÁS RECIENTE que created_at

-- Limpiar
DELETE FROM vouchers WHERE voucher_code = 'TEST-TRIGGER';
```

### 2. Verificar RLS

Desde la aplicación, intenta acceder sin autenticación:

```javascript
// Este código debería FALLAR con un error de política RLS
const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const { data, error } = await anonClient.from('vouchers').select('*').limit(1);

console.log(error); // Debería mostrar error de RLS
```

### 3. Verificar performance

Ejecuta estas queries y mide el tiempo:

```sql
-- Query 1: Buscar por código (debería ser MUY rápido)
EXPLAIN ANALYZE
SELECT * FROM vouchers WHERE voucher_code = 'PREV-022810';

-- Query 2: Filtrar por status (debería usar índice)
EXPLAIN ANALYZE
SELECT * FROM vouchers WHERE status = 'active' LIMIT 10;
```

---

## ⚠️ NOTAS IMPORTANTES

1. **Service Role sigue funcionando**: El worker de sincronización usa `SUPABASE_SERVICE_ROLE_KEY`, que tiene acceso completo y NO está afectado por RLS.

2. **Usuarios autenticados pueden operar normalmente**: Las políticas permiten operaciones CRUD completas para usuarios autenticados.

3. **Índices son seguros**: Usar `CREATE INDEX IF NOT EXISTS` significa que si ya existen, no se duplican.

4. **RLS no afecta a service_role**: La política "Service role full access" asegura que el backend sigue funcionando.

---

## 🚨 ROLLBACK (Si algo sale mal)

Si necesitas revertir los cambios:

```sql
-- Deshabilitar RLS
ALTER TABLE vouchers DISABLE ROW LEVEL SECURITY;

-- Eliminar políticas
DROP POLICY IF EXISTS "Service role full access" ON vouchers;
DROP POLICY IF EXISTS "Authenticated users can read vouchers" ON vouchers;
DROP POLICY IF EXISTS "Authenticated users can create vouchers" ON vouchers;
DROP POLICY IF EXISTS "Authenticated users can update vouchers" ON vouchers;

-- Eliminar trigger
DROP TRIGGER IF EXISTS update_vouchers_updated_at ON vouchers;
DROP FUNCTION IF EXISTS update_updated_at_column();

-- Eliminar índices (OPCIONAL - no recomendado)
-- DROP INDEX IF EXISTS idx_vouchers_code;
-- ... etc
```

---

## 📝 CHECKLIST

Marca cuando completes cada paso:

- [ ] Abrir Supabase SQL Editor
- [ ] Copiar script de `security-improvements.sql`
- [ ] Ejecutar script completo
- [ ] Verificar índices creados (10 total)
- [ ] Verificar trigger funciona
- [ ] Verificar RLS está activo
- [ ] Probar que la app sigue funcionando
- [ ] Verificar performance mejorada

---

**FIN DE INSTRUCCIONES**

**Siguiente paso**: Ejecutar el script y reportar resultados.
