# 🔍 AUDITORÍA COMPLETA: Sincronización SQLite ↔ Supabase

**Fecha**: 3 de noviembre de 2025
**Objetivo**: Sincronizar perfectamente SQLite con Supabase

---

## FASE 1: ESQUEMA REAL DE SQLite

### Tabla `tickets` en SQLite - 13 columnas:

| # | Columna | Tipo | NOT NULL | Default |
|---|---------|------|----------|---------|
| 0 | `id` | INTEGER | NO | (none) |
| 1 | `code` | TEXT | YES | (none) |
| 2 | `amount` | DECIMAL(10,2) | YES | (none) |
| 3 | `currency` | TEXT | YES | (none) |
| 4 | `mesa` | TEXT | YES | (none) |
| 5 | `estado` | TEXT | NO | 'activo' |
| 6 | ✅ `fecha_emision` | DATETIME | NO | CURRENT_TIMESTAMP |
| 7 | ✅ `fecha_cobro` | DATETIME | NO | (none) |
| 8 | ✅ `cajero_id` | TEXT | NO | (none) |
| 9 | `hash_seguridad` | TEXT | YES | (none) |
| 10 | `qr_data` | TEXT | YES | (none) |
| 11 | `sincronizado` | INTEGER | NO | 0 |
| 12 | `notas` | TEXT | NO | (none) |

---

## FASE 2: MAPEO COMPLETO SQLite ↔ Supabase

### 📋 MAPEO DE COLUMNAS:

| SQLite | Supabase (vouchers) | Notas |
|--------|---------------------|-------|
| `id` | `id` | ✅ Ambos son primary key (diferente tipo) |
| `code` | `voucher_code` | ✅ Texto único |
| `amount` | `amount` | ✅ Numérico |
| `currency` | `currency` | ✅ TEXT |
| `mesa` | `issued_at_station_id` | ⚠️ SQLite: TEXT, Supabase: INTEGER |
| `estado` | `status` | ✅ activo→active, usado→redeemed |
| ✅ `fecha_emision` | `created_at` / `issued_at` | ❌ INCONSISTENCIA |
| ✅ `fecha_cobro` | `redeemed_at` | ❌ INCONSISTENCIA |
| ✅ `cajero_id` | `redeemed_by_user_id` | ⚠️ Diferente propósito |
| `hash_seguridad` | -(no existe)- | Solo SQLite |
| `qr_data` | -(no existe)- | Solo SQLite |
| `sincronizado` | -(no existe)- | Solo SQLite (flag) |
| `notas` | `customer_name` | ⚠️ Uso similar pero diferente |

---

## FASE 3: INCONSISTENCIAS ENCONTRADAS

### ❌ PROBLEMA 1: Columnas con nombres diferentes

**En SQLite**:
- `fecha_emision` (fecha de creación del ticket)
- `fecha_cobro` (fecha de canje/redeem)

**En Supabase**:
- `created_at` / `issued_at` (fecha de creación)
- `redeemed_at` (fecha de canje)

**En el código**:
- A veces usa `created_at` ❌
- A veces usa `redeemed_at` ❌
- A veces usa `fecha_emision` ✅
- A veces usa `fecha_cobro` ✅

### ❌ PROBLEMA 2: Tipo de dato incompatible en `mesa`

**SQLite**: `mesa` es TEXT ("P03", "M01", etc.)
**Supabase**: `issued_at_station_id` es INTEGER (3, 1, etc.)

**Solución necesaria**: Extraer número de la cadena al sincronizar

```javascript
// INCORRECTO:
issued_at_station_id: ticket.mesa  // "P03" → Error tipo

// CORRECTO:
issued_at_station_id: parseInt(ticket.mesa.replace(/\D/g, '')) || null  // "P03" → 3
```

### ❌ PROBLEMA 3: Campo `cajero_id` mal mapeado

**SQLite**: `cajero_id` es TEXT (guarda ID del cajero que redimió)
**Supabase**: `redeemed_by_user_id` es UUID

**En el código**: Actualmente mapea `ticket.redeemed_by` que NO EXISTE ❌

### ❌ PROBLEMA 4: Workers usan columnas inexistentes

**Worker de sincronización (línea 4418)**:
```javascript
ORDER BY created_at ASC  // ❌ NO EXISTE en SQLite
```

**Debería ser**:
```javascript
ORDER BY fecha_emision ASC  // ✅ EXISTE
```

---

## FASE 4: LISTA COMPLETA DE CAMBIOS NECESARIOS

### A) Cambios en queries SELECT de SQLite:

| Línea | Cambio Necesario |
|-------|------------------|
| 4418 | `created_at` → `fecha_emision` ✅ YA CORREGIDO |
| 3183 | `created_at` → `fecha_emision` ✅ YA CORREGIDO |

### B) Cambios en mapeo al enviar a Supabase:

| Línea | Cambio Necesario | Estado |
|-------|------------------|--------|
| 931 | `ticket.redeemed_at` → `ticket.fecha_cobro` | ✅ YA CORREGIDO |
| 3212 | `ticket.created_at` → `ticket.fecha_emision` | ✅ YA CORREGIDO |
| 3212 | `ticket.redeemed_at` → `ticket.fecha_cobro` | ✅ YA CORREGIDO |
| 3213 | `ticket.redeemed_by` → `ticket.cajero_id` | ✅ YA CORREGIDO |
| 4442 | `ticket.created_at` → `ticket.fecha_emision` | ✅ YA CORREGIDO |
| 4443 | `ticket.redeemed_at` → `ticket.fecha_cobro` | ✅ YA CORREGIDO |
| 4444 | `ticket.redeemed_by` → `ticket.cajero_id` | ✅ YA CORREGIDO |

### C) Cambios en UPDATE de SQLite:

| Línea | Cambio Necesario | Estado |
|-------|------------------|--------|
| 1535 | Eliminar `redeemed_at = ?` (columna no existe) | ✅ YA CORREGIDO |
| 1536 | Eliminar `redeemed_by_user_id = ?` (columna no existe) | ✅ YA CORREGIDO |

### D) Cambios pendientes - Conversión de `mesa`:

| Línea | Campo | Cambio Necesario | Estado |
|-------|-------|------------------|--------|
| ??? | `issued_at_station_id: ticket.mesa` | Extraer número de string | ⚠️ PENDIENTE |

---

## FASE 5: CAMBIOS PENDIENTES

### 🔍 Buscar TODOS los lugares donde se envía `issued_at_station_id`:

```bash
grep -n "issued_at_station_id" pure/main.js
```

**Resultado esperado**: Varios lugares donde se hace:
```javascript
issued_at_station_id: ticket.mesa || ticket.mesa_nombre || 'unknown'
```

**Debe cambiarse a**:
```javascript
issued_at_station_id: (() => {
  const mesa = ticket.mesa || ticket.mesa_nombre;
  if (!mesa) return null;
  const num = parseInt(String(mesa).replace(/\D/g, ''));
  return num || null;
})()
```

O más simple:
```javascript
issued_at_station_id: parseInt((ticket.mesa || '').replace(/\D/g, '')) || null
```

---

## 📊 RESUMEN DE ESTADO

| Tipo de Inconsistencia | Total | Corregidos | Pendientes |
|------------------------|-------|------------|------------|
| Queries SELECT con `created_at` | 2 | ✅ 2 | 0 |
| Mapeos con `redeemed_at` | 4 | ✅ 4 | 0 |
| Mapeos con `created_at` | 2 | ✅ 2 | 0 |
| Mapeos con `redeemed_by` | 2 | ✅ 2 | 0 |
| UPDATE con columnas inexistentes | 2 | ✅ 2 | 0 |
| Conversión de `mesa` TEXT→INT | ? | 0 | ⚠️ PENDIENTE |
| Fallbacks en exportación | 1 | ✅ 1 | 0 |

---

## 🎯 PRÓXIMO PASO

1. ✅ Buscar TODOS los usos de `issued_at_station_id`
2. ⚠️ Corregir conversión de `mesa` de TEXT a INTEGER
3. ✅ Verificar que no queden más inconsistencias

---

**Generado**: 3 de noviembre de 2025
**Herramienta**: audit-schema.js
