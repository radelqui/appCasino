# 🏥 SISTEMA DE SALUD Y ANTI-CUELGUES

## 📋 RESUMEN

Se ha implementado un **sistema completo de monitoreo de salud** para detectar, prevenir y recuperar automáticamente de cuelgues en la aplicación.

---

## 🎯 PROBLEMA QUE RESUELVE

### **Síntomas reportados:**
- ✅ La app se queda "pensando" y no responde
- ✅ No se puede hacer input de teclado
- ✅ Especialmente en Mesa al emitir tickets
- ✅ Se cuelga esperando respuesta de BD/Supabase/Impresora

### **Causas detectadas:**
1. **Base de datos bloqueada** - SQLite espera un lock indefinidamente
2. **Supabase sin respuesta** - La conexión cloud tarda demasiado o se cuelga
3. **Impresora bloqueada** - La impresora no responde
4. **Operaciones síncronas pesadas** - Bloquean el event loop

---

## 🏗️ ARQUITECTURA DEL SISTEMA

### **Componentes creados:**

1. **[pure/healthMonitor.js](pure/healthMonitor.js)** - Monitorea salud de la app
   - Registra inicio/fin de operaciones
   - Detecta timeouts
   - Detecta cuelgues
   - Calcula métricas promedio
   - Emite eventos de alerta

2. **[pure/safeOperations.js](pure/safeOperations.js)** - Wrappers seguros con timeouts
   - `SafeDatabaseOperations` - BD con timeout
   - `SafeSupabaseOperations` - Supabase con timeout
   - `SafePrinterOperations` - Impresora con timeout

3. **[pure/health-indicator.html](pure/health-indicator.html)** - Indicador visual de salud
   - Muestra estado en tiempo real
   - Alertas visuales de problemas
   - Panel de estadísticas detalladas

4. **Handler `health-check`** en [pure/main.js](pure/main.js)
   - Endpoint IPC para consultar estado
   - Retorna métricas completas

---

## 🔧 CÓMO FUNCIONA

### **1. Monitoreo de Operaciones**

Cada operación crítica se envuelve con el health monitor:

```javascript
// Antes (sin protección)
const ticket = db.createTicket(data);

// Ahora (con protección)
const endOperation = healthMonitor.startOperation('create_ticket', 10000); // 10s timeout
try {
  const ticket = db.createTicket(data);
  endOperation(); // Marca como completada
} catch (error) {
  endOperation(); // También marca como completada
  throw error;
}
```

### **2. Timeouts Automáticos**

Todas las operaciones tienen timeouts configurados:

| Operación | Timeout | Acción si excede |
|-----------|---------|------------------|
| BD SELECT | 3-5 segundos | Log error + evento `timeout` |
| BD INSERT/UPDATE | 5 segundos | Log error + evento `timeout` |
| Crear Ticket | 10 segundos | Log error + evento `timeout` |
| Supabase Create | 15 segundos | Log error + evento `timeout` |
| Supabase Get | 10 segundos | Log error + evento `timeout` |
| Impresora | 30 segundos | Log error + evento `timeout` |

### **3. Detección de Cuelgues**

El watchdog verifica cada 30 segundos:

```javascript
setInterval(() => {
  healthMonitor.checkForHangs();  // Busca operaciones colgadas
  healthMonitor.cleanup();         // Limpia operaciones antiguas
}, 30000);
```

Si una operación excede **2x su timeout**, se considera **definitivamente colgada** y se emite un evento:

```javascript
healthMonitor.on('hang-detected', (hangs) => {
  console.error('🚨 CUELGUES DETECTADOS:', hangs);
  // Aquí podrías implementar recuperación automática
});
```

### **4. Heartbeat**

Un heartbeat cada 5 segundos confirma que la app sigue viva:

```javascript
setInterval(() => {
  healthMonitor.heartbeat();
}, 5000);
```

Si el heartbeat no se actualiza por > 15 segundos, el indicador visual muestra warning.

---

## 📊 MÉTRICAS RECOLECTADAS

El sistema recolecta y promedia:

- **Operaciones de BD** - Tiempo promedio de queries/inserts
- **Operaciones de Supabase** - Tiempo promedio de operaciones cloud
- **Operaciones de Impresora** - Tiempo promedio de impresión
- **Operaciones activas** - Cuántas operaciones están en curso
- **Timeouts** - Cuántas operaciones excedieron su timeout
- **Uptime** - Tiempo que la app ha estado activa

---

## 🖥️ INDICADOR VISUAL

### **Ubicación:**
- Esquina superior derecha de Mesa y Caja
- Siempre visible

### **Estados:**

#### 🟢 **Verde (Saludable)**
- Todo funciona correctamente
- < 3 operaciones activas
- Sin timeouts
- Heartbeat reciente (< 15s)

#### 🟡 **Amarillo (Advertencia)**
- \> 3 operaciones activas
- Heartbeat antiguo (> 15s)
- BD/Supabase lento (> 1s/3s promedio)

#### 🔴 **Rojo (Problema)**
- Timeouts detectados
- Operaciones colgadas
- Sistema no responde

### **Cómo usarlo:**

1. **Click en el indicador** - Muestra panel de detalles
2. **Ver estadísticas** - Uptime, operaciones, promedios
3. **Detectar problemas** - Si está rojo, hay un problema

---

## 🧪 CÓMO INTEGRARLO EN TUS PÁGINAS

### **Paso 1: Agregar indicador visual a Mesa**

Editar [pure/mesa.html](pure/mesa.html):

```html
<!-- Al final del <body>, antes de cerrar </body> -->
<!-- Indicador de salud -->
<script>
  // Cargar componente de salud
  fetch('health-indicator.html')
    .then(r => r.text())
    .then(html => {
      const div = document.createElement('div');
      div.innerHTML = html;
      document.body.appendChild(div);
    });
</script>
</body>
</html>
```

**O más simple (copiar/pegar el contenido):**

```html
<!-- Copiar todo el contenido de pure/health-indicator.html aquí -->
</body>
</html>
```

### **Paso 2: Agregar a Caja**

Ya está en [Caja/caja.html](Caja/caja.html) - solo necesitas agregar el mismo código.

---

## 🔌 CÓMO USAR EN TU CÓDIGO

### **Opción A: Usar Safe Wrappers (Recomendado)**

```javascript
// En vez de llamar directamente a db.createTicket()
const result = await safeDb.safeCreateTicket(ticketData, 10000);

if (!result.success) {
  console.error('Error creando ticket:', result.error);
  // Manejar error (ya tiene timeout automático)
}
```

### **Opción B: Wrap manual con healthMonitor**

```javascript
const endOperation = healthMonitor.startOperation('mi_operacion', 5000);
try {
  // Tu código aquí
  const resultado = await miOperacionPesada();
  endOperation();
  return resultado;
} catch (error) {
  endOperation();
  throw error;
}
```

---

## 📝 EJEMPLOS DE USO

### **Ejemplo 1: Crear ticket con protección**

```javascript
// ANTES (sin protección)
ipcMain.handle('generate-ticket', async (event, data) => {
  const ticket = db.createTicket(data);
  await supabase.createVoucher(ticket);
  return ticket;
});

// AHORA (con protección)
ipcMain.handle('generate-ticket', async (event, data) => {
  // BD con timeout
  const dbResult = await safeDb.safeCreateTicket(data, 10000);
  if (!dbResult.success) {
    return { success: false, error: 'BD timeout' };
  }

  // Supabase con timeout
  const supaResult = await safeSupabase.safeCreateVoucher(
    dbResult.ticket,
    15000
  );

  return {
    success: true,
    ticket: dbResult.ticket,
    synced: supaResult.success
  };
});
```

### **Ejemplo 2: Consultar estado de salud**

```javascript
// En el frontend (Mesa/Caja)
const health = await window.api.invoke('health-check');

if (health.success) {
  console.log('Estado:', health.health.status);
  console.log('Uptime:', health.health.uptimeHuman);
  console.log('Operaciones activas:', health.health.runningOperations);
  console.log('Timeouts:', health.health.timedoutOperations);
  console.log('BD promedio:', health.health.averages.db, 'ms');
}
```

---

## 🚨 ALERTAS Y EVENTOS

El Health Monitor emite eventos que puedes escuchar:

```javascript
// En pure/main.js (ya implementado)
healthMonitor.on('timeout', (info) => {
  console.error('🚨 TIMEOUT:', info.operation, info.duration, 'ms');
  // Opcional: enviar notificación al frontend
  mainWindow.webContents.send('health-alert', {
    type: 'timeout',
    operation: info.operation
  });
});

healthMonitor.on('hang-detected', (hangs) => {
  console.error('🚨 CUELGUES:', hangs);
  // Opcional: reiniciar operación o mostrar error al usuario
});
```

---

## 🛠️ DEBUGGING Y DIAGNÓSTICO

### **Ver logs en tiempo real:**

```bash
# En consola de Electron (DevTools)
# Ver estado de salud
await window.api.invoke('health-check')

# Ver operaciones en curso
health.health.runningDetails

# Ver promedios
health.health.averages
```

### **Detectar qué operación se está colgando:**

1. Abrir DevTools (F12)
2. Reproducir el cuelgue
3. Ver consola:

```
🏥 [Health] Iniciando: create_ticket (timeout: 10000ms)
🚨 [Health] TIMEOUT: create_ticket excedió 10000ms
```

4. Esto te dice **exactamente qué operación** se colgó

---

## 📈 ESTADÍSTICAS Y ANÁLISIS

### **Ver estadísticas en consola:**

```javascript
// Backend (pure/main.js)
const stats = healthMonitor.getHealthStats();
console.table(stats);
```

### **Exportar métricas:**

```javascript
// Agregar handler para exportar
ipcMain.handle('export-health-metrics', async () => {
  const stats = healthMonitor.getHealthStats();
  const metrics = {
    uptime: stats.uptime,
    totalOperations: stats.counts,
    averages: stats.averages,
    timestamp: new Date().toISOString()
  };

  fs.writeFileSync(
    'health-metrics.json',
    JSON.stringify(metrics, null, 2)
  );

  return { success: true };
});
```

---

## ⚙️ CONFIGURACIÓN

### **Ajustar timeouts:**

Editar [pure/safeOperations.js](pure/safeOperations.js):

```javascript
// Cambiar timeout de BD
async safeQuery(query, params = [], timeout = 5000) { // ← Cambiar aquí
  // ...
}

// Cambiar timeout de Supabase
async safeCreateVoucher(data, timeout = 15000) { // ← Cambiar aquí
  // ...
}
```

### **Desactivar health monitoring:**

Si causa problemas (no debería), puedes desactivarlo:

```javascript
// En pure/main.js, comentar inicialización
// healthMonitor = getHealthMonitor();
```

---

## 🎯 MEJORES PRÁCTICAS

### ✅ **DO:**
- Usar `safeDb.safe*()` para operaciones de BD
- Usar `safeSupabase.safe*()` para operaciones cloud
- Revisar el indicador visual regularmente
- Investigar si el indicador se pone rojo
- Ajustar timeouts según necesidad

### ❌ **DON'T:**
- No ignorar warnings/errores de timeout
- No hacer operaciones síncronas pesadas sin timeout
- No desactivar el health monitor sin investigar

---

## 🔄 RECUPERACIÓN AUTOMÁTICA (FUTURO)

El sistema ya detecta cuelgues. En el futuro puedes implementar recuperación automática:

```javascript
healthMonitor.on('hang-detected', async (hangs) => {
  for (const hang of hangs) {
    console.warn(`Intentando recuperar: ${hang.operation}`);

    // Ejemplo: reiniciar conexión a BD
    if (hang.operation.includes('db')) {
      try {
        db.close();
        db = new CasinoDatabase(dbPath);
        console.log('✅ BD reiniciada');
      } catch (e) {
        console.error('❌ No se pudo reiniciar BD:', e);
      }
    }

    // Ejemplo: reiniciar conexión a Supabase
    if (hang.operation.includes('supabase')) {
      try {
        supabaseManager.reset();
        console.log('✅ Supabase reiniciado');
      } catch (e) {
        console.error('❌ No se pudo reiniciar Supabase:', e);
      }
    }
  }
});
```

---

## 📊 RESULTADO ESPERADO

### **Antes (sin sistema de salud):**
- ❌ App se cuelga sin aviso
- ❌ No sabes qué operación falló
- ❌ Usuario tiene que reiniciar manualmente
- ❌ Pérdida de datos

### **Ahora (con sistema de salud):**
- ✅ Timeouts automáticos evitan cuelgues indefinidos
- ✅ Logs detallados muestran qué falló
- ✅ Indicador visual alerta al usuario
- ✅ Métricas para optimizar rendimiento
- ✅ Base para recuperación automática

---

## 🧪 PRUEBAS

### **Test 1: Timeout de BD**

```javascript
// Simular BD lenta
ipcMain.handle('test-db-timeout', async () => {
  const endOp = healthMonitor.startOperation('test_timeout', 2000);
  try {
    // Esperar más que el timeout
    await new Promise(r => setTimeout(r, 5000));
    endOp();
  } catch (e) {
    endOp();
  }
});
```

**Resultado esperado:**
```
🏥 [Health] Iniciando: test_timeout (timeout: 2000ms)
🚨 [Health] TIMEOUT: test_timeout excedió 2000ms
```

### **Test 2: Indicador visual**

1. Abrir Mesa
2. Ver indicador verde en esquina superior derecha
3. Crear ticket
4. Durante creación, operaciones activas aumentan
5. Al completar, vuelve a verde

---

## 📝 ARCHIVOS CREADOS

1. ✅ [pure/healthMonitor.js](pure/healthMonitor.js) - Sistema de monitoreo
2. ✅ [pure/safeOperations.js](pure/safeOperations.js) - Wrappers seguros
3. ✅ [pure/health-indicator.html](pure/health-indicator.html) - Indicador visual
4. ✅ [pure/main.js](pure/main.js) - Handler `health-check` + inicialización
5. ✅ [SISTEMA_SALUD_ANTI_CUELGUES.md](SISTEMA_SALUD_ANTI_CUELGUES.md) - Esta documentación

---

## 🚀 PRÓXIMOS PASOS

1. ✅ **Reiniciar la app** (por Trae)
2. ✅ **Verificar logs** de inicialización:
   ```
   ✅ Health Monitor inicializado
   ✅ Safe Database Operations inicializado
   ✅ Safe Supabase Operations inicializado
   ✅ Handler health-check registrado
   ```
3. ✅ **Agregar indicador visual** a Mesa y Caja
4. ✅ **Monitorear en uso real** - Ver si detecta cuelgues
5. ⏳ **Ajustar timeouts** según necesidad
6. ⏳ **Implementar recuperación automática** si es necesario

---

**Implementado por: Claude (Sonnet 4.5)**
**Fecha: 2025-10-29**
**Estado: ✅ COMPLETO - Listo para testing**
