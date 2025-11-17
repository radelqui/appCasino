# CodeWiki → NotebookLM Setup Guide

**Sistema automatizado para sincronizar documentación Markdown de GitHub a Google Docs para NotebookLM**

---

## 🎯 ¿Qué hace esto?

Cada vez que haces `git push` con cambios en archivos `.md`:
1. GitHub Actions detecta los cambios
2. Convierte los Markdown a Google Docs (preservando formato)
3. Los sube a tu carpeta de Google Drive
4. Listos para importar a NotebookLM

---

## 📋 Prerequisitos

1. Cuenta de Google Cloud Platform (gratuita)
2. Repositorio en GitHub
3. Google Drive

---

## 🚀 Configuración Inicial (Una sola vez)

### Paso 1: Crear Service Account en Google Cloud

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un proyecto nuevo o selecciona uno existente
3. Ve a **APIs & Services** → **Enable APIs and Services**
4. Habilita estas APIs:
   - Google Drive API
   - Google Docs API

5. Ve a **APIs & Services** → **Credentials**
6. Click en **Create Credentials** → **Service Account**
   - Name: `codewiki-sync`
   - Role: `Editor` (o `Project > Editor`)
   - Click **Done**

7. Click en la service account creada
8. Ve a la pestaña **Keys**
9. Click **Add Key** → **Create New Key** → **JSON**
10. Guarda el archivo JSON descargado (lo necesitarás después)

### Paso 2: Crear Carpeta en Google Drive

1. Ve a tu Google Drive
2. Crea una carpeta llamada `CodeWiki` (o el nombre que prefieras)
3. Haz click derecho en la carpeta → **Share**
4. Comparte con el email de la service account (aparece en el JSON, termina en `@*.iam.gserviceaccount.com`)
   - Dale permisos de **Editor**
5. Copia el **Folder ID** de la URL:
   ```
   https://drive.google.com/drive/folders/1a2b3c4d5e6f7g8h9i0j
                                            ^^^^^^^^^^^^^^^^^^^^
                                            Este es tu FOLDER_ID
   ```

### Paso 3: Configurar Secrets en GitHub

1. Ve a tu repositorio en GitHub
2. **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**

Crea estos dos secrets:

**Secret 1: GOOGLE_CREDENTIALS**
- Name: `GOOGLE_CREDENTIALS`
- Value: Abre el archivo JSON descargado en Paso 1 y copia TODO el contenido

**Secret 2: GOOGLE_FOLDER_ID**
- Name: `GOOGLE_FOLDER_ID`
- Value: El Folder ID que copiaste en Paso 2 (solo el ID, sin la URL)

---

## 📦 Copiar Archivos al Repositorio

Copia estos archivos a tu repositorio:

```
tu-repo/
├── .github/
│   ├── workflows/
│   │   └── codewiki-sync.yml          ← GitHub Action
│   └── scripts/
│       └── sync-to-drive.js           ← Script de sincronización
└── (tus archivos .md existentes)
```

---

## ✅ Verificar Instalación

### Test Manual

1. Commit y push los archivos:
   ```bash
   git add .github/
   git commit -m "feat: Add CodeWiki sync pipeline"
   git push
   ```

2. Ve a tu repositorio → **Actions**
3. Deberías ver el workflow `CodeWiki → NotebookLM Sync` ejecutándose

### Test de Contenido

1. Modifica cualquier archivo `.md` de tu repo:
   ```bash
   echo "# Test" >> TEST.md
   git add TEST.md
   git commit -m "test: CodeWiki sync"
   git push
   ```

2. Espera 1-2 minutos
3. Ve a tu carpeta `CodeWiki` en Google Drive
4. Deberías ver una subcarpeta con el nombre de tu repo
5. Dentro, tus archivos `.md` convertidos a Google Docs

---

## 🔄 Replicar en Otros Repositorios

Para agregar esto a otros repos, **solo necesitas**:

### Opción A: Copy-Paste (5 minutos)

1. Copia la carpeta `.github/` completa
2. Agrega los secrets `GOOGLE_CREDENTIALS` y `GOOGLE_FOLDER_ID` (mismos valores)
3. Push y listo

### Opción B: Script Automatizado

```bash
# Desde este repo
cd path/to/otro-repo

# Copiar archivos
cp -r path/to/este-repo/.github .

# Commit
git add .github/
git commit -m "feat: Add CodeWiki sync"
git push
```

Luego agrega los secrets en GitHub (mismos valores para todos los repos).

---

## 🎓 Usar con NotebookLM

### Opción 1: Importar Carpeta Completa (Recomendado)

1. Ve a [NotebookLM](https://notebooklm.google.com/)
2. Crea un nuevo notebook
3. Click en **Add Source** → **Google Drive**
4. Selecciona la carpeta de tu repositorio (ej: `CodeWiki/appCasino`)
5. NotebookLM importará todos los Google Docs automáticamente

**Ventaja:** Cada vez que se actualicen los docs, NotebookLM verá los cambios automáticamente.

### Opción 2: Importar Documentos Individuales

1. En NotebookLM, click **Add Source** → **Google Drive**
2. Selecciona documentos específicos
3. Puedes agregar hasta 50 documentos por notebook

---

## 🔧 Personalización

### Cambiar Qué Archivos Se Sincronizan

Edita [.github/workflows/codewiki-sync.yml](.github/workflows/codewiki-sync.yml):

```yaml
on:
  push:
    paths:
      - '**.md'           # Solo .md
      - 'docs/**.md'      # Solo en carpeta docs
      - '**.{md,txt}'     # .md y .txt
```

### Excluir Carpetas Específicas

Edita [.github/scripts/sync-to-drive.js](.github/scripts/sync-to-drive.js), línea ~75:

```javascript
if (!['node_modules', '.git', '.github', 'dist', 'build', 'temp'].includes(entry.name)) {
  // Agrega más carpetas a la lista
}
```

### Cambiar Estilo de los Documentos

Edita el CSS en [.github/scripts/sync-to-drive.js](.github/scripts/sync-to-drive.js), línea ~150:

```javascript
<style>
  body {
    font-family: 'Georgia', serif;  // Cambiar fuente
    line-height: 1.8;               // Cambiar espaciado
    // ... más estilos
  }
</style>
```

---

## 🐛 Troubleshooting

### Error: "Authentication failed"
- Verifica que el secret `GOOGLE_CREDENTIALS` tenga el JSON completo
- Verifica que las APIs estén habilitadas en Google Cloud

### Error: "Folder not found"
- Verifica que el `GOOGLE_FOLDER_ID` sea correcto
- Verifica que la service account tenga permisos de Editor en la carpeta

### Los archivos no se actualizan
- El workflow solo se ejecuta con cambios en archivos `.md`
- Puedes ejecutarlo manualmente: Actions → CodeWiki Sync → Run workflow

### El HTML se ve mal en Google Docs
- Google Docs tiene limitaciones con HTML complejo
- Markdown simple funciona mejor (evita HTML embebido)

---

## 📊 Logs y Monitoreo

Ver logs de sincronización:
1. GitHub → Actions → Click en el workflow run
2. Verás qué archivos se procesaron:
   ```
   📄 Processing: README.md
     ✅ Created: https://docs.google.com/document/d/...
   📄 Processing: ARCHITECTURE.md
     ↻ Updating existing doc: 1abc123...
     ✅ Updated: https://docs.google.com/document/d/...
   ```

---

## 💡 Tips y Best Practices

1. **Estructura clara**: Usa carpetas en tu repo para organizar docs
   ```
   docs/
   ├── architecture/
   ├── guides/
   └── api/
   ```

2. **README primero**: NotebookLM funciona mejor si el README está primero alfabéticamente

3. **Enlaces internos**: Usa rutas relativas en Markdown:
   ```markdown
   Ver [Arquitectura](./ARCHITECTURE.md)
   ```

4. **Tablas**: Usa Markdown tables, se convierten bien:
   ```markdown
   | Feature | Status |
   |---------|--------|
   | Auth    | ✅     |
   ```

5. **Código**: Usa code blocks con lenguaje:
   ````markdown
   ```javascript
   const foo = 'bar';
   ```
   ````

---

## 🚀 Características Avanzadas

### Agregar Metadatos Personalizados

Puedes agregar frontmatter YAML a tus Markdown:

```markdown
---
title: Mi Documento
author: Tu Nombre
version: 1.0
tags: [arquitectura, backend]
---

# Contenido...
```

El script lo preservará en el Google Doc.

### Sincronización Incremental

El script actual procesa todos los `.md` en cada push. Para optimizar:

```yaml
# En codewiki-sync.yml
on:
  push:
    paths:
      - '**.md'
```

Esto solo ejecuta el workflow si hay cambios en `.md`.

### Notificaciones

Para recibir notificaciones al finalizar:

```yaml
# Agregar al final de codewiki-sync.yml
- name: Notify on completion
  if: always()
  uses: 8398a7/action-slack@v3
  with:
    status: ${{ job.status }}
    webhook_url: ${{ secrets.SLACK_WEBHOOK }}
```

---

## 📚 Recursos

- [NotebookLM](https://notebooklm.google.com/)
- [Google Drive API Docs](https://developers.google.com/drive)
- [Marked.js (Markdown parser)](https://marked.js.org/)
- [GitHub Actions Docs](https://docs.github.com/actions)

---

## 🤝 Contribuir

¿Mejoras? ¿Bugs? Abre un issue o PR.

---

## 📄 Licencia

MIT - Úsalo como quieras

---

**¿Preguntas?** Abre un issue en GitHub.

**¡Happy documenting!** 🎉
