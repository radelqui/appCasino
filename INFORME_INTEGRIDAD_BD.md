# 🔍 INFORME DE INTEGRIDAD DE BASES DE DATOS

**Fecha**: 31/10/2025, 7:28:22 p. m.

---

## 📋 1. ESTRUCTURA DE TABLAS

### Tabla VOUCHERS

**Estado**: ✅ COMPLETO

**Campos presentes** (20):
- id
- voucher_code
- qr_data
- qr_hash
- amount
- currency
- status
- issued_by_user_id
- issued_at_station_id
- issued_at
- redeemed_by_user_id
- redeemed_at_station_id
- redeemed_at
- expires_at
- customer_name
- customer_notes
- created_at
- updated_at
- mesa_nombre
- operador_nombre

### Otras Tablas

| Tabla | Estado | Registros | Columnas |
|-------|--------|-----------|----------|
| users | ✅ EXISTE | 9 | 9 |
| operadores | ✅ EXISTE | 3 | 9 |
| stations | ✅ EXISTE | 5 | 7 |

## ⚡ 2. TRIGGERS

### updated_at Trigger

**Estado**: No verificado

## 🔍 3. ÍNDICES

### Índices Recomendados

**vouchers**:
- `voucher_code`
- `status`
- `issued_at`
- `created_at`

**users**:
- `email`
- `role`

**operadores**:
- `codigo`
- `activo`

**stations**:
- `station_number`
- `is_active`

## 🔒 4. ROW LEVEL SECURITY (RLS)

**Vouchers**: ⚠️ PERMITIDO (revisar)

Error de acceso anónimo: `Sin error`

## ⚡ 5. PERFORMANCE

| Query | Tiempo | Estado |
|-------|--------|--------|
| Buscar por código | 97ms | ✅ RÁPIDO |
| Listar activos | 92ms | ✅ RÁPIDO |
| Count activos | 133ms | ✅ RÁPIDO |

## 📊 6. ESTADÍSTICAS

- **Total vouchers**: 39
- **Vouchers activos**: 19
- **Vouchers cobrados**: 20
- **Tasa de cobro**: 51.28%

## 💡 7. RECOMENDACIONES

1. Revisar políticas RLS en tabla vouchers

---

**FIN DEL INFORME**
