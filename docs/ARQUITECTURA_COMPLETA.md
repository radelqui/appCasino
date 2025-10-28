# 🏗️ ARQUITECTURA COMPLETA DEL SISTEMA TITO CASINO

> **Fecha:** 28 de Octubre 2025
> **Estado:** ✅ Sistema funcionando correctamente
> **Versión:** 1.0.0

---

## 📋 ÍNDICE

1. [Visión General](#visión-general)
2. [Estructura de Archivos](#estructura-de-archivos)
3. [Flujo de Emisión de Vouchers](#flujo-de-emisión-de-vouchers)
4. [Base de Datos](#base-de-datos)
5. [IPC Handlers](#ipc-handlers)
6. [Frontend](#frontend)
7. [Solución Implementada](#solución-implementada)

---

## 🎯 VISIÓN GENERAL

### Sistema TITO (Ticket In, Ticket Out)
Sistema de emisión y validación de vouchers para casino, con arquitectura Electron.

### Componentes Principales:
- **Pure (Electron Main)**: `pure/main.js` - Proceso principal de Electron
- **Mesa**: `pure/mesa.html` - Interfaz para emisión de vouchers
- **Caja**: `Caja/caja.html` - Interfaz para validación y canje
- **Base de Datos**: SQLite (`data/casino.db`)

---

## 📁 ESTRUCTURA DE ARCHIVOS

```
appCasino/
├── pure/                          # 🟢 PUNTO DE ENTRADA PRINCIPAL
│   ├── main.js                    # Main process de Electron
│   ├── mesa.html                  # Vista de emisión de vouchers
│   └── index.html                 # Página de inicio
│
├── src/main/
│   ├── preload.js                 # Preload script (context bridge)
│   ├── ipc/                       # 🔌 IPC Handlers
│   │   ├── index.js               # Registro centralizado de handlers
│   │   ├── ticketHandlers.js      # Handler: generate-ticket, validate-ticket
│   │   ├── printerHandlers.js     # Handler: get-ticket-preview
│   │   ├── authHandlers.js        # Handler: auth:login, auth:logout
│   │   └── ...
│   ├── security/
│   │   └── roles.js               # Gestión de roles de usuario
│   └── utils/
│       └── pdf-generator.js       # Generación de PDFs de tickets
│
├── Caja/
│   ├── caja.html                  # Vista de validación/canje
│   ├── database.js                # 💾 Clase CasinoDatabase (SQLite)
│   ├── cajaHandlers.js            # Handlers específicos de caja
│   └── preload-caja.js            # Preload para ventana de caja
│
├── data/
│   └── casino.db                  # 🗄️ Base de datos SQLite principal
│
└── package.json                   # main: "pure/main.js"
```

---

## 🔄 FLUJO DE EMISIÓN DE VOUCHERS

### PROBLEMA RESUELTO:
❌ **Antes:** Vista previa generaba código diferente al emitido
✅ **Ahora:** UN SOLO código generado y usado en todo el sistema

### Flujo Completo (Actualizado):

```
┌─────────────────────────────────────────────────────────────┐
│ 1. USUARIO EN MESA                                          │
│    - Llena formulario (valor, moneda, mesa)                 │
│    - Click "Emitir voucher"                                 │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. FRONTEND (pure/mesa.html)                                │
│    función: emitir()                                        │
│    → window.api.generateTicket({valor, moneda, mesa_id})   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. IPC HANDLER: generate-ticket                             │
│    (src/main/ipc/ticketHandlers.js)                         │
│                                                              │
│    a) Genera código UNA VEZ:                                │
│       voucherCode = db.generateVoucherCode()                │
│       → Resultado: "PREV-001234"                            │
│                                                              │
│    b) Guarda en BD PRIMERO:                                 │
│       db.createVoucher(valor, moneda, userId, ...)          │
│       → INSERT INTO tickets (code, amount, currency...)     │
│                                                              │
│    c) Genera PDF con ESE código                             │
│                                                              │
│    d) Guarda en global para referencia:                     │
│       global.__lastTicketNumber = voucherCode               │
│                                                              │
│    e) Retorna al frontend:                                  │
│       return { success: true, ticket_number: voucherCode }  │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 4. FRONTEND RECIBE RESPUESTA                                │
│    - Muestra mensaje: "Emitido ticket PREV-001234"         │
│    - Llama: actualizarVistaPrevia(result.ticket_number)    │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 5. IPC HANDLER: get-ticket-preview                          │
│    (src/main/ipc/printerHandlers.js)                        │
│                                                              │
│    a) Recibe código del voucher: "PREV-001234"             │
│                                                              │
│    b) BUSCA EN BD:                                          │
│       db.getTicket(voucherCode)                             │
│       → SELECT * FROM tickets WHERE code = 'PREV-001234'    │
│                                                              │
│    c) Genera PDF con datos de BD                            │
│                                                              │
│    d) Retorna PDF como dataURL                              │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 6. VISTA PREVIA ACTUALIZADA                                 │
│    - Muestra PDF con código: "PREV-001234"                 │
│    ✅ MISMO código en BD, mensaje y PDF                     │
└─────────────────────────────────────────────────────────────┘
```

---

## 💾 BASE DE DATOS

### Ubicación:
```
C:\appCasino\data\casino.db
```

### Tabla Principal: `tickets`

```sql
CREATE TABLE tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,              -- PREV-XXXXXX
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT CHECK(currency IN ('USD', 'DOP')) NOT NULL,
  mesa TEXT,                              -- P01, P02, P03...
  estado TEXT CHECK(estado IN ('activo', 'emitido', 'usado', 'cancelado', 'expirado')),
  fecha_emision DATETIME DEFAULT CURRENT_TIMESTAMP,
  fecha_cobro DATETIME,
  cajero_id TEXT,
  hash_seguridad TEXT,
  qr_data TEXT,
  sincronizado INTEGER DEFAULT 0,
  notas TEXT
);
```

### Clase de Acceso: `CasinoDatabase`
**Archivo:** `Caja/database.js`

**Métodos clave:**
```javascript
generateVoucherCode()      // Genera PREV-XXXXXX único
createVoucher(...)         // Inserta en BD
getTicket(code)            // Obtiene ticket por código
validateTicket(code)       // Valida si puede ser canjeado
redeemTicket(code)         // Marca como usado
```

---

## 🔌 IPC HANDLERS

### Registro de Handlers
**Archivo:** `src/main/ipc/index.js`

```javascript
registerIpcHandlers({ db, printer })
```

### Handlers Principales:

#### 1. `generate-ticket`
**Archivo:** `src/main/ipc/ticketHandlers.js:7-85`
**Propósito:** Generar y guardar voucher

```javascript
ipcMain.handle('generate-ticket', async (event, ticketData) => {
  // 1. Genera código UNA vez
  const voucherCode = db.generateVoucherCode();

  // 2. Guarda en BD
  const voucher = await db.createVoucher(...);

  // 3. Genera QR y PDF
  const qrResult = await generateTicketQR(...);
  const pdfBuffer = await generateTicketPDF(...);

  // 4. Retorna resultado
  return { success: true, ticket_number: voucherCode };
});
```

#### 2. `get-ticket-preview`
**Archivo:** `src/main/ipc/printerHandlers.js:85-157`
**Propósito:** Generar vista previa usando código de BD

```javascript
ipcMain.handle('get-ticket-preview', async (event, previewData) => {
  // 1. Obtener código (del parámetro o global)
  const ticketNumber = previewData?.ticket_number || global.__lastTicketNumber;

  // 2. BUSCAR EN BD
  const dbTicket = db.getTicket(ticketNumber);

  // 3. Generar PDF con datos de BD
  const buf = await generateTicketPDF({ ...dbTicket });

  // 4. Retornar PDF
  return { success: true, dataUrl: pdfDataUrl, voucher_code: ticketNumber };
});
```

#### 3. `validate-ticket`
**Archivo:** `src/main/ipc/ticketHandlers.js:87-132`
**Propósito:** Validar voucher para canje

#### 4. `process-payment`
**Archivo:** `src/main/ipc/ticketHandlers.js:134-150`
**Propósito:** Procesar pago (marcar como usado)

---

## 🖥️ FRONTEND

### Mesa (Emisión)
**Archivo:** `pure/mesa.html`

**Función principal:**
```javascript
async function emitir() {
  // 1. Emitir voucher
  const result = await window.api.generateTicket({...});

  // 2. Mostrar mensaje
  msg(`Emitido ticket ${result.ticket_number}`);

  // 3. Actualizar vista previa con código emitido
  await actualizarVistaPrevia(result.ticket_number);
}

async function actualizarVistaPrevia(voucherCode) {
  const resp = await window.api.getTicketPreview({
    ticket_number: voucherCode,  // ✅ Pasa el código
    ...
  });
  previewTicketEl.src = resp.dataUrl;
}
```

### Caja (Validación)
**Archivo:** `Caja/caja.html`

---

## ✅ SOLUCIÓN IMPLEMENTADA

### Cambios Realizados (28 Oct 2025):

#### 1. **printerHandlers.js** (get-ticket-preview)
```javascript
// ANTES: Generaba código nuevo para preview
const ticketNumber = 'PREV-' + Math.random();

// AHORA: Busca en BD el código recibido
const ticketNumber = previewData?.ticket_number;
const dbTicket = db.getTicket(ticketNumber);  // ✅ Lee de BD
```

#### 2. **mesa.html** (función emitir)
```javascript
// ANTES: No actualizaba vista previa
const result = await window.api.generateTicket({...});
msg(`Emitido ticket ${result.ticket_number}`);

// AHORA: Actualiza vista previa con código emitido
const result = await window.api.generateTicket({...});
msg(`Emitido ticket ${result.ticket_number}`);
await actualizarVistaPrevia(result.ticket_number);  // ✅ Nuevo
```

#### 3. **package.json**
```javascript
// ANTES: "main": "src/main/main.js"
// AHORA: "main": "pure/main.js"  // ✅ Apunta a Pure
```

### Resultado:
✅ **UN SOLO código** generado
✅ **Guardado en BD primero**
✅ **Vista previa usa ESE código**
✅ **Validación funciona correctamente**

---

## 🚀 COMANDOS PRINCIPALES

```bash
# Iniciar aplicación (Pure)
npm start

# Iniciar aplicación Pure (explícito)
npm run start:pure

# Build portable
npm run build:pure:portable

# Tests
npm test
```

---

## 📊 LOGS DE VERIFICACIÓN

Cuando funciona correctamente, deberías ver:

```
==========================================
🎫 EMITIENDO VOUCHER
Valor: 200 Moneda: DOP Mesa: P03
==========================================
🎫 GENERANDO VOUCHER
1️⃣ Código generado: PREV-001234
2️⃣ Guardado en BD: PREV-001234
✅ Voucher creado en BD: PREV-001234
✅ Voucher emitido: PREV-001234
🔄 Actualizando vista previa con código: PREV-001234
==========================================
📄 GET-TICKET-PREVIEW
==========================================
1️⃣ Buscando voucher en BD: PREV-001234
2️⃣ Voucher encontrado en BD: PREV-001234
3️⃣ Generando PDF con código: PREV-001234
==========================================
✅ Vista previa actualizada: PREV-001234
```

---

## 🔧 PRÓXIMOS PASOS

- [ ] Optimizar consultas a BD
- [ ] Implementar caché de vouchers
- [ ] Mejorar manejo de errores
- [ ] Agregar tests automatizados
- [ ] Documentar API completa

---

**Documento creado por:** Claude Code
**Última actualización:** 28 de Octubre 2025
