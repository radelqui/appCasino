# Módulo de Auditoría - Solo Lectura

Sistema de auditoría con acceso de solo lectura para supervisar tickets sin capacidad de modificación.

---

## 🎯 Propósito

El módulo de auditoría permite a los supervisores/auditores:
- ✅ **VER** todos los tickets del sistema
- ✅ **FILTRAR** por fecha, estado, moneda, mesa, operador
- ✅ **EXPORTAR** reportes a CSV/Excel
- ✅ **MONITOREAR** estadísticas en tiempo real

**Restricciones de seguridad:**
- ❌ **NO** puede crear tickets
- ❌ **NO** puede modificar tickets
- ❌ **NO** puede canjear tickets
- ❌ **NO** puede cancelar tickets
- 🔒 **SOLO LECTURA** - Sin capacidad de escritura

---

## 📊 Interfaz

### Dashboard con Estadísticas del Día

```
┌──────────────────────────────────────────────────────────────┐
│ 📊 Auditoría  🔒 Solo Lectura                               │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ TOTAL    │  │ EMITIDOS │  │ CANJEADOS│  │PENDIENTES│   │
│  │   125    │  │    45    │  │    80    │  │    45    │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│                                                              │
│  ┌──────────┐  ┌──────────┐                                │
│  │TOTAL DOP │  │TOTAL USD │                                │
│  │$50,250.00│  │ $2,500.00│                                │
│  └──────────┘  └──────────┘                                │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Filtros de Búsqueda

```
┌──────────────────────────────────────────────────────────────┐
│ Filtros de Búsqueda                                          │
├──────────────────────────────────────────────────────────────┤
│ Fecha Desde: [2024-01-15]  Fecha Hasta: [2024-01-15]       │
│ Estado:      [Todos ▼]     Moneda:      [Todas ▼]          │
│ Mesa:        [P01____]     Operador:    [Juan Pérez______]  │
│                                                              │
│ [🔍 Buscar] [🔄 Limpiar Filtros]       [📥 Exportar a CSV] │
└──────────────────────────────────────────────────────────────┘
```

### Tabla de Tickets (Paginada)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Listado de Tickets                                                           │
├──────────┬─────────┬────────┬─────────┬──────┬──────────┬───────────────────┤
│ Código   │ Monto   │ Moneda │ Estado  │ Mesa │ Operador │ Fecha Emisión     │
├──────────┼─────────┼────────┼─────────┼──────┼──────────┼───────────────────┤
│PREV-12345│ 100.50  │  DOP   │ Emitido │ P01  │Juan Pérez│ 2024-01-15 10:30 │
│PREV-12346│ 250.00  │  USD   │Canjeado │ P02  │María L.  │ 2024-01-15 11:00 │
│PREV-12347│  50.00  │  DOP   │Pendiente│ P03  │Carlos R. │ 2024-01-15 11:15 │
└──────────┴─────────┴────────┴─────────┴──────┴──────────┴───────────────────┘

                    [«] [‹] Página 1 de 7 [›] [»]
```

---

## 🔧 Implementación Técnica

### Archivos Creados/Modificados

#### 1. [Auditoria/auditoria.html](Auditoria/auditoria.html) - Interfaz Principal (NUEVO)

**Secciones:**
- **Header**: Título con badge "🔒 Solo Lectura" y botón "Volver al Panel"
- **Estadísticas**: 6 cards con métricas del día (Total, Emitidos, Canjeados, Pendientes, Total DOP, Total USD)
- **Filtros**: 6 campos (Fecha Desde, Fecha Hasta, Estado, Moneda, Mesa, Operador)
- **Tabla**: Listado paginado de tickets (20 por página)
- **Paginación**: Controles de navegación (Primera, Anterior, Siguiente, Última)
- **Exportación**: Botón para generar CSV

**Características:**
- ✅ Diseño responsive
- ✅ Estilos dark mode consistentes con el resto del sistema
- ✅ Badges de colores por estado
- ✅ Mensajes de estado (success, error, info)
- ✅ Estado vacío con iconos SVG
- ✅ Formateo de fechas localizadas (es-DO)
- ✅ Tabla con scroll horizontal/vertical

#### 2. [pure/main.js](pure/main.js) - Handlers IPC (líneas 808-1092)

**Handlers Implementados:**

##### Handler 1: `get-audit-stats` (líneas 813-852)
```javascript
ipcMain.handle('get-audit-stats', async (event, fecha = null) => {
  // 1. Calcular rango del día (startOfDay, endOfDay)
  // 2. Intentar obtener de Supabase primero
  // 3. Fallback a SQLite si Supabase no disponible
  // 4. Calcular estadísticas con calcularEstadisticas()
  // 5. Retornar { success, stats, source }
});
```

**Estadísticas Calculadas:**
```javascript
{
  total: 125,           // Total de tickets
  emitidos: 45,         // Tickets en estado emitido/active/activo
  canjeados: 80,        // Tickets en estado canjeado/redeemed
  cancelados: 0,        // Tickets cancelados
  pendientes: 45,       // Tickets aún no canjeados
  totalDOP: "50250.00", // Suma de montos en DOP
  totalUSD: "2500.00",  // Suma de montos en USD
  canjeadosDOP: "35000.00",
  canjeadosUSD: "1500.00",
  pendientesDOP: "15250.00",
  pendientesUSD: "1000.00"
}
```

##### Handler 2: `get-audit-tickets` (líneas 898-1005)
```javascript
ipcMain.handle('get-audit-tickets', async (event, filtros = {}) => {
  // 1. Extraer filtros (fechaDesde, fechaHasta, estado, moneda, mesa, operador, page, limit)
  // 2. Intentar query a Supabase con filtros aplicados
  // 3. Fallback a SQLite con WHERE dinámico
  // 4. Implementar paginación (LIMIT, OFFSET)
  // 5. Contar total de registros
  // 6. Retornar { success, tickets, total, page, totalPages, source }
});
```

**Filtros Soportados:**
- `fechaDesde`: Fecha inicial (ISO 8601)
- `fechaHasta`: Fecha final (ISO 8601)
- `estado`: Estado del ticket (emitido, canjeado, cancelado)
- `moneda`: Moneda (DOP, USD)
- `mesa`: Nombre de mesa (P01, P02, etc)
- `operador`: Nombre del operador
- `page`: Número de página (default: 1)
- `limit`: Registros por página (default: 20)

**Estructura de Respuesta:**
```javascript
{
  success: true,
  tickets: [
    {
      code: "PREV-123456",
      amount: 100.50,
      currency: "DOP",
      estado: "emitido",
      created_at: "2024-01-15T10:30:00Z",
      used_at: null,
      mesa: "P01",
      operador: "Juan Pérez"
    },
    // ... más tickets
  ],
  total: 125,        // Total de tickets (sin paginación)
  page: 1,           // Página actual
  totalPages: 7,     // Total de páginas
  source: "supabase" // o "sqlite"
}
```

##### Handler 3: `export-audit-report` (líneas 1024-1056)
```javascript
ipcMain.handle('export-audit-report', async (event, filtros = {}) => {
  // 1. Obtener TODOS los tickets con filtros (limit: 10000)
  // 2. Generar CSV con generarCSV()
  // 3. Guardar en directorio temporal (os.tmpdir())
  // 4. Retornar { success, filepath, filename }
});
```

**Formato CSV Generado:**
```csv
Código,Monto,Moneda,Estado,Mesa,Operador,Fecha Emisión,Fecha Canje
"PREV-123456","100.50","DOP","emitido","P01","Juan Pérez","2024-01-15T10:30:00Z","-"
"PREV-123457","250.00","USD","canjeado","P02","María López","2024-01-15T11:00:00Z","2024-01-15T14:30:00Z"
```

**Características del CSV:**
- ✅ BOM UTF-8 (`\uFEFF`) para correcta codificación en Excel
- ✅ Headers en español
- ✅ Campos entrecomillados para evitar problemas con comas
- ✅ Formato de fecha ISO 8601
- ✅ Nombre de archivo con timestamp: `auditoria-2024-01-15T10-30-00.csv`

##### Handler 4: `open-file-location` (líneas 1082-1092)
```javascript
ipcMain.handle('open-file-location', async (event, filepath) => {
  // Abre el explorador de archivos en la ubicación del CSV exportado
  const { shell } = require('electron');
  await shell.showItemInFolder(filepath);
});
```

---

## 📝 Funciones Helper

### `calcularEstadisticas(tickets)` (líneas 855-895)
Calcula todas las métricas a partir de un array de tickets.

**Lógica:**
1. Filtrar por estado (emitidos, canjeados, cancelados)
2. Sumar montos por moneda (DOP, USD)
3. Calcular pendientes (emitidos - canjeados)
4. Retornar objeto con todas las estadísticas

### `mapearVouchersSupabase(vouchers)` (líneas 1008-1021)
Convierte estructura de Supabase a formato esperado por frontend.

**Mapeo:**
- `voucher_code` → `code`
- `issued_at` → `created_at`
- `redeemed_at` → `used_at`
- `status` → `estado` (con traducción: active→emitido, redeemed→canjeado)
- `issued_by_user.username` → `operador`
- `issued_at_station.name` → `mesa`

### `generarCSV(tickets)` (líneas 1059-1079)
Genera string CSV a partir de array de tickets.

**Proceso:**
1. Definir headers en español
2. Mapear cada ticket a fila
3. Entrecomillar campos
4. Unir con comas y saltos de línea
5. Agregar BOM UTF-8

---

## 🚀 Flujo de Uso

### Escenario 1: Supervisor revisa tickets del día

```
1. Supervisor abre Auditoria/auditoria.html
2. Sistema carga automáticamente:
   - Estadísticas del día actual
   - Tickets del día actual (página 1)
3. Dashboard muestra:
   - 125 tickets emitidos hoy
   - 80 ya canjeados
   - 45 pendientes
   - Total: $50,250 DOP, $2,500 USD
4. Tabla muestra primeros 20 tickets
5. Supervisor navega entre páginas [›] [»]
```

### Escenario 2: Buscar tickets de un operador específico

```
1. En filtros:
   - Fecha Desde: 2024-01-10
   - Fecha Hasta: 2024-01-15
   - Operador: "Juan Pérez"
2. Click [🔍 Buscar]
3. Sistema muestra:
   - Solo tickets de Juan Pérez en ese rango
   - Estadísticas actualizadas para esos tickets
   - Total: 38 tickets encontrados
   - 2 páginas (20 tickets por página)
```

### Escenario 3: Exportar reporte mensual

```
1. En filtros:
   - Fecha Desde: 2024-01-01
   - Fecha Hasta: 2024-01-31
   - Estado: Todos
2. Click [📥 Exportar a CSV]
3. Sistema:
   - Obtiene TODOS los tickets del mes (sin paginación)
   - Genera archivo CSV
   - Guarda en: C:\Users\...\Temp\auditoria-2024-01-31T16-45-00.csv
   - Abre explorador de archivos en esa ubicación
4. Supervisor abre CSV en Excel y analiza
```

### Escenario 4: Verificar tickets pendientes de canje

```
1. En filtros:
   - Estado: Emitido
2. Click [🔍 Buscar]
3. Tabla muestra SOLO tickets pendientes
4. Supervisor identifica:
   - Tickets antiguos sin canjear
   - Montos altos pendientes
   - Operadores con más tickets sin canjear
```

---

## 🧪 Pruebas

### Test 1: Cargar Estadísticas del Día
```
1. Abrir Auditoria/auditoria.html
2. Console debe mostrar: "📊 Cargando estadísticas..."
3. Cards deben mostrar números > 0 (si hay tickets hoy)
4. Console debe mostrar: "✅ Estadísticas obtenidas de Supabase" o "SQLite"
```

### Test 2: Filtrar por Fecha
```
1. Establecer:
   - Fecha Desde: ayer
   - Fecha Hasta: hoy
2. Click [Buscar]
3. Tabla debe mostrar solo tickets de esas fechas
4. Paginación debe actualizarse
```

### Test 3: Exportar CSV
```
1. Click [📥 Exportar a CSV]
2. Debe aparecer mensaje: "📥 Generando reporte..."
3. Luego: "✅ Reporte exportado: auditoria-..."
4. Explorador de archivos debe abrirse
5. Archivo CSV debe existir y abrirse en Excel
6. Datos deben estar correctamente formateados
```

### Test 4: Paginación
```
1. Filtrar para obtener > 20 tickets
2. Verificar controles de paginación habilitados
3. Click [›] Siguiente
4. Tabla debe mostrar tickets 21-40
5. Page info debe mostrar: "Página 2 de N"
6. Click [«] Primera
7. Debe volver a página 1
```

### Test 5: Estado Vacío
```
1. Filtrar por:
   - Fecha: año 2000 (sin tickets)
2. Click [Buscar]
3. Tabla debe mostrar:
   - Icono SVG de documento
   - "No se encontraron tickets"
   - "Intenta con otros filtros o fechas"
```

---

## 🔒 Seguridad y Restricciones

### Restricciones Implementadas

**1. Sin Capacidad de Escritura**
```javascript
// ❌ NO HAY handlers de escritura en auditoría
// ❌ NO existe: create-ticket, update-ticket, delete-ticket
// ❌ NO existe: redeem-ticket, cancel-ticket
// ✅ SOLO handlers de lectura: get-audit-stats, get-audit-tickets
```

**2. Interfaz de Solo Lectura**
```javascript
// ❌ NO HAY botones de acción (Emitir, Canjear, Cancelar)
// ❌ NO HAY campos de input para modificar tickets
// ✅ SOLO vista de tabla con datos de lectura
// ✅ Badge "🔒 Solo Lectura" visible en header
```

**3. Sin Acceso a Funciones Sensibles**
```javascript
// ❌ NO puede acceder a:
//   - Emisión de tickets (pure/mesa.html)
//   - Canje de tickets (Caja/caja.html)
//   - Gestión de operadores (pure/operadores.html)
// ✅ SOLO puede ver: Auditoria/auditoria.html
```

### Futuro: Control de Acceso por Rol

```javascript
// TODO: Implementar verificación de rol
ipcMain.handle('get-audit-stats', async (event) => {
  // Verificar que el usuario tiene rol AUDITOR o ADMIN
  const currentRole = await getUserRole();
  if (!['AUDITOR', 'ADMIN'].includes(currentRole)) {
    return { success: false, error: 'No autorizado - Solo auditores' };
  }

  // ... resto del código
});
```

---

## 📊 Métricas y Estadísticas

### Estadísticas Disponibles

**Cards del Dashboard:**
1. **Total Tickets**: Cantidad total de tickets en el período
2. **Emitidos**: Tickets en estado emitido/active/activo
3. **Canjeados**: Tickets en estado canjeado/redeemed
4. **Pendientes**: Emitidos - Canjeados
5. **Total DOP**: Suma de montos en pesos dominicanos
6. **Total USD**: Suma de montos en dólares

**Cálculos Adicionales (para futuro):**
- Canjeados DOP/USD
- Pendientes DOP/USD
- Promedio de monto por ticket
- Tickets por operador
- Tickets por mesa
- Tickets por hora del día

### Exportaciones Disponibles

**CSV Actual:**
- Formato: Código, Monto, Moneda, Estado, Mesa, Operador, Fecha Emisión, Fecha Canje
- Encoding: UTF-8 con BOM (compatible con Excel)
- Separador: Coma (`,`)
- Ubicación: Directorio temporal del sistema

**Futuras Mejoras:**
- ⏳ Exportar a Excel (.xlsx) con formato
- ⏳ Exportar a PDF con gráficos
- ⏳ Programar exportaciones automáticas (diarias, semanales)
- ⏳ Enviar reportes por email

---

## 🛠️ Troubleshooting

### Problema 1: No se cargan estadísticas
```
SÍNTOMA: Cards muestran "0" en todo
CAUSA: Supabase no disponible Y SQLite vacío
SOLUCIÓN:
1. Verificar conexión a Supabase
2. Verificar que existen tickets en la fecha seleccionada
3. Revisar console para ver errores
```

### Problema 2: CSV no se abre en Excel
```
SÍNTOMA: Excel muestra caracteres extraños
CAUSA: Encoding incorrecto
SOLUCIÓN:
1. Verificar que el CSV tiene BOM UTF-8 (\uFEFF)
2. Abrir CSV con: Excel → Datos → Desde Texto → UTF-8
```

### Problema 3: Paginación no funciona
```
SÍNTOMA: Botones [›] [»] deshabilitados
CAUSA: totalPages calculado incorrectamente
SOLUCIÓN:
1. Verificar que el handler retorna count correcto
2. Revisar cálculo: Math.ceil(total / limit)
3. Verificar que total > limit
```

### Problema 4: Filtros no aplican
```
SÍNTOMA: Buscar muestra mismos resultados
CAUSA: Filtros no se pasan correctamente al handler
SOLUCIÓN:
1. Verificar console.log de currentFilters
2. Verificar que handler recibe filtros
3. Verificar query WHERE dinámico en SQLite
```

---

## 📚 Referencias

### Archivos Relacionados:
- [pure/main.js](pure/main.js) - Handlers IPC (líneas 808-1092)
- [Auditoria/auditoria.html](Auditoria/auditoria.html) - Interfaz principal
- [pure/supabaseManager.js](pure/supabaseManager.js) - Cliente Supabase
- [Caja/database.js](Caja/database.js) - Cliente SQLite

### Tablas de Datos:
- **Supabase**: `vouchers` (con relaciones a `users` y `stations`)
- **SQLite**: `tickets` (local, fallback)

### Tecnologías Utilizadas:
- **Electron IPC**: Comunicación main↔renderer
- **Supabase**: Base de datos cloud PostgreSQL
- **SQLite**: Base de datos local (better-sqlite3)
- **CSV**: Exportación de reportes
- **JavaScript Vanilla**: Sin frameworks en frontend

---

## ✅ Resumen

**Módulo de Auditoría Implementado:**
- ✅ 4 handlers IPC (get-audit-stats, get-audit-tickets, export-audit-report, open-file-location)
- ✅ Interfaz completa con dashboard, filtros, tabla paginada
- ✅ Exportación a CSV con encoding UTF-8
- ✅ Híbrido Supabase + SQLite con fallback
- ✅ Paginación (20 tickets por página)
- ✅ Filtros por fecha, estado, moneda, mesa, operador
- ✅ Estadísticas en tiempo real (6 métricas)
- ✅ Restricción de solo lectura (sin escritura)
- ✅ Documentación completa

**Pendiente:**
- ⏳ Control de acceso por rol (AUDITOR/ADMIN)
- ⏳ Exportación a Excel (.xlsx)
- ⏳ Gráficos de estadísticas
- ⏳ Reportes programados automáticos

**Próximo paso:**
Reiniciar la app y probar el módulo completo.
