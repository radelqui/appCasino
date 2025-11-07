# 🔍 ANÁLISIS: Error "no such column: created_at"

**Fecha**: 3 de noviembre de 2025
**Error**: `❌ [Sync Worker] Error crítico: no such column: created_at`

---

## ❌ PROBLEMA IDENTIFICADO

### **Worker de Sincronización Falla Cada 2 Minutos**

**Ubicación**: [main.js:4418](pure/main.js#L4418)

```javascript
const pendingTickets = db.db.prepare(
  'SELECT * FROM tickets WHERE sincronizado = 0 ORDER BY created_at ASC LIMIT ?'
).all(BATCH_SIZE);
```

**Error**: La columna `created_at` **NO EXISTE** en la tabla `tickets` de SQLite.

---

## 📊 COMPARACIÓN DE ESQUEMAS

### SQLite - Columnas REALES de `tickets`:
```
✅ id
✅ code
✅ amount
✅ currency
✅ mesa
✅ estado
✅ fecha_emision       ← ESTA es la columna de fecha de creación
✅ fecha_cobro
✅ cajero_id
✅ hash_seguridad
✅ qr_data
✅ sincronizado
✅ notas
❌ created_at         ← NO EXISTE
```

### Supabase - Columnas esperadas:
```
✅ voucher_code
✅ amount
✅ currency
✅ status
✅ created_at         ← EXISTE en Supabase
✅ issued_at
✅ redeemed_at
```

---

## 🔍 LUGARES DONDE SE USA `created_at` INCORRECTAMENTE

### 1. **Worker de Sincronización** (CRÍTICO - Línea 4418)
```javascript
// ❌ FALLA: created_at no existe en SQLite
'SELECT * FROM tickets WHERE sincronizado = 0 ORDER BY created_at ASC LIMIT ?'

// ✅ DEBERÍA SER:
'SELECT * FROM tickets WHERE sincronizado = 0 ORDER BY fecha_emision ASC LIMIT ?'
```

### 2. **Handler sync-pending-vouchers** (Línea 3183)
```javascript
// ❌ FALLA
'SELECT * FROM tickets WHERE sincronizado = 0 ORDER BY created_at ASC'

// ✅ DEBERÍA SER:
'SELECT * FROM tickets WHERE sincronizado = 0 ORDER BY fecha_emision ASC'
```

### 3. **Subir ticket a Supabase** (Líneas 4442, 3211)
```javascript
// ❌ PROBLEMA: ticket.created_at es undefined en SQLite
created_at: ticket.created_at,

// ✅ DEBERÍA SER:
created_at: ticket.fecha_emision,
```

---

## 🎯 IMPACTO DEL ERROR

### Cada 2 minutos:
1. ✅ Worker de sincronización inicia
2. ❌ Intenta leer `created_at` de SQLite
3. ❌ **CRASH**: Error "no such column: created_at"
4. ❌ **NO sincroniza tickets** a Supabase
5. 🔄 Espera 2 minutos y repite

### Consecuencias:
- ❌ Tickets creados **nunca se sincronizan** a Supabase
- ❌ Los 3 tickets existentes tienen `sincronizado = 0` permanentemente
- ❌ Error se repite infinitamente cada 2 minutos
- ⚠️ **Esto NO congela la app**, pero llena logs de errores

---

## 📋 SOLUCIÓN PROPUESTA

### **Cambios necesarios en main.js:**

#### 1. Línea 4418 - Worker de sincronización
```javascript
// ANTES:
const pendingTickets = db.db.prepare(
  'SELECT * FROM tickets WHERE sincronizado = 0 ORDER BY created_at ASC LIMIT ?'
).all(BATCH_SIZE);

// DESPUÉS:
const pendingTickets = db.db.prepare(
  'SELECT * FROM tickets WHERE sincronizado = 0 ORDER BY fecha_emision ASC LIMIT ?'
).all(BATCH_SIZE);
```

#### 2. Línea 3183 - Handler sync-pending-vouchers
```javascript
// ANTES:
const pendingTickets = db.db.prepare(
  'SELECT * FROM tickets WHERE sincronizado = 0 ORDER BY created_at ASC'
).all();

// DESPUÉS:
const pendingTickets = db.db.prepare(
  'SELECT * FROM tickets WHERE sincronizado = 0 ORDER BY fecha_emision ASC'
).all();
```

#### 3. Línea 4442 - Mapeo al subir a Supabase
```javascript
// ANTES:
const result = await supabaseManager.createVoucher({
  voucher_code: ticket.code,
  amount: ticket.amount,
  currency: ticket.currency || 'USD',
  issued_by_user_id: userId,
  issued_at_station_id: ticket.mesa || ticket.mesa_nombre || 'unknown',
  status: ticket.estado === 'active' ? 'active' : 'redeemed',
  created_at: ticket.created_at,  // ❌ undefined
  redeemed_at: ticket.redeemed_at || null,
  redeemed_by_user_id: ticket.redeemed_by || null
});

// DESPUÉS:
const result = await supabaseManager.createVoucher({
  voucher_code: ticket.code,
  amount: ticket.amount,
  currency: ticket.currency || 'USD',
  issued_by_user_id: userId,
  issued_at_station_id: ticket.mesa || ticket.mesa_nombre || 'unknown',
  status: ticket.estado === 'active' ? 'active' : 'redeemed',
  created_at: ticket.fecha_emision,  // ✅ Correcto
  redeemed_at: ticket.fecha_cobro || null,  // ✅ También corregir esto
  redeemed_by_user_id: ticket.redeemed_by || null
});
```

#### 4. Línea 3211 - Mismo problema en otro handler
```javascript
// ANTES:
created_at: ticket.created_at,

// DESPUÉS:
created_at: ticket.fecha_emision,
```

---

## 🔍 OTROS USOS DE `created_at` (No problemáticos)

### Estos están bien porque usan tablas diferentes:

- **Líneas 1949-1950**: Query de Supabase `users` (✅ OK)
- **Líneas 2006-2012**: SQLite tabla `users` (✅ OK - tabla diferente)
- **Líneas 2523-2536**: Supabase `audit_log` (✅ OK)
- **Líneas 2840, 2999**: Alias `fecha_emision as created_at` (✅ OK - para compatibilidad)
- **Líneas 3893-3921**: Queries de Supabase `vouchers` (✅ OK)

---

## 🎯 VERIFICACIÓN

### Confirmar que los 3 tickets tienen sincronizado = 0:

```bash
npx electron -e "
  const Database = require('better-sqlite3');
  const db = new Database('Caja/casino.db');
  const tickets = db.prepare('SELECT id, code, sincronizado, fecha_emision FROM tickets').all();
  console.log('Tickets pendientes de sincronización:');
  tickets.forEach(t => console.log('  -', t.code, '| sincronizado:', t.sincronizado, '| fecha:', t.fecha_emision));
  db.close();
"
```

---

## 📊 RESUMEN

| Aspecto | Detalle |
|---------|---------|
| **Error** | `no such column: created_at` |
| **Causa** | SQLite usa `fecha_emision`, código usa `created_at` |
| **Frecuencia** | Cada 2 minutos (worker) |
| **Impacto** | Tickets NO se sincronizan a Supabase |
| **Congelamiento** | ❌ NO causa congelamiento |
| **Archivos afectados** | `pure/main.js` (4 lugares) |
| **Solución** | Reemplazar `created_at` por `fecha_emision` |

---

## ⚠️ IMPORTANTE

Este error **NO causa el congelamiento** que reportaste.

El congelamiento es un problema DIFERENTE. Este error solo impide la sincronización de tickets.

---

**¿Quieres que haga los cambios para arreglar este error?**
