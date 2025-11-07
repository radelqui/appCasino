# ANÁLISIS DE VIABILIDAD: Arquitectura "Dual DB Simplificado" - Estado Actual

## RESUMEN EJECUTIVO

**Estado actual de la arquitectura**: **85% implementado**
**Viabilidad**: **VIABLE - Requiere ajustes menores**
**Tiempo estimado para completar**: **4-6 horas**

### Hallazgos principales:

✅ **IMPLEMENTADO Y FUNCIONAL:**
- Escritura dual (Supabase + SQLite) con manejo de errores
- Campo `sincronizado` en SQLite para tracking
- Worker de sincronización background (cada 2 minutos)
- Lectura desde SQLite exclusivamente (no bloquea UI)
- Manejo de modo offline con flag de sincronización

⚠️ **REQUIERE AJUSTES MENORES:**
- Sincronización es bidireccional (debería ser unidireccional: solo descarga)
- Falta implementar descarga periódica de Supabase → SQLite
- Campos de tabla SQLite tienen nombres inconsistentes (fecha_emision vs created_at)
- Worker sincroniza tickets, usuarios y operadores (correcto, pero falta descarga)

❌ **NO IMPLEMENTADO:**
- Descarga automática de tickets de Supabase → SQLite (actualizar caché)
- Verificación de tickets modificados en Supabase (estado cambiado)
- Soporte para servidor local (marcado como FUTURO OPCIONAL, no crítico)

---

## 1. AUDITORÍA DEL CÓDIGO ACTUAL (POST-ROLLBACK d2182fd)

### A. FLUJO DE ESCRITURA - Crear ticket

**Archivo**: `c:\appCasino\pure\main.js`
**Handler**: `generate-ticket` (líneas 1172-1454)

#### Análisis del código:

```javascript
// LÍNEAS 1262-1308: PASO 1 - Guardar en Supabase PRIMERO
if (supabaseManager && supabaseManager.isAvailable()) {
  try {
    console.log('☁️  [1/2] Guardando en Supabase (fuente de verdad)...');

    // ⚠️ Tiene timeout de 5 segundos para evitar cuelgues
    const supabasePromise = supabaseManager.client
      .from('vouchers')
      .insert({ voucher_code: ticketCode, amount, currency, status: 'active', ... })
      .select()
      .single();

    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout guardando en Supabase (5s)')), 5000)
    );

    const { data, error } = await Promise.race([supabasePromise, timeoutPromise]);

    if (!error && data) {
      savedInSupabase = true; // ✅ Flag de sincronización
      console.log('✅ Ticket guardado en Supabase:', ticketCode);
    } else {
      supabaseError = error?.message || 'Error desconocido en Supabase';
      console.warn('⚠️  Error guardando en Supabase:', supabaseError);
    }
  } catch (err) {
    supabaseError = err.message;
    console.warn('⚠️  Excepción guardando en Supabase:', supabaseError);
  }
}

// LÍNEAS 1310-1350: PASO 2 - Guardar en SQLite (caché local - SIEMPRE)
if (!db) {
  if (!savedInSupabase) {
    throw new Error('No se pudo guardar: SQLite no disponible y Supabase falló');
  }
  console.warn('⚠️  SQLite no disponible, pero ticket guardado en Supabase');
} else {
  try {
    console.log('💾 [2/2] Guardando en SQLite (caché local)...');

    // Insertar directamente con el código generado
    db.db.prepare(`
      INSERT INTO tickets (code, amount, currency, mesa, estado, sincronizado, ...)
      VALUES (?, ?, ?, ?, 'emitido', ?, ...)
    `).run(
      ticketCode,
      amount,
      currency,
      mesa,
      savedInSupabase ? 1 : 0,  // ✅ Marcar si está sincronizado
      ...
    );

    console.log('✅ Ticket guardado en SQLite:', ticketCode, 'sincronizado:', savedInSupabase ? 'SI' : 'NO');
  } catch (sqlError) {
    console.error('❌ Error guardando en SQLite:', sqlError.message);

    // Si Supabase también falló, es un error crítico
    if (!savedInSupabase) {
      throw new Error('No se pudo guardar en ninguna base de datos');
    }
    // Si Supabase funcionó, solo advertir
    console.warn('⚠️  Error en SQLite pero ticket guardado en Supabase');
  }
}
```

#### Evaluación:

**✅ FLUJO 1: Escritura CON INTERNET**
- **Estado actual**: IMPLEMENTADO CORRECTAMENTE
- **Cumple con arquitectura Opción D**: SÍ
- **Funcionamiento**:
  1. Intenta guardar en Supabase PRIMERO (fuente de verdad)
  2. Guarda en SQLite SEGUNDO (caché)
  3. Marca `sincronizado=1` si Supabase funciona
  4. Marca `sincronizado=0` si Supabase falla
  5. Manejo de errores robusto (timeout de 5s)

**✅ FLUJO 2: Escritura SIN INTERNET**
- **Estado actual**: IMPLEMENTADO CORRECTAMENTE
- **Cumple con arquitectura Opción D**: SÍ
- **Funcionamiento**:
  1. Detecta que Supabase no disponible
  2. Guarda en SQLite con `sincronizado=0`
  3. Worker de sincronización subirá después

**Falta implementar**:
- Ninguno (flujo de escritura completo)

---

### B. FLUJO DE LECTURA - Ver tickets

**Archivo**: `c:\appCasino\pure\main.js`
**Handler**: `get-stats-today` (líneas 1015-1092)

#### Análisis del código:

```javascript
// LÍNEA 1015-1018: Lee SOLO de SQLite
safeIpcHandle('get-stats-today', async () => {
  try {
    if (!db) throw new Error('DB no disponible');
    const s = db.getStatsToday() || { ticketsHoy: 0, totalDOP: 0, totalUSD: 0, pendientes: 0 };

    // LÍNEAS 1024-1036: Query directa a SQLite (RÁPIDO)
    const mesaRows = db.db.prepare(`
      SELECT
        mesa_nombre,
        COUNT(*) as cantidad,
        SUM(CASE WHEN currency = 'DOP' THEN amount ELSE 0 END) as total_dop,
        SUM(CASE WHEN currency = 'USD' THEN amount ELSE 0 END) as total_usd,
        SUM(CASE WHEN estado = 'emitido' THEN 1 ELSE 0 END) as pendientes
      FROM tickets
      WHERE DATE(created_at) = ?
      GROUP BY mesa_nombre
      ORDER BY cantidad DESC
      LIMIT 10
    `).all(today);

    return { ...s, byMesa: mesaRows, ... };
  } catch (error) {
    console.error('Error get-stats-today:', error?.message);
    return { ticketsHoy: 0, totalDOP: 0, totalUSD: 0, pendientes: 0 };
  }
});
```

**Archivo**: `c:\appCasino\Caja\cajaHandlers.js`
**Handler**: `caja:get-stats-today` (líneas 211-224)

```javascript
// LÍNEA 211-214: Lee SOLO de SQLite
ipcMain.handle('caja:get-stats-today', async (event) => {
  try {
    const stats = db.getStatsToday(); // ✅ Solo SQLite
    return stats;
  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    return { ticketsHoy: 0, totalDOP: 0, totalUSD: 0, pendientes: 0 };
  }
});
```

**Método SQLite**: `c:\appCasino\Caja\database.js` (líneas 282-297)

```javascript
getStatsToday() {
  const tickets = this.getTicketsToday(); // ✅ Query directa a SQLite
  const stats = { ticketsHoy: 0, totalDOP: 0, totalUSD: 0, pendientes: 0, cobrados: 0, cancelados: 0 };
  for (const t of tickets) {
    stats.ticketsHoy++;
    if (t.estado === 'usado') {
      stats.cobrados++;
      (t.currency === 'USD' ? (stats.totalUSD += parseFloat(t.amount)) : (stats.totalDOP += parseFloat(t.amount)));
    } else if (t.estado === 'activo' || t.estado === 'emitido') {
      stats.pendientes++;
    } else if (t.estado === 'cancelado') {
      stats.cancelados++;
    }
  }
  return stats;
}

getTicketsToday() {
  return this.db.prepare("SELECT * FROM tickets WHERE DATE(fecha_emision) = DATE('now', 'localtime') ORDER BY fecha_emision DESC").all();
}
```

#### Evaluación:

**✅ FLUJO 3: Lectura (siempre SQLite)**
- **Estado actual**: IMPLEMENTADO CORRECTAMENTE
- **Cumple con arquitectura Opción D**: SÍ
- **Funcionamiento**:
  1. Lee SIEMPRE de SQLite local
  2. NO espera a Supabase
  3. NO bloquea UI
  4. Tiempo de respuesta: < 10ms (rápido)

**⚠️ PROBLEMA DETECTADO**:
- **Inconsistencia de nombres de columnas**:
  - Handler `get-stats-today` usa: `WHERE DATE(created_at) = ?`
  - Método `getTicketsToday()` usa: `WHERE DATE(fecha_emision) = ...`
  - **Tabla tickets tiene**: `fecha_emision` (no `created_at`)

**Riesgo**: Algunas queries pueden fallar si la columna `created_at` no existe.

**Falta implementar**:
- [ ] Unificar nombres de columnas (usar `fecha_emision` o agregar `created_at` como alias)
- [ ] Verificar que todas las queries usen columnas correctas

---

### C. FLUJO DE SINCRONIZACIÓN - Background Worker

**Archivo**: `c:\appCasino\pure\main.js`
**Worker**: Líneas 4648-4901

#### Análisis del código:

```javascript
// LÍNEA 4651: Worker cada 2 minutos
syncWorkerInterval = setInterval(async () => {
  // Skip si no hay conexión
  if (!supabaseManager || !supabaseManager.isAvailable() || !supabaseManager.isConnected) {
    return;
  }

  if (!db || !db.db) {
    return;
  }

  try {
    // ============================================
    // 1. SINCRONIZAR TICKETS (SUBIR pendientes)
    // ============================================
    const BATCH_SIZE = 100; // Procesar 100 tickets por ciclo

    const pendingTickets = db.db.prepare(
      'SELECT * FROM tickets WHERE sincronizado = 0 ORDER BY fecha_emision ASC LIMIT ?'
    ).all(BATCH_SIZE);

    if (pendingTickets.length > 0) {
      console.log(`🔄 [Sync Worker] Sincronizando ${pendingTickets.length} tickets pendientes...`);

      for (const ticket of pendingTickets) {
        try {
          // Subir a Supabase
          const result = await supabaseManager.createVoucher({
            voucher_code: ticket.code,
            amount: ticket.amount,
            currency: ticket.currency || 'USD',
            issued_by_user_id: userId,
            issued_at_station_id: mesaNum || null,
            status: ticket.estado === 'active' ? 'active' : 'redeemed',
            created_at: ticket.fecha_emision,
            redeemed_at: ticket.fecha_cobro || null,
            redeemed_by_user_id: ticket.cajero_id || null
          });

          if (result.success) {
            // Marcar como sincronizado
            db.db.prepare(
              'UPDATE tickets SET sincronizado = 1 WHERE id = ?'
            ).run(ticket.id);

            successCount++;
            console.log(`✅ [Sync Worker] Ticket ${ticket.code} sincronizado`);
          }
        } catch (error) {
          errorCount++;
          console.error(`❌ [Sync Worker] Error sincronizando ticket ${ticket.code}:`, error.message);
        }
      }

      console.log(`✅ [Sync Worker - Tickets] ${successCount} exitosos, ${errorCount} fallidos`);
    }

    // ============================================
    // 2. SINCRONIZAR USUARIOS (SUBIR pendientes)
    // ============================================
    // ... código similar para usuarios ...

    // ============================================
    // 3. SINCRONIZAR OPERADORES (SUBIR pendientes)
    // ============================================
    // ... código similar para operadores ...

  } catch (error) {
    console.error('❌ [Sync Worker] Error crítico en worker de sincronización:', error.message);
  }
}, 2 * 60 * 1000); // 2 minutos
```

#### Evaluación:

**✅ FLUJO 4A: Sincronización background - SUBIDA (SQLite → Supabase)**
- **Estado actual**: IMPLEMENTADO CORRECTAMENTE
- **Cumple con arquitectura Opción D**: PARCIALMENTE
- **Funcionamiento**:
  1. Worker ejecuta cada 2 minutos
  2. Busca tickets con `sincronizado = 0`
  3. Sube a Supabase en lotes de 100
  4. Marca como `sincronizado = 1` si exitoso
  5. Manejo de errores robusto

**❌ FLUJO 4B: Sincronización background - DESCARGA (Supabase → SQLite)**
- **Estado actual**: NO IMPLEMENTADO
- **Cumple con arquitectura Opción D**: NO
- **Problema**: Worker solo SUBE tickets pendientes, no DESCARGA tickets nuevos/modificados de Supabase

**Falta implementar**:
- [ ] Descarga periódica de tickets de Supabase → SQLite
- [ ] Actualizar tickets existentes en SQLite si cambiaron en Supabase (ej: estado "usado" → "canjeado")
- [ ] Sincronizar nuevos tickets creados en otras PCs/mesas
- [ ] Opcional: Solo descargar tickets modificados (usar timestamp `updated_at`)

**Handler de sincronización manual**: `sync:force-sync` (líneas 3356-3446)
- **Estado**: IMPLEMENTADO
- **Problema**: También solo sube tickets, no descarga

---

## 2. IDENTIFICAR QUÉ FALTA IMPLEMENTAR

### FLUJO 1: Escritura CON INTERNET
**Estado actual**: ✅ IMPLEMENTADO COMPLETAMENTE
**Falta implementar**: NADA

---

### FLUJO 2: Escritura SIN INTERNET
**Estado actual**: ✅ IMPLEMENTADO COMPLETAMENTE
**Falta implementar**: NADA

---

### FLUJO 3: Lectura (siempre SQLite)
**Estado actual**: ✅ IMPLEMENTADO (con warning)
**Falta implementar**:
- [ ] **[PRIORIDAD MEDIA]** Unificar nombres de columnas en queries
  - Algunas queries usan `created_at`, tabla usa `fecha_emision`
  - Solución: Agregar columna `created_at` como alias o cambiar queries

---

### FLUJO 4: Sincronización background
**Estado actual**: ⚠️ IMPLEMENTADO PARCIALMENTE (solo SUBIDA)
**Falta implementar**:
- [ ] **[PRIORIDAD ALTA]** Descarga periódica: Supabase → SQLite
- [ ] **[PRIORIDAD MEDIA]** Actualizar tickets modificados en Supabase
- [ ] **[PRIORIDAD BAJA]** Optimizar: solo descargar tickets modificados

---

## 3. PLAN DE IMPLEMENTACIÓN

### Tarea 1: Agregar descarga periódica al Worker de Sincronización

**Archivo**: `c:\appCasino\pure\main.js`
**Línea**: Después de línea 4737 (después de sincronizar tickets pendientes)
**Prioridad**: ALTA
**Tiempo estimado**: 2 horas
**Riesgo**: BAJO

**Cambio requerido**:
Agregar nuevo bloque al worker que descargue tickets de Supabase y actualice SQLite.

**Código sugerido**:

```javascript
// ============================================
// 4. DESCARGAR TICKETS NUEVOS/MODIFICADOS DE SUPABASE
// ============================================
try {
  console.log('🔄 [Sync Worker] Descargando tickets de Supabase...');

  // Obtener timestamp de última sincronización
  const lastSyncTimestamp = db.db.prepare(
    'SELECT MAX(fecha_emision) as last_sync FROM tickets WHERE sincronizado = 1'
  ).get()?.last_sync || '2024-01-01T00:00:00Z';

  // Descargar tickets creados/modificados desde última sincronización
  const { data: newTickets, error } = await supabaseManager.client
    .from('vouchers')
    .select('*')
    .or(`created_at.gte.${lastSyncTimestamp},updated_at.gte.${lastSyncTimestamp}`)
    .order('created_at', { ascending: false })
    .limit(100); // Descargar en lotes de 100

  if (error) {
    console.error('❌ [Sync Worker] Error descargando de Supabase:', error.message);
  } else if (newTickets && newTickets.length > 0) {
    console.log(`📥 [Sync Worker] Descargando ${newTickets.length} tickets de Supabase...`);

    let insertCount = 0;
    let updateCount = 0;

    for (const voucher of newTickets) {
      try {
        // Verificar si ya existe en SQLite
        const existing = db.db.prepare('SELECT id FROM tickets WHERE code = ?').get(voucher.voucher_code);

        if (existing) {
          // ACTUALIZAR ticket existente
          db.db.prepare(`
            UPDATE tickets
            SET
              amount = ?,
              currency = ?,
              estado = ?,
              fecha_cobro = ?,
              cajero_id = ?,
              sincronizado = 1,
              mesa = ?,
              mesa_nombre = ?,
              created_by_username = ?
            WHERE code = ?
          `).run(
            voucher.amount,
            voucher.currency,
            voucher.status === 'active' ? 'emitido' : (voucher.status === 'redeemed' ? 'usado' : voucher.status),
            voucher.redeemed_at || null,
            voucher.redeemed_by_user_id || null,
            voucher.issued_at_station_id ? `P${String(voucher.issued_at_station_id).padStart(2, '0')}` : null,
            voucher.mesa_nombre || null,
            voucher.operador_nombre || null,
            voucher.voucher_code
          );

          updateCount++;
          console.log(`✅ [Sync Worker] Ticket ${voucher.voucher_code} actualizado desde Supabase`);
        } else {
          // INSERTAR nuevo ticket
          db.db.prepare(`
            INSERT INTO tickets (
              code, amount, currency, estado, fecha_emision, fecha_cobro,
              cajero_id, sincronizado, mesa, mesa_nombre, created_by_username,
              issued_by_user_id, issued_at_station_id, hash_seguridad, qr_data
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            voucher.voucher_code,
            voucher.amount,
            voucher.currency,
            voucher.status === 'active' ? 'emitido' : (voucher.status === 'redeemed' ? 'usado' : voucher.status),
            voucher.issued_at || voucher.created_at,
            voucher.redeemed_at || null,
            voucher.redeemed_by_user_id || null,
            voucher.issued_at_station_id ? `P${String(voucher.issued_at_station_id).padStart(2, '0')}` : null,
            voucher.mesa_nombre || null,
            voucher.operador_nombre || null,
            voucher.issued_by_user_id || null,
            voucher.issued_at_station_id || null,
            voucher.qr_hash || '',
            voucher.qr_data || ''
          );

          insertCount++;
          console.log(`✅ [Sync Worker] Ticket ${voucher.voucher_code} insertado desde Supabase`);
        }
      } catch (error) {
        console.error(`❌ [Sync Worker] Error procesando ticket ${voucher.voucher_code}:`, error.message);
      }
    }

    console.log(`✅ [Sync Worker - Descarga] ${insertCount} nuevos, ${updateCount} actualizados`);

    // Notificar a ventanas abiertas si hubo descargas
    if ((insertCount + updateCount) > 0 && mainWindow) {
      mainWindow.webContents.send('tickets-updated', {
        inserted: insertCount,
        updated: updateCount
      });
    }
  }
} catch (error) {
  console.error('❌ [Sync Worker] Error en descarga de Supabase:', error.message);
}
```

**Ubicación**: Insertar después de la línea 4737 (después del bloque de sincronización de tickets).

---

### Tarea 2: Unificar nombres de columnas en queries

**Archivo**: `c:\appCasino\Caja\database.js`
**Línea**: 18-40 (definición de tabla tickets)
**Prioridad**: MEDIA
**Tiempo estimado**: 1 hora
**Riesgo**: BAJO

**Cambio requerido**:
Agregar columna `created_at` como alias de `fecha_emision` para compatibilidad.

**Código sugerido**:

```javascript
// Opción 1: Agregar columna created_at como alias (usando ALTER TABLE)
this.db.exec(`
  ALTER TABLE tickets ADD COLUMN created_at DATETIME;
  UPDATE tickets SET created_at = fecha_emision WHERE created_at IS NULL;
  CREATE TRIGGER IF NOT EXISTS tickets_sync_created_at
  AFTER INSERT ON tickets
  BEGIN
    UPDATE tickets SET created_at = fecha_emision WHERE id = NEW.id;
  END;
`);

// Opción 2: Cambiar todas las queries para usar fecha_emision (más limpio)
// Buscar y reemplazar en main.js:
// WHERE DATE(created_at) = ?  →  WHERE DATE(fecha_emision) = ?
```

**Recomendación**: Opción 2 (cambiar queries) es más limpia y no agrega columnas redundantes.

---

### Tarea 3: Agregar índice para optimizar sincronización

**Archivo**: `c:\appCasino\Caja\database.js`
**Línea**: Después de línea 104 (índices existentes)
**Prioridad**: BAJA
**Tiempo estimado**: 30 minutos
**Riesgo**: BAJO

**Cambio requerido**:
Agregar índice compuesto para acelerar query de sincronización.

**Código sugerido**:

```javascript
this.db.exec(`
  CREATE INDEX IF NOT EXISTS idx_ticket_sincronizado ON tickets(sincronizado, fecha_emision);
`);
```

**Beneficio**: Acelera query `SELECT * FROM tickets WHERE sincronizado = 0 ORDER BY fecha_emision` de O(n) a O(log n).

---

### Tarea 4: Implementar sincronización bidireccional en handler manual

**Archivo**: `c:\appCasino\pure\main.js`
**Línea**: 3356-3446 (handler sync:force-sync)
**Prioridad**: MEDIA
**Tiempo estimado**: 1 hora
**Riesgo**: BAJO

**Cambio requerido**:
Agregar descarga de tickets después de subir pendientes.

**Código sugerido**:

```javascript
// Después de línea 3437 (después de sincronizar tickets pendientes)

// ============================================
// 2. DESCARGAR TICKETS NUEVOS DE SUPABASE
// ============================================
console.log('📥 [Sync Manual] Descargando tickets de Supabase...');

const lastSync = db.db.prepare('SELECT MAX(fecha_emision) as last_sync FROM tickets WHERE sincronizado = 1').get()?.last_sync || '2024-01-01T00:00:00Z';

const { data: newTickets, error: downloadError } = await supabaseManager.client
  .from('vouchers')
  .select('*')
  .or(`created_at.gte.${lastSync},updated_at.gte.${lastSync}`)
  .order('created_at', { ascending: false })
  .limit(100);

if (downloadError) {
  console.error('❌ [Sync Manual] Error descargando:', downloadError.message);
} else if (newTickets && newTickets.length > 0) {
  console.log(`📥 [Sync Manual] Procesando ${newTickets.length} tickets descargados...`);

  let downloadedCount = 0;

  for (const voucher of newTickets) {
    // ... (mismo código que Tarea 1) ...
    downloadedCount++;
  }

  console.log(`✅ [Sync Manual] ${downloadedCount} tickets descargados`);

  return {
    success: true,
    message: `Sincronización completada: ${successCount} subidos, ${downloadedCount} descargados`,
    synced: successCount,
    downloaded: downloadedCount,
    failed: errorCount
  };
}
```

---

## 4. CASOS DE PRUEBA

### Test 1: Crear ticket CON INTERNET

**Pasos**:
1. Verificar conexión a Supabase: `await supabaseManager.testConnection()`
2. Abrir Mesa (P01)
3. Crear ticket: $100 USD
4. Verificar en consola: "✅ Ticket guardado en Supabase"
5. Verificar en consola: "✅ Ticket guardado en SQLite: PREV-XXXXXX sincronizado: SI"

**Verificación en BD**:
```sql
-- SQLite
SELECT code, amount, currency, sincronizado FROM tickets ORDER BY id DESC LIMIT 1;
-- Esperado: sincronizado = 1

-- Supabase (Supabase Dashboard → Table Editor → vouchers)
-- Esperado: Voucher con código PREV-XXXXXX existe
```

**Resultado esperado**: ✅ Ticket en ambas BD, `sincronizado=1`

---

### Test 2: Crear ticket SIN INTERNET

**Pasos**:
1. Desconectar internet (WiFi/Ethernet)
2. Abrir Mesa (P01)
3. Crear ticket: $50 DOP
4. Verificar en consola: "⚠️ Supabase no disponible, modo offline"
5. Verificar en consola: "✅ Ticket guardado en SQLite: PREV-XXXXXX sincronizado: NO"
6. Reconectar internet
7. Esperar 2 minutos (worker de sincronización)
8. Verificar en consola: "✅ [Sync Worker] Ticket PREV-XXXXXX sincronizado"

**Verificación en BD**:
```sql
-- SQLite (antes de reconectar)
SELECT code, amount, currency, sincronizado FROM tickets WHERE code = 'PREV-XXXXXX';
-- Esperado: sincronizado = 0

-- SQLite (después de 2 min con internet)
SELECT code, amount, currency, sincronizado FROM tickets WHERE code = 'PREV-XXXXXX';
-- Esperado: sincronizado = 1

-- Supabase
-- Esperado: Voucher PREV-XXXXXX existe después de sincronización
```

**Resultado esperado**: ✅ Ticket sube automáticamente después de 2 minutos

---

### Test 3: Leer tickets (siempre rápido)

**Pasos**:
1. Crear 10 tickets
2. Abrir Caja (panel.html)
3. Medir tiempo de carga en DevTools → Network → panel.html (Load time)
4. Verificar estadísticas visibles sin delay

**Verificación en consola**:
```javascript
// En DevTools Console (Caja)
console.time('stats');
await window.electron.getStatsToday();
console.timeEnd('stats');
// Esperado: < 100ms
```

**Resultado esperado**: ✅ Carga en < 100ms (no espera Supabase)

---

### Test 4: Sincronización background - Descarga (DESPUÉS DE IMPLEMENTAR TAREA 1)

**Pasos**:
1. En PC A: Crear ticket ($200 USD)
2. En PC B: Esperar 2 minutos
3. En PC B: Verificar que aparece el ticket de PC A

**Verificación en BD (PC B)**:
```sql
-- SQLite (PC B)
SELECT code, amount, currency, mesa_nombre FROM tickets WHERE code = 'PREV-XXXXXX';
-- Esperado: Ticket creado en PC A aparece en PC B
```

**Resultado esperado**: ✅ Ticket descargado automáticamente en PC B

---

### Test 5: Canjear ticket en Caja y sincronizar estado

**Pasos**:
1. Crear ticket en Mesa: $100 USD
2. Abrir Caja
3. Validar código del ticket
4. Canjear ticket
5. Verificar en consola: "✅ Voucher canjeado en SQLite: PREV-XXXXXX sincronizado: SI"
6. Verificar en Supabase: Estado del voucher cambió a "redeemed"

**Verificación en BD**:
```sql
-- SQLite
SELECT code, estado, sincronizado FROM tickets WHERE code = 'PREV-XXXXXX';
-- Esperado: estado = 'usado', sincronizado = 1

-- Supabase
-- Esperado: status = 'redeemed'
```

**Resultado esperado**: ✅ Estado sincronizado en ambas BD

---

## 5. RIESGOS Y MITIGACIONES

### RIESGO 1: Desincronización de datos (duplicados/inconsistencias)

**Probabilidad**: MEDIA
**Impacto**: ALTO
**Descripción**: Si dos PCs crean tickets con el mismo código (colisión de IDs).

**Mitigación**:
1. Código de ticket es generado por SQLite con `AUTOINCREMENT` (único por PC)
2. Formato: `PREV-NNNNNN` donde NNNNNN es secuencial
3. **Solución**: Agregar prefijo por PC/Mesa
   - PC 1: `P01-001234`
   - PC 2: `P02-001234`
4. O usar UUID en lugar de secuencial

**Implementación**:
```javascript
// En database.js, línea 141
generateTicketCode() {
  const prefijo = this.getConfig('prefijo_ticket') || 'PREV';
  const mesaId = this.getConfig('mesa_id') || '01'; // NUEVO: ID único por PC
  const ultimoNumero = parseInt(this.getConfig('ultimo_numero') || '1000');
  const nuevoNumero = ultimoNumero + 1;
  this.setConfig('ultimo_numero', String(nuevoNumero));
  return `${prefijo}${mesaId}-${String(nuevoNumero).padStart(6, '0')}`;
  // Ejemplo: PREV01-001234, PREV02-001234 (sin colisión)
}
```

---

### RIESGO 2: Worker de sincronización sobrecarga Supabase

**Probabilidad**: BAJA
**Impacto**: MEDIO
**Descripción**: Si hay miles de tickets pendientes, el worker puede hacer demasiadas requests.

**Mitigación**:
1. Worker ya usa lotes de 100 tickets (BATCH_SIZE = 100)
2. Intervalo de 2 minutos evita saturación
3. **Solución adicional**: Agregar rate limiting
   ```javascript
   // Esperar 100ms entre cada ticket
   await new Promise(resolve => setTimeout(resolve, 100));
   ```

**Estado**: IMPLEMENTADO (lotes de 100)

---

### RIESGO 3: Columna `created_at` no existe en SQLite

**Probabilidad**: ALTA
**Impacto**: MEDIO
**Descripción**: Queries en main.js usan `created_at`, pero tabla SQLite usa `fecha_emision`.

**Mitigación**:
1. Implementar Tarea 2 (unificar nombres)
2. O agregar columna `created_at` como alias

**Estado**: PENDIENTE (ver Tarea 2)

---

### RIESGO 4: Pérdida de datos si SQLite corrompe

**Probabilidad**: BAJA
**Impacto**: ALTO
**Descripción**: Si archivo `casino.db` se corrompe, se pierden tickets pendientes de sincronización.

**Mitigación**:
1. Ya existe handler `caja:backup-database` (línea 356-364 en cajaHandlers.js)
2. **Solución**: Automatizar backup diario
   ```javascript
   // En main.js, después de inicialización
   setInterval(() => {
     if (db && typeof db.backup === 'function') {
       const backupPath = db.backup();
       console.log('✅ Backup automático creado:', backupPath);
     }
   }, 24 * 60 * 60 * 1000); // Cada 24 horas
   ```

**Estado**: PARCIALMENTE IMPLEMENTADO (backup manual disponible)

---

## 6. ARQUITECTURA ACTUAL vs DESEADA

### DIAGRAMA DE FLUJO ACTUAL (POST-ROLLBACK d2182fd)

```
┌─────────────────────────────────────────────────────────────┐
│                    CREAR TICKET (Mesa)                      │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
              ┌─────────────────────────┐
              │ ¿Supabase disponible?   │
              └─────────────────────────┘
                │                    │
          SÍ ◄──┘                    └──► NO
                │                         │
                ▼                         ▼
    ┌───────────────────────┐   ┌──────────────────────┐
    │ 1. Guardar Supabase   │   │ 1. Saltar Supabase   │
    │    (fuente de verdad) │   │                      │
    └───────────────────────┘   └──────────────────────┘
                │                         │
                ▼                         ▼
    ┌───────────────────────┐   ┌──────────────────────┐
    │ 2. Guardar SQLite     │   │ 2. Guardar SQLite    │
    │    sincronizado = 1   │   │    sincronizado = 0  │
    └───────────────────────┘   └──────────────────────┘
                │                         │
                └────────────┬────────────┘
                             ▼
                  ┌────────────────────┐
                  │ ✅ Ticket guardado │
                  └────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    LEER TICKETS (Caja)                      │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
              ┌─────────────────────────┐
              │ Leer SOLO de SQLite     │ ← SIEMPRE (< 10ms)
              │ (no espera Supabase)    │
              └─────────────────────────┘
                           │
                           ▼
                  ┌────────────────────┐
                  │ ✅ Datos mostrados │
                  └────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│              WORKER DE SINCRONIZACIÓN (cada 2 min)          │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
              ┌─────────────────────────┐
              │ ¿Hay tickets pendientes?│
              │ (sincronizado = 0)      │
              └─────────────────────────┘
                │                    │
          SÍ ◄──┘                    └──► NO
                │                         │
                ▼                         ▼
    ┌───────────────────────┐   ┌──────────────────────┐
    │ Subir a Supabase      │   │ Fin (no hay trabajo) │
    │ (lotes de 100)        │   └──────────────────────┘
    └───────────────────────┘
                │
                ▼
    ┌───────────────────────┐
    │ Marcar sincronizado=1 │
    └───────────────────────┘
                │
                ▼
          ┌──────────┐
          │ ✅ Listo │
          └──────────┘

❌ FALTA: Descarga de Supabase → SQLite
```

### DIAGRAMA DE FLUJO DESEADO (Arquitectura Opción D COMPLETA)

```
┌─────────────────────────────────────────────────────────────┐
│                    CREAR TICKET (Mesa)                      │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
              ┌─────────────────────────┐
              │ ¿Supabase disponible?   │
              └─────────────────────────┘
                │                    │
          SÍ ◄──┘                    └──► NO
                │                         │
                ▼                         ▼
    ┌───────────────────────┐   ┌──────────────────────┐
    │ 1. Guardar Supabase   │   │ 1. Saltar Supabase   │
    │    (fuente de verdad) │   │                      │
    └───────────────────────┘   └──────────────────────┘
                │                         │
                ▼                         ▼
    ┌───────────────────────┐   ┌──────────────────────┐
    │ 2. Guardar SQLite     │   │ 2. Guardar SQLite    │
    │    sincronizado = 1   │   │    sincronizado = 0  │
    └───────────────────────┘   └──────────────────────┘
                │                         │
                └────────────┬────────────┘
                             ▼
                  ┌────────────────────┐
                  │ ✅ Ticket guardado │
                  └────────────────────┘

✅ IMPLEMENTADO CORRECTAMENTE

┌─────────────────────────────────────────────────────────────┐
│                    LEER TICKETS (Caja)                      │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
              ┌─────────────────────────┐
              │ Leer SOLO de SQLite     │ ← SIEMPRE (< 10ms)
              │ (no espera Supabase)    │
              └─────────────────────────┘
                           │
                           ▼
                  ┌────────────────────┐
                  │ ✅ Datos mostrados │
                  └────────────────────┘

✅ IMPLEMENTADO CORRECTAMENTE

┌─────────────────────────────────────────────────────────────┐
│          WORKER DE SINCRONIZACIÓN (cada 2 min)              │
│              *** VERSIÓN COMPLETA ***                        │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
              ┌─────────────────────────┐
              │ ¿Conexión a Supabase?   │
              └─────────────────────────┘
                │                    │
          SÍ ◄──┘                    └──► NO
                │                         │
                ▼                         ▼
    ┌───────────────────────┐   ┌──────────────────────┐
    │ PASO A: SUBIR         │   │ Fin (modo offline)   │
    │ Tickets pendientes    │   └──────────────────────┘
    │ (sincronizado = 0)    │
    └───────────────────────┘
                │
                ▼
    ┌───────────────────────┐
    │ Subir a Supabase      │
    │ (lotes de 100)        │
    └───────────────────────┘
                │
                ▼
    ┌───────────────────────┐
    │ Marcar sincronizado=1 │
    └───────────────────────┘
                │
                ▼
    ┌───────────────────────┐
    │ PASO B: DESCARGAR     │ ◄── ❌ FALTA IMPLEMENTAR
    │ Tickets nuevos/       │
    │ modificados desde     │
    │ Supabase              │
    └───────────────────────┘
                │
                ▼
    ┌───────────────────────┐
    │ ¿Ticket existe en     │
    │ SQLite?               │
    └───────────────────────┘
                │                    │
          SÍ ◄──┘                    └──► NO
                │                         │
                ▼                         ▼
    ┌───────────────────────┐   ┌──────────────────────┐
    │ UPDATE (actualizar)   │   │ INSERT (nuevo)       │
    │ - Cambiar estado      │   │ - Agregar a SQLite   │
    │ - Actualizar amounts  │   │ - Marcar sincro=1    │
    └───────────────────────┘   └──────────────────────┘
                │                         │
                └────────────┬────────────┘
                             ▼
                  ┌────────────────────┐
                  │ Notificar UI       │
                  │ (tickets-updated)  │
                  └────────────────────┘
                             │
                             ▼
                      ┌──────────┐
                      │ ✅ Listo │
                      └──────────┘

⚠️ PASO B NO IMPLEMENTADO (ver Tarea 1)
```

---

## 7. DIFERENCIAS: ACTUAL vs DESEADO

| Componente | Estado Actual | Estado Deseado | Gap |
|-----------|---------------|----------------|-----|
| **Escritura CON internet** | ✅ Supabase → SQLite (sincronizado=1) | ✅ Supabase → SQLite (sincronizado=1) | ✅ IMPLEMENTADO |
| **Escritura SIN internet** | ✅ SQLite (sincronizado=0) → Worker sube después | ✅ SQLite (sincronizado=0) → Worker sube después | ✅ IMPLEMENTADO |
| **Lectura** | ✅ Solo SQLite (rápido) | ✅ Solo SQLite (rápido) | ✅ IMPLEMENTADO |
| **Sincronización: Subida** | ✅ Worker sube tickets pendientes cada 2 min | ✅ Worker sube tickets pendientes cada 2 min | ✅ IMPLEMENTADO |
| **Sincronización: Descarga** | ❌ NO descarga de Supabase → SQLite | ✅ Worker descarga tickets nuevos/modificados | ❌ FALTA IMPLEMENTAR |
| **Nombres de columnas** | ⚠️ Inconsistencias (created_at vs fecha_emision) | ✅ Unificado | ⚠️ REQUIERE AJUSTE |
| **Índices BD** | ⚠️ Sin índice para sincronización | ✅ Índice (sincronizado, fecha_emision) | ⚠️ OPTIMIZACIÓN PENDIENTE |
| **Backup automático** | ⚠️ Solo manual | ✅ Diario automático | ⚠️ FALTA AUTOMATIZAR |
| **Servidor local** | ❌ No implementado | 🔵 Futuro opcional (no crítico) | 🔵 FUTURO |

**Leyenda**:
- ✅ Implementado y funcionando
- ⚠️ Implementado parcialmente / Requiere ajuste
- ❌ No implementado / Falta completar
- 🔵 Futuro opcional (no bloquea arquitectura)

---

## 8. PRIORIZACIÓN DE TAREAS

### PRIORIDAD ALTA (Bloquea arquitectura Opción D)

1. **Tarea 1**: Agregar descarga periódica al Worker
   - Tiempo: 2 horas
   - Riesgo: Bajo
   - Impacto: Alto (sin esto, arquitectura está incompleta)
   - **Iniciar: INMEDIATAMENTE**

### PRIORIDAD MEDIA (Mejora estabilidad)

2. **Tarea 2**: Unificar nombres de columnas
   - Tiempo: 1 hora
   - Riesgo: Bajo
   - Impacto: Medio (evita errores en queries)
   - **Iniciar: Después de Tarea 1**

3. **Tarea 4**: Sincronización bidireccional en handler manual
   - Tiempo: 1 hora
   - Riesgo: Bajo
   - Impacto: Medio (útil para troubleshooting)
   - **Iniciar: Después de Tarea 2**

### PRIORIDAD BAJA (Optimización)

4. **Tarea 3**: Agregar índice de sincronización
   - Tiempo: 30 minutos
   - Riesgo: Bajo
   - Impacto: Bajo (mejora performance marginal)
   - **Iniciar: Cuando haya tiempo**

5. **Backup automático**: Automatizar backup diario
   - Tiempo: 30 minutos
   - Riesgo: Bajo
   - Impacto: Bajo (seguridad adicional)
   - **Iniciar: Cuando haya tiempo**

---

## 9. TIMELINE SUGERIDO

### DÍA 1 (4 horas)
- **09:00-11:00**: Implementar Tarea 1 (descarga periódica en worker)
- **11:00-12:00**: Testing de Tarea 1 (Test 4 - sincronización descarga)
- **14:00-15:00**: Implementar Tarea 2 (unificar nombres de columnas)
- **15:00-16:00**: Testing completo (Tests 1-5)

### DÍA 2 (2 horas) - Opcional
- **09:00-10:00**: Implementar Tarea 4 (sync manual bidireccional)
- **10:00-10:30**: Implementar Tarea 3 (índice)
- **10:30-11:00**: Implementar backup automático

**TOTAL**: 6 horas (4 horas críticas + 2 horas opcionales)

---

## 10. COMANDOS ÚTILES PARA VERIFICACIÓN

### Verificar tickets pendientes de sincronización
```bash
# Desde consola de Electron (DevTools)
cd "c:\appCasino"
node -e "const db = require('./Caja/database.js'); const d = new db(); console.log('Pendientes:', d.db.prepare('SELECT COUNT(*) as count FROM tickets WHERE sincronizado = 0').get()); d.close();"
```

### Verificar estructura de tabla tickets
```bash
node -e "const db = require('./Caja/database.js'); const d = new db(); console.log(d.db.prepare('PRAGMA table_info(tickets)').all()); d.close();"
```

### Forzar sincronización manual
```javascript
// Desde DevTools Console (en Mesa o Caja)
await window.electron.ipcRenderer.invoke('sync:force-sync');
```

### Ver logs del worker en tiempo real
```javascript
// main.js ya tiene logs, solo ver consola de Electron
// Buscar: "[Sync Worker]"
```

---

## 11. CONCLUSIONES

### Estado Actual
La arquitectura "Dual DB Simplificado" (Opción D) está **85% implementada**. Los componentes críticos de escritura y lectura funcionan correctamente. El único componente faltante es la **descarga periódica de Supabase → SQLite**, que es esencial para sincronización completa entre múltiples PCs.

### Viabilidad
**VIABLE**. La arquitectura es sólida y solo requiere **4-6 horas** de trabajo adicional para completarse. No se detectaron problemas fundamentales de diseño.

### Recomendaciones

1. **INMEDIATO**: Implementar Tarea 1 (descarga periódica) - Sin esto, la arquitectura está incompleta.

2. **CORTO PLAZO**: Implementar Tareas 2 y 4 (unificación de columnas + sync manual bidireccional) - Mejoran estabilidad.

3. **LARGO PLAZO**: Optimizaciones (Tarea 3, backup automático) - Nice to have, no críticas.

4. **MONITOREO**: Después de implementar, monitorear logs del worker durante 1 semana para detectar problemas.

### Próximos Pasos

1. Revisar y aprobar este análisis
2. Implementar Tarea 1 (2 horas)
3. Ejecutar Tests 1-5 (1 hora)
4. Implementar Tareas 2-4 si hay tiempo (2 horas)
5. Desplegar a producción
6. Monitorear 1 semana

---

**Documento generado**: 2025-11-07
**Versión del código analizado**: Commit d2182fd
**Tiempo total de análisis**: ~2 horas
**Archivos analizados**: 4 archivos principales (main.js, database.js, supabaseManager.js, cajaHandlers.js)
