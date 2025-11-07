# PRUEBAS INMEDIATAS - VERIFICACIÓN DE DESCONGELAMIENTO

**Fecha**: 2025-11-06
**Objetivo**: Verificar que la app YA NO SE CONGELA

---

## INICIO RÁPIDO

### 1. Iniciar aplicación
```bash
cd c:\appCasino
npm start
```

O si usas Pure:
```bash
cd c:\appCasino\pure
npm start
```

---

## PRUEBA 1: MESA - INPUT RESPONSIVE (CRÍTICO)

### Objetivo
Verificar que el campo "Valor" responde INMEDIATAMENTE sin delay.

### Pasos
1. Iniciar app
2. Hacer clic en "Mesa" o abrir `pure/mesa.html`
3. Hacer clic en campo "Valor"
4. Escribir rápidamente: `1000` (sin pausa)

### Resultado Esperado
- ✅ **ÉXITO**: Números aparecen INMEDIATAMENTE mientras escribes (< 50ms de delay)
- ❌ **FALLO**: Hay delay perceptible (> 200ms) entre tecla presionada y número visible

### Si FALLA
Verificar en consola DevTools (Ctrl+Shift+I):
- Buscar errores rojos
- Buscar mensajes "Timeout" o "Error"
- Verificar que no haya `await` bloqueantes en handlers

---

## PRUEBA 2: CAJA - ESTADÍSTICAS RÁPIDAS (CRÍTICO)

### Objetivo
Verificar que las estadísticas aparecen en < 100ms.

### Pasos
1. Iniciar app
2. Hacer clic en "Caja" o abrir `Caja/caja.html`
3. Observar el tiempo que tarda en aparecer:
   - Tickets de hoy
   - Total DOP/USD
   - Pendientes

### Resultado Esperado
```
CONSOLA (DevTools):
[get-stats-today] ✅ Retornando caché SQLite inmediatamente: { ticketsHoy: X, ... }
✅ [Background] Actualizando caché con X vouchers de Supabase
```

- ✅ **ÉXITO**: Estadísticas aparecen en < 100ms
- ⚠️ **ACEPTABLE**: Estadísticas aparecen en < 500ms
- ❌ **FALLO**: Estadísticas tardan > 1000ms

### Si FALLA
Verificar en consola:
```
❌ BAD: "Consultando Supabase..." aparece ANTES de "Retornando caché"
✅ GOOD: "Retornando caché" aparece PRIMERO
```

---

## PRUEBA 3: CAJA - ESTADÍSTICAS POR MESA (IMPORTANTE)

### Objetivo
Verificar que la tabla de mesas carga rápido.

### Pasos
1. En Caja, buscar sección "Estadísticas por Mesa"
2. Observar tiempo de carga de la tabla

### Resultado Esperado
```
CONSOLA:
[get-stats-by-mesa] ✅ Retornando caché SQLite inmediatamente
✅ Estadísticas por mesa procesadas: X mesas
✅ [Background] Actualizando caché por mesa con X vouchers
```

- ✅ **ÉXITO**: Tabla aparece en < 100ms
- ❌ **FALLO**: Tabla tarda > 500ms

---

## PRUEBA 4: BACKGROUND UPDATE (VERIFICACIÓN)

### Objetivo
Verificar que las actualizaciones en background funcionan SIN bloquear.

### Pasos
1. Con internet ACTIVO
2. Abrir Caja
3. Esperar 1-2 segundos
4. Revisar consola

### Resultado Esperado
```
CONSOLA:
[get-stats-today] ✅ Retornando caché SQLite inmediatamente: { ... }
✅ [Background] Actualizando caché con 5 vouchers de Supabase
```

- ✅ **ÉXITO**: Log muestra "Background" updates
- ⚠️ **ACEPTABLE**: Log muestra "⚠️ [Background] Supabase query falló: Timeout" (si red lenta)
- ❌ **FALLO**: No hay logs de background updates

---

## PRUEBA 5: MODO OFFLINE (VERIFICACIÓN)

### Objetivo
Verificar que la app funciona SIN internet.

### Pasos
1. Desconectar internet (WiFi o cable)
2. Iniciar app
3. Abrir Caja
4. Verificar que estadísticas aparecen

### Resultado Esperado
```
CONSOLA:
[get-stats-today] ✅ Retornando caché SQLite inmediatamente: { ... }
⚠️ [Background] Supabase query falló: Network error
```

- ✅ **ÉXITO**: Estadísticas aparecen (desde caché SQLite)
- ⚠️ **ACEPTABLE**: Estadísticas muestran datos antiguos (de última sincronización)
- ❌ **FALLO**: Error "DB no disponible" o pantalla en blanco

---

## PRUEBA 6: GENERAR TICKET (PENDIENTE DE CORRECCIÓN)

### ADVERTENCIA
Este handler AÚN tiene `await` bloqueante en línea 1303 de `pure/main.js`.

### Objetivo
Verificar si genera ticket rápido.

### Pasos
1. Abrir Mesa
2. Ingresar valor: 1000
3. Seleccionar moneda: DOP
4. Hacer clic en "Generar Ticket"
5. Observar tiempo de respuesta

### Resultado Esperado (ACTUAL - CON BUG)
- ⚠️ **PUEDE TARDAR**: 1-3 segundos si Supabase está lento
- ⚠️ **PUEDE CONGELAR**: UI durante la query a Supabase

### Resultado Esperado (DESPUÉS DE CORRECCIÓN)
- ✅ **INMEDIATO**: < 100ms (guardar en SQLite primero, Supabase en background)

### Si TARDA > 1 segundo
**ACCIÓN**: Aplicar mismo patrón no-bloqueante (ver `INFORME_DESCONGELAMIENTO_APP.md`)

---

## LOGS CLAVE A BUSCAR

### BUENOS (Todo correcto)
```
✅ [get-stats-today] ✅ Retornando caché SQLite inmediatamente
✅ [get-stats-by-mesa] ✅ Retornando caché SQLite inmediatamente
✅ [Background] Actualizando caché con X vouchers de Supabase
✅ Estadísticas por mesa procesadas: X mesas
```

### ADVERTENCIAS (Aceptables)
```
⚠️ [Background] Supabase query falló: Timeout: 500ms
⚠️ [Background] Supabase query falló: Network error
⚠️ Supabase no disponible, usando SQLite
```

### MALOS (Problemas)
```
❌ DB no disponible
❌ Error get-stats-today: ...
❌ CRÍTICO: db.generateTicketCode no disponible
❌ Timeout: Query tardó más de 3 segundos
```

---

## MEDICIÓN DE TIEMPOS

### Abrir DevTools Performance
1. Presionar `Ctrl+Shift+I` (DevTools)
2. Tab "Performance"
3. Hacer clic en "Record" (círculo rojo)
4. Ejecutar acción (ej: abrir Caja)
5. Hacer clic en "Stop"
6. Analizar timeline

### Tiempos Esperados
| Acción | Tiempo Esperado | Tiempo Máximo Aceptable |
|--------|----------------|------------------------|
| Abrir Mesa | < 100ms | 300ms |
| Abrir Caja | < 100ms | 300ms |
| Cargar estadísticas | < 100ms | 500ms |
| Generar ticket | < 100ms | 1000ms (CON BUG ACTUAL) |
| Input "Valor" | < 50ms | 100ms |

---

## COMPARACIÓN ANTES/DESPUÉS

### ANTES (Con queries bloqueantes)
```
Usuario: *abre Caja*
App: [CONGELADA 3 segundos esperando Supabase...]
Usuario: *intenta escribir en "Valor"*
App: [NO RESPONDE - bloqueada]
Usuario: ❌ "La app se congeló de nuevo!"
```

### DESPUÉS (Con caché no-bloqueante)
```
Usuario: *abre Caja*
App: [Estadísticas aparecen en 50ms desde caché SQLite]
Background: [Actualiza desde Supabase sin bloquear]
Usuario: *escribe en "Valor"*
App: [Responde INMEDIATAMENTE]
Usuario: ✅ "¡Funciona perfecto!"
```

---

## CHECKLIST DE VERIFICACIÓN

### Handlers Críticos (Ya corregidos ✅)
- [ ] `get-stats-today` - Tiempo < 100ms
- [ ] `get-stats-by-mesa` - Tiempo < 100ms
- [ ] `get-ticket-preview` - Tiempo < 100ms

### Handlers Pendientes (Pueden estar lentos ⚠️)
- [ ] `generate-ticket` - PUEDE TARDAR (línea 1303 tiene await bloqueante)
- [ ] `validate-ticket` - PUEDE TARDAR (línea ~1513 tiene await bloqueante)
- [ ] `redeem-ticket` - PUEDE TARDAR (línea ~1666 tiene await bloqueante)

### UI Responsive
- [ ] Input "Valor" responde INMEDIATAMENTE
- [ ] Botones responden sin delay
- [ ] App NO se congela al abrir Caja
- [ ] App NO se congela al abrir Mesa

### Background Updates
- [ ] Logs muestran "✅ [Background] Actualizando caché"
- [ ] Updates NO bloquean UI
- [ ] Timeout de 500ms funciona (si red lenta)

### Modo Offline
- [ ] App funciona sin internet
- [ ] Estadísticas muestran caché SQLite
- [ ] No hay errores críticos

---

## REPORTAR RESULTADOS

### Si TODO funciona ✅
```
REPORTE:
✅ ÉXITO: App NO se congela
✅ UI responsive en < 100ms
✅ Background updates funcionan
✅ Modo offline funciona

PRÓXIMO PASO: Corregir handlers pendientes (generate-ticket, etc)
```

### Si FALLA alguna prueba ❌
```
REPORTE:
❌ FALLO: [Describir qué falló]
❌ Logs: [Copiar logs de consola]
❌ Tiempo: [Indicar cuánto tardó]

ACCIÓN: Revisar INFORME_DESCONGELAMIENTO_APP.md
```

---

## CONTACTO/SOPORTE

Si después de las pruebas:
- ✅ **App funciona**: Continuar con corrección de handlers pendientes
- ❌ **App falla**: Revisar logs y compartir informe completo

---

**IMPORTANTE**: Estas pruebas son CRÍTICAS para verificar que la app ya no se congela. Ejecutar INMEDIATAMENTE después de los cambios.
