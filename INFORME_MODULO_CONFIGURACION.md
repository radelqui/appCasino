# 📋 INFORME COMPLETO: Módulo de Configuración

**Fecha**: 2025-10-30
**Generado por**: Claude Code Agent

---

## 1. ARCHIVO Y UBICACIÓN

### ❌ Módulo de Configuración Principal: **NO EXISTE**

El botón "CONFIGURACIÓN" en `panel.html` (línea 305) **NO TIENE ARCHIVO ASOCIADO**.

**Evidencia:**
- **Panel**: `C:\appCasino\Caja\panel.html` línea 305
  ```javascript
  case 'config':
      window.api?.openView?.('config');  // ❌ Falla
  ```

- **Handler**: `C:\appCasino\pure\main.js` línea 161-178
  ```javascript
  switch (normalized) {
    case 'panel': ...
    case 'mesa': ...
    case 'caja': ...
    case 'auditor': ...
    default:
      return { success: false, error: 'Vista desconocida' };  // ❌ 'config' cae aquí
  }
  ```

**Resultado**: Cuando haces clic en "CONFIGURACIÓN" del panel, **falla** con error "Vista desconocida".

---

### ✅ Módulo de Operadores: **SÍ EXISTE** (Parcialmente implementado)

**Archivo**: `C:\appCasino\pure\operadores.html`
**Estado**: Implementado pero **NO ACCESIBLE** desde el panel

---

## 2. FUNCIONALIDADES IMPLEMENTADAS

### 2.1 Módulo de Operadores (`operadores.html`)

#### ✅ Funcionalidades que SÍ existen:
1. **Listar operadores activos** - Muestra operadores habilitados
2. **Listar operadores inactivos** - Muestra operadores deshabilitados
3. **Agregar nuevo operador** - Modal para crear operador
4. **Editar operador** - Modificar nombre y mesas asignadas
5. **Activar/Desactivar operador** - Toggle de estado
6. **Asignar mesas** - Asignar mesas específicas o todas

#### ❌ Funcionalidades que NO existen:
1. **Gestión de usuarios del sistema** (Admin, Mesa, Caja)
2. **Configuración de impresoras**
3. **Configuración de base de datos**
4. **Configuración de Supabase**
5. **Configuración de monedas/valores**
6. **Backup/Restore de base de datos**
7. **Logs del sistema**
8. **Gestión de permisos**

---

## 3. BOTONES Y ACCIONES

### Panel Principal (`panel.html`)

| Botón | Estado | Acción | Resultado |
|-------|--------|--------|-----------|
| **CONFIGURACIÓN** | ❌ Roto | `openView('config')` | Error: "Vista desconocida" |

### Módulo de Operadores (`operadores.html`)

| Botón | Estado | Handler | Descripción |
|-------|--------|---------|-------------|
| **➕ Agregar Operador** | ✅ Funciona | N/A (modal) | Abre modal para nuevo operador |
| **Guardar** (modal) | ✅ Funciona | `create-operador` | Crea operador en Supabase |
| **✏️ Editar** | ⚠️ Incompleto | N/A | Abre modal pero falta handler `update-operador` |
| **🗑️ Desactivar** | ✅ Funciona | `toggle-operador` | Desactiva operador (activo=false) |
| **✅ Reactivar** | ✅ Funciona | `toggle-operador` | Activa operador (activo=true) |
| **Volver al Panel** | ✅ Funciona | `closeCurrent()` | Cierra ventana |
| **Cancelar** (modal) | ✅ Funciona | N/A | Cierra modal sin guardar |

---

## 4. HANDLERS IPC

### Handlers Implementados en `pure/main.js`:

#### ✅ `get-operadores-activos` (líneas 631-657)
**Ubicación**: `main.js:631`
**Descripción**: Obtiene solo operadores activos para dropdown en Mesa
**Base de datos**: Supabase únicamente
**Retorna**:
```javascript
{
  success: true,
  operadores: [
    { id, nombre, activo, mesas_asignadas, created_at, updated_at }
  ]
}
```

**Código completo**:
```javascript
ipcMain.handle('get-operadores-activos', async (event) => {
  try {
    console.log('📋 [Operadores] Obteniendo operadores activos...');

    if (!supabaseManager || !supabaseManager.isAvailable()) {
      console.warn('⚠️ Supabase no disponible - retornando lista vacía');
      return { success: true, operadores: [] };
    }

    const { data, error } = await supabaseManager.client
      .from('operadores')
      .select('*')
      .eq('activo', true)
      .order('nombre');

    if (error) {
      console.error('❌ Error obteniendo operadores:', error);
      return { success: false, error: error.message };
    }

    console.log(`✅ Operadores activos obtenidos: ${data?.length || 0}`);
    return { success: true, operadores: data || [] };
  } catch (error) {
    console.error('❌ Error en get-operadores-activos:', error?.message);
    return { success: false, error: error?.message };
  }
});
```

---

#### ✅ `get-all-operadores` (líneas 660-691)
**Ubicación**: `main.js:660`
**Descripción**: Obtiene TODOS los operadores (activos e inactivos)
**Permisos**: Solo Admin (TODO: no verificado aún)
**Base de datos**: Supabase únicamente
**Retorna**: Array ordenado por activo DESC, luego nombre ASC

**Código completo**:
```javascript
ipcMain.handle('get-all-operadores', async (event) => {
  try {
    console.log('📋 [Operadores] Obteniendo todos los operadores...');

    // TODO: Verificar que el usuario actual es admin
    // if (currentSession?.user?.role !== 'ADMIN') {
    //   return { success: false, error: 'No autorizado' };
    // }

    if (!supabaseManager || !supabaseManager.isAvailable()) {
      console.warn('⚠️ Supabase no disponible');
      return { success: false, error: 'Supabase no disponible' };
    }

    const { data, error } = await supabaseManager.client
      .from('operadores')
      .select('*')
      .order('activo', { ascending: false })
      .order('nombre');

    if (error) {
      console.error('❌ Error obteniendo todos los operadores:', error);
      return { success: false, error: error.message };
    }

    console.log(`✅ Total operadores obtenidos: ${data?.length || 0}`);
    return { success: true, operadores: data || [] };
  } catch (error) {
    console.error('❌ Error en get-all-operadores:', error?.message);
    return { success: false, error: error?.message };
  }
});
```

---

#### ✅ `create-operador` (líneas 694-732)
**Ubicación**: `main.js:694`
**Descripción**: Crea un nuevo operador
**Permisos**: Solo Admin (TODO: no verificado)
**Base de datos**: Supabase únicamente
**Parámetros**:
```javascript
{
  nombre: string,      // Requerido
  mesas: string[]      // Opcional, default []
}
```

**Código completo**:
```javascript
ipcMain.handle('create-operador', async (event, operadorData) => {
  try {
    console.log('➕ [Operadores] Creando operador:', operadorData);

    // TODO: Verificar rol de admin
    // if (currentSession?.user?.role !== 'ADMIN') {
    //   return { success: false, error: 'No autorizado - Solo admin puede crear operadores' };
    // }

    if (!operadorData?.nombre) {
      return { success: false, error: 'Nombre del operador es requerido' };
    }

    if (!supabaseManager || !supabaseManager.isAvailable()) {
      return { success: false, error: 'Supabase no disponible' };
    }

    const { data, error } = await supabaseManager.client
      .from('operadores')
      .insert({
        nombre: operadorData.nombre,
        activo: true,
        mesas_asignadas: operadorData.mesas || []
      })
      .select()
      .single();

    if (error) {
      console.error('❌ Error creando operador:', error);
      return { success: false, error: error.message };
    }

    console.log('✅ Operador creado exitosamente:', data);
    return { success: true, operador: data };
  } catch (error) {
    console.error('❌ Error en create-operador:', error?.message);
    return { success: false, error: error?.message };
  }
});
```

---

#### ✅ `update-operador` (líneas 735-769)
**Ubicación**: `main.js:735`
**Descripción**: Actualiza datos de un operador existente
**Permisos**: Solo Admin (TODO: no verificado)
**Base de datos**: Supabase únicamente
**⚠️ PROBLEMA**: El frontend NO lo usa (falta implementar en operadores.html)

**Código completo**:
```javascript
ipcMain.handle('update-operador', async (event, operadorId, updates) => {
  try {
    console.log('✏️ [Operadores] Actualizando operador:', operadorId, updates);

    // TODO: Verificar rol de admin
    // if (currentSession?.user?.role !== 'ADMIN') {
    //   return { success: false, error: 'No autorizado' };
    // }

    if (!supabaseManager || !supabaseManager.isAvailable()) {
      return { success: false, error: 'Supabase no disponible' };
    }

    const { data, error } = await supabaseManager.client
      .from('operadores')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', operadorId)
      .select()
      .single();

    if (error) {
      console.error('❌ Error actualizando operador:', error);
      return { success: false, error: error.message };
    }

    console.log('✅ Operador actualizado exitosamente:', data);
    return { success: true, operador: data };
  } catch (error) {
    console.error('❌ Error en update-operador:', error?.message);
    return { success: false, error: error?.message };
  }
});
```

---

#### ✅ `toggle-operador` (líneas 772-806)
**Ubicación**: `main.js:772`
**Descripción**: Activa o desactiva un operador
**Permisos**: Solo Admin (TODO: no verificado)
**Base de datos**: Supabase únicamente
**Parámetros**:
- `operadorId`: number
- `activo`: boolean

**Código completo**:
```javascript
ipcMain.handle('toggle-operador', async (event, operadorId, activo) => {
  try {
    console.log(`🔄 [Operadores] ${activo ? 'Activando' : 'Desactivando'} operador:`, operadorId);

    // TODO: Verificar rol de admin
    // if (currentSession?.user?.role !== 'ADMIN') {
    //   return { success: false, error: 'No autorizado' };
    // }

    if (!supabaseManager || !supabaseManager.isAvailable()) {
      return { success: false, error: 'Supabase no disponible' };
    }

    const { data, error } = await supabaseManager.client
      .from('operadores')
      .update({
        activo: activo,
        updated_at: new Date().toISOString()
      })
      .eq('id', operadorId)
      .select()
      .single();

    if (error) {
      console.error('❌ Error cambiando estado de operador:', error);
      return { success: false, error: error.message };
    }

    console.log(`✅ Operador ${activo ? 'activado' : 'desactivado'} exitosamente:`, data);
    return { success: true, operador: data };
  } catch (error) {
    console.error('❌ Error en toggle-operador:', error?.message);
    return { success: false, error: error?.message };
  }
});
```

---

## 5. ESTADO ACTUAL

### ❌ Problemas Críticos:

1. **El botón "CONFIGURACIÓN" del panel NO FUNCIONA**
   - Al hacer clic, llama `openView('config')`
   - El handler `open-view` no tiene case para 'config'
   - Retorna error: "Vista desconocida"
   - **No hay archivo config.html**

2. **El módulo `operadores.html` NO ES ACCESIBLE**
   - Existe el archivo completo y funcional
   - Pero NO se puede abrir desde ningún lugar
   - Necesita agregarse al handler `open-view`

3. **La función "Editar" está incompleta**
   - El botón existe en operadores.html
   - Abre el modal correctamente
   - Pero NO llama al handler `update-operador`
   - Falta implementar la llamada API

4. **No hay verificación de permisos**
   - Los handlers tienen TODOs para verificar rol ADMIN
   - Actualmente cualquier usuario puede acceder
   - Riesgo de seguridad

### ✅ Funcionalidades que SÍ funcionan:

1. **Crear operador** - Totalmente funcional
2. **Listar operadores** - Funcional (activos e inactivos)
3. **Activar/Desactivar** - Funcional
4. **Integración con Mesa** - Los operadores activos aparecen en el dropdown de Mesa

### ⚠️ Consola del navegador (F12):

Al intentar abrir Configuración desde el panel:
```
❌ Error en open-view: Vista desconocida
```

---

## 6. RECOMENDACIONES

### 🔴 URGENTE:

1. **Crear archivo de Configuración principal**
   - Crear `C:\appCasino\pure\config.html`
   - O renombrar `operadores.html` a `config.html`
   - Agregar case 'config' en el handler open-view

2. **Agregar acceso a Operadores**
   ```javascript
   case 'operadores':
     filePath = path.join(__dirname, 'operadores.html');
     break;
   case 'config':
     filePath = path.join(__dirname, 'config.html'); // O crear un archivo que incluya operadores
     break;
   ```

3. **Implementar función Editar en operadores.html**
   - Agregar llamada a `update-operador`
   - Completar la función `editarOperador()`

### 🟡 ALTA PRIORIDAD:

1. **Agregar verificación de permisos** en todos los handlers
2. **Crear página de Configuración general** que incluya:
   - Gestión de Operadores (enlace a operadores.html)
   - Gestión de Usuarios
   - Configuración de Impresoras
   - Configuración de Base de Datos

### 🟢 BAJA PRIORIDAD:

1. Agregar logs del sistema
2. Backup/Restore automático
3. Gestión de monedas y valores por defecto

---

## 7. ESQUEMA DE BASE DE DATOS

### Tabla: `operadores` (Supabase)

```sql
CREATE TABLE operadores (
  id BIGSERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  activo BOOLEAN DEFAULT true,
  mesas_asignadas TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Ejemplo de registro**:
```json
{
  "id": 1,
  "nombre": "Juan Pérez",
  "activo": true,
  "mesas_asignadas": ["P01", "P02", "P03"],
  "created_at": "2025-10-30T10:00:00Z",
  "updated_at": "2025-10-30T10:00:00Z"
}
```

---

## RESUMEN EJECUTIVO

| Componente | Estado | Comentario |
|------------|--------|-----------|
| Botón Configuración | ❌ Roto | No tiene archivo asociado |
| Módulo Operadores | ⚠️ Parcial | Existe pero no accesible |
| Handler open-view | ❌ Incompleto | Falta case 'config' |
| Create Operador | ✅ Funciona | Totalmente operativo |
| Listar Operadores | ✅ Funciona | Activos e inactivos |
| Toggle Operador | ✅ Funciona | Activar/Desactivar OK |
| Editar Operador | ❌ Incompleto | Modal existe, falta handler call |
| Permisos Admin | ❌ Sin implementar | TODOs en código |
| Integración Mesa | ✅ Funciona | Dropdown carga operadores |

**Conclusión**: El sistema de Operadores está ~70% implementado. La infraestructura backend está completa, pero faltan conexiones en el frontend y archivo de configuración principal.
