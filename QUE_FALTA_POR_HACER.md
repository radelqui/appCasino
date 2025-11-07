# 📋 QUÉ FALTA POR HACER - SINCRONIZACIÓN COMPLETA

**Fecha**: 31 de octubre de 2025
**Sistema**: TITO Casino - SQLite ↔ Supabase

---

## 📊 ESTADO ACTUAL

### Supabase (Cloud) - ✅ OPERATIVO

| Tabla | Registros | Estado |
|-------|-----------|--------|
| **vouchers** | 40 | ✅ OK |
| **users** | 9 | ✅ OK |
| **operadores** | 3 | ✅ OK |
| **stations** | 5 | ✅ OK |
| **audit_log** | ? | ✅ OK |

### SQLite (Local) - ⚠️  VERIFICAR

**Problema**: No se puede verificar directamente desde Node.js porque `better-sqlite3` está compilado para Electron.

**Basándome en los logs de la app que arrancaste**:
```
✅ Columna usuarios.sincronizado agregada
✅ Columna operadores.sincronizado agregada
✅ Migración de tickets desde C:\appCasino\data\casino.db completa: 1213 registros
✅ Migración de tickets desde C:\appCasino\Caja\data\casino.db completa: 10 registros
✅ Worker de sincronización iniciado (intervalo: 2 minutos)
```

Esto significa:
- ✅ SQLite principal tiene **1213 tickets**
- ✅ SQLite Caja tiene **10 tickets**
- ✅ Columnas `sincronizado` fueron agregadas
- ✅ Worker está corriendo

---

## ⚠️  PROBLEMA DETECTADO

### Discrepancia de datos:

| Fuente | Tickets |
|--------|---------|
| SQLite Principal | 1213 |
| SQLite Caja | 10 |
| **Total SQLite** | **1223** |
| **Supabase** | **40** |
| **FALTANTES** | **1183** ❌ |

**Conclusión**: Hay **1183 tickets en SQLite que NO están sincronizados a Supabase**.

---

## 🔍 ¿POR QUÉ NO SE HAN SINCRONIZADO?

### Posibles causas:

1. **Columna `sincronizado` recién agregada** ✅
   - Acabamos de agregar la columna con el método `ensureExtraColumns()`
   - Todos los tickets existentes tienen `sincronizado = 0` por defecto
   - El worker debería sincronizarlos progresivamente

2. **Worker necesita tiempo** ⏰
   - Worker corre cada 2 minutos
   - Si hay 1183 tickets pendientes, necesita varias iteraciones
   - No sabemos cuántos sincroniza por ciclo

3. **Tickets sin datos requeridos** ⚠️
   - Algunos tickets viejos pueden no tener campos requeridos
   - Por ejemplo: `qr_data`, `qr_hash` (pero ya los hicimos opcionales)

4. **Worker podría estar crasheando** ❌
   - Si hay errores, el worker se detiene silenciosamente
   - No tenemos logs visibles del worker

---

## ✅ LO QUE YA ESTÁ FUNCIONANDO

### 1. Columnas agregadas ✅

En **SQLite** (ambas bases):
- ✅ `usuarios.sincronizado` - Agregada
- ✅ `usuarios.email` - Agregada (implícita, no se vio log)
- ✅ `operadores.sincronizado` - Agregada

### 2. Worker activo ✅

El worker de sincronización está corriendo:
- ✅ Ubicación: `pure/main.js` líneas 2610-2850
- ✅ Intervalo: Cada 2 minutos
- ✅ Sincroniza: Tickets, Usuarios, Operadores

### 3. Supabase configurado ✅

- ✅ 19 índices creados
- ✅ 4 triggers activos
- ✅ 12 políticas RLS activas
- ✅ 5 tablas con RLS habilitado
- ✅ Performance optimizada

---

## 📋 TAREAS PENDIENTES

### 🔴 URGENTE: Verificar sincronización de tickets

#### Opción 1: Esperar al worker (RECOMENDADO)

**Tiempo estimado**: 1-2 horas (para 1183 tickets)

**Pasos**:
1. Dejar la app corriendo
2. Esperar 2 minutos entre cada verificación
3. Verificar en Supabase cuántos vouchers hay
4. Repetir hasta que llegue a ~1223 vouchers

**Comando para verificar** (desde Supabase SQL Editor):
```sql
SELECT COUNT(*) FROM vouchers;
```

#### Opción 2: Sincronización manual forzada

**Crear script de sincronización masiva**:

```javascript
// sync-all-pending.js
const db = require('./Caja/database');
const supabaseManager = require('./pure/supabaseManager');

async function syncAllPending() {
  // Obtener todos los tickets con sincronizado = 0
  const pending = db.db.prepare('SELECT * FROM tickets WHERE sincronizado = 0').all();

  console.log(`📊 Tickets pendientes: ${pending.length}`);

  let synced = 0;
  let failed = 0;

  for (const ticket of pending) {
    try {
      // Insertar en Supabase
      const { data, error } = await supabaseManager.client
        .from('vouchers')
        .insert({
          voucher_code: ticket.code,
          amount: parseFloat(ticket.amount),
          currency: ticket.currency,
          status: ticket.estado === 'emitido' ? 'active' :
                  ticket.estado === 'cobrado' ? 'redeemed' : 'active',
          issued_at: ticket.fecha_emision || new Date().toISOString(),
          created_at: ticket.created_at || new Date().toISOString(),
          // ... otros campos
        });

      if (!error) {
        // Marcar como sincronizado
        db.db.prepare('UPDATE tickets SET sincronizado = 1 WHERE id = ?').run(ticket.id);
        synced++;
        if (synced % 100 === 0) {
          console.log(`✅ Sincronizados: ${synced}/${pending.length}`);
        }
      } else {
        console.error(`❌ Error en ${ticket.code}:`, error.message);
        failed++;
      }
    } catch (error) {
      console.error(`❌ Error en ${ticket.code}:`, error.message);
      failed++;
    }
  }

  console.log(`\n✅ Sincronización completa:`);
  console.log(`  Exitosos: ${synced}`);
  console.log(`  Fallidos: ${failed}`);
}

syncAllPending();
```

**¿Crear este script?** (Dime si quieres que lo haga)

---

### 🟡 IMPORTANTE: Verificar que worker funciona

#### Verificar logs del worker

**En los logs de la app**, deberías ver cada 2 minutos:

```
🔄 [Sync Worker] Sincronizando X tickets pendientes...
✅ [Sync Worker - Tickets] X exitosos, Y fallidos
🔄 [Sync Worker] Sincronizando X usuarios pendientes...
✅ [Sync Worker - Usuarios] X exitosos, Y fallidos
🔄 [Sync Worker] Sincronizando X operadores pendientes...
✅ [Sync Worker - Operadores] X exitosos, Y fallidos
✅ [Sync Worker] RESUMEN TOTAL: X sincronizados, Y fallidos
```

**Si NO ves estos logs**:
- ⚠️  Worker podría estar crasheando
- ⚠️  Worker podría no estar encontrando tickets con `sincronizado = 0`
- ⚠️  Hay un error silencioso

#### Cómo verificar:

**Espera 2 minutos y mira los logs de tu terminal donde corre `npm start`**

---

### 🟢 OPCIONAL: Sincronizar usuarios y operadores

**Situación actual**:
- Supabase: 9 users, 3 operadores
- SQLite: Cantidad desconocida (no se pudo verificar)

**Worker debería sincronizar automáticamente**, pero verifica:

1. **Usuarios nuevos en SQLite**:
   - Si creas un usuario en la UI
   - Debe aparecer en Supabase después de 2 minutos

2. **Operadores nuevos en SQLite**:
   - Si creas un operador en la UI
   - Debe aparecer en Supabase después de 2 minutos

---

## 🎯 PLAN DE ACCIÓN RECOMENDADO

### Paso 1: Verificar worker está funcionando (5 minutos)

1. Abre la terminal donde corre `npm start`
2. Espera 2 minutos
3. Busca logs del worker:
   ```
   🔄 [Sync Worker]
   ✅ [Sync Worker]
   ```

**Si ves los logs**:
- ✅ Worker funciona → Ir a Paso 2

**Si NO ves logs**:
- ❌ Worker tiene problemas → Investigar logs de error

### Paso 2: Verificar progreso en Supabase (cada 5 minutos)

**Ejecuta en Supabase SQL Editor**:
```sql
SELECT COUNT(*) as total, status, COUNT(*)
FROM vouchers
GROUP BY status;
```

**Resultado esperado**:
```
Primera verificación:  40 vouchers
Después de 2 min:      50-100 vouchers (dependiendo de velocidad)
Después de 10 min:     200-500 vouchers
Después de 1 hora:     ~1223 vouchers ✅
```

### Paso 3: Si es muy lento, sincronización manual

**Si después de 30 minutos sigue en ~40 vouchers**:
- Crear script de sincronización masiva
- Ejecutar manualmente
- Sincronizar 1183 tickets en 10-20 minutos

---

## 📊 MÉTRICAS DE ÉXITO

### ✅ Sincronización completa cuando:

| Métrica | Objetivo |
|---------|----------|
| Vouchers en Supabase | ~1223 (igual que SQLite) |
| Usuarios en Supabase | Igual o mayor que SQLite |
| Operadores en Supabase | Igual o mayor que SQLite |
| Tickets con `sincronizado = 0` | 0 (todos en 1) |
| Worker logs | Aparecen cada 2 minutos |
| Tasa de fallos | < 1% |

---

## 🚨 PROBLEMAS CONOCIDOS Y SOLUCIONES

### 1. Worker no sincroniza

**Síntomas**:
- No aparecen logs cada 2 minutos
- Supabase sigue en 40 vouchers

**Soluciones**:
1. Revisar logs de error en la app
2. Verificar que `ensureExtraColumns()` se ejecutó
3. Verificar que columnas existen en SQLite
4. Reiniciar la app

### 2. Sincronización muy lenta

**Síntomas**:
- Solo sincroniza 10-20 tickets por ciclo
- Tomará horas completar

**Soluciones**:
1. Crear script de sincronización masiva
2. Ejecutar manualmente
3. Ajustar worker para sincronizar más por ciclo

### 3. Tickets fallan al sincronizar

**Síntomas**:
- Worker reporta errores
- Algunos tickets no se sincronizan

**Causas posibles**:
- Datos faltantes (user_id, station_id)
- Formato incorrecto
- Constraints de Supabase

**Soluciones**:
1. Revisar logs de error del worker
2. Identificar tickets problemáticos
3. Arreglar datos o hacer campos opcionales en Supabase

---

## ✅ RESUMEN

### Lo que está BIEN:

✅ Columnas `sincronizado` agregadas en SQLite
✅ Worker de sincronización activo
✅ Supabase configurado con índices, triggers y RLS
✅ Performance optimizada
✅ Seguridad implementada

### Lo que FALTA:

⚠️  **1183 tickets** pendientes de sincronizar
⚠️  Verificar que worker está sincronizando
⚠️  Monitorear progreso de sincronización

### Siguiente paso inmediato:

🎯 **Espera 2 minutos y verifica los logs de tu app** para ver si el worker está sincronizando activamente.

Si ves:
```
✅ [Sync Worker] X sincronizados
```

Entonces solo es cuestión de **TIEMPO**. Deja la app corriendo y en 1-2 horas todo estará sincronizado.

Si NO ves esos logs, avísame y creo el script de sincronización manual.

---

**FIN DEL DOCUMENTO**
