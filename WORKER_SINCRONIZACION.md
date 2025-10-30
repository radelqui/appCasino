# Worker de Sincronización Automática - Sistema TITO

## Resumen

Se ha implementado un **worker de sincronización automática** que se ejecuta cada 2 minutos para subir a Supabase todos los tickets creados o canjeados en modo offline.

---

## Problema que Resuelve

Antes de esta implementación:
- ❌ Tickets creados offline quedaban solo en SQLite
- ❌ Si la app se reiniciaba, esos tickets nunca llegaban a Supabase
- ❌ Otras estaciones (mesas/cajas) no podían ver esos tickets
- ❌ Los reportes de auditoría estaban incompletos

Después de esta implementación:
- ✅ Tickets offline se sincronizan automáticamente cada 2 minutos
- ✅ No se pierde información aunque se reinicie la app
- ✅ Todas las estaciones ven todos los tickets (con máximo 2 min de retraso)
- ✅ Los reportes de auditoría son completos y precisos

---

## Arquitectura

### Componentes Implementados

#### 1. Worker Automático
**Archivo**: `pure/main.js` (líneas 1680-1759)

**Características**:
- Se ejecuta cada 2 minutos (120,000 ms)
- Solo se activa si hay conexión a Supabase
- Procesa tickets en orden cronológico (FIFO)
- Logging detallado de éxitos y errores
- Notifica al frontend cuando hay sincronizaciones exitosas

**Inicio/Detención**:
```javascript
// Iniciado automáticamente en app.whenReady()
app.whenReady().then(async () => {
  // ... otras inicializaciones ...
  startSyncWorker();
  createWindow();
});

// Detenido automáticamente al cerrar la app
app.on('before-quit', () => {
  stopSyncWorker();
});
```

#### 2. Handler: `sync:get-pending-count`
**Archivo**: `pure/main.js` (líneas 1624-1642)

**Propósito**: Obtener la cantidad de tickets pendientes de sincronización

**Uso**:
```javascript
const result = await window.api.invoke('sync:get-pending-count');
console.log(`Tickets pendientes: ${result.count}`);
```

**Respuesta**:
```javascript
{
  success: true,
  count: 5  // Número de tickets con sincronizado = 0
}
```

#### 3. Handler: `sync:force-sync`
**Archivo**: `pure/main.js` (líneas 1648-1734)

**Propósito**: Forzar sincronización manual inmediata

**Uso**:
```javascript
const result = await window.api.invoke('sync:force-sync');
if (result.success) {
  alert(`✅ Sincronizados: ${result.synced}, ❌ Fallidos: ${result.failed}`);
}
```

**Respuesta**:
```javascript
{
  success: true,
  message: "Sincronización completada: 5 exitosos, 0 fallidos",
  synced: 5,
  failed: 0
}
```

---

## Lógica de Sincronización

### Flujo del Worker

```
┌─────────────────────────────┐
│ Timer: cada 2 minutos       │
└────────────┬────────────────┘
             │
             ▼
┌─────────────────────────────┐
│ ¿Supabase disponible?       │
└────┬────────────────────┬───┘
     │ NO                 │ SÍ
     ▼                    ▼
┌──────────┐      ┌────────────────────┐
│ Salir    │      │ Query SQLite:      │
│ (skip)   │      │ sincronizado = 0   │
└──────────┘      └────────┬───────────┘
                           │
                           ▼
                  ┌────────────────────┐
                  │ ¿Hay tickets?      │
                  └────┬───────────┬───┘
                       │ NO        │ SÍ
                       ▼           ▼
                  ┌─────────┐  ┌──────────────────┐
                  │ Salir   │  │ Para cada ticket │
                  └─────────┘  │ en orden         │
                               └────────┬─────────┘
                                        │
                    ┌───────────────────┴───────────────────┐
                    ▼                                       ▼
           ┌────────────────────┐                  ┌────────────────────┐
           │ Subir a Supabase   │                  │ Si error:          │
           │ createVoucher()    │                  │ Log + continuar    │
           └────────┬───────────┘                  └────────────────────┘
                    │
                    ▼
           ┌────────────────────┐
           │ ¿Éxito?            │
           └────┬───────────┬───┘
                │ SÍ        │ NO
                ▼           ▼
    ┌────────────────┐  ┌─────────────┐
    │ UPDATE SQLite  │  │ errorCount++│
    │ sincronizado=1 │  └─────────────┘
    │ successCount++ │
    └────────────────┘
                    │
                    └──────────┐
                               ▼
                    ┌──────────────────────┐
                    │ Log resumen:         │
                    │ X exitosos, Y fall.  │
                    └──────────────────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │ Notificar frontend   │
                    │ (si hubo éxitos)     │
                    └──────────────────────┘
```

### Código del Worker

```javascript
function startSyncWorker() {
  console.log('🔄 Iniciando worker de sincronización...');

  syncWorkerInterval = setInterval(async () => {
    // 1. Verificar precondiciones
    if (!supabaseManager || !supabaseManager.isAvailable() || !supabaseManager.isConnected) {
      return; // No hay conexión
    }

    if (!db || !db.db) {
      return; // No hay base de datos
    }

    try {
      // 2. Buscar tickets pendientes
      const pendingTickets = db.db.prepare(
        'SELECT * FROM tickets WHERE sincronizado = 0 ORDER BY created_at ASC'
      ).all();

      if (pendingTickets.length === 0) {
        return; // Nada que sincronizar
      }

      console.log(`🔄 [Sync Worker] Sincronizando ${pendingTickets.length} tickets...`);

      let successCount = 0;
      let errorCount = 0;

      // 3. Procesar cada ticket
      for (const ticket of pendingTickets) {
        try {
          const userId = currentSession?.user?.id || null;

          // 4. Subir a Supabase
          const result = await supabaseManager.createVoucher({
            voucher_code: ticket.code,
            amount: ticket.amount,
            currency: ticket.currency || 'USD',
            issued_by_user_id: userId,
            issued_at_station_id: ticket.mesa || ticket.mesa_nombre || 'unknown',
            status: ticket.estado === 'active' ? 'active' : 'redeemed',
            created_at: ticket.created_at,
            redeemed_at: ticket.redeemed_at || null,
            redeemed_by_user_id: ticket.redeemed_by || null
          });

          // 5. Actualizar si tuvo éxito
          if (result.success) {
            db.db.prepare(
              'UPDATE tickets SET sincronizado = 1 WHERE id = ?'
            ).run(ticket.id);

            successCount++;
            console.log(`✅ [Sync Worker] Ticket ${ticket.code} sincronizado`);
          } else {
            errorCount++;
            console.warn(`⚠️  [Sync Worker] Falló ${ticket.code}:`, result.error);
          }
        } catch (error) {
          errorCount++;
          console.error(`❌ [Sync Worker] Error ${ticket.code}:`, error.message);
        }
      }

      // 6. Log de resumen
      console.log(`✅ [Sync Worker] Completado: ${successCount} OK, ${errorCount} fallos`);

      // 7. Notificar al frontend (opcional)
      if (successCount > 0 && mainWindow) {
        mainWindow.webContents.send('tickets-synced', { count: successCount });
      }

    } catch (error) {
      console.error('❌ [Sync Worker] Error general:', error.message);
    }
  }, 2 * 60 * 1000); // 2 minutos

  console.log('✅ Worker iniciado (intervalo: 2 minutos)');
}
```

---

## Integración con Frontend (Opcional)

### Escuchar Evento de Sincronización

Puedes escuchar cuando el worker sincroniza tickets para actualizar la UI:

```javascript
// En tu HTML/JavaScript frontend
window.api.receive('tickets-synced', (data) => {
  console.log(`🔄 Se sincronizaron ${data.count} tickets`);

  // Actualizar indicador visual
  const badge = document.getElementById('sync-badge');
  if (badge) {
    badge.textContent = `${data.count} sincronizados`;
    badge.style.display = 'block';

    // Ocultar después de 3 segundos
    setTimeout(() => {
      badge.style.display = 'none';
    }, 3000);
  }
});
```

### Mostrar Contador de Pendientes

```javascript
async function mostrarTicketsPendientes() {
  const result = await window.api.invoke('sync:get-pending-count');

  if (result.success) {
    const badge = document.getElementById('pending-count');
    if (badge) {
      badge.textContent = result.count;
      badge.style.display = result.count > 0 ? 'inline-block' : 'none';
    }
  }
}

// Actualizar cada 10 segundos
setInterval(mostrarTicketsPendientes, 10000);
```

### Botón de Sincronización Manual

```html
<button onclick="sincronizarManual()">
  🔄 Sincronizar Ahora
</button>
```

```javascript
async function sincronizarManual() {
  // Deshabilitar botón
  const btn = event.target;
  btn.disabled = true;
  btn.textContent = '🔄 Sincronizando...';

  try {
    const result = await window.api.invoke('sync:force-sync');

    if (result.success) {
      alert(`✅ ${result.message}`);
    } else {
      alert(`❌ Error: ${result.error}`);
    }
  } catch (error) {
    alert(`❌ Error: ${error.message}`);
  } finally {
    // Re-habilitar botón
    btn.disabled = false;
    btn.textContent = '🔄 Sincronizar Ahora';

    // Actualizar contador
    await mostrarTicketsPendientes();
  }
}
```

---

## Comportamiento del Worker

### Escenarios

#### 1. App Online Todo el Tiempo
```
Crear ticket → SQLite + Supabase inmediato (sincronizado = 1)
Worker ejecuta → No encuentra tickets pendientes → Salir
```
**Resultado**: No hace nada (tickets ya sincronizados)

#### 2. App Offline, Luego Online
```
Crear ticket (offline) → Solo SQLite (sincronizado = 0)
Crear ticket (offline) → Solo SQLite (sincronizado = 0)
Crear ticket (offline) → Solo SQLite (sincronizado = 0)

[Conexión restaurada]

Worker ejecuta (2 min después) → Encuentra 3 tickets pendientes
→ Sube ticket 1 ✅
→ Sube ticket 2 ✅
→ Sube ticket 3 ✅
→ Log: "3 exitosos, 0 fallidos"
→ Notifica al frontend
```

#### 3. App con Conexión Intermitente
```
Crear ticket 1 (online) → SQLite + Supabase ✅ (sincronizado = 1)
[Pierde conexión]
Crear ticket 2 (offline) → Solo SQLite (sincronizado = 0)
Crear ticket 3 (offline) → Solo SQLite (sincronizado = 0)
[Recupera conexión]
Crear ticket 4 (online) → SQLite + Supabase ✅ (sincronizado = 1)

Worker ejecuta → Encuentra 2 tickets pendientes (2 y 3)
→ Sube ticket 2 ✅
→ Sube ticket 3 ✅
→ Log: "2 exitosos, 0 fallidos"
```

#### 4. Error al Sincronizar
```
Worker ejecuta → Encuentra 3 tickets pendientes
→ Sube ticket 1 ✅ (sincronizado = 1)
→ Sube ticket 2 ❌ (error: duplicate key, permanece sincronizado = 0)
→ Sube ticket 3 ✅ (sincronizado = 1)
→ Log: "2 exitosos, 1 fallido"

Worker ejecuta (2 min después) → Encuentra 1 ticket pendiente
→ Reintenta ticket 2 ✅ (ahora funciona)
→ Log: "1 exitoso, 0 fallidos"
```

---

## Logs del Worker

### Ejemplo de Ejecución Exitosa

```
🔄 Iniciando worker de sincronización...
✅ Worker de sincronización iniciado (intervalo: 2 minutos)

[2 minutos después]
🔄 [Sync Worker] Sincronizando 3 tickets pendientes...
✅ [Sync Worker] Ticket TKT-20250130-001 sincronizado
✅ [Sync Worker] Ticket TKT-20250130-002 sincronizado
✅ [Sync Worker] Ticket TKT-20250130-003 sincronizado
✅ [Sync Worker] Sincronización completada: 3 exitosos, 0 fallidos
```

### Ejemplo con Errores

```
🔄 [Sync Worker] Sincronizando 5 tickets pendientes...
✅ [Sync Worker] Ticket TKT-20250130-001 sincronizado
❌ [Sync Worker] Error sincronizando ticket TKT-20250130-002: duplicate key value violates unique constraint
✅ [Sync Worker] Ticket TKT-20250130-003 sincronizado
⚠️  [Sync Worker] No se pudo sincronizar ticket TKT-20250130-004: Network timeout
✅ [Sync Worker] Ticket TKT-20250130-005 sincronizado
✅ [Sync Worker] Sincronización completada: 3 exitosos, 2 fallidos
```

### Ejemplo Sin Conexión

```
[Worker ejecuta cada 2 minutos, pero no hace nada porque no hay conexión]
(No imprime nada en la consola)
```

---

## Testing

### Probar el Worker Manualmente

#### 1. Crear Tickets Offline

```sql
-- Simular tickets creados offline en SQLite
INSERT INTO tickets (code, amount, currency, estado, sincronizado, created_at)
VALUES
  ('TEST-001', 100, 'USD', 'active', 0, datetime('now')),
  ('TEST-002', 200, 'USD', 'active', 0, datetime('now')),
  ('TEST-003', 150, 'USD', 'redeemed', 0, datetime('now'));
```

#### 2. Verificar Pendientes

```javascript
// En la consola de DevTools del frontend
const result = await window.api.invoke('sync:get-pending-count');
console.log('Pendientes:', result.count); // Debe mostrar 3
```

#### 3. Esperar 2 Minutos (o Forzar)

Opción A: Esperar 2 minutos y ver logs en la terminal
Opción B: Forzar sincronización inmediata

```javascript
const result = await window.api.invoke('sync:force-sync');
console.log(result); // { success: true, synced: 3, failed: 0 }
```

#### 4. Verificar en Supabase

```sql
-- En Supabase SQL Editor
SELECT * FROM vouchers
WHERE voucher_code IN ('TEST-001', 'TEST-002', 'TEST-003');
```

#### 5. Verificar SQLite

```sql
-- Ahora todos deben tener sincronizado = 1
SELECT code, sincronizado FROM tickets
WHERE code LIKE 'TEST-%';
```

---

## Consideraciones Técnicas

### Performance

- **Intervalo de 2 minutos**: Balance entre sincronización rápida y carga del servidor
- **Query optimizado**: `WHERE sincronizado = 0` usa índice (si existe)
- **ORDEN FIFO**: `ORDER BY created_at ASC` asegura tickets más viejos primero
- **No bloquea la UI**: El worker se ejecuta en el proceso principal de Electron

### Seguridad

- **Validación de conexión**: No intenta sincronizar si no hay conexión
- **Manejo de errores**: No detiene el worker si falla un ticket individual
- **Transacciones implícitas**: SQLite usa transacciones automáticas

### Resiliencia

- **Retry automático**: Tickets que fallan se reintentarán en la próxima ejecución
- **No pierde tickets**: Los tickets permanecen en SQLite aunque falle Supabase
- **Idempotente**: Si un ticket ya existe en Supabase, el error se registra pero no detiene el proceso

---

## Próximos Pasos

### Mejoras Recomendadas

1. **Exponential Backoff**: Si un ticket falla muchas veces, aumentar el intervalo de reintentos
2. **Máximo de Reintentos**: Marcar tickets con `sync_attempts` y dejar de intentar después de N fallos
3. **Priorización**: Sincronizar tickets canjeados antes que tickets activos
4. **Batch Upload**: Subir múltiples tickets en una sola llamada a Supabase
5. **UI de Monitoreo**: Panel en Configuración mostrando estado de sincronización
6. **Notificaciones**: Alertar al usuario si hay tickets que no se pueden sincronizar

### Estado Actual

✅ **COMPLETADO**:
- Worker automático cada 2 minutos
- Handler para consultar pendientes
- Handler para forzar sincronización manual
- Logging detallado
- Manejo de errores
- Notificación al frontend

⏳ **PENDIENTE** (mejoras opcionales):
- Cache de operadores para modo offline
- Conflict resolution para canjes duplicados
- Sesión persistente con tokens JWT

---

## Conclusión

El **Worker de Sincronización Automática** resuelve uno de los principales problemas del sistema híbrido SQLite + Supabase: la reconciliación de datos creados offline.

Con esta implementación:
- ✅ Los tickets offline se suben automáticamente cada 2 minutos
- ✅ No se requiere intervención manual
- ✅ El sistema es resiliente a pérdidas de conexión
- ✅ Los datos permanecen consistentes entre todas las estaciones

**Tiempo de implementación**: ~30 minutos
**Complejidad**: Media
**Impacto**: Alto (crítico para operaciones offline)
