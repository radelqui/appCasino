# RESUMEN EJECUTIVO: Arquitectura Dual DB (Opción D)

## ESTADO ACTUAL: 85% IMPLEMENTADO ✅

### LO QUE FUNCIONA (IMPLEMENTADO)

✅ **Escritura CON internet**: Supabase → SQLite (sincronizado=1)
✅ **Escritura SIN internet**: SQLite (sincronizado=0) → Worker sube después
✅ **Lectura**: Solo SQLite (< 10ms, no bloquea UI)
✅ **Sincronización SUBIDA**: Worker sube tickets pendientes cada 2 min
✅ **Manejo de errores**: Timeout 5s, fallback a modo offline

### LO QUE FALTA (15% PENDIENTE)

❌ **Sincronización DESCARGA**: Worker NO descarga tickets de Supabase → SQLite
⚠️ **Nombres inconsistentes**: Queries usan `created_at`, tabla usa `fecha_emision`
⚠️ **Índices**: Falta índice para optimizar sync

## PLAN DE ACCIÓN (6 HORAS TOTALES)

### PRIORIDAD ALTA (4 horas - Crítico)

1. **Agregar descarga periódica al Worker** (2h)
   - Archivo: `pure/main.js` línea 4737
   - Descargar tickets nuevos/modificados de Supabase
   - Insertar/actualizar en SQLite
   - **SIN ESTO LA ARQUITECTURA ESTÁ INCOMPLETA**

2. **Unificar nombres de columnas** (1h)
   - Cambiar queries: `created_at` → `fecha_emision`
   - O agregar columna alias en BD

3. **Testing completo** (1h)
   - Test 1-5 (ver documento completo)

### PRIORIDAD MEDIA (2 horas - Opcional)

4. **Sync manual bidireccional** (1h)
5. **Índices + backup automático** (1h)

## CÓDIGO CLAVE A MODIFICAR

### 1. Worker de descarga (Tarea 1 - CRÍTICO)

**Ubicación**: `c:\appCasino\pure\main.js` después de línea 4737

```javascript
// ============================================
// 4. DESCARGAR TICKETS DE SUPABASE → SQLITE
// ============================================
try {
  console.log('🔄 [Sync Worker] Descargando tickets de Supabase...');

  const lastSync = db.db.prepare(
    'SELECT MAX(fecha_emision) as last_sync FROM tickets WHERE sincronizado = 1'
  ).get()?.last_sync || '2024-01-01T00:00:00Z';

  const { data: newTickets, error } = await supabaseManager.client
    .from('vouchers')
    .select('*')
    .or(`created_at.gte.${lastSync},updated_at.gte.${lastSync}`)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    console.error('❌ Error descargando:', error.message);
  } else if (newTickets && newTickets.length > 0) {
    console.log(`📥 Descargando ${newTickets.length} tickets...`);

    for (const voucher of newTickets) {
      const existing = db.db.prepare('SELECT id FROM tickets WHERE code = ?').get(voucher.voucher_code);

      if (existing) {
        // ACTUALIZAR
        db.db.prepare(`
          UPDATE tickets
          SET amount = ?, currency = ?, estado = ?, sincronizado = 1
          WHERE code = ?
        `).run(
          voucher.amount,
          voucher.currency,
          voucher.status === 'active' ? 'emitido' : 'usado',
          voucher.voucher_code
        );
        console.log(`✅ Ticket ${voucher.voucher_code} actualizado`);
      } else {
        // INSERTAR NUEVO
        db.db.prepare(`
          INSERT INTO tickets (code, amount, currency, estado, fecha_emision, sincronizado)
          VALUES (?, ?, ?, ?, ?, 1)
        `).run(
          voucher.voucher_code,
          voucher.amount,
          voucher.currency,
          voucher.status === 'active' ? 'emitido' : 'usado',
          voucher.issued_at || voucher.created_at
        );
        console.log(`✅ Ticket ${voucher.voucher_code} insertado`);
      }
    }
  }
} catch (error) {
  console.error('❌ Error en descarga:', error.message);
}
```

## VERIFICACIÓN RÁPIDA

### ¿Está funcionando la sincronización SUBIDA?

```javascript
// DevTools Console (Mesa)
await window.electron.ipcRenderer.invoke('sync:get-pending-count');
// Esperado: { success: true, count: 0 } (si no hay pendientes)
```

### ¿Existe la columna sincronizado?

```bash
# Terminal
cd "c:\appCasino"
node -e "const db = require('./Caja/database.js'); const d = new db(); console.log(d.db.prepare('PRAGMA table_info(tickets)').all().filter(c => c.name === 'sincronizado')); d.close();"
# Esperado: [ { name: 'sincronizado', type: 'INTEGER', ... } ]
```

### Forzar sincronización manual

```javascript
// DevTools Console
await window.electron.ipcRenderer.invoke('sync:force-sync');
// Ver consola de Electron para logs detallados
```

## TESTS ESENCIALES

### Test 1: Ticket CON internet
1. Crear ticket → Verificar "✅ Ticket guardado en Supabase"
2. Verificar en SQLite: `SELECT sincronizado FROM tickets ORDER BY id DESC LIMIT 1;` → Esperado: 1

### Test 2: Ticket SIN internet
1. Desconectar WiFi → Crear ticket → Verificar "sincronizado: NO"
2. Reconectar → Esperar 2 min → Verificar "✅ Ticket sincronizado"

### Test 3: Lectura rápida
1. Abrir Caja → Medir tiempo de carga → Esperado: < 100ms

### Test 4: Descarga entre PCs (DESPUÉS DE TAREA 1)
1. PC A: Crear ticket
2. PC B: Esperar 2 min → Verificar aparece ticket de PC A

## ARCHIVOS PRINCIPALES

```
c:\appCasino\
├── pure\
│   ├── main.js              ← Worker de sync (línea 4648-4901)
│   └── supabaseManager.js   ← Cliente Supabase
├── Caja\
│   ├── database.js          ← SQLite local (tabla tickets línea 18-40)
│   └── cajaHandlers.js      ← Handlers IPC de Caja
└── data\
    └── casino.db            ← Base de datos SQLite
```

## DIAGRAMA SIMPLIFICADO

```
ESCRITURA (Mesa):
User → [Supabase PRIMERO] → [SQLite SEGUNDO] → ✅ Done
                ↓ falla              ↓
       sincronizado=0     sincronizado=1

LECTURA (Caja):
User → [SQLite SOLO] → ✅ Datos (< 10ms)
       (no espera Supabase)

SINCRONIZACIÓN (Worker cada 2 min):
[SQLite pendientes] → [Supabase] → Marca sincronizado=1  ✅ IMPLEMENTADO
[Supabase nuevos]   → [SQLite]   → Actualizar caché      ❌ FALTA IMPLEMENTAR
```

## CRITERIOS DE ÉXITO

✅ Ticket creado CON internet → sincronizado=1 en SQLite + existe en Supabase
✅ Ticket creado SIN internet → sincronizado=0 → Sube después de 2 min
✅ Lectura desde Caja → < 100ms sin esperar Supabase
❌ Ticket creado en PC A → Aparece en PC B después de 2 min (FALTA IMPLEMENTAR)

## SIGUIENTE PASO

**ACCIÓN INMEDIATA**: Implementar código de descarga periódica (arriba) en `main.js` línea 4737.

---

**Versión completa**: Ver `ANALISIS_VIABILIDAD_DUAL_DB_ARQUITECTURA.md`
**Fecha**: 2025-11-07
**Commit analizado**: d2182fd
