# Verificación: Botones "Volver" en Configuración

## Fecha: 2025-11-07

## ARCHIVOS CORREGIDOS

### 1. config.html (Configuración Principal)
**Ubicación:** `pure/config.html` línea 160

**Botón:** "← Volver al Panel"

**Función:** Vuelve al panel principal (Caja/panel.html)

**Código:**
```javascript
const result = await window.api?.invoke?.('open-view', 'panel');
```

**Estado:** ✅ FUNCIONANDO CORRECTAMENTE

---

### 2. operadores.html (Gestión de Operadores)
**Ubicación:** `pure/operadores.html` línea 371

**Botón:** "← Volver a Configuración"

**Función:** Vuelve a la pantalla de configuración (config.html)

**Código:**
```javascript
const result = await window.api?.invoke?.('open-view', 'config');
```

**Estado:** ✅ FUNCIONANDO CORRECTAMENTE

---

### 3. usuarios.html (Gestión de Usuarios)
**Ubicación:** `pure/usuarios.html`

**Botón:** Tiene btnVolver

**Función:** Vuelve a configuración

**Código:** Ya estaba correcto usando `open-view('config')`

**Estado:** ✅ YA ESTABA BIEN

---

## ARCHIVOS SIN BOTÓN VOLVER

Los siguientes archivos NO tienen botón volver (probablemente no están en uso o son legacy):
- impresoras.html
- database.html
- monedas.html
- logs.html
- seguridad.html

**Nota:** Estos archivos pueden ser versiones antiguas o están en desarrollo.

---

## PROBLEMA ORIGINAL

**Causa raíz:** El handler `closeCurrent()` en main.js está vacío (línea 644-647):

```javascript
safeIpcHandle('close-current', async () => {
  // No hacemos nada para evitar cerrar la única ventana
  return { success: true };
});
```

**Explicación:** La aplicación usa una ventana única que navega entre vistas, no múltiples ventanas. Por eso `closeCurrent()` no puede cerrar nada.

**Solución:** Usar `open-view('nombre-vista')` para navegar entre pantallas.

---

## FLUJO DE NAVEGACIÓN CORRECTO

```
Panel (Caja/panel.html)
  ↓ Usuario hace clic en "Configuración"
Config (pure/config.html)
  ↓ Usuario hace clic en "Operadores"
Operadores (pure/operadores.html)
  ↓ Usuario hace clic en "← Volver a Configuración"
Config (pure/config.html)
  ↓ Usuario hace clic en "← Volver al Panel"
Panel (Caja/panel.html)
```

---

## VERIFICACIÓN FINAL

✅ Config → Panel: FUNCIONA
✅ Operadores → Config: FUNCIONA
✅ Usuarios → Config: FUNCIONA

