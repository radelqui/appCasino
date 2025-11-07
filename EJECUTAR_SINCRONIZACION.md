# EJECUTAR SINCRONIZACIÓN MASIVA DE TICKETS

## 📋 RESUMEN

Se ha creado un sistema de sincronización masiva de tickets pendientes que migra todos los tickets de SQLite local a Supabase cloud.

---

## 🎯 ARCHIVOS CREADOS/MODIFICADOS

### 1. **pure/main.js** (MODIFICADO)
- Líneas 582-698: Handler `sync-all-pending` agregado
- Líneas 293-296: Case `sync-utility` en switch

### 2. **pure/sync-utility.html** (NUEVO)
Interfaz gráfica para ejecutar la sincronización con:
- Botón de inicio
- Barra de progreso
- Resumen de resultados
- Manejo de errores

### 3. **scripts/sync-all-pending.js** (CREADO pero NO funcional)
Script standalone que no puede ejecutarse debido a:
- Conflicto de versión de Node.js con better-sqlite3
- Archivo .node bloqueado por procesos Electron

---

## 🚀 CÓMO EJECUTAR LA SINCRONIZACIÓN

### **MÉTODO 1: Usando la Interfaz Gráfica (RECOMENDADO)**

#### Paso 1: Iniciar la aplicación
```bash
cd C:\appCasino
npm start
```

#### Paso 2: Abrir Developer Tools
- Presionar `F12` o `Ctrl+Shift+I`
- O hacer clic derecho → "Inspeccionar elemento"

#### Paso 3: Ejecutar en la consola
```javascript
// Abrir la utilidad de sincronización
await window.api.invoke('open-view', 'sync-utility')
```

#### Paso 4: Click en "Iniciar Sincronización"
La interfaz mostrará:
- Estado en tiempo real
- Progreso cada 100 tickets
- Resumen al finalizar

---

### **MÉTODO 2: Ejecutar directamente desde Developer Tools**

#### Paso 1: Abrir la aplicación
```bash
npm start
```

#### Paso 2: Abrir Developer Tools (F12)

#### Paso 3: Ejecutar en la consola
```javascript
// Ejecutar sincronización directamente
const result = await window.api.invoke('sync-all-pending');
console.log('Resultado:', result);
```

#### Salida esperada:
```javascript
{
  success: true,
  synced: 1183,     // Tickets sincronizados exitosamente
  failed: 0,        // Tickets con error
  total: 1183,      // Total procesados
  errors: []        // Lista de errores (máximo 10)
}
```

---

### **MÉTODO 3: Agregar botón en config.html**

Si quieres tener un acceso permanente, agrega esto a [pure/config.html](pure/config.html):

```html
<!-- Después de los otros botones de configuración -->
<div class="config-item" onclick="abrirSyncUtility()">
  <div class="config-icon">🔄</div>
  <div class="config-title">Sincronización Masiva <span class="badge active">Utilidad</span></div>
  <div class="config-desc">
    Sincronizar tickets pendientes de SQLite a Supabase.
    Migración masiva de datos.
  </div>
</div>

<!-- En la sección de JavaScript -->
<script>
async function abrirSyncUtility() {
  console.log('🔄 Abriendo utilidad de sincronización...');
  try {
    const result = await window.api?.invoke?.('open-view', 'sync-utility');
    if (!result?.success) {
      console.error('❌ Error abriendo sync-utility:', result?.error);
      alert('Error al abrir utilidad de sincronización');
    }
  } catch (error) {
    console.error('❌ Error:', error);
    alert('Error al abrir utilidad de sincronización');
  }
}
</script>
```

---

## 🔧 CÓMO FUNCIONA

### **Handler: `sync-all-pending`**

1. **Verificación inicial**:
   - Verifica que SQLite esté disponible
   - Verifica que Supabase esté conectado
   - Obtiene tickets pendientes: `SELECT * FROM tickets WHERE sincronizado = 0 OR sincronizado IS NULL`

2. **Procesamiento**:
   - Para cada ticket:
     - Prepara datos para Supabase
     - Intenta insertar en `vouchers`
     - Si existe (error 23505): actualiza en lugar de insertar
     - Si éxito: marca como sincronizado en SQLite
     - Si fallo: registra error

3. **Control de flujo**:
   - Progreso cada 100 tickets
   - Pausa de 500ms cada 50 tickets (para no saturar Supabase)
   - Captura y registra todos los errores

4. **Resultado**:
   - Retorna resumen con:
     - Total procesados
     - Exitosos
     - Fallidos
     - Primeros 10 errores (si los hay)

---

## 📊 DATOS SINCRONIZADOS

Cada ticket de SQLite se transforma en un voucher de Supabase:

```javascript
SQLite (tickets)          →    Supabase (vouchers)
─────────────────────────────────────────────────────
code / ticket_number      →    voucher_code
amount                    →    amount (parseFloat)
currency                  →    currency (default: DOP)
estado                    →    status (active/redeemed)
fecha_emision            →    issued_at
created_at               →    created_at
redeemed_at              →    redeemed_at
mesa                     →    mesa_nombre
usuario_emision/operador →    operador_nombre
```

---

## ⚠️ CONSIDERACIONES IMPORTANTES

### **1. Duplicados**
- Si un ticket ya existe en Supabase (mismo `voucher_code`):
  - NO se inserta nuevamente
  - Se actualiza su `status` y `redeemed_at`
  - Se marca como sincronizado en SQLite

### **2. Tiempo de ejecución**
Para 1,183 tickets:
- **Estimado**: 10-20 minutos
- **Progreso**: Se muestra cada 100 tickets
- **Pausas**: 500ms cada 50 tickets para no saturar Supabase

### **3. Errores comunes**

**"Base de datos SQLite no disponible"**:
- Solución: Asegurarse de que la app Electron esté corriendo

**"Supabase no está disponible"**:
- Verificar .env: `USE_SUPABASE=true`
- Verificar conexión a internet
- Verificar credenciales de Supabase

**Error 23505 (Duplicate key)**:
- Normal: significa que el ticket ya existe
- Se maneja automáticamente con UPDATE

---

## 📈 MONITOREO

### **Ver progreso en tiempo real**:
La consola de Electron mostrará:

```
🚀 Iniciando sincronización masiva...
📊 Tickets pendientes: 1183
📈 Progreso: 100/1183 (✅ 100 | ❌ 0)
📈 Progreso: 200/1183 (✅ 200 | ❌ 0)
📈 Progreso: 300/1183 (✅ 300 | ❌ 0)
...
============================================================
📊 RESUMEN DE SINCRONIZACIÓN
============================================================
Total: 1183
✅ Exitosos: 1183
❌ Fallidos: 0
📈 Tasa de éxito: 100.0%
```

### **Verificar sincronización**:

#### En SQLite:
```sql
-- Contar pendientes
SELECT COUNT(*) FROM tickets WHERE sincronizado = 0 OR sincronizado IS NULL;

-- Contar sincronizados
SELECT COUNT(*) FROM tickets WHERE sincronizado = 1;
```

#### En Supabase:
```sql
-- Ver total de vouchers
SELECT COUNT(*) FROM vouchers;

-- Ver últimos 10 sincronizados
SELECT voucher_code, amount, currency, created_at
FROM vouchers
ORDER BY created_at DESC
LIMIT 10;
```

---

## 🧪 TESTING

### **Test 1: Verificar handler disponible**
```javascript
// En Developer Tools
await window.api.invoke('sync-all-pending')
```

### **Test 2: Abrir interfaz gráfica**
```javascript
// En Developer Tools
await window.api.invoke('open-view', 'sync-utility')
```

### **Test 3: Verificar tickets pendientes**
1. Abrir app
2. Developer Tools → Console
3. Ejecutar: `await window.api.invoke('sync-all-pending')`
4. Verificar resultado

---

## 🎯 SIGUIENTE PASO RECOMENDADO

1. **Iniciar la app**:
   ```bash
   npm start
   ```

2. **Abrir Developer Tools** (F12)

3. **Ejecutar en consola**:
   ```javascript
   await window.api.invoke('open-view', 'sync-utility')
   ```

4. **Click en "🚀 Iniciar Sincronización"**

5. **Esperar** (10-20 minutos para 1,183 tickets)

6. **Verificar resultados** en la interfaz

---

## ✅ CHECKLIST

- [x] Handler `sync-all-pending` creado en main.js
- [x] Interfaz gráfica `sync-utility.html` creada
- [x] Case agregado al switch de open-view
- [x] Manejo de duplicados implementado
- [x] Control de flujo con pausas
- [x] Resumen de resultados
- [x] Documentación completa

---

**Creado**: 31 de octubre de 2025
**Estado**: ✅ LISTO PARA EJECUTAR
**Tiempo estimado**: 10-20 minutos para 1,183 tickets
