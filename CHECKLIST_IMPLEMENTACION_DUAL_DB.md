# CHECKLIST: Implementación Arquitectura Dual DB (Opción D)

## ESTADO GENERAL: 85% → 100%

```
███████████████████░░░ 85% Actual
████████████████████ 100% Después de tareas
```

---

## FASE 1: AUDITORÍA INICIAL (COMPLETADO ✅)

- [x] Revisar código de escritura (generate-ticket)
- [x] Revisar código de lectura (get-stats-today)
- [x] Revisar worker de sincronización
- [x] Verificar esquema de BD (tabla tickets)
- [x] Identificar gaps vs arquitectura deseada
- [x] Crear plan de implementación

**Resultado**: 3 documentos creados
- `ANALISIS_VIABILIDAD_DUAL_DB_ARQUITECTURA.md` (completo)
- `RESUMEN_ARQUITECTURA_DUAL_DB.md` (ejecutivo)
- `CODIGO_TAREA_1_DESCARGA_PERIODICA.md` (código listo)

---

## FASE 2: IMPLEMENTACIÓN CRÍTICA (4 HORAS)

### Tarea 1: Descarga Periódica (PRIORIDAD ALTA)

**Tiempo estimado**: 2 horas
**Estado**: [ ] Pendiente

#### Subtareas:
- [ ] Abrir `c:\appCasino\pure\main.js`
- [ ] Localizar línea 4737 (después de sync de tickets pendientes)
- [ ] Copiar código de `CODIGO_TAREA_1_DESCARGA_PERIODICA.md`
- [ ] Pegar código en la ubicación correcta
- [ ] Verificar indentación
- [ ] Guardar archivo
- [ ] Verificar sintaxis: `node -c pure\main.js`

#### Verificación:
- [ ] Reiniciar app: `npm start`
- [ ] Buscar en logs: "🔄 [Sync Worker] Iniciando descarga de tickets desde Supabase..."
- [ ] Crear ticket en PC A
- [ ] Esperar 2 minutos
- [ ] Verificar ticket aparece en PC B
- [ ] Revisar logs: "✅ [Sync Worker - Descarga] X nuevos, Y actualizados"

**Criterio de éxito**: Ticket creado en PC A aparece en PC B después de 2 minutos.

---

### Tarea 2: Unificar Nombres de Columnas (PRIORIDAD MEDIA)

**Tiempo estimado**: 1 hora
**Estado**: [ ] Pendiente

#### Opción A: Cambiar queries (RECOMENDADO)

- [ ] Buscar en `pure/main.js`: `WHERE DATE(created_at)`
- [ ] Reemplazar por: `WHERE DATE(fecha_emision)`
- [ ] Buscar todas las ocurrencias (puede haber más)
- [ ] Guardar y verificar sintaxis

**Archivos a revisar**:
```bash
grep -n "created_at" "c:\appCasino\pure\main.js" | head -20
# Reemplazar cada ocurrencia en contexto de fecha
```

#### Opción B: Agregar columna alias (ALTERNATIVA)

- [ ] Abrir `c:\appCasino\Caja\database.js`
- [ ] En método `initDatabase()` después de línea 104 agregar:
  ```javascript
  // Agregar columna created_at como alias de fecha_emision
  try {
    const cols = this.db.prepare("PRAGMA table_info('tickets')").all().map(c => c.name);
    if (!cols.includes('created_at')) {
      this.db.exec('ALTER TABLE tickets ADD COLUMN created_at DATETIME');
      this.db.exec('UPDATE tickets SET created_at = fecha_emision WHERE created_at IS NULL');
      console.log('✅ Columna created_at agregada como alias');
    }
  } catch (e) {
    console.warn('⚠️ No se pudo agregar columna created_at:', e.message);
  }
  ```

#### Verificación:
- [ ] Reiniciar app
- [ ] Abrir Caja
- [ ] Verificar estadísticas cargan sin errores
- [ ] Revisar logs: sin errores "no such column"

**Criterio de éxito**: No hay errores de columnas faltantes en logs.

---

### Tarea 3: Testing Completo (PRIORIDAD ALTA)

**Tiempo estimado**: 1 hora
**Estado**: [ ] Pendiente

#### Test 1: Crear ticket CON INTERNET
- [ ] Verificar WiFi conectado
- [ ] Abrir Mesa (P01)
- [ ] Crear ticket: $100 USD
- [ ] Buscar en logs: "✅ Ticket guardado en Supabase"
- [ ] Buscar en logs: "sincronizado: SI"
- [ ] Verificar en SQLite:
  ```bash
  node -e "const db = require('./Caja/database.js'); const d = new db(); console.log(d.db.prepare('SELECT code, sincronizado FROM tickets ORDER BY id DESC LIMIT 1').get()); d.close();"
  # Esperado: { code: 'PREV-XXXXXX', sincronizado: 1 }
  ```
- [ ] Verificar en Supabase Dashboard → vouchers table

**Resultado**: [ ] PASS / [ ] FAIL

---

#### Test 2: Crear ticket SIN INTERNET
- [ ] Desconectar WiFi/Ethernet
- [ ] Abrir Mesa (P01)
- [ ] Crear ticket: $50 DOP
- [ ] Buscar en logs: "⚠️ Supabase no disponible, modo offline"
- [ ] Buscar en logs: "sincronizado: NO"
- [ ] Verificar en SQLite:
  ```bash
  node -e "const db = require('./Caja/database.js'); const d = new db(); console.log(d.db.prepare('SELECT code, sincronizado FROM tickets ORDER BY id DESC LIMIT 1').get()); d.close();"
  # Esperado: { code: 'PREV-XXXXXX', sincronizado: 0 }
  ```
- [ ] Reconectar WiFi
- [ ] Esperar 2 minutos
- [ ] Buscar en logs: "✅ [Sync Worker] Ticket PREV-XXXXXX sincronizado"
- [ ] Verificar en SQLite: `sincronizado: 1`
- [ ] Verificar en Supabase: voucher existe

**Resultado**: [ ] PASS / [ ] FAIL

---

#### Test 3: Lectura rápida desde Caja
- [ ] Crear 10 tickets de prueba
- [ ] Abrir Caja (panel.html)
- [ ] Abrir DevTools → Console
- [ ] Ejecutar:
  ```javascript
  console.time('carga-stats');
  await window.electron.getStatsToday();
  console.timeEnd('carga-stats');
  // Esperado: < 100ms
  ```
- [ ] Verificar estadísticas visibles sin delay
- [ ] Buscar en logs: NO debe haber "Error obteniendo estadísticas"

**Resultado**: [ ] PASS (< 100ms) / [ ] FAIL (> 100ms)

---

#### Test 4: Sincronización entre PCs (REQUIERE TAREA 1)
- [ ] **PC A**: Crear ticket: $200 USD
- [ ] Anotar código del ticket: `PREV-______`
- [ ] **PC B**: Abrir Caja
- [ ] **PC B**: Esperar 2 minutos
- [ ] **PC B**: Refrescar o reabrir Caja
- [ ] **PC B**: Buscar ticket en lista
- [ ] **PC B**: Verificar en SQLite:
  ```bash
  node -e "const db = require('./Caja/database.js'); const d = new db(); console.log(d.db.prepare('SELECT * FROM tickets WHERE code = \"PREV-XXXXXX\"').get()); d.close();"
  # Esperado: ticket existe con datos correctos
  ```

**Resultado**: [ ] PASS / [ ] FAIL

---

#### Test 5: Canjear ticket y sincronizar estado
- [ ] **PC A (Mesa)**: Crear ticket: $100 USD
- [ ] Anotar código: `PREV-______`
- [ ] **PC B (Caja)**: Abrir Caja
- [ ] **PC B**: Validar código del ticket
- [ ] **PC B**: Canjear ticket
- [ ] Buscar en logs: "✅ Voucher canjeado en SQLite"
- [ ] Verificar en SQLite:
  ```bash
  node -e "const db = require('./Caja/database.js'); const d = new db(); console.log(d.db.prepare('SELECT estado, sincronizado FROM tickets WHERE code = \"PREV-XXXXXX\"').get()); d.close();"
  # Esperado: { estado: 'usado', sincronizado: 1 }
  ```
- [ ] Verificar en Supabase Dashboard: status = 'redeemed'

**Resultado**: [ ] PASS / [ ] FAIL

---

## FASE 3: OPTIMIZACIONES (2 HORAS - OPCIONAL)

### Tarea 4: Sincronización Manual Bidireccional

**Tiempo estimado**: 1 hora
**Estado**: [ ] Pendiente

- [ ] Abrir `pure/main.js` línea 3437
- [ ] Agregar bloque de descarga después de subida
- [ ] Copiar código similar a Tarea 1
- [ ] Actualizar mensaje de retorno:
  ```javascript
  return {
    success: true,
    message: `Sincronización completada: ${successCount} subidos, ${downloadedCount} descargados`,
    synced: successCount,
    downloaded: downloadedCount,
    failed: errorCount
  };
  ```

**Verificación**:
- [ ] Ejecutar sincronización manual desde UI
- [ ] Verificar logs: muestra subidos Y descargados

---

### Tarea 5: Agregar Índice de Optimización

**Tiempo estimado**: 30 minutos
**Estado**: [ ] Pendiente

- [ ] Abrir `Caja/database.js` línea 104
- [ ] Agregar después de índices existentes:
  ```javascript
  this.db.exec(`
    CREATE INDEX IF NOT EXISTS idx_ticket_sincronizado ON tickets(sincronizado, fecha_emision);
  `);
  ```
- [ ] Reiniciar app
- [ ] Verificar índice creado:
  ```bash
  node -e "const db = require('./Caja/database.js'); const d = new db(); console.log(d.db.prepare('SELECT * FROM sqlite_master WHERE type=\"index\" AND name=\"idx_ticket_sincronizado\"').get()); d.close();"
  ```

**Verificación**:
- [ ] Índice existe
- [ ] Performance de sincronización mejorada (usar `EXPLAIN QUERY PLAN`)

---

### Tarea 6: Backup Automático Diario

**Tiempo estimado**: 30 minutos
**Estado**: [ ] Pendiente

- [ ] Abrir `pure/main.js` después de inicialización de DB
- [ ] Agregar:
  ```javascript
  // Backup automático diario
  setInterval(() => {
    try {
      if (db && typeof db.backup === 'function') {
        const backupPath = db.backup();
        console.log('✅ Backup automático creado:', backupPath);

        // Opcional: Limpiar backups antiguos (> 7 días)
        // ... código de limpieza ...
      }
    } catch (error) {
      console.error('❌ Error en backup automático:', error.message);
    }
  }, 24 * 60 * 60 * 1000); // Cada 24 horas

  // Ejecutar backup inmediatamente al iniciar
  setTimeout(() => {
    try {
      if (db && typeof db.backup === 'function') {
        const backupPath = db.backup();
        console.log('✅ Backup inicial creado:', backupPath);
      }
    } catch (error) {
      console.error('❌ Error en backup inicial:', error.message);
    }
  }, 5000); // 5 segundos después de iniciar
  ```

**Verificación**:
- [ ] Reiniciar app
- [ ] Esperar 5 segundos
- [ ] Verificar log: "✅ Backup inicial creado"
- [ ] Verificar archivo en `Caja/backups/casino_backup_*.db`

---

## FASE 4: DOCUMENTACIÓN Y CIERRE

### Documentación

- [ ] Actualizar README.md con nueva arquitectura
- [ ] Documentar handlers de sincronización
- [ ] Agregar ejemplos de uso
- [ ] Actualizar diagramas

### Commit y Backup

- [ ] Hacer commit de cambios:
  ```bash
  git add .
  git commit -m "feat: Arquitectura Dual DB completa - Sincronización bidireccional

  - Implementada descarga periódica Supabase → SQLite
  - Unificados nombres de columnas
  - Agregados índices de optimización
  - Backup automático diario
  - Tests completos pasados

  Arquitectura Opción D: 100% implementada"
  ```

- [ ] Crear tag de versión:
  ```bash
  git tag -a v1.0.0-dual-db -m "Arquitectura Dual DB completa"
  git push origin main --tags
  ```

---

## RESUMEN DE PROGRESO

### Componentes
- [x] Escritura CON internet (IMPLEMENTADO)
- [x] Escritura SIN internet (IMPLEMENTADO)
- [x] Lectura desde SQLite (IMPLEMENTADO)
- [x] Sincronización SUBIDA (IMPLEMENTADO)
- [ ] Sincronización DESCARGA (PENDIENTE - Tarea 1) ← **CRÍTICO**
- [ ] Nombres unificados (PENDIENTE - Tarea 2) ← **IMPORTANTE**
- [ ] Tests completos (PENDIENTE - Tarea 3) ← **IMPORTANTE**
- [ ] Optimizaciones (PENDIENTE - Tareas 4-6) ← Opcional

### Tiempo Total
- **Crítico (Tareas 1-3)**: 4 horas
- **Opcional (Tareas 4-6)**: 2 horas
- **Total**: 6 horas

### Próximo Paso Inmediato
1. Implementar Tarea 1 (Descarga periódica)
2. Ejecutar Test 4 (sincronización entre PCs)
3. Si pasa: Continuar con Tarea 2
4. Si falla: Debug y corregir

---

## REFERENCIAS

- **Análisis completo**: `ANALISIS_VIABILIDAD_DUAL_DB_ARQUITECTURA.md`
- **Resumen ejecutivo**: `RESUMEN_ARQUITECTURA_DUAL_DB.md`
- **Código Tarea 1**: `CODIGO_TAREA_1_DESCARGA_PERIODICA.md`
- **Commit base**: d2182fd

---

**Fecha inicio**: 2025-11-07
**Fecha objetivo**: 2025-11-08
**Estado**: 🟡 EN PROGRESO (85% completado)

---

## NOTAS ADICIONALES

### Problemas Conocidos
- Ninguno crítico detectado
- Warning: Inconsistencia de columnas (se resolverá en Tarea 2)

### Decisiones de Diseño
- **Sincronización cada 2 minutos**: Balance entre actualización y carga
- **Lotes de 100 tickets**: Evita saturación de Supabase
- **SQLite como caché**: Lectura rápida sin esperar cloud
- **Supabase como fuente de verdad**: Sincronización autoritativa

### Contactos
- **Desarrollador**: [Tu nombre]
- **Revisión de código**: [Revisor]
- **Testing**: [Tester]

---

**Última actualización**: 2025-11-07
**Próxima revisión**: Después de completar Tarea 1
