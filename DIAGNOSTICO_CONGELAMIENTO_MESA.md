# 🐛 DIAGNÓSTICO: Mesa se congela al usar valores rápidos

**Fecha:** 2025-11-07
**Problema:** Mesa se congela/cuelga al hacer click en botones de valores preestablecidos
**Estado:** ✅ **CAUSA IDENTIFICADA - FIX LISTO**

---

## 🔍 PROBLEMA IDENTIFICADO:

### Error exacto del log:
```
[AuditLog] Error registrando evento: new row for relation "audit_log" violates check constraint "audit_log_action_check"
```

### Causa raíz:
La tabla `audit_log` en Supabase tiene un CHECK constraint que **solo permite 3 action types**:
- ✅ `user_login`
- ✅ `voucher_created`
- ✅ `voucher_redeemed`

Pero el código (`pure/main.js`) intenta registrar **13 action types diferentes**:
- ✅ `voucher_created` (permitido)
- ❌ `voucher_issued` ← **ESTE CAUSA EL ERROR**
- ✅ `voucher_redeemed` (permitido)
- ❌ `voucher_cancelled`
- ❌ `voucher_expired`
- ✅ `user_login` (permitido)
- ❌ `user_logout`
- ❌ `user_created`
- ❌ `user_updated`
- ❌ `operator_created`
- ❌ `operator_updated`
- ❌ `session_closed`
- ❌ `config_changed`

### Ubicación del error:

**Archivo:** `c:\appCasino\pure\main.js`
**Línea:** 1308 (dentro del handler `tickets:create`)

```javascript
// Línea 1307-1318
await registrarAuditLog(
  'voucher_issued',  // ← Esta action NO está permitida por el constraint
  userId,
  stationId,
  null,
  {
    voucher_code: ticketCode,
    amount: amount,
    currency: currency
  }
);
```

### Por qué congela Mesa:

1. Usuario hace click en valor rápido (ej: RD$5,000)
2. Usuario selecciona operador
3. Usuario hace click "Emitir voucher"
4. Handler `tickets:create` se ejecuta correctamente
5. Handler intenta registrar en `audit_log` con action `'voucher_issued'`
6. **Supabase rechaza el INSERT** por constraint violation
7. El error se captura en `catch` pero el proceso ya se bloqueó
8. Mesa queda congelada esperando respuesta de Supabase

---

## 🛠️ SOLUCIÓN:

### Opción 1: Arreglar el constraint en Supabase (RECOMENDADO)

**Ventajas:**
- ✅ Más correcto - permite todas las actions usadas en el código
- ✅ Mantiene auditoría completa
- ✅ No requiere cambios en código

**Pasos:**

1. **Abre Supabase Dashboard:**
   ```
   https://elagvnnamabrjptovzyq.supabase.co
   ```

2. **Ve a: SQL Editor** (icono `</>` en el menú lateral)

3. **Copia y pega este SQL:**
   ```sql
   -- Eliminar constraint viejo
   ALTER TABLE audit_log
   DROP CONSTRAINT IF EXISTS audit_log_action_check;

   -- Crear constraint nuevo con todas las actions
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

4. **Click "Run"** (botón verde)

5. **Verifica** que aparezca: `Success. No rows returned`

6. **Prueba el fix:**
   ```bash
   node fix-audit-constraint.js
   ```
   Debe mostrar: `✅ ¡CONSTRAINT ARREGLADO EXITOSAMENTE!`

### Opción 2: Deshabilitar audit log para Supabase (TEMPORAL)

**Solo si no puedes acceder a Supabase Dashboard ahora mismo.**

**Desventaja:** ❌ Pierdes auditoría de eventos en Supabase (SQLite sigue funcionando)

**Archivo a modificar:** `c:\appCasino\pure\main.js`

**Líneas 342-345 (función registrarAuditLog):**

```javascript
// ANTES:
if (!supabaseManager || !supabaseManager.isAvailable()) {
  if (VERBOSE) console.warn('⚠️  [AuditLog] Supabase no disponible, no se registrará el evento');
  return;
}

// DESPUÉS:
if (!supabaseManager || !supabaseManager.isAvailable()) {
  if (VERBOSE) console.warn('⚠️  [AuditLog] Supabase no disponible, no se registrará el evento');
  return;
}
// ⚠️  TEMPORAL: Deshabilitar audit log de Supabase mientras se arregla constraint
return;
```

---

## 🧪 VERIFICACIÓN DEL FIX:

### Test 1: Verificar constraint está arreglado
```bash
node fix-audit-constraint.js
```

**Resultado esperado:**
```
✅ ¡CONSTRAINT ARREGLADO EXITOSAMENTE!
   Se insertó correctamente "voucher_issued" (ID: ...)
```

### Test 2: Probar Mesa con valores rápidos
```bash
npm start
```

1. Login como Admin/Mesa
2. Abrir Mesa
3. Click en un valor rápido (ej: RD$1,000)
4. Seleccionar operador
5. Click "Emitir voucher"

**Resultado esperado:**
- ✅ Ticket se crea correctamente
- ✅ Vista previa se actualiza con código
- ✅ Formulario se resetea automáticamente
- ✅ **NO se congela**

### Test 3: Verificar que audit_log recibe registros
```bash
node check-audit-log-constraint.js
```

**Resultado esperado:**
```
📊 ACTION TYPES ÚNICOS EN LA BD

Total de action types únicos: 4+

 1. "user_login"
 2. "voucher_created"
 3. "voucher_redeemed"
 4. "voucher_issued"  ← NUEVO
```

---

## 📁 ARCHIVOS CREADOS PARA EL FIX:

### 1. `fix-audit-constraint.js`
**Descripción:** Script Node.js para verificar y aplicar el fix
**Uso:** `node fix-audit-constraint.js`
**Función:**
- Detecta si el constraint está arreglado
- Proporciona instrucciones paso a paso
- Verifica que `voucher_issued` se puede insertar

### 2. `SqulInstrucciones/fix-audit-log-constraint.sql`
**Descripción:** SQL puro para ejecutar en Supabase SQL Editor
**Uso:** Copiar y pegar en Supabase Dashboard
**Función:**
- DROP del constraint viejo
- CREATE del constraint nuevo con 13 actions

### 3. `check-audit-log-constraint.js`
**Descripción:** Script de diagnóstico
**Uso:** `node check-audit-log-constraint.js`
**Función:**
- Lista últimos 5 registros de audit_log
- Muestra todos los action types únicos usados
- Intenta insertar `voucher_issued` como prueba

### 4. Este archivo: `DIAGNOSTICO_CONGELAMIENTO_MESA.md`
**Descripción:** Documentación completa del problema y solución

---

## 📊 COMPARACIÓN: SQLite vs Supabase

| Característica | SQLite (local) | Supabase (cloud) |
|----------------|----------------|------------------|
| **Tabla audit_log** | ✅ Existe | ✅ Existe |
| **Constraint actual** | ✅ 13 actions | ❌ 3 actions |
| **voucher_issued permitido** | ✅ SÍ | ❌ NO |
| **Causa problemas** | ❌ NO | ✅ SÍ |

**Conclusión:** SQLite está bien, Supabase necesita el fix.

---

## 🎯 IMPACTO DEL PROBLEMA:

### Módulos afectados:
- 🎰 **Mesa** ← Congelamiento al emitir ticket (CRÍTICO)
- 💵 **Caja** ← Posible congelamiento al canjear ticket
- 👤 **Usuarios** ← Posible error al crear/actualizar usuarios
- 👨‍💼 **Operadores** ← Posible error al crear/actualizar operadores
- ⚙️ **Config** ← Posible error al guardar configuración
- 🚪 **Logout** ← Posible error al cerrar sesión

### Gravedad:
- ⚠️ **ALTA** - Mesa es el módulo más usado del sistema
- ⚠️ **ALTA** - Valores rápidos es una feature nueva y popular
- ⚠️ **ALTA** - Congelamiento requiere cerrar app a la fuerza

---

## ✅ RESULTADO DESPUÉS DEL FIX:

### Lo que funcionará:
1. ✅ Mesa NO se congelará al usar valores rápidos
2. ✅ Todos los tickets se registrarán en audit_log correctamente
3. ✅ Auditoría completa de todas las acciones del sistema
4. ✅ Reportes de auditoría tendrán datos completos

### Performance:
- No hay impacto negativo en performance
- El constraint solo valida al insertar (operación rápida)
- Supabase maneja esto eficientemente

---

## 📝 NOTAS TÉCNICAS:

### Por qué el constraint estaba limitado:

Probablemente fue creado con una migración inicial que solo consideraba las actions básicas:
```sql
-- Migración inicial (probablemente)
CREATE TABLE audit_log (
  ...
  action TEXT CHECK(action IN ('user_login', 'voucher_created', 'voucher_redeemed'))
);
```

### Por qué el código usa más actions:

El código evolucionó y agregó más funcionalidades:
- Emisión de tickets (`voucher_issued`)
- Gestión de operadores (`operator_created`, `operator_updated`)
- Gestión de usuarios (`user_created`, `user_updated`)
- Cierre de sesiones (`session_closed`)
- Cambios de config (`config_changed`)

Pero **nadie actualizó el constraint de Supabase** para reflejar estos cambios.

### Líneas de código donde se usan las actions:

| Action | Línea en main.js | Handler |
|--------|------------------|---------|
| `user_login` | 482 | `auth:login` |
| `voucher_issued` | 1308 | `tickets:create` ← **CAUSA ERROR** |
| `voucher_redeemed` | 1649 | `tickets:redeem` |
| `operator_created` | 1887 | `operadores:crear` |
| `operator_updated` | 1937, 1986 | `operadores:actualizar`, `operadores:toggle` |
| `user_created` | 2187 | `user:create` |
| `user_updated` | 2281, 2343, 2393 | `user:update`, `user:toggle`, `user:change-password` |
| `session_closed` | 3775 | `security:close-session` |

---

## 🚀 PRÓXIMOS PASOS:

1. ✅ **Aplicar el fix en Supabase** (5 minutos)
   - Abre Dashboard
   - Ejecuta SQL
   - Verifica con `node fix-audit-constraint.js`

2. ✅ **Probar Mesa** (2 minutos)
   - `npm start`
   - Login → Mesa → Valor rápido → Emitir
   - Verificar que NO se congela

3. ✅ **Verificar auditoría** (1 minuto)
   - `node check-audit-log-constraint.js`
   - Verificar que `voucher_issued` aparece en la lista

4. ✅ **Actualizar SQLite también** (opcional, ya funciona)
   - SQLite ya tiene el constraint correcto (13 actions)
   - Ver: `SqulInstrucciones/database.js` líneas 105-118

---

## 🎯 CONCLUSIÓN:

**Problema:**
- ✅ Identificado: Constraint de audit_log muy restrictivo
- ✅ Causa: Solo permite 3 actions, código usa 13
- ✅ Impacto: Mesa se congela al emitir tickets

**Solución:**
- ✅ SQL script creado
- ✅ Instrucciones paso a paso listas
- ✅ Scripts de verificación disponibles

**Tiempo estimado de fix:** 5-10 minutos

**Estado:** ⚠️ **ESPERANDO APLICACIÓN DEL FIX EN SUPABASE**

---

**Actualizado:** 2025-11-07
**Próxima acción:** Ejecutar SQL en Supabase Dashboard
**Archivos relacionados:**
- [fix-audit-constraint.js](fix-audit-constraint.js)
- [SqulInstrucciones/fix-audit-log-constraint.sql](SqulInstrucciones/fix-audit-log-constraint.sql)
- [check-audit-log-constraint.js](check-audit-log-constraint.js)
