# 🚀 GU\u00cdA DE INTEGRACI\u00d3N SUPABASE

## 📋 RESUMEN DE CAMBIOS

Se ha implementado la **sincronizaci\u00f3n en tiempo real** entre todos los dispositivos del casino usando **Supabase** como base de datos central en la nube.

### ✅ **PROBLEMA SOLUCIONADO**

**ANTES:**
- Cada dispositivo ten\u00eda su propia base de datos SQLite aislada
- Un ticket creado en Mesa 1 NO se ve\u00eda en Caja
- 7 dispositivos con 7 bases de datos separadas = CAOS

**AHORA:**
- Supabase es la **fuente de verdad** (base de datos central en la nube)
- Todos los dispositivos escriben y leen de Supabase
- SQLite local solo como cach\u00e9/backup para modo offline
- **Sincronizaci\u00f3n en tiempo real** entre todos los dispositivos

---

## 🏗️ ARQUITECTURA NUEVA

```
Mesa 1 ──┐
Mesa 2 ──┤
Mesa 3 ──┼──→ SUPABASE ☁️  (BD Central) ←──┬── Caja
Mesa 4 ──┤         ↓                        ├── Auditor
         └──→ SQLite 💾 (backup offline)    └── Admin
```

---

## 📁 ARCHIVOS MODIFICADOS

### ✅ **Nuevos Archivos Creados**

1. **`pure/supabaseManager.js`** - M\u00f3dulo centralizado para gestionar Supabase
   - Maneja conexi\u00f3n a Supabase
   - M\u00e9todos para crear, buscar, actualizar vouchers
   - Sincronizaci\u00f3n de vouchers pendientes

2. **`test-supabase-connection.js`** - Script de prueba para verificar conexi\u00f3n
   - Prueba INSERT, SELECT, UPDATE, DELETE
   - Valida estructura de tabla `vouchers`
   - Verifica credenciales

3. **`SUPABASE_INTEGRATION_GUIDE.md`** - Esta gu\u00eda

### ✅ **Archivos Modificados**

1. **`pure/main.js`** - Main process de Electron
   - ✅ Importa `supabaseManager`
   - ✅ Handler `generate-ticket`: guarda en Supabase + SQLite
   - ✅ Handler `validate-voucher`: busca en Supabase primero, fallback a SQLite
   - ✅ Handler `redeem-voucher`: actualiza en Supabase + SQLite
   - ✅ Handler `sync-pending-vouchers`: sincroniza vouchers pendientes
   - ✅ Inicializa Supabase Manager en `app.whenReady()`
   - ✅ Comentado registro duplicado de handlers de `src/main/ipc/`

### 📦 **Backups Creados**

- `pure/main.js.BACKUP_SUPABASE_INTEGRATION`
- `src/main/ipc/index.js.BACKUP_SUPABASE_INTEGRATION`

---

## 🔧 FLUJO DE OPERACIONES

### 1️⃣ **CREAR TICKET (generate-ticket)**

**Modo ONLINE (con internet):**
```
1. Crear ticket en SQLite local (genera código único)
   → Código: PREV-001234
2. Guardar en Supabase (cloud) ☁️
   → INSERT en tabla `vouchers`
3. Marcar como sincronizado en SQLite local
   → UPDATE tickets SET sincronizado = 1
4. Retornar resultado con flag `synced: true`
```

**Modo OFFLINE (sin internet):**
```
1. Crear ticket en SQLite local
   → Código: PREV-001234
2. Intentar guardar en Supabase → FALLA (sin conexi\u00f3n)
3. Log warning: "Supabase no disponible, modo offline"
4. Retornar resultado con flag `synced: false`
5. Al recuperar internet: usar handler `sync-pending-vouchers`
```

---

### 2️⃣ **VALIDAR TICKET (validate-voucher)**

**Modo ONLINE:**
```
1. Buscar en Supabase PRIMERO ☁️
   → SELECT * FROM vouchers WHERE voucher_code = 'PREV-001234'
2. Si se encuentra:
   - Guardar en SQLite local como cach\u00e9
   - Retornar voucher con source: 'cloud'
3. Si NO se encuentra en Supabase:
   - FALLBACK: Buscar en SQLite local
   - Retornar voucher con source: 'local'
```

**Modo OFFLINE:**
```
1. Supabase no disponible
2. Buscar directamente en SQLite local
3. Retornar voucher con source: 'local'
```

---

### 3️⃣ **CANJEAR TICKET (redeem-voucher)**

**Modo ONLINE:**
```
1. Canjear en SQLite local
   → UPDATE tickets SET estado = 'usado'
2. Actualizar en Supabase ☁️
   → UPDATE vouchers SET status = 'redeemed'
3. Log confirmación
```

**Modo OFFLINE:**
```
1. Canjear en SQLite local
2. Intentar actualizar en Supabase → FALLA
3. Log warning: "No se pudo actualizar en Supabase"
4. Al recuperar internet: el estado se sincroniza en próxima operación
```

---

### 4️⃣ **SINCRONIZAR PENDIENTES (sync-pending-vouchers)**

Handler manual para sincronizar vouchers que se crearon offline:

```javascript
// Llamar desde frontend
const result = await window.api.syncPendingVouchers();

// Resultado:
{
  success: true,
  synced: 5,    // 5 vouchers sincronizados exitosamente
  failed: 0,    // 0 fallidos
  message: "Sincronizados 5 de 5 vouchers"
}
```

**Flujo:**
```
1. Obtener tickets con sincronizado = 0 de SQLite
2. Para cada ticket:
   - Crear voucher en Supabase
   - Si \u00e9xito: marcar sincronizado = 1
   - Si falla: contar como failed
3. Retornar resumen
```

---

## 🗄️ ESTRUCTURA DE TABLA SUPABASE

### Tabla: `vouchers`

| Columna | Tipo | Descripci\u00f3n |
|---------|------|-------------|
| `id` | UUID | ID \u00fanico (PK) |
| `voucher_code` | TEXT | C\u00f3digo del voucher (ej: PREV-001234) |
| `qr_data` | TEXT | Datos del QR (c\u00f3digo\|monto\|moneda) |
| `qr_hash` | TEXT | Hash SHA256 para seguridad |
| `amount` | DECIMAL | Monto del voucher |
| `currency` | TEXT | Moneda (DOP/USD) |
| `status` | TEXT | Estado (active/redeemed/cancelled) |
| `issued_by_user_id` | UUID | ID del usuario que emiti\u00f3 (FK → users) |
| `issued_at_station_id` | INTEGER | ID de la mesa/estaci\u00f3n (FK → stations) |
| `issued_at` | TIMESTAMP | Fecha de emisi\u00f3n |
| `redeemed_by_user_id` | UUID | ID del cajero que canje\u00f3 (FK → users) |
| `redeemed_at_station_id` | INTEGER | ID de estaci\u00f3n donde se canje\u00f3 (FK → stations) |
| `redeemed_at` | TIMESTAMP | Fecha de canje |
| `expires_at` | TIMESTAMP | Fecha de expiraci\u00f3n |
| `customer_name` | TEXT | Nombre del cliente (opcional) |
| `customer_notes` | TEXT | Notas adicionales (opcional) |
| `created_at` | TIMESTAMP | Fecha de creaci\u00f3n |
| `updated_at` | TIMESTAMP | \u00daltima actualizaci\u00f3n |

### Mapeo SQLite ↔ Supabase

| SQLite (`tickets`) | Supabase (`vouchers`) |
|-------------------|---------------------|
| `code` | `voucher_code` |
| `amount` | `amount` |
| `currency` | `currency` |
| `estado` ('emitido') | `status` ('active') |
| `estado` ('usado') | `status` ('redeemed') |
| `fecha_emision` | `issued_at` |
| `fecha_cobro` | `redeemed_at` |
| `cajero_id` | `redeemed_by_user_id` |
| `mesa_nombre` | `issued_at_station_id` |

---

## 🧪 C\u00d3MO PROBAR LA INTEGRACI\u00d3N

### 1. **Probar Conexi\u00f3n a Supabase**

```bash
cd c:\appCasino
node test-supabase-connection.js
```

**Resultado esperado:**
```
✅ Variables de entorno OK
✅ Cliente creado
✅ Conexi\u00f3n exitosa a tabla "vouchers"
✅ INSERT exitoso
✅ SELECT exitoso
✅ Voucher encontrado
✅ TODAS LAS PRUEBAS PASARON EXITOSAMENTE
```

---

### 2. **Reiniciar la App (por Trae)**

⚠️ **IMPORTANTE**: NO reiniciar la app manualmente. Esperar a que Trae la reinicie.

Al reiniciar, verificar logs en consola:

```
✅ Supabase Manager inicializado y conectado
✅ Handlers vouchers b\u00e1sicos registrados (generate/validate/redeem/stats + sync)
```

---

### 3. **Crear Ticket en Mesa**

1. Abrir Mesa
2. Ingresar valor: 200 DOP
3. Emitir ticket
4. **Verificar logs:**

```javascript
📥 Recibiendo datos para crear ticket: {valor: 200, moneda: 'DOP', ...}
✅ Ticket guardado en SQLite local: PREV-001234
☁️  Intentando sincronizar con Supabase...
✅ Ticket sincronizado con Supabase: PREV-001234
✅ Ticket guardado: {code: 'PREV-001234', synced: true}
```

---

### 4. **Validar Ticket en Caja (MISMO dispositivo)**

1. Abrir Caja
2. Ingresar c\u00f3digo: PREV-001234
3. Validar
4. **Verificar logs:**

```javascript
☁️  Buscando voucher en Supabase: PREV-001234
✅ Voucher encontrado en Supabase: PREV-001234
📋 Ticket validado: {code: 'PREV-001234', source: 'cloud'}
```

---

### 5. **Validar Ticket en Caja (OTRO dispositivo)** ⭐ **PRUEBA CLAVE**

1. Crear ticket en Mesa 1 → PREV-001234
2. **SIN CERRAR MESA 1**, abrir Caja en **OTRO dispositivo**
3. Validar PREV-001234 en Caja
4. **Resultado esperado:**
   - ✅ Ticket encontrado en Supabase
   - ✅ Se muestra informaci\u00f3n correcta (monto, moneda, mesa, operador)
   - ✅ Se puede canjear

**Esto confirma que la sincronizaci\u00f3n en tiempo real funciona.**

---

### 6. **Probar Modo Offline**

1. Desconectar internet
2. Crear ticket en Mesa → PREV-999999
3. **Verificar logs:**

```javascript
✅ Ticket guardado en SQLite local: PREV-999999
☁️  Intentando sincronizar con Supabase...
⚠️  No se pudo sincronizar con Supabase (modo offline)
✅ Ticket guardado: {code: 'PREV-999999', synced: false}
```

4. Reconectar internet
5. Llamar sincronizaci\u00f3n manual:

```javascript
const result = await window.api.syncPendingVouchers();
console.log(result); // {success: true, synced: 1, failed: 0}
```

6. Verificar que PREV-999999 ahora est\u00e1 en Supabase

---

## 🐛 TROUBLESHOOTING

### Problema 1: "Supabase no disponible (modo offline)"

**Causa:** Variables de entorno no configuradas o sin conexi\u00f3n

**Soluci\u00f3n:**
1. Verificar `.env`:
   ```
   SUPABASE_URL=https://elagvnnamabrjptovzyq.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

2. Probar conexi\u00f3n:
   ```bash
   node test-supabase-connection.js
   ```

---

### Problema 2: Foreign Key Constraint Error

**Error:** `insert or update on table "vouchers" violates foreign key constraint "vouchers_issued_by_user_id_fkey"`

**Causa:** El `issued_by_user_id` no existe en la tabla `users`

**Soluci\u00f3n:**
1. Usar un `user_id` v\u00e1lido existente en Supabase
2. Configurar en `.env`:
   ```
   DEFAULT_USER_ID=85397c30-3856-4d82-a4bb-06791b8cacd0
   ```

3. Verificar usuarios disponibles:
   ```sql
   SELECT id, email FROM users;
   ```

---

### Problema 3: "Ticket no encontrado en ninguna base de datos"

**Causa:** El ticket no existe en Supabase ni en SQLite local

**Soluci\u00f3n:**
1. Verificar que el ticket se cre\u00f3 correctamente
2. Revisar logs de creaci\u00f3n:
   ```
   ✅ Ticket guardado en SQLite local: PREV-XXXXXX
   ✅ Ticket sincronizado con Supabase: PREV-XXXXXX
   ```

3. Consultar Supabase directamente:
   ```sql
   SELECT * FROM vouchers WHERE voucher_code = 'PREV-XXXXXX';
   ```

---

### Problema 4: Handlers duplicados / Ticket se crea 2 veces

**Causa:** Los handlers de `src/main/ipc/ticketHandlers.js` est\u00e1n registr\u00e1ndose y sobrescribiendo los handlers con Supabase

**Soluci\u00f3n:** Ya est\u00e1 solucionado en [pure/main.js:659-662](pure/main.js#L659-L662)
```javascript
// COMENTADO: Evita duplicaci\u00f3n de handlers y conflictos
// if (typeof registerIpcHandlers === 'function') {
//   await registerIpcHandlers({ db, printer });
// }
```

---

## 🎯 RESULTADO ESPERADO

### ✅ **ONLINE (con internet)**

```
Mesa 1 crea ticket PREV-001234
   ↓
✅ Guardado en SQLite local
✅ Guardado en Supabase ☁️
   ↓
Caja (OTRO dispositivo) valida PREV-001234
   ↓
✅ Encontrado en Supabase ☁️
✅ Muestra informaci\u00f3n correcta
✅ Se puede canjear
   ↓
Caja canjea PREV-001234
   ↓
✅ Actualizado en SQLite local
✅ Actualizado en Supabase ☁️
   ↓
TODOS los dispositivos ven el ticket como CANJEADO
```

---

### ✅ **OFFLINE (sin internet)**

```
Mesa 1 crea ticket PREV-999999
   ↓
✅ Guardado en SQLite local
❌ NO guardado en Supabase (sin conexi\u00f3n)
⚠️  Flag: synced = false
   ↓
Reconectar internet
   ↓
Llamar sync-pending-vouchers
   ↓
✅ PREV-999999 sincronizado a Supabase ☁️
✅ Ahora TODOS los dispositivos lo ven
```

---

## 📊 LOGS IMPORTANTES

### Logs de \u00e9xito:

```
✅ Supabase Manager inicializado y conectado
✅ Ticket guardado en SQLite local: PREV-XXXXXX
✅ Ticket sincronizado con Supabase: PREV-XXXXXX
✅ Voucher encontrado en Supabase: PREV-XXXXXX
✅ Voucher actualizado en Supabase: PREV-XXXXXX
✅ Sincronizaci\u00f3n completada: 5 exitosos, 0 fallidos
```

### Logs de warning (NO son errores):

```
⚠️  Supabase Manager inicializado pero sin conexi\u00f3n (modo offline)
⚠️  No se pudo sincronizar con Supabase (modo offline)
⚠️  Error buscando en Supabase, intentando SQLite local
⚠️  No se pudo actualizar en Supabase (continuando en modo offline)
```

### Logs de error (requieren acci\u00f3n):

```
❌ Error creando voucher en Supabase: [mensaje de error]
❌ Error buscando voucher: [mensaje de error]
❌ Error sincronizando vouchers: [mensaje de error]
```

---

## 🔐 SEGURIDAD

### Datos sensibles en `.env`:

```
SUPABASE_URL=https://elagvnnamabrjptovzyq.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
QR_SECRET=casino-sosua-secret-key-2025
```

⚠️ **NUNCA compartir estas credenciales p\u00fablicamente**

---

## 📝 NOTAS FINALES

1. ✅ **Backups creados** antes de modificar archivos
2. ✅ **No se toc\u00f3 `app.getPath()`** en nivel de m\u00f3dulo (evita errores de inicializaci\u00f3n)
3. ✅ **Modo offline resiliente** (si Supabase falla, funciona con SQLite local)
4. ✅ **No se reinici\u00f3 la app** (Trae lo har\u00e1)
5. ✅ **Documentaci\u00f3n completa** para testing

---

## ✅ CHECKLIST DE TESTING

- [ ] Probar `node test-supabase-connection.js` → ✅ PASA
- [ ] Reiniciar app (por Trae)
- [ ] Crear ticket en Mesa 1 → ✅ Se guarda en Supabase
- [ ] Validar ticket en Caja (mismo dispositivo) → ✅ Se encuentra
- [ ] **Validar ticket en Caja (OTRO dispositivo)** → ✅ Se encuentra ⭐
- [ ] Canjear ticket en Caja → ✅ Se actualiza en Supabase
- [ ] Desconectar internet, crear ticket → ✅ Se guarda local
- [ ] Reconectar internet, sincronizar pendientes → ✅ Se sincroniza

---

**Implementado por: Claude (Sonnet 4.5)**
**Fecha: 2025-10-29**
**Estado: ✅ COMPLETO - Listo para testing**
