# 📊 RESUMEN DE PROGRESO - Sistema de Vouchers
## Actualizado: 28 de octubre de 2025

---

## ✅ LO QUE YA ESTÁ HECHO (Claude Code):

### 1. BASES DE DATOS ✅
- ✅ Supabase: 100% configurado (7 usuarios, 5 estaciones, 8 configs)
- ✅ SQLite: Estructura nueva al 100%
- ✅ Handlers actualizados a usar "vouchers"

### 2. SINCRONIZACIÓN ✅
- ✅ Supabase integrado en main.js
- ✅ Sync cada 30 segundos
- ✅ USE_SUPABASE=true en .env
- ✅ Queue de sincronización funcionando

### 3. CÓDIGO ACTUALIZADO ✅
- ✅ `src/main/ipc/ticketHandlers.js` → usa vouchers
- ✅ `Caja/cajaHandlers.js` → usa vouchers
- ✅ `SqulInstrucciones/database.js` → getVoucherByCode()
- ✅ Mapeo de campos: ticket_number → voucher_code
- ✅ Compatibilidad con UI legacy mantenida

### 4. CONFIGURACIÓN ✅
- ✅ `.env` creado con todas las variables
- ✅ Rutas configuradas correctamente
- ✅ QR_SECRET definido

---

## ⚠️ LO QUE FALTA (CRÍTICO):

### 1. MIGRAR DATOS LEGACY (URGENTE) ❌
**Estado:** NO hecho
**Problema:** Los 10 tickets viejos NO están en vouchers
**Impacto:** Al arrancar la app, no verá los tickets existentes

**Acción:** Ejecutar script de migración

---

### 2. INTERFAZ MESA (CRÍTICO) ❌
**Estado:** 40% completo
**Falta:**
- ❌ Formulario para crear voucher
- ❌ Vista previa antes de imprimir
- ❌ Conexión con impresora
- ❌ Estadísticas del operador

**Impacto:** NO se pueden crear vouchers desde Mesa

---

### 3. IMPRESIÓN (CRÍTICO) ❌
**Estado:** 0% integrado
**Falta:**
- ❌ printerManager.js no existe
- ❌ Formato de ticket no definido
- ❌ No imprime QR

**Impacto:** NO se pueden imprimir vouchers físicos

---

### 4. SCANNER QR EN CAJA (IMPORTANTE) ❌
**Estado:** 0% integrado
**Falta:**
- ❌ No detecta scanner USB
- ❌ No auto-llena código al escanear
- ❌ Cámara web no integrada

**Impacto:** Cajero debe escribir código manualmente

---

### 5. NETWORK DISCOVERY (IMPORTANTE) ❌
**Estado:** Creado pero NO integrado
**Falta:**
- ❌ No está en main.js
- ❌ No detecta otras estaciones
- ❌ No encuentra servidor automáticamente

**Impacto:** Hay que configurar IPs manualmente

---

## 🎯 PRÓXIMOS 5 PASOS (EN ORDEN):

### PASO 1: MIGRAR DATOS LEGACY ⚠️
**Prioridad:** URGENTE
**Tiempo:** 10 minutos

```javascript
// Crear: C:\appCasino\scripts\migrate-legacy.js

const Database = require('better-sqlite3');
const crypto = require('crypto');
const path = require('path');

const dbPath = process.env.SQLITE_DB_PATH || 'C:\\appCasino\\data\\casino.db';
const db = new Database(dbPath);

console.log('🔄 Migrando datos legacy...');

try {
  // Verificar si hay datos para migrar
  const legacyCount = db.prepare('SELECT COUNT(*) as count FROM tickets_legacy').get();
  console.log(`📊 Tickets legacy: ${legacyCount.count}`);
  
  if (legacyCount.count === 0) {
    console.log('✅ No hay datos legacy para migrar');
    process.exit(0);
  }

  // Migrar tickets
  const migrate = db.prepare(`
    INSERT INTO vouchers (
      id, voucher_code, amount, currency, status,
      qr_data, qr_hash, issued_by_user_id, 
      issued_at_station_id, issued_at, 
      redeemed_at, expires_at, synced
    )
    SELECT 
      LOWER(HEX(RANDOMBLOB(16))),
      ticket_number,
      valor,
      moneda,
      CASE estado
        WHEN 'emitido' THEN 'active'
        WHEN 'canjeado' THEN 'redeemed'
        WHEN 'anulado' THEN 'cancelled'
        WHEN 'expirado' THEN 'expired'
        ELSE 'active'
      END,
      qr_data,
      hash_seguridad,
      COALESCE(usuario_emision, 'LEGACY'),
      CASE 
        WHEN mesa_id LIKE '%1' THEN 1
        WHEN mesa_id LIKE '%2' THEN 2
        WHEN mesa_id LIKE '%3' THEN 3
        WHEN mesa_id LIKE '%4' THEN 4
        ELSE 1
      END,
      created_at,
      redeemed_at,
      datetime(created_at, '+24 hours'),
      0
    FROM tickets_legacy
    WHERE ticket_number NOT IN (SELECT voucher_code FROM vouchers)
  `);

  const result = migrate.run();
  console.log(`✅ Migrados ${result.changes} tickets a vouchers`);

  // Verificar
  const voucherCount = db.prepare('SELECT COUNT(*) as count FROM vouchers').get();
  console.log(`📊 Total vouchers: ${voucherCount.count}`);

  // Mostrar vouchers migrados
  const vouchers = db.prepare(`
    SELECT voucher_code, amount, currency, status 
    FROM vouchers 
    ORDER BY issued_at DESC 
    LIMIT 10
  `).all();
  
  console.log('\n📋 Últimos vouchers:');
  vouchers.forEach(v => {
    console.log(`   ${v.voucher_code}: ${v.currency} ${v.amount} (${v.status})`);
  });

} catch (error) {
  console.error('❌ Error migrando:', error);
  process.exit(1);
}

db.close();
console.log('\n✅ Migración completada');
```

**Ejecutar:**
```bash
cd C:\appCasino
node scripts\migrate-legacy.js
```

---

### PASO 2: COMPLETAR INTERFAZ MESA 🎮
**Prioridad:** CRÍTICA
**Tiempo:** 2-3 horas

**Prompt para Claude Code:**
```
Completa la interfaz Mesa (Electron_Puro/mesa.html).

DEBE TENER:

1. FORMULARIO:
<form id="voucher-form">
  <label>Monto:</label>
  <input type="number" id="amount" required min="10" step="0.01">
  
  <label>Moneda:</label>
  <div class="currency-buttons">
    <button type="button" class="currency-btn usd active" data-currency="USD">
      💵 USD
    </button>
    <button type="button" class="currency-btn dop" data-currency="DOP">
      💰 DOP
    </button>
  </div>
  
  <label>Cliente (opcional):</label>
  <input type="text" id="customer-name">
  
  <button type="submit" class="btn-create">🎫 Generar Voucher</button>
</form>

2. VISTA PREVIA:
<div id="voucher-preview" style="display:none;">
  <h3>Vista Previa</h3>
  <div id="qr-container"></div>
  <p class="voucher-amount"></p>
  <p class="voucher-code"></p>
  <button id="btn-print">🖨️ Imprimir</button>
  <button id="btn-new">🔄 Nuevo</button>
</div>

3. ESTADÍSTICAS:
<div class="stats">
  <div class="stat-box">
    <span class="stat-value" id="total-usd">$0</span>
    <span class="stat-label">Total USD</span>
  </div>
  <div class="stat-box">
    <span class="stat-value" id="total-dop">$0</span>
    <span class="stat-label">Total DOP</span>
  </div>
  <div class="stat-box">
    <span class="stat-value" id="total-count">0</span>
    <span class="stat-label">Vouchers Hoy</span>
  </div>
</div>

4. JAVASCRIPT:
- Al submit: llamar window.api.createVoucher(data)
- Generar QR con qrcode.js
- Actualizar estadísticas en tiempo real
- Estilos: USD verde, DOP azul

VERIFICAR:
- Crear voucher $50 USD
- Ver vista previa
- Verificar en BD: SELECT * FROM vouchers ORDER BY issued_at DESC LIMIT 1;
```

---

### PASO 3: INTEGRAR IMPRESIÓN 🖨️
**Prioridad:** CRÍTICA
**Tiempo:** 2-3 horas

**Prompt para Claude Code:**
```
Crea printerManager.js para imprimir vouchers en impresora térmica.

ARCHIVO: C:\appCasino\printerManager.js

CÓDIGO:
const { ThermalPrinter, PrinterTypes } = require('node-thermal-printer');
const QRCode = require('qrcode');

class PrinterManager {
  constructor() {
    this.printer = new ThermalPrinter({
      type: PrinterTypes.EPSON,
      interface: 'printer:TM-T20II', // Nombre de .env
      characterSet: 'PC437_USA',
      removeSpecialCharacters: false,
      lineCharacter: '-',
      options: {
        timeout: 5000
      }
    });
  }

  async printVoucher(voucher) {
    try {
      // Generar QR
      const qrBuffer = await QRCode.toBuffer(voucher.qr_data, {
        width: 200,
        margin: 1
      });

      // Configurar impresión
      this.printer.alignCenter();
      this.printer.bold(true);
      this.printer.setTextSize(1, 1);
      this.printer.println('GRAN CASINO SOSUA');
      this.printer.bold(false);
      this.printer.drawLine();
      
      this.printer.println('');
      this.printer.bold(true);
      this.printer.setTextSize(2, 2);
      this.printer.println('VOUCHER');
      this.printer.setTextSize(1, 1);
      this.printer.println('');
      
      // QR Code
      this.printer.printImageBuffer(qrBuffer);
      this.printer.println('');
      
      // Monto
      this.printer.drawLine();
      this.printer.bold(true);
      this.printer.setTextSize(2, 2);
      this.printer.println(`${voucher.currency} $${voucher.amount}`);
      this.printer.setTextSize(1, 1);
      this.printer.drawLine();
      this.printer.bold(false);
      this.printer.println('');
      
      // Detalles
      this.printer.alignLeft();
      this.printer.println(`Codigo: ${voucher.voucher_code}`);
      this.printer.println(`Fecha: ${new Date(voucher.issued_at).toLocaleString('es-DO')}`);
      this.printer.println(`Mesa: ${voucher.station_name}`);
      this.printer.println(`Operador: ${voucher.issued_by_name}`);
      this.printer.println('');
      
      this.printer.alignCenter();
      this.printer.drawLine();
      this.printer.println('Valido por 24 horas');
      this.printer.drawLine();
      this.printer.println('');
      this.printer.println('Gracias por su visita');
      this.printer.println('');
      
      this.printer.cut();
      
      await this.printer.execute();
      return { success: true };
      
    } catch (error) {
      console.error('Error imprimiendo:', error);
      return { success: false, error: error.message };
    }
  }

  async testPrint() {
    try {
      this.printer.alignCenter();
      this.printer.println('GRAN CASINO SOSUA');
      this.printer.println('Test de impresion');
      this.printer.println(new Date().toLocaleString('es-DO'));
      this.printer.cut();
      await this.printer.execute();
      return true;
    } catch (error) {
      console.error('Test error:', error);
      return false;
    }
  }
}

module.exports = PrinterManager;

INTEGRAR EN main.js:
const PrinterManager = require('./printerManager');
const printer = new PrinterManager();

ipcMain.handle('print-voucher', async (event, voucher) => {
  return await printer.printVoucher(voucher);
});

ipcMain.handle('test-print', async () => {
  return await printer.testPrint();
});

VERIFICAR:
1. Conectar impresora TM-T20II
2. node -e "const p = require('./printerManager'); new p().testPrint()"
3. Desde Mesa: crear voucher y hacer clic en Imprimir
```

---

### PASO 4: INTEGRAR SCANNER QR 📷
**Prioridad:** IMPORTANTE
**Tiempo:** 1-2 horas

**Prompt para Claude Code:**
```
Integra scanner QR en Caja/caja.html.

AGREGAR EN HTML:
<div class="scanner-section">
  <button id="btn-scan-camera">📷 Usar Cámara</button>
  <video id="scanner-video" style="display:none;" width="300"></video>
  <canvas id="scanner-canvas" style="display:none;"></canvas>
</div>

AGREGAR SCRIPT jsQR:
<script src="https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js"></script>

JAVASCRIPT:
let scanning = false;
let video = document.getElementById('scanner-video');
let canvas = document.getElementById('scanner-canvas');
let ctx = canvas.getContext('2d');

document.getElementById('btn-scan-camera').addEventListener('click', async () => {
  if (!scanning) {
    // Iniciar cámara
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' }
    });
    video.srcObject = stream;
    video.style.display = 'block';
    video.play();
    scanning = true;
    scanQR();
  } else {
    // Detener
    video.srcObject.getTracks().forEach(t => t.stop());
    video.style.display = 'none';
    scanning = false;
  }
});

function scanQR() {
  if (!scanning) return;
  
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const code = jsQR(imageData.data, imageData.width, imageData.height);
  
  if (code) {
    // QR detectado!
    document.getElementById('voucher-code').value = code.data;
    validateVoucher(); // Auto-validar
    
    // Detener cámara
    video.srcObject.getTracks().forEach(t => t.stop());
    video.style.display = 'none';
    scanning = false;
  } else {
    requestAnimationFrame(scanQR);
  }
}

VERIFICAR:
1. Abrir Caja
2. Click "Usar Cámara"
3. Mostrar QR impreso
4. Verificar que detecta y auto-valida
```

---

### PASO 5: INTEGRAR NETWORK DISCOVERY 🌐
**Prioridad:** IMPORTANTE
**Tiempo:** 30 minutos

**Prompt para Claude Code:**
```
Integra networkDiscovery.js en main.js.

AGREGAR EN main.js (después de crear db):
const NetworkDiscovery = require('./networkDiscovery');

const discovery = new NetworkDiscovery({
  port: 3001,
  isServer: currentRole === 'caja',
  stationId: currentStationId,
  stationName: currentStationName,
  stationType: currentRole
});

discovery.on('station-found', (station) => {
  console.log('✨ Estación:', station.name, station.ip);
  
  BrowserWindow.getAllWindows().forEach(win => {
    win.webContents.send('station-found', station);
  });
});

discovery.on('station-lost', (station) => {
  console.log('👋 Perdida:', station.name);
  
  BrowserWindow.getAllWindows().forEach(win => {
    win.webContents.send('station-lost', station);
  });
});

await discovery.start();

AGREGAR EN PRELOAD:
onStationFound: (callback) => {
  ipcRenderer.on('station-found', (event, station) => callback(station));
},
onStationLost: (callback) => {
  ipcRenderer.on('station-lost', (event, station) => callback(station));
}

AGREGAR EN HTML:
<div id="network-status">
  🌐 Estaciones: <span id="station-count">0</span>
</div>

<script>
window.api.onStationFound((station) => {
  console.log('Estación encontrada:', station);
  updateStationCount();
});
</script>

VERIFICAR:
1. Iniciar app en PC 1
2. Iniciar app en PC 2
3. Ver en consola "Estación: Mesa 1 192.168.1.x"
```

---

## 📊 PORCENTAJE ACTUALIZADO:

```
Base de datos:     100% ✅
Sincronización:    100% ✅
Handlers:          100% ✅
Migración legacy:    0% ❌
Interfaz Mesa:      40% ⚠️
Impresión:           0% ❌
Scanner QR:          0% ❌
Network Discovery:   0% ❌
Interfaz Auditor:   35% ⚠️
Interfaz Admin:     30% ⚠️

TOTAL GENERAL: 60%
BLOQUEANTES: 40%
```

---

## 🎯 PARA LLEGAR A PRODUCCIÓN:

### Crítico (sin esto NO funciona):
1. ❌ Migrar datos legacy
2. ❌ Completar Mesa
3. ❌ Integrar impresión
4. ❌ Scanner QR

### Importante (funciona pero limitado):
5. ⚠️ Network Discovery
6. ⚠️ Completar Auditor
7. ⚠️ Completar Admin

### Mejoras (nice to have):
8. 📊 Reportes automáticos
9. 📖 Manual de usuario
10. 🎨 Mejorar UI/UX

---

## ✅ PRÓXIMA ACCIÓN:

**PASO 1:** Enviar a Claude Code el script de migración (arriba)
**PASO 2:** Ejecutar: `node scripts\migrate-legacy.js`
**RESULTADO:** 10 tickets migrados a vouchers

---

**¿Ejecutamos el PASO 1 primero?** 🚀
