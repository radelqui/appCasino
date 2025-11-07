# Próximos Pasos - Sistema Casino TITO
## appCasino311025

**Fecha:** 31 de Octubre de 2024
**Estado:** ✅ Herramientas instaladas y configuradas

---

## 📋 Resumen de lo Completado

### ✅ Instalaciones Realizadas

1. **Supabase MCP Server** - Configurado en [.mcp.json](.mcp.json)
   - Proyecto: `elagvnnamabrjptovzyq`
   - URL: `https://elagvnnamabrjptovzyq.supabase.co`
   - Credenciales: SERVICE_ROLE_KEY configurada

2. **Comandos de Supabase**
   - `/supabase-migration-assistant` - Asistente de migraciones
   - `/supabase-schema-sync` - Sincronización de esquemas

3. **Documentación Generada**
   - [SCHEMA_ANALYSIS.md](SCHEMA_ANALYSIS.md) - Análisis completo de esquemas
   - [migration-sync-schemas.sql](SqulInstrucciones/migration-sync-schemas.sql) - Script de migración

---

## 🎯 Plan de Acción

### Fase 1: Migración de Esquemas (URGENTE) ⚠️

#### Paso 1.1: Ejecutar Migración en Supabase
```bash
# Abrir Supabase Dashboard
https://supabase.com/dashboard/project/elagvnnamabrjptovzyq/editor/sql

# Copiar y ejecutar el contenido de:
SqulInstrucciones/migration-sync-schemas.sql
```

**Qué hace este script:**
- ✅ Agrega campos `codigo` y `pin` a tabla `operadores`
- ✅ Crea tabla `audit_logs` para auditoría centralizada
- ✅ Mejora tabla `vouchers` con campos adicionales
- ✅ Crea triggers automáticos de auditoría
- ✅ Crea vistas para estadísticas
- ✅ Configura políticas de seguridad RLS

**Tiempo estimado:** 5-10 minutos

#### Paso 1.2: Verificar la Migración
```sql
-- Ejecutar en Supabase SQL Editor para verificar

-- 1. Verificar nuevos campos en operadores
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'operadores';

-- 2. Verificar que audit_logs existe
SELECT COUNT(*) FROM audit_logs;

-- 3. Verificar estadísticas
SELECT * FROM vouchers_stats_today;
```

---

### Fase 2: Sincronizar Operadores

#### Paso 2.1: Actualizar Operadores en Supabase

Ejecutar en Supabase SQL Editor:
```sql
-- Actualizar operadores existentes con códigos y PINs
UPDATE operadores SET
  codigo = 'OP' || LPAD(id::TEXT, 3, '0'),
  pin = '1234'  -- PIN temporal, cambiar después
WHERE codigo IS NULL;

-- Verificar
SELECT id, nombre, codigo, pin, activo FROM operadores;
```

#### Paso 2.2: Crear Script de Sincronización

Crear archivo `sync-operadores-to-sqlite.js`:
```javascript
// Script para sincronizar operadores de Supabase a SQLite
const { createClient } = require('@supabase/supabase-js');
const Database = require('better-sqlite3');
const path = require('path');
require('dotenv').config();

async function syncOperadores() {
  // Conectar a Supabase
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  // Obtener operadores de Supabase
  const { data: operadores, error } = await supabase
    .from('operadores')
    .select('*')
    .order('id');

  if (error) {
    console.error('Error:', error);
    return;
  }

  // Conectar a SQLite
  const dbPath = process.env.CASINO_DB_PATH || path.join(process.cwd(), 'data', 'casino.db');
  const db = new Database(dbPath);

  // Sincronizar cada operador
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO operadores (id, codigo, nombre, pin, mesa_asignada, activo)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  for (const op of operadores) {
    const mesaAsignada = op.mesas_asignadas && op.mesas_asignadas.length > 0
      ? op.mesas_asignadas[0]
      : null;

    stmt.run(
      op.id,
      op.codigo,
      op.nombre,
      op.pin || '1234',
      mesaAsignada,
      op.activo ? 1 : 0
    );
  }

  console.log(`✅ ${operadores.length} operadores sincronizados`);
  db.close();
}

syncOperadores();
```

#### Paso 2.3: Ejecutar Sincronización
```bash
node sync-operadores-to-sqlite.js
```

---

### Fase 3: Generar TypeScript Types

#### Paso 3.1: Instalar Supabase CLI (si no está instalado)
```bash
npm install -g supabase
```

#### Paso 3.2: Generar Types
```bash
# Opción 1: Usando CLI
npx supabase gen types typescript --project-id elagvnnamabrjptovzyq > types/supabase.ts

# Opción 2: Desde Supabase Dashboard
# Dashboard > Project Settings > API > TypeScript Types (copiar)
```

#### Paso 3.3: Crear Definiciones de Tipos

Crear archivo `types/database.types.ts`:
```typescript
export interface Voucher {
  id: number;
  voucher_code: string;
  amount: number;
  currency: 'DOP' | 'USD';
  status: 'active' | 'redeemed' | 'cancelled' | 'expired';
  issued_at: string;
  issued_by_user_id: string | null;
  issued_at_station_id: number | null;
  mesa_nombre: string | null;
  operador_nombre: string | null;
  redeemed_at: string | null;
  redeemed_by_user_id: string | null;
  customer_name: string | null;
  expires_at: string | null;
}

export interface Operador {
  id: number;
  codigo: string;
  nombre: string;
  pin: string;
  activo: boolean;
  mesas_asignadas: string[];
  mesa_asignada: string | null;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id: number;
  tipo_evento: string;
  voucher_code: string | null;
  user_id: string | null;
  descripcion: string | null;
  fecha: string;
  datos_adicionales: Record<string, any> | null;
  ip_address: string | null;
  user_agent: string | null;
  session_id: string | null;
  nivel_criticidad: 'BAJO' | 'MEDIO' | 'ALTO' | 'CRITICO';
  modulo: string | null;
  accion: string | null;
  resultado: 'EXITO' | 'FALLO' | 'ADVERTENCIA';
}

export interface User {
  id: string; // UUID
  email: string;
  full_name: string;
  role: 'admin' | 'mesa' | 'caja' | 'auditor';
  pin_code: string | null;
  is_active: boolean;
  station_id: number | null;
  created_at: string;
}
```

---

### Fase 4: Mejorar Sistema de Sincronización

#### Paso 4.1: Crear Función Helper para Mapeo de Estados

Crear archivo `utils/stateMapper.js`:
```javascript
/**
 * Mapea estados entre SQLite y Supabase
 */
const stateMapper = {
  // Convertir de SQLite a Supabase
  toSupabase: (estado) => {
    const map = {
      'emitido': 'active',
      'activo': 'active',
      'usado': 'redeemed',
      'canjeado': 'redeemed',
      'cancelado': 'cancelled',
      'expirado': 'expired'
    };
    return map[estado.toLowerCase()] || 'active';
  },

  // Convertir de Supabase a SQLite
  toSQLite: (status) => {
    const map = {
      'active': 'emitido',
      'redeemed': 'usado',
      'cancelled': 'cancelado',
      'expired': 'expirado'
    };
    return map[status.toLowerCase()] || 'emitido';
  }
};

module.exports = stateMapper;
```

#### Paso 4.2: Actualizar Worker de Sincronización

En [pure/main.js](pure/main.js), línea ~1955, mejorar el worker:

```javascript
// Agregar retry con exponential backoff
async function syncWithRetry(ticket, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await supabaseManager.createVoucher({
        voucher_code: ticket.code,
        amount: ticket.amount,
        currency: ticket.currency,
        issued_by_user_id: ticket.issued_by_user_id,
        issued_at_station_id: ticket.mesa_id,
        mesa_nombre: ticket.mesa,
        operador_nombre: ticket.created_by_username,
        status: stateMapper.toSupabase(ticket.estado),
        created_at: ticket.fecha_emision,
        redeemed_at: ticket.redeemed_at || null,
        redeemed_by_user_id: ticket.redeemed_by_user_id || null
      });

      if (result.success) {
        return { success: true };
      }
    } catch (error) {
      if (attempt === maxRetries - 1) {
        console.error(`❌ Falló después de ${maxRetries} intentos:`, error);
        return { success: false, error: error.message };
      }

      // Exponential backoff: 1s, 2s, 4s
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
```

#### Paso 4.3: Agregar Métricas de Sincronización

Crear archivo `pure/syncMetrics.js`:
```javascript
class SyncMetrics {
  constructor() {
    this.metrics = {
      totalSynced: 0,
      totalFailed: 0,
      lastSyncTime: null,
      averageSyncTime: 0,
      pendingCount: 0
    };
  }

  recordSuccess(duration) {
    this.metrics.totalSynced++;
    this.metrics.lastSyncTime = Date.now();
    this.updateAverageTime(duration);
  }

  recordFailure() {
    this.metrics.totalFailed++;
  }

  updatePendingCount(count) {
    this.metrics.pendingCount = count;
  }

  updateAverageTime(duration) {
    const total = this.metrics.totalSynced;
    this.metrics.averageSyncTime =
      (this.metrics.averageSyncTime * (total - 1) + duration) / total;
  }

  getMetrics() {
    return { ...this.metrics };
  }

  reset() {
    this.metrics = {
      totalSynced: 0,
      totalFailed: 0,
      lastSyncTime: null,
      averageSyncTime: 0,
      pendingCount: 0
    };
  }
}

module.exports = new SyncMetrics();
```

---

### Fase 5: Testing y Validación

#### Paso 5.1: Crear Tests de Sincronización

Crear archivo `tests/sync.test.js`:
```javascript
const { expect } = require('@jest/globals');
const Database = require('../Caja/database');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

describe('Sincronización SQLite <-> Supabase', () => {
  let db;
  let supabase;

  beforeAll(() => {
    db = new Database(':memory:');
    supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  });

  test('Crear ticket en SQLite y sincronizar a Supabase', async () => {
    // Crear ticket local
    const ticket = db.createTicket({
      amount: 100.00,
      currency: 'DOP',
      mesa: 'P01'
    });

    expect(ticket.ticket_number).toBeDefined();

    // Sincronizar a Supabase
    const { data, error } = await supabase
      .from('vouchers')
      .insert({
        voucher_code: ticket.ticket_number,
        amount: 100.00,
        currency: 'DOP',
        mesa_nombre: 'P01',
        status: 'active'
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(data.voucher_code).toBe(ticket.ticket_number);
  });

  afterAll(() => {
    db.close();
  });
});
```

#### Paso 5.2: Ejecutar Tests
```bash
npm test tests/sync.test.js
```

---

## 📊 Checklist de Verificación

### ✅ Antes de Producción

- [ ] Migración SQL ejecutada en Supabase
- [ ] Tabla `audit_logs` creada y funcionando
- [ ] Operadores sincronizados con códigos y PINs
- [ ] TypeScript types generados
- [ ] Worker de sincronización con retry implementado
- [ ] Métricas de sincronización funcionando
- [ ] Tests de sincronización pasando
- [ ] Documentación actualizada

### ✅ Validación Funcional

- [ ] Crear voucher desde Mesa sincroniza a Supabase
- [ ] Canjear voucher actualiza ambas DBs
- [ ] Logs de auditoría se registran correctamente
- [ ] Estadísticas del día muestran datos correctos
- [ ] Sincronización offline → online funciona
- [ ] Interfaz muestra estado de sincronización

---

## 🚀 Comandos Rápidos

### Desarrollo
```bash
# Iniciar aplicación en modo Pure
npm start

# Ejecutar tests
npm test

# Ver logs de sincronización
# (En la aplicación, presionar F12 para consola)
```

### Base de Datos
```bash
# Conectar a SQLite local
sqlite3 data/casino.db

# Ver tickets pendientes de sincronización
SELECT COUNT(*) FROM tickets WHERE sincronizado = 0;

# Ver logs de auditoría
SELECT * FROM auditoria ORDER BY fecha DESC LIMIT 10;
```

### Supabase
```bash
# Abrir dashboard
https://supabase.com/dashboard/project/elagvnnamabrjptovzyq

# Ejecutar SQL
https://supabase.com/dashboard/project/elagvnnamabrjptovzyq/editor/sql

# Ver tablas
https://supabase.com/dashboard/project/elagvnnamabrjptovzyq/editor
```

---

## 📞 Soporte y Comandos MCP

### Comandos Disponibles

```bash
# Sincronizar esquemas
/supabase-schema-sync --diff      # Ver diferencias
/supabase-schema-sync --pull      # Descargar esquema
/supabase-schema-sync --push      # Subir cambios
/supabase-schema-sync --validate  # Validar consistencia

# Asistente de migraciones
/supabase-migration-assistant --create    # Crear migración
/supabase-migration-assistant --alter     # Alterar esquema
/supabase-migration-assistant --rollback  # Revertir cambios
```

### Queries Útiles via MCP

El MCP de Supabase permite ejecutar queries directamente:
- Ver estado de sincronización
- Analizar performance
- Debugging en tiempo real
- Explorar esquemas

---

## 🎯 Prioridades

### Alta Prioridad (Hacer Ahora)
1. ⚠️ Ejecutar migración SQL en Supabase
2. ⚠️ Sincronizar operadores
3. ⚠️ Verificar que audit_logs funciona

### Media Prioridad (Esta Semana)
4. Generar TypeScript types
5. Mejorar worker con retry
6. Implementar métricas

### Baja Prioridad (Cuando Sea Posible)
7. Crear tests automatizados
8. Optimizar rendimiento
9. Documentación adicional

---

## 📝 Notas Importantes

- **Backup:** Siempre hacer backup antes de migraciones
- **Testing:** Probar en desarrollo antes de producción
- **Monitoreo:** Revisar logs de sincronización regularmente
- **Seguridad:** No compartir SERVICE_ROLE_KEY

---

## ✨ Resultado Esperado

Después de completar estos pasos, tendrás:

✅ Esquemas sincronizados entre SQLite y Supabase
✅ Sistema de auditoría centralizado funcionando
✅ Operadores con códigos y PINs configurados
✅ TypeScript types para mejor desarrollo
✅ Sincronización robusta con retry automático
✅ Métricas y monitoreo de sincronización
✅ Sistema listo para producción

---

**¿Necesitas ayuda?** Usa los comandos `/supabase-*` o consulta [SCHEMA_ANALYSIS.md](SCHEMA_ANALYSIS.md)
