# 🚨 FIX CRÍTICO: audit_log Constraint Violation

**Fecha:** 2025-11-07
**Problema:** App se congela al crear tickets en Mesa
**Causa:** Constraint de `audit_log` no permite las acciones que usa el código
**Estado:** ✅ SOLUCIÓN LISTA PARA APLICAR

---

## 🔍 DIAGNÓSTICO DEL PROBLEMA

### Error reportado:
```
[AuditLog] Error registrando evento: new row for relation "audit_log"
violates check constraint "audit_log_action_check"
```

### Síntoma:
- Mesa se congela al crear tickets
- App no responde, incluso al cerrarla
- Congelamiento ocurre en momento de emisión de voucher

---

## 🐛 CAUSA RAÍZ

El constraint de la tabla `audit_log` en SQLite solo permite **7 acciones**:

```sql
CHECK(action IN (
  'voucher_created',
  'voucher_redeemed',
  'voucher_cancelled',
  'voucher_expired',
  'user_login',
  'user_logout',
  'config_changed'
))
```

Pero el código en [pure/main.js](pure/main.js) intenta usar **13 acciones**:

| Acción usada en código | Línea | Permitida por constraint |
|------------------------|-------|--------------------------|
| `voucher_issued` | 1308 | ❌ **NO** - causa freeze |
| `voucher_redeemed` | 1649 | ✅ Sí |
| `user_login` | 482 | ✅ Sí |
| `operator_created` | 1887 | ❌ NO |
| `operator_updated` | 1937, 1986 | ❌ NO |
| `user_created` | 2187 | ❌ NO |
| `user_updated` | 2281, 2343, 2393 | ❌ NO |
| `session_closed` | 3775 | ❌ NO |

**El problema principal es `voucher_issued`** (línea 1308) que se ejecuta cada vez que se crea un ticket en Mesa.

---

## ✅ SOLUCIÓN IMPLEMENTADA

### 1. Actualizado schema en database.js ✅

**Archivo:** [SqulInstrucciones/database.js:105-119](SqulInstrucciones/database.js#L105-L119)

**ANTES (7 acciones):**
```sql
CHECK(action IN (
  'voucher_created',
  'voucher_redeemed',
  'voucher_cancelled',
  'voucher_expired',
  'user_login',
  'user_logout',
  'config_changed'
))
```

**DESPUÉS (13 acciones):**
```sql
CHECK(action IN (
  'voucher_created',
  'voucher_issued',
  'voucher_redeemed',
  'voucher_cancelled',
  'voucher_expired',
  'user_login',
  'user_logout',
  'user_created',
  'user_updated',
  'operator_created',
  'operator_updated',
  'session_closed',
  'config_changed'
))
```

### 2. Creado script de migración ✅

**Archivo:** [fix-audit-log-constraint.js](fix-audit-log-constraint.js)

Este script:
- ✅ Detecta automáticamente ubicación de database.db
- ✅ Crea backup antes de modificar
- ✅ Recrea tabla audit_log con constraint actualizado
- ✅ Copia todos los datos existentes
- ✅ Recrea índices
- ✅ Verifica integridad de datos
- ✅ Rollback automático si hay errores

---

## 🚀 CÓMO APLICAR EL FIX

### Opción A: Ejecutar script de migración (RECOMENDADO)

Si ya tienes una base de datos existente con datos que quieres conservar:

```bash
# Cerrar la app primero (importante!)
node fix-audit-log-constraint.js
```

El script automáticamente:
1. Busca database.db en rutas comunes
2. Crea backup (.backup-[timestamp])
3. Migra la tabla audit_log
4. Conserva todos los datos
5. Verifica integridad

**Tiempo estimado:** 5 segundos

---

### Opción B: Recrear base de datos (SI NO HAY DATOS IMPORTANTES)

Si es una instalación nueva o puedes perder los datos de auditoría:

```bash
# 1. Cerrar la app
# 2. Eliminar base de datos existente
rm "$APPDATA/appCasino/database.db"  # Windows
# rm ~/Library/Application Support/appCasino/database.db  # Mac
# rm ~/.config/appCasino/database.db  # Linux

# 3. Iniciar la app - creará nueva BD con constraint correcto
npm start
```

---

### Opción C: Actualización manual (AVANZADO)

Si prefieres hacerlo manualmente con SQLite:

```bash
# 1. Localizar database.db
# Windows: %APPDATA%\appCasino\database.db
# Mac: ~/Library/Application Support/appCasino/database.db
# Linux: ~/.config/appCasino/database.db

# 2. Abrir con SQLite
sqlite3 "path/to/database.db"

# 3. Ejecutar migración
BEGIN TRANSACTION;

CREATE TABLE audit_log_new (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT NOT NULL CHECK(action IN (
    'voucher_created', 'voucher_issued', 'voucher_redeemed',
    'voucher_cancelled', 'voucher_expired', 'user_login',
    'user_logout', 'user_created', 'user_updated',
    'operator_created', 'operator_updated', 'session_closed',
    'config_changed'
  )),
  user_id TEXT,
  user_role TEXT,
  station_id INTEGER,
  voucher_id TEXT,
  details TEXT,
  ip_address TEXT,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (station_id) REFERENCES stations(id)
);

INSERT INTO audit_log_new SELECT * FROM audit_log;
DROP TABLE audit_log;
ALTER TABLE audit_log_new RENAME TO audit_log;

CREATE INDEX idx_audit_action ON audit_log(action);
CREATE INDEX idx_audit_user ON audit_log(user_id);
CREATE INDEX idx_audit_voucher ON audit_log(voucher_id);
CREATE INDEX idx_audit_created ON audit_log(created_at);

COMMIT;

# 4. Verificar
SELECT COUNT(*) FROM audit_log;
.schema audit_log
.quit
```

---

## 🧪 VERIFICACIÓN DEL FIX

### Test 1: Verificar constraint actualizado

```bash
node -e "
const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(process.env.APPDATA, 'appCasino', 'database.db');
const db = new Database(dbPath, { readonly: true });
const schema = db.prepare('SELECT sql FROM sqlite_master WHERE name=\"audit_log\"').get();
console.log(schema.sql);
db.close();
"
```

Debe mostrar el CHECK constraint con las 13 acciones.

### Test 2: Probar Mesa sin congelamiento

```bash
npm start
# Login como cualquier usuario
# Ir a Mesa
# Llenar formulario (mesa, operador, valor)
# Click "Emitir voucher"
# Resultado esperado: ✅ Ticket creado sin freeze
```

### Test 3: Verificar logs de audit_log

```bash
node -e "
const Database = require('better-sqlite3');
const path = require('path');
const dbPath = path.join(process.env.APPDATA, 'appCasino', 'database.db');
const db = new Database(dbPath, { readonly: true });
const logs = db.prepare('SELECT action, COUNT(*) as count FROM audit_log GROUP BY action').all();
console.table(logs);
db.close();
"
```

Debe mostrar registros con `voucher_issued` sin errores.

---

## 📊 IMPACTO DEL FIX

### Funcionalidades que se desbloquean:

| Módulo | Acción afectada | Estado antes | Estado después |
|--------|----------------|--------------|----------------|
| **Mesa** | Crear tickets | ❌ Freeze | ✅ Funcional |
| Operadores | Crear operador | ❌ Error silencioso | ✅ Auditable |
| Operadores | Actualizar operador | ❌ Error silencioso | ✅ Auditable |
| Usuarios | Crear usuario | ❌ Error silencioso | ✅ Auditable |
| Usuarios | Actualizar usuario | ❌ Error silencioso | ✅ Auditable |
| Sesiones | Cerrar sesión | ❌ Error silencioso | ✅ Auditable |

### Datos que se conservan:

- ✅ Todos los registros existentes en audit_log
- ✅ Índices (performance sin cambios)
- ✅ Foreign keys intactas
- ✅ Estructura de otras tablas sin cambios

---

## 🔧 ARCHIVOS MODIFICADOS

### 1. SqulInstrucciones/database.js
- **Líneas:** 105-119
- **Cambio:** Constraint actualizado de 7 a 13 acciones
- **Impacto:** Nuevas instalaciones funcionarán correctamente

### 2. fix-audit-log-constraint.js (NUEVO)
- **Propósito:** Migrar bases de datos existentes
- **Uso:** Una sola vez por instalación
- **Seguridad:** Crea backup automático antes de modificar

---

## ⚠️ NOTAS IMPORTANTES

### 1. Cerrar la app antes de ejecutar el fix
**CRÍTICO:** La app debe estar completamente cerrada antes de modificar database.db.

### 2. Backup automático
El script crea un backup con timestamp: `database.db.backup-1699380000000`

Para restaurar si algo sale mal:
```bash
cp database.db.backup-1699380000000 database.db
```

### 3. No afecta a Supabase
Este fix solo modifica la base de datos SQLite local. La tabla `audit_log` en Supabase no tiene este problema ya que usa otro esquema.

### 4. Las nuevas instalaciones no necesitan el script
Si eliminas database.db y reinicias la app, se creará con el constraint correcto automáticamente (porque ya actualizamos database.js).

---

## 📝 HISTORIAL

### 2025-11-07
- ✅ Identificado problema de constraint
- ✅ Actualizado database.js (schema para nuevas instalaciones)
- ✅ Creado script de migración (fix-audit-log-constraint.js)
- ✅ Documentado solución en este archivo

---

## 🎯 PRÓXIMOS PASOS

### Inmediato:
1. **Ejecutar el fix:**
   ```bash
   node fix-audit-log-constraint.js
   ```

2. **Probar Mesa:**
   ```bash
   npm start
   # Login → Mesa → Crear ticket → Verificar sin freeze
   ```

3. **Verificar logs:**
   - Ir a Reportes → Registro de Auditoría
   - Verificar que aparecen eventos con action=`voucher_issued`

### Opcional (futuro):
- Agregar índice compuesto si hay problemas de performance:
  ```sql
  CREATE INDEX idx_audit_action_created ON audit_log(action, created_at);
  ```

---

## ✅ RESULTADO ESPERADO

**Después de aplicar el fix:**

```bash
npm start
# Login como cualquier usuario con acceso a Mesa
# Mesa → Seleccionar mesa (ej: P01)
# Mesa → Seleccionar operador
# Mesa → Ingresar valor (ej: 5000)
# Mesa → Click "Emitir voucher"

# Resultado:
✅ Ticket creado exitosamente
✅ Código mostrado (ej: PREV-3649728)
✅ Vista previa actualizada
✅ Formulario reseteado automáticamente
✅ Sin congelamiento
✅ Sin errores en consola
```

**Logs en consola:**
```
✅ Voucher emitido: PREV-3649728
🔄 Actualizando vista previa con código: PREV-3649728
✅ Vista previa actualizada: PREV-3649728
✅ Formulario reseteado para nuevo ticket
```

**Auditoría registrada:**
```sql
SELECT * FROM audit_log WHERE action = 'voucher_issued' ORDER BY created_at DESC LIMIT 1;

-- Resultado:
-- id: 123
-- action: voucher_issued
-- user_id: abc123
-- voucher_id: PREV-3649728
-- created_at: 2025-11-07 14:30:00
```

---

**Estado:** ✅ SOLUCIÓN LISTA
**Probado:** Pendiente (requiere cerrar app y ejecutar script)
**Riesgo:** BAJO (backup automático incluido)
**Tiempo estimado:** < 1 minuto

---

**Para ejecutar el fix AHORA:**
```bash
node fix-audit-log-constraint.js
```
