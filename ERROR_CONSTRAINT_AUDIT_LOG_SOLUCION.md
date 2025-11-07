# ❌ ERROR: Constraint audit_log_action_check Violado

**Fecha**: 7 de noviembre de 2025
**Error recibido**:
```
ERROR: 23514: check constraint "audit_log_action_check" of relation "audit_log" is violated by some row
```

---

## 🎯 QUÉ SIGNIFICA ESTE ERROR

El error significa que **existen registros en la tabla `audit_log` con valores de `action` que NO están permitidos en el nuevo constraint**.

### Analogía simple:
- El constraint es como un "filtro de entrada" que dice: "Solo permito estas 12 palabras"
- Pero la tabla YA TIENE registros con otras palabras
- Postgres dice: "No puedo crear ese filtro porque hay datos que lo violan"

---

## 🔍 CAUSA RAÍZ

El script `fix-audit-log-constraint-OPTIMIZADO.sql` intentó:

1. Eliminar el constraint viejo (3 actions: user_login, voucher_created, voucher_redeemed)
2. Crear constraint nuevo (12 actions: voucher_issued, user_created, etc.)

**PROBLEMA**: El nuevo constraint NO incluye `voucher_created`, pero hay registros con esa action en la tabla.

**Por qué no incluimos `voucher_created`**:
- El código actual usa `voucher_issued` (línea 1315 de main.js)
- `voucher_created` es legacy (viejo)
- Queremos el constraint refleje el código actual

---

## 📊 POSIBLES ESCENARIOS

### Escenario 1: Hay registros con `voucher_created`
```sql
-- En la tabla audit_log:
| action           | cantidad |
|------------------|----------|
| user_login       | 150      |
| voucher_created  | 1200     | ← PROBLEMA
| voucher_redeemed | 800      |
```

**Solución**: Migrar `voucher_created` → `voucher_issued`

### Escenario 2: Hay registros con actions completamente desconocidas
```sql
| action           | cantidad |
|------------------|----------|
| user_login       | 150      |
| voucher_xyz      | 50       | ← PROBLEMA
| test_action      | 10       | ← PROBLEMA
```

**Solución**: Decidir qué hacer con esos registros (migrar, eliminar o preservar)

### Escenario 3: Constraint actual es más restrictivo
```sql
-- Constraint actual solo permite: user_login, voucher_created, voucher_redeemed
-- Pero tabla tiene:
| action           | cantidad |
|------------------|----------|
| user_login       | 150      |
| voucher_created  | 1200     |
| user_created     | 30       | ← NO permitido por constraint actual
```

**Solución**: Esto es raro, Postgres debería haber evitado el INSERT

---

## 🚀 PLAN DE ACCIÓN (3 PASOS)

### **PASO 1: DIAGNÓSTICO** (5 minutos)

Ejecuta este script en Supabase SQL Editor:

```
c:\appCasino\SqulInstrucciones\DIAGNOSTICO-audit-log-ANTES-DE-FIX.sql
```

**Qué hace**:
- Muestra TODAS las actions que existen en los datos
- Identifica cuáles violan el nuevo constraint
- Sugiere qué script ejecutar a continuación

**Resultado esperado**:
```
📋 REGISTROS PROBLEMÁTICOS
action           | cantidad | primera_vez         | ultima_vez
-----------------|----------|---------------------|-------------------
voucher_created  | 1200     | 2025-10-01 10:00:00 | 2025-11-06 18:30:00
```

### **PASO 2: MIGRACIÓN** (2 minutos)

Según el diagnóstico, ejecuta UNO de estos scripts:

#### Opción A: Si hay registros problemáticos (más probable)

```
c:\appCasino\SqulInstrucciones\fix-audit-log-constraint-CON-MIGRACION.sql
```

**Qué hace**:
1. Diagnostica registros problemáticos
2. Migra `voucher_created` → `voucher_issued`
3. Verifica que no queden registros inválidos
4. Aplica nuevo constraint con 12 actions

**Usa transacción**: Si algo falla, hace ROLLBACK automático

#### Opción B: Si NO hay registros problemáticos (menos probable)

```
c:\appCasino\SqulInstrucciones\fix-audit-log-constraint-OPTIMIZADO.sql
```

**Qué hace**:
- Aplica constraint directamente sin migración
- Falla si hay datos inválidos (como ya vimos)

### **PASO 3: VERIFICACIÓN** (1 minuto)

Ejecuta estas queries para confirmar éxito:

```sql
-- 1. Ver constraint actualizado
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'audit_log'::regclass
  AND conname = 'audit_log_action_check';

-- 2. Ver actions usadas ahora
SELECT action, COUNT(*)
FROM audit_log
GROUP BY action
ORDER BY COUNT(*) DESC;

-- 3. Verificar que NO hay registros inválidos
SELECT action, COUNT(*)
FROM audit_log
WHERE action NOT IN (
  'voucher_issued', 'voucher_redeemed', 'voucher_cancelled', 'voucher_expired',
  'user_login', 'user_logout', 'user_created', 'user_updated',
  'operator_created', 'operator_updated',
  'session_closed',
  'config_changed'
)
GROUP BY action;
-- Debe retornar 0 filas
```

---

## 🛡️ SEGURIDAD Y ROLLBACK

### Backup ANTES de ejecutar:

```sql
-- Exportar estructura
pg_dump -h supabase-host -U postgres -t audit_log --schema-only > audit_log_schema_backup.sql

-- Exportar datos
pg_dump -h supabase-host -U postgres -t audit_log --data-only > audit_log_data_backup.sql
```

### Si algo sale mal:

El script con migración usa transacción:
- Si hay error → ROLLBACK automático
- Nada se modifica en la tabla

Si necesitas revertir DESPUÉS del COMMIT:
```sql
-- Ver script: fix-audit-log-constraint-CON-MIGRACION.sql
-- Sección: ROLLBACK (al final del archivo)
```

---

## 📋 OPCIONES DE MIGRACIÓN

El script `fix-audit-log-constraint-CON-MIGRACION.sql` tiene 4 opciones:

### **Opción A: Migrar voucher_created → voucher_issued** (RECOMENDADA)

```sql
UPDATE audit_log
SET action = 'voucher_issued'
WHERE action = 'voucher_created';
```

**Pros**:
- ✅ Preserva datos históricos
- ✅ Alinea con código actual
- ✅ Auditoría completa

**Contras**:
- ⚠️ Cambia datos históricos (pero sin pérdida)

### **Opción B: Agregar columna action_original**

```sql
ALTER TABLE audit_log ADD COLUMN action_original TEXT;
UPDATE audit_log SET action_original = action;
-- Luego migrar action
```

**Pros**:
- ✅ Preserva valor original
- ✅ Auditoría perfecta

**Contras**:
- ⚠️ Columna adicional (más espacio)

### **Opción C: Eliminar registros inválidos** (DESTRUCTIVO)

```sql
DELETE FROM audit_log
WHERE action NOT IN (...);
```

**Pros**:
- ✅ Limpia datos

**Contras**:
- ❌ Pierde datos históricos
- ❌ Auditoría incompleta
- ❌ NO RECOMENDADO

### **Opción D: Renombrar a 'unknown_action'**

```sql
UPDATE audit_log
SET action = 'unknown_action'
WHERE action NOT IN (...);

-- Agregar al constraint:
-- 'unknown_action'
```

**Pros**:
- ✅ Preserva registros
- ✅ Marca como desconocidos

**Contras**:
- ⚠️ Pierde información del tipo original

---

## 🎯 RECOMENDACIÓN FINAL

### 1. Ejecuta PRIMERO:
```
DIAGNOSTICO-audit-log-ANTES-DE-FIX.sql
```

### 2. Lee la sección "REGISTROS PROBLEMÁTICOS"
- Si hay resultados → Usa script CON-MIGRACION
- Si NO hay resultados → Usa script OPTIMIZADO (pero ya falló, así que hay)

### 3. Ejecuta:
```
fix-audit-log-constraint-CON-MIGRACION.sql
```

### 4. Verifica éxito con queries de verificación

### 5. Documenta en logs del proyecto

---

## 📁 ARCHIVOS DISPONIBLES

| Archivo | Propósito | Cuándo usar |
|---------|-----------|-------------|
| `DIAGNOSTICO-audit-log-ANTES-DE-FIX.sql` | Ver qué hay en la tabla | SIEMPRE PRIMERO |
| `fix-audit-log-constraint-CON-MIGRACION.sql` | Fix + migración de datos | Si hay registros problemáticos |
| `fix-audit-log-constraint-OPTIMIZADO.sql` | Fix sin migración | Si NO hay registros problemáticos |
| `ERROR_CONSTRAINT_AUDIT_LOG_SOLUCION.md` | Este documento | Para entender el problema |

---

## ❓ PREGUNTAS FRECUENTES

**Q: ¿Por qué falló el script optimizado?**
A: Porque hay registros con actions que NO están en la nueva lista. Necesitas migrar esos datos primero.

**Q: ¿Puedo simplemente eliminar esos registros?**
A: Técnicamente sí, pero pierdes auditoría. NO RECOMENDADO. Mejor migrar.

**Q: ¿Cuánto tiempo toma la migración?**
A: ~2 minutos para miles de registros. El UPDATE es rápido.

**Q: ¿Afecta a usuarios activos?**
A: Mínimamente. Lock de tabla ~50-200ms durante UPDATE.

**Q: ¿Puedo hacer rollback?**
A: SÍ. El script usa transacción. Si falla, hace ROLLBACK automático.

**Q: ¿Qué pasa si hay actions que no conozco?**
A: El diagnóstico te las mostrará. Decide si migrar, eliminar o preservar como 'unknown_action'.

**Q: ¿Por qué no incluir 'voucher_created' en el constraint nuevo?**
A: Porque el código actual NO lo usa. Usa 'voucher_issued'. Queremos que el constraint refleje el código.

---

## 🔗 DOCUMENTACIÓN RELACIONADA

- [ANALISIS_VIABILIDAD_FIX_AUDIT_LOG_CONSTRAINT.md](ANALISIS_VIABILIDAD_FIX_AUDIT_LOG_CONSTRAINT.md) - Análisis completo de 1200+ líneas
- [RESUMEN_AUDIT_LOG_CONSTRAINT.md](RESUMEN_AUDIT_LOG_CONSTRAINT.md) - Resumen ejecutivo

---

**Última actualización**: 7 de noviembre de 2025
**Estado**: ⚠️ REQUIERE ACCIÓN - Ejecutar diagnóstico y migración
