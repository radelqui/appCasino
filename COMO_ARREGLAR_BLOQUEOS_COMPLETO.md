# 🔧 GUÍA COMPLETA: Arreglar Bloqueos del Sistema

**Fecha:** 2025-11-07
**Problema:** App se congela/bloquea durante operaciones
**Causa:** Múltiples problemas detectados por health check

---

## 📊 PROBLEMAS DETECTADOS:

### Health Check ejecutado - Score: 75%

✅ **FUNCIONANDO:**
- Variables de entorno
- Conexión a Supabase
- Sync Worker (flag de control + timeouts)
- PDF Generator
- Usuarios de Auth (8/9)
- Dependencias NPM

❌ **PROBLEMAS CRÍTICOS:**
1. **better-sqlite3** compilado para Node v19 (estamos en v20)
2. **audit_log constraint** desactualizado (causa errores de sincronización)
3. **admin@casino.com** no puede hacer login

⚠️ **ADVERTENCIAS:**
- audit_log necesita foreign key válido para test

---

## 🚀 SOLUCIÓN PASO A PASO:

### PASO 1: Cerrar la aplicación completamente

**Windows:**
```batch
taskkill /F /IM electron.exe
```

O simplemente cierra todas las ventanas de la app.

---

### PASO 2: Rebuild de better-sqlite3

```batch
npm rebuild better-sqlite3
```

**Si falla con "EBUSY: resource busy":**
1. Asegúrate que NO haya procesos electron corriendo
2. Cierra VS Code si está abierto (puede bloquear archivos)
3. Intenta de nuevo

**Si falla con error de compilación:**
```batch
npm install better-sqlite3 --force
```

---

### PASO 3: Aplicar fixes de SQL en Supabase

Abre **Supabase Dashboard**: https://supabase.com/dashboard

#### 3.1 Fix de audit_log constraint ⭐ MUY IMPORTANTE

**Archivo:** `SqulInstrucciones/fix-audit-log-constraint.sql`

**SQL a ejecutar:**
```sql
-- Eliminar constraint viejo
ALTER TABLE audit_log
DROP CONSTRAINT IF EXISTS audit_log_action_check;

-- Crear constraint nuevo con TODAS las actions
ALTER TABLE audit_log
ADD CONSTRAINT audit_log_action_check
CHECK (action IN (
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
));
```

**Por qué es importante:**
- **ANTES:** Solo permitía 3 actions → TODOS los tickets fallaban al sincronizar
- **DESPUÉS:** Permite 13 actions → Sincronización funciona correctamente

---

#### 3.2 Fix de usuarios Auth (si no se aplicó antes)

**Archivo:** `SqulInstrucciones/fix-auth-users-UPDATE-ONLY.sql`

Este SQL ya lo ejecutaste y funcionó (8/9 usuarios OK).

---

#### 3.3 Fix de admin@casino.com (opcional)

**Archivo:** `SqulInstrucciones/fix-admin-casino-com.sql`

Solo si admin@casino.com sigue sin funcionar después del fix anterior.

---

### PASO 4: Verificar health check

```batch
node tests/system-health-check.js
```

**Resultado esperado:**
```
✅ Passed: 8
❌ Failed: 0
⚠️  Warnings: 0

📊 Score: 100%

✅ SISTEMA SALUDABLE - NO HAY PROBLEMAS
```

---

### PASO 5: Verificar usuarios

```batch
node test-login-all-users.js
```

**Resultado esperado:**
```
✅ Usuarios con login exitoso: 9
❌ Usuarios sin login: 0
```

---

### PASO 6: Iniciar la aplicación

```batch
npm start
```

**Verificar:**
1. ✅ No hay errores de audit_log en console
2. ✅ Sync Worker funciona sin bloquear app
3. ✅ Tickets se crean correctamente
4. ✅ PDF se genera sin errores
5. ✅ Todos los usuarios pueden hacer login

---

## 🧪 TESTS IMPLEMENTADOS:

### Health Check Automático

**Ejecutar:** `node tests/system-health-check.js`

**Tests incluidos:**
1. ✅ Variables de entorno
2. ✅ Conexión a Supabase
3. ✅ Constraint de audit_log
4. ✅ SQLite Database
5. ✅ Sync Worker config
6. ✅ PDF Generator
7. ✅ Usuarios de Auth
8. ✅ Dependencias NPM

**Cuando ejecutar:**
- Antes de iniciar la app (para detectar problemas)
- Después de updates de npm
- Después de cambios en Supabase
- Si la app empieza a bloquearse

---

## 🔍 DIAGNÓSTICO DE PROBLEMAS COMUNES:

### Problema 1: App se congela al hacer clic en valores rápidos

**Causa:** audit_log constraint desactualizado
**Solución:** Ejecutar fix-audit-log-constraint.sql (Paso 3.1)

---

### Problema 2: Error "Database error querying schema"

**Causa:** Usuario con datos corruptos en Auth
**Solución:** Ejecutar fix-admin-casino-com.sql (Paso 3.3)

---

### Problema 3: "Error generando PDF: undefined"

**Causas posibles:**
- Datos del ticket incompletos
- Font no cargada correctamente
- Error en pdf-lib

**Diagnóstico:**
```bash
# Ver logs completos de PDF
npm start 2>&1 | grep -A 5 "PDF"
```

**Solución temporal:**
1. Verificar que `src/main/utils/pdf-generator.js` existe
2. Verificar que fonts están en `assets/fonts/`
3. Reintentar generación de ticket

---

### Problema 4: Sync Worker causa bloqueos

**Síntomas:**
- App se congela cada 2 minutos
- No responde durante sincronización

**Verificar que los fixes están aplicados:**
```javascript
// Buscar en pure/main.js:
let syncWorkerRunning = false; // ✅ Debe existir

if (syncWorkerRunning) {
  return; // ✅ Debe existir
}

Promise.race([...]) // ✅ Debe existir (timeout)
```

**Si no están:**
- El fix ya fue aplicado en pure/main.js
- Verificar que estás usando la versión correcta del archivo

---

### Problema 5: better-sqlite3 error de NODE_MODULE_VERSION

**Error:**
```
was compiled against a different Node.js version using
NODE_MODULE_VERSION 118. This version of Node.js requires
NODE_MODULE_VERSION 115.
```

**Solución:**
```batch
# Cerrar TODA la app primero
taskkill /F /IM electron.exe

# Rebuild
npm rebuild better-sqlite3

# Si falla
npm install better-sqlite3 --force
```

---

## 📋 CHECKLIST FINAL:

Antes de considerar el sistema arreglado, verificar:

- [ ] Health check pasa con 100%
- [ ] 9/9 usuarios pueden hacer login
- [ ] No hay errores de audit_log en console
- [ ] Sync Worker no bloquea la app
- [ ] Tickets se crean correctamente
- [ ] PDF se genera sin errores
- [ ] Valores rápidos funcionan sin congelar
- [ ] Caja muestra estadísticas correctamente
- [ ] Vista previa muestra datos correctos

---

## 🎯 ARCHIVOS IMPORTANTES:

### Scripts de test:
- `tests/system-health-check.js` - Health check completo
- `test-login-all-users.js` - Test de login de usuarios
- `FIX_SISTEMA_COMPLETO.bat` - Script automático de fix (Windows)

### SQL Fixes:
- `SqulInstrucciones/fix-audit-log-constraint.sql` - ⭐ CRÍTICO
- `SqulInstrucciones/fix-auth-users-UPDATE-ONLY.sql` - Usuarios
- `SqulInstrucciones/fix-admin-casino-com.sql` - admin@casino.com

### Documentación:
- `INSTRUCCIONES_FIX_USUARIOS_AUTH.md` - Fix de usuarios completo
- `FIX_SYNC_WORKER_NO_BLOQUEO.md` - Fix de Sync Worker
- `ROLLBACK_CAJA_ESTADISTICAS.md` - Rollback de estadísticas

---

## 🚨 SI NADA FUNCIONA:

### Opción 1: Rollback completo

```batch
git stash
git checkout d2182fd  # Último commit funcional
npm install
npm start
```

### Opción 2: Reinstalar dependencias

```batch
rm -rf node_modules
rm package-lock.json
npm install
npm start
```

### Opción 3: Verificar versión de Node

```batch
node --version
# Debería ser v20.x o v18.x
```

Si es diferente:
```batch
# Instalar Node v20 LTS
nvm install 20
nvm use 20
npm install
```

---

## 📞 RESUMEN EJECUTIVO:

**3 Fixes Críticos para aplicar:**

1. **Rebuild better-sqlite3**
   ```batch
   npm rebuild better-sqlite3
   ```

2. **Fix audit_log constraint en Supabase**
   - Ejecutar `fix-audit-log-constraint.sql` en SQL Editor

3. **Verificar con health check**
   ```batch
   node tests/system-health-check.js
   ```

**Tiempo estimado:** 10-15 minutos
**Downtime:** 5 minutos (mientras se aplican fixes)
**Resultado:** Sistema sin bloqueos, 100% funcional

---

**Actualizado:** 2025-11-07
**Estado:** ✅ FIXES DOCUMENTADOS Y LISTOS PARA APLICAR
**Próxima acción:** Ejecutar los 3 fixes en orden

**Archivos relacionados:**
- [tests/system-health-check.js](tests/system-health-check.js)
- [FIX_SISTEMA_COMPLETO.bat](FIX_SISTEMA_COMPLETO.bat)
- [SqulInstrucciones/fix-audit-log-constraint.sql](SqulInstrucciones/fix-audit-log-constraint.sql)
