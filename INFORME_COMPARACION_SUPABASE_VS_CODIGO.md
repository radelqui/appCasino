# 🔍 INFORME: COMPARACIÓN SUPABASE vs CÓDIGO AUDITOR

**Fecha:** 2025-10-29
**Análisis:** Estructura real de Supabase vs Implementación en código

---

## ✅ ESTRUCTURA REAL DE SUPABASE (VERIFICADA)

### 📋 Tabla `vouchers`

**Columnas encontradas:**
```javascript
[
  'id',                   // UUID
  'voucher_code',         // Código del ticket (ej: "TEST-1761751842844")
  'qr_data',              // Datos del QR
  'qr_hash',              // Hash de seguridad
  'amount',               // Monto (número)
  'currency',             // Moneda (USD/DOP)
  'status',               // Estado: 'active', 'redeemed', 'cancelled'
  'issued_by_user_id',    // UUID del usuario que emitió
  'issued_at_station_id', // ID de la estación (número)
  'issued_at',            // Fecha emisión (timestamp)
  'redeemed_by_user_id',  // UUID del usuario que canjeó
  'redeemed_at_station_id', // ID de la estación de canje
  'redeemed_at',          // Fecha de canje (timestamp)
  'expires_at',           // Fecha de expiración
  'customer_name',        // Nombre del cliente (opcional)
  'customer_notes',       // Notas del cliente (opcional)
  'created_at',           // Timestamp de creación
  'updated_at'            // Timestamp de actualización
]
```

**Ejemplo real de registro:**
```json
{
  "id": "187ff4d0-4c8e-445e-a866-4cec75507d43",
  "voucher_code": "TKT-TEST-00001",
  "qr_data": "TKT-TEST-00001|100|USD",
  "qr_hash": "5aa6f98753449adc1ee99c2af48b06c18dfa1c4aeda1a8923780b515d4334cfe",
  "amount": 100,
  "currency": "USD",
  "status": "active",
  "issued_by_user_id": "85397c30-3856-4d82-a4bb-06791b8cacd0",
  "issued_at_station_id": 1,
  "issued_at": "2025-10-28T00:49:22.413438+00:00",
  "redeemed_by_user_id": null,
  "redeemed_at_station_id": null,
  "redeemed_at": null,
  "expires_at": "2025-10-29T00:49:22.413438+00:00",
  "customer_name": null,
  "customer_notes": null,
  "created_at": "2025-10-28T00:49:22.413438+00:00",
  "updated_at": "2025-10-28T00:49:22.413438+00:00"
}
```

### 📋 Tabla `users`

**Columnas encontradas:**
```javascript
[
  'id',         // UUID
  'email',      // Email del usuario
  'full_name',  // Nombre completo
  'role',       // Rol: 'admin', 'cashier', 'attendant'
  'station_id', // ID de estación asignada (puede ser null)
  'is_active',  // Boolean
  'created_at', // Timestamp
  'updated_at', // Timestamp
  'pin_code'    // PIN del usuario
]
```

**Ejemplo real:**
```json
{
  "id": "22bafddb-b16a-44ff-a007-2138ded32793",
  "email": "admin@casinosusua.com",
  "full_name": "Administrador Principal",
  "role": "admin",
  "station_id": null,
  "is_active": true,
  "created_at": "2025-10-28T00:49:22.413438+00:00",
  "updated_at": "2025-10-28T00:49:22.413438+00:00",
  "pin_code": "1234"
}
```

### 📋 Tabla `stations`

**Columnas encontradas:**
```javascript
[
  'id',             // Número (1, 2, 3...)
  'station_type',   // Tipo de estación
  'station_number', // Número de estación
  'station_name',   // Nombre (actualmente null)
  'is_active',      // Boolean
  'created_at',     // Timestamp
  'updated_at'      // Timestamp
]
```

### 📋 Tabla `tickets`

**Estado:** ✅ Existe pero está vacía (0 registros)

---

## 📊 COMPARACIÓN: CÓDIGO vs SUPABASE REAL

### ❌ PROBLEMAS ENCONTRADOS

#### 1. **Query de Auditoría intenta unir con tablas relacionadas**

**Código actual (pure/main.js:937-941):**
```javascript
let query = supabaseManager.client
  .from('vouchers')
  .select('*, issued_by_user:users!vouchers_issued_by_user_id_fkey(username), issued_at_station:stations!vouchers_issued_at_station_id_fkey(name)',
    { count: 'exact' }
  );
```

**Problemas:**
1. ❌ `users.username` NO EXISTE → La columna se llama `full_name` o `email`
2. ❌ `stations.name` NO EXISTE → La columna se llama `station_name` (y está NULL)
3. ❌ Las foreign keys `vouchers_issued_by_user_id_fkey` y `vouchers_issued_at_station_id_fkey` pueden no existir

**Resultado:** El query FALLA y siempre hace fallback a SQLite

---

#### 2. **Mapeo de datos incorrecto**

**Código actual (pure/main.js:1083-1095):**
```javascript
function mapearVouchersSupabase(vouchers) {
  return vouchers.map(v => ({
    code: v.voucher_code,           // ✅ CORRECTO
    amount: v.amount,               // ✅ CORRECTO
    currency: v.currency,           // ✅ CORRECTO
    estado: v.status === 'active' ? 'emitido' :
            v.status === 'redeemed' ? 'canjeado' :
            v.status === 'cancelled' ? 'cancelado' : v.status,  // ✅ CORRECTO
    created_at: v.issued_at,        // ✅ CORRECTO
    used_at: v.redeemed_at,         // ✅ CORRECTO
    mesa: v.issued_at_station?.name || 'N/A',      // ❌ FALLA: .name no existe
    operador: v.issued_by_user?.username || 'N/A'  // ❌ FALLA: .username no existe
  }));
}
```

**Problemas:**
- `v.issued_at_station?.name` → Debería ser `v.issued_at_station?.station_name` (pero es NULL)
- `v.issued_by_user?.username` → Debería ser `v.issued_by_user?.full_name` o `.email`

---

#### 3. **Foreign Keys posiblemente no definidas**

El query intenta usar foreign keys:
- `vouchers_issued_by_user_id_fkey`
- `vouchers_issued_at_station_id_fkey`

**Pero no sabemos si existen en Supabase.**

Para verificar, necesitaríamos ejecutar:
```sql
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
WHERE constraint_type = 'FOREIGN KEY'
  AND tc.table_name='vouchers';
```

---

## ✅ SOLUCIÓN RECOMENDADA

### Opción 1: Query SIN joins (más simple y confiable)

```javascript
// En handler get-audit-tickets
let query = supabaseManager.client
  .from('vouchers')
  .select('*', { count: 'exact' });  // Solo los campos de vouchers

// Aplicar filtros
if (fechaDesde) {
  query = query.gte('issued_at', new Date(fechaDesde).toISOString());
}
if (fechaHasta) {
  query = query.lte('issued_at', new Date(fechaHasta + 'T23:59:59').toISOString());
}
if (estado) {
  query = query.eq('status', estado);
}
if (moneda) {
  query = query.eq('currency', moneda);
}

// Paginación
const offset = (page - 1) * limit;
query = query.order('issued_at', { ascending: false })
  .range(offset, offset + limit - 1);

const { data, error, count } = await query;
```

**Mapeo simplificado:**
```javascript
function mapearVouchersSupabase(vouchers) {
  return vouchers.map(v => ({
    code: v.voucher_code,
    amount: v.amount,
    currency: v.currency,
    estado: v.status === 'active' ? 'emitido' :
            v.status === 'redeemed' ? 'canjeado' :
            v.status === 'cancelled' ? 'cancelado' : v.status,
    created_at: v.issued_at,
    used_at: v.redeemed_at,
    mesa: v.issued_at_station_id ? `Mesa ${v.issued_at_station_id}` : 'N/A',
    operador: v.customer_name || v.issued_by_user_id || 'N/A'
  }));
}
```

---

### Opción 2: Query CON joins (requiere verificar foreign keys)

Si las foreign keys existen, corregir el query:

```javascript
let query = supabaseManager.client
  .from('vouchers')
  .select(`
    *,
    issued_by_user:users!issued_by_user_id(id, email, full_name),
    issued_at_station:stations!issued_at_station_id(id, station_name, station_number)
  `, { count: 'exact' });
```

**Mapeo corregido:**
```javascript
function mapearVouchersSupabase(vouchers) {
  return vouchers.map(v => ({
    code: v.voucher_code,
    amount: v.amount,
    currency: v.currency,
    estado: v.status === 'active' ? 'emitido' :
            v.status === 'redeemed' ? 'canjeado' :
            v.status === 'cancelled' ? 'cancelado' : v.status,
    created_at: v.issued_at,
    used_at: v.redeemed_at,
    mesa: v.issued_at_station?.station_name ||
          (v.issued_at_station_id ? `Mesa ${v.issued_at_station_id}` : 'N/A'),
    operador: v.issued_by_user?.full_name ||
              v.issued_by_user?.email ||
              v.customer_name ||
              'N/A'
  }));
}
```

---

## 🎯 ESTADÍSTICAS ACTUALES DE SUPABASE

```
Total vouchers: 3
  - Active: 3
  - Redeemed: 0
  - Cancelled: 0

Últimos vouchers:
  - TEST-1761751842844 - DOP 100 - active - 29/10/2025, 11:30:42
  - TEST-1761751121712 - DOP 100 - active - 29/10/2025, 11:18:41
  - TKT-TEST-00001 - USD 100 - active - 27/10/2025, 8:49:22
```

---

## 📋 TABLA DE MAPEO COMPLETA

| Campo Frontend | Supabase `vouchers` | SQLite `tickets` | Notas |
|----------------|---------------------|------------------|-------|
| `code` | `voucher_code` | `code` | ✅ OK |
| `amount` | `amount` | `amount` | ✅ OK |
| `currency` | `currency` | `currency` | ✅ OK |
| `estado` | `status` (active/redeemed/cancelled) | `estado` (emitido/usado/cancelado) | ⚠️ Requiere mapeo |
| `created_at` | `issued_at` | `fecha_emision` | ✅ OK con mapeo |
| `used_at` | `redeemed_at` | `fecha_cobro` | ✅ OK con mapeo |
| `mesa` | `issued_at_station_id` → `stations.station_name` | `mesa` | ⚠️ Requiere join o formateo |
| `operador` | `issued_by_user_id` → `users.full_name` | `notas` | ⚠️ Requiere join o usar customer_name |

---

## 🔧 ACCIONES RECOMENDADAS

### 1. **INMEDIATO:** Arreglar query de Supabase para evitar joins fallidos

```javascript
// Usar query simple sin joins
.select('*', { count: 'exact' })
```

### 2. **CORTO PLAZO:** Actualizar mapeo para usar columnas correctas

```javascript
mesa: v.issued_at_station_id ? `Mesa ${v.issued_at_station_id}` : 'N/A',
operador: v.customer_name || v.issued_by_user_id || 'N/A'
```

### 3. **MEDIANO PLAZO:** Verificar y crear foreign keys en Supabase

Si quieres usar joins, necesitas:
1. Verificar que existan las foreign keys
2. Actualizar `stations` para tener valores en `station_name`
3. Usar las columnas correctas (`full_name` en vez de `username`)

### 4. **LARGO PLAZO:** Poblar datos de stations

Actualizar registros de stations para que tengan nombres:
```sql
UPDATE stations SET station_name = 'Mesa Principal 1' WHERE id = 1;
UPDATE stations SET station_name = 'Mesa Principal 2' WHERE id = 2;
-- etc...
```

---

## ✅ CONCLUSIÓN

**El módulo Auditor actualmente:**
- ❌ NO puede leer de Supabase (query con joins falla)
- ✅ Funciona correctamente con SQLite local
- ⚠️ Necesita arreglos para usar Supabase

**Prioridad de arreglo:**
1. 🔴 **CRÍTICO:** Arreglar query de Supabase (sin joins)
2. 🟡 **MEDIO:** Actualizar mapeo de campos
3. 🟢 **BAJO:** Crear foreign keys y poblar stations

---

**Archivos que necesitan modificación:**
- `pure/main.js` (líneas 937-941, 1083-1095)

**Scripts de verificación creados:**
- `scripts/inspect-supabase.js` ✅
- `scripts/inspect-supabase-users.js` ✅
