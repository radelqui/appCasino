# TAREA 1: Código para Descarga Periódica (COPY-PASTE READY)

## OBJETIVO
Agregar descarga automática de tickets desde Supabase → SQLite en el worker de sincronización.

## ARCHIVO A MODIFICAR
**Ruta**: `c:\appCasino\pure\main.js`
**Línea**: Después de 4737 (después del bloque de sincronización de tickets pendientes)

## CÓDIGO COMPLETO (LISTO PARA COPIAR)

```javascript
// ============================================
// 4. DESCARGAR TICKETS NUEVOS/MODIFICADOS DE SUPABASE → SQLITE
// ============================================
try {
  console.log('🔄 [Sync Worker] Iniciando descarga de tickets desde Supabase...');

  // Obtener timestamp de última sincronización
  let lastSyncTimestamp = '2024-01-01T00:00:00Z'; // Fallback inicial
  try {
    const lastSyncResult = db.db.prepare(
      'SELECT MAX(fecha_emision) as last_sync FROM tickets WHERE sincronizado = 1'
    ).get();
    if (lastSyncResult?.last_sync) {
      lastSyncTimestamp = lastSyncResult.last_sync;
    }
  } catch (e) {
    console.warn('⚠️  No se pudo obtener última sincronización, usando fallback');
  }

  console.log(`📅 [Sync Worker] Última sincronización: ${lastSyncTimestamp}`);

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
    let errorCount = 0;

    for (const voucher of newTickets) {
      try {
        // Normalizar código (mayúsculas)
        const voucherCode = String(voucher.voucher_code || '').toUpperCase().trim();
        if (!voucherCode) {
          console.warn('⚠️  Voucher sin código, saltando');
          continue;
        }

        // Verificar si ya existe en SQLite
        const existing = db.db.prepare('SELECT id FROM tickets WHERE code = ?').get(voucherCode);

        // Mapear estado de Supabase a SQLite
        const mapEstado = (status) => {
          switch (String(status).toLowerCase()) {
            case 'active': return 'emitido';
            case 'redeemed': return 'usado';
            case 'cancelled': return 'cancelado';
            case 'expired': return 'expirado';
            default: return 'emitido';
          }
        };

        const estado = mapEstado(voucher.status);

        // Convertir mesa_id (INTEGER en Supabase) a formato texto para SQLite
        let mesaText = null;
        let mesaNombre = null;
        if (voucher.issued_at_station_id) {
          const stationNum = parseInt(voucher.issued_at_station_id);
          if (!isNaN(stationNum)) {
            mesaText = `P${String(stationNum).padStart(2, '0')}`;
            mesaNombre = voucher.mesa_nombre || mesaText;
          }
        }

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
              created_by_username = ?,
              issued_by_user_id = ?,
              issued_at_station_id = ?,
              redeemed_by_user_id = ?,
              redeemed_at = ?,
              hash_seguridad = ?,
              qr_data = ?
            WHERE code = ?
          `).run(
            voucher.amount || 0,
            voucher.currency || 'USD',
            estado,
            voucher.redeemed_at || null,
            voucher.redeemed_by_user_id || null,
            mesaText,
            mesaNombre,
            voucher.operador_nombre || null,
            voucher.issued_by_user_id || null,
            voucher.issued_at_station_id || null,
            voucher.redeemed_by_user_id || null,
            voucher.redeemed_at || null,
            voucher.qr_hash || '',
            voucher.qr_data || '',
            voucherCode
          );

          updateCount++;
          console.log(`✅ [Sync Worker] Ticket ${voucherCode} actualizado desde Supabase`);
        } else {
          // INSERTAR nuevo ticket
          db.db.prepare(`
            INSERT INTO tickets (
              code, amount, currency, estado, fecha_emision, fecha_cobro,
              cajero_id, sincronizado, mesa, mesa_nombre, created_by_username,
              issued_by_user_id, issued_at_station_id, redeemed_by_user_id,
              redeemed_at, hash_seguridad, qr_data, notas
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            voucherCode,
            voucher.amount || 0,
            voucher.currency || 'USD',
            estado,
            voucher.issued_at || voucher.created_at || new Date().toISOString(),
            voucher.redeemed_at || null,
            voucher.redeemed_by_user_id || null,
            mesaText,
            mesaNombre,
            voucher.operador_nombre || null,
            voucher.issued_by_user_id || null,
            voucher.issued_at_station_id || null,
            voucher.redeemed_by_user_id || null,
            voucher.redeemed_at || null,
            voucher.qr_hash || '',
            voucher.qr_data || '',
            voucher.customer_name || null
          );

          insertCount++;
          console.log(`✅ [Sync Worker] Ticket ${voucherCode} insertado desde Supabase`);
        }
      } catch (error) {
        errorCount++;
        console.error(`❌ [Sync Worker] Error procesando ticket ${voucher.voucher_code}:`, error.message);
      }
    }

    console.log(`✅ [Sync Worker - Descarga] ${insertCount} nuevos, ${updateCount} actualizados, ${errorCount} errores`);

    // Notificar a ventanas abiertas si hubo descargas
    if ((insertCount + updateCount) > 0 && mainWindow) {
      try {
        mainWindow.webContents.send('tickets-updated', {
          inserted: insertCount,
          updated: updateCount,
          timestamp: new Date().toISOString()
        });
        console.log(`📢 [Sync Worker] Notificación enviada a UI`);
      } catch (e) {
        console.warn('⚠️  No se pudo notificar a UI:', e.message);
      }
    }

    totalSynced += (insertCount + updateCount);
    totalErrors += errorCount;
  } else {
    console.log('ℹ️  [Sync Worker] No hay tickets nuevos para descargar');
  }
} catch (error) {
  console.error('❌ [Sync Worker] Error crítico en descarga de Supabase:', error.message);
  console.error('❌ [Sync Worker] Stack:', error.stack);
}
```

## INSTRUCCIONES DE INSTALACIÓN

### Paso 1: Abrir el archivo
```bash
# Con VS Code
code "c:\appCasino\pure\main.js"

# O con notepad
notepad "c:\appCasino\pure\main.js"
```

### Paso 2: Localizar la línea de inserción
1. Buscar (Ctrl+F): `✅ [Sync Worker - Tickets]`
2. Ir al final del bloque de sincronización de tickets pendientes
3. Después de la línea que dice:
   ```javascript
   totalSynced += successCount;
   totalErrors += errorCount;
   ```
4. **ANTES** del comentario:
   ```javascript
   // ============================================
   // 2. SINCRONIZAR USUARIOS
   // ============================================
   ```

### Paso 3: Pegar el código
1. Colocar el cursor al final de la línea `totalErrors += errorCount;`
2. Presionar Enter para crear nueva línea
3. Pegar el código completo (Ctrl+V)
4. Verificar indentación (debe alinearse con el bloque anterior)

### Paso 4: Guardar y verificar
1. Guardar archivo (Ctrl+S)
2. Verificar que no hay errores de sintaxis:
   ```bash
   cd "c:\appCasino"
   node -c pure\main.js
   # Si no hay output, está OK
   ```

## VISUALIZACIÓN DEL CONTEXTO

```javascript
// ... (código existente del worker) ...

      console.log(`✅ [Sync Worker - Tickets] ${successCount} exitosos, ${errorCount} fallidos`);
      console.log(`📊 [Sync Worker - Tickets] Progreso: ${successCount}/${totalPending.count} (${progress}%) - Quedan ${remainingAfterBatch} pendientes`);

      totalSynced += successCount;
      totalErrors += errorCount;

      // Notificar a ventanas abiertas si hubo sincronizaciones
      if (successCount > 0 && mainWindow) {
        mainWindow.webContents.send('tickets-synced', { count: successCount });
      }
    }

    // ============================================
    // 4. DESCARGAR TICKETS NUEVOS/MODIFICADOS DE SUPABASE → SQLITE
    // ============================================
    try {
      console.log('🔄 [Sync Worker] Iniciando descarga de tickets desde Supabase...');

      // ... (AQUÍ VA EL CÓDIGO NUEVO) ...

    } catch (error) {
      console.error('❌ [Sync Worker] Error crítico en descarga de Supabase:', error.message);
    }

    // ============================================
    // 2. SINCRONIZAR USUARIOS
    // ============================================
    try {
      const pendingUsuarios = db.db.prepare(
        'SELECT * FROM usuarios WHERE sincronizado = 0'
      ).all();

      // ... (código existente) ...
```

## VERIFICACIÓN POST-INSTALACIÓN

### 1. Reiniciar la aplicación
```bash
cd "c:\appCasino"
npm start
```

### 2. Verificar logs en consola
Buscar en la consola de Electron:
```
🔄 [Sync Worker] Iniciando descarga de tickets desde Supabase...
📅 [Sync Worker] Última sincronización: 2024-11-07T10:30:00Z
📥 [Sync Worker] Descargando X tickets de Supabase...
✅ [Sync Worker - Descarga] X nuevos, Y actualizados, 0 errores
```

### 3. Test rápido
1. En PC A: Crear un ticket
2. Esperar 2 minutos
3. En PC B: Verificar que el ticket aparece

```javascript
// En DevTools Console (PC B)
const tickets = await window.electron.ipcRenderer.invoke('caja:get-tickets-today');
console.log('Tickets:', tickets);
// Debe incluir el ticket creado en PC A
```

## TROUBLESHOOTING

### Error: "Cannot read property 'client' of null"
**Causa**: supabaseManager no está inicializado
**Solución**: Verificar que Supabase esté configurado en `.env`
```bash
# .env debe tener:
SUPABASE_URL=https://...
SUPABASE_SERVICE_ROLE_KEY=...
```

### Error: "SQLITE_ERROR: no such column: created_at"
**Causa**: Columna created_at no existe en tabla tickets
**Solución**: El código YA maneja esto usando `fecha_emision`

### No descarga tickets
**Causa**: Timestamp de última sincronización muy reciente
**Solución**: Probar con timestamp más antiguo temporalmente
```javascript
// En el código, cambiar temporalmente:
let lastSyncTimestamp = '2024-01-01T00:00:00Z'; // Descargar todo
```

### Descarga tickets duplicados
**Causa**: Campo `code` no es único
**Solución**: Verificar constraint UNIQUE
```bash
node -e "const db = require('./Caja/database.js'); const d = new db(); console.log(d.db.prepare('SELECT sql FROM sqlite_master WHERE name = \"tickets\"').get()); d.close();"
# Debe tener: code TEXT UNIQUE NOT NULL
```

## ROLLBACK (SI ES NECESARIO)

Si algo sale mal, revertir cambios:

```bash
cd "c:\appCasino"
git diff pure/main.js > cambios_tarea1.patch
git checkout pure/main.js
# Para restaurar después:
git apply cambios_tarea1.patch
```

## PRÓXIMO PASO

Después de instalar y verificar esta tarea, continuar con:
- **Tarea 2**: Unificar nombres de columnas (ver `ANALISIS_VIABILIDAD_DUAL_DB_ARQUITECTURA.md`)

---

**Tiempo estimado de instalación**: 15 minutos
**Dificultad**: Baja (copy-paste)
**Riesgo**: Bajo (no modifica código existente, solo agrega)

**Fecha**: 2025-11-07
**Documento padre**: ANALISIS_VIABILIDAD_DUAL_DB_ARQUITECTURA.md
