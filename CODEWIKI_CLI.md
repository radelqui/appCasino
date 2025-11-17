# CodeWiki CLI - Guía de Comandos

**Referencia rápida de todos los comandos disponibles**

---

## 🚀 Setup y Configuración

### Setup Completo Automatizado (Recomendado)

```bash
cd .github/scripts
npm install
node codewiki-setup.js
```

**Wizard interactivo que incluye:**
- ✅ Verificación de prerequisitos
- ✅ Configuración de secrets
- ✅ Verificación de setup
- ✅ Primera ejecución del workflow

---

### Configurar Solo GitHub Secrets

```bash
node .github/scripts/setup-github-secrets.js
```

**Configura automáticamente:**
- `GOOGLE_CREDENTIALS` (desde archivo JSON)
- `GOOGLE_FOLDER_ID` (desde input)

**Requiere:**
- GitHub CLI (`gh`) instalado y autenticado
- Archivo JSON de Service Account
- Folder ID de Google Drive

---

### Verificar Configuración

**Windows:**
```powershell
pwsh .github/scripts/verify-setup.ps1
```

**Linux/Mac:**
```bash
bash .github/scripts/verify-setup.sh
```

**Verifica:**
- Archivos necesarios existen
- GitHub CLI instalado y autenticado
- Secrets configurados (si tienes permisos)
- Archivos .md disponibles para sincronizar
- Sintaxis YAML válida

---

## 🔧 Gestión de Workflows

### Modo Interactivo (Recomendado)

```bash
node .github/scripts/manage-workflow.js
```

**Menú interactivo con opciones:**
1. Listar workflow runs recientes
2. Ejecutar workflow manualmente
3. Ver workflow en tiempo real
4. Ver logs del último workflow
5. Abrir en navegador

---

### Comandos CLI Directos

#### Listar Workflow Runs

```bash
node .github/scripts/manage-workflow.js --list
# o
gh run list --workflow=codewiki-sync.yml
```

---

#### Ejecutar Workflow Manualmente

```bash
node .github/scripts/manage-workflow.js --trigger
# o
gh workflow run codewiki-sync.yml
```

---

#### Ver Workflow en Tiempo Real

```bash
node .github/scripts/manage-workflow.js --watch
# o
gh run watch
```

**Muestra:**
- Status en tiempo real
- Progreso de cada step
- Resultado final

---

#### Ver Logs del Último Workflow

```bash
node .github/scripts/manage-workflow.js --logs
# o
gh run view --log
```

---

#### Abrir en Navegador

```bash
node .github/scripts/manage-workflow.js --browser
# o
gh run view --web
```

---

## 🧪 Testing Local

### Test de Conversión (Sin Push)

```bash
cd .github/scripts
npm install
node test-local.js
```

**Genera:**
- Archivos HTML en `.github/scripts/preview/`
- Preview de cómo se verán los docs en Google

**Útil para:**
- Testear cambios en conversión Markdown
- Ver formato antes de hacer push
- Debug de estilos CSS

---

### Test Manual del Script de Sync

```bash
cd .github/scripts

# Configurar variables
export GOOGLE_FOLDER_ID="tu-folder-id"
export REPO_NAME="nombre-repo"
export GOOGLE_APPLICATION_CREDENTIALS="path/to/credentials.json"

# Ejecutar
npm install
node sync-to-drive.js
```

---

## 🔍 Comandos de GitHub CLI

### Información del Repositorio

```bash
# Ver info del repo actual
gh repo view

# Ver en navegador
gh repo view --web
```

---

### Gestión de Secrets

```bash
# Listar secrets
gh secret list

# Agregar secret manualmente
gh secret set GOOGLE_CREDENTIALS < credentials.json
gh secret set GOOGLE_FOLDER_ID -b "1a2b3c4d5e6f7g8h9i0j"

# Eliminar secret
gh secret delete GOOGLE_CREDENTIALS
```

---

### Workflows

```bash
# Listar workflows disponibles
gh workflow list

# Ver status de un workflow
gh workflow view codewiki-sync.yml

# Habilitar/deshabilitar workflow
gh workflow enable codewiki-sync.yml
gh workflow disable codewiki-sync.yml
```

---

### Runs

```bash
# Listar últimos 10 runs
gh run list --workflow=codewiki-sync.yml --limit 10

# Ver detalles de un run específico
gh run view RUN_ID

# Ver logs de un run
gh run view RUN_ID --log

# Descargar logs
gh run download RUN_ID

# Cancelar run en ejecución
gh run cancel RUN_ID

# Re-ejecutar run fallido
gh run rerun RUN_ID

# Ver run en navegador
gh run view RUN_ID --web
```

---

## 📊 Comandos Útiles

### Encontrar Archivos Markdown

```bash
# Listar todos los .md que se sincronizarán
find . -name "*.md" \
  -not -path "*/node_modules/*" \
  -not -path "*/.git/*" \
  -not -path "*/dist/*" \
  -not -path "*/build/*"

# Contar archivos .md
find . -name "*.md" \
  -not -path "*/node_modules/*" \
  -not -path "*/.git/*" | wc -l
```

---

### Ver Estado de Git

```bash
# Ver archivos .md modificados
git status | grep ".md"

# Ver cambios en .md
git diff '*.md'

# Ver commits que modificaron .md
git log --oneline --follow -- '*.md'
```

---

### Monitorear Workflow en Tiempo Real

```bash
# Ver status cada 5 segundos (Linux/Mac)
watch -n 5 'gh run list --workflow=codewiki-sync.yml --limit 1'

# Ver logs en tiempo real
gh run watch --exit-status
```

---

## 🔐 Gestión de Credenciales

### Ver Info de Service Account

```bash
# Con gcloud CLI
gcloud iam service-accounts describe SERVICE_ACCOUNT_EMAIL

# Ver keys
gcloud iam service-accounts keys list --iam-account=SERVICE_ACCOUNT_EMAIL
```

---

### Test de Conexión a Google Drive

```javascript
// test-drive-connection.js
const { google } = require('googleapis');
const fs = require('fs');

async function test() {
  const credentials = JSON.parse(fs.readFileSync('credentials.json', 'utf8'));
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  });

  const drive = google.drive({ version: 'v3', auth });
  const response = await drive.files.list({
    pageSize: 10,
    fields: 'files(id, name)',
  });

  console.log('Connected! Files:', response.data.files);
}

test().catch(console.error);
```

```bash
node test-drive-connection.js
```

---

## 🐛 Debug y Troubleshooting

### Ver Logs Detallados del Workflow

```bash
# Ver logs completos
gh run view --log

# Ver logs de un step específico
gh run view --log | grep "Convert and Upload"

# Descargar todos los logs
gh run download
```

---

### Verificar Workflow YAML

```bash
# Validar sintaxis (requiere yamllint)
yamllint .github/workflows/codewiki-sync.yml

# Ver contenido
cat .github/workflows/codewiki-sync.yml
```

---

### Test de Node Dependencies

```bash
cd .github/scripts

# Verificar versiones instaladas
npm list

# Verificar vulnerabilidades
npm audit

# Actualizar dependencies
npm update
```

---

### Ver Variables de Entorno en GitHub Actions

Agrega este step temporalmente al workflow:

```yaml
- name: Debug environment
  run: |
    echo "Node version: $(node --version)"
    echo "NPM version: $(npm --version)"
    echo "Working directory: $(pwd)"
    ls -la
```

---

## 📚 Cheat Sheet Rápido

### Setup (Primera vez)

```bash
# 1. Setup completo
node .github/scripts/codewiki-setup.js

# 2. Verificar
pwsh .github/scripts/verify-setup.ps1  # Windows
bash .github/scripts/verify-setup.sh   # Linux/Mac

# 3. Push y observar
git push
gh run watch
```

---

### Uso Diario

```bash
# Editar docs
vim README.md

# Commit y push (trigger automático)
git add README.md
git commit -m "docs: Update README"
git push

# Ver workflow (opcional)
gh run watch
```

---

### Agregar a Otro Repo

```bash
# 1. Copiar archivos
cp -r .github otro-repo/

# 2. Configurar secrets (reusar mismos valores)
cd otro-repo
node .github/scripts/setup-github-secrets.js

# 3. Push
git add .github/
git commit -m "feat: Add CodeWiki sync"
git push
```

---

### Troubleshooting Rápido

```bash
# Verificar setup
bash .github/scripts/verify-setup.sh

# Ver últimos logs
gh run view --log | tail -50

# Re-ejecutar workflow manualmente
gh workflow run codewiki-sync.yml
gh run watch
```

---

## 🎓 Recursos Adicionales

### Documentación

- **[CODEWIKI_README.md](./CODEWIKI_README.md)** - Overview general
- **[CODEWIKI_SETUP.md](./CODEWIKI_SETUP.md)** - Setup detallado
- **[.github/scripts/README.md](.github/scripts/README.md)** - Docs técnicas

### Enlaces Externos

- [GitHub CLI Docs](https://cli.github.com/manual/)
- [Google Drive API](https://developers.google.com/drive/api/v3/reference)
- [GitHub Actions Docs](https://docs.github.com/actions)

---

## 💡 Tips

### Alias Útiles

Agrega a tu `.bashrc` o `.zshrc`:

```bash
# CodeWiki aliases
alias cw-setup='node .github/scripts/codewiki-setup.js'
alias cw-manage='node .github/scripts/manage-workflow.js'
alias cw-test='node .github/scripts/test-local.js'
alias cw-verify='bash .github/scripts/verify-setup.sh'
alias cw-trigger='gh workflow run codewiki-sync.yml'
alias cw-watch='gh run watch'
alias cw-logs='gh run view --log'
alias cw-list='gh run list --workflow=codewiki-sync.yml'
```

Uso:
```bash
cw-trigger  # Ejecutar workflow
cw-watch    # Ver en tiempo real
cw-logs     # Ver logs
```

---

### Scripts NPM

Agrega a tu `package.json` del repo principal:

```json
{
  "scripts": {
    "codewiki:setup": "node .github/scripts/codewiki-setup.js",
    "codewiki:manage": "node .github/scripts/manage-workflow.js",
    "codewiki:test": "node .github/scripts/test-local.js",
    "codewiki:secrets": "node .github/scripts/setup-github-secrets.js"
  }
}
```

Uso:
```bash
npm run codewiki:setup
npm run codewiki:manage
```

---

## 📞 Ayuda

**¿Comando no funciona?**
1. Verifica que GitHub CLI esté instalado: `gh --version`
2. Verifica autenticación: `gh auth status`
3. Verifica que estés en un repo de GitHub
4. Lee los logs: `gh run view --log`

**¿Necesitas más ayuda?**
- Ver: [CODEWIKI_SETUP.md#troubleshooting](./CODEWIKI_SETUP.md#-troubleshooting)
- Abrir issue en GitHub

---

<div align="center">

**Comandos siempre a mano** 🚀

[README](./CODEWIKI_README.md) • [Setup](./CODEWIKI_SETUP.md) • [Quick Start](./CODEWIKI_QUICKSTART.md)

</div>
