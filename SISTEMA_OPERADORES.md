# Sistema de Gestión de Operadores

Sistema centralizado para administrar operadores que emiten vouchers en las mesas del casino.

---

## 🎯 Problema que Resuelve

### ANTES (❌ Malo):
```
┌─────────────────────────────┐
│ Mesa - Emisión de Voucher   │
├─────────────────────────────┤
│ Operador: [___________]     │  ← Escribir manualmente
│           Juan Perez        │  ← Error de escritura
└─────────────────────────────┘

PROBLEMAS:
❌ Errores de escritura ("Juan Perez" vs "Juan Pérez")
❌ Nombres inconsistentes
❌ Más lento (hay que escribir)
❌ No se puede controlar quién emite vouchers
```

### AHORA (✅ Bueno):
```
┌─────────────────────────────────────┐
│ Mesa - Emisión de Voucher           │
├─────────────────────────────────────┤
│ Operador: [▼ Juan Pérez    ]        │  ← Selector dropdown
│           - Juan Pérez               │
│           - María López              │
│           - Carlos Rodríguez         │
└─────────────────────────────────────┘

VENTAJAS:
✅ Sin errores de escritura
✅ Nombres consistentes
✅ Más rápido (solo seleccionar)
✅ Control centralizado desde Admin
✅ Activar/Desactivar operadores
```

---

## 📋 Flujo Completo

### 1️⃣ ADMIN: Agregar Operador
```
Admin abre: pure/operadores.html

┌──────────────────────────────────────────┐
│ 📋 Gestión de Operadores                 │
├──────────────────────────────────────────┤
│ [➕ Agregar Operador]                     │
│                                          │
│ ┌──────────────────────────────────────┐ │
│ │ Nuevo Operador                       │ │
│ │                                      │ │
│ │ Nombre: Pedro García                 │ │
│ │ Mesas:  P01, P02                     │ │
│ │                                      │ │
│ │ [Cancelar] [Guardar]                 │ │
│ └──────────────────────────────────────┘ │
└──────────────────────────────────────────┘

✅ Click "Guardar"
✅ Se crea en Supabase tabla "operadores"
✅ Aparece en la lista de activos
```

### 2️⃣ OPERADOR: Seleccionar en Mesa
```
Operador abre: pure/mesa.html

┌──────────────────────────────────────────┐
│ 🎰 Mesa - Emisión de Vouchers            │
├──────────────────────────────────────────┤
│ Valor:    [100.50]                       │
│ Moneda:   [DOP ▼]                        │
│ Mesa:     [P01]                          │
│ Operador: [▼ Pedro García  ]             │  ← Lista desde Supabase
│           - Juan Pérez                   │
│           - María López                  │
│           - Pedro García    ← Selecciona │
│           - Carlos Rodríguez             │
│                                          │
│ [Emitir Voucher]                         │
└──────────────────────────────────────────┘

✅ Click "Emitir Voucher"
✅ Se crea ticket con operador_nombre: "Pedro García"
```

### 3️⃣ CAJERO: Validar en Caja
```
Cajero abre: Caja/caja.html

┌──────────────────────────────────────────┐
│ 💰 Caja - Validación de Vouchers         │
├──────────────────────────────────────────┤
│ Código: PREV-123456 [Validar]           │
│                                          │
│ ✅ Voucher Válido                         │
│                                          │
│ Monto:    DOP 100.50                     │
│ Mesa:     P01                            │
│ Operador: Pedro García  ← Nombre correcto│
│ Fecha:    2024-01-15 10:30              │
│                                          │
│ [Canjear y Pagar]                        │
└──────────────────────────────────────────┘

✅ Información consistente
✅ Sin errores de escritura
```

---

## 🗄️ Estructura de Datos

### Tabla Supabase: `operadores`

```sql
CREATE TABLE operadores (
  id BIGSERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  activo BOOLEAN DEFAULT true,
  mesas_asignadas TEXT[],        -- ['P01', 'P02', 'P03']
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Ejemplo de Datos:

| id | nombre            | activo | mesas_asignadas  | created_at           |
|----|-------------------|--------|------------------|----------------------|
| 1  | Juan Pérez        | true   | {P01,P02}        | 2024-01-15 10:00:00  |
| 2  | María López       | true   | {P03,P04}        | 2024-01-15 10:00:00  |
| 3  | Pedro García      | true   | {P01,P02}        | 2024-01-15 14:30:00  |
| 4  | Carlos Rodríguez  | true   | {P01,P02,P03,P04}| 2024-01-15 10:00:00  |
| 5  | Ana Martínez      | false  | {P02}            | 2024-01-15 10:00:00  |

**Nota:** Ana Martínez está INACTIVA, por lo que NO aparece en el selector de Mesa.

---

## 🔧 Implementación Técnica

### Archivos Modificados/Creados:

#### 1. [SqulInstrucciones/crear-tabla-operadores.sql](SqulInstrucciones/crear-tabla-operadores.sql)
Script SQL para crear tabla en Supabase.

**Ejecutar en Supabase SQL Editor:**
```sql
CREATE TABLE operadores (...);
INSERT INTO operadores (nombre, activo, mesas_asignadas) VALUES (...);
```

#### 2. [pure/main.js](pure/main.js) - Handlers IPC (líneas 626-806)
**5 handlers agregados:**

- `get-operadores-activos` - Obtener lista para dropdown en Mesa
- `get-all-operadores` - Obtener todos (para Admin)
- `create-operador` - Crear nuevo operador (Solo Admin)
- `update-operador` - Actualizar operador (Solo Admin)
- `toggle-operador` - Activar/Desactivar (Solo Admin)

**Ejemplo de uso:**
```javascript
// En Mesa: Cargar operadores activos
const result = await window.api.invoke('get-operadores-activos');
// result.operadores = [{id: 1, nombre: "Juan Pérez", ...}, ...]

// En Admin: Crear operador
const result = await window.api.invoke('create-operador', {
  nombre: 'Pedro García',
  mesas: ['P01', 'P02']
});
```

#### 3. [pure/mesa.html](pure/mesa.html) - Selector de Operadores
**Cambios:**
- Input text → Select dropdown (líneas 47-52)
- Función `cargarOperadores()` (líneas 248-279)
- Validación obligatoria (líneas 121-125)

**HTML:**
```html
<select id="usuario" class="input">
  <option value="">Seleccione operador...</option>
  <!-- Se carga dinámicamente desde Supabase -->
</select>
```

**JavaScript:**
```javascript
async function cargarOperadores() {
  const result = await window.api.invoke('get-operadores-activos');
  // Llenar select con operadores activos
}
```

#### 4. [pure/operadores.html](pure/operadores.html) - Vista de Gestión (NUEVO)
Panel completo para que Admin gestione operadores.

**Funcionalidades:**
- ✅ Ver lista de operadores activos
- ✅ Ver lista de operadores inactivos
- ✅ Agregar nuevo operador
- ✅ Desactivar operador existente
- ✅ Reactivar operador inactivo
- ⏳ Editar operador (TODO)

---

## 🚀 Cómo Usar

### Para el Administrador:

1. **Abrir gestión de operadores:**
   ```
   Desde Panel Admin → Abrir: pure/operadores.html
   ```

2. **Agregar nuevo operador:**
   ```
   Click [➕ Agregar Operador]
   → Nombre: "Pedro García"
   → Mesas: "P01, P02" (opcional)
   → Click [Guardar]
   ```

3. **Desactivar operador:**
   ```
   En lista de activos → Click [🗑️ Desactivar]
   → El operador desaparece del selector de Mesa
   ```

4. **Reactivar operador:**
   ```
   En lista de inactivos → Click [✅ Reactivar]
   → El operador vuelve al selector de Mesa
   ```

### Para el Operador de Mesa:

1. **Emitir voucher:**
   ```
   Abrir: pure/mesa.html
   → Valor: 100.50
   → Moneda: DOP
   → Mesa: P01
   → Operador: [Seleccionar de la lista] ← Dropdown automático
   → Click [Emitir Voucher]
   ```

2. **Si no hay operadores:**
   ```
   ❌ Debe seleccionar un operador
   → Contactar al Admin para que agregue operadores
   ```

### Para el Cajero:

1. **Validar voucher:**
   ```
   Abrir: Caja/caja.html
   → Código: PREV-123456
   → Click [Validar]
   → Se muestra: Operador: Pedro García ← Nombre correcto
   ```

---

## 🧪 Pruebas

### Test 1: Crear Operador en Supabase
```sql
-- 1. Ejecutar script SQL
-- SqulInstrucciones/crear-tabla-operadores.sql

-- 2. Verificar
SELECT * FROM operadores ORDER BY nombre;

-- Resultado esperado:
-- 4 operadores (3 activos, 1 inactivo)
```

### Test 2: Cargar Operadores en Mesa
```
1. Abrir pure/mesa.html
2. Verificar dropdown "Emitido por"
3. Debe mostrar operadores activos desde Supabase
4. Console debe mostrar: "✅ N operadores cargados"
```

### Test 3: Validar Obligatoriedad
```
1. Abrir pure/mesa.html
2. NO seleccionar operador
3. Click [Emitir Voucher]
4. Debe mostrar: "❌ Debe seleccionar un operador"
```

### Test 4: Flujo Completo Admin → Mesa → Caja
```
1. Admin abre pure/operadores.html
2. Crea operador "Test Operador"
3. Operador abre pure/mesa.html
4. Selecciona "Test Operador" del dropdown
5. Emite voucher PREV-123456
6. Cajero abre Caja/caja.html
7. Valida PREV-123456
8. Debe mostrar: Operador: Test Operador ✅
```

---

## 📝 Notas Técnicas

### Permisos de Admin
```javascript
// TODO: Implementar validación de rol
// Actualmente los handlers tienen el código comentado:
if (currentSession?.user?.role !== 'ADMIN') {
  return { success: false, error: 'No autorizado' };
}
```

### Modo Offline
```javascript
// Si Supabase no está disponible:
- Mesa: Lista vacía de operadores (puede escribir manualmente)
- Admin: No puede gestionar operadores
```

### Mesas Asignadas
```javascript
// Campo opcional "mesas_asignadas"
// Uso futuro: Restringir qué operadores pueden usar qué mesas
// Actualmente: Solo informativo
```

---

## 🔄 Migraciones Futuras

### V2: Validación de Mesas
```javascript
// Validar que el operador puede usar esa mesa
const operador = await getOperador(operadorNombre);
if (!operador.mesas_asignadas.includes(mesaNombre)) {
  return { error: 'Operador no autorizado para esta mesa' };
}
```

### V3: Auditoría
```javascript
// Registrar actividad de operadores
CREATE TABLE operadores_auditoria (
  id BIGSERIAL PRIMARY KEY,
  operador_id BIGINT,
  accion TEXT, -- 'emitir', 'cancelar', etc
  voucher_code TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);
```

### V4: Reportes
```javascript
// Reporte de vouchers emitidos por operador
SELECT operador_nombre, COUNT(*), SUM(amount)
FROM vouchers
WHERE issued_at > NOW() - INTERVAL '1 day'
GROUP BY operador_nombre;
```

---

## ❓ Preguntas Frecuentes

### ¿Qué pasa si elimino un operador?
No se puede eliminar, solo desactivar. El operador desaparece del selector de Mesa pero los vouchers antiguos mantienen el nombre.

### ¿Puedo tener dos operadores con el mismo nombre?
Técnicamente sí, pero NO es recomendable. Causa confusión.

### ¿Qué pasa si Supabase está offline?
Mesa muestra lista vacía. El campo de operador se puede dejar sin seleccionar (validación falla).

### ¿Puedo editar el nombre de un operador?
Actualmente NO (función en desarrollo). Puedes desactivar el viejo y crear uno nuevo.

### ¿Los operadores tienen contraseña?
NO. Este sistema es solo para gestión de nombres, no autenticación.

---

## ✅ Resumen

**Sistema implementado:**
- ✅ Tabla `operadores` en Supabase
- ✅ 5 handlers IPC en pure/main.js
- ✅ Selector dropdown en pure/mesa.html
- ✅ Panel de gestión en pure/operadores.html
- ✅ Validación obligatoria de operador
- ✅ Activar/Desactivar operadores
- ✅ Documentación completa

**Pendiente:**
- ⏳ Validación de rol Admin
- ⏳ Función editar operador
- ⏳ Restricción por mesas asignadas
- ⏳ Auditoría de actividad
- ⏳ Reportes por operador

**Próximo paso:**
Ejecutar el script SQL en Supabase y reiniciar la app para probar el sistema completo.
