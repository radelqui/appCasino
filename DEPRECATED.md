# CÓDIGO DEPRECATED Y OBSOLETO
**Sistema TITO - Casino QR Voucher**

Este documento lista archivos, módulos y código obsoleto que ya no se usa en producción pero se mantiene por razones históricas o de referencia.

---

## CRITERIOS DE DEPRECACIÓN

Un archivo/módulo se considera **deprecated** si:
1. No se usa en la versión Pure (producción actual)
2. Fue reemplazado por una implementación mejor
3. Corresponde a arquitectura antigua (pre-refactor)
4. Solo existe como backup/referencia histórica

---

## ARCHIVOS BACKUP (ELIMINABLES)

### 1. Backups de pure/main.js

| Archivo | Fecha | Tamaño | Razón | Acción |
|---------|-------|--------|-------|--------|
| `pure/main.js.BACKUP_1761663208` | 28 Oct 2024 | 6.6 KB | Backup antes de implementar Supabase | ✅ Eliminar |
| `pure/main.js.BACKUP_SUPABASE_INTEGRATION` | 29 Oct 2024 | 20 KB | Backup durante integración Supabase | ✅ Eliminar |
| `pure/main.js.BACKUP_BEFORE_REFACTOR_1761843712` | 30 Oct 2024 | 75 KB | Backup antes de refactorizar workers | ⚠️ MANTENER (última versión estable antes de cambios grandes) |
| `pure/main.js.BEFORE_SYNC_WORKER_FIX` | 30 Oct 2024 | 74 KB | Backup antes de fix de worker sync | ✅ Eliminar |

**Recomendación:**
- Mantener solo `main.js.BACKUP_BEFORE_REFACTOR_1761843712` como punto de restauración
- Eliminar los demás backups (ya commitados en Git)

---

### 2. Backups de HTML

| Archivo | Fecha | Tamaño | Razón | Acción |
|---------|-------|--------|-------|--------|
| `pure/auditor.html.BACKUP_BEFORE_AUDIT_MODULE` | 29 Oct 2024 | 2.3 KB | Antes de módulo auditoría completo | ✅ Eliminar |
| `pure/mesa.html.BACKUP_1761666364` | 28 Oct 2024 | 10 KB | Backup antes de agregar operadores | ✅ Eliminar |
| `Caja/panel.html.BROKEN_1761668910` | 28 Oct 2024 | - | Versión rota, guardada para debug | ✅ Eliminar |

**Recomendación:** Eliminar todos (Git tiene historial completo)

---

### 3. Backups de IPC Handlers

| Archivo | Fecha | Tamaño | Razón | Acción |
|---------|-------|--------|-------|--------|
| `src/main/ipc/index.js.BACKUP` | - | - | Backup de handlers antiguos | ✅ Eliminar |
| `src/main/ipc/index.js.BACKUP_SUPABASE_INTEGRATION` | 29 Oct 2024 | - | Antes de Supabase | ✅ Eliminar |
| `src/main/ipc/printerHandlers.js.BACKUP_1761666364` | 28 Oct 2024 | - | Backup de printer handlers | ✅ Eliminar |

**Recomendación:** Eliminar todos

---

## CÓDIGO LEGACY (NO USADO EN PRODUCCIÓN)

### 1. Versión React (src/renderer/)

**Estado:** 🔴 **DEPRECATED** (No usado en Pure)

**Ubicación:** `src/renderer/`

**Descripción:**
- Interfaz React original del proyecto
- Incluye componentes de Mesa, Caja, Auditoría
- Requiere `npm run react-build` y React DevServer

**Por qué se deprecó:**
- Versión Pure (HTML vanilla) es más rápida y simple
- React agrega overhead innecesario para UIs simples
- Build más grande (~150 MB vs ~50 MB)
- Complejidad de debugging

**Estado actual:**
- ✅ Código funcional (puede ejecutarse con `npm run electron-dev`)
- ⚠️ No se mantiene activamente
- ❌ No se usa en builds de producción

**Acción recomendada:**
- ⚠️ **MANTENER** por ahora (puede ser útil para UIs complejas futuras)
- 📦 Mover a carpeta `legacy/renderer/` en el futuro
- 📝 Documentar como referencia

**Archivos principales:**
```
src/renderer/
├── index.js
├── App.jsx
├── views/
│   ├── Mesa/
│   │   ├── MesaView.jsx
│   │   └── TicketGenerator.jsx
│   ├── Caja/
│   │   ├── CajaView.jsx
│   │   └── TicketValidator.jsx
│   └── Auditoria/
│       └── AuditoriaView.jsx
└── components/
    └── TicketPreview/
        ├── TicketPreview.jsx
        └── TicketPreview.css
```

---

### 2. Main.js Original (Electron_Puro/)

**Estado:** 🔴 **DEPRECATED**

**Ubicación:** `Electron_Puro/main.js`

**Descripción:**
- Entry point original antes de refactorización a `pure/`
- Lógica similar pero menos organizada
- Sin Supabase, sin Health Monitor

**Por qué se deprecó:**
- Reemplazado por `pure/main.js` (versión mejorada)
- Faltaban features críticas (sincronización, health monitor)
- Código no modularizado

**Acción recomendada:** ✅ **ELIMINAR** (completamente reemplazado)

---

### 3. Scripts Python de Análisis

**Estado:** 🟡 **DEPRECATED** (Útiles para debug histórico)

**Ubicación:** Raíz del proyecto

**Archivos:**
```
script.py
script_1.py
script_2.py
...
script_19.py
```

**Descripción:**
- Scripts de análisis y migración de datos
- Generados durante desarrollo inicial
- Algunos para inspeccionar BD, otros para migrar datos

**Por qué se deprecaron:**
- Tareas completadas (migraciones ya ejecutadas)
- Reemplazados por scripts JS en `scripts/`

**Acción recomendada:**
- ✅ **ELIMINAR** scripts_1 a script_19 (tareas one-time completadas)
- ⚠️ **REVISAR** script.py por si tiene lógica reutilizable
- 📦 Mover scripts útiles a `scripts/legacy/`

---

### 4. Archivos de Configuración Obsoletos

#### a) index.html (Raíz)

**Estado:** 🔴 **DEPRECATED**

**Ubicación:** `/index.html`

**Descripción:**
- HTML principal para versión React
- No se usa en versión Pure

**Acción recomendada:**
- ⚠️ **MANTENER** (requerido por scripts React)
- Renombrar a `index.react.html` para claridad

#### b) main.js (Raíz)

**Estado:** 🟡 **POSIBLE DUPLICATE**

**Ubicación:** `/main.js`

**Descripción:**
- Entry point alternativo
- Puede ser copia de `Electron_Puro/main.js`

**Acción recomendada:**
- ✅ Verificar si es duplicate
- ✅ Eliminar si es idéntico a `pure/main.js`

#### c) preload.js (Raíz)

**Estado:** 🟡 **LEGACY**

**Ubicación:** `/preload.js`

**Descripción:**
- Preload script para versión antigua
- Reemplazado por `src/main/preload.js`

**Acción recomendada:** ⚠️ Verificar si se usa

---

### 5. Archivos de Texto de Planificación

**Estado:** 🟢 **HISTÓRICO** (Mantener como documentación)

**Archivos:**
```
planmaestro.txt          - Plan maestro original del proyecto
chat241025.txt           - Log de conversación de desarrollo
Diseño Ticket/plan diseño.txt - Diseño original del ticket
```

**Acción recomendada:**
- ⚠️ **MANTENER** como documentación histórica
- 📦 Mover a `docs/legacy/`

---

### 6. Archivos de Testing Legacy

#### a) casinoAdapter.test.js

**Estado:** 🔴 **DEPRECATED**

**Descripción:**
- Tests para adaptador que ya no existe
- Reemplazado por tests en `tests/`

**Acción recomendada:** ✅ **ELIMINAR**

#### b) main-flow.test.js

**Estado:** 🟡 **LEGACY**

**Descripción:**
- Tests del flujo principal
- Puede tener valor como referencia

**Acción recomendada:** ⚠️ Revisar y actualizar o eliminar

#### c) sqlite.test.js

**Estado:** 🟡 **LEGACY**

**Descripción:**
- Tests de SQLite
- Reemplazado por `tests/database.test.js`

**Acción recomendada:** ✅ **ELIMINAR** si duplicate

---

### 7. Scripts de Migración One-Time

**Ubicación:** Raíz del proyecto

**Archivos:**
```
activate-user.js
check-all-auth.js
check-auth-users.js
check-bd-structure.js
check-db-columns.js
check-sqlite-structure.js
confirm-user.js
create-admin-user.js
create-test-admin.js
debug-electron-load.js
debug-user.js
generate-users-sql.js
reset-admin-casino.js
reset-password-central.js
test-manual-login.js
test-login.js
```

**Descripción:**
- Scripts one-time para migración y setup inicial
- Usados durante desarrollo
- Ya no necesarios en producción

**Acción recomendada:**
- 📦 Mover a `scripts/setup/` (mantener por si se necesita reinstalar)
- 📝 Documentar cuáles se usaron y para qué

---

### 8. SqulInstrucciones/ (Parcialmente Obsoleto)

**Ubicación:** `SqulInstrucciones/`

**Archivos Obsoletos:**
```
SqulInstrucciones/database.js           - Versión antigua de database.js
SqulInstrucciones/supabaseManager.js    - Versión antigua de supabaseManager.js
SqulInstrucciones/user.txt              - Notas de desarrollo
SqulInstrucciones/SOLICITUD_ESTADO_REAL.md
SqulInstrucciones/ESTADO_ACTUAL_Y_PROXIMOS_PASOS.md
SqulInstrucciones/SOLUCION_BETTER_SQLITE3.md
```

**Archivos Activos:**
```
SqulInstrucciones/migration-sync-schemas.sql  - ✅ ACTIVO (migración Supabase)
SqulInstrucciones/minimal-migration.sql       - ✅ ÚTIL
SqulInstrucciones/optimized-migration.sql     - ✅ ÚTIL
SqulInstrucciones/quick-fixes.sql             - ✅ ÚTIL
SqulInstrucciones/networkDiscovery.js         - ⚠️ FUTURO (por integrar)
```

**Acción recomendada:**
- ✅ Eliminar `database.js` y `supabaseManager.js` (duplicates obsoletos)
- ✅ Eliminar archivos `.md` de estado (info ya en otros docs)
- ⚠️ Mantener SQL scripts (útiles para mantenimiento)
- ⚠️ Mantener `networkDiscovery.js` (feature futura)

---

### 9. Archivos de Configuración de Usuario

**Archivos:**
```
usuarios.sql                    - SQL de creación de usuarios (one-time)
generate-users-sql.js           - Script que generó usuarios.sql
```

**Acción recomendada:**
- ✅ Eliminar `usuarios.sql` (usuarios ya creados)
- 📦 Mover `generate-users-sql.js` a `scripts/setup/`

---

## DEPENDENCIAS DEPRECATED

### NPM Packages No Usados

Revisar `package.json` para posibles dependencias no utilizadas:

```json
// Posiblemente no usados en Pure:
"react": "^18.2.0",              // Solo si se elimina versión React
"react-dom": "^18.2.0",           // Solo si se elimina versión React
"react-router-dom": "^6.26.0",    // Solo si se elimina versión React
"react-scripts": "5.0.1",         // Solo si se elimina versión React
"concurrently": "^8.2.2",         // Solo para dev React
"wait-on": "^7.0.1"               // Solo para dev React
```

**Acción recomendada:**
- ⚠️ **MANTENER** por ahora (versión React puede ser útil)
- Si se decide eliminar React completamente: `npm uninstall react react-dom react-router-dom react-scripts concurrently wait-on`

---

## VARIABLES DE ENTORNO DEPRECATED

**Archivo:** `.env`

### Variables No Usadas

```bash
# DEPRECATED - No usadas en producción Pure
REACT_APP_*                    # Variables React (solo si se elimina React)
DEFAULT_USER_ID               # Hardcoded, no configurable realmente
```

---

## PATRONES DE CÓDIGO DEPRECATED

### 1. Callbacks en lugar de Async/Await

**Ubicación:** Algunos archivos legacy

**Patrón Viejo:**
```javascript
db.createTicket(data, (err, result) => {
  if (err) {
    console.error(err);
  } else {
    console.log(result);
  }
});
```

**Patrón Nuevo (Recomendado):**
```javascript
try {
  const result = await db.createTicket(data);
  console.log(result);
} catch (err) {
  console.error(err);
}
```

**Acción:** Refactorizar callbacks a async/await donde sea posible

---

### 2. Acceso Directo a DB sin Health Monitor

**Patrón Viejo:**
```javascript
const ticket = db.createTicket(data);
```

**Patrón Nuevo (Recomendado):**
```javascript
const endOp = healthMonitor.startOperation('create_ticket', 5000);
try {
  const ticket = db.createTicket(data);
  endOp();
} catch (e) {
  endOp();
  throw e;
}
```

**Acción:** Envolver operaciones críticas con Health Monitor

---

### 3. Estado Hardcoded en lugar de Mapper

**Patrón Viejo:**
```javascript
status: ticket.estado === 'emitido' ? 'active' : 'redeemed'
```

**Patrón Nuevo (Recomendado):**
```javascript
status: stateMapper.toSupabase(ticket.estado)
```

**Acción:** Usar `utils/stateMapper.js` para conversiones

---

## GUÍA DE LIMPIEZA

### Paso 1: Backups Seguros
```bash
# Hacer backup completo antes de eliminar
git commit -am "backup: antes de limpieza de deprecated"
git tag backup-before-cleanup
```

### Paso 2: Eliminar Archivos Backup
```bash
# Eliminar backups de main.js (excepto BACKUP_BEFORE_REFACTOR)
rm pure/main.js.BACKUP_1761663208
rm pure/main.js.BACKUP_SUPABASE_INTEGRATION
rm pure/main.js.BEFORE_SYNC_WORKER_FIX

# Eliminar backups de HTML
rm pure/auditor.html.BACKUP_BEFORE_AUDIT_MODULE
rm pure/mesa.html.BACKUP_1761666364
rm Caja/panel.html.BROKEN_1761668910

# Eliminar backups de IPC
rm src/main/ipc/index.js.BACKUP
rm src/main/ipc/index.js.BACKUP_SUPABASE_INTEGRATION
rm src/main/ipc/printerHandlers.js.BACKUP_1761666364
```

### Paso 3: Eliminar Scripts Python One-Time
```bash
rm script_*.py  # Todos los scripts numerados
# Revisar script.py individualmente antes de eliminar
```

### Paso 4: Reorganizar Legacy
```bash
# Crear carpeta legacy
mkdir -p legacy/

# Mover versión React
mv src/renderer legacy/

# Mover scripts de setup
mkdir -p scripts/setup
mv create-admin-user.js scripts/setup/
mv create-test-admin.js scripts/setup/
mv generate-users-sql.js scripts/setup/
# ... etc
```

### Paso 5: Limpiar SqulInstrucciones
```bash
cd SqulInstrucciones/

# Eliminar duplicates
rm database.js
rm supabaseManager.js

# Eliminar docs de estado obsoletos
rm SOLICITUD_ESTADO_REAL.md
rm ESTADO_ACTUAL_Y_PROXIMOS_PASOS.md
rm SOLUCION_BETTER_SQLITE3.md
rm user.txt
```

### Paso 6: Commit Limpieza
```bash
git add .
git commit -m "chore: limpiar archivos deprecated y backups obsoletos"
```

---

## ARCHIVOS A MANTENER (No Eliminar)

### Código Activo
- ✅ `pure/main.js` - **PRODUCCIÓN**
- ✅ `pure/supabaseManager.js` - **PRODUCCIÓN**
- ✅ `pure/healthMonitor.js` - **PRODUCCIÓN**
- ✅ `pure/safeOperations.js` - **PRODUCCIÓN**
- ✅ `pure/*.html` - **PRODUCCIÓN**
- ✅ `Caja/database.js` - **PRODUCCIÓN**
- ✅ `shared/ticket-service.js` - **PRODUCCIÓN**
- ✅ `src/main/` - **PRODUCCIÓN** (usado por Pure)

### Legacy Útil
- ⚠️ `src/renderer/` - Legacy React (puede ser útil futuro)
- ⚠️ `pure/main.js.BACKUP_BEFORE_REFACTOR_1761843712` - Punto de restauración

### Documentación
- ✅ `README.md`
- ✅ `ARQUITECTURA.md`
- ✅ `MODULOS_FALTANTES.md`
- ✅ `DEPRECATED.md` (este archivo)
- ✅ `planmaestro.txt` (histórico)

### Scripts SQL Útiles
- ✅ `SqulInstrucciones/migration-sync-schemas.sql`
- ✅ `SqulInstrucciones/*.sql` (migraciones)
- ✅ `SqulInstrucciones/networkDiscovery.js` (feature futura)

---

## RESUMEN DE ACCIONES RECOMENDADAS

| Categoría | Acción | Archivos Afectados | Tiempo |
|-----------|--------|-------------------|--------|
| Backups obsoletos | ✅ Eliminar | ~10 archivos .BACKUP | 5 min |
| Scripts Python | ✅ Eliminar | script_*.py | 2 min |
| Scripts JS setup | 📦 Mover a scripts/setup/ | ~15 archivos | 10 min |
| SqulInstrucciones | 🧹 Limpiar duplicates | 5 archivos | 5 min |
| Versión React | ⚠️ Mantener en legacy/ | src/renderer/ | 15 min |
| Tests legacy | ✅ Eliminar duplicates | 3-5 archivos | 5 min |
| **TOTAL** | | ~40 archivos | **~45 min** |

**Ganancia esperada:**
- Reducción de ~50 MB de archivos obsoletos
- Mayor claridad en estructura de proyecto
- Menos confusión para nuevos desarrolladores

---

## CHECKLIST DE LIMPIEZA

```bash
# Antes de empezar
[ ] Hacer backup en Git: git commit + git tag backup-before-cleanup
[ ] Crear branch de limpieza: git checkout -b cleanup/deprecated-files

# Eliminar archivos backup
[ ] Eliminar main.js backups (excepto BACKUP_BEFORE_REFACTOR)
[ ] Eliminar HTML backups
[ ] Eliminar IPC backups

# Eliminar scripts one-time
[ ] Eliminar script_*.py
[ ] Mover scripts setup a scripts/setup/

# Limpiar SqulInstrucciones
[ ] Eliminar database.js y supabaseManager.js (duplicates)
[ ] Eliminar .md obsoletos

# Reorganizar legacy
[ ] Crear carpeta legacy/
[ ] Mover src/renderer/ a legacy/renderer/

# Commit y merge
[ ] git add .
[ ] git commit -m "chore: cleanup deprecated files"
[ ] git checkout main
[ ] git merge cleanup/deprecated-files
[ ] git branch -d cleanup/deprecated-files
```

---

**Última actualización:** 31 de Octubre de 2025
**Versión:** 1.0.0
**Mantenedor:** Sistema TITO - Casino QR Voucher
