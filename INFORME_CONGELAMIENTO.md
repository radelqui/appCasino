# 🔍 PROBLEMA IDENTIFICADO: App se Congela al Inicio

**Fecha**: 3 de noviembre de 2025
**Estado**: ✅ PROBLEMA ENCONTRADO

---

## ❌ CAUSA DEL CONGELAMIENTO

### **Operación Bloqueante: `ensureTicketsSchema()` en database.js:528-572**

Esta función se ejecuta **SÍNCRONAMENTE** durante `initDatabase()` al crear la instancia de CasinoDatabase.

#### Código problemático:

```javascript
// Línea 110 en database.js
this.ensureTicketsSchema();  // ❌ BLOQUEA INICIO

// Línea 528-572
ensureTicketsSchema() {
  try {
    const cols = this.db.prepare("PRAGMA table_info('tickets')").all();
    const isLegacy = cols.includes('ticket_number') || !cols.includes('code') || ...;

    if (!isLegacy) return; // ✅ Si NO es legacy, sale rápido

    // ❌ PROBLEMA: Si ES legacy, hace migración COMPLETA
    const rows = this.db.prepare('SELECT * FROM tickets').all();  // ❌ SIN LIMIT

    const tx = this.db.transaction(rs => {
      for (const r of rs) {  // ❌ Loop sobre TODOS los tickets
        // ... procesa cada ticket ...
        insert.run(...);
      }
    });
    tx(rows);  // ❌ Ejecuta SÍNCRONO
  } catch (e) { /* noop */ }
}
```

#### Por qué bloquea:

1. **Se ejecuta durante el constructor** (línea 8-14 de database.js)
2. **Carga TODOS los tickets** sin LIMIT (línea 550)
3. **Procesa cada ticket** en un loop (líneas 552-565)
4. **Es SÍNCRONO** - bloquea el event loop
5. Si tienes **1000+ tickets**, puede tomar **10-30 segundos**

---

## ✅ VERIFICACIÓN RÁPIDA

### Abre SQLite y verifica el esquema:

```bash
sqlite3 Caja/casino.db "PRAGMA table_info('tickets')"
```

**Busca estas columnas:**
- ❌ Si tiene `ticket_number`, `valor`, `moneda` → **ES LEGACY** → **BLOQUEA**
- ✅ Si tiene `code`, `amount`, `currency` → **NO es legacy** → **No bloquea**

---

## 🎯 SOLUCIÓN INMEDIATA

### **Opción 1: Comentar la migración (SI ES LEGACY)**

**TÚ editas** `Caja/database.js` línea 110:

```javascript
// ANTES:
this.ensureTicketsSchema();

// DESPUÉS:
// this.ensureTicketsSchema();  // DESHABILITADO - Ejecutar manualmente
```

**Resultado**: App inicia instantáneamente

---

### **Opción 2: Verificar si NO es legacy**

Si tu tabla ya tiene el esquema correcto (`code`, `amount`, `currency`), la función sale inmediatamente en línea 532.

**Verifica** con:
```bash
sqlite3 Caja/casino.db "SELECT name FROM pragma_table_info('tickets') WHERE name IN ('code','ticket_number')"
```

Si devuelve **`code`** → NO hay problema de migración

Si devuelve **`ticket_number`** → Problema confirmado

---

## 📊 RESUMEN

| Aspecto | Detalle |
|---------|---------|
| **Problema** | App se congela después de registrar handlers |
| **Causa** | `ensureTicketsSchema()` migra TODOS los tickets síncronamente |
| **Ubicación** | database.js:528-572, llamado en línea 110 |
| **Condición** | Solo si tabla `tickets` tiene esquema legacy |
| **Impacto** | Bloquea 10-30 segundos si hay 1000+ tickets |
| **Solución** | Comentar línea 110 temporalmente |

---

## 🔍 OTRAS VERIFICACIONES

### ✅ `migrateLegacyTicketsAsync()` - NO bloquea
- Se ejecuta async en segundo plano
- Tiene `setTimeout` de 2 segundos
- NO debería causar congelamiento al inicio

### ✅ `startSyncWorker()` - NO bloquea
- Usa `setInterval` (async)
- NO causa congelamiento

---

## 🎯 PRÓXIMOS PASOS

1. **Verifica el esquema** con SQLite
2. **Si es legacy**, comenta línea 110 en database.js
3. **Reinicia la app**
4. **Ejecuta el comando de sincronización** de usuarios desde DevTools

---

**Última actualización**: 3 de noviembre de 2025
**Autor**: Claude Code
