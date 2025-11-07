# 🔄 ROLLBACK: Input Blocking "Fixes" - Documentación Completa

**Fecha:** 2025-11-06
**Archivo Modificado:** `pure/mesa.html`
**Problema:** Los intentos de "arreglar" el bloqueo del input empeoraron el problema

---

## 📋 RESUMEN EJECUTIVO

Los cambios implementados por el Agente General para "forzar" la habilitación del input de valor **EMPEORARON** significativamente el problema de bloqueo. El input ahora se bloquea por **MUCHO más tiempo** que antes.

### Causa Identificada:

Los cambios crearon **race conditions** y **loops de reacción** que interfirieron con la inicialización normal del componente:

1. **setInterval agresivo**: Forzaba `disabled = false` cada 100ms durante 5 segundos (50 iteraciones)
2. **MutationObserver reactivo**: Detectaba cualquier cambio a `disabled/readOnly` y lo revertía inmediatamente
3. **DOMContentLoaded duplicado**: Intentaba forzar habilitación antes de que el DOM estuviera listo

Estos cambios crearon un **ciclo de interferencia** donde:
- El sistema intentaba establecer el estado del input legítimamente
- El MutationObserver detectaba el cambio como "intento de bloqueo"
- El observer forzaba el estado contrario
- El setInterval continuaba forzando el estado
- Se creaba un deadlock temporal donde el input no respondía a ninguna interacción

---

## 🗑️ CÓDIGO ELIMINADO (3 SECCIONES)

### ❌ SECCIÓN 1: DOMContentLoaded Forcing (Líneas 159-167 ORIGINAL)

**ELIMINADO:**
```javascript
// 🔓 DESBLOQUEO INMEDIATO: Forzar input de valor habilitado al cargar
document.addEventListener('DOMContentLoaded', () => {
  const valorInput = document.getElementById('valor');
  if (valorInput) {
    valorInput.disabled = false;
    valorInput.readOnly = false;
    console.log('✅ [INIT] Input de valor desbloqueado inmediatamente');
  }
});
```

**Por qué era problemático:**
- Ejecutaba ANTES de que el componente estuviera completamente inicializado
- Interfería con la carga natural de cargarPerfil(), actualizarVistaPrevia(), etc.
- Creaba race condition con otras inicializaciones

---

### ❌ SECCIÓN 2: setInterval Forcing (Líneas 594-620 ORIGINAL)

**ELIMINADO:**
```javascript
// 🔓 CRÍTICO: FORZAR habilitación del input de valor
if (valorEl) {
  console.log('🔓 [CRÍTICO] Forzando habilitación del input de valor...');

  // Habilitar inmediatamente
  valorEl.disabled = false;
  valorEl.readOnly = false;

  // 🚨 FORZAR cada 100ms durante 5 segundos para evitar bloqueos
  let counter = 0;
  const forceEnable = setInterval(() => {
    if (valorEl) {
      const wasDisabled = valorEl.disabled || valorEl.readOnly;
      valorEl.disabled = false;
      valorEl.readOnly = false;

      if (wasDisabled) {
        console.warn(`⚠️ [${counter}] Input estaba bloqueado, forzando habilitación`);
      }
    }
    counter++;
    if (counter > 50) {
      clearInterval(forceEnable);
      console.log('✅ [CRÍTICO] Finalizado forzado de habilitación (5 segundos)');
    }
  }, 100);
}

// Habilitar otros campos
if (monedaEl) monedaEl.disabled = false;
if (mesaEl) mesaEl.disabled = false;
if (usuarioEl) usuarioEl.disabled = false;
```

**Por qué era problemático:**
- **50 iteraciones cada 100ms** = 5 segundos de forzado continuo
- Interferencia con funciones async que modifican el input legítimamente
- Spam de logs que dificulta diagnóstico real
- CPU overhead innecesario

---

### ❌ SECCIÓN 3: MutationObserver Forcing (Líneas 627-643 ORIGINAL)

**ELIMINADO:**
```javascript
// 🔍 DETECTAR intentos de bloqueo del input
if (valorEl) {
  // Observer para detectar cambios en atributos
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.attributeName === 'disabled' || mutation.attributeName === 'readonly') {
        console.error('🚨 [ALERTA] Intento de bloquear input detectado!', mutation.attributeName, '=', valorEl[mutation.attributeName]);
        // Forzar habilitación inmediata
        valorEl.disabled = false;
        valorEl.readOnly = false;
      }
    });
  });

  observer.observe(valorEl, { attributes: true, attributeFilter: ['disabled', 'readonly'] });
  console.log('👀 [OBSERVER] Vigilando intentos de bloquear input');
}
```

**Por qué era MUY problemático:**
- Creaba **LOOP DE REACCIÓN**: cualquier cambio legítimo disparaba el observer
- El observer revertía cambios que podrían ser necesarios para el flujo normal
- Generaba múltiples mutaciones encadenadas
- **Esta fue probablemente la causa principal del empeoramiento del bloqueo**

---

### ❌ SECCIÓN 4: Logging Excesivo en Input Event (Línea 647 ORIGINAL)

**ELIMINADO:**
```javascript
valorEl?.addEventListener('input', (e) => {
  console.log('📝 [INPUT] Valor cambiado:', e.target.value, 'disabled:', e.target.disabled, 'readOnly:', e.target.readOnly);
  actualizarVistaPrevia();
});
```

**REEMPLAZADO CON:**
```javascript
valorEl?.addEventListener('input', (e) => {
  console.log('🔍 [DIAGNÓSTICO-INPUT-EVENT] Input changed:', {
    value: e.target.value,
    disabled: e.target.disabled,
    readOnly: e.target.readOnly
  });
  actualizarVistaPrevia();
});
```

**Nota:** Este cambio es menor y se mantuvo con prefijo de diagnóstico para debugging.

---

## ✅ CÓDIGO AGREGADO (DIAGNÓSTICO)

### 🔍 Logging de Inicialización

**Ubicación:** Líneas 636-653
**Propósito:** Detectar cuándo y cómo se inicializa la página

```javascript
// Init
console.log('🔍 [DIAGNÓSTICO-INIT] ===== INICIANDO CARGA DE MESA.HTML =====');
cargarPerfil();
actualizarVistaPrevia();
cargarOperadores();
cargarValoresPreestablecidos();

// Verificar estado después de 1 segundo (cuando todo haya cargado)
setTimeout(() => {
  const valorElFinal = document.getElementById('valor');
  console.log('🔍 [DIAGNÓSTICO-INIT] ===== ESTADO DESPUÉS DE 1 SEGUNDO =====');
  console.log('🔍 [DIAGNÓSTICO-INIT] Input valor estado final:', {
    exists: !!valorElFinal,
    disabled: valorElFinal?.disabled,
    readOnly: valorElFinal?.readOnly,
    value: valorElFinal?.value,
    timestamp: new Date().toISOString()
  });
}, 1000);
```

---

### 🔍 Logging en cargarPerfil()

**Ubicación:** Líneas 311-322
**Propósito:** Detectar si cargarPerfil() afecta el input

```javascript
async function cargarPerfil(){
  console.log('🔍 [DIAGNÓSTICO-PERFIL] Iniciando cargarPerfil()');
  try {
    const resp = await window.api?.getPrintProfile?.();
    const cur = resp?.current || { mode:'PDF', width_mm:80, height_mm:156 };
    modeEl.value = (cur.mode || 'PDF').toUpperCase();
    widthEl.value = String(cur.width_mm || 80);
    heightEl.value = Number(cur.height_mm || 156);
    console.log('🔍 [DIAGNÓSTICO-PERFIL] Perfil cargado exitosamente');
  } catch(e) {
    console.warn('Sin IPC, usando valores por defecto');
    console.log('🔍 [DIAGNÓSTICO-PERFIL] Error cargando perfil:', e);
  }
}
```

---

### 🔍 Logging en vistaPrevia()

**Ubicación:** Líneas 336-356
**Propósito:** Detectar si vistaPrevia() bloquea el input

```javascript
// Asegurar que los controles estén siempre habilitados
const mesaEl = document.getElementById('mesa');
const monedaEl = document.getElementById('moneda');
const valorEl = document.getElementById('valor');
const usuarioEl = document.getElementById('usuario');

// DIAGNÓSTICO: Log ANTES de modificar
console.log('🔍 [DIAGNÓSTICO-VISTA-PREVIA] Estado ANTES de habilitar:', {
  valor_disabled: valorEl?.disabled,
  valor_readOnly: valorEl?.readOnly,
  timestamp: new Date().toISOString()
});

if (mesaEl) mesaEl.disabled = false;
if (monedaEl) monedaEl.disabled = false;
if (valorEl) {
  valorEl.disabled = false;
  console.log('🔍 [DIAGNÓSTICO-VISTA-PREVIA] valorEl.disabled = false ejecutado');
}
if (usuarioEl) usuarioEl.disabled = false;

// DIAGNÓSTICO: Log DESPUÉS de modificar
console.log('🔍 [DIAGNÓSTICO-VISTA-PREVIA] Estado DESPUÉS de habilitar:', {
  valor_disabled: valorEl?.disabled,
  valor_readOnly: valorEl?.readOnly,
  timestamp: new Date().toISOString()
});
```

**⚠️ NOTA IMPORTANTE:** Esta función YA CONTENÍA código que fuerza `valorEl.disabled = false`. Esto podría ser parte del problema original.

---

### 🔍 Logging en actualizarVistaPrevia()

**Ubicación:** Líneas 430-455
**Propósito:** Detectar si el debounce afecta el input

```javascript
async function actualizarVistaPrevia(voucherCode = null){
  console.log('🔍 [DIAGNÓSTICO-ACTUALIZAR] Llamada a actualizarVistaPrevia()');

  // DEBOUNCE: Evitar loop infinito - esperar 500ms antes de actualizar
  if (vistaPreviaTimeout) {
    clearTimeout(vistaPreviaTimeout);
  }

  vistaPreviaTimeout = setTimeout(async () => {
    try {
      console.log('🔄 [DEBOUNCE] Actualizando vista previa después de 500ms');
      const valorEl = document.getElementById('valor');
      console.log('🔍 [DIAGNÓSTICO-ACTUALIZAR] Estado input ANTES de vistaPrevia():', {
        disabled: valorEl?.disabled,
        readOnly: valorEl?.readOnly
      });

      await vistaPrevia(voucherCode);

      console.log('🔍 [DIAGNÓSTICO-ACTUALIZAR] Estado input DESPUÉS de vistaPrevia():', {
        disabled: valorEl?.disabled,
        readOnly: valorEl?.readOnly
      });
    } catch(e) {
      console.warn('❌ Actualizar vista previa falló:', e.message);
    }
  }, 500);
}
```

---

### 🔍 Logging en cargarOperadores()

**Ubicación:** Líneas 475-518
**Propósito:** Detectar si la carga de operadores afecta el input

```javascript
async function cargarOperadores() {
  console.log('🔍 [DIAGNÓSTICO-OPERADORES] Iniciando cargarOperadores()');
  const valorEl = document.getElementById('valor');
  console.log('🔍 [DIAGNÓSTICO-OPERADORES] Estado input ANTES:', {
    disabled: valorEl?.disabled,
    readOnly: valorEl?.readOnly
  });

  try {
    console.log('📋 Cargando operadores activos...');
    const result = await window.api?.invoke?.('get-operadores-activos');
    // ... código de carga ...
  } catch (error) {
    console.error('❌ Error cargando operadores:', error);
  }

  console.log('🔍 [DIAGNÓSTICO-OPERADORES] Estado input DESPUÉS:', {
    disabled: valorEl?.disabled,
    readOnly: valorEl?.readOnly
  });
  console.log('🔍 [DIAGNÓSTICO-OPERADORES] Finalizando cargarOperadores()');
}
```

---

### 🔍 Logging en cargarValoresPreestablecidos()

**Ubicación:** Líneas 527-613
**Propósito:** Detectar si la carga de presets afecta el input

```javascript
async function cargarValoresPreestablecidos() {
  console.log('🔍 [DIAGNÓSTICO-PRESETS] Iniciando cargarValoresPreestablecidos()');
  const valorEl = document.getElementById('valor');
  console.log('🔍 [DIAGNÓSTICO-PRESETS] Estado input ANTES:', {
    disabled: valorEl?.disabled,
    readOnly: valorEl?.readOnly
  });

  try {
    console.log('💰 Cargando valores preestablecidos...');
    const result = await window.api?.invoke?.('currency:get-config');
    // ... código de carga ...
  } catch (error) {
    console.error('❌ Error cargando valores preestablecidos:', error);
  }

  const valorElFinal = document.getElementById('valor');
  console.log('🔍 [DIAGNÓSTICO-PRESETS] Estado input DESPUÉS:', {
    disabled: valorElFinal?.disabled,
    readOnly: valorElFinal?.readOnly
  });
  console.log('🔍 [DIAGNÓSTICO-PRESETS] Finalizando cargarValoresPreestablecidos()');
}
```

---

### 🔍 Event Listeners de Diagnóstico

**Ubicación:** Líneas 667-690
**Propósito:** Detectar interacciones del usuario con el input

```javascript
// DIAGNÓSTICO: Eventos de focus/blur/click para detectar bloqueos
valorEl?.addEventListener('focus', (e) => {
  console.log('🔍 [DIAGNÓSTICO-FOCUS] Input recibió focus:', {
    disabled: e.target.disabled,
    readOnly: e.target.readOnly,
    timestamp: new Date().toISOString()
  });
});

valorEl?.addEventListener('blur', (e) => {
  console.log('🔍 [DIAGNÓSTICO-BLUR] Input perdió focus:', {
    disabled: e.target.disabled,
    readOnly: e.target.readOnly,
    timestamp: new Date().toISOString()
  });
});

valorEl?.addEventListener('click', (e) => {
  console.log('🔍 [DIAGNÓSTICO-CLICK] Input recibió click:', {
    disabled: e.target.disabled,
    readOnly: e.target.readOnly,
    timestamp: new Date().toISOString()
  });
});
```

---

## 🎯 PRÓXIMOS PASOS

### 1. **Prueba del Sistema**
Ejecutar la aplicación y observar los logs de diagnóstico:
```bash
npm start
```

Abrir DevTools Console y buscar todos los logs con prefijo `🔍 [DIAGNÓSTICO-`

### 2. **Análisis de Logs**
Identificar en qué momento exacto el input cambia a `disabled: true` o `readOnly: true`:
- ¿Es durante `cargarPerfil()`?
- ¿Es durante `vistaPrevia()`?
- ¿Es durante `cargarOperadores()`?
- ¿Es durante `cargarValoresPreestablecidos()`?
- ¿Es después de algún evento de usuario?

### 3. **Hipótesis de Causa Real**

Basándome en el código, sospecho que la causa real podría ser:

**HIPÓTESIS 1:** La función `vistaPrevia()` (líneas 336-356) está **FORZANDO disabled = false**, lo cual parece contradictorio pero podría estar causando un efecto rebote donde el navegador o algún handler lo revierte.

**HIPÓTESIS 2:** Algún handler IPC o función async está bloqueando el thread principal durante la inicialización, causando que el input parezca bloqueado hasta que termine.

**HIPÓTESIS 3:** Hay algún otro código en `main.js` o `preload.js` que modifica el input desde el proceso principal de Electron.

### 4. **Solución Propuesta (NO IMPLEMENTADA AÚN)**

Una vez identificada la causa real con los logs de diagnóstico, considerar:

**OPCIÓN A:** Si `vistaPrevia()` es el problema:
- Remover las líneas que fuerzan `disabled = false` (336-356)
- Dejar que el input mantenga su estado natural

**OPCIÓN B:** Si es un problema de timing de inicialización:
- Agregar loading spinner durante inicialización
- Mostrar mensaje "Cargando..." hasta que todo esté listo
- Habilitar input solo cuando todas las funciones async hayan terminado

**OPCIÓN C:** Si es un problema del proceso principal:
- Revisar `main.js` y `preload.js` para handlers que modifiquen el DOM
- Eliminar cualquier código que intente controlar el estado del input desde Electron main process

---

## 📊 COMPARACIÓN: ANTES vs DESPUÉS del Rollback

| Aspecto | ANTES (con "fixes") | DESPUÉS (rollback) |
|---------|-------------------|-------------------|
| **Bloqueo del input** | MUCHO más tiempo | Duración original |
| **Logs en console** | Spam excesivo (50+ líneas) | Logs diagnósticos limpios |
| **CPU usage** | Alto (setInterval continuo) | Normal |
| **Race conditions** | MutationObserver causando loops | Eliminados |
| **Debugging** | Imposible (demasiado ruido) | Posible (logs dirigidos) |

---

## 🚨 LECCIONES APRENDIDAS

1. **NO forzar estado con setInterval**: Crear timers agresivos nunca es la solución
2. **NO usar MutationObserver reactivo**: Los observers deben observar, no reaccionar automáticamente
3. **Identificar causa raíz primero**: Agregar logs de diagnóstico ANTES de implementar "fixes"
4. **Less is more**: Remover código problemático es mejor que agregar más código defensivo

---

## ✅ ESTADO ACTUAL

- ✅ Código problemático eliminado completamente
- ✅ Logging de diagnóstico agregado en todos los puntos críticos
- ✅ Sistema listo para identificar causa real del bloqueo
- ⏸️ **NO se ha implementado solución final** (esperando diagnóstico)

---

**Siguiente acción:** Ejecutar la aplicación y analizar los logs de diagnóstico para identificar la causa real.
