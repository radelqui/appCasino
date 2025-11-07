# ARQUITECTURA DEL SISTEMA
**Sistema TITO - Casino QR Voucher**

---

## TABLA DE CONTENIDOS

1. [Visión General](#visión-general)
2. [Arquitectura de Alto Nivel](#arquitectura-de-alto-nivel)
3. [Flujo de Datos](#flujo-de-datos)
4. [Componentes Principales](#componentes-principales)
5. [Base de Datos](#base-de-datos)
6. [Seguridad](#seguridad)
7. [Comunicación IPC](#comunicación-ipc)
8. [Sincronización](#sincronización)
9. [Patrones de Diseño](#patrones-de-diseño)
10. [Despliegue](#despliegue)

---

## VISIÓN GENERAL

### Paradigma Arquitectónico
**Arquitectura Híbrida: Cliente Pesado con Sincronización Cloud**

El sistema está construido con una arquitectura de **cliente grueso** (Electron) que mantiene su propia base de datos local (SQLite) y sincroniza periódicamente con un backend en la nube (Supabase).

### Decisiones Clave de Diseño

#### 1. SQLite como Base de Datos Primaria
**Razón:**
- Operación offline-first
- Latencia ultra-baja (< 10ms)
- Sin dependencia de conexión a Internet para operación crítica
- Portabilidad y simplicidad

#### 2. Supabase como Backup y Sincronización
**Razón:**
- Respaldo automático en la nube
- Acceso centralizado para reportes
- Sincronización entre múltiples estaciones
- RLS (Row Level Security) incorporado

#### 3. Electron como Plataforma
**Razón:**
- Acceso a hardware (impresoras, scanners)
- Aplicación desktop nativa para Windows
- Experiencia de usuario consistente
- No requiere navegador web

#### 4. HTML/CSS/JS Vanilla (No React en Producción)
**Razón:**
- Simplicidad y rendimiento
- Menor overhead de memoria
- Más rápido para interfaces simples
- Debugging más sencillo

---

## ARQUITECTURA DE ALTO NIVEL

```
┌─────────────────────────────────────────────────────────────────────┐
│                         ESTACIÓN DE TRABAJO                          │
│                         (Windows 10/11)                              │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                    ELECTRON (Proceso Principal)                 │ │
│  │                                                                 │ │
│  │  ┌─────────────────┐  ┌──────────────────┐  ┌──────────────┐ │ │
│  │  │  main.js        │  │ supabaseManager  │  │ healthMonitor│ │ │
│  │  │  (Entry Point)  │  │  (Sync Manager)  │  │ (Anti-Hang)  │ │ │
│  │  └────────┬────────┘  └────────┬─────────┘  └──────┬───────┘ │ │
│  │           │                    │                     │          │ │
│  │  ┌────────┴─────────────────────┴─────────────────┬─┘          │ │
│  │  │              IPC Main Process                   │            │ │
│  │  │  - ticketHandlers   - userHandlers             │            │ │
│  │  │  - syncHandlers     - configHandlers           │            │ │
│  │  └────────────────────────────────────────────────┘            │ │
│  │           │                                                     │ │
│  │  ┌────────┴─────────────────┐     ┌─────────────────────────┐ │ │
│  │  │   SQLite Local (Primary)  │     │  Supabase Client        │ │ │
│  │  │   - tickets               │     │  (Cloud Sync)           │ │ │
│  │  │   - users                 │────▶│                          │ │ │
│  │  │   - operadores            │     │  - PostgreSQL + Auth    │ │ │
│  │  │   - audit_log             │     │  - RLS Policies         │ │ │
│  │  └───────────────────────────┘     └─────────────────────────┘ │ │
│  │                                                                 │ │
│  │  ┌───────────────────────────────────────────────────────────┐ │ │
│  │  │              Hardware Layer                                │ │ │
│  │  │  - Printer Service (PDF/ESC-POS)                          │ │ │
│  │  │  - QR Scanner (USB HID)                                   │ │ │
│  │  │  - QR Generator (crypto + qrcode)                         │ │ │
│  │  └───────────────────────────────────────────────────────────┘ │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │                ELECTRON (Proceso Renderer)                       │ │
│  │                                                                  │ │
│  │  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌────────────┐  │ │
│  │  │ mesa.html │  │ caja.html │  │config.html│  │auditor.html│  │ │
│  │  │           │  │           │  │           │  │            │  │ │
│  │  │ Emitir    │  │ Canjear   │  │ Gestionar │  │ Ver Todo   │  │ │
│  │  │ Tickets   │  │ Tickets   │  │ Sistema   │  │(Solo Leer) │  │ │
│  │  └───────────┘  └───────────┘  └───────────┘  └────────────┘  │ │
│  │         │             │               │              │          │ │
│  │         └─────────────┴───────────────┴──────────────┘          │ │
│  │                            │                                     │ │
│  │                  ┌─────────┴──────────┐                         │ │
│  │                  │  window.api (IPC)  │                         │ │
│  │                  │  (Preload Bridge)  │                         │ │
│  │                  └────────────────────┘                         │ │
│  └──────────────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────────┘
                                 │
                                 │ HTTPS
                                 ▼
                    ┌────────────────────────┐
                    │   SUPABASE CLOUD       │
                    │                        │
                    │  PostgreSQL Database   │
                    │  + Auth                │
                    │  + RLS                 │
                    │  + Realtime (futuro)   │
                    └────────────────────────┘
```

---

## FLUJO DE DATOS

### 1. Emisión de Ticket (Mesa)

```
Usuario (Mesa) → [Ingresar Monto] → mesa.html
                                      │
                                      │ window.api.invoke('ticket:create')
                                      ▼
                                 main.js (IPC Handler)
                                      │
                    ┌─────────────────┴──────────────────┐
                    │                                     │
                    ▼                                     ▼
            [Generar QR + Hash]                  [Validar Permisos]
         (src/main/security/qr-crypto.js)        (sesión actual)
                    │                                     │
                    └─────────────────┬──────────────────┘
                                      │
                              ┌───────┴────────┐
                              │                │
                              ▼                ▼
                    [Guardar en SQLite]  [Sincronizar a Supabase]
                    (tickets table)       (worker background)
                              │                │
                              │                │ (async, no bloquea)
                              │                ▼
                              │         [Supabase Insert]
                              │         (vouchers table)
                              │                │
                              │                └─[Success] → Marca sincronizado=1
                              │
                              └─────────────┐
                                            │
                                            ▼
                              [Generar PDF del Ticket]
                           (shared/ticket-service.js)
                                            │
                                            ▼
                                [Imprimir via Printer Service]
                           (src/main/hardware/printer.js)
                                            │
                              ┌─────────────┴──────────────┐
                              │                            │
                              ▼                            ▼
                        [Modo PDF]                  [Modo ESC/POS]
                    (Windows Spooler)            (USB Térmica Directa)
                              │                            │
                              └────────────┬───────────────┘
                                           │
                                           ▼
                                    [Ticket Físico Impreso]
                                           │
                                           ▼
                                   [Audit Log Registrado]
                                  (event: ticket_issued)
```

### 2. Canje de Ticket (Caja)

```
Usuario (Caja) → [Escanear QR] → Lector USB → caja.html
                                                  │
                                   window.api.invoke('ticket:redeem', {qr_code})
                                                  │
                                                  ▼
                                            main.js (IPC Handler)
                                                  │
                                ┌─────────────────┴────────────────┐
                                │                                  │
                                ▼                                  ▼
                    [Validar Hash QR]                      [Buscar en SQLite]
                (parseTicketQR + validateTicketQR)         (tickets WHERE code=?)
                                │                                  │
                                │                                  │
                    ┌───────────┴────────────┐                    │
                    │                        │                    │
                    ▼                        ▼                    ▼
            [Hash Correcto?]         [No Alterado?]       [Estado = activo?]
                    │                        │                    │
                    └────────────────────────┴────────────────────┘
                                             │
                                      [Todas OK?]
                                             │
                              ┌──────────────┴───────────────┐
                              │                              │
                              ▼ SÍ                           ▼ NO
                    ┌─────────────────┐              [Rechazar Canje]
                    │ Actualizar BD   │              (Error Message)
                    │ estado='usado'  │
                    │ fecha_cobro=NOW │
                    │ cajero_id=?     │
                    └────────┬────────┘
                             │
                    ┌────────┴────────┐
                    │                 │
                    ▼                 ▼
            [SQLite UPDATE]   [Supabase UPDATE]
              (inmediato)      (background worker)
                    │                 │
                    │                 └─[Retry si falla]
                    │
                    └─────────────┐
                                  │
                                  ▼
                        [Registrar en Audit Log]
                       (event: ticket_redeemed)
                                  │
                                  ▼
                          [Retornar Success a UI]
                                  │
                                  ▼
                       [Mostrar: "CANJEADO - $XXX DOP"]
```

### 3. Sincronización (Background Worker)

```
                     [Worker Automático - Cada 60s]
                                  │
                                  ▼
                  [SELECT * FROM tickets WHERE sincronizado=0]
                                  │
                       ┌──────────┴─────────┐
                       │                    │
                       ▼ No hay             ▼ Hay pendientes
                  [Sleep 60s]          [Procesar Queue]
                       │                    │
                       └──────────┐         │
                                  │   ┌─────┴───────┐
                                  │   │             │
                                  │   ▼             │
                                  │ [Para cada ticket pendiente]
                                  │   │
                                  │   ▼
                                  │ [Intentar INSERT/UPDATE en Supabase]
                                  │   │
                                  │   ├─[Success] → UPDATE local sincronizado=1
                                  │   │
                                  │   └─[Error] ─┐
                                  │              │
                                  │              ▼
                                  │        [Retry con Exponential Backoff]
                                  │        (1s, 2s, 4s, 8s...)
                                  │              │
                                  │              ├─[Max retries] → Log error
                                  │              │
                                  │              └─[Success eventual] → Sincronizado
                                  │
                                  └──────[Loop Infinito]───────┐
                                                              │
                                                              └─[Continue]
```

---

## COMPONENTES PRINCIPALES

### 1. pure/main.js
**Propósito:** Entry point y orquestador principal del sistema.

**Responsabilidades:**
- Inicialización de Electron
- Registro de IPC handlers
- Gestión de ventanas (BrowserWindow)
- Coordinación entre módulos
- Manejo de eventos de aplicación

**Handlers IPC Registrados:**
```javascript
- auth:login
- auth:logout
- auth:get-session
- ticket:create
- ticket:redeem
- ticket:get-all
- ticket:sync
- user:*
- operador:*
- config:*
- health-check
```

**Tamaño:** ~2500 líneas
**Estado:** Activo (producción)

---

### 2. pure/supabaseManager.js
**Propósito:** Gestión centralizada de la conexión a Supabase.

**Responsabilidades:**
- Inicialización de cliente Supabase
- Dos clientes: SERVICE_ROLE (admin) y ANON (auth usuarios)
- CRUD operations helpers
- Manejo de errores de conexión
- Retry automático

**Métodos Principales:**
```javascript
- initialize()
- isAvailable()
- createVoucher(data)
- updateVoucher(id, updates)
- getVouchers(filters)
- createUser(data)
- updateUser(id, updates)
- syncTickets(tickets)
```

**Tamaño:** ~500 líneas
**Estado:** Activo (producción)

---

### 3. pure/healthMonitor.js
**Propósito:** Sistema anti-cuelgues que detecta operaciones bloqueadas.

**Responsabilidades:**
- Registrar inicio/fin de operaciones
- Detectar timeouts (operaciones que exceden tiempo límite)
- Emitir eventos de alerta
- Calcular métricas (promedio, máximo, mínimo)
- Proveer estadísticas en tiempo real

**API Principal:**
```javascript
const endOp = healthMonitor.startOperation('nombre', timeout_ms);
try {
  // ... operación ...
  endOp(); // Marca como completada
} catch (e) {
  endOp(); // También marca en catch
  throw e;
}

// Consultar estado
const stats = healthMonitor.getStats();
```

**Tamaño:** ~300 líneas
**Estado:** Activo (producción)
**Documentación:** [SISTEMA_SALUD_ANTI_CUELGUES.md](SISTEMA_SALUD_ANTI_CUELGUES.md)

---

### 4. pure/safeOperations.js
**Propósito:** Wrappers seguros para operaciones críticas con timeout.

**Clases:**
- `SafeDatabaseOperations` - SQLite con timeout
- `SafeSupabaseOperations` - Supabase con timeout
- `SafePrinterOperations` - Impresión con timeout (futuro)

**Uso:**
```javascript
const safeDb = new SafeDatabaseOperations(db, healthMonitor);
const ticket = await safeDb.query('createTicket', [data], 5000);
// Si excede 5s, lanza TimeoutError
```

**Tamaño:** ~200 líneas
**Estado:** Activo (producción)

---

### 5. Caja/database.js
**Propósito:** Clase principal de acceso a SQLite.

**Responsabilidades:**
- Inicialización de esquema
- CRUD de tickets
- CRUD de operadores
- CRUD de usuarios (legacy)
- Queries de auditoría
- Gestión de transacciones

**Métodos Principales:**
```javascript
- createTicket(data)
- getTicketByCode(code)
- updateTicketStatus(code, status)
- redeemTicket(code, cajero_id)
- getAllTickets(filters)
- createOperador(data)
- getOperadores()
- createAuditLog(data)
```

**Tamaño:** ~800 líneas
**Estado:** Activo (producción)

---

### 6. shared/ticket-service.js
**Propósito:** Servicio centralizado de generación de tickets PDF.

**Responsabilidades:**
- Generar PDF de ticket con formato estándar
- Insertar QR code
- Insertar código de barras (opcional)
- Formateo de moneda (DOP/USD)
- Tamaño configurable (80mm x 156mm default)

**API:**
```javascript
const pdfBuffer = await TicketService.generateTicket({
  ticket_number: 'CSR-2024-001234',
  valor: 500.00,
  moneda: 'DOP',
  fecha_emision: new Date(),
  qr_code: 'data:image/png;base64,...',
  mesa_id: 'P01',
  operador_nombre: 'Juan Pérez',
  pageWidthMm: 80,
  pageHeightMm: 156
});
```

**Tamaño:** ~400 líneas
**Estado:** Activo (producción)

---

### 7. src/main/hardware/printer.js
**Propósito:** Abstracción de impresión térmica y PDF.

**Responsabilidades:**
- Soporte dual: PDF (spooler Windows) y ESC/POS (térmica)
- Detección de impresora configurada
- Generación de comandos ESC/POS
- Manejo de errores de impresión

**Modos:**
1. **PDF Mode:** Genera PDF temporal y lo envía al spooler de Windows
2. **ESC/POS Mode:** Envía comandos directos a impresora térmica vía USB

**Tamaño:** ~300 líneas
**Estado:** Activo (producción)

---

### 8. src/main/security/qr-crypto.js
**Propósito:** Generación y validación de QR codes seguros.

**Responsabilidades:**
- Generar código de ticket único
- Computar hash SHA256 (HMAC con secret)
- Generar QR code (data URL)
- Validar QR recibido
- Parsear datos del QR

**Formato QR:**
```
id|valor|moneda|fecha|hash
Ejemplo:
CSR-2024-001234|500.00|DOP|2024-10-31T10:30:00Z|a3f2b9c1...
```

**Tamaño:** ~150 líneas
**Estado:** Activo (producción)

---

## BASE DE DATOS

### Arquitectura de Datos: Dual Database

```
┌────────────────────────────────────┐
│       SQLite Local (Primary)       │
│                                    │
│  - Latencia: < 10ms                │
│  - Disponibilidad: 100%            │
│  - Tamaño: ~50 MB (10K tickets)    │
│  - Ubicación: data/casino.db       │
│                                    │
│  Tablas:                           │
│  - tickets                         │
│  - operadores                      │
│  - usuarios                        │
│  - auditoria                       │
│  - configuracion                   │
└────────────────┬───────────────────┘
                 │
                 │ Sincronización Bidireccional
                 │ (Worker Background - cada 60s)
                 │
                 ▼
┌────────────────────────────────────┐
│   Supabase PostgreSQL (Backup)    │
│                                    │
│  - Latencia: 100-500ms (cloud)     │
│  - Disponibilidad: 99.9%           │
│  - Almacenamiento ilimitado        │
│  - Acceso: HTTPS API               │
│                                    │
│  Tablas:                           │
│  - vouchers (tickets)              │
│  - operadores                      │
│  - users (auth.users + perfil)    │
│  - audit_log                       │
│  - stations                        │
└────────────────────────────────────┘
```

### Schema SQLite (Primario)

#### Tabla: tickets
```sql
CREATE TABLE tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,              -- Código único del ticket
  amount DECIMAL(10,2) NOT NULL,          -- Monto
  currency TEXT CHECK(currency IN ('USD', 'DOP')),
  mesa TEXT,                              -- ID de la mesa (P01, P02, etc)
  estado TEXT CHECK(estado IN ('activo', 'emitido', 'usado', 'cancelado', 'expirado')),
  fecha_emision DATETIME DEFAULT CURRENT_TIMESTAMP,
  fecha_cobro DATETIME,                   -- Cuándo se canjeó
  cajero_id TEXT,                         -- Quién lo canjeó
  hash_seguridad TEXT,                    -- Hash SHA256 del QR
  qr_data TEXT,                           -- Contenido del QR
  sincronizado INTEGER DEFAULT 0,         -- 0=pendiente, 1=sincronizado
  notas TEXT,

  -- Campos de compatibilidad con Supabase
  issued_by_user_id TEXT,
  issued_at_station_id TEXT,
  redeemed_by_user_id TEXT,
  redeemed_at_station_id TEXT,
  redeemed_at TEXT
);

CREATE INDEX idx_tickets_code ON tickets(code);
CREATE INDEX idx_tickets_estado ON tickets(estado);
CREATE INDEX idx_tickets_sincronizado ON tickets(sincronizado);
CREATE INDEX idx_tickets_fecha_emision ON tickets(fecha_emision);
```

#### Tabla: operadores
```sql
CREATE TABLE operadores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo TEXT UNIQUE NOT NULL,            -- Código del operador (OP001)
  nombre TEXT NOT NULL,                   -- Nombre completo
  pin TEXT NOT NULL,                      -- PIN para login rápido
  mesa_asignada TEXT,                     -- Mesa asignada (opcional)
  activo INTEGER DEFAULT 1,               -- 1=activo, 0=inactivo
  fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP,
  sincronizado INTEGER DEFAULT 0
);

CREATE INDEX idx_operadores_codigo ON operadores(codigo);
CREATE INDEX idx_operadores_activo ON operadores(activo);
```

#### Tabla: auditoria
```sql
CREATE TABLE auditoria (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo_evento TEXT NOT NULL,              -- login, logout, ticket_issued, etc.
  ticket_code TEXT,                       -- Código de ticket relacionado
  usuario_id TEXT,                        -- Usuario que generó el evento
  descripcion TEXT,
  fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
  datos_adicionales TEXT,                 -- JSON con data extra
  ip_address TEXT,
  user_agent TEXT,
  session_id TEXT,
  nivel_criticidad TEXT CHECK(nivel_criticidad IN ('BAJO','MEDIO','ALTO','CRITICO')),
  modulo TEXT,                            -- mesa, caja, admin, etc.
  accion TEXT,                            -- create, update, delete, etc.
  resultado TEXT CHECK(resultado IN ('EXITO','FALLO','ADVERTENCIA'))
);

CREATE INDEX idx_auditoria_fecha ON auditoria(fecha);
CREATE INDEX idx_auditoria_tipo_evento ON auditoria(tipo_evento);
CREATE INDEX idx_auditoria_usuario_id ON auditoria(usuario_id);
```

### Schema Supabase (Respaldo)

Ver: [SqulInstrucciones/migration-sync-schemas.sql](SqulInstrucciones/migration-sync-schemas.sql)

**Diferencias principales:**
- Tabla `vouchers` en lugar de `tickets`
- Campo `status` en lugar de `estado`
- Triggers automáticos para `updated_at`
- RLS (Row Level Security) policies
- Tabla `users` integrada con Supabase Auth

---

## SEGURIDAD

### 1. Autenticación

```
Usuario → [Ingresa email + password] → Supabase Auth (signInWithPassword)
                                              │
                                              ├─[Success] → JWT Token
                                              │            │
                                              │            ├─Guardar en sesión local
                                              │            └─Obtener perfil de tabla users
                                              │
                                              └─[Fail] → Rechazar login
```

**Implementación:**
- Supabase Auth para gestión de usuarios
- JWT tokens para sesiones
- Roles almacenados en tabla `users.role`
- Verificación de sesión en cada operación crítica

### 2. Códigos QR Seguros

**Generación:**
```javascript
const payload = { id, valor, moneda, fecha };
const hash = HMAC-SHA256(payload, QR_SECRET);
const qrString = `${id}|${valor}|${moneda}|${fecha}|${hash}`;
```

**Validación:**
```javascript
const parts = qrString.split('|');
const [id, valor, moneda, fecha, hash] = parts;
const expectedHash = HMAC-SHA256({id, valor, moneda, fecha}, QR_SECRET);
return hash === expectedHash; // Válido si coincide
```

**Propiedades de Seguridad:**
- Imposible falsificar sin conocer QR_SECRET
- Cualquier modificación invalida el hash
- Detección de replay attacks (fecha + ID único)

### 3. Row Level Security (Supabase)

```sql
-- Solo users autenticados pueden ver vouchers
CREATE POLICY "Users can view vouchers" ON vouchers
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Solo admins pueden modificar usuarios
CREATE POLICY "Only admins can modify users" ON users
  FOR ALL USING (
    auth.uid() IN (
      SELECT id FROM users WHERE role = 'admin'
    )
  );
```

### 4. Sanitización de Inputs

**SQLite:**
- Prepared statements (mejor-sqlite3)
- Validación de tipos
- Escape automático

**Supabase:**
- Client-side validation
- RLS en servidor
- Políticas de seguridad

---

## COMUNICACIÓN IPC

### Modelo: Electron IPC (Inter-Process Communication)

```
┌───────────────────────────┐
│   Renderer Process        │
│   (mesa.html, caja.html)  │
│                           │
│   JavaScript Frontend     │
└─────────────┬─────────────┘
              │
              │ window.api.invoke('channel', args)
              │
              ▼
┌─────────────────────────────┐
│   Preload Script            │
│   (src/main/preload.js)     │
│                             │
│   contextBridge.exposeInMainWorld('api', {
│     invoke: (channel, args) => ipcRenderer.invoke(channel, args)
│   });
└─────────────┬───────────────┘
              │
              │ ipcRenderer.invoke()
              │
              ▼
┌─────────────────────────────┐
│   Main Process              │
│   (pure/main.js)            │
│                             │
│   ipcMain.handle(channel, (event, args) => {
│     // Process request
│     return result;
│   });
└─────────────────────────────┘
```

### Canales IPC Registrados

| Canal | Tipo | Descripción | Handler |
|-------|------|-------------|---------|
| `auth:login` | invoke | Login de usuario | main.js |
| `auth:logout` | invoke | Logout de usuario | main.js |
| `auth:get-session` | invoke | Obtener sesión actual | main.js |
| `ticket:create` | invoke | Crear nuevo ticket | main.js |
| `ticket:redeem` | invoke | Canjear ticket | main.js |
| `ticket:get-all` | invoke | Obtener todos los tickets | main.js |
| `ticket:sync` | invoke | Forzar sincronización | main.js |
| `operador:get-all` | invoke | Obtener operadores | main.js |
| `operador:create` | invoke | Crear operador | main.js |
| `operador:update` | invoke | Actualizar operador | main.js |
| `config:get` | invoke | Obtener configuración | main.js |
| `config:set` | invoke | Guardar configuración | main.js |
| `health-check` | invoke | Estado del sistema | main.js |
| `open-view` | invoke | Abrir vista (navegación) | main.js |

### Estructura de Respuesta Estándar

```javascript
// Success
{
  success: true,
  data: { ... },
  message: "Operación exitosa" // opcional
}

// Error
{
  success: false,
  error: "Descripción del error",
  code: "ERROR_CODE" // opcional
}
```

---

## SINCRONIZACIÓN

### Estrategia: Eventual Consistency

El sistema utiliza **consistencia eventual** donde:
1. SQLite es la fuente de verdad local
2. Supabase es el respaldo en la nube
3. La sincronización es asíncrona y en background
4. Las operaciones NO se bloquean esperando Supabase

### Worker de Sincronización

**Ubicación:** [pure/main.js](pure/main.js) (línea ~1940)

**Algoritmo:**
```javascript
// Cada 60 segundos
setInterval(async () => {
  // 1. Obtener tickets pendientes
  const pending = db.getAllTickets({ sincronizado: 0 });

  if (pending.length === 0) return;

  // 2. Para cada ticket pendiente
  for (const ticket of pending) {
    try {
      // 3. Intentar sincronizar con Supabase
      const result = await supabaseManager.createVoucher({
        voucher_code: ticket.code,
        amount: ticket.amount,
        currency: ticket.currency,
        // ... más campos
      });

      if (result.success) {
        // 4. Marcar como sincronizado en local
        db.markTicketAsSynced(ticket.id);
      }
    } catch (error) {
      // 5. Retry con exponential backoff
      await retryWithBackoff(ticket, maxRetries);
    }
  }
}, 60000); // 60 segundos
```

**Características:**
- No bloquea operaciones críticas
- Retry automático con exponential backoff
- Métricas de sincronización
- Logs detallados de fallos

---

## PATRONES DE DISEÑO

### 1. Singleton Pattern

**Uso:** Instancias únicas de servicios críticos

```javascript
// supabaseManager
let instance = null;
function getSupabaseManager() {
  if (!instance) {
    instance = new SupabaseManager();
  }
  return instance;
}

// healthMonitor
let healthMonitorInstance = null;
function getHealthMonitor() {
  if (!healthMonitorInstance) {
    healthMonitorInstance = new HealthMonitor();
  }
  return healthMonitorInstance;
}
```

### 2. Factory Pattern

**Uso:** Generación de tickets

```javascript
class TicketService {
  static async generateTicket(data) {
    // Crea PDF basado en parámetros
    // Retorna Buffer
  }
}
```

### 3. Strategy Pattern

**Uso:** Modos de impresión (PDF vs ESC/POS)

```javascript
class PrinterService {
  printTicket(data) {
    if (this.mode === 'PDF') {
      return this.printPdfTicket(data);
    } else {
      return this.printEscPosTicket(data);
    }
  }
}
```

### 4. Observer Pattern

**Uso:** Health Monitor emitiendo eventos

```javascript
class HealthMonitor extends EventEmitter {
  detectTimeout(operation) {
    this.emit('timeout', { operation });
  }
}

healthMonitor.on('timeout', (data) => {
  console.error('Timeout detectado:', data);
});
```

### 5. Repository Pattern

**Uso:** Acceso a datos (CasinoDatabase)

```javascript
class CasinoDatabase {
  createTicket(data) { /* ... */ }
  getTicketByCode(code) { /* ... */ }
  updateTicket(id, updates) { /* ... */ }
  // Abstrae la lógica de BD
}
```

---

## DESPLIEGUE

### Modo Desarrollo

```bash
npm install
npm start  # Ejecuta pure/main.js con Electron
```

**Ventajas:**
- Hot reload (al guardar archivos)
- DevTools habilitadas
- Logs verbosos

### Modo Producción

```bash
npm run build:pure:portable
```

**Output:** `dist/Sistema TITO Casino.exe` (portable, ~200 MB)

**Características:**
- Single .exe (no requiere instalación)
- Incluye Node.js + Electron embebidos
- Autoactualización deshabilitada (manual)
- Logs en archivo (data/logs/)

### Requisitos de Hardware en Producción

| Componente | Especificación |
|------------|----------------|
| CPU | Intel Core i3 8th Gen o superior |
| RAM | 4 GB mínimo, 8 GB recomendado |
| Disco | 500 MB libres (SSD recomendado) |
| Red | WiFi/Ethernet para sincronización |
| Impresora | Térmica 80mm ESC/POS (opcional) |
| Lector QR | USB HID o cámara (opcional) |

### Configuración de Red

**Firewall:**
- Abrir puerto UDP 3001 (NetworkDiscovery - futuro)
- Permitir HTTPS saliente a `*.supabase.co`

**DNS:**
- Acceso a `elagvnnamabrjptovzyq.supabase.co`

---

## DECISIONES TÉCNICAS Y JUSTIFICACIONES

### ¿Por qué Electron y no Web App?

| Criterio | Electron | Web App |
|----------|----------|---------|
| Acceso a Hardware | ✅ Directo (USB) | ❌ Limitado (WebUSB) |
| Impresora Térmica | ✅ Nativo | ❌ Requiere backend |
| Offline-First | ✅ SQLite local | ❌ Requiere service worker |
| Distribución | ✅ .exe portable | ❌ Requiere servidor |
| Seguridad QR_SECRET | ✅ No expuesto | ❌ Visible en cliente |

**Conclusión:** Electron permite operación 100% offline con hardware nativo.

### ¿Por qué SQLite y no solo PostgreSQL?

| Criterio | SQLite Local | PostgreSQL Cloud |
|----------|--------------|------------------|
| Latencia | ✅ < 10ms | ❌ 100-500ms |
| Disponibilidad | ✅ 100% | ⚠️ 99.9% (depende de Internet) |
| Costo | ✅ Gratis | ⚠️ Requiere servidor |
| Sincronización | ⚠️ Manual | ✅ Automática |

**Conclusión:** SQLite + Supabase = Lo mejor de ambos mundos.

### ¿Por qué HTML/CSS/JS Vanilla y no React?

| Criterio | Vanilla | React |
|----------|---------|-------|
| Complejidad | ✅ Simple | ❌ Requiere bundler |
| Rendimiento | ✅ Más rápido | ⚠️ Virtual DOM overhead |
| Tamaño build | ✅ ~50 MB | ❌ ~150 MB |
| Debugging | ✅ Directo | ⚠️ Source maps |

**Conclusión:** Para UIs simples, vanilla JS es más eficiente.

---

## SIGUIENTES PASOS ARQUITECTÓNICOS

Ver [MODULOS_FALTANTES.md](MODULOS_FALTANTES.md) para roadmap completo.

### Mejoras Planificadas

1. **NetworkDiscovery P2P**
   - Auto-descubrimiento de estaciones en LAN
   - Eliminación de configuración manual de IPs

2. **WebSocket Real-Time**
   - Sincronización en tiempo real entre estaciones
   - Notificaciones push de tickets canjeados

3. **Encriptación de BD SQLite**
   - SQLCipher para proteger datos sensibles
   - Key management seguro

4. **Microservicios de Reportes**
   - Separar lógica de reportes a servicio independiente
   - API REST para dashboards externos

---

**Fin de Arquitectura**

**Versión:** 1.0.0
**Última actualización:** 31 de Octubre de 2025
**Autor:** Sistema TITO - Casino QR Voucher
