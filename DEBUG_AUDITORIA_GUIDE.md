# 🐛 Guía de Debugging - Módulo de Auditoría

**Fecha:** 2025-10-29
**Estado:** Sistema con logging extensivo implementado

---

## 📋 Cambios Implementados

### Backend (pure/main.js)

#### Handler: `get-audit-stats` (líneas 813-877)
✅ **Logging agregado:**
- Log al iniciar la consulta con fecha solicitada
- Log del rango de fechas calculado (startOfDay, endOfDay)
- Log de intentos de Supabase con cantidad de vouchers
- Log de fallback a SQLite con cantidad de tickets
- Log de errores detallados con stack trace
- Log de estadísticas calculadas antes de retornar

#### Handler: `get-audit-tickets` (líneas 922-1006)
✅ **Logging agregado:**
- Log de todos los filtros recibidos
- Log de parámetros extraídos (fechaDesde, fechaHasta, estado, etc.)
- Log de consulta a Supabase con cantidad retornada
- Log de fallback a SQLite
- Log de paginación (offset, limit)
- Log de errores detallados con stack trace

### Frontend (pure/auditor.html)

#### Función: `cargarEstadisticas()` (líneas 197-237)
✅ **Logging agregado:**
- Log al llamar al handler
- Verificación de window.api disponible
- Log de respuesta completa del backend
- Log de estadísticas recibidas
- Log de errores con stack trace

#### Función: `cargarTickets()` (líneas 242-291)
✅ **Logging agregado:**
- Log de página solicitada
- Log de filtros actuales en formato JSON
- Verificación de window.api disponible
- Log de parámetros enviados al backend
- Log de respuesta completa
- Log de cantidad de tickets recibidos
- Log de fuente de datos (supabase/sqlite)
- Log de primeros 3 tickets para inspección
- Log de errores con stack trace

#### Función: `mostrarTickets()` (líneas 296-358)
✅ **Logging agregado:**
- Log de cantidad de tickets a mostrar
- Verificación de elemento DOM tabla-tickets
- Log al renderizar estado vacío
- Log al renderizar filas
- Log del primer ticket como ejemplo
- Log de finalización exitosa

#### Función: `exportarReporte()` (líneas 374-417)
✅ **Logging agregado:**
- Log de filtros para exportar
- Verificación de window.api disponible
- Log de respuesta del handler
- Log de archivo generado (nombre, ruta, total registros)
- Log al abrir ubicación del archivo
- Log de errores con stack trace

#### Inicialización: `DOMContentLoaded` (líneas 504-519)
✅ **Logging agregado:**
- Log de inicio del módulo
- Verificación de window.api y window.api.invoke
- Log de fecha por defecto establecida
- Log antes de cargar datos iniciales

---

## 🔍 Cómo Usar el Logging

### 1. Abrir DevTools
```
Electron App → F12 o Ctrl+Shift+I
```

### 2. Ver Console
```
Abrir tab "Console" en DevTools
```

### 3. Logs Esperados al Abrir Auditoría

#### A. Inicialización
```
🚀 [Frontend] Módulo de Auditoría iniciando...
🚀 [Frontend] window.api disponible: true
🚀 [Frontend] window.api.invoke disponible: true
🚀 [Frontend] Fecha por defecto establecida: 2025-10-29
🚀 [Frontend] Cargando estadísticas y tickets iniciales...
```

#### B. Carga de Estadísticas
```
📊 [Frontend] Llamando a get-audit-stats...
📊 [Frontend] Respuesta de get-audit-stats: {...}
📊 [Frontend] Estadísticas recibidas: {...}
✅ [Frontend] Tabla renderizada con X tickets
```

**En el backend:**
```
📊 [Auditoría] Obteniendo estadísticas...
📊 [Auditoría] Fecha solicitada: HOY
📊 [Auditoría] Rango de fechas: {...}
📊 [Auditoría] Consultando Supabase...
📊 [Auditoría] Supabase retornó X vouchers
✅ Estadísticas obtenidas de Supabase: {...}
```

#### C. Carga de Tickets
```
📋 [Frontend] Llamando a get-audit-tickets...
📋 [Frontend] Página solicitada: 1
📋 [Frontend] Filtros actuales: {...}
📋 [Frontend] Parámetros enviados: {...}
📋 [Frontend] Respuesta de get-audit-tickets: {...}
📋 [Frontend] Tickets recibidos: X de Y totales
📋 [Frontend] Fuente de datos: supabase
📋 [Frontend] Primeros 3 tickets: [...]
```

**En el backend:**
```
📋 [Auditoría] Obteniendo tickets con filtros: {...}
📋 [Auditoría] Parámetros extraídos: {...}
📋 [Auditoría] Consultando Supabase...
📋 [Auditoría] Supabase retornó X vouchers de Y totales
✅ [Auditoría] Tickets mapeados: [...]
```

#### D. Renderizado en Tabla
```
🎨 [Frontend] Mostrando tickets en tabla...
🎨 [Frontend] Cantidad de tickets a mostrar: X
🎨 [Frontend] Renderizando X filas en tabla
🎨 [Frontend] Ejemplo de ticket renderizado: {...}
✅ [Frontend] Tabla renderizada con X tickets
```

#### E. Exportar CSV
```
📥 [Frontend] Llamando a export-audit-report...
📥 [Frontend] Filtros para exportar: {...}
📥 [Frontend] Respuesta de export-audit-report: {...}
✅ [Frontend] Reporte exportado exitosamente
📥 [Frontend] Archivo: auditoria_2025-10-29.csv
📥 [Frontend] Ruta completa: C:\appCasino\exports\...
📥 [Frontend] Registros exportados: X
📂 [Frontend] Abriendo ubicación del archivo...
```

---

## 🐛 Diagnóstico de Problemas

### Problema 1: Módulo no carga nada

**Síntomas:**
- Pantalla vacía
- Sin números en estadísticas
- Tabla vacía

**Revisar en Console:**
```
1. ¿Aparece "🚀 [Frontend] Módulo de Auditoría iniciando..."?
   NO → Problema en inicialización del HTML
   SÍ → Continuar

2. ¿window.api.invoke disponible: true?
   NO → Problema en preload.js o IPC
   SÍ → Continuar

3. ¿Aparece "📊 [Frontend] Llamando a get-audit-stats..."?
   NO → Función no se ejecuta
   SÍ → Continuar

4. ¿Aparece respuesta del backend?
   NO → Handler no está registrado o no responde
   SÍ → Ver qué contiene la respuesta
```

### Problema 2: Backend retorna 0 resultados

**Síntomas:**
- Console muestra: "Supabase retornó 0 vouchers"
- Console muestra: "SQLite retornó 0 tickets"

**Posibles causas:**
```
1. No hay datos en la BD para esa fecha
   → Verificar con query directo a Supabase/SQLite

2. Problema con filtro de fechas
   → Revisar log "Rango de fechas: {...}"
   → Verificar que startOfDay/endOfDay sean correctos

3. Tabla incorrecta
   → Verificar que existe tabla "vouchers" en Supabase
   → Verificar que existe tabla "tickets" en SQLite
```

### Problema 3: Error en Supabase

**Síntomas:**
- Console muestra: "⚠️ [Auditoría] Error en Supabase: ..."

**Revisar:**
```
1. ¿Supabase está conectado?
   → Verificar SUPABASE_URL y SUPABASE_KEY en .env

2. ¿Existe tabla "vouchers"?
   → Ejecutar: SELECT * FROM vouchers LIMIT 1;

3. ¿Permisos correctos?
   → Verificar políticas RLS en Supabase
```

### Problema 4: Tickets no se muestran en tabla

**Síntomas:**
- Backend retorna tickets correctamente
- Tabla sigue vacía

**Revisar en Console:**
```
1. ¿Aparece "🎨 [Frontend] Mostrando tickets en tabla..."?
   NO → mostrarTickets() no se llama
   SÍ → Continuar

2. ¿Aparece "Cantidad de tickets a mostrar: X" con X > 0?
   NO → Array de tickets está vacío
   SÍ → Continuar

3. ¿Aparece error de DOM?
   → Verificar que existe <tbody id="tabla-tickets">
```

### Problema 5: Exportar no funciona

**Síntomas:**
- Click en "Exportar CSV" no hace nada
- No se abre archivo

**Revisar en Console:**
```
1. ¿Aparece "📥 [Frontend] Llamando a export-audit-report..."?
   NO → Event listener no registrado
   SÍ → Continuar

2. ¿Backend responde con success: true?
   NO → Ver error del backend
   SÍ → Continuar

3. ¿Aparece filepath en respuesta?
   NO → CSV no se generó
   SÍ → Verificar que archivo existe en esa ruta
```

---

## 🧪 Pruebas Paso a Paso

### Test 1: Verificar Datos en Supabase
```sql
-- En Supabase SQL Editor:
SELECT COUNT(*) as total FROM vouchers;
SELECT * FROM vouchers ORDER BY issued_at DESC LIMIT 5;
```

**Resultado esperado:** Debe haber al menos 1 voucher.

### Test 2: Verificar Datos en SQLite
```bash
# En terminal:
cd C:\appCasino
sqlite3 tito.db
```
```sql
SELECT COUNT(*) as total FROM tickets;
SELECT * FROM tickets ORDER BY created_at DESC LIMIT 5;
.quit
```

**Resultado esperado:** Debe haber al menos 1 ticket.

### Test 3: Verificar Handlers Registrados
```javascript
// En DevTools Console (cuando app está corriendo):
console.log(Object.keys(require('electron').ipcMain._events));
```

**Resultado esperado:** Debe incluir:
- `get-audit-stats`
- `get-audit-tickets`
- `export-audit-report`

### Test 4: Flujo Completo Mesa → Caja → Auditoría

#### Paso 1: Crear ticket en Mesa
```
1. Abrir pure/mesa.html
2. Crear voucher:
   - Valor: 100.00
   - Moneda: DOP
   - Mesa: P01
   - Operador: (seleccionar uno)
3. Emitir → Debe generar código PREV-XXXXXX
```

#### Paso 2: Canjear en Caja
```
1. Abrir Caja/caja.html
2. Validar código PREV-XXXXXX
3. Canjear y pagar
```

#### Paso 3: Verificar en Auditoría
```
1. Abrir pure/auditor.html
2. Verificar que aparece en estadísticas:
   - Total: debe incrementar
   - Canjeados: debe incrementar
   - Total DOP: debe incrementar
3. Verificar que aparece en tabla
4. Exportar CSV y verificar que incluye el ticket
```

---

## 🔧 Soluciones Rápidas

### Si window.api no está disponible

**Verificar preload.js:**
```javascript
// Debe tener:
contextBridge.exposeInMainWorld('api', {
  invoke: (channel, data) => ipcRenderer.invoke(channel, data)
});
```

### Si handlers no responden

**Verificar que estén registrados en pure/main.js:**
```javascript
ipcMain.handle('get-audit-stats', async (event, fecha) => { ... });
ipcMain.handle('get-audit-tickets', async (event, filtros) => { ... });
ipcMain.handle('export-audit-report', async (event, filtros) => { ... });
```

### Si Supabase no conecta

**Verificar .env:**
```
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_KEY=eyJxxxxx...
```

**Verificar en pure/main.js:**
```javascript
const supabaseManager = new SupabaseManager(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);
```

---

## 📊 Próximos Pasos

### 1. Probar con esta configuración de logging
- Reiniciar app
- Abrir auditor.html con DevTools
- Revisar todos los logs en Console
- Identificar exactamente dónde falla

### 2. Agregar botones PDF (pendiente)
- "Ver PDF" - Mostrar reporte en pantalla
- "Imprimir PDF" - Imprimir directamente

### 3. Optimizaciones (opcional)
- Cache de estadísticas
- Auto-refresh cada X segundos
- Gráficos visuales

---

## 📞 Contacto para Debugging

**Si encuentras un error específico:**
1. Copiar TODOS los logs de Console
2. Copiar mensaje de error exacto
3. Describir qué estabas haciendo
4. Indicar si es Supabase o SQLite

**Información útil:**
- Versión de Electron
- Sistema operativo
- Última acción antes del error
- Screenshots de Console

---

✅ **Sistema de logging completo implementado**
🔍 **Listo para debugging exhaustivo**
