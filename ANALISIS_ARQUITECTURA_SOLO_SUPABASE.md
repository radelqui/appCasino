# ANÁLISIS ARQUITECTÓNICO: Viabilidad de Eliminar SQLite y Usar Solo Supabase

**Fecha:** 2025-11-06
**Proyecto:** Sistema TITO Casino
**Analista:** Claude Code (SQL Expert)
**Versión:** 1.0

---

## RESUMEN EJECUTIVO

### Viabilidad: **CONDICIONAL** ⚠️

**Tiempo estimado de migración:** 40-60 horas (1-1.5 semanas)
**Riesgo global:** **ALTO** 🔴

### Conclusión Principal

La migración a arquitectura "Solo Supabase" es **técnicamente viable** pero presenta **riesgos significativos** que deben ser mitigados cuidadosamente. El sistema actual tiene una **dependencia crítica en modo offline** que se perdería completamente.

**Recomendación:** Implementar **Opción C (Supabase + Caché en Memoria)** en lugar de eliminar SQLite completamente, o mantener SQLite como caché de solo lectura.

---

## 1. INVENTARIO COMPLETO DE USO DE SQLite

### 1.1 Archivos Principales Afectados

| Archivo | Líneas con SQLite | Operaciones | Criticidad |
|---------|------------------|-------------|------------|
| `Caja/database.js` | 50 queries directas | CREATE, INSERT, SELECT, UPDATE | **CRÍTICA** |
| `pure/main.js` | 57 queries directas | SELECT, INSERT, UPDATE | **CRÍTICA** |
| `Caja/cajaHandlers.js` | 3 queries directas | SELECT | **MEDIA** |

**Total líneas afectadas:** ~110 queries directas + lógica de control

### 1.2 Archivos Secundarios (Scripts y Utilidades)

**Scripts de sincronización (11 archivos):**
- `scripts/check-sqlite-sync.js`
- `scripts/check-sync-status.js`
- `scripts/sync-all-pending.js`
- `scripts/sync-all-tickets.js`
- `scripts/sync-users-supabase-to-sqlite.js`
- Y 6 archivos más de diagnóstico

**Scripts de testing/debug (19 archivos):**
- `check-bd-structure.js`
- `debug-stats.js`
- `test-ticket-creation.js`
- Y 16 archivos más

**Total archivos afectados:** 33 archivos

---

## 2. ANÁLISIS DETALLADO POR COMPONENTE

### 2.1 Base de Datos (`Caja/database.js`)

**Clase:** `CasinoDatabase`

#### Tablas SQLite Utilizadas:

1. **tickets** (principal)
   - Campos: id, code, amount, currency, mesa, estado, fecha_emision, fecha_cobro, cajero_id, hash_seguridad, qr_data, sincronizado, notas
   - **30+ operaciones directas**

2. **operadores**
   - Campos: id, codigo, nombre, pin, mesa_asignada, activo, fecha_registro
   - **8 operaciones**

3. **usuarios**
   - Campos: id, username, password_hash, password_salt, role, activo, creado, sincronizado, email
   - **12 operaciones**

4. **auditoria**
   - Campos: id, tipo_evento, ticket_code, usuario_id, descripcion, fecha, datos_adicionales, etc.
   - **10 operaciones**

5. **configuracion**
   - Campos: clave, valor, actualizado
   - **5 operaciones**

#### Métodos Críticos que Usan SQLite:

```javascript
// TICKETS
createTicketOriginal()      // INSERT INTO tickets
generateTicketCode()         // SELECT + UPDATE configuracion
getTicket(code)             // SELECT FROM tickets WHERE code
getTicketsToday()           // SELECT FROM tickets WHERE DATE(fecha_emision)
getStatsToday()             // SELECT con agregaciones (COUNT, SUM)
getStatsTodayByStation()    // SELECT GROUP BY mesa
validateTicket(code)        // SELECT + UPDATE
redeemTicket(code)          // UPDATE tickets SET estado
updateTicketStatus()        // UPDATE tickets

// VOUCHERS (mapeados sobre tickets)
createVoucher()             // Llama a createTicketOriginal()
getVoucherByCode()          // Llama a getTicket()

// USUARIOS/OPERADORES
authenticateOperator()      // SELECT FROM operadores WHERE codigo AND pin
createUser()                // INSERT INTO usuarios
getUserByUsername()         // SELECT FROM usuarios WHERE username
authenticateUserLocal()     // SELECT + password verification
listUsers()                 // SELECT FROM usuarios
setUserActive()             // UPDATE usuarios SET activo
setUserRole()               // UPDATE usuarios SET role

// AUDITORÍA
addAuditLog()               // INSERT INTO auditoria
getAuditLogs()              // SELECT FROM auditoria
getAuditStats()             // SELECT con agregaciones

// CONFIGURACIÓN
getConfig()                 // SELECT FROM configuracion
setConfig()                 // INSERT OR REPLACE INTO configuracion

// MANTENIMIENTO
cleanExpiredTickets()       // UPDATE tickets SET estado WHERE fecha < X
backup()                    // db.backup()
```

**Total métodos afectados:** 25+ métodos

---

### 2.2 Handlers IPC (`pure/main.js`)

#### Handlers que Leen de SQLite:

| Handler | Operación SQLite | Tiene Fallback Supabase? | Líneas |
|---------|-----------------|-------------------------|--------|
| `get-stats-today` | `db.getStatsToday()` | ✅ SÍ (consulta vouchers) | 1014-1134 |
| `get-stats-by-mesa` | Query agregado por mesa | ✅ SÍ (consulta vouchers) | 1139-1330 |
| `get-statistics` | Multiple queries | ⚠️ PARCIAL | 1921-2030 |
| `get-operadores-activos` | SELECT FROM operadores | ❌ NO | 2030-2059 |
| `get-all-operadores` | SELECT FROM operadores | ❌ NO | 2059-2093 |
| `get-all-users` | SELECT FROM usuarios | ❌ NO | 2250-2338 |
| `get-audit-logs` | SELECT FROM auditoria | ❌ NO | 2830-2888 |
| `get-audit-stats` | Agregaciones auditoria | ❌ NO | 2888-2999 |
| `get-audit-tickets` | JOIN tickets + auditoria | ❌ NO | 2999-3100 |
| `get-database-stats` | PRAGMA + COUNT(*) | ❌ NO | 3634-3686 |

#### Handlers que Escriben en SQLite:

| Handler | Operación SQLite | Tiene Sync Supabase? | Líneas |
|---------|-----------------|---------------------|--------|
| `generate-ticket` | INSERT INTO tickets | ✅ SÍ (INSERT vouchers) | 1333-1622 |
| `validate-voucher` | SELECT FROM tickets | ✅ SÍ (SELECT vouchers) | 1624-1750 |
| `redeem-voucher` | UPDATE tickets | ✅ SÍ (UPDATE vouchers) | 1750-1900 |
| `create-operador` | INSERT INTO operadores | ❌ NO | 2093-2147 |
| `update-operador` | UPDATE operadores | ❌ NO | 2147-2250 |
| `create-user` | INSERT INTO usuarios | ❌ NO | 2338-2448 |
| `update-user` | UPDATE usuarios | ❌ NO | 2448-2600 |
| `create-backup` | db.backup() | ❌ NO | 3686-3750 |

**Total handlers afectados:** 18 handlers críticos

---

### 2.3 Patrón Actual: Dual Database con Fallback

El código actual implementa un patrón **Supabase-first con fallback a SQLite:**

```javascript
// Ejemplo: get-stats-today (líneas 1014-1134)

// PASO 1: Intentar Supabase primero
if (supabaseManager && supabaseManager.isAvailable()) {
  const { data: vouchers } = await supabaseManager.client
    .from('vouchers')
    .select('*')
    .gte('issued_at', today);

  // Calcular stats
  stats = calculateStatsFromVouchers(vouchers);

  // Cachear en SQLite
  for (const v of vouchers) {
    db.createTicket(...); // Guardar local
  }
}

// PASO 2: Fallback a SQLite si Supabase falla
if (!stats && db) {
  stats = db.getStatsToday(); // Query local
}

// PASO 3: Valores por defecto si ambos fallan
if (!stats) {
  return { ticketsHoy: 0, totalDOP: 0, totalUSD: 0 };
}
```

**Frecuencia de uso del fallback:**
- Identificadas **25 ubicaciones** con patrón `"Supabase no disponible, usando SQLite"`
- Identificadas **8 ubicaciones** con patrón `"fallback a SQLite"`

---

## 3. MAPEO DE DATOS: SQLite vs Supabase

### 3.1 Tablas con Equivalente en Supabase

| Tabla SQLite | Tabla Supabase | Compatibilidad | Notas |
|--------------|----------------|----------------|-------|
| tickets | vouchers | ✅ 95% | Campos mapeables |
| usuarios | users (auth.users) | ⚠️ 70% | Estructura diferente |
| auditoria | audit_log | ✅ 90% | Campos compatibles |
| operadores | users (con role) | ⚠️ 60% | Necesita migración |
| configuracion | - | ❌ NO EXISTE | Requiere nueva tabla |

### 3.2 Mapeo de Campos: tickets → vouchers

| Campo SQLite (tickets) | Campo Supabase (vouchers) | Mapeo |
|------------------------|---------------------------|-------|
| code | voucher_code | ✅ Directo |
| amount | amount | ✅ Directo |
| currency | currency | ✅ Directo |
| mesa | issued_at_station_id | ⚠️ Requiere conversión |
| estado | status | ⚠️ Mapeo de valores |
| fecha_emision | issued_at | ✅ Directo |
| fecha_cobro | redeemed_at | ✅ Directo |
| cajero_id | redeemed_by_user_id | ⚠️ Requiere UUID |
| hash_seguridad | qr_hash | ✅ Directo |
| qr_data | qr_data | ✅ Directo |
| sincronizado | - | ❌ No necesario |
| notas | customer_name | ⚠️ Parcial |

**Mapeo de estados:**
- SQLite: `'activo' | 'emitido' | 'usado' | 'cancelado' | 'expirado'`
- Supabase: `'active' | 'redeemed' | 'cancelled' | 'expired'`

---

## 4. ANÁLISIS DE QUERIES DIFÍCILES DE REPLICAR

### 4.1 Query Compleja: `getStatsToday()` (database.js:317-356)

**SQLite (40 líneas):**
```sql
SELECT
  COUNT(*) as ticketsHoy,
  SUM(CASE WHEN estado IN ('usado', 'canjeado', 'redeemed') THEN 1 ELSE 0 END) as cobrados,
  SUM(CASE WHEN currency = 'DOP' AND estado IN ('usado') THEN amount ELSE 0 END) as totalDOP,
  SUM(CASE WHEN mesa IN ('MESA-1', 'P01', 'M01', 'm01', '01', '1') THEN 1 ELSE 0 END) as mesa1_emitidos,
  -- ... 30 líneas más con CASE WHEN para cada mesa
FROM tickets
WHERE DATE(fecha_emision) = DATE('now', 'localtime')
```

**Postgres (Supabase) equivalente:**
```sql
SELECT
  COUNT(*) as tickets_hoy,
  SUM(CASE WHEN status = 'redeemed' THEN 1 ELSE 0 END) as cobrados,
  SUM(CASE WHEN currency = 'DOP' AND status = 'redeemed' THEN amount ELSE 0 END) as total_dop,
  SUM(CASE WHEN issued_at_station_id = 1 THEN 1 ELSE 0 END) as mesa1_emitidos,
  -- ... similar pero con issued_at_station_id
FROM vouchers
WHERE issued_at >= CURRENT_DATE
  AND issued_at < CURRENT_DATE + INTERVAL '1 day'
```

**Viabilidad:** ✅ **FACTIBLE** - La query es replicable en Postgres con sintaxis ajustada.

**Diferencias:**
- SQLite usa `DATE('now', 'localtime')` → Postgres usa `CURRENT_DATE`
- SQLite acepta múltiples aliases de mesa → Supabase usa ID numérico
- Performance: Postgres puede ser más lento en queries complejas con múltiples CASE WHEN

---

### 4.2 Query con PRAGMA (inspección de esquema)

**SQLite:**
```javascript
db.prepare("PRAGMA table_info('tickets')").all()
db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all()
```

**Postgres equivalente:**
```sql
-- Obtener columnas de tabla
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'vouchers';

-- Listar tablas
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public';
```

**Viabilidad:** ✅ **FACTIBLE** - Postgres tiene information_schema equivalente.

---

### 4.3 Transacciones y Batch Inserts

**SQLite (usado en database.js:593-606):**
```javascript
const tx = this.db.transaction(rows => {
  for (const r of rows) {
    insert.run(code, amount, currency, ...);
  }
});
tx(rows); // Ejecutar en una sola transacción
```

**Supabase equivalente:**
```javascript
// Opción 1: Batch insert nativo
const { data, error } = await supabase
  .from('vouchers')
  .insert(rowsArray); // Supabase maneja el batch automáticamente

// Opción 2: Usar transaction explícito (no soportado por REST API)
// Requiere usar postgres functions o pg-promise directo
```

**Viabilidad:** ⚠️ **LIMITADO** - Supabase REST API no soporta transacciones explícitas multi-query.

**Workaround:** Usar Postgres Functions (RPC calls) para lógica transaccional compleja.

---

## 5. IMPACTO EN FUNCIONALIDAD OFFLINE

### 5.1 Funciones que Requieren Modo Offline

| Funcionalidad | Uso Actual SQLite | Impacto sin SQLite | Mitigación Posible |
|---------------|-------------------|--------------------|--------------------|
| Generar ticket | Guardar local + sync | ❌ **BLOQUEANTE** sin internet | Caché en memoria + queue |
| Validar voucher | Fallback a caché local | ⚠️ Vouchers no encontrados | Caché en memoria (últimos N) |
| Canjear voucher | Fallback a caché local | ❌ **BLOQUEANTE** sin internet | Requiere conexión obligatoria |
| Ver estadísticas | Fallback a caché local | ⚠️ Stats incompletas | Caché en memoria (día actual) |
| Login operador | Autenticación local | ❌ **BLOQUEANTE** sin internet | Caché de credenciales |
| Ver tickets del día | Query local | ⚠️ Lista vacía | Caché en memoria |
| Backup BD | db.backup() | ❌ Funcionalidad perdida | Exportar desde Supabase |
| Auditoría local | INSERT auditoria | ⚠️ Eventos perdidos | Queue + batch sync |

**Funcionalidades críticas bloqueadas sin SQLite:** 4 de 8

---

### 5.2 Frecuencia de Escenarios Offline

**Análisis del código:**
- **25 ubicaciones** con manejo de "Supabase no disponible"
- **33 archivos** con dependencia en SQLite

**Escenarios de uso offline identificados:**

1. **Pérdida de conexión a internet** (común en casinos pequeños)
   - Código actual maneja con fallback a SQLite ✅
   - Sin SQLite: sistema completamente inoperativo ❌

2. **Supabase inaccesible** (mantenimiento, rate limits, error del servicio)
   - Código actual maneja con fallback a SQLite ✅
   - Sin SQLite: sistema completamente inoperativo ❌

3. **Latencia alta** (>3 segundos)
   - Código actual tiene timeouts y fallback a SQLite ✅
   - Sin SQLite: operaciones lentas o timeouts ⚠️

**Conclusión:** El sistema actual está **diseñado para operar offline**. Eliminar SQLite sin alternativa **rompe este diseño**.

---

## 6. ESTIMACIÓN DE ESFUERZO

### 6.1 Trabajo por Archivo

| Archivo | Líneas a Modificar | Complejidad | Horas Estimadas |
|---------|-------------------|-------------|-----------------|
| `Caja/database.js` | 250+ líneas | ALTA | 16-20 horas |
| `pure/main.js` | 500+ líneas | ALTA | 20-24 horas |
| `Caja/cajaHandlers.js` | 50 líneas | MEDIA | 2-3 horas |
| Scripts sync (11 archivos) | 500+ líneas | BAJA | 4-6 horas (eliminar) |
| Scripts test (19 archivos) | 800+ líneas | BAJA | 6-8 horas (actualizar) |

**Total estimado:** 48-61 horas de desarrollo

---

### 6.2 Trabajo por Tipo de Cambio

| Tipo de Cambio | Archivos | Estimación |
|----------------|----------|------------|
| Eliminar queries SQLite | 3 archivos principales | 16 horas |
| Reemplazar con Supabase queries | 3 archivos principales | 20 horas |
| Migrar autenticación | 2 archivos | 6 horas |
| Implementar caché en memoria | Nuevo módulo | 8 horas |
| Actualizar/eliminar scripts | 30 archivos | 10 horas |
| Testing y QA | Todo el sistema | 12 horas |

**Total:** 72 horas (incluyendo testing)

---

### 6.3 Riesgos y Tiempo de Contingencia

| Riesgo | Probabilidad | Impacto | Tiempo de Contingencia |
|--------|--------------|---------|------------------------|
| Queries Postgres más lentas | ALTA | MEDIO | +8 horas (optimización) |
| Problemas con transacciones | MEDIA | ALTO | +12 horas (implementar RPC) |
| Pérdida de datos en migración | MEDIA | CRÍTICO | +16 horas (rollback) |
| Funcionalidad offline no replicable | ALTA | CRÍTICO | +20 horas (caché memoria) |
| Bugs en producción | MEDIA | ALTO | +16 horas (hotfixes) |

**Contingencia total:** +72 horas

**TOTAL GENERAL:** 120-144 horas (3-3.5 semanas)

---

## 7. PLAN DE MIGRACIÓN DETALLADO

### Fase 1: Preparación (8 horas)

1. **Backup completo del sistema actual** (2 horas)
   - Exportar SQLite completo
   - Verificar integridad de Supabase
   - Crear branch git dedicado

2. **Auditar esquema Supabase** (4 horas)
   - Verificar que todas las tablas existen
   - Crear tabla `configuration` faltante
   - Crear índices necesarios
   - Verificar RLS policies

3. **Implementar sistema de caché en memoria** (2 horas)
   - Crear módulo `MemoryCache.js`
   - Implementar LRU cache para vouchers
   - Implementar cache de configuración
   - Implementar queue de operaciones pendientes

---

### Fase 2: Migración de Lectura (16 horas)

**Orden de ejecución (de menor a mayor riesgo):**

1. **get-database-stats** → eliminar (2 horas)
   - Reemplazar con query a Supabase `information_schema`
   - O eliminar handler si no es crítico

2. **get-audit-logs** → migrar a Supabase (3 horas)
   ```javascript
   // Antes (SQLite)
   const logs = db.getAuditLogs(limit, filtros);

   // Después (Supabase)
   const { data: logs } = await supabase
     .from('audit_log')
     .select('*')
     .order('created_at', { ascending: false })
     .limit(limit);
   ```

3. **get-stats-today** → eliminar fallback SQLite (4 horas)
   ```javascript
   // Antes: Supabase primero, fallback a SQLite
   // Después: Solo Supabase + caché en memoria

   if (!stats) {
     stats = memoryCache.get('stats-today');
   }
   ```

4. **get-stats-by-mesa** → similar a stats-today (4 horas)

5. **get-operadores-activos** → migrar a Supabase (3 horas)
   ```javascript
   // Antes (SQLite)
   const ops = db.db.prepare('SELECT * FROM operadores WHERE activo = 1').all();

   // Después (Supabase)
   const { data: ops } = await supabase
     .from('users')
     .select('*')
     .eq('role', 'OPERATOR')
     .eq('is_active', true);
   ```

---

### Fase 3: Migración de Escritura (20 horas)

**Crítico: Implementar queue de operaciones pendientes**

1. **generate-ticket** → eliminar INSERT SQLite (6 horas)
   ```javascript
   // Antes: INSERT Supabase + INSERT SQLite
   // Después: INSERT Supabase + queue en memoria si falla

   try {
     await supabase.from('vouchers').insert(data);
   } catch (error) {
     // Guardar en queue persistente (localStorage/file)
     await pendingOperations.queue('create-voucher', data);
     throw new Error('Guardado en cola, se sincronizará cuando haya conexión');
   }
   ```

2. **redeem-voucher** → similar a generate-ticket (5 horas)

3. **create-operador / update-operador** → migrar a users (4 horas)

4. **create-user / update-user** → migrar a auth.users (5 horas)
   - Usar Supabase Auth Admin API
   - Manejar passwords con bcrypt

---

### Fase 4: Autenticación (12 horas)

1. **authenticateOperator** → Supabase Auth (6 horas)
   ```javascript
   // Antes (SQLite)
   const op = db.db.prepare('SELECT * FROM operadores WHERE codigo = ? AND pin = ?')
     .get(codigo, pin);

   // Después (Supabase)
   const { data, error } = await supabase.auth.signInWithPassword({
     email: `${codigo}@casino.local`,
     password: pin
   });
   ```

2. **authenticateUserLocal** → Supabase Auth (6 horas)
   ```javascript
   // Antes (SQLite con pbkdf2)
   const user = db.getUserByUsername(username);
   const { hash } = db.hashPassword(password, user.password_salt);

   // Después (Supabase Auth)
   const { data, error } = await supabase.auth.signInWithPassword({
     email: username,
     password: password
   });
   ```

---

### Fase 5: Eliminar Código Legacy (8 horas)

1. **Eliminar `Caja/database.js`** (4 horas)
   - Refactorizar imports
   - Mover funciones helper a módulo separado
   - Eliminar dependencia better-sqlite3

2. **Eliminar workers de sincronización** (2 horas)
   - Eliminar 11 scripts de sync
   - Actualizar documentación

3. **Actualizar scripts de testing** (2 horas)
   - Modificar tests para usar Supabase
   - Eliminar tests obsoletos

---

### Fase 6: Testing y Rollout (16 horas)

1. **Testing unitario** (6 horas)
   - Test de cada handler modificado
   - Test de caché en memoria
   - Test de queue de operaciones

2. **Testing de integración** (6 horas)
   - Flujo completo: crear ticket → validar → canjear
   - Test de autenticación
   - Test de estadísticas

3. **Testing de escenarios de error** (4 horas)
   - Simular pérdida de conexión
   - Simular timeout de Supabase
   - Verificar que queue funciona

---

## 8. ANÁLISIS DE RIESGOS

### 8.1 Riesgos Técnicos

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|------------|
| **Performance degradada** | ALTA | MEDIO | Implementar caché agresivo, índices en Supabase |
| **Pérdida de funcionalidad offline** | ALTA | CRÍTICO | Implementar caché + queue persistente |
| **Bugs en migración de datos** | MEDIA | CRÍTICO | Testing exhaustivo, rollback plan |
| **Autenticación más lenta** | MEDIA | MEDIO | Caché de sesiones, tokens de larga duración |
| **Queries Postgres lentas** | ALTA | MEDIO | Optimizar queries, usar índices, EXPLAIN ANALYZE |
| **Rate limits de Supabase** | BAJA | ALTO | Implementar retry logic, usar connection pooling |
| **Transacciones no atómicas** | MEDIA | ALTO | Usar Postgres Functions para lógica crítica |
| **Pérdida de datos en queue** | MEDIA | CRÍTICO | Persistir queue en localStorage + file backup |

---

### 8.2 Riesgos de Negocio

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|------------|
| **Casino sin conexión = inoperativo** | MEDIA | CRÍTICO | Mantener caché local robusto, alertas de conectividad |
| **Tiempo de inactividad en migración** | ALTA | ALTO | Migración en horario no operativo, rollback rápido |
| **Usuarios rechazan cambios** | BAJA | MEDIO | Capacitación, documentación, soporte |
| **Costo de Supabase aumenta** | MEDIA | MEDIO | Monitorear uso, optimizar queries, plan de contingencia |

---

### 8.3 Plan de Rollback

**Escenario:** La migración falla y necesitamos volver a SQLite.

**Pasos de rollback (< 1 hora):**

1. Hacer git checkout al commit anterior a la migración
2. Restaurar backup de SQLite
3. Verificar que sistema funciona con SQLite
4. Sincronizar datos de Supabase a SQLite (script de recuperación)

**Requisitos:**
- Backup de SQLite actualizado (antes de migración)
- Branch git preservado
- Script de sincronización inversa (Supabase → SQLite)

---

## 9. ANÁLISIS DE ALTERNATIVAS

### Opción A: Solo Supabase (propuesta original)

**Pros:**
- ✅ Elimina complejidad de sincronización
- ✅ Datos siempre actualizados
- ✅ Elimina bugs de inconsistencia
- ✅ Menos código que mantener
- ✅ Escalabilidad a múltiples terminales

**Contras:**
- ❌ **CRÍTICO:** Sistema inoperativo sin internet
- ❌ Latencia más alta (red vs local)
- ❌ Dependencia completa en servicio externo
- ❌ Costos de Supabase aumentan con uso
- ❌ Requiere refactorización masiva

**Veredicto:** ⚠️ **NO RECOMENDADO** sin implementar caché robusto.

---

### Opción B: Solo SQLite + Sync Manual

**Pros:**
- ✅ Sistema siempre operativo (offline-first)
- ✅ Performance óptimo (queries locales)
- ✅ Sin dependencia de red
- ✅ Costo cero de infraestructura cloud

**Contras:**
- ❌ Sincronización manual propensa a errores
- ❌ Difícil de escalar a múltiples terminales
- ❌ Datos pueden estar desactualizados
- ❌ Sin backup automático en cloud

**Veredicto:** ⚠️ **NO RECOMENDADO** para sistema multi-terminal.

---

### Opción C: Supabase + Caché en Memoria (SIN SQLite)

**Pros:**
- ✅ Elimina dependencia en better-sqlite3
- ✅ Datos sincronizados en tiempo real
- ✅ Operaciones críticas funcionan offline (con caché)
- ✅ Menos complejidad que dual DB
- ✅ Performance aceptable con caché LRU

**Contras:**
- ⚠️ Caché se pierde al reiniciar app
- ⚠️ Requiere implementar queue persistente
- ⚠️ Lógica de caché puede tener bugs

**Implementación:**
```javascript
class MemoryCache {
  constructor() {
    this.voucherCache = new Map(); // LRU cache de últimos 1000 vouchers
    this.statsCache = null; // Stats del día actual
    this.configCache = new Map(); // Configuración
    this.pendingOperations = []; // Queue de operaciones pendientes
  }

  async get(key) { /* ... */ }
  async set(key, value, ttl) { /* ... */ }
  async invalidate(key) { /* ... */ }

  // Queue persistente en localStorage
  async queueOperation(op) { /* ... */ }
  async syncPendingOperations() { /* ... */ }
}
```

**Veredicto:** ✅ **RECOMENDADO** - Balance entre simplicidad y funcionalidad offline.

---

### Opción D: Mantener Dual DB pero Simplificar Sync

**Pros:**
- ✅ Mantiene funcionalidad offline completa
- ✅ Performance óptimo
- ✅ Menor riesgo (no es refactorización completa)
- ✅ Flexibilidad para migrar gradualmente

**Contras:**
- ⚠️ Sigue teniendo complejidad de sincronización
- ⚠️ Bugs de inconsistencia pueden persistir
- ⚠️ Más código que mantener

**Mejoras propuestas:**
1. Implementar single source of truth claro (Supabase)
2. SQLite solo como caché de solo lectura
3. Eliminar writes duplicados (solo escribir a Supabase)
4. Sincronización unidireccional (Supabase → SQLite) en background

**Veredicto:** ✅ **RECOMENDADO** - Menor riesgo, mantiene funcionalidad offline.

---

## 10. COMPARACIÓN DE OPCIONES

| Criterio | Opción A (Solo Supabase) | Opción B (Solo SQLite) | Opción C (Supabase + Caché) | Opción D (Dual Simplificado) |
|----------|-------------------------|------------------------|----------------------------|----------------------------|
| **Funcionalidad offline** | ❌ Bloqueado | ✅ Completo | ⚠️ Limitado | ✅ Completo |
| **Performance** | ⚠️ Red latency | ✅ Local rápido | ✅ Caché rápido | ✅ Local rápido |
| **Complejidad de código** | ✅ Simple | ✅ Simple | ⚠️ Media | ❌ Complejo |
| **Bugs de sincronización** | ✅ Eliminados | ❌ N/A | ⚠️ Reducidos | ⚠️ Pueden persistir |
| **Escalabilidad multi-terminal** | ✅ Excelente | ❌ Difícil | ✅ Excelente | ⚠️ Media |
| **Esfuerzo de migración** | ❌ 120+ horas | ❌ 80+ horas | ⚠️ 60 horas | ✅ 20 horas |
| **Riesgo global** | ❌ ALTO | ⚠️ MEDIO | ⚠️ MEDIO | ✅ BAJO |
| **Dependencia externa** | ❌ Total | ✅ Ninguna | ⚠️ Alta | ⚠️ Alta |
| **Costo infraestructura** | ⚠️ Variable | ✅ Cero | ⚠️ Variable | ⚠️ Variable |

**Puntaje (1-5):**
- Opción A: 2.8/5 ⚠️
- Opción B: 2.5/5 ⚠️
- Opción C: 3.8/5 ✅
- Opción D: 4.2/5 ✅ **GANADOR**

---

## 11. RECOMENDACIÓN FINAL

### Recomendación: **Opción D - Dual DB Simplificado**

**Justificación:**

1. **Menor riesgo** (20 horas vs 120 horas de trabajo)
2. **Mantiene funcionalidad offline crítica** (casinos pequeños sin internet estable)
3. **Simplifica sin eliminar** (reduce complejidad sin refactorización masiva)
4. **Migración gradual posible** (puede evolucionar a Opción C después)

---

### Plan de Implementación Recomendado

#### Fase 1: Establecer Single Source of Truth (4 horas)

**Cambio conceptual:** Supabase es la fuente de verdad, SQLite es caché.

```javascript
// Antes: Dual writes
await supabase.from('vouchers').insert(data);
await db.createTicket(data); // ❌ Write duplicado

// Después: Single write + cache update
await supabase.from('vouchers').insert(data);
memoryCache.set(`voucher:${code}`, data); // ✅ Solo caché
```

#### Fase 2: Convertir SQLite a Read-Only Cache (8 horas)

**Cambios:**
1. Eliminar todos los `INSERT` y `UPDATE` directos a SQLite
2. Solo escribir a SQLite durante sincronización background
3. Reads de SQLite solo cuando Supabase no disponible

```javascript
// Nuevo patrón de lectura
async function getVoucher(code) {
  // 1. Intentar caché en memoria
  let voucher = memoryCache.get(`voucher:${code}`);
  if (voucher) return voucher;

  // 2. Intentar Supabase
  try {
    const { data } = await supabase.from('vouchers').select('*').eq('voucher_code', code).single();
    if (data) {
      memoryCache.set(`voucher:${code}`, data);
      return data;
    }
  } catch (error) {
    console.warn('Supabase no disponible, usando caché SQLite');
  }

  // 3. Fallback a SQLite (caché persistente)
  return db.getTicket(code);
}
```

#### Fase 3: Sincronización Unidireccional Background (6 horas)

**Worker de sincronización simplificado:**
```javascript
// sync-worker.js
setInterval(async () => {
  if (!supabaseAvailable()) return;

  // Sincronizar Supabase → SQLite (unidireccional)
  const { data: vouchers } = await supabase
    .from('vouchers')
    .select('*')
    .gte('issued_at', todayStart);

  // Actualizar caché SQLite
  for (const v of vouchers) {
    db.upsertVoucher(v); // UPSERT, no INSERT
  }
}, 60000); // Cada minuto
```

#### Fase 4: Eliminar Código de Sync Bidireccional (2 horas)

**Archivos a eliminar:**
- `scripts/sync-all-pending.js`
- `scripts/sync-users-supabase-to-sqlite.js`
- Lógica de `sincronizado` flag en database.js

**Total estimado:** 20 horas

---

### Si Después se Desea Migrar a Opción C

Una vez que Opción D esté estable, se puede evolucionar a Opción C:

1. Reemplazar SQLite cache con MemoryCache (LRU)
2. Persistir queue de operaciones en localStorage
3. Eliminar dependency better-sqlite3
4. **Tiempo adicional:** +40 horas

**Ventaja:** Migración gradual con menos riesgo.

---

## 12. CONCLUSIONES

### Respuestas a Preguntas Clave

#### 1. ¿Es viable técnicamente?
✅ **SÍ**, pero con condiciones:
- Supabase tiene todas las features necesarias
- Queries son replicables en Postgres
- **PERO** requiere implementar caché robusto para modo offline

#### 2. ¿Qué pasa con el modo offline?
❌ **CRÍTICO**: Sistema actual está diseñado para operar offline.
- Eliminar SQLite sin alternativa = sistema inoperativo sin internet
- **Solución:** Implementar caché en memoria + queue persistente (Opción C)
- **Mejor solución:** Mantener SQLite como caché read-only (Opción D)

#### 3. ¿Cuál es el impacto en usuarios?
⚠️ **ALTO**:
- Requiere conexión a internet estable
- Performance puede degradarse (latencia de red)
- Usuarios necesitarán capacitación si cambia comportamiento

#### 4. ¿Hay alternativas mejores?
✅ **SÍ**: **Opción D (Dual DB Simplificado)** es superior porque:
- Menor riesgo
- Mantiene funcionalidad offline
- Menos tiempo de desarrollo
- Puede evolucionar gradualmente

---

### Veredicto Final

**NO proceder con Opción A (Solo Supabase) sin mitigaciones.**

**Proceder con Opción D (Dual DB Simplificado):**
- Implementar en 20 horas
- Riesgo BAJO
- Mantiene funcionalidad offline
- Simplifica sincronización

**Si es absolutamente necesario eliminar SQLite:**
- Implementar Opción C (Supabase + Caché en Memoria)
- Tiempo: 60 horas + 16 horas de testing
- Requiere caché LRU + queue persistente robusto

---

## ANEXOS

### A. Esquema Supabase Requerido

```sql
-- Tabla configuracion (FALTANTE - debe crearse)
CREATE TABLE IF NOT EXISTS configuration (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices recomendados para performance
CREATE INDEX IF NOT EXISTS idx_vouchers_issued_at ON vouchers(issued_at);
CREATE INDEX IF NOT EXISTS idx_vouchers_status ON vouchers(status);
CREATE INDEX IF NOT EXISTS idx_vouchers_station ON vouchers(issued_at_station_id);
CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id);
```

### B. Módulo MemoryCache Propuesto

Ver archivo completo en: `shared/memory-cache.js` (a crear)

```javascript
// Ejemplo simplificado
class MemoryCache {
  constructor(maxSize = 1000) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;
    if (item.expiresAt && Date.now() > item.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    return item.value;
  }

  set(key, value, ttlSeconds = 3600) {
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + (ttlSeconds * 1000)
    });
  }
}
```

### C. Checklist de Migración

**Antes de comenzar:**
- [ ] Backup completo de SQLite
- [ ] Backup completo de Supabase
- [ ] Branch git dedicado creado
- [ ] Plan de rollback documentado
- [ ] Equipo notificado de mantenimiento

**Durante migración:**
- [ ] Tests unitarios pasando
- [ ] Tests de integración pasando
- [ ] Performance comparable o mejor
- [ ] Funcionalidad offline verificada
- [ ] Documentación actualizada

**Después de migración:**
- [ ] Monitorear logs por 48 horas
- [ ] Verificar que queue funciona
- [ ] Verificar que caché funciona
- [ ] Recolectar feedback de usuarios
- [ ] Documentar lecciones aprendidas

---

**Documento generado por:** Claude Code (SQL Expert)
**Fecha:** 2025-11-06
**Versión:** 1.0 - Análisis Completo
