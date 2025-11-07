# 🔍 DIAGNÓSTICO: Teclado Bloqueado en Input de Valor

**Fecha:** 2025-11-06
**Archivo:** `pure/mesa.html`
**Problema:** Input recibe focus/click pero NO recibe eventos de teclado

---

## 📋 CASO CONFIRMADO: CASO 1

### Síntomas:
- ✅ Input recibe evento `click`
- ✅ Input recibe evento `focus`
- ❌ Input NO recibe evento `keydown`
- ❌ Input NO recibe evento `keypress`
- ❌ Input NO recibe evento `input`
- ✅ `disabled = false`
- ✅ `readOnly = false`

**Conclusión:** Algo EXTERNO a mesa.html está bloqueando los eventos de teclado ANTES de que lleguen al input.

---

## 🔬 Investigación Realizada:

### ✅ **1. preload.js - LIMPIO**
**Archivo:** `src/main/preload.js`
**Resultado:** No hay event listeners de teclado. Solo expone API de IPC.

### ✅ **2. main.js - LIMPIO**
**Archivo:** `pure/main.js`
**Búsquedas:**
- `globalShortcut` - No encontrado
- `before-input-event` - No encontrado
- `keydown/keypress/keyboard` - No encontrado

**Resultado:** No hay shortcuts globales ni interceptores de teclado.

### ✅ **3. BrowserWindow Configuration - NORMAL**
**Ubicación:** `pure/main.js:5023-5033`

```javascript
const win = new BrowserWindow({
  width: 1000,
  height: 700,
  webPreferences: {
    preload: preloadPath,
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: false,
  },
  show: true,
});
```

**Resultado:** Configuración estándar, sin flags bloqueantes.

### ✅ **4. mesa.html - LIMPIO**
- No hay `preventDefault()` en ningún listener
- No hay `return false` en event handlers
- No hay CSS bloqueante (`pointer-events: none`, `user-select: none`)
- HTML del input es estándar: `<input id="valor" type="number" min="0" step="0.01" value="335.45" />`

---

## 🎯 HIPÓTESIS:

### **HIPÓTESIS 1: Problema de Electron con `input type="number"`**
Electron/Chromium puede tener un bug donde `input type="number"` no recibe eventos de teclado correctamente en ciertas condiciones.

**Evidencia:**
- Otros elementos (select, button) funcionan correctamente
- Solo el input de valor está afectado
- El input es `type="number"` con `min="0"` y `step="0.01"`

**Test:** Cambiar a `type="text"` temporalmente para verificar

### **HIPÓTESIS 2: Problema de Focus Trap**
Algún contenedor padre o el BrowserWindow está capturando eventos antes de que lleguen al input.

**Evidencia:**
- Focus funciona (el input se marca como activo)
- Click funciona (el cursor aparece)
- Pero el teclado no llega

**Test:** Verificar si eventos llegan a `document` pero no al input

### **HIPÓTESIS 3: Bug de Chromium/Electron en Windows**
Problema conocido de Chromium donde inputs numéricos pierden eventos de teclado después de ciertas operaciones.

**Evidencia:**
- Comportamiento específico de plataforma (Windows)
- No hay código bloqueante encontrado en la aplicación

**Test:** Probar en otro sistema operativo o versión de Electron

---

## 🔧 SOLUCIONES IMPLEMENTADAS:

### **1. Keyboard Event Monitoring (DIAGNÓSTICO)**
**Ubicación:** `mesa.html:684-698`

Captura TODOS los eventos de teclado en capture phase:
```javascript
['keydown', 'keypress', 'keyup', 'input', 'beforeinput'].forEach(eventType => {
  valorEl.addEventListener(eventType, (e) => {
    console.log(`⌨️ [EVENTO-${eventType.toUpperCase()}]`, {
      key: e.key,
      code: e.code,
      defaultPrevented: e.defaultPrevented,
      isTrusted: e.isTrusted,
      timestamp: new Date().toISOString()
    });
  }, true); // capture phase
});
```

**Resultado:** NO se ejecuta cuando se presiona una tecla → eventos no llegan al input

---

### **2. Document-Level Keyboard Capture (WORKAROUND)**
**Ubicación:** `mesa.html:700-736`

Intenta capturar eventos a nivel de documento y verificar si llegan allí:
```javascript
document.addEventListener('keydown', (e) => {
  if (document.activeElement === valorEl) {
    console.log('🔓 [WORKAROUND] Capturando keydown:', e.key);

    // Para números y teclas especiales
    if (e.key.match(/^[0-9.]$/) || ['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) {
      setTimeout(() => {
        const currentValue = valorEl.value;
        console.log('🔓 [WORKAROUND] Valor actual después de keydown:', currentValue);
      }, 10);
    }
  }
}, true); // capture phase
```

**Propósito:**
- Verificar si eventos llegan a `document` aunque no lleguen al input
- Si llegan a document, podríamos reenviarlos manualmente al input

---

### **3. Test Button: type="number" ↔ type="text"**
**Ubicación:** `mesa.html:738-756`

Botón rojo en esquina superior derecha para probar cambio de tipo:
```javascript
const testButton = document.createElement('button');
testButton.textContent = '🔧 TEST: Cambiar a type="text"';
testButton.onclick = () => {
  const currentType = valorEl.type;
  const newType = currentType === 'number' ? 'text' : 'number';
  valorEl.type = newType;
  console.log(`🔧 [TEST] Input type cambiado: ${currentType} → ${newType}`);
  valorEl.focus();
};
document.body.appendChild(testButton);
```

**Propósito:**
- Si el problema es con `type="number"`, cambiar a `type="text"` debería permitir escribir
- Permite al usuario probar sin modificar código

---

## 🧪 PRUEBAS A REALIZAR:

### **Test 1: Verificar si eventos llegan a document**
1. Ejecutar `npm start`
2. Ir a Mesa
3. Hacer click en input de valor
4. Presionar una tecla numérica
5. **Buscar en console:** `🔓 [WORKAROUND] Capturando keydown:`

**Resultado esperado:**
- **SI aparece:** Los eventos llegan a document pero no al input → podemos implementar reenvío manual
- **NO aparece:** Los eventos son bloqueados ANTES de llegar a document → problema más profundo

---

### **Test 2: Probar type="text"**
1. Ejecutar `npm start`
2. Ir a Mesa
3. Hacer click en botón rojo `🔧 TEST: Cambiar a type="text"`
4. Intentar escribir en el input
5. **Verificar:** ¿Ahora permite escribir?

**Resultado esperado:**
- **SI permite:** El problema es específico de `type="number"` → solución: cambiar a text y validar manualmente
- **NO permite:** El problema es más general → investigar otras causas

---

### **Test 3: Verificar CSS Computed**
1. Buscar en console: `🎨 [CSS-COMPUTED]`
2. Verificar valores:
   - `pointerEvents` debe ser `"auto"` (no `"none"`)
   - `userSelect` debe ser `"auto"` o `"text"` (no `"none"`)
   - `cursor` debe ser `"text"` (no `"not-allowed"`)

**Resultado esperado:** Todos los valores deben permitir interacción

---

## 💡 SOLUCIONES PROPUESTAS:

### **SOLUCIÓN A: Cambiar a type="text" con Validación Manual**
Si el problema es con `type="number"`, cambiar permanentemente a `type="text"`:

```html
<input id="valor" class="input" type="text" value="335.45" />
```

Agregar validación manual en JavaScript:
```javascript
valorEl.addEventListener('input', (e) => {
  // Permitir solo números, punto decimal, y backspace
  let value = e.target.value;

  // Remover caracteres no numéricos excepto punto
  value = value.replace(/[^0-9.]/g, '');

  // Permitir solo un punto decimal
  const parts = value.split('.');
  if (parts.length > 2) {
    value = parts[0] + '.' + parts.slice(1).join('');
  }

  // Limitar a 2 decimales
  if (parts[1] && parts[1].length > 2) {
    value = parts[0] + '.' + parts[1].substring(0, 2);
  }

  e.target.value = value;
  actualizarVistaPrevia();
});
```

---

### **SOLUCIÓN B: Forzar Reenvío de Eventos**
Si los eventos llegan a document pero no al input, reenviarlos manualmente:

```javascript
document.addEventListener('keydown', (e) => {
  if (document.activeElement === valorEl) {
    if (e.key.match(/^[0-9.]$/)) {
      e.preventDefault(); // Prevenir comportamiento por defecto

      // Insertar carácter manualmente
      const start = valorEl.selectionStart;
      const end = valorEl.selectionEnd;
      const value = valorEl.value;

      valorEl.value = value.substring(0, start) + e.key + value.substring(end);
      valorEl.selectionStart = valorEl.selectionEnd = start + 1;

      // Disparar evento input manualmente
      valorEl.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }
}, true);
```

---

### **SOLUCIÓN C: Recrear Input Dinámicamente**
Si el problema es de inicialización, recrear el input después de que la página cargue:

```javascript
setTimeout(() => {
  const oldInput = document.getElementById('valor');
  const newInput = document.createElement('input');

  // Copiar atributos
  newInput.id = 'valor';
  newInput.className = 'input';
  newInput.type = 'number';
  newInput.min = '0';
  newInput.step = '0.01';
  newInput.value = '335.45';

  // Reemplazar
  oldInput.parentNode.replaceChild(newInput, oldInput);

  console.log('✅ Input recreado dinámicamente');
}, 1000);
```

---

## 📊 ESTADO ACTUAL:

- ✅ Diagnósticos completos implementados
- ✅ Workaround de captura a nivel document agregado
- ✅ Botón de test para cambiar type agregado
- ⏸️ Esperando resultados de pruebas para determinar solución final

---

## 🚨 PRÓXIMOS PASOS:

1. **Ejecutar la aplicación** con los diagnósticos instalados
2. **Realizar Test 1, 2 y 3** documentados arriba
3. **Compartir los logs** de console cuando intentas escribir
4. **Basándose en resultados**, implementar una de las 3 soluciones propuestas

---

**Archivos Modificados:**
- ✅ `pure/mesa.html:671-756` - Diagnósticos CSS, keyboard events, workaround, y test button
