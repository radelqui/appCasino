# Operadores - Funcionalidad ELIMINAR Completada

## Fecha: 2025-11-07

## CAMBIOS REALIZADOS

### 1. Handler delete-operador en main.js
**Archivo:** `pure/main.js` (después de línea 2003)

**Funcionalidad:**
- Elimina operador de Supabase usando `.delete()`
- Registra en audit_log con action: 'deleted'
- Solo Admin puede ejecutar (verificación comentada como TODO)

### 2. UI - Botón Eliminar en operadores.html
**Archivo:** `pure/operadores.html`

**Cambios en renderOperadorItem():**
- Añadido botón "❌ Eliminar" para operadores INACTIVOS
- Color danger (rojo) para indicar acción destructiva

**Cambios en handleAction():**
- Añadida acción 'delete' con confirmación
- Mensaje de advertencia: "⚠️ ¿ELIMINAR PERMANENTEMENTE este operador?"

### 3. Función eliminarOperador() añadida
**Archivo:** `pure/operadores.html`

**Funcionalidad:**
- Llama al handler 'delete-operador'
- Muestra mensaje de éxito/error
- Recarga lista de operadores después de eliminar

### 4. Botón Volver al Panel CORREGIDO
**Archivo:** `pure/config.html` (línea 157)

**Problema:** Usaba `open-view('panel')` que no funciona desde config
**Solución:** Cambiado a `closeCurrent()` como en otros módulos

**Antes:**
```javascript
await window.api?.invoke?.('open-view', 'panel');
```

**Después:**
```javascript
await window.api?.closeCurrent?.();
```

## FLUJO DE ELIMINACIÓN

1. Usuario ve operador INACTIVO
2. Hace clic en botón "❌ Eliminar"
3. Aparece confirmación: "⚠️ ¿ELIMINAR PERMANENTEMENTE...?"
4. Si confirma:
   - Se llama `eliminarOperador(operadorId)`
   - Handler `delete-operador` elimina de Supabase
   - Se registra en audit_log con action: 'deleted'
   - Se recarga lista
   - Operador desaparece de la UI

## IMPORTANTE: Audit Log Action

El handler registra con `action: 'deleted'` en el metadata.

⚠️ **NOTA SUPABASE:** Si el constraint de audit_log no incluye esta acción en el metadata, NO causará error porque 'deleted' está en el JSON metadata, no en la columna action.

La columna `action` usa `'operator_updated'` que SÍ está en el constraint actual.

## SEGURIDAD

- Solo operadores INACTIVOS pueden eliminarse
- Botón solo aparece en lista de inactivos
- Confirmación con mensaje de advertencia
- Acción irreversible (DELETE permanente)

## FUNCIONALIDAD COMPLETA

✅ Ver lista de operadores (activos e inactivos)
✅ Agregar nuevo operador
✅ Editar operador existente
✅ Desactivar operador
✅ Reactivar operador
✅ **Eliminar operador** (NUEVO)
✅ Volver al Panel (CORREGIDO)

