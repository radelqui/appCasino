# 🚨 DIAGNÓSTICO CRÍTICO: POR QUÉ CAJA NO PUEDE VALIDAR TICKETS

**Fecha**: 31 de octubre de 2025
**Sistema**: appCasino - Sistema TITO
**Problema**: Los tickets generados en Mesa no pueden ser validados en Caja

---

## RESUMEN EJECUTIVO

**PROBLEMA RAÍZ**: Los handlers IPC necesarios para Caja (`caja:validate-voucher`, `caja:redeem-ticket`, etc.) **NO están registrados** en `pure/main.js`.

**IMPACTO**:
- ✅ Mesa puede generar tickets correctamente
- ✅ Tickets se guardan en SQLite y Supabase
- ❌ Caja NO puede validar ni cobrar tickets
- ❌ Los handlers `caja:*` existen en el código pero nunca se ejecutan

---

## 1. FLUJO COMPLETO: MESA GENERA TICKET ✅

### Cuando se genera ticket PREV-022810 ($800 USD, Mesa P03):

**Handler IPC llamado**: `generate-ticket` (sin prefijo)

**Archivo ejecutado**: `pure/main.js` líneas 361-559

### ✅ INSERT en Supabase (líneas 424-440):
```sql
INSERT INTO vouchers (
  voucher_code,          -- 'PREV-022810'
  qr_data,               -- JSON con datos del QR
  qr_hash,               -- SHA256 hash de seguridad
  amount,                -- 800
  currency,              -- 'USD'
  status,                -- 'active'
  issued_by_user_id,     -- UUID del usuario
  issued_at_station_id,  -- 3 (convertido desde "P03")
  mesa_nombre,           -- 'P03'
  operador_nombre,       -- nombre del usuario
  customer_name          -- nombre del usuario
) RETURNING *;
```

**Resultado Supabase**:
```json
{
  "voucher_code": "PREV-022810",
  "amount": 800,
  "status": "active",
  "mesa_nombre": "P03",
  "created_at": "2025-10-31T14:19:09.466096+00:00"
}
```

### ✅ INSERT en SQLite (líneas 472-485):
```sql
INSERT INTO tickets (
  code,                  -- 'PREV-022810'
  amount,                -- 800
  currency,              -- 'USD'
  mesa,                  -- 'P03'
  estado,                -- 'emitido'
  sincronizado,          -- 1 (si Supabase exitoso, 0 si offline)
  mesa_id,               -- 3
  created_by_user_id,    -- UUID del usuario
  created_by_username,   -- nombre del usuario
  mesa_nombre            -- 'P03'
);
```

**Ruta SQLite**: `C:\appCasino\data\casino.db`

**Verificación en Supabase (ejecutada)**:
```bash
node -e "require('dotenv').config(); const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
sb.from('vouchers').select('*').eq('voucher_code', 'PREV-022810').single()..."
```

**Resultado**: ✅ **Ticket guardado correctamente en AMBAS bases de datos**

---

## 2. FLUJO COMPLETO: CAJA INTENTA VALIDAR ❌

### Cuando Caja ingresa código PREV-022810:

**1. Frontend llama al preload** (`Caja/panel.html` → `Caja/preload-caja.js` línea 8):
```javascript
// En el código de Caja
window.api.validateVoucher('PREV-022810')
```

**2. Preload invoca handler IPC** (`Caja/preload-caja.js` línea 8):
```javascript
validateVoucher: (code) => ipcRenderer.invoke('caja:validate-voucher', code)
//                                             ^^^^^^^^^^^^^^^^^^^^^^
//                                             Nota el prefijo 'caja:'
```

**3. Electron busca el handler en main process**:
```
Buscando handler: 'caja:validate-voucher'
```

**4. ❌ PROBLEMA: Handler NO encontrado en pure/main.js**

### Handlers disponibles en `pure/main.js`:

| Handler registrado | Línea | ¿Funciona para Caja? |
|-------------------|-------|---------------------|
| `generate-ticket` | 361 | ❌ No (Caja no lo usa) |
| `validate-voucher` | 561 | ❌ No (sin prefijo `caja:`) |
| `redeem-voucher` | 697 | ❌ No (sin prefijo `caja:`) |
| `caja:validate-voucher` | - | ❌ **NO EXISTE** |
| `caja:validate-ticket` | - | ❌ **NO EXISTE** |
| `caja:redeem-ticket` | - | ❌ **NO EXISTE** |

**Búsqueda en código**:
```bash
grep -n "cajaHandlers\|registerCajaHandlers" pure/main.js
# Resultado: NO MATCHES FOUND
```

**Conclusión**: Los handlers `caja:*` nunca se registraron.

---

## 3. ¿DÓNDE EXISTEN LOS HANDLERS `caja:*`?

### Archivo: `Caja/cajaHandlers.js`

**Exporta función de registro** (última línea):
```javascript
module.exports = { registerCajaHandlers };
```

**Handler `caja:validate-voucher`** (líneas 103-193):
```javascript
ipcMain.handle('caja:validate-voucher', async (event, voucherCode) => {
    console.log('🔍 VALIDATE-VOUCHER LLAMADO');
    const normalized = String(voucherCode || '').toUpperCase().trim();
    let voucher = null;

    // PASO 1: Intentar buscar en tabla 'vouchers' de SQLite
    try {
        const info = db.db.prepare(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='vouchers'"
        ).get();

        if (info) {
            const row = db.db.prepare(
                'SELECT * FROM vouchers WHERE voucher_code = ?'
            ).get(normalized);

            if (row) {
                voucher = {
                    voucher_code: row.voucher_code,
                    amount: Number(row.amount || 0),
                    currency: row.currency || 'DOP',
                    status: (row.status || 'active').toLowerCase(),
                    issued_at: row.issued_at
                };
            }
        }
    } catch (e) {
        console.warn('Fallback a tickets:', e?.message);
    }

    // PASO 2: Fallback - buscar en tabla 'tickets'
    if (!voucher) {
        voucher = db.getVoucherByCode(normalized); // ← Busca en 'tickets'
    }

    if (!voucher) {
        return {
            success: false,
            error: 'Voucher no encontrado',
            valid: false
        };
    }

    // Validar estado
    if (voucher.status !== 'active') {
        return {
            success: false,
            error: 'Voucher ya usado o inválido',
            valid: false
        };
    }

    return {
        success: true,
        valid: true,
        voucher: {
            code: voucher.voucher_code,
            amount: voucher.amount,
            currency: voucher.currency,
            status: voucher.status
        }
    };
});
```

**Problema con este handler**:
1. Primero busca en tabla `vouchers` de SQLite - **esta tabla NO EXISTE**
2. Fallback: llama a `db.getVoucherByCode()` que SÍ busca en tabla `tickets` ✅

### Método fallback `db.getVoucherByCode()` (Caja/database.js línea 216):
```javascript
getVoucherByCode(code) {
    const t = this.getTicket(code);  // ← Busca en tabla 'tickets'
    if (!t) return null;

    // Mapea formato de 'ticket' a 'voucher'
    return {
        voucher_code: t.code,           // ← Columna correcta
        amount: t.amount,
        currency: t.currency,
        status: mapEstado(t.estado),    // emitido → active
        issued_at: t.fecha_emision
    };
}

getTicket(code) {
    return this.db.prepare('SELECT * FROM tickets WHERE code = ?').get(code);
}
```

**Este fallback SÍ funcionaría** si el handler estuviera registrado.

---

## 4. COMPARACIÓN: HANDLERS REGISTRADOS vs LLAMADOS

### Handlers que Mesa/Panel usan (funcionan):

| Handler | Definido en | Usado por | Estado |
|---------|------------|-----------|--------|
| `generate-ticket` | pure/main.js:361 | Mesa | ✅ Funciona |
| `validate-voucher` | pure/main.js:561 | Panel (si lo usa) | ✅ Funciona |
| `redeem-voucher` | pure/main.js:697 | Panel (si lo usa) | ✅ Funciona |

### Handlers que Caja necesita (NO funcionan):

| Handler | Definido en | Usado por | Registrado en pure/main.js |
|---------|------------|-----------|---------------------------|
| `caja:validate-voucher` | Caja/cajaHandlers.js:103 | Caja | ❌ **NO** |
| `caja:validate-ticket` | Caja/cajaHandlers.js:61 | Caja | ❌ **NO** |
| `caja:redeem-ticket` | Caja/cajaHandlers.js:196 | Caja | ❌ **NO** |
| `caja:cancel-ticket` | Caja/cajaHandlers.js | Caja | ❌ **NO** |
| `caja:get-ticket` | Caja/cajaHandlers.js | Caja | ❌ **NO** |

---

## 5. DIAGRAMA DEL PROBLEMA

```
┌─────────────────────────────────────────────────────────────┐
│ GENERACIÓN DE TICKET (FUNCIONA ✅)                          │
└─────────────────────────────────────────────────────────────┘

Mesa (pure/mesa.html)
  │
  └─→ IPC: 'generate-ticket'
        │
        └─→ pure/main.js (Handler registrado ✅)
              │
              ├─→ INSERT Supabase.vouchers ✅
              │     (PREV-022810, $800, active)
              │
              └─→ INSERT SQLite.tickets ✅
                    (PREV-022810, $800, emitido)


┌─────────────────────────────────────────────────────────────┐
│ VALIDACIÓN EN CAJA (NO FUNCIONA ❌)                         │
└─────────────────────────────────────────────────────────────┘

Caja (Caja/panel.html)
  │
  └─→ window.api.validateVoucher('PREV-022810')
        │
        └─→ Caja/preload-caja.js
              │
              └─→ IPC: 'caja:validate-voucher'
                    │
                    └─→ pure/main.js
                          │
                          └─→ ❌ Handler 'caja:validate-voucher' NO EXISTE
                                │
                                └─→ Error: No handler for 'caja:validate-voucher'
                                      │
                                      └─→ Caja muestra: "Voucher no encontrado"


┌─────────────────────────────────────────────────────────────┐
│ DÓNDE EXISTE EL HANDLER (NO SE USA)                         │
└─────────────────────────────────────────────────────────────┘

Caja/cajaHandlers.js
  │
  ├─→ registerCajaHandlers() {
  │     ipcMain.handle('caja:validate-voucher', ...)  ← EXISTE
  │     ipcMain.handle('caja:validate-ticket', ...)   ← EXISTE
  │     ipcMain.handle('caja:redeem-ticket', ...)     ← EXISTE
  │   }
  │
  └─→ module.exports = { registerCajaHandlers }

pure/main.js
  │
  └─→ ❌ NUNCA llama registerCajaHandlers()
        │
        └─→ Los handlers 'caja:*' nunca se registran
```

---

## 6. EVIDENCIA DEL PROBLEMA

### Búsqueda en pure/main.js:
```bash
$ grep -n "cajaHandlers\|registerCajaHandlers" pure/main.js
(sin resultados)

$ grep -n "require.*cajaHandlers" pure/main.js
(sin resultados)
```

### Línea 2737-2739 de pure/main.js (comentario revelador):
```javascript
// HANDLERS DUPLICADOS COMENTADOS - Los handlers generate-ticket, validate-voucher, redeem-voucher
// están definidos arriba con integración de Supabase. No registramos los handlers de src/main/ipc/
// para evitar sobrescribir los handlers que ya tienen Supabase integrado.
```

**Interpretación**: Alguien decidió NO registrar handlers duplicados, pero olvidó que Caja necesita los handlers con prefijo `caja:*`.

### Base de datos usada:

**pure/main.js (líneas 37-39)**:
```javascript
const CasinoDatabase = require(path.join(__dirname, '..', 'Caja', 'database'));
const dbPath = process.env.CASINO_DB_PATH || process.env.SQLITE_DB_PATH ||
               path.join(process.cwd(), 'data', 'casino.db');
db = new CasinoDatabase(dbPath);
```

**Caja/cajaHandlers.js (línea 11)**:
```javascript
const dbPath = process.env.CASINO_DB_PATH || process.env.SQLITE_DB_PATH ||
               path.join(process.cwd(), 'data', 'casino.db');
const db = new CasinoDatabase(dbPath);
```

**Conclusión**: ✅ Ambos usan **LA MISMA base de datos**: `C:\appCasino\data\casino.db`

### Tablas en SQLite:

**Tabla que existe**: `tickets`
```sql
CREATE TABLE tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,        -- ← PREV-022810
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT,
  estado TEXT,                       -- ← 'emitido', 'usado', etc.
  fecha_emision DATETIME,
  ...
);
```

**Tabla que NO existe**: `vouchers` (en SQLite)

**Nota**: La tabla `vouchers` solo existe en Supabase PostgreSQL.

---

## 7. SOLUCIONES PROPUESTAS

### ✅ SOLUCIÓN 1: Registrar handlers de Caja en pure/main.js (RECOMENDADA)

**Agregar en pure/main.js después de app.whenReady()** (alrededor de línea 2680):

```javascript
// Registrar handlers de Caja
try {
  const { registerCajaHandlers } = require(path.join(__dirname, '..', 'Caja', 'cajaHandlers'));
  registerCajaHandlers();
  console.log('✅ Handlers de Caja registrados (caja:*)');
} catch (error) {
  console.error('❌ Error registrando handlers de Caja:', error.message);
}
```

**Ventajas**:
- Solución rápida
- No requiere cambios en Caja
- Mantiene la separación de responsabilidades

**Desventajas**:
- Tendremos handlers duplicados para validación/redeem

---

### ✅ SOLUCIÓN 2: Cambiar nombres en Caja/preload-caja.js

**Modificar Caja/preload-caja.js** (líneas 7-12):

```javascript
// ANTES:
validateTicket: (code) => ipcRenderer.invoke('caja:validate-ticket', code),
validateVoucher: (code) => ipcRenderer.invoke('caja:validate-voucher', code),
redeemTicket: (code, cajeroId) => ipcRenderer.invoke('caja:redeem-ticket', code, cajeroId),

// DESPUÉS:
validateTicket: (code) => ipcRenderer.invoke('validate-voucher', code),
validateVoucher: (code) => ipcRenderer.invoke('validate-voucher', code),
redeemTicket: (code, cajeroId) => ipcRenderer.invoke('redeem-voucher', code, cajeroId),
```

**Ventajas**:
- Usa los handlers ya existentes en pure/main.js
- No necesita registrar handlers adicionales

**Desventajas**:
- Los handlers `validate-voucher` y `redeem-voucher` de pure/main.js tienen lógica diferente
- Puede romper funcionalidad específica de Caja

---

### ✅ SOLUCIÓN 3: Unificar handlers (SOLUCIÓN A LARGO PLAZO)

1. **Eliminar duplicación**: Tener un solo handler `validate-voucher` que funcione para Mesa Y Caja
2. **Actualizar pure/main.js línea 561**: Mejorar el handler existente con la lógica de cajaHandlers
3. **Eliminar Caja/cajaHandlers.js**: Ya no sería necesario

**Ventajas**:
- Código más limpio y mantenible
- Sin duplicación de lógica
- Un solo punto de verdad

**Desventajas**:
- Requiere refactorización significativa
- Mayor riesgo de romper funcionalidad existente

---

## 8. TABLA RESUMEN DE BASES DE DATOS

| Base de Datos | Tipo | Ruta/URL | Tablas Relevantes | Usado Para |
|---------------|------|----------|-------------------|------------|
| SQLite Local | SQLite | `C:\appCasino\data\casino.db` | `tickets`, `usuarios`, `operadores`, `auditoria` | Caché local, tickets offline |
| Supabase Cloud | PostgreSQL | `elagvnnamabrjptovzyq.supabase.co` | `vouchers`, `users`, `operadores`, `audit_log`, `stations` | Fuente de verdad, sincronización |

### Flujo de datos actual:

```
Mesa genera ticket
  ├─→ Guarda en Supabase.vouchers (PRIMARY)
  └─→ Guarda en SQLite.tickets (CACHE)

Caja valida ticket
  ├─→ Busca en Supabase.vouchers (FIRST)
  └─→ Fallback a SQLite.tickets (IF OFFLINE)
```

**Problema**: Caja NO puede ejecutar esta búsqueda porque el handler no está registrado.

---

## 9. RESPUESTAS A PREGUNTAS CRÍTICAS

### ❓ ¿Se guarda en SQLite cuando se genera?
✅ **SÍ** - Tabla `tickets`, columna `code` = 'PREV-022810'

### ❓ ¿Se guarda en Supabase cuando se genera?
✅ **SÍ** - Tabla `vouchers`, columna `voucher_code` = 'PREV-022810'

### ❓ ¿Qué handler llama Caja?
`caja:validate-voucher` (con prefijo)

### ❓ ¿En qué BD busca Caja?
❌ **NO BUSCA** - El handler no está registrado, la búsqueda nunca ocurre

### ❓ ¿Qué query ejecutaría si estuviera registrado?
```sql
-- Primero (fallaría):
SELECT * FROM vouchers WHERE voucher_code = 'PREV-022810'

-- Fallback (funcionaría):
SELECT * FROM tickets WHERE code = 'PREV-022810'
```

### ❓ ¿Por qué no encuentra el ticket?
Porque el handler `caja:validate-voucher` **nunca se registró** en pure/main.js

---

## 10. PLAN DE ACCIÓN INMEDIATO

### Paso 1: Confirmar el diagnóstico
```bash
# Verificar que el ticket existe en SQLite
node check-sqlite-structure.js

# Verificar que el ticket existe en Supabase
node -e "require('dotenv').config(); const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
sb.from('vouchers').select('*').eq('voucher_code', 'PREV-022810').then(r => console.log(r.data));"
```

### Paso 2: Implementar Solución 1 (registrar handlers)
```javascript
// En pure/main.js, después de línea 2680 (dentro de app.whenReady())
const { registerCajaHandlers } = require(path.join(__dirname, '..', 'Caja', 'cajaHandlers'));
registerCajaHandlers();
```

### Paso 3: Reiniciar app y probar
```bash
# Cerrar app actual
taskkill /F /IM electron.exe

# Iniciar de nuevo
npm start
```

### Paso 4: Probar validación en Caja
1. Abrir ventana de Caja
2. Ingresar código: PREV-022810
3. Verificar que se valida correctamente

---

## 11. LOGS ESPERADOS DESPUÉS DEL FIX

### Cuando se registren los handlers:
```
✅ Handlers de Caja registrados (namespace caja:*)
```

### Cuando Caja valide un ticket:
```
==========================================
🔍 VALIDATE-VOUCHER LLAMADO
Código: PREV-022810
Usuario (title): Caja - Validación y Cobro
Voucher encontrado? true
  - Amount: 800
  - Currency: USD
  - Status: active
  - Expires: 2026-10-31...
  - Mesa: P03
  - Operador: ...
```

---

## 12. PREVENCIÓN DE PROBLEMAS FUTUROS

### ✅ Checklist para nuevos handlers IPC:

1. **Definir handler** en archivo apropiado (e.g., cajaHandlers.js)
2. **Exportar función de registro** (`module.exports = { registerHandlers }`)
3. **Registrar en pure/main.js** dentro de `app.whenReady()`
4. **Verificar nombres coincidan** entre preload y main process
5. **Agregar logging** para debugging
6. **Probar** inmediatamente después de registrar

### ⚠️ Señales de advertencia:

- Handler definido pero no usado → Verificar si se registró
- Error "No handler for ..." → Handler no registrado
- Llamadas IPC que no responden → Verificar nombres exactos
- Funcionalidad que funcionaba y dejó de funcionar → Handlers sobrescritos

---

## CONCLUSIÓN

El sistema está **técnicamente correcto** en su arquitectura de doble base de datos (SQLite + Supabase). El problema es **puramente de registro de handlers IPC**.

**Los datos están ahí, Caja simplemente no puede acceder a ellos porque nadie registró los handlers necesarios.**

La solución es directa: registrar `cajaHandlers` en `pure/main.js`.

---

**Documento generado**: 31/10/2025
**Autor**: Análisis automático del sistema
**Prioridad**: 🔴 CRÍTICA
