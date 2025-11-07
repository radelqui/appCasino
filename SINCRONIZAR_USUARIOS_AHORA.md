# 🔄 SINCRONIZAR USUARIOS AHORA

**Tiempo**: 10 segundos
**Dificultad**: ⭐ Muy fácil

---

## 🎯 PASOS RÁPIDOS

### 1. Iniciar la aplicación
```bash
npm start
```

### 2. Abrir la consola de desarrollador
Presiona: **Ctrl + Shift + I** (o F12)

### 3. Ir a la pestaña "Console"

### 4. Copiar y pegar este comando:
```javascript
window.api.invoke('force-sync-users').then(result => {
  console.log('✅ Resultado:', result);
  if (result.success) {
    alert(`✅ Sincronización completada!\n\n` +
          `Usuarios nuevos: ${result.synced}\n` +
          `Usuarios actualizados: ${result.updated}\n` +
          `Total en SQLite: ${result.total}`);
  } else {
    alert(`❌ Error: ${result.error}`);
  }
});
```

### 5. Presionar Enter

---

## 📊 QUÉ VERÁS EN LA CONSOLA

```
🔄 [Sync] Iniciando sincronización forzada de usuarios...
🔧 Verificando estructura de tabla usuarios...
⚠️ Tabla usuarios usa INTEGER para id, debe ser TEXT para UUIDs
🔧 Recreando tabla con estructura correcta...
✅ Tabla usuarios recreada con estructura correcta
📥 Obteniendo usuarios de Supabase...
✅ 9 usuarios encontrados en Supabase

  ➕ Nuevo: admin@test.com (ADMIN)
  ➕ Nuevo: mesa1@test.com (MESA)
  ➕ Nuevo: mesa2@test.com (MESA)
  ➕ Nuevo: caja1@test.com (CAJA)
  ➕ Nuevo: auditor1@test.com (AUDITOR)
  ...

════════════════════════════════════════════════════════════
📊 RESUMEN DE SINCRONIZACIÓN
════════════════════════════════════════════════════════════
✅ Usuarios nuevos:      8
✏️  Usuarios actualizados: 1
❌ Errores:              0
📊 Total en SQLite:      9
════════════════════════════════════════════════════════════
```

---

## ✅ DESPUÉS DE SINCRONIZAR

### Todos los usuarios de Supabase funcionarán para login

---

## 🎉 UNA VEZ SINCRONIZADO

**No necesitas volver a hacerlo.** El sistema sincronizará automáticamente de ahí en adelante.

---

**Última actualización**: 3 de noviembre de 2025
