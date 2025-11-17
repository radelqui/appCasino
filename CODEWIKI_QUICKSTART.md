# CodeWiki → NotebookLM Quick Start

**Copia esto a cualquier repo en 5 minutos**

---

## ✅ Checklist Pre-Setup

- [ ] Tienes Service Account de Google Cloud con las APIs habilitadas
- [ ] Tienes el JSON de credentials
- [ ] Tienes carpeta `CodeWiki` en Drive compartida con la service account
- [ ] Tienes el Folder ID

**¿No tienes esto?** Ve primero a [CODEWIKI_SETUP.md](./CODEWIKI_SETUP.md) (solo se hace una vez).

---

## 🚀 Setup en 5 Minutos

### 1. Copiar Archivos (30 segundos)

```bash
# Desde el repo donde ya está configurado
cd /path/to/tu-nuevo-repo

# Copiar carpeta completa
cp -r /path/to/appCasino/.github .

# Verificar
ls -la .github/workflows/codewiki-sync.yml
ls -la .github/scripts/sync-to-drive.js
```

### 2. Agregar Secrets en GitHub (2 minutos)

Ve a tu repo → **Settings** → **Secrets and variables** → **Actions**

Crea estos secrets (usa los mismos valores de appCasino):

```
GOOGLE_CREDENTIALS
└─ (pega el contenido completo del JSON)

GOOGLE_FOLDER_ID
└─ (ej: 1a2b3c4d5e6f7g8h9i0j)
```

### 3. Commit y Push (30 segundos)

```bash
git add .github/
git commit -m "feat: Add CodeWiki sync pipeline"
git push
```

### 4. Verificar (2 minutos)

1. Ve a **Actions** en GitHub
2. Deberías ver el workflow ejecutándose
3. Espera a que termine (verde ✅)
4. Ve a tu carpeta CodeWiki en Drive
5. Verás una subcarpeta con el nombre de tu repo
6. Dentro, todos tus `.md` convertidos a Google Docs

---

## ✅ Test Rápido

```bash
# Crear archivo de prueba
echo "# Test CodeWiki Sync" > TEST_SYNC.md
git add TEST_SYNC.md
git commit -m "test: CodeWiki sync"
git push

# Espera 1-2 minutos y verifica en Drive
```

---

## 🎓 Importar a NotebookLM

1. Ve a [notebooklm.google.com](https://notebooklm.google.com)
2. Create notebook
3. Add source → Google Drive
4. Selecciona tu carpeta (ej: `CodeWiki/tu-repo`)
5. Done

**Cada vez que hagas push con cambios en `.md`, los docs se actualizarán automáticamente.**

---

## 🔧 Configuración Opcional

### Solo sincronizar carpeta `docs/`

Edita `.github/workflows/codewiki-sync.yml`:

```yaml
on:
  push:
    paths:
      - 'docs/**.md'  # Solo carpeta docs
```

### Sincronización manual

Ve a Actions → CodeWiki Sync → Run workflow

---

## 🐛 Si algo falla

### Workflow no aparece
```bash
# Verifica que el archivo esté bien copiado
cat .github/workflows/codewiki-sync.yml
```

### Error de autenticación
- Verifica que GOOGLE_CREDENTIALS tenga el JSON completo
- Verifica que no haya espacios extra al copiar

### Carpeta no se crea
- Verifica que GOOGLE_FOLDER_ID sea el ID correcto
- Verifica que la service account tenga permisos de Editor

---

## 📚 Docs Completas

Ver [CODEWIKI_SETUP.md](./CODEWIKI_SETUP.md) para configuración detallada y troubleshooting.

---

**¡Listo en 5 minutos!** 🎉
