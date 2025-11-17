# CodeWiki Scripts

Scripts para el pipeline CodeWiki → NotebookLM

---

## 📁 Archivos

### Scripts Principales

- **codewiki-setup.js** - 🚀 Setup wizard completo (recomendado para nuevos usuarios)
- **setup-github-secrets.js** - 🔐 Configurar GitHub secrets automáticamente
- **manage-workflow.js** - 🔧 Gestionar y monitorear workflows
- **sync-to-drive.js** - ⚙️ Script principal que se ejecuta en GitHub Actions
- **test-local.js** - 🧪 Test local antes de hacer push
- **verify-setup.sh** / **verify-setup.ps1** - ✅ Verificar configuración

### Configuración

- **package.json** - Dependencies para los scripts

---

## 🚀 Quick Start

### Setup Completo (Recomendado)

```bash
cd .github/scripts
npm install
node codewiki-setup.js
```

Este wizard interactivo te guiará por todos los pasos.

### Solo Configurar Secrets

Si ya tienes todo configurado y solo necesitas agregar los secrets:

```bash
node setup-github-secrets.js
```

### Gestionar Workflows

```bash
# Modo interactivo (menú)
node manage-workflow.js

# CLI directo
node manage-workflow.js --trigger    # Ejecutar workflow
node manage-workflow.js --watch      # Ver en tiempo real
node manage-workflow.js --logs       # Ver logs
node manage-workflow.js --list       # Listar runs
```

---

## 🧪 Testear Localmente

Antes de hacer push, puedes testear la conversión localmente:

```bash
# Instalar dependencias
cd .github/scripts
npm install

# Ejecutar test local
node test-local.js

# Ver previews
open preview/*.html  # Mac
start preview/*.html # Windows
xdg-open preview/*.html # Linux
```

Esto creará archivos HTML en `.github/scripts/preview/` que puedes abrir en tu navegador para ver cómo se verán en Google Docs.

---

## 🔧 Comandos Útiles

### Ejecutar sync manualmente (requiere configuración)

```bash
cd .github/scripts
npm install

# Configurar variables
export GOOGLE_FOLDER_ID="tu-folder-id"
export REPO_NAME="nombre-repo"
export GOOGLE_APPLICATION_CREDENTIALS="path/to/credentials.json"

# Ejecutar
node sync-to-drive.js
```

### Listar archivos Markdown que se sincronizarán

```bash
find . -name "*.md" \
  -not -path "*/node_modules/*" \
  -not -path "*/.git/*" \
  -not -path "*/dist/*" \
  -not -path "*/build/*"
```

### Ver logs de última sincronización en GitHub

```bash
# Requiere GitHub CLI (gh)
gh run list --workflow=codewiki-sync.yml --limit 1
gh run view --log
```

---

## 📊 Monitoreo

### Ver estado de workflows

```bash
# Ver últimos 5 runs
gh run list --workflow=codewiki-sync.yml --limit 5

# Ver detalles de un run específico
gh run view RUN_ID

# Ver logs
gh run view RUN_ID --log
```

### Cancelar workflow en ejecución

```bash
gh run cancel RUN_ID
```

### Re-ejecutar workflow fallido

```bash
gh run rerun RUN_ID
```

---

## 🐛 Debug

### Verificar que las APIs estén habilitadas

```bash
# Requiere gcloud CLI
gcloud services list --enabled --project=YOUR_PROJECT_ID | grep drive
gcloud services list --enabled --project=YOUR_PROJECT_ID | grep docs
```

### Verificar permisos de Service Account

```bash
# Ver info de la service account
gcloud iam service-accounts describe SERVICE_ACCOUNT_EMAIL

# Ver permisos
gcloud projects get-iam-policy YOUR_PROJECT_ID \
  --flatten="bindings[].members" \
  --filter="bindings.members:SERVICE_ACCOUNT_EMAIL"
```

### Test de conexión a Google Drive

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

## 🔐 Seguridad

### Rotar Service Account Key

Si necesitas rotar la key:

1. Ir a Google Cloud Console → Service Accounts
2. Click en la service account
3. Keys tab → Add Key → Create new key → JSON
4. Actualizar secret `GOOGLE_CREDENTIALS` en GitHub
5. Eliminar key antigua

### Verificar que no haya credentials en git

```bash
# Buscar posibles leaks
git log -p | grep -i "private_key"
git log -p | grep -i "service_account"

# Agregar a .gitignore si no está
echo "credentials.json" >> .gitignore
echo ".github/scripts/preview/" >> .gitignore
```

---

## 📦 Actualizar Dependencies

```bash
cd .github/scripts

# Ver versiones actuales
npm list

# Actualizar a últimas versiones
npm update

# Verificar vulnerabilidades
npm audit

# Fix automático
npm audit fix
```

---

## 🚀 Optimizaciones

### Procesar solo archivos modificados

Actualmente se procesan todos los `.md` en cada push. Para optimizar:

```javascript
// En sync-to-drive.js, agregar antes de findMarkdownFiles():

const { execSync } = require('child_process');

function getModifiedFiles() {
  try {
    const output = execSync('git diff --name-only HEAD~1 HEAD').toString();
    return output.split('\n')
      .filter(f => f.endsWith('.md'))
      .map(f => f.trim());
  } catch (error) {
    console.log('Could not get modified files, processing all');
    return null;
  }
}

const modifiedFiles = getModifiedFiles();
const filesToProcess = modifiedFiles || await findMarkdownFiles();
```

### Cache de npm dependencies

Ya está configurado en el workflow con `actions/setup-node@v4` que cachea automáticamente.

---

## 📚 Recursos

- [googleapis npm](https://www.npmjs.com/package/googleapis)
- [marked npm](https://www.npmjs.com/package/marked)
- [Google Drive API Reference](https://developers.google.com/drive/api/v3/reference)
- [Google Docs API Reference](https://developers.google.com/docs/api/reference/rest)

---

## 🤝 Contribuir

Mejoras al script:

1. Fork este repo
2. Crea una branch: `git checkout -b feature/mejora`
3. Commit: `git commit -am 'feat: Descripción'`
4. Push: `git push origin feature/mejora`
5. Crea un Pull Request

---

## 📄 Licencia

MIT
