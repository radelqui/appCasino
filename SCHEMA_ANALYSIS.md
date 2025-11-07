# Análisis de Esquemas de Base de Datos
## Sistema Casino TITO - appCasino311025

**Fecha:** 31 de Octubre de 2024
**Autor:** Sistema de Análisis de Esquemas

---

## 📊 Resumen Ejecutivo

Tu sistema utiliza una **arquitectura híbrida** con dos bases de datos:

1. **SQLite (Local)** - Caché offline para operaciones sin conexión
2. **Supabase (Cloud PostgreSQL)** - Fuente de verdad y sincronización centralizada

### Estado Actual
- ✅ Supabase MCP configurado y listo
- ✅ Workers de sincronización implementados
- ✅ Sistema de auth basado en Supabase Auth
- ⚠️  Diferencias de esquema entre SQLite y Supabase que requieren atención

---

## 🗄️ Comparación de Esquemas

### 1. Tabla: **tickets** (SQLite) ↔️ **vouchers** (Supabase)

#### SQLite Schema (`tickets`)
```sql
CREATE TABLE tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,              -- Código del ticket (ej: PREV-001234)
    amount DECIMAL(10,2) NOT NULL,          -- Monto
    currency TEXT,                          -- DOP o USD
    mesa TEXT,                              -- Mesa (P01, P02, etc)
    estado TEXT,                            -- activo/emitido/usado/cancelado/expirado
    fecha_emision DATETIME,
    fecha_cobro DATETIME,
    cajero_id TEXT,
    hash_seguridad TEXT,
    qr_data TEXT,
    sincronizado INTEGER DEFAULT 0,         -- 0=no sync, 1=synced
    notas TEXT,

    -- Campos de compatibilidad
    issued_by_user_id TEXT,
    issued_at_station_id TEXT,
    redeemed_by_user_id TEXT,
    redeemed_at_station_id TEXT,
    redeemed_at TEXT
)
```

#### Supabase Schema (`vouchers`)
```sql
CREATE TABLE vouchers (
    id BIGSERIAL PRIMARY KEY,
    voucher_code TEXT UNIQUE NOT NULL,      -- Código del voucher
    amount DECIMAL(10,2) NOT NULL,          -- Monto
    currency TEXT,                          -- DOP o USD
    status TEXT,                            -- active/redeemed/cancelled/expired
    issued_at TIMESTAMPTZ,                  -- Fecha de emisión
    issued_by_user_id UUID,                 -- Usuario que emitió (FK a auth.users)
    issued_at_station_id INTEGER,           -- Estación/Mesa
    redeemed_at TIMESTAMPTZ,                -- Fecha de canje
    redeemed_by_user_id UUID,               -- Usuario que canjeó
    customer_name TEXT,                     -- Nombre del cliente/operador
    expires_at TIMESTAMPTZ,                 -- Fecha de expiración
    created_at TIMESTAMPTZ DEFAULT NOW()
)
```

#### 🔄 Mapeo de Campos
| SQLite (`tickets`) | Supabase (`vouchers`) | Notas |
|-------------------|----------------------|-------|
| `code` | `voucher_code` | ✅ Mismo propósito |
| `amount` | `amount` | ✅ Compatible |
| `currency` | `currency` | ✅ Compatible |
| `estado` | `status` | ⚠️ Requiere mapeo: `emitido→active`, `usado→redeemed`, `cancelado→cancelled` |
| `fecha_emision` | `issued_at` | ✅ Compatible (convertir a ISO) |
| `fecha_cobro` | `redeemed_at` | ✅ Compatible |
| `cajero_id` | `redeemed_by_user_id` | ⚠️ SQLite usa TEXT, Supabase usa UUID |
| `mesa` | `issued_at_station_id` | ⚠️ SQLite usa TEXT (P01), Supabase usa INTEGER (1) |
| `notas` | `customer_name` | ✅ Compatible |
| `sincronizado` | N/A | ⚠️ Campo solo en SQLite para control de sync |
| `hash_seguridad` | N/A | ⚠️ Campo solo en SQLite |
| `qr_data` | N/A | ⚠️ Campo solo en SQLite |
| N/A | `expires_at` | ⚠️ Campo solo en Supabase |

---

### 2. Tabla: **operadores** (SQLite) ↔️ **operadores** (Supabase)

#### SQLite Schema
```sql
CREATE TABLE operadores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo TEXT UNIQUE NOT NULL,            -- Código del operador (OP001)
    nombre TEXT NOT NULL,                   -- Nombre completo
    pin TEXT NOT NULL,                      -- PIN de acceso
    mesa_asignada TEXT,                     -- Mesa asignada (P01)
    activo INTEGER DEFAULT 1,               -- 1=activo, 0=inactivo
    fecha_registro DATETIME
)
```

#### Supabase Schema
```sql
CREATE TABLE operadores (
    id BIGSERIAL PRIMARY KEY,
    nombre TEXT NOT NULL,                   -- Nombre completo
    activo BOOLEAN DEFAULT true,            -- true/false
    mesas_asignadas TEXT[],                 -- Array de mesas (['P01', 'P02'])
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
)
```

#### 🔄 Diferencias Clave
| Característica | SQLite | Supabase | Impacto |
|---------------|--------|----------|---------|
| **PIN** | ✅ Incluido | ❌ No incluido | ⚠️ CRÍTICO: Supabase no almacena PINs |
| **Código** | ✅ Campo `codigo` único | ❌ No existe | ⚠️ Requiere migración |
| **Mesas** | 1 mesa (TEXT) | Múltiples mesas (ARRAY) | ⚠️ Arquitectura diferente |
| **Estado** | INTEGER (0/1) | BOOLEAN | ✅ Compatible con mapeo |

---

### 3. Tabla: **usuarios** (SQLite) ↔️ **users** (Supabase)

#### SQLite Schema
```sql
CREATE TABLE usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    role TEXT,                              -- ADMIN/MESA/CAJA/AUDITOR
    activo INTEGER DEFAULT 1,
    creado DATETIME,
    ultimo_acceso DATETIME,
    email TEXT,
    last_login DATETIME,
    metadata TEXT                           -- JSON con datos adicionales
)
```

#### Supabase Schema (auth.users + users)
```sql
-- Tabla personalizada 'users'
CREATE TABLE users (
    id UUID PRIMARY KEY REFERENCES auth.users(id),
    email TEXT NOT NULL,
    full_name TEXT,
    role TEXT,                              -- admin/mesa/caja/auditor
    pin_code TEXT,
    is_active BOOLEAN DEFAULT true,
    station_id INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
)
```

#### 🔄 Diferencias Clave
| Característica | SQLite | Supabase | Impacto |
|---------------|--------|----------|---------|
| **ID** | INTEGER autoincrement | UUID (from auth.users) | ⚠️ Requiere mapeo |
| **Auth** | Password hash local | Supabase Auth (email/password) | ✅ Más seguro |
| **PIN** | No incluido | ✅ Incluido en `users.pin_code` | ✅ Compatible |
| **Role** | UPPERCASE | lowercase | ⚠️ Requiere normalización |

---

### 4. Tabla: **auditoria** (SQLite) ↔️ **Sin equivalente directo en Supabase**

#### SQLite Schema
```sql
CREATE TABLE auditoria (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo_evento TEXT NOT NULL,
    ticket_code TEXT,
    usuario_id TEXT,
    descripcion TEXT,
    fecha DATETIME,
    datos_adicionales TEXT,                 -- JSON
    ip_address TEXT,
    user_agent TEXT,
    session_id TEXT,
    nivel_criticidad TEXT,                  -- BAJO/MEDIO/ALTO/CRITICO
    modulo TEXT,
    accion TEXT,
    resultado TEXT                          -- EXITO/FALLO/ADVERTENCIA
)
```

#### ⚠️ **IMPORTANTE:** Supabase no tiene una tabla de auditoría personalizada

**Recomendación:** Crear tabla `audit_logs` en Supabase para centralizar logs.

---

## 🔧 Estrategia de Sincronización Actual

Tu código en [pure/main.js](pure/main.js) implementa:

### 1. **Generación de Tickets** (Líneas 296-451)
```javascript
// PASO 1: Guardar en Supabase primero (fuente de verdad)
const { data, error } = await supabaseManager.client
  .from('vouchers')
  .insert({ voucher_code, amount, currency, ... })

// PASO 2: Guardar en SQLite (caché local)
db.db.prepare(`INSERT INTO tickets ...`)
  .run(ticketCode, amount, currency, ..., savedInSupabase ? 1 : 0)
```

✅ **Ventajas:**
- Supabase es la fuente de verdad
- SQLite funciona como caché offline
- Campo `sincronizado` rastrea el estado

⚠️ **Áreas de mejora:**
- No hay retry automático si Supabase falla
- No hay reconciliación de conflictos

### 2. **Validación de Vouchers** (Líneas 453-601)
```javascript
// PASO 1: Buscar en Supabase primero
const supabaseResult = await supabaseManager.getVoucher(code)

// PASO 2: Fallback a SQLite si falla
if (!rowData) {
  const row = db.db.prepare(`SELECT * FROM tickets WHERE code = ?`).get(code)
}
```

✅ **Buena práctica:** Supabase primero, SQLite como fallback

### 3. **Worker de Sincronización** (Líneas 1955-2043)
```javascript
// Ejecuta cada 2 minutos
syncWorkerInterval = setInterval(async () => {
  const pendingTickets = db.db.prepare(
    'SELECT * FROM tickets WHERE sincronizado = 0'
  ).all()

  // Subir a Supabase
  for (const ticket of pendingTickets) {
    const result = await supabaseManager.createVoucher(...)
    if (result.success) {
      db.db.prepare('UPDATE tickets SET sincronizado = 1 WHERE id = ?')
    }
  }
}, 2 * 60 * 1000)
```

✅ **Excelente:** Sincronización automática en background

---

## 📋 Recomendaciones y Próximos Pasos

### 1. ⚠️ **CRÍTICO: Sincronizar Tabla de Operadores**

**Problema:** Supabase `operadores` no tiene campo `pin` ni `codigo`

**Solución:**
```sql
-- Ejecutar en Supabase SQL Editor
ALTER TABLE operadores ADD COLUMN codigo TEXT UNIQUE;
ALTER TABLE operadores ADD COLUMN pin TEXT;
CREATE INDEX idx_operadores_codigo ON operadores(codigo);
```

### 2. ⚠️ **IMPORTANTE: Crear Tabla de Auditoría en Supabase**

```sql
-- Ejecutar en Supabase SQL Editor
CREATE TABLE audit_logs (
    id BIGSERIAL PRIMARY KEY,
    tipo_evento TEXT NOT NULL,
    voucher_code TEXT,
    user_id UUID REFERENCES auth.users(id),
    descripcion TEXT,
    fecha TIMESTAMPTZ DEFAULT NOW(),
    datos_adicionales JSONB,
    ip_address TEXT,
    user_agent TEXT,
    session_id TEXT,
    nivel_criticidad TEXT CHECK(nivel_criticidad IN ('BAJO', 'MEDIO', 'ALTO', 'CRITICO')),
    modulo TEXT,
    accion TEXT,
    resultado TEXT CHECK(resultado IN ('EXITO', 'FALLO', 'ADVERTENCIA'))
);

CREATE INDEX idx_audit_fecha ON audit_logs(fecha);
CREATE INDEX idx_audit_user ON audit_logs(user_id);
CREATE INDEX idx_audit_criticidad ON audit_logs(nivel_criticidad);
```

### 3. ✅ **Generar TypeScript Types**

Ejecuta el comando:
```bash
npx supabase gen types typescript --project-id elagvnnamabrjptovzyq > types/supabase.ts
```

### 4. ⚠️ **Normalizar Campos de Estado**

Crear funciones helper para mapear estados entre SQLite y Supabase:

```javascript
// utils/stateMapper.js
const stateMapper = {
  toSupabase: {
    'emitido': 'active',
    'activo': 'active',
    'usado': 'redeemed',
    'canjeado': 'redeemed',
    'cancelado': 'cancelled',
    'expirado': 'expired'
  },
  toSQLite: {
    'active': 'emitido',
    'redeemed': 'usado',
    'cancelled': 'cancelado',
    'expired': 'expirado'
  }
}
```

### 5. ✅ **Mejorar Worker de Sincronización**

Agregar:
- Retry con exponential backoff
- Batch processing para múltiples tickets
- Métricas de sincronización
- Notificaciones al usuario

---

## 📊 Métricas de Sincronización

### Estado Actual del Sistema

Para verificar cuántos tickets están pendientes de sincronización:

```sql
-- SQLite
SELECT COUNT(*) as pendientes
FROM tickets
WHERE sincronizado = 0;
```

### Comandos Útiles

```bash
# Ver estado de sincronización
/supabase-schema-sync --diff

# Forzar sincronización manual
/supabase-schema-sync --push

# Validar consistencia
/supabase-schema-sync --validate
```

---

## 🎯 Conclusiones

### ✅ Fortalezas
1. Arquitectura híbrida bien implementada
2. Supabase como fuente de verdad
3. Worker de sincronización automática
4. Fallback a SQLite funcional
5. MCP configurado correctamente

### ⚠️ Áreas de Mejora
1. **Operadores:** Falta sincronización de PINs y códigos
2. **Auditoría:** No existe en Supabase
3. **Types:** Generar TypeScript types
4. **Estados:** Normalizar mapeo entre DBs
5. **Retry:** Implementar retry logic en sincronización

### 📈 Impacto
- **Riesgo Bajo:** Sistema funciona correctamente en estado actual
- **Recomendación:** Implementar mejoras incrementalmente
- **Prioridad:** Auditoría y operadores sincronizados

---

## 📞 Soporte

Para usar las herramientas instaladas:
- `/supabase-schema-sync` - Sincronización de esquemas
- `/supabase-migration-assistant` - Asistente de migraciones
- MCP Supabase - Queries directas a la base de datos

**Configuración:**
- Proyecto: `elagvnnamabrjptovzyq`
- URL: `https://elagvnnamabrjptovzyq.supabase.co`
- MCP: Configurado en [.mcp.json](.mcp.json)
