# DIAGNÓSTICO RÁPIDO: Arquitectura Dual DB

## COMANDOS DE VERIFICACIÓN INSTANTÁNEA

### 1. ¿Está funcionando Supabase?

```javascript
// DevTools Console (cualquier ventana)
await window.electron.ipcRenderer.invoke('check-supabase-connection');
// Esperado: { success: true, available: true, connected: true }
```

**Si falla**: Verificar `.env` tiene SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY

---

### 2. ¿Cuántos tickets están pendientes de sincronización?

```javascript
// DevTools Console
await window.electron.ipcRenderer.invoke('sync:get-pending-count');
// Esperado: { success: true, count: 0 } (si todo sincronizado)
```

**Si count > 0**: Tickets esperando subir a Supabase

---

### 3. ¿Existe la columna sincronizado?

```bash
# Terminal (cmd)
cd "c:\appCasino"
node -e "const db = require('./Caja/database.js'); const d = new db(); const cols = d.db.prepare('PRAGMA table_info(tickets)').all(); console.log('Columnas:', cols.filter(c => c.name === 'sincronizado' || c.name === 'code' || c.name === 'fecha_emision').map(c => c.name)); d.close();"
```

**Esperado**: `Columnas: [ 'code', 'fecha_emision', 'sincronizado' ]`

---

### 4. ¿Cuántos tickets hay en SQLite?

```bash
node -e "const db = require('./Caja/database.js'); const d = new db(); console.log('Total tickets:', d.db.prepare('SELECT COUNT(*) as count FROM tickets').get()); console.log('Sincronizados:', d.db.prepare('SELECT COUNT(*) as count FROM tickets WHERE sincronizado = 1').get()); console.log('Pendientes:', d.db.prepare('SELECT COUNT(*) as count FROM tickets WHERE sincronizado = 0').get()); d.close();"
```

---

### 5. ¿Está corriendo el worker de sincronización?

```bash
# Buscar en logs de Electron Console:
# - "✅ Worker de sincronización iniciado (intervalo: 2 minutos)"
# - "🔄 [Sync Worker] Sincronizando X tickets pendientes..."
```

**Si no aparece**: Worker no se inició. Verificar `main.js` llama a `startSyncWorker()`

---

### 6. ¿Últimos tickets creados?

```bash
node -e "const db = require('./Caja/database.js'); const d = new db(); console.log('Últimos 5 tickets:'); d.db.prepare('SELECT code, amount, currency, estado, sincronizado, fecha_emision FROM tickets ORDER BY id DESC LIMIT 5').all().forEach(t => console.log(\`  \${t.code}: \${t.currency} \${t.amount} - \${t.estado} (sync:\${t.sincronizado})\`)); d.close();"
```

---

## PROBLEMAS COMUNES Y SOLUCIONES

### PROBLEMA 1: Tickets no suben a Supabase

**Síntomas**:
- `sync:get-pending-count` retorna count > 0 siempre
- Logs no muestran "✅ [Sync Worker] Ticket X sincronizado"

**Diagnóstico**:
```javascript
// DevTools Console
await window.electron.ipcRenderer.invoke('sync:force-sync');
// Ver logs en Electron Console
```

**Posibles causas**:
1. **Supabase no conectado**: Verificar comando #1
2. **Worker no corre**: Buscar "Worker de sincronización iniciado" en logs
3. **Error en subida**: Buscar "❌ [Sync Worker] Error" en logs

**Solución**:
- Si Supabase no conectado: Revisar `.env` y red
- Si worker no corre: Verificar `startSyncWorker()` en `main.js`
- Si errores: Leer mensaje completo, puede ser problema de campos

---

### PROBLEMA 2: Tickets no descargan de Supabase

**Síntomas**:
- Ticket creado en PC A no aparece en PC B
- No hay logs "📥 [Sync Worker] Descargando X tickets"

**Diagnóstico**:
```bash
# Verificar si Tarea 1 está implementada
grep -n "DESCARGAR TICKETS NUEVOS" "c:\appCasino\pure\main.js"
# Si retorna línea: Implementado
# Si no retorna nada: NO IMPLEMENTADO
```

**Solución**:
- Si NO implementado: Seguir `CODIGO_TAREA_1_DESCARGA_PERIODICA.md`
- Si implementado: Verificar logs para errores específicos

---

### PROBLEMA 3: Error "no such column: created_at"

**Síntomas**:
- Error en logs al cargar estadísticas
- Caja no carga datos

**Diagnóstico**:
```bash
node -e "const db = require('./Caja/database.js'); const d = new db(); const cols = d.db.prepare('PRAGMA table_info(tickets)').all().map(c => c.name); console.log('Tiene created_at?', cols.includes('created_at')); console.log('Tiene fecha_emision?', cols.includes('fecha_emision')); d.close();"
```

**Solución**:
- Si `created_at: false` y `fecha_emision: true`:
  - Implementar Tarea 2 (Unificar nombres)
  - O cambiar queries a usar `fecha_emision`

---

### PROBLEMA 4: App lenta al abrir Caja

**Síntomas**:
- Caja tarda > 5 segundos en cargar
- UI se congela

**Diagnóstico**:
```javascript
// DevTools Console
console.time('stats-load');
await window.electron.getStatsToday();
console.timeEnd('stats-load');
// Si > 1000ms: Problema
```

**Posibles causas**:
1. **Esperando Supabase**: Handler lee de cloud en lugar de SQLite
2. **Tabla muy grande**: Miles de tickets sin índices
3. **Query ineficiente**: JOIN o subqueries complejas

**Solución**:
- Verificar handler `get-stats-today` NO usa `supabaseManager`
- Si usa Supabase: BUG, debe leer solo de SQLite
- Si tabla grande: Implementar Tarea 3 (índices)

---

### PROBLEMA 5: Tickets duplicados

**Síntomas**:
- Mismo código de ticket aparece 2+ veces
- Error "UNIQUE constraint failed: tickets.code"

**Diagnóstico**:
```bash
node -e "const db = require('./Caja/database.js'); const d = new db(); console.log('Tickets duplicados:'); d.db.prepare('SELECT code, COUNT(*) as count FROM tickets GROUP BY code HAVING count > 1').all().forEach(t => console.log(\`  \${t.code}: \${t.count} veces\`)); d.close();"
```

**Posibles causas**:
1. **Colisión de IDs**: Dos PCs generan mismo código
2. **Descarga duplicada**: Worker inserta sin verificar existencia

**Solución**:
- **Colisión de IDs**: Agregar prefijo por PC (ver ANALISIS, Riesgo 1)
  ```javascript
  // database.js, generateTicketCode()
  return `PREV${mesaId}-${numero}`; // Ejemplo: PREV01-001234
  ```
- **Descarga duplicada**: Código de Tarea 1 YA verifica con:
  ```javascript
  const existing = db.db.prepare('SELECT id FROM tickets WHERE code = ?').get(voucherCode);
  if (existing) { /* UPDATE */ } else { /* INSERT */ }
  ```

---

### PROBLEMA 6: Base de datos corrupta

**Síntomas**:
- Error "database disk image is malformed"
- App no inicia

**Diagnóstico**:
```bash
cd "c:\appCasino\data"
sqlite3 casino.db "PRAGMA integrity_check;"
# Esperado: ok
```

**Solución**:
1. **Restaurar backup**:
   ```bash
   cd "c:\appCasino\Caja\backups"
   dir /o-d casino_backup_*.db
   # Copiar el más reciente a data/casino.db
   copy casino_backup_YYYY-MM-DD*.db ..\data\casino.db
   ```

2. **Si no hay backup**: Recrear desde Supabase
   ```bash
   # Eliminar BD corrupta
   del "c:\appCasino\data\casino.db"
   # Reiniciar app (crea BD nueva)
   npm start
   # Forzar descarga de Supabase
   # En DevTools:
   await window.electron.ipcRenderer.invoke('sync:force-sync');
   ```

---

## VERIFICACIÓN DE HEALTH

### Checklist de salud del sistema

```bash
# Ejecutar todos estos comandos y verificar resultados

# 1. Supabase conectado
node -e "const { getSupabaseManager } = require('./pure/supabaseManager.js'); const sm = getSupabaseManager(); sm.testConnection().then(ok => console.log('Supabase OK:', ok));"

# 2. SQLite funcional
node -e "const db = require('./Caja/database.js'); const d = new db(); console.log('SQLite OK:', !!d.db); d.close();"

# 3. Tabla tickets existe
node -e "const db = require('./Caja/database.js'); const d = new db(); console.log('Tabla tickets OK:', !!d.db.prepare('SELECT name FROM sqlite_master WHERE type=\"table\" AND name=\"tickets\"').get()); d.close();"

# 4. Columna sincronizado existe
node -e "const db = require('./Caja/database.js'); const d = new db(); console.log('Columna sincronizado OK:', d.db.prepare('PRAGMA table_info(tickets)').all().some(c => c.name === 'sincronizado')); d.close();"

# 5. Worker implementado (buscar función)
grep -c "startSyncWorker" "c:\appCasino\pure\main.js"
# Esperado: > 0

# 6. Tarea 1 implementada (descarga)
grep -c "DESCARGAR TICKETS NUEVOS" "c:\appCasino\pure\main.js"
# Esperado: > 0 (si implementada)
```

**Resultado esperado**: Todos "OK: true" o valores > 0

---

## LOGS IMPORTANTES A BUSCAR

### Logs de éxito (BUENOS)

```
✅ Cliente Supabase SERVICE_ROLE inicializado
✅ Worker de sincronización iniciado (intervalo: 2 minutos)
✅ Ticket guardado en Supabase: PREV-XXXXXX
✅ Ticket guardado en SQLite: PREV-XXXXXX sincronizado: SI
✅ [Sync Worker] Ticket PREV-XXXXXX sincronizado
✅ [Sync Worker - Descarga] X nuevos, Y actualizados
```

### Logs de advertencia (REVISAR)

```
⚠️  Supabase no disponible, modo offline
⚠️  Error guardando en Supabase: [mensaje]
⚠️  Error en SQLite pero ticket guardado en Supabase
⚠️  No se pudo marcar como sincronizado: PREV-XXXXXX
```

### Logs de error (CRÍTICOS)

```
❌ Error inicializando Supabase: [mensaje]
❌ Error guardando en SQLite: [mensaje]
❌ [Sync Worker] Error crítico en worker de sincronización
❌ Error en descarga de Supabase: [mensaje]
❌ No se pudo guardar en ninguna base de datos
```

---

## COMANDOS DE EMERGENCIA

### Forzar sincronización completa

```javascript
// DevTools Console
console.log('Iniciando sincronización forzada...');
const result = await window.electron.ipcRenderer.invoke('sync:force-sync');
console.log('Resultado:', result);
// Ver logs en Electron Console para detalles
```

### Limpiar tickets pendientes manualmente

```bash
# CUIDADO: Solo usar si tickets son inválidos/duplicados
node -e "const db = require('./Caja/database.js'); const d = new db(); console.log('Antes:', d.db.prepare('SELECT COUNT(*) as count FROM tickets WHERE sincronizado = 0').get()); d.db.prepare('UPDATE tickets SET sincronizado = 1 WHERE id IN (SELECT id FROM tickets WHERE sincronizado = 0 LIMIT 10)').run(); console.log('Después:', d.db.prepare('SELECT COUNT(*) as count FROM tickets WHERE sincronizado = 0').get()); d.close();"
```

### Reiniciar contador de tickets

```bash
# Solo si quieres reiniciar numeración
node -e "const db = require('./Caja/database.js'); const d = new db(); d.setConfig('ultimo_numero', '1000'); console.log('Contador reiniciado a 1000'); d.close();"
```

### Backup inmediato

```bash
node -e "const db = require('./Caja/database.js'); const d = new db(); const path = d.backup(); console.log('Backup creado en:', path); d.close();"
```

---

## INTERPRETACIÓN DE RESULTADOS

### Escenario 1: Todo funciona
```
Supabase OK: true
SQLite OK: true
Tabla tickets OK: true
Columna sincronizado OK: true
Pendientes: 0
Logs: ✅ Worker de sincronización iniciado
```
**Estado**: ✅ SALUDABLE

---

### Escenario 2: Modo offline
```
Supabase OK: false
SQLite OK: true
Pendientes: 15
Logs: ⚠️ Supabase no disponible, modo offline
```
**Estado**: ⚠️ FUNCIONAL (modo offline)
**Acción**: Verificar red, tickets subirán cuando vuelva conexión

---

### Escenario 3: Sincronización atascada
```
Supabase OK: true
SQLite OK: true
Pendientes: 50 (no baja)
Logs: ❌ [Sync Worker] Error sincronizando ticket
```
**Estado**: ❌ PROBLEMA
**Acción**: Leer error específico en logs, puede ser campo faltante en Supabase

---

### Escenario 4: Worker no corre
```
Supabase OK: true
SQLite OK: true
Pendientes: 10
Logs: (Sin "Worker de sincronización iniciado")
```
**Estado**: ❌ PROBLEMA CRÍTICO
**Acción**: Verificar `startSyncWorker()` se llama en `main.js`

---

## PRÓXIMOS PASOS SEGÚN DIAGNÓSTICO

### Si todo está OK (Escenario 1)
→ Continuar con Tarea 1 (si no implementada)
→ O ejecutar Tests completos (Fase 2, Tarea 3)

### Si modo offline (Escenario 2)
→ Verificar conexión de red
→ Verificar `.env` tiene credenciales correctas
→ Reiniciar app después de solucionar

### Si sincronización atascada (Escenario 3)
→ Leer error completo en logs
→ Verificar esquema de tabla `vouchers` en Supabase
→ Forzar sync manual para ver error específico

### Si worker no corre (Escenario 4)
→ Verificar `main.js` llama `startSyncWorker()`
→ Verificar no hay errores de sintaxis en `main.js`
→ Reiniciar app después de corregir

---

## CONTACTO Y SOPORTE

**Documentos de referencia**:
- Análisis completo: `ANALISIS_VIABILIDAD_DUAL_DB_ARQUITECTURA.md`
- Resumen ejecutivo: `RESUMEN_ARQUITECTURA_DUAL_DB.md`
- Código Tarea 1: `CODIGO_TAREA_1_DESCARGA_PERIODICA.md`
- Checklist: `CHECKLIST_IMPLEMENTACION_DUAL_DB.md`

**Herramientas útiles**:
- SQLite Browser: https://sqlitebrowser.org/
- Supabase Dashboard: https://app.supabase.com/
- DevTools Electron: Ctrl+Shift+I

---

**Última actualización**: 2025-11-07
**Versión**: 1.0
