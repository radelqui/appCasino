# 🔧 SOLUCIÓN: Recompilar better-sqlite3 para Electron

Este error aparece cuando `better-sqlite3` fue construido contra una versión de Node distinta a la que usa el runtime de Electron:

```
ERR_DLOPEN_FAILED: was compiled against a different Node.js version using NODE_MODULE_VERSION 115; Electron requires 118
```

La solución es recompilar el módulo nativo contra la versión de Electron que usa tu app.

## ✅ Requisitos en Windows

- Node.js (misma arquitectura que Electron, típicamente x64)
- Python 3.x (para `node-gyp`). Ejemplo: `C:\Python311\python.exe`
- Microsoft Build Tools (Visual Studio 2019/2022 con C++ Desktop)
- `node-gyp` instalado o disponible via `npm` (se maneja automáticamente)

Recomendado configurar (si fuera necesario):

```
npm config set python "C:\\Python311\\python.exe"
npm config set msvs_version 2019
```

## 🧭 Identificar la versión de Electron

Obtén la versión de Electron que usa el proyecto:

```
npx electron -v
```

Ejemplo: `v30.0.9` → la `target` para reconstrucción será `30.0.9` (sin la `v`).

## 🔨 Opción A: Recompilar con npm rebuild (recomendada)

1) Detén la app Electron y cualquier servidor.

2) Ejecuta el rebuild apuntando a Electron:

```
npm rebuild better-sqlite3 --runtime=electron --target=30.0.9 --dist-url=https://electronjs.org/headers
```

3) Inicia nuevamente el modo puro:

```
npm run start:pure
```

Si no conoces la versión exacta, sustituye `30.0.9` por la que obtuviste con `npx electron -v`.

## 🔁 Opción B: Usar electron-rebuild (alternativa)

Instala y fuerza la reconstrucción del módulo específico:

```
npx electron-rebuild -f -w better-sqlite3
```

Esto detecta automáticamente tu versión de Electron y recompila los módulos nativos.

## ✅ Verificación

- Al iniciar `npm run start:pure`, NO debe aparecer `ERR_DLOPEN_FAILED`.
- En la consola principal deberían registrarse los handlers sin advertencias.
- Acciones que dependen de SQLite (login, estadísticas de caja) deben funcionar.

## 🧹 Limpieza si el rebuild falla

Si el error persiste:

- Elimina `node_modules` y `package-lock.json` y reinstala:

```
rd /s /q node_modules
del /q package-lock.json
npm install
```

- Repite el rebuild:

```
npm rebuild better-sqlite3 --runtime=electron --target=30.0.9 --dist-url=https://electronjs.org/headers
```

- Asegúrate de ejecutar los comandos en la MISMA arquitectura y terminal que usas para lanzar Electron.

## 📝 Script opcional en package.json

Puedes añadir un script para facilitar el rebuild (ajusta la versión):

```json
{
  "scripts": {
    "rebuild:sqlite": "npm rebuild better-sqlite3 --runtime=electron --target=30.0.9 --dist-url=https://electronjs.org/headers"
  }
}
```

Uso:

```
npm run rebuild:sqlite
```

## 🌐 Notas para macOS y Linux

- macOS: instala Xcode Command Line Tools: `xcode-select --install`
- Linux: instala build essentials y headers de sqlite: `sudo apt-get install -y build-essential python3 libsqlite3-dev`

Luego, usa el mismo comando de `npm rebuild` ajustando la `target` de Electron.

---

## 🛟 Mientras recompilas (fallback)

El proyecto incluye un “fallback offline” temporal que permite:

- `auth:login` con usuario `admin@casino` ó `admin@casinosusua.com` y PIN `1234` (configurable por `.env` `ADMIN_PIN`)
- `auth:get-session` en memoria
- `caja:get-stats-today` devolviendo ceros para no romper el panel

Este fallback evita bloqueos mientras se recompila `better-sqlite3`, pero debes retirarlo o dejarlo como respaldo una vez que la base nativa funcione.


## 🚨 PROBLEMA:
```
better-sqlite3 compilado para NODE_MODULE_VERSION 115
Electron necesita NODE_MODULE_VERSION 118
```

---

## ✅ SOLUCIÓN EN 3 PASOS:

### PASO 1: Verificar versión de Electron
```bash
cd C:\appCasino
npx electron -v
```

Resultado esperado: `v27.3.11` (o similar)

---

### PASO 2: Recompilar better-sqlite3

```bash
# Opción A: Recompilar automático
npm rebuild better-sqlite3 --runtime=electron --target=27.3.11 --dist-url=https://electronjs.org/headers

# Opción B: Reinstalar desde cero (más seguro)
npm uninstall better-sqlite3
npm install better-sqlite3 --save --runtime=electron --target=27.3.11 --dist-url=https://electronjs.org/headers

# Opción C: Usar electron-rebuild (recomendado)
npm install -D electron-rebuild
npx electron-rebuild
```

---

### PASO 3: Eliminar fallback temporal

Una vez que better-sqlite3 funcione, enviar a Claude Code:

```
Recompilé better-sqlite3 y ahora funciona.

TAREA: Eliminar el fallback offline temporal de main.js

CAMBIOS:
1. Eliminar handlers temporales:
   - auth:login (fallback)
   - auth:get-session (fallback)
   - caja:get-stats-today (fallback)

2. Restaurar carga de módulos originales:
   - Electron_Puro/authHandlers.js
   - Caja/cajaHandlers.js

3. Verificar que db esté disponible antes de registrar handlers

4. Agregar try-catch en la carga de módulos

CÓDIGO en main.js:

// Después de crear db
try {
  // Registrar handlers de Caja
  const { registerCajaHandlers } = require('../Caja/cajaHandlers');
  registerCajaHandlers(ipcMain, db);
  console.log('✅ Handlers de Caja registrados');
} catch (error) {
  console.error('❌ Error registrando handlers de Caja:', error);
}

try {
  // Registrar handlers de Auth
  const { registerAuthHandlers } = require('./authHandlers');
  registerAuthHandlers(ipcMain, db);
  console.log('✅ Handlers de Auth registrados');
} catch (error) {
  console.error('❌ Error registrando handlers de Auth:', error);
}

VERIFICAR:
1. Ejecutar: npm start
2. Login con: admin@casinosusua.com / 1234
3. Ver estadísticas reales en Caja
```

---

## 🎯 ORDEN DE EJECUCIÓN:

### TÚ (Carlos):
```bash
cd C:\appCasino

# 1. Ver versión de Electron
npx electron -v

# 2. Recompilar (elige UNO):
npx electron-rebuild

# O si falla:
npm rebuild better-sqlite3 --runtime=electron --target=27.3.11

# 3. Verificar que funciona
npm start
```

### CLAUDE CODE:
- Después de que funcione, eliminar fallback temporal
- Restaurar handlers originales

---

## 📊 ESTADO ACTUAL:

### ✅ TIENE AHORA (TEMPORAL):
- Login funciona con fallback offline
- Admin: admin@casinosusua.com / 1234
- Stats en cero (fallback)

### ✅ TENDRÁ DESPUÉS (DEFINITIVO):
- Login contra SQLite real
- Stats reales de la BD
- Todos los handlers funcionando

---

## 🚨 SI FALLA LA RECOMPILACIÓN:

### Error: "No se encuentra Python"
```bash
# Instalar Python 3
# Descargar de python.org
# Reintentar rebuild
```

### Error: "No se encuentra Visual Studio"
```bash
# Instalar Visual Studio Build Tools
npm install -g windows-build-tools
```

### Error: "Permission denied"
```bash
# Ejecutar PowerShell como Administrador
cd C:\appCasino
npx electron-rebuild
```

---

## 🎯 RESUMEN:

**AHORA:** Funciona con fallback (login básico)
**DESPUÉS:** Recompilar y usar BD real

**COMANDO MÁS SIMPLE:**
```bash
cd C:\appCasino
npx electron-rebuild
```

---

## ✅ VERIFICACIÓN FINAL:

Después de recompilar, prueba:
```bash
node -e "const db = require('better-sqlite3')('test.db'); console.log('✅ SQLite OK')"
```

Si sale "✅ SQLite OK" → Funciona
Si sale error → Reintentar rebuild

---

**¿Ejecutas `npx electron-rebuild` ahora?** 🚀
