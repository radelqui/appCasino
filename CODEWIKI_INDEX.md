# CodeWiki → NotebookLM - Índice de Archivos

**Guía completa de todos los archivos del sistema**

---

## 📂 Estructura de Archivos

```
appCasino/
│
├── 📚 DOCUMENTACIÓN (5 archivos)
│   ├── CODEWIKI_README.md          ⭐ EMPIEZA AQUÍ
│   ├── CODEWIKI_RESUMEN.md         📄 Resumen ejecutivo (1 página)
│   ├── CODEWIKI_QUICKSTART.md      🚀 Setup rápido (5 min)
│   ├── CODEWIKI_SETUP.md           📖 Guía completa de setup
│   ├── CODEWIKI_ARCHITECTURE.md    🏗️  Arquitectura técnica
│   └── CODEWIKI_INDEX.md           📑 Este archivo
│
└── .github/
    ├── workflows/
    │   └── codewiki-sync.yml       🤖 GitHub Action (trigger automático)
    │
    └── scripts/
        ├── sync-to-drive.js        ⚙️  Script principal de sincronización
        ├── test-local.js           🧪 Test local (preview HTML)
        ├── verify-setup.sh         ✅ Verificar setup (Bash/Linux/Mac)
        ├── verify-setup.ps1        ✅ Verificar setup (PowerShell/Windows)
        ├── package.json            📦 Dependencies npm
        ├── .gitignore              🚫 Excluir credentials y previews
        ├── README.md               📄 Docs técnicas de scripts
        └── DIAGRAM.txt             🎨 Diagrama visual del flujo
```

---

## 🗺️ Mapa de Navegación

### ¿Qué necesitas?

<table>
<tr>
<td width="50%">

#### 🎯 Soy nuevo, ¿por dónde empiezo?

1. [**CODEWIKI_README.md**](./CODEWIKI_README.md) (5 min)
   - Overview general del sistema
   - Quick start links
   - Casos de uso

2. [**CODEWIKI_RESUMEN.md**](./CODEWIKI_RESUMEN.md) (5 min)
   - Resumen en una página
   - Comparación antes/después
   - Checklist de implementación

3. [**CODEWIKI_SETUP.md**](./CODEWIKI_SETUP.md) (15 min)
   - Setup paso a paso
   - Configuración de Google Cloud
   - Troubleshooting

</td>
<td width="50%">

#### ⚡ Ya tengo todo configurado

1. [**CODEWIKI_QUICKSTART.md**](./CODEWIKI_QUICKSTART.md) (5 min)
   - Copy-paste rápido
   - Agregar a nuevo repo
   - Verificación rápida

2. [**.github/scripts/README.md**](.github/scripts/README.md) (10 min)
   - Comandos útiles
   - Debug y logs
   - Optimizaciones

</td>
</tr>
<tr>
<td width="50%">

#### 🏗️ Quiero entender cómo funciona

1. [**CODEWIKI_ARCHITECTURE.md**](./CODEWIKI_ARCHITECTURE.md) (20 min)
   - Arquitectura completa
   - Diagramas de flujo
   - Performance y límites

2. [**.github/scripts/DIAGRAM.txt**](.github/scripts/DIAGRAM.txt) (5 min)
   - Diagrama visual ASCII
   - Flujo paso a paso

</td>
<td width="50%">

#### 🔧 Necesito personalizar o debuggear

1. [**.github/workflows/codewiki-sync.yml**](.github/workflows/codewiki-sync.yml)
   - GitHub Action workflow
   - Triggers y configuración

2. [**.github/scripts/sync-to-drive.js**](.github/scripts/sync-to-drive.js)
   - Script principal (387 líneas)
   - Lógica de conversión y upload

3. [**.github/scripts/README.md**](.github/scripts/README.md)
   - Comandos avanzados
   - Debug tools

</td>
</tr>
</table>

---

## 📄 Descripción Detallada de Archivos

### 📚 Documentación (Usuario Final)

#### [CODEWIKI_README.md](./CODEWIKI_README.md) ⭐ PUNTO DE ENTRADA

**Propósito:** Landing page del proyecto

**Contenido:**
- Overview del sistema
- Características principales
- Quick start guide
- Links a toda la documentación
- Troubleshooting básico

**Para quién:** Cualquier usuario nuevo

**Tiempo de lectura:** 5-10 minutos

---

#### [CODEWIKI_RESUMEN.md](./CODEWIKI_RESUMEN.md)

**Propósito:** Resumen ejecutivo en una página

**Contenido:**
- Qué hace el sistema (en 3 líneas)
- Tabla antes/después
- Métricas de performance
- Checklist de implementación
- Próximos pasos

**Para quién:** Decision makers, managers, devs ocupados

**Tiempo de lectura:** 5 minutos

---

#### [CODEWIKI_QUICKSTART.md](./CODEWIKI_QUICKSTART.md)

**Propósito:** Setup rápido para replicar a otros repos

**Contenido:**
- Checklist pre-setup
- Pasos copy-paste (5 min)
- Verificación rápida
- Troubleshooting común

**Para quién:** Devs que ya completaron el setup inicial

**Tiempo de lectura:** 5 minutos

**Tiempo de implementación:** 5 minutos

---

#### [CODEWIKI_SETUP.md](./CODEWIKI_SETUP.md)

**Propósito:** Guía completa de configuración inicial

**Contenido:**
- Setup paso a paso de Google Cloud
- Configuración de Service Account
- Setup de GitHub Secrets
- Instrucciones detalladas de verificación
- Troubleshooting exhaustivo
- Personalización avanzada
- Tips y best practices

**Para quién:** Usuarios nuevos haciendo setup por primera vez

**Tiempo de lectura:** 15 minutos

**Tiempo de implementación:** 15 minutos

---

#### [CODEWIKI_ARCHITECTURE.md](./CODEWIKI_ARCHITECTURE.md)

**Propósito:** Documentación técnica completa

**Contenido:**
- Arquitectura detallada con diagramas
- Flujo de datos completo
- Componentes y responsabilidades
- Seguridad y permisos
- Performance y límites
- Optimizaciones posibles
- Extensibilidad

**Para quién:** Devs técnicos, arquitectos, contributors

**Tiempo de lectura:** 20-30 minutos

---

### 🤖 GitHub Actions

#### [.github/workflows/codewiki-sync.yml](.github/workflows/codewiki-sync.yml)

**Tipo:** GitHub Actions Workflow (YAML)

**Propósito:** Define cuándo y cómo se ejecuta la sincronización

**Trigger:**
```yaml
on:
  push:
    paths: ['**.md']  # Solo cuando cambian archivos .md
  workflow_dispatch:  # O ejecución manual
```

**Steps:**
1. Checkout repository
2. Setup Node.js 20
3. Install dependencies (marked, googleapis)
4. Authenticate with Google (via secrets)
5. Run sync-to-drive.js
6. Cleanup credentials

**Modificar para:**
- Cambiar trigger (ej: solo `docs/**.md`)
- Cambiar ramas (ej: `main` → `develop`)
- Agregar notificaciones

---

### ⚙️ Scripts

#### [.github/scripts/sync-to-drive.js](.github/scripts/sync-to-drive.js)

**Tipo:** Node.js Script (JavaScript)

**Propósito:** Script principal que hace toda la magia

**Líneas de código:** ~387 líneas

**Funciones principales:**

```javascript
initGoogleDrive()           // Autenticar con Google APIs
findMarkdownFiles()         // Descubrir archivos .md
markdownToCleanHtml()       // Convertir MD → HTML
getOrCreateRepoFolder()     // Gestionar carpetas en Drive
uploadMarkdownAsGoogleDoc() // Subir/actualizar docs
main()                      // Orquestar todo el proceso
```

**Dependencies:**
- `googleapis` - Google Drive & Docs API client
- `marked` - Markdown parser (GitHub Flavored)

**Modificar para:**
- Cambiar estilo de los docs (CSS inline)
- Agregar metadatos personalizados
- Cambiar lógica de update vs create

---

#### [.github/scripts/test-local.js](.github/scripts/test-local.js)

**Tipo:** Node.js Script (JavaScript)

**Propósito:** Test local sin necesidad de push a GitHub

**Uso:**
```bash
cd .github/scripts
npm install
node test-local.js
```

**Qué hace:**
- Busca todos los `.md` en el repo
- Convierte cada uno a HTML
- Guarda previews en `.github/scripts/preview/`
- Abre los `.html` en tu navegador para ver cómo se verán

**Útil para:**
- Testear cambios en conversión Markdown
- Ver preview antes de push
- Debug de formato

---

#### [.github/scripts/verify-setup.sh](.github/scripts/verify-setup.sh) (Bash)
#### [.github/scripts/verify-setup.ps1](.github/scripts/verify-setup.ps1) (PowerShell)

**Tipo:** Shell Scripts

**Propósito:** Verificar que todo esté configurado correctamente

**Checks:**
- ✅ Archivos necesarios existen
- ✅ GitHub CLI instalado y autenticado
- ✅ Secrets configurados (si tienes permisos)
- ✅ Archivos .md para sincronizar
- ✅ Sintaxis YAML válida

**Uso:**
```bash
# Windows
pwsh .github/scripts/verify-setup.ps1

# Linux/Mac
bash .github/scripts/verify-setup.sh
```

**Output:** Report con errores, warnings, y próximos pasos

---

#### [.github/scripts/package.json](.github/scripts/package.json)

**Tipo:** npm Package Config

**Propósito:** Define dependencies del proyecto

**Dependencies:**
```json
{
  "googleapis": "^128.0.0",  // Google APIs client
  "marked": "^11.1.0"        // Markdown parser
}
```

**Scripts:**
```json
{
  "sync": "node sync-to-drive.js"
}
```

---

#### [.github/scripts/.gitignore](.github/scripts/.gitignore)

**Tipo:** Git Ignore

**Propósito:** Excluir archivos sensibles y temporales

**Excluye:**
- `credentials.json` (NUNCA commitear)
- `node_modules/`
- `preview/` (HTML previews locales)
- Logs y archivos temporales

---

#### [.github/scripts/README.md](.github/scripts/README.md)

**Tipo:** Documentación Técnica

**Propósito:** Docs para desarrolladores trabajando con los scripts

**Contenido:**
- Comandos útiles
- Test local
- Monitoreo y logs
- Debug tools
- Optimizaciones
- Contribuciones

**Para quién:** Desarrolladores modificando o debuggeando scripts

---

#### [.github/scripts/DIAGRAM.txt](.github/scripts/DIAGRAM.txt)

**Tipo:** Diagrama ASCII

**Propósito:** Visualización del flujo completo

**Contenido:**
- Diagrama visual paso a paso
- Timeline desde push hasta NotebookLM
- Detalles de cada fase
- Métricas de tiempo

**Para quién:** Visual learners, presentaciones

---

## 📊 Estadísticas del Proyecto

```
Total de archivos:        13
Documentación (MD):       6 archivos (1,750+ líneas)
Scripts (JS):             2 archivos (387 líneas)
Workflows (YAML):         1 archivo
Verificación (Shell):     2 archivos (Bash + PowerShell)
Config (JSON):            1 archivo
Otros:                    1 archivo (diagrama)

Líneas de código:         ~387 líneas (JS)
Líneas de docs:           ~1,750 líneas (MD)
Total:                    ~2,137 líneas

Tiempo de lectura total:  ~60 minutos
Tiempo de implementación: ~15 minutos (inicial)
Tiempo de replicación:    ~5 minutos (siguientes repos)
```

---

## 🎯 Rutas Recomendadas

### Ruta 1: Usuario Nuevo (Primera Implementación)

```
1. CODEWIKI_README.md (5 min)
   ↓
2. CODEWIKI_RESUMEN.md (5 min)
   ↓
3. CODEWIKI_SETUP.md (15 min) + Implementar
   ↓
4. verify-setup.ps1 o .sh (2 min)
   ↓
5. Git push y verificar
   ↓
6. Importar a NotebookLM

Total: ~30 minutos
```

### Ruta 2: Usuario Experimentado (Replicar a Otro Repo)

```
1. CODEWIKI_QUICKSTART.md (2 min)
   ↓
2. Copy-paste archivos (2 min)
   ↓
3. Agregar secrets (1 min)
   ↓
4. Git push y verificar

Total: ~5 minutos
```

### Ruta 3: Desarrollador Técnico (Entender y Modificar)

```
1. CODEWIKI_README.md (5 min)
   ↓
2. CODEWIKI_ARCHITECTURE.md (20 min)
   ↓
3. .github/scripts/README.md (10 min)
   ↓
4. sync-to-drive.js (leer código)
   ↓
5. test-local.js (testear modificaciones)

Total: ~45 minutos
```

---

## 🔍 Búsqueda Rápida

### ¿Cómo hago X?

| Tarea | Archivo | Sección |
|-------|---------|---------|
| Configurar Google Cloud | CODEWIKI_SETUP.md | Paso 1 |
| Agregar GitHub Secrets | CODEWIKI_SETUP.md | Paso 3 |
| Verificar que funcione | verify-setup.ps1/.sh | - |
| Replicar a otro repo | CODEWIKI_QUICKSTART.md | Todo |
| Cambiar qué archivos sincronizar | codewiki-sync.yml | `on.push.paths` |
| Modificar estilo de docs | sync-to-drive.js | Línea ~150 (CSS) |
| Ver logs de sincronización | .github/scripts/README.md | Monitoreo |
| Test sin hacer push | test-local.js | - |
| Debug errors | CODEWIKI_SETUP.md | Troubleshooting |
| Entender arquitectura | CODEWIKI_ARCHITECTURE.md | Todo |
| Ver diagrama visual | DIAGRAM.txt | - |
| Comandos útiles | .github/scripts/README.md | Comandos |

---

## 💡 Tips de Navegación

### Para Lectura Offline

Descarga todos los archivos CODEWIKI_*.md - son standalone y no requieren internet.

### Para Búsqueda Rápida

Usa GitHub search dentro del repo:
- `path:.github/scripts filename:sync` → Encuentra sync-to-drive.js
- `path:CODEWIKI extension:md` → Todos los docs

### Para Compartir

- **Executive summary:** CODEWIKI_RESUMEN.md
- **Technical deep-dive:** CODEWIKI_ARCHITECTURE.md
- **Quick tutorial:** CODEWIKI_QUICKSTART.md

---

## 🆘 Ayuda

### ¿No encuentras algo?

1. **Busca en este índice** (usa Ctrl+F)
2. **Lee CODEWIKI_README.md** (overview general)
3. **Abre un issue** en GitHub

### ¿Algo está desactualizado?

1. Verifica que tengas la última versión
2. Reporta en GitHub Issues
3. O abre un PR con la corrección

---

## 📚 Lectura Adicional

### Recursos Externos

- [GitHub Actions Docs](https://docs.github.com/actions)
- [Google Drive API](https://developers.google.com/drive)
- [NotebookLM](https://notebooklm.google.com)
- [Marked.js](https://marked.js.org/)

### Comunidad

- [GitHub Discussions](../../discussions) - Preguntas y discusiones
- [GitHub Issues](../../issues) - Reportar bugs
- [Pull Requests](../../pulls) - Contribuciones

---

<div align="center">

**¿Listo para empezar?**

[📖 README](./CODEWIKI_README.md) • [🚀 Quick Start](./CODEWIKI_QUICKSTART.md) • [📖 Setup](./CODEWIKI_SETUP.md)

</div>
