# DIAGNÓSTICO ERROR 2: VOUCHERS NO SE GUARDAN EN SQLite

**Fecha:** 2025-11-06
**Estado:** ERROR CONFIRMADO
**Base de datos:** `c:\appCasino\Caja\data\casino.db`

---

## RESUMEN EJECUTIVO

El diagnóstico confirma que **NO HAY TICKETS PREV- EN SQLite**, lo que confirma el ERROR 2.

### HALLAZGOS CLAVE

1. ✅ Campo `hash_seguridad` **EXISTE** en la tabla
2. ❌ **CERO tickets PREV-** en SQLite (error confirmado)
3. ❌ **CERO tickets de hoy** en SQLite
4. ✅ No hay códigos duplicados
5. ✅ Índices correctos (incluyendo `idx_ticket_code`)
6. ✅ Todos los tickets existentes tienen `hash_seguridad`

---

## ANÁLISIS DETALLADO

### 1. Campo hash_seguridad

```
status: ✅ EXISTE
```

**Conclusión:** El campo existe, por lo tanto NO es la causa del error.

### 2. Tickets PREV-

```
total_prev_tickets: 0
status: ❌ NO HAY TICKETS PREV- (ERROR CONFIRMADO)
```

**Conclusión:** Los vouchers con formato PREV-XXXXXXX NO se están guardando en SQLite.

### 3. Tickets de hoy

```
total_hoy: 0
emitidos: 0
usados: 0
sincronizados: 0
```

**Conclusión:** No hay tickets creados hoy. Esto puede significar:
- La app no se ha usado hoy para crear tickets
- Los tickets se están creando pero no se guardan en SQLite

### 4. Últimos 5 tickets creados

```
(Sin resultados)
```

**Conclusión:** La tabla `tickets` está **VACÍA** o no tiene datos recientes.

### 5. Tickets sin hash_seguridad

```
total_sin_hash: 0
status: ✅ TODOS LOS TICKETS TIENEN HASH
```

**Conclusión:** No hay tickets antiguos sin hash. Esto es consistente con una tabla vacía.

### 6. Índices

```
- sqlite_autoindex_tickets_1
- idx_ticket_code (✅ RECOMENDADO)
- idx_ticket_estado
- idx_ticket_fecha
```

**Conclusión:** Los índices están correctos. La búsqueda por `code` está optimizada.

### 7. Códigos duplicados

```
(Sin duplicados)
```

**Conclusión:** No hay violación de constraint UNIQUE.

---

## CAUSA RAÍZ PROBABLE

Basado en el diagnóstico, las posibles causas son:

### HIPÓTESIS 1: INSERT está fallando silenciosamente (MÁS PROBABLE)

**Evidencia:**
- Campo `hash_seguridad` existe
- No hay constraints violados
- Tabla está vacía
- Error capturado por try-catch

**Posibles razones:**
1. **Error de sintaxis SQL** que el catch captura pero no se ve en logs antiguos
2. **Parámetros incorrectos** (tipos de datos no coinciden)
3. **Transacción no se confirma** (falta commit)
4. **Base de datos bloqueada** por otro proceso

**Verificación:**
El nuevo logging detallado (líneas 1498-1520) ahora capturará:
- `sqlError.code`
- `sqlError.stack`
- Todos los parámetros del INSERT

### HIPÓTESIS 2: Condición `if (!db)` evita el INSERT

**Evidencia:**
- Log muestra "SQLite no disponible" en algunos casos

**Verificación:**
Revisar logs para ver si aparece:
```
⚠️  SQLite no disponible, pero ticket guardado en Supabase
```

### HIPÓTESIS 3: Código generado es NULL o inválido

**Evidencia:**
- No se encontraron tickets con ningún código

**Verificación:**
Revisar log para ver si `db.generateTicketCode()` retorna valor válido:
```javascript
console.log('🎫 Código generado desde DB:', ticketCode);
```

---

## ESTRUCTURA DE LA TABLA tickets

Para referencia, la estructura completa:

```sql
PRAGMA table_info(tickets);
```

**Campos confirmados:**
- `id` (PRIMARY KEY)
- `code` (UNIQUE, indexed)
- `amount`
- `currency`
- `mesa`
- `estado` (indexed)
- `sincronizado`
- `mesa_id`
- `created_by_user_id`
- `mesa_nombre`
- `hash_seguridad` ✅
- `fecha_emision` (indexed)

---

## QUERY SQL QUE ESTÁ FALLANDO

**Ubicación:** `c:\appCasino\pure\main.js` líneas 1481-1495

```javascript
db.db.prepare(`
  INSERT INTO tickets (
    code,
    amount,
    currency,
    mesa,
    estado,
    sincronizado,
    mesa_id,
    created_by_user_id,
    created_by_username,
    mesa_nombre,
    hash_seguridad
  )
  VALUES (?, ?, ?, ?, 'emitido', ?, ?, ?, ?, ?, ?)
`).run(
  ticketCode,           // 1. code
  amount,               // 2. amount
  currency,             // 3. currency
  mesa,                 // 4. mesa
  savedInSupabase ? 1 : 0,  // 5. sincronizado
  stationId,            // 6. mesa_id
  userId,               // 7. created_by_user_id
  userName,             // 8. created_by_username
  ticketData.mesa_nombre || null,  // 9. mesa_nombre
  hashSeguridad         // 10. hash_seguridad
);
```

**Verificar:**
1. Todos los parámetros tienen valores válidos
2. El campo `created_by_username` existe en la tabla
3. Los tipos de datos coinciden

---

## VERIFICACIÓN PENDIENTE: Campo created_by_username

**IMPORTANTE:** El script SQL falló en la línea:

```sql
created_by_username as usuario
```

**Error:** `no such column: created_by_username`

**Implicación:** El campo `created_by_username` **NO EXISTE** en la tabla tickets.

**CAUSA RAÍZ IDENTIFICADA:**

El INSERT intenta guardar en `created_by_username` pero **este campo no existe en la tabla**.

```sql
-- La tabla NO tiene este campo:
created_by_username
```

Pero el código intenta insertarlo:

```javascript
db.db.prepare(`
  INSERT INTO tickets (..., created_by_username, ...)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)  -- Parámetro 8
`).run(
  ...,
  userName,  // Error: campo no existe
  ...
);
```

---

## SOLUCIÓN INMEDIATA

### Opción 1: Agregar campo a la tabla (RECOMENDADO)

```sql
ALTER TABLE tickets ADD COLUMN created_by_username TEXT;
```

### Opción 2: Remover campo del INSERT (TEMPORAL)

Modificar `c:\appCasino\pure\main.js` líneas 1481-1495:

**Antes:**
```javascript
db.db.prepare(`
  INSERT INTO tickets (code, amount, currency, mesa, estado, sincronizado, mesa_id, created_by_user_id, created_by_username, mesa_nombre, hash_seguridad)
  VALUES (?, ?, ?, ?, 'emitido', ?, ?, ?, ?, ?, ?)
`).run(
  ticketCode,
  amount,
  currency,
  mesa,
  savedInSupabase ? 1 : 0,
  stationId,
  userId,
  userName,  // Error: campo no existe
  ticketData.mesa_nombre || null,
  hashSeguridad
);
```

**Después:**
```javascript
db.db.prepare(`
  INSERT INTO tickets (code, amount, currency, mesa, estado, sincronizado, mesa_id, created_by_user_id, mesa_nombre, hash_seguridad)
  VALUES (?, ?, ?, ?, 'emitido', ?, ?, ?, ?, ?)
`).run(
  ticketCode,
  amount,
  currency,
  mesa,
  savedInSupabase ? 1 : 0,
  stationId,
  userId,
  // userName removido
  ticketData.mesa_nombre || null,
  hashSeguridad
);
```

---

## COMANDO PARA VERIFICAR ESTRUCTURA REAL

```bash
cd /c/appCasino
sqlite3 Caja/data/casino.db "PRAGMA table_info(tickets)"
```

**Buscar específicamente:**
```bash
sqlite3 Caja/data/casino.db "PRAGMA table_info(tickets)" | grep username
```

Si no retorna nada, el campo NO existe.

---

## PRÓXIMOS PASOS

### 1. URGENTE: Verificar existencia del campo

```bash
cd /c/appCasino
sqlite3 Caja/data/casino.db "PRAGMA table_info(tickets)" > tabla_tickets_estructura.txt
cat tabla_tickets_estructura.txt
```

### 2. Si el campo NO existe: Agregar campo

```bash
sqlite3 Caja/data/casino.db "ALTER TABLE tickets ADD COLUMN created_by_username TEXT"
```

### 3. Si el campo existe: Revisar otro error

El nuevo logging detallado mostrará el error específico:

```javascript
console.error('❌ Error guardando en SQLite:', sqlError.message);
console.error('   Código error:', sqlError.code);
console.error('   Stack:', sqlError.stack);
```

### 4. Reproducir el error

1. Iniciar app con `npm start`
2. Crear un voucher desde Panel
3. Revisar logs de Electron para ver error detallado
4. Verificar si aparece en SQLite:

```bash
sqlite3 Caja/data/casino.db "SELECT * FROM tickets WHERE code LIKE 'PREV-%' ORDER BY id DESC LIMIT 1"
```

---

## RESUMEN

### CAUSA RAÍZ IDENTIFICADA

**El campo `created_by_username` NO EXISTE en la tabla tickets**, pero el código intenta insertarlo.

### SOLUCIÓN

**Opción A (RECOMENDADA):** Agregar campo a la tabla
```sql
ALTER TABLE tickets ADD COLUMN created_by_username TEXT;
```

**Opción B (TEMPORAL):** Remover campo del INSERT en `main.js`

### IMPACTO

- Una vez corregido, los vouchers se guardarán correctamente en SQLite
- Los vouchers existentes en Supabase seguirán funcionando
- No hay pérdida de datos (Supabase tiene los registros)

---

**Estado:** CAUSA RAÍZ IDENTIFICADA - REQUIERE CORRECCIÓN INMEDIATA
**Prioridad:** CRÍTICA
**Próximo paso:** Agregar campo `created_by_username` a tabla `tickets`
