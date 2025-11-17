# CodeWiki Architecture

Documentación técnica del pipeline CodeWiki → NotebookLM

---

## 🏗️ Arquitectura General

```
┌─────────────────────────────────────────────────────────────┐
│                        DESARROLLADOR                         │
│                                                               │
│  $ git add README.md                                         │
│  $ git commit -m "docs: Update README"                       │
│  $ git push                                                   │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      GITHUB REPOSITORY                       │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  GitHub Actions Trigger                             │    │
│  │  • on: push (paths: '**.md')                        │    │
│  │  • Detecta cambios en archivos .md                  │    │
│  └─────────────────────────────────────────────────────┘    │
│                            │                                  │
│                            ▼                                  │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Workflow: codewiki-sync.yml                        │    │
│  │  1. Checkout code                                   │    │
│  │  2. Setup Node.js 20                                │    │
│  │  3. Install dependencies (marked, googleapis)       │    │
│  │  4. Authenticate with Google (service account)      │    │
│  │  5. Run sync-to-drive.js                            │    │
│  └─────────────────────────────────────────────────────┘    │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   SYNC SCRIPT (Node.js)                      │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  1. DISCOVER PHASE                                   │   │
│  │     • Scan repository for .md files                  │   │
│  │     • Exclude: node_modules, .git, dist, build       │   │
│  │     • Result: List of file paths                     │   │
│  └──────────────────────────────────────────────────────┘   │
│                            │                                  │
│                            ▼                                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  2. CONVERT PHASE                                    │   │
│  │     • Read .md content                               │   │
│  │     • Parse with marked.js (GitHub Flavored MD)      │   │
│  │     • Convert to clean HTML                          │   │
│  │     • Add styling (CSS inline)                       │   │
│  │     • Add metadata (repo, file path, timestamp)      │   │
│  └──────────────────────────────────────────────────────┘   │
│                            │                                  │
│                            ▼                                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  3. UPLOAD PHASE                                     │   │
│  │     • Get/Create repo folder in Drive                │   │
│  │     • Check if doc exists (by name)                  │   │
│  │     • If exists: Delete + Recreate (update)          │   │
│  │     • If new: Create Google Doc                      │   │
│  │     • Upload as: text/html → Google Doc              │   │
│  └──────────────────────────────────────────────────────┘   │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      GOOGLE DRIVE                            │
│                                                               │
│  CodeWiki/                                                   │
│  ├── appCasino/                                              │
│  │   ├── README                      (Google Doc)           │
│  │   ├── ARCHITECTURE                (Google Doc)           │
│  │   ├── CODEWIKI_SETUP              (Google Doc)           │
│  │   └── ...                                                 │
│  ├── otro-repo/                                              │
│  │   ├── README                      (Google Doc)           │
│  │   └── ...                                                 │
│  └── ...                                                      │
│                                                               │
│  Permisos: Service Account = Editor                         │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                       NOTEBOOKLM                             │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Notebook: "appCasino Docs"                          │   │
│  │                                                       │   │
│  │  Sources:                                            │   │
│  │  • 📄 README                                         │   │
│  │  • 📄 ARCHITECTURE                                   │   │
│  │  • 📄 CODEWIKI_SETUP                                 │   │
│  │  • ...                                               │   │
│  │                                                       │   │
│  │  ✅ Auto-sync: Changes reflected immediately         │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
│  Usuario puede:                                              │
│  • Hacer preguntas sobre el código                          │
│  • Generar resúmenes                                         │
│  • Crear study guides                                        │
│  • Extraer insights                                          │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔄 Flujo de Datos

### 1. Input: Markdown

```markdown
# Mi Documento

Este es un ejemplo con:

- Listas
- **Negrita**
- `código inline`

\`\`\`javascript
const foo = 'bar';
\`\`\`
```

### 2. Processing: HTML Intermedio

```html
<h1>Mi Documento</h1>
<p>Este es un ejemplo con:</p>
<ul>
  <li>Listas</li>
  <li><strong>Negrita</strong></li>
  <li><code>código inline</code></li>
</ul>
<pre><code class="language-javascript">const foo = 'bar';</code></pre>
```

### 3. Output: Google Doc

```
MI DOCUMENTO
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Este es un ejemplo con:

• Listas
• Negrita
• código inline

┌────────────────────────────────┐
│ const foo = 'bar';            │
└────────────────────────────────┘

──────────────────────────────────
🤖 Auto-generated from GitHub
📁 Repo: appCasino
📄 File: docs/ejemplo.md
🕐 Last sync: 2025-11-17T10:30:00Z
```

---

## 🔑 Componentes Clave

### 1. GitHub Actions Workflow

**Ubicación:** `.github/workflows/codewiki-sync.yml`

**Responsabilidades:**
- Detectar cambios en `.md` files
- Configurar entorno (Node.js, dependencies)
- Manejar autenticación con Google
- Ejecutar script de sincronización
- Limpiar credentials al finalizar

**Triggers:**
- `push` con cambios en `**.md`
- `workflow_dispatch` (manual)

### 2. Sync Script

**Ubicación:** `.github/scripts/sync-to-drive.js`

**Responsabilidades:**
- Descubrir archivos Markdown
- Convertir Markdown → HTML
- Interactuar con Google Drive API
- Crear/actualizar Google Docs
- Manejar errores y logging

**Dependencies:**
- `googleapis` - Google Drive & Docs API
- `marked` - Markdown parser

### 3. Google Service Account

**Tipo:** Service Account con JSON key

**Permisos requeridos:**
- Google Drive API (scope: `drive.file`)
- Google Docs API (scope: `documents`)
- Editor en carpeta CodeWiki

**Seguridad:**
- Key almacenada como GitHub Secret
- Acceso limitado solo a carpeta CodeWiki
- No puede acceder a otros archivos de Drive

### 4. Google Drive Folder

**Estructura:**
```
CodeWiki/                          (Folder compartido)
├── appCasino/                     (Auto-created per repo)
├── otro-repo/                     (Auto-created per repo)
└── ...
```

**Permisos:**
- Service Account: Editor
- Usuario: Owner
- Otros: Opcional (read-only)

---

## 🔐 Seguridad

### Secrets Management

```yaml
# GitHub Secrets (encrypted at rest)
GOOGLE_CREDENTIALS    → Service Account JSON
GOOGLE_FOLDER_ID      → Drive Folder ID
```

**Best practices:**
- ✅ Secrets nunca aparecen en logs
- ✅ Credentials eliminadas después de cada run
- ✅ Service Account con permisos mínimos
- ✅ No hay acceso a archivos fuera de CodeWiki folder

### Network Security

```
GitHub Actions Runner (ephemeral)
    │
    ├─→ Google Drive API (HTTPS)
    │   └─ OAuth 2.0 + Service Account
    │
    └─→ Google Docs API (HTTPS)
        └─ OAuth 2.0 + Service Account
```

---

## 📊 Límites y Cuotas

### Google Drive API

- **Queries per 100 seconds per user:** 1,000
- **Queries per day:** 1,000,000,000 (unlikely to hit)

**Nuestro uso típico:**
- 1 query para get/create folder
- 1 query por archivo para buscar existente
- 1 query por archivo para create/update

**Ejemplo:** 50 archivos .md = ~150 queries por sync

### Google Docs API

- **Requests per minute per user:** 300
- **Requests per day:** Unlimited

**Nuestro uso:** Minimal, solo creación de docs

### GitHub Actions

- **Free tier:** 2,000 minutes/month (public repos unlimited)
- **Nuestro workflow:** ~2 minutos por run

---

## 🚀 Performance

### Optimizaciones Actuales

1. **Parallel processing:** Node.js async/await
2. **Minimal dependencies:** Solo 2 npm packages
3. **Incremental updates:** Solo procesa `.md` modificados (trigger level)
4. **Cached npm packages:** actions/setup-node cache

### Benchmarks

| Métrica | Valor |
|---------|-------|
| Setup time | ~30s |
| Processing per file | ~2s |
| Upload per file | ~3s |
| Total (10 files) | ~2 min |
| Total (50 files) | ~5 min |

### Posibles Mejoras

1. **Procesamiento solo de modificados:**
   ```javascript
   const modifiedFiles = git diff --name-only HEAD~1 HEAD
   ```

2. **Batch uploads:**
   ```javascript
   await Promise.all(files.map(f => upload(f)))
   ```

3. **Caching de folder IDs:**
   ```javascript
   // Cache en GitHub Actions cache
   ```

---

## 🔍 Monitoring & Debugging

### Logs

GitHub Actions proporciona logs completos:

```
📄 Processing: README.md
  ✅ Created: https://docs.google.com/document/d/abc123...

📄 Processing: ARCHITECTURE.md
  ↻ Updating existing doc: def456...
  ✅ Updated: https://docs.google.com/document/d/def456...

📊 Sync Summary:
  ✅ Success: 48
  ❌ Failed: 2
```

### Métricas

- Archivos procesados
- Tiempo total
- Éxitos vs fallos
- URLs de docs creados

### Alertas

Configurar GitHub Actions notifications:
- Email al fallar workflow
- Slack/Discord webhook (opcional)

---

## 🔄 Versionado

### Estrategia Actual

**Sobrescritura completa:** Cada sync sobrescribe el doc completo.

**Ventajas:**
- Siempre refleja estado actual
- No hay conflictos de versiones
- Más simple de implementar

**Desventajas:**
- No hay historial en Drive (pero sí en GitHub)

### Alternativas

1. **Append timestamp to filename:**
   ```
   README_2025-11-17
   README_2025-11-18
   ```
   Pros: Historial completo
   Cons: Muchos archivos duplicados

2. **Use Google Docs version history:**
   - Requiere Google Docs API más compleja
   - Update content en lugar de delete + create

---

## 🏗️ Extensibilidad

### Agregar Soporte para Otros Formatos

```javascript
// En sync-to-drive.js
const SUPPORTED_EXTENSIONS = ['.md', '.txt', '.rst'];

async function findDocFiles(dir = '.', files = []) {
  // ...
  if (SUPPORTED_EXTENSIONS.some(ext => entry.name.endsWith(ext))) {
    files.push(fullPath);
  }
}
```

### Agregar Post-Processing

```javascript
// Hook después de upload
async function onDocCreated(fileId, filePath) {
  // Agregar comentarios
  // Compartir con equipo
  // Notificar a Slack
}
```

### Agregar Validaciones

```javascript
// Antes de upload
function validateMarkdown(content) {
  // Check for broken links
  // Validate frontmatter
  // Lint Markdown
}
```

---

## 📚 Dependencias

### Runtime

```json
{
  "googleapis": "^128.0.0",  // Google APIs client
  "marked": "^11.1.0"        // Markdown parser
}
```

### Build-time

```yaml
- Node.js 20
- GitHub Actions runners (ubuntu-latest)
```

### External Services

- Google Cloud Platform (APIs)
- Google Drive (storage)
- NotebookLM (consumption)

---

## 🧪 Testing

### Local Testing

```bash
cd .github/scripts
npm install
node test-local.js
```

Genera previews HTML en `.github/scripts/preview/`

### Integration Testing

```bash
# Trigger manual workflow
gh workflow run codewiki-sync.yml
```

### E2E Testing

1. Modificar un `.md`
2. Push a GitHub
3. Verificar en Drive
4. Importar en NotebookLM

---

## 📈 Roadmap

### v1.0 (Actual)

- ✅ Conversión MD → Google Docs
- ✅ Auto-sync en push
- ✅ Multi-repo support
- ✅ Error handling

### v1.1 (Futuro)

- [ ] Procesamiento solo de archivos modificados
- [ ] Batch uploads paralelos
- [ ] Métricas de uso
- [ ] Notificaciones Slack/Discord

### v2.0 (Ideas)

- [ ] Soporte para imágenes embebidas
- [ ] Conversión de diagramas Mermaid
- [ ] Index automático de documentación
- [ ] Search API integration

---

## 🤝 Contribuciones

Ver [.github/scripts/README.md](.github/scripts/README.md) para detalles técnicos.

---

## 📄 Licencia

MIT
