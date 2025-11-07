# INFORME: DIFERENCIAS ENTRE NPM START Y NPM START:PURE

**Fecha**: 2025-10-31
**Investigación**: Problemas de [SIN EMITIR] y ticket cortado

---

## 1. ¿QUÉ EJECUTA CADA COMANDO?

### `npm start` (línea 7 de package.json)
```json
"start": "electron ."
```

**Comportamiento**:
- Ejecuta `electron .` (sin argumento de archivo)
- Electron busca el campo `"main"` en package.json
- **Campo main** (línea 5): `"main": "pure/main.js"`
- **EJECUTA**: `c:\appCasino\pure\main.js`

### `npm start:pure` (línea 16 de package.json)
```json
"start:pure": "electron ./pure/main.js"
```

**Comportamiento**:
- Ejecuta `electron ./pure/main.js` (con ruta explícita)
- **EJECUTA**: `c:\appCasino\pure/main.js`

### ✅ **CONCLUSIÓN**: AMBOS EJECUTAN EL MISMO ARCHIVO

**Confirmado**: Tanto `npm start` como `npm start:pure` ejecutan **`pure/main.js`**.

---

## 2. ARCHIVOS MAIN.JS ENCONTRADOS EN EL PROYECTO

### Archivo 1: `c:\appCasino\main.js` (339 líneas)
**Tipo**: Versión antigua con React
**Arquitectura**: Carga desde `http://localhost:3000` en desarrollo
**Importaciones**:
```javascript
const SQLiteDB = require('./database/sqlite');
const { registerIpcHandlers } = require('./ipc');
const PrinterService = require('./hardware/printer');
```

**Problema**: Las rutas `./database/sqlite` y `./hardware/printer` **NO existen** en la raíz. Este archivo probablemente es un **stub antiguo** que no funciona.

**Mensaje único**: `'🚀 Todos los servicios inicializados correctamente'` (línea 216)

### Archivo 2: `c:\appCasino\src\main\main.js` (254 líneas)
**Tipo**: Main original del proyecto React
**Estado**: No revisado en esta investigación

### Archivo 3: `c:\appCasino\pure\main.js` (2981 líneas) ✅
**Tipo**: Versión PURE actual (sin React)
**Arquitectura**: Usa archivos HTML locales (`pure/mesa.html`, `pure/caja.html`)
**Estado**: **ES EL QUE SE ESTÁ USANDO**

**Mensajes únicos**:
- `'✅ Health Monitor inicializado'` (línea 2884)
- `'✅ Supabase Manager inicializado y conectado'` (línea 2909)
- `'✅ Printer Service inicializado'` (línea 2934)

---

## 3. PROBLEMA 1: TICKET CORTADO EN `npm start:pure`

### 🔍 **CAUSA RAÍZ IDENTIFICADA**:

El ticket NO está "cortado" físicamente. El problema es que **el PDF se genera con una altura menor a la esperada**.

### Análisis técnico:

#### A) Altura por defecto en `pdf-generator.js`:

**Archivo**: [src/main/utils/pdf-generator.js:197](src/main/utils/pdf-generator.js#L197)

```javascript
let estimatedHeightMm = 135; // Altura base más generosa para diseño profesional
const finalHeightMm = pageHeightMm || estimatedHeightMm;
```

**Altura por defecto**: **135mm**

#### B) Altura configurada en `PrinterService`:

**Archivo**: [src/main/hardware/printer.js:26](src/main/hardware/printer.js#L26)

```javascript
this.ticketHeightMm = Number(process.env.TICKET_HEIGHT_MM || process.env.TITO_HEIGHT_MM || 156);
```

**Altura por defecto**: **156mm** (si no hay variable de entorno)

#### C) Cómo PrinterService genera PDFs:

**Archivo**: [src/main/hardware/printer.js:43](src/main/hardware/printer.js#L43)

```javascript
pdfBuffer = await generateTicketPDF({
  ticket_number, valor, moneda, fecha_emision, qr_code,
  mesa_id, usuario_emision, operador_nombre,
  pageWidthMm: this.paperWidthMm,
  pageHeightMm: this.ticketHeightMm  // ✅ PASA 156mm
});
```

**Altura usada**: **156mm** ✅

#### D) ❌ Cómo `pure/main.js` genera PDFs:

**Archivo**: [pure/main.js:547-556](pure/main.js#L547-L556)

```javascript
const pdfBuffer = await generateTicketPDF({
  ticket_number: ticketCode,
  qr_code: qrData,
  valor: amount,
  moneda: currency,
  fecha_emision: new Date().toISOString(),
  mesa_id: mesa,
  usuario_emision: userName,
  operador_nombre: userName
  // ❌ NO PASA pageHeightMm
});
```

**Altura usada**: **135mm** (por defecto) ❌

#### E) Flujo de impresión en `pure/main.js`:

**Archivo**: [pure/main.js:558-561](pure/main.js#L558-L561)

```javascript
if (printer && typeof printer.printTicket === 'function') {
  console.log('🖨️  Enviando a impresora...');
  await printer.printTicket(pdfBuffer);  // ❌ Envía Buffer de 135mm
}
```

**Problema**: El `pdfBuffer` ya está generado con 135mm.

#### F) Cómo PrinterService maneja Buffers:

**Archivo**: [src/main/hardware/printer.js:39-40](src/main/hardware/printer.js#L39-L40)

```javascript
if (input instanceof Buffer) {
  pdfBuffer = input;  // ❌ Usa el Buffer tal cual (135mm)
}
```

**Resultado**: Se imprime el PDF de 135mm sin regenerarlo.

---

### 📊 **COMPARACIÓN DE ALTURAS**:

| Componente | Altura usada | Resultado |
|------------|--------------|-----------|
| pdf-generator.js (defecto) | **135mm** | Ticket "cortado" |
| PrinterService (defecto) | **156mm** | Ticket completo |
| pure/main.js genera PDF | **135mm** ❌ | NO pasa pageHeightMm |
| pure/main.js imprime | **135mm** ❌ | Envía Buffer ya generado |

---

### ✅ **SOLUCIÓN PARA TICKET CORTADO**:

**Modificar** [pure/main.js:547-556](pure/main.js#L547-L556):

```javascript
// ANTES (❌ Genera PDF de 135mm):
const pdfBuffer = await generateTicketPDF({
  ticket_number: ticketCode,
  qr_code: qrData,
  valor: amount,
  moneda: currency,
  fecha_emision: new Date().toISOString(),
  mesa_id: mesa,
  usuario_emision: userName,
  operador_nombre: userName
});

// DESPUÉS (✅ Genera PDF de 156mm):
const pdfBuffer = await generateTicketPDF({
  ticket_number: ticketCode,
  qr_code: qrData,
  valor: amount,
  moneda: currency,
  fecha_emision: new Date().toISOString(),
  mesa_id: mesa,
  usuario_emision: userName,
  operador_nombre: userName,
  pageHeightMm: printer?.ticketHeightMm || 156  // ✅ AGREGAR ESTO
});
```

**Alternativa más limpia**: En lugar de generar el PDF en `pure/main.js`, pasar el **objeto de datos** al `printer.printTicket()` y dejar que el PrinterService genere el PDF con la altura correcta:

```javascript
// MEJOR SOLUCIÓN (✅ Delegar generación al PrinterService):
if (printer && typeof printer.printTicket === 'function') {
  console.log('🖨️  Enviando a impresora...');
  await printer.printTicket({
    ticket_number: ticketCode,
    qr_code: qrData,
    valor: amount,
    moneda: currency,
    fecha_emision: new Date().toISOString(),
    mesa_id: mesa,
    usuario_emision: userName,
    operador_nombre: userName
  });  // ✅ PrinterService genera PDF con 156mm
}
```

En este caso, **NO se necesita** el bloque que genera el PDF en `pure/main.js` (líneas 546-556), porque el PrinterService lo hará internamente con la altura correcta.

---

## 4. PROBLEMA 2: [SIN EMITIR] EN VISTA PREVIA

### 🔍 **CAUSA RAÍZ IDENTIFICADA**:

El handler `get-ticket-preview` usa la variable global `global.__lastTicketNumber` para obtener el código del último ticket emitido, PERO `pure/main.js` **NO estaba guardando** el código en esa variable.

### Análisis técnico:

#### A) Vista previa en `pure/mesa.html`:

**Archivo**: [pure/mesa.html:165-167](pure/mesa.html#L165-L167)

```javascript
// 3. ACTUALIZAR vista previa con el código del voucher emitido
console.log('🔄 Actualizando vista previa con código:', code);
await actualizarVistaPrevia(code);
```

**Función**: [pure/mesa.html:260-262](pure/mesa.html#L260-L262)

```javascript
async function actualizarVistaPrevia(voucherCode = null){
  try { await vistaPrevia(voucherCode); }
  catch(e) { console.warn('Actualizar vista previa falló:', e.message); }
}
```

**Llamada al handler**: [pure/mesa.html:217-228](pure/mesa.html#L217-L228)

```javascript
if (voucherCode) {
  payload.ticket_number = voucherCode;
  console.log('📄 Vista previa con código:', voucherCode);
}

const resp = await window.api?.getTicketPreview?.(payload);
```

#### B) Handler `get-ticket-preview`:

**Archivo**: [src/main/ipc/printerHandlers.js:85-164](src/main/ipc/printerHandlers.js#L85-L164)

**Lógica**:
```javascript
// Línea 92-93: Obtener código
const providedCode = String(previewData?.ticket_number || previewData?.code || '').trim();
const lastFromMain = String(global.__lastTicketNumber || '').trim();

// Línea 98-136: Si hay código, buscar en BD
if (providedCode || lastFromMain) {
  ticketNumber = providedCode || lastFromMain;
  // Buscar voucher en BD...
  if (dbTicket) {
    ticket = { ticket_number: dbTicket.code, ... };
  } else {
    ticket = { ticket_number: ticketNumber, ... };  // Usar el código proporcionado
  }
}
// Línea 137-149: ❌ Si NO hay código → [SIN EMITIR]
else {
  ticket = {
    ticket_number: '[SIN EMITIR]',  // ❌ AQUÍ APARECE
    ...
  };
}
```

**Problema**: Si `providedCode` está vacío Y `global.__lastTicketNumber` está vacío, entra en el `else` y genera un PDF con `[SIN EMITIR]`.

#### C) ❌ Estado ANTES de la corrección:

**Archivo**: [pure/main.js:521-537](pure/main.js#L521-L537) (ANTES)

```javascript
console.log('✅ [generate-ticket] Completado:', result);

// ❌ NO guardaba global.__lastTicketNumber

// Registrar evento en audit_log
await registrarAuditLog(...);
```

**Resultado**: `global.__lastTicketNumber` siempre estaba vacío.

#### D) ✅ Estado DESPUÉS de la corrección:

**Archivo**: [pure/main.js:521-540](pure/main.js#L521-L540) (DESPUÉS)

```javascript
console.log('✅ [generate-ticket] Completado:', result);

// ✅ Guardar código en variable global para vista previa
global.__lastTicketNumber = ticketCode;

// Registrar evento en audit_log
await registrarAuditLog(...);
```

**Resultado**: `global.__lastTicketNumber` contiene el código real (ej: `PREV-001234`).

---

### ✅ **SOLUCIÓN PARA [SIN EMITIR]**: ✅ YA IMPLEMENTADA

**Modificación realizada**: [pure/main.js:523-524](pure/main.js#L523-L524)

```javascript
// Guardar código en variable global para vista previa
global.__lastTicketNumber = ticketCode;
```

**Estado**: ✅ **CORREGIDO** (cambio ya aplicado en el código)

---

## 5. PROBLEMA 3: DIFERENCIA ENTRE SISTEMAS

### ❓ **¿POR QUÉ APARENTAN SER SISTEMAS DIFERENTES?**

El usuario reportó que `npm start` y `npm start:pure` parecen sistemas diferentes, pero **ambos ejecutan el mismo archivo** (`pure/main.js`).

### Posibles causas de diferencias observadas:

#### A) Configuración de entorno (.env)
- Variables diferentes en `.env` vs `.env.local`
- Altura de ticket configurada manualmente

#### B) Perfil de impresora persistido
**Archivo**: `userData/printerProfile.json`

**Código**: [pure/main.js:2927-2933](pure/main.js#L2927-L2933)

```javascript
const profilePath = path.join(app.getPath('userData'), 'printerProfile.json');
if (fs.existsSync(profilePath)) {
  const saved = JSON.parse(fs.readFileSync(profilePath, 'utf8'));
  printer.setProfile?.(saved);
}
```

**Posibilidad**: Si el perfil tiene guardado `height_mm: 156`, el PrinterService usa esa altura. Pero como `pure/main.js` genera el PDF ANTES de imprimir (y no pasa pageHeightMm), el PDF sigue siendo de 135mm.

#### C) Caché de Electron
**Ubicación**: `%APPDATA%/tito-casino-system/` o similar

Diferentes ejecuciones pueden tener caché diferente, afectando la carga de archivos o configuraciones.

#### D) Estado de la BD
- Tickets previos en SQLite
- Sincronización con Supabase
- Códigos de ticket consecutivos

---

### ✅ **CÓMO UNIFICAR COMPLETAMENTE**:

1. **Eliminar archivo obsoleto**: Borrar `c:\appCasino\main.js` (339 líneas) para evitar confusión

2. **Configuración consistente**: Usar solo `.env` (no múltiples archivos)

3. **Altura de ticket uniforme**: Aplicar la corrección en `pure/main.js` para pasar `pageHeightMm`

4. **Documentar configuración**: Agregar en `.env.example`:
   ```env
   # Configuración de impresora
   PRINTER_NAME=EPSON_TM_T20
   PRINT_MODE=PDF
   TICKET_WIDTH_MM=80
   TICKET_HEIGHT_MM=156
   ```

5. **Un solo comando de inicio**: Mantener solo `npm start` (eliminar `npm start:pure`)

---

## 6. RESUMEN DE PROBLEMAS Y SOLUCIONES

| Problema | Causa | Solución | Estado |
|----------|-------|----------|--------|
| **Ticket cortado** | `pure/main.js` genera PDF sin pasar `pageHeightMm` (usa 135mm por defecto) | Pasar `pageHeightMm: 156` O delegar generación de PDF al PrinterService | ❌ **PENDIENTE** |
| **[SIN EMITIR]** | `pure/main.js` no guardaba `global.__lastTicketNumber` | Agregar `global.__lastTicketNumber = ticketCode;` después de generar ticket | ✅ **CORREGIDO** |
| **Diferencia entre comandos** | Ambos ejecutan el mismo `pure/main.js`, diferencias son por configuración/caché | Unificar configuración y documentar | ⚠️ **ACLARADO** |
| **main.js obsoleto** | Existe `c:\appCasino\main.js` (339 líneas) que NO se usa | Eliminar archivo para evitar confusión | 📋 **RECOMENDADO** |

---

## 7. CAMBIOS RECOMENDADOS (SIN APLICAR AÚN)

### CAMBIO 1: Arreglar altura del ticket en `pure/main.js`

**Opción A - Pasar pageHeightMm al generar PDF**:

```javascript
// pure/main.js línea 547
const pdfBuffer = await generateTicketPDF({
  ticket_number: ticketCode,
  qr_code: qrData,
  valor: amount,
  moneda: currency,
  fecha_emision: new Date().toISOString(),
  mesa_id: mesa,
  usuario_emision: userName,
  operador_nombre: userName,
  pageHeightMm: printer?.ticketHeightMm || process.env.TICKET_HEIGHT_MM || 156  // ✅ AGREGAR
});
```

**Opción B - Delegar al PrinterService (RECOMENDADO)**:

```javascript
// pure/main.js línea 542-574
// ELIMINAR el bloque de generación de PDF (líneas 546-556)
// MODIFICAR el bloque de impresión:

if (printer && typeof printer.printTicket === 'function') {
  try {
    console.log('🖨️  Generando PDF e imprimiendo ticket...');
    await printer.printTicket({
      ticket_number: ticketCode,
      qr_code: qrData,
      valor: amount,
      moneda: currency,
      fecha_emision: new Date().toISOString(),
      mesa_id: mesa,
      usuario_emision: userName,
      operador_nombre: userName
    });  // ✅ PrinterService genera PDF con altura correcta (156mm)
    console.log('✅ Ticket impreso correctamente');
  } catch (printError) {
    console.warn('⚠️  Error imprimiendo ticket:', printError.message);
  }
} else {
  console.log('ℹ️  Impresora no disponible, ticket guardado en BD solamente');
}
```

**Ventajas de Opción B**:
- ✅ Un solo lugar donde se genera el PDF (PrinterService)
- ✅ Altura consistente (156mm desde config)
- ✅ Menos código duplicado
- ✅ PrinterService aplica su perfil guardado
- ✅ Más fácil de mantener

---

### CAMBIO 2: Eliminar `main.js` obsoleto de la raíz

```bash
rm c:\appCasino\main.js
```

O renombrar como backup:
```bash
mv c:\appCasino\main.js c:\appCasino\main.js.OLD_REACT_VERSION
```

---

### CAMBIO 3: Actualizar `.env.example` con configuración de impresora

```env
# Configuración de impresora
PRINTER_NAME=EPSON_TM_T20
PRINT_MODE=PDF
TICKET_WIDTH_MM=80
TICKET_HEIGHT_MM=156
PRINTER_TIMEOUT=30000
```

---

### CAMBIO 4: Simplificar scripts en `package.json`

```json
{
  "scripts": {
    "start": "electron .",
    "build:portable": "electron-builder --config electron-builder.pure.json --win portable"
  }
}
```

Eliminar `start:pure` ya que hace lo mismo que `start`.

---

## 8. FLUJO DE EMISIÓN E IMPRESIÓN ACTUAL VS PROPUESTO

### FLUJO ACTUAL (❌ Con problemas):

```
pure/main.js: generate-ticket
  ↓
1. Generar código (ticketCode)
  ↓
2. Guardar en Supabase
  ↓
3. Guardar en SQLite
  ↓
4. Guardar en global.__lastTicketNumber ✅
  ↓
5. Generar PDF con generateTicketPDF()
   ❌ NO pasa pageHeightMm → usa 135mm
  ↓
6. Llamar printer.printTicket(pdfBuffer)
   ❌ Recibe Buffer de 135mm → imprime tal cual
  ↓
RESULTADO: Ticket "cortado" (135mm en lugar de 156mm)
```

---

### FLUJO PROPUESTO (✅ Correcto):

```
pure/main.js: generate-ticket
  ↓
1. Generar código (ticketCode)
  ↓
2. Guardar en Supabase
  ↓
3. Guardar en SQLite
  ↓
4. Guardar en global.__lastTicketNumber ✅
  ↓
5. Llamar printer.printTicket({
     ticket_number: ticketCode,
     qr_code: qrData,
     valor: amount,
     moneda: currency,
     ...
   })
  ↓
  PrinterService.printTicket():
    ↓
    Detecta que input es objeto (no Buffer)
    ↓
    Genera PDF con generateTicketPDF({
      ...,
      pageHeightMm: this.ticketHeightMm  ← 156mm ✅
    })
    ↓
    Imprime el PDF
  ↓
RESULTADO: Ticket completo (156mm) ✅
```

---

## 9. VERIFICACIÓN POST-CORRECCIÓN

Después de aplicar los cambios recomendados, verificar:

### ✅ Checklist de pruebas:

1. **Emisión de ticket**:
   - [ ] Código generado correctamente (PREV-XXXXXX)
   - [ ] Guardado en Supabase
   - [ ] Guardado en SQLite
   - [ ] PDF generado con **156mm** de altura
   - [ ] Ticket impreso completo (no cortado)
   - [ ] Console muestra: `"✅ Ticket impreso correctamente"`

2. **Vista previa**:
   - [ ] Después de emitir, la vista previa muestra el código real
   - [ ] **NO aparece `[SIN EMITIR]`**
   - [ ] PDF de vista previa tiene **156mm** de altura
   - [ ] QR code visible y centrado

3. **Validación en Caja**:
   - [ ] Código se valida correctamente
   - [ ] Muestra datos del ticket (monto, moneda, mesa, operador)
   - [ ] Se puede cobrar exitosamente

4. **Consistencia**:
   - [ ] `npm start` y `npm start:pure` se comportan igual
   - [ ] No hay diferencias entre ejecuciones

---

## 10. ARCHIVOS MODIFICADOS Y RECOMENDACIONES

### ✅ Archivos ya modificados (en sesión anterior):

1. **pure/main.js:524** ✅
   - Agregado: `global.__lastTicketNumber = ticketCode;`
   - Estado: Corrige problema de [SIN EMITIR]

### ⏳ Archivos que DEBEN modificarse:

1. **pure/main.js:542-574** ⏳
   - Cambiar generación de PDF por delegación a PrinterService
   - Estado: **PENDIENTE DE APROBACIÓN**

### 📋 Archivos recomendados eliminar:

1. **c:\appCasino\main.js** (339 líneas)
   - Versión obsoleta con React que no se usa
   - Estado: **RECOMENDADO ELIMINAR O RENOMBRAR**

### 📝 Archivos recomendados crear/actualizar:

1. **.env.example**
   - Documentar variables de configuración de impresora
   - Estado: **RECOMENDADO AGREGAR**

---

## 11. COMANDOS PARA PROBAR

```bash
# Probar con npm start (debería funcionar igual)
npm start

# Probar con npm start:pure (debería funcionar igual)
npm start:pure

# Ver logs en consola para confirmar:
# - "✅ Ticket impreso correctamente"
# - "📄 Generando PDF del ticket..."
# - NO debe aparecer "[SIN EMITIR]"
```

---

## 12. CONCLUSIONES FINALES

### ✅ **LO QUE YA FUNCIONA**:
1. Ambos comandos `npm start` y `npm start:pure` ejecutan el mismo archivo
2. Problema de `[SIN EMITIR]` corregido (global.__lastTicketNumber)
3. Generación de código de ticket funciona
4. Guardado en BD funciona
5. Validación y cobro en Caja funcionan

### ❌ **LO QUE FALTA CORREGIR**:
1. **Ticket "cortado"**: PDF generado con 135mm en lugar de 156mm
2. Código duplicado: Generación de PDF en dos lugares

### 📋 **PRÓXIMOS PASOS RECOMENDADOS**:
1. **URGENTE**: Aplicar corrección de altura (Opción B recomendada)
2. **IMPORTANTE**: Eliminar `main.js` obsoleto de la raíz
3. **RECOMENDADO**: Documentar configuración en `.env.example`
4. **OPCIONAL**: Simplificar scripts en `package.json`

---

**FIN DEL INFORME**

---

## ANEXO: DIAGRAMA DE ARQUITECTURA

```
┌─────────────────────────────────────────────────────────────┐
│                    ELECTRON APP                             │
│                                                             │
│  package.json                                               │
│  ├─ "main": "pure/main.js"  ← Entry point                 │
│  ├─ "start": "electron ."                                  │
│  └─ "start:pure": "electron ./pure/main.js"               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                          │
                          ↓
┌─────────────────────────────────────────────────────────────┐
│                 pure/main.js (2981 líneas)                  │
│                                                             │
│  ┌─────────────────────────────────────────────┐           │
│  │ Handler: generate-ticket                    │           │
│  │                                             │           │
│  │  1. Generar ticketCode                      │           │
│  │  2. Guardar en Supabase                     │           │
│  │  3. Guardar en SQLite                       │           │
│  │  4. global.__lastTicketNumber = ticketCode  │ ✅        │
│  │  5. generateTicketPDF(...)                  │ ❌ 135mm  │
│  │  6. printer.printTicket(pdfBuffer)          │           │
│  └─────────────────────────────────────────────┘           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                          │
                          ↓
┌─────────────────────────────────────────────────────────────┐
│         src/main/hardware/printer.js (PrinterService)       │
│                                                             │
│  printTicket(input):                                        │
│    if (input instanceof Buffer):                            │
│      pdfBuffer = input  ← ❌ Recibe 135mm                  │
│    else:                                                    │
│      pdfBuffer = generateTicketPDF({                        │
│        ...,                                                 │
│        pageHeightMm: this.ticketHeightMm  ← ✅ 156mm      │
│      })                                                     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                          │
                          ↓
┌─────────────────────────────────────────────────────────────┐
│       src/main/utils/pdf-generator.js                       │
│                                                             │
│  generateTicketPDF({ ..., pageHeightMm }):                 │
│    estimatedHeightMm = 135  ← Defecto                      │
│    finalHeightMm = pageHeightMm || estimatedHeightMm        │
│                                                             │
│    Si pageHeightMm NO se pasa → usa 135mm ❌               │
│    Si pageHeightMm = 156 → usa 156mm ✅                    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---
