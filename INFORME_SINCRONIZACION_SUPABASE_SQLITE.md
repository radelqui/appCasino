# 📊 INFORME: SINCRONIZACIÓN SUPABASE ↔ SQLite

**Fecha**: 31 de octubre de 2025
**Sistema**: appCasino - Sistema TITO
**Alcance**: Análisis completo de sincronización entre bases de datos

---

## RESUMEN EJECUTIVO

✅ **SÍ existe sincronización automática activa**

**Hallazgos principales**:
- Worker automático funciona cada 2 minutos
- Sincroniza **solo tickets/vouchers**
- Dirección principal: SQLite → Supabase (upload)
- Dirección secundaria: Supabase → SQLite (download bajo demanda)
- **NO sincroniza usuarios ni operadores**

---

## 1. SINCRONIZACIÓN AUTOMÁTICA (SQLite → Supabase)

### ✅ Worker Activo

**Ubicación**: `pure/main.js` líneas 2605-2697
**Inicialización**: Línea 2797 dentro de `app.whenReady()`
**Estado**: ✅ **ACTIVO Y FUNCIONANDO**

### Configuración del Worker

| Parámetro | Valor | Ubicación |
|-----------|-------|-----------|
| **Intervalo** | 2 minutos (120,000 ms) | Línea 2686 |
| **Estado** | Activo | Línea 2797 |
| **Inicio** | `startSyncWorker()` | Línea 2797 |
| **Detención** | `stopSyncWorker()` | Línea 2816 (before-quit) |
| **Variable global** | `syncWorkerInterval` | Línea 2608 |

### Algoritmo de Sincronización

```javascript
// Cada 2 minutos (líneas 2614-2686)
setInterval(async () => {
  // 1. VERIFICAR PRE-CONDICIONES
  if (!supabaseManager?.isAvailable()) return;
  if (!supabaseManager?.isConnected) return;
  if (!db?.db) return;

  // 2. BUSCAR TICKETS NO SINCRONIZADOS
  const pendingTickets = db.db.prepare(
    'SELECT * FROM tickets WHERE sincronizado = 0 ORDER BY created_at ASC'
  ).all();

  if (pendingTickets.length === 0) return;

  console.log(`🔄 [Sync Worker] Sincronizando ${pendingTickets.length} tickets...`);

  // 3. PROCESAR CADA TICKET
  for (const ticket of pendingTickets) {
    // 3.1. Subir a Supabase
    const result = await supabaseManager.createVoucher({
      voucher_code: ticket.code,
      amount: ticket.amount,
      currency: ticket.currency || 'USD',
      issued_by_user_id: currentSession?.user?.id || null,
      issued_at_station_id: ticket.mesa || ticket.mesa_nombre,
      status: ticket.estado === 'active' ? 'active' : 'redeemed',
      created_at: ticket.created_at,
      redeemed_at: ticket.redeemed_at || null
    });

    // 3.2. Marcar como sincronizado si exitoso
    if (result.success) {
      db.db.prepare('UPDATE tickets SET sincronizado = 1 WHERE id = ?')
        .run(ticket.id);
      console.log(`✅ [Sync Worker] Ticket ${ticket.code} sincronizado`);
    } else {
      console.warn(`⚠️  [Sync Worker] Fallo: ${ticket.code}`);
    }
  }

  // 4. NOTIFICAR A VENTANAS ABIERTAS
  if (successCount > 0 && mainWindow) {
    mainWindow.webContents.send('tickets-synced', { count: successCount });
  }
}, 2 * 60 * 1000);
```

### Pre-condiciones para Sincronización

El worker **SOLO** ejecuta si se cumplen **TODAS** estas condiciones:

1. ✅ `supabaseManager` está inicializado
2. ✅ `supabaseManager.isAvailable()` retorna `true`
3. ✅ `supabaseManager.isConnected` es `true`
4. ✅ `db` (SQLite) está inicializado
5. ✅ Existen tickets con columna `sincronizado = 0`

**Si falla alguna**: El worker hace `return` silencioso (sin error ni log)

### Logs del Worker

**Al iniciar la app**:
```
🔄 Iniciando worker de sincronización...
✅ Worker de sincronización iniciado (intervalo: 2 minutos)
```

**Durante sincronización (cada 2 min si hay pendientes)**:
```
🔄 [Sync Worker] Sincronizando 3 tickets pendientes...
✅ [Sync Worker] Ticket PREV-022810 sincronizado
✅ [Sync Worker] Ticket PREV-022811 sincronizado
⚠️  [Sync Worker] No se pudo sincronizar ticket PREV-022812: Network error
✅ [Sync Worker] Sincronización completada: 2 exitosos, 1 fallidos
```

**Al cerrar la app**:
```
🛑 Worker de sincronización detenido
```

### Mapeo de Datos: SQLite → Supabase

```
SQLite.tickets                →  Supabase.vouchers
─────────────────────────────────────────────────────────────
code                          →  voucher_code
amount                        →  amount
currency                      →  currency
estado                        →  status (mapeo: emitido→active, usado→redeemed)
mesa / mesa_nombre            →  issued_at_station_id
created_at / fecha_emision    →  created_at
fecha_cobro / redeemed_at     →  redeemed_at
created_by_user_id            →  issued_by_user_id
created_by_username           →  (no se sincroniza)
```

**Nota**: Después del upload exitoso, la columna `sincronizado` se actualiza de `0` → `1` en SQLite.

---

## 2. SINCRONIZACIÓN BAJO DEMANDA (Supabase → SQLite)

### ✅ Cache Inteligente Durante Validación

**Ubicación**: `pure/main.js` líneas 642-658
**Trigger**: Solo cuando se **valida** un voucher en Caja
**Estado**: ✅ **ACTIVO**

### Algoritmo de Download

```javascript
// Handler: validate-voucher (líneas 602-709)

// PASO 1: Buscar en Supabase primero
const supabaseResult = await supabaseManager.getVoucher(code);

if (supabaseResult.success && supabaseResult.data) {
  // PASO 2: Verificar si existe en SQLite local
  const existsLocal = db.getTicket(code);

  if (!existsLocal) {
    // PASO 3: NO existe localmente → Descargar como caché
    db.createTicket({
      code: rowData.code,
      amount: rowData.amount,
      currency: rowData.currency,
      mesa: mesaNombre,
      usuario_emision: operadorNombre
    });

    // PASO 4: Marcar como sincronizado
    db.db.prepare('UPDATE tickets SET estado = ?, sincronizado = 1 WHERE code = ?')
      .run(rowData.estado, code);

    console.log('💾 Voucher guardado en caché local desde Supabase');
  }
}
```

### Caso de Uso

**Escenario**: Ticket creado en otra terminal/dispositivo

1. Terminal A genera ticket PREV-999999 → Sube a Supabase ✅
2. Terminal B NO tiene ese ticket en SQLite local
3. Usuario en Terminal B valida PREV-999999 en Caja
4. Sistema busca en Supabase → ✅ Encontrado
5. Sistema verifica SQLite local → ❌ NO existe
6. **Sistema descarga y guarda en SQLite como caché** ✅
7. Próximas validaciones pueden funcionar offline

**Beneficio**: Cache local automático para tickets creados en otros lugares

---

## 3. QUÉ SE SINCRONIZA Y QUÉ NO

### ✅ TICKETS/VOUCHERS - Sincronización Bidireccional

| Dirección | Método | Frecuencia | Tabla SQLite | Tabla Supabase | Estado |
|-----------|--------|------------|--------------|----------------|--------|
| Upload | Worker automático | Cada 2 minutos | `tickets` | `vouchers` | ✅ Activo |
| Download | Bajo demanda | Al validar | `tickets` | `vouchers` | ✅ Activo |

**Flujo completo**:
```
Mesa genera ticket
    ↓
SQLite.tickets (sincronizado=0)
    ↓ (2 minutos después)
Supabase.vouchers
    ↓ (SQLite actualiza sincronizado=1)
SQLite.tickets (sincronizado=1)
```

**Flujo inverso**:
```
Otro dispositivo genera ticket
    ↓
Supabase.vouchers
    ↓ (usuario valida en este dispositivo)
SQLite.tickets (caché local)
```

### ❌ USUARIOS - SIN Sincronización

**Ubicación código**: `pure/main.js` líneas 1263-1344

**Al crear usuario** (handler `create-user`):

```javascript
// 1. ✅ Crear en Supabase Auth (auth.users)
const { data: authData } = await supabaseManager.client.auth.admin.createUser({
  email: userData.email,
  password: userData.password,
  email_confirm: true
});

// 2. ✅ Crear perfil en Supabase tabla 'users'
await supabaseManager.client
  .from('users')
  .upsert({
    id: authData.user.id,
    email: userData.email,
    full_name: userData.full_name,
    role: userData.role.toLowerCase(),
    pin_code: userData.pin_code || null,
    is_active: true
  });

// 3. ❌ NO se guarda en SQLite.usuarios
// NO hay código que inserte en SQLite
```

**Implicaciones**:
- Usuarios creados en la app **solo existen en Supabase**
- SQLite tabla `usuarios` es independiente (legacy o uso local)
- Si pierdes conexión a Supabase, no puedes crear usuarios nuevos
- Usuarios en SQLite.usuarios NO se suben a Supabase automáticamente

**Tablas involucradas**:

| Tabla | Ubicación | Uso Actual | Sincronización |
|-------|-----------|------------|----------------|
| `auth.users` | Supabase Auth | Autenticación (email/password) | ❌ No |
| `public.users` | Supabase PostgreSQL | Perfil (role, station, pin) | ❌ No |
| `usuarios` | SQLite local | Legacy / No usado | ❌ No |

### ❌ OPERADORES - SIN Sincronización

**Ubicación código**: `pure/main.js` líneas 1073-1124

**Al crear operador** (handler `create-operador`):

```javascript
// 1. ✅ Crear en Supabase tabla 'operadores'
const { data } = await supabaseManager.client
  .from('operadores')
  .insert({
    nombre: operadorData.nombre,
    activo: true,
    mesas_asignadas: operadorData.mesas || []
  });

// 2. ❌ NO se guarda en SQLite.operadores
// NO hay código que inserte en SQLite
```

**Implicaciones**:
- Operadores creados en la app **solo existen en Supabase**
- SQLite tabla `operadores` puede tener datos legacy independientes
- No hay sincronización bidireccional

**Tablas involucradas**:

| Tabla | Ubicación | Uso Actual | Sincronización |
|-------|-----------|------------|----------------|
| `operadores` | Supabase PostgreSQL | Operadores activos | ❌ No |
| `operadores` | SQLite local | Legacy / Datos independientes | ❌ No |

### ❌ AUDIT LOG - SIN Sincronización

**Ubicación código**: `pure/main.js` líneas 97-108

**Cuando se registra evento** (función `registrarAuditLog`):

```javascript
// ✅ Solo se guarda en Supabase
await supabaseManager.client
  .from('audit_log')
  .insert({
    event_type: eventType,
    user_id: userId || null,
    station_id: stationId || null,
    voucher_id: voucherId || null,
    details: details || {}
  });

// ❌ NO se guarda en SQLite.auditoria
```

**Implicaciones**:
- Todos los eventos de auditoría **solo en Supabase**
- SQLite tabla `auditoria` no se usa para eventos desde la app
- Si no hay conexión, eventos de auditoría se pierden

---

## 4. ARQUITECTURA DE SINCRONIZACIÓN

### Modelo Actual: Híbrido Offline-First

```
┌─────────────────────────────────────────────────────────────────┐
│                    ARQUITECTURA GENERAL                          │
└─────────────────────────────────────────────────────────────────┘

                    ┌──────────────────┐
                    │   USUARIO/MESA   │
                    └────────┬─────────┘
                             │
                    Genera ticket PREV-999999
                             │
                             ▼
            ╔════════════════════════════════════╗
            ║  SQLite Local (Offline-First)     ║
            ╠════════════════════════════════════╣
            ║  INSERT INTO tickets               ║
            ║  VALUES ('PREV-999999', ...)       ║
            ║  sincronizado = 0  ← PENDIENTE     ║
            ╚════════════════════════════════════╝
                             │
                             │ Worker automático
                             │ (cada 2 minutos)
                             │ if (sincronizado = 0)
                             ▼
            ╔════════════════════════════════════╗
            ║  Supabase Cloud (Source of Truth) ║
            ╠════════════════════════════════════╣
            ║  INSERT INTO vouchers              ║
            ║  VALUES ('PREV-999999', ...)       ║
            ║  status = 'active'                 ║
            ╚════════════════════════════════════╝
                             │
                             │ Update local
                             ▼
            ╔════════════════════════════════════╗
            ║  SQLite Local (Marcado)            ║
            ╠════════════════════════════════════╣
            ║  UPDATE tickets                    ║
            ║  SET sincronizado = 1  ← SYNCED    ║
            ║  WHERE code = 'PREV-999999'        ║
            ╚════════════════════════════════════╝


┌─────────────────────────────────────────────────────────────────┐
│              VALIDACIÓN (Download bajo demanda)                  │
└─────────────────────────────────────────────────────────────────┘

                    ┌──────────────────┐
                    │   CAJA/VALIDAR   │
                    └────────┬─────────┘
                             │
                    Valida código PREV-888888
                             │
                             ▼
            ╔════════════════════════════════════╗
            ║  Supabase Cloud (Buscar primero)  ║
            ╠════════════════════════════════════╣
            ║  SELECT * FROM vouchers            ║
            ║  WHERE voucher_code = 'PREV-888888'║
            ║  → ENCONTRADO ✅                   ║
            ╚════════════════════════════════════╝
                             │
                             ▼
            ╔════════════════════════════════════╗
            ║  SQLite Local (Verificar)          ║
            ╠════════════════════════════════════╣
            ║  SELECT * FROM tickets             ║
            ║  WHERE code = 'PREV-888888'        ║
            ║  → NO ENCONTRADO ❌                ║
            ╚════════════════════════════════════╝
                             │
                             │ Descargar como caché
                             ▼
            ╔════════════════════════════════════╗
            ║  SQLite Local (Cache)              ║
            ╠════════════════════════════════════╣
            ║  INSERT INTO tickets               ║
            ║  VALUES ('PREV-888888', ...)       ║
            ║  sincronizado = 1  ← YA EN CLOUD   ║
            ╚════════════════════════════════════╝
```

### Ventajas del Modelo

1. ✅ **Tolerancia a fallos**: Puede trabajar offline, sincroniza cuando hay conexión
2. ✅ **Rápido**: Writes locales instantáneos, sync en background
3. ✅ **Cache inteligente**: Descarga bajo demanda solo lo que necesita
4. ✅ **Resiliente**: Si Supabase cae, tickets siguen funcionando localmente
5. ✅ **Eventual consistency**: Todos los tickets eventualmente llegan a la nube

### Desventajas del Modelo

1. ⚠️ **Inconsistencias temporales**: SQLite puede tener datos viejos por 2 minutos
2. ⚠️ **Sin sincronización de usuarios/operadores**: Datos fragmentados
3. ⚠️ **Sin sincronización inversa completa**: No descarga TODO de Supabase
4. ⚠️ **Dependencia de timing**: Si app se cierra antes de 2 minutos, tickets no se sincronizan
5. ⚠️ **Sin resolución de conflictos**: No maneja ediciones simultáneas

---

## 5. TABLA COMPARATIVA COMPLETA

| Entidad | SQLite Tabla | Supabase Tabla | Sync Auto Upload | Sync Auto Download | Frecuencia Upload | Frecuencia Download |
|---------|--------------|----------------|------------------|-------------------|-------------------|---------------------|
| **Tickets/Vouchers** | `tickets` | `vouchers` | ✅ SÍ | ✅ SÍ (bajo demanda) | 2 minutos | Al validar |
| **Usuarios** | `usuarios` | `users` + `auth.users` | ❌ NO | ❌ NO | N/A | N/A |
| **Operadores** | `operadores` | `operadores` | ❌ NO | ❌ NO | N/A | N/A |
| **Audit Log** | `auditoria` | `audit_log` | ❌ NO | ❌ NO | N/A | N/A |
| **Configuración** | `configuracion` | N/A | ❌ NO | ❌ NO | N/A | N/A |

---

## 6. FLUJOS DE DATOS DETALLADOS

### Flujo 1: Generación de Ticket (Normal)

```
PASO 1: Usuario genera ticket en Mesa
  ├─ UI: pure/mesa.html
  ├─ IPC: generate-ticket
  └─ Handler: pure/main.js:361

PASO 2: Guardar en Supabase (PRIMERO)
  ├─ INSERT INTO vouchers (voucher_code, amount, ...)
  ├─ Resultado: success = true
  └─ Log: ✅ Ticket guardado en Supabase: PREV-999999

PASO 3: Guardar en SQLite (SEGUNDO)
  ├─ INSERT INTO tickets (code, amount, ...)
  ├─ sincronizado = 1 (porque Supabase exitoso)
  └─ Log: ✅ Ticket guardado en SQLite: PREV-999999 sincronizado: SI

PASO 4: Retornar resultado
  └─ { success: true, ticketCode: 'PREV-999999', syncedToCloud: true }
```

### Flujo 2: Generación de Ticket (Offline)

```
PASO 1: Usuario genera ticket en Mesa (sin conexión)
  ├─ UI: pure/mesa.html
  ├─ IPC: generate-ticket
  └─ Handler: pure/main.js:361

PASO 2: Intentar Supabase (FALLA)
  ├─ Supabase no disponible o sin conexión
  ├─ Resultado: success = false
  └─ Log: ⚠️ Error guardando en Supabase: Network error

PASO 3: Guardar en SQLite (caché local)
  ├─ INSERT INTO tickets (code, amount, ...)
  ├─ sincronizado = 0  ← PENDIENTE
  └─ Log: ✅ Ticket guardado en SQLite: PREV-999999 sincronizado: NO

PASO 4: Retornar resultado con warning
  └─ { success: true, ticketCode: 'PREV-999999', syncedToCloud: false,
       warning: 'Guardado en modo offline: Network error' }

PASO 5: Worker detecta pendiente (2 min después)
  ├─ SELECT * FROM tickets WHERE sincronizado = 0
  ├─ Encuentra PREV-999999
  └─ Sube a Supabase y marca sincronizado = 1
```

### Flujo 3: Validación de Ticket (Existe en ambos)

```
PASO 1: Usuario valida en Caja
  ├─ UI: Caja/panel.html
  ├─ IPC: caja:validate-voucher
  └─ Handler: Caja/cajaHandlers.js:103 (ahora registrado)

PASO 2: Buscar en Supabase
  ├─ SELECT * FROM vouchers WHERE voucher_code = 'PREV-999999'
  ├─ Resultado: ENCONTRADO
  └─ Log: ✅ Voucher encontrado en Supabase

PASO 3: Verificar caché local
  ├─ SELECT * FROM tickets WHERE code = 'PREV-999999'
  ├─ Resultado: ENCONTRADO (sincronizado = 1)
  └─ Log: Cache local existe, no se descarga

PASO 4: Validar estado
  ├─ status = 'active' → VÁLIDO
  └─ Retornar: { success: true, valid: true, voucher: {...} }
```

### Flujo 4: Validación de Ticket (Solo en Supabase)

```
PASO 1: Usuario valida en Caja (ticket creado en otro dispositivo)
  ├─ UI: Caja/panel.html
  ├─ IPC: caja:validate-voucher
  └─ Handler: Caja/cajaHandlers.js:103

PASO 2: Buscar en Supabase
  ├─ SELECT * FROM vouchers WHERE voucher_code = 'PREV-888888'
  ├─ Resultado: ENCONTRADO
  └─ Log: ✅ Voucher encontrado en Supabase

PASO 3: Verificar caché local
  ├─ SELECT * FROM tickets WHERE code = 'PREV-888888'
  ├─ Resultado: NO ENCONTRADO
  └─ Log: No existe en caché local

PASO 4: Descargar como caché (pure/main.js:642-658)
  ├─ INSERT INTO tickets (code, amount, ...)
  ├─ sincronizado = 1
  └─ Log: 💾 Voucher guardado en caché local desde Supabase

PASO 5: Validar estado
  ├─ status = 'active' → VÁLIDO
  └─ Retornar: { success: true, valid: true, voucher: {...}, source: 'cloud' }
```

---

## 7. MONITOREO Y LOGS

### Logs Importantes a Observar

**Inicio del sistema**:
```bash
✅ Electron cargado correctamente
✅ Health Monitor inicializado
✅ Supabase Manager inicializado y conectado
✅ Safe Database Operations inicializado
✅ Printer Service inicializado
✅ Handlers de caja registrados (namespace caja:*)  ← NUEVO
🔄 Iniciando worker de sincronización...
✅ Worker de sincronización iniciado (intervalo: 2 minutos)
```

**Generación de ticket (online)**:
```bash
📥 [generate-ticket] Datos recibidos: {valor: 100, moneda: 'USD', mesa_id: 'P03'}
🎫 Código generado desde DB: PREV-022810
☁️  [1/2] Guardando en Supabase (fuente de verdad)...
✅ Ticket guardado en Supabase: PREV-022810
💾 [2/2] Guardando en SQLite (caché local)...
✅ Ticket guardado en SQLite: PREV-022810 sincronizado: SI
✅ [generate-ticket] Completado
```

**Worker de sincronización (tickets pendientes)**:
```bash
🔄 [Sync Worker] Sincronizando 3 tickets pendientes...
✅ [Sync Worker] Ticket PREV-022807 sincronizado
✅ [Sync Worker] Ticket PREV-022808 sincronizado
✅ [Sync Worker] Ticket PREV-022809 sincronizado
✅ [Sync Worker] Sincronización completada: 3 exitosos, 0 fallidos
```

**Validación con cache download**:
```bash
📥 [validate-voucher] Validando código: PREV-888888
☁️  [1/2] Buscando voucher en Supabase (fuente de verdad)...
✅ Voucher encontrado en Supabase: PREV-888888
💾 Voucher guardado en caché local desde Supabase
✅ [validate-voucher] Ticket validado correctamente
```

### Comandos para Verificar Estado

**Verificar tickets pendientes de sincronizar**:
```bash
node -e "const db = require('better-sqlite3')('data/casino.db');
const pending = db.prepare('SELECT code, amount, sincronizado FROM tickets WHERE sincronizado = 0').all();
console.log('Pendientes:', pending.length);
console.log(pending);"
```

**Verificar último ticket en SQLite**:
```bash
node -e "const db = require('better-sqlite3')('data/casino.db');
const last = db.prepare('SELECT code, amount, sincronizado FROM tickets ORDER BY id DESC LIMIT 1').get();
console.log(last);"
```

**Verificar último ticket en Supabase**:
```bash
node -e "require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
sb.from('vouchers').select('voucher_code, amount, status').order('created_at', {ascending: false}).limit(1)
  .then(r => console.log(r.data));"
```

---

## 8. PROBLEMAS POTENCIALES Y SOLUCIONES

### Problema 1: Tickets no se sincronizan

**Síntomas**:
- Tickets con `sincronizado = 0` que no suben
- Worker no ejecuta

**Causas posibles**:
1. Supabase no disponible (`isAvailable()` = false)
2. Sin conexión de red (`isConnected` = false)
3. Worker detenido o no iniciado
4. Error en `createVoucher()` de Supabase

**Solución**:
```bash
# Verificar estado de Supabase
node -e "require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
sb.from('vouchers').select('count').limit(1)
  .then(r => console.log('Supabase OK:', !r.error));"

# Forzar sincronización manual
# Abrir app → Panel → Herramientas → "Sincronizar Ahora"
# O ejecutar handler: ipcRenderer.invoke('sync:force-sync')
```

### Problema 2: Tickets duplicados

**Síntomas**:
- Mismo código de ticket en Supabase múltiples veces
- Error: "duplicate key value violates unique constraint"

**Causas posibles**:
1. Worker intenta sincronizar un ticket que ya existe
2. Dos dispositivos generan el mismo código
3. Código no marcado como sincronizado después del upload

**Solución**:
- Verificar que `voucher_code` tenga constraint UNIQUE en Supabase
- Confirmar que UPDATE de `sincronizado = 1` se ejecuta
- Revisar generador de códigos en `Caja/database.js:136`

### Problema 3: Usuarios/Operadores no aparecen

**Síntomas**:
- Usuario creado en UI pero no aparece en otra terminal
- Operador no está disponible para asignar

**Causa**:
- Usuarios y operadores NO se sincronizan automáticamente
- Solo existen en Supabase, no en SQLite local

**Solución temporal**:
- Todos los dispositivos deben consultar Supabase para usuarios/operadores
- No confiar en SQLite local para estos datos

**Solución permanente** (requiere implementación):
- Crear workers de sincronización para usuarios y operadores
- O migrar completamente a Supabase (sin SQLite para estos datos)

### Problema 4: Worker consume mucha CPU/memoria

**Síntomas**:
- Electron lento cada 2 minutos
- Alto uso de memoria

**Causas posibles**:
1. Muchos tickets pendientes (miles)
2. Worker sincroniza todos en un solo ciclo
3. No hay límite en el query

**Solución**:
```javascript
// Modificar query para limitar cantidad (línea 2627)
const pendingTickets = db.db.prepare(
  'SELECT * FROM tickets WHERE sincronizado = 0 ORDER BY created_at ASC LIMIT 100'
).all();
```

---

## 9. MÉTRICAS Y ESTADÍSTICAS

### Métricas Recomendadas para Monitoreo

| Métrica | Query/Código | Valor Esperado |
|---------|--------------|----------------|
| **Tickets pendientes** | `SELECT COUNT(*) FROM tickets WHERE sincronizado = 0` | < 10 |
| **Tasa de éxito sync** | successCount / (successCount + errorCount) | > 95% |
| **Latencia de sync** | Tiempo desde creación hasta sincronizado = 1 | < 2 minutos |
| **Tickets en Supabase** | `SELECT COUNT(*) FROM vouchers` | Igual a sincronizados |
| **Tickets en SQLite** | `SELECT COUNT(*) FROM tickets` | >= tickets en Supabase |

### Handler para Obtener Estadísticas

**Ya existe** en `pure/main.js` líneas 2236-2278:

```javascript
ipcMain.handle('get-database-stats', async () => {
  // Estadísticas de SQLite
  const sqliteStats = {
    path: dbPath,
    size: fs.statSync(dbPath).size,
    tickets: db.db.prepare('SELECT COUNT(*) as count FROM tickets').get().count,
    pending: db.db.prepare('SELECT COUNT(*) as count FROM tickets WHERE sincronizado = 0').get().count
  };

  // Estadísticas de Supabase
  const supabaseStats = {
    vouchers: (await supabaseManager.client.from('vouchers').select('*', {count: 'exact', head: true})).count,
    users: (await supabaseManager.client.from('users').select('*', {count: 'exact', head: true})).count,
    operadores: (await supabaseManager.client.from('operadores').select('*', {count: 'exact', head: true})).count
  };

  return { sqlite: sqliteStats, supabase: supabaseStats };
});
```

---

## 10. RECOMENDACIONES

### Corto Plazo (Implementar Ya)

1. ✅ **Registrar handlers de Caja** (YA HECHO)
   - Líneas agregadas en pure/main.js:2738-2739
   - Permite que Caja valide tickets correctamente

2. 📊 **Agregar dashboard de sincronización**
   - Mostrar tickets pendientes en UI
   - Indicador de estado de conexión a Supabase
   - Botón "Sincronizar Ahora" manual

3. 🔔 **Alertas de sincronización**
   - Notificar si hay > 10 tickets pendientes
   - Alertar si worker no sincroniza en > 10 minutos

### Mediano Plazo (Próximas semanas)

4. 🔄 **Sincronizar usuarios y operadores**
   - Crear workers similares para usuarios
   - Agregar columna `sincronizado` en tablas correspondientes
   - Decidir: SQLite como caché o Supabase como única fuente

5. 📉 **Optimizar worker**
   - Limitar sincronización a 100 tickets por ciclo
   - Agregar backoff exponencial en caso de errores
   - Implementar priority queue (tickets urgentes primero)

6. 🔒 **Resolución de conflictos**
   - Agregar timestamps de última modificación
   - Implementar "last write wins" o merge strategy
   - Registrar conflictos en audit_log

### Largo Plazo (Arquitectura)

7. 🏗️ **Migración completa a Supabase**
   - Evaluar eliminar SQLite para usuarios/operadores
   - Usar Supabase como única fuente de verdad
   - SQLite solo para tickets (offline-first)

8. 📡 **Sincronización en tiempo real**
   - Implementar Supabase Realtime subscriptions
   - Actualizar UI cuando otros dispositivos crean tickets
   - Eliminar worker de 2 minutos (usar webhooks)

9. 🔐 **Backup y recuperación**
   - Backup automático de SQLite antes de sync
   - Recuperación desde Supabase si SQLite se corrompe
   - Export/import de datos entre ambos sistemas

---

## 11. CONCLUSIONES

### ✅ Fortalezas del Sistema Actual

1. **Offline-first para tickets**: Puede funcionar sin conexión
2. **Sincronización automática**: Worker confiable cada 2 minutos
3. **Cache inteligente**: Download bajo demanda optimiza tráfico
4. **Resiliente**: Tolera fallos de red temporales
5. **Simple**: Lógica de sincronización clara y mantenible

### ⚠️ Limitaciones Identificadas

1. **Sin sincronización de usuarios/operadores**: Datos fragmentados
2. **Sin sincronización inversa completa**: No descarga TODO de Supabase
3. **Latencia de 2 minutos**: Tickets pueden estar desactualizados
4. **Sin resolución de conflictos**: Asume single-writer
5. **Sin métricas**: Difícil monitorear salud del sistema

### 🎯 Estado General

El sistema de sincronización está **funcionando correctamente** para su caso de uso principal (tickets/vouchers). Sin embargo, la falta de sincronización de usuarios y operadores puede causar problemas en entornos multi-dispositivo.

**Prioridad Alta**: Implementar sincronización de usuarios/operadores o migrar completamente a Supabase para esos datos.

---

## ANEXOS

### A. Estructura de Tablas

**SQLite `tickets`**:
```sql
CREATE TABLE tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT CHECK(currency IN ('USD', 'DOP')),
  mesa TEXT,
  estado TEXT CHECK(estado IN ('activo', 'emitido', 'usado', 'cancelado', 'expirado')),
  fecha_emision DATETIME DEFAULT CURRENT_TIMESTAMP,
  fecha_cobro DATETIME,
  sincronizado INTEGER DEFAULT 0,  ← CLAVE PARA SYNC
  mesa_id INTEGER,
  created_by_user_id TEXT,
  created_by_username TEXT
);

CREATE INDEX idx_ticket_sincronizado ON tickets(sincronizado);
```

**Supabase `vouchers`**:
```sql
CREATE TABLE vouchers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  voucher_code TEXT UNIQUE NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT,
  status TEXT CHECK(status IN ('active', 'redeemed', 'cancelled', 'expired')),
  issued_at TIMESTAMPTZ DEFAULT NOW(),
  redeemed_at TIMESTAMPTZ,
  issued_by_user_id UUID REFERENCES users(id),
  issued_at_station_id BIGINT REFERENCES stations(id),
  mesa_nombre TEXT,
  qr_data TEXT,
  qr_hash TEXT
);

CREATE INDEX idx_voucher_code ON vouchers(voucher_code);
CREATE INDEX idx_voucher_status ON vouchers(status);
```

### B. Variables de Entorno Relevantes

```ini
# .env
USE_SUPABASE=true
SUPABASE_URL=https://elagvnnamabrjptovzyq.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
SQLITE_DB_PATH=C:\\appCasino\\data\\casino.db
```

---

**FIN DEL INFORME**

**Fecha**: 31/10/2025
**Versión**: 1.0
**Autor**: Análisis automático del sistema
**Próxima revisión**: Después de implementar sincronización de usuarios/operadores
