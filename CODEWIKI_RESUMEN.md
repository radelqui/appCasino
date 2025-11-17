# CodeWiki → NotebookLM - Resumen Ejecutivo

**Sistema automatizado para convertir documentación Markdown a NotebookLM**

---

## ✨ Qué Hace

Cada vez que haces `git push` con cambios en archivos `.md`:

```
GitHub Push → GitHub Actions → Google Docs → NotebookLM
    ↓              ↓                ↓            ↓
  .md files   Convierte MD     Sube a Drive   Listo para IA
```

**Resultado:** Tu documentación siempre actualizada en NotebookLM sin esfuerzo manual.

---

## 🎯 Ventajas

| Antes | Después |
|-------|---------|
| Copiar/pegar manual | Automático |
| Docs desactualizadas | Siempre actualizadas |
| Markdown no compatible | Google Docs nativo |
| Sincronizar 10 repos = 30 min | Sincronizar 10 repos = 0 min |

---

## 📦 Qué Incluye

### Archivos Creados

```
.github/
├── workflows/
│   └── codewiki-sync.yml           # GitHub Action (automatización)
└── scripts/
    ├── sync-to-drive.js            # Script principal
    ├── test-local.js               # Test local
    ├── package.json                # Dependencies
    └── README.md                   # Docs técnicas

CODEWIKI_SETUP.md                   # Guía completa de setup
CODEWIKI_QUICKSTART.md              # Setup en 5 minutos
CODEWIKI_ARCHITECTURE.md            # Arquitectura técnica
CODEWIKI_RESUMEN.md                 # Este archivo
```

---

## 🚀 Cómo Empezar

### Setup Inicial (Una sola vez - 15 minutos)

1. **Google Cloud Console**
   - Crear Service Account
   - Habilitar Drive API y Docs API
   - Descargar JSON credentials

2. **Google Drive**
   - Crear carpeta `CodeWiki`
   - Compartir con service account
   - Copiar Folder ID

3. **GitHub Secrets**
   - Agregar `GOOGLE_CREDENTIALS` (el JSON)
   - Agregar `GOOGLE_FOLDER_ID` (el ID)

Ver [CODEWIKI_SETUP.md](./CODEWIKI_SETUP.md) para pasos detallados.

### Agregar a Nuevo Repo (5 minutos)

```bash
# 1. Copiar archivos
cp -r .github otro-repo/

# 2. Agregar secrets en GitHub UI (reusar mismos valores)

# 3. Push
cd otro-repo
git add .github/
git commit -m "feat: Add CodeWiki sync"
git push
```

Ver [CODEWIKI_QUICKSTART.md](./CODEWIKI_QUICKSTART.md) para guía rápida.

---

## 🎓 Usar con NotebookLM

1. Ir a [notebooklm.google.com](https://notebooklm.google.com)
2. Create notebook
3. Add source → Google Drive → Seleccionar carpeta del repo
4. Listo

**Los docs se actualizan automáticamente con cada push.**

---

## 🔧 Configuración Recomendada

### Para Repos con Mucha Documentación

Sincronizar solo carpeta `docs/`:

```yaml
# .github/workflows/codewiki-sync.yml
on:
  push:
    paths:
      - 'docs/**.md'
```

### Para Proyectos Pequeños

Sincronizar todos los `.md` (configuración actual):

```yaml
on:
  push:
    paths:
      - '**.md'
```

---

## 📊 Métricas de Rendimiento

| Métrica | Valor |
|---------|-------|
| Setup inicial | 15 min (una vez) |
| Setup nuevo repo | 5 min |
| Tiempo de sync (10 archivos) | 2 min |
| Tiempo de sync (50 archivos) | 5 min |
| Intervención manual | 0 min |

---

## 🔐 Seguridad

- ✅ Credentials nunca expuestas en código
- ✅ Service Account con permisos mínimos
- ✅ Solo acceso a carpeta CodeWiki
- ✅ Secrets encriptados en GitHub
- ✅ Credentials eliminadas después de cada run

---

## 💰 Costos

**Gratis** para uso normal:

- Google Cloud: Free tier (suficiente para 1000s de syncs/día)
- GitHub Actions: Free para repos públicos, 2000 min/mes para privados
- Google Drive: 15GB gratis
- NotebookLM: Gratis

---

## 🐛 Troubleshooting Rápido

| Problema | Solución |
|----------|----------|
| Workflow no aparece | Verificar que `.github/workflows/codewiki-sync.yml` exista |
| Error de autenticación | Verificar secret `GOOGLE_CREDENTIALS` |
| Carpeta no se crea | Verificar permisos de service account en Drive |
| Docs no se actualizan | Verificar que haya cambios en archivos `.md` |

Ver [CODEWIKI_SETUP.md#troubleshooting](./CODEWIKI_SETUP.md#-troubleshooting) para más detalles.

---

## 📚 Documentación Completa

| Documento | Propósito |
|-----------|-----------|
| [CODEWIKI_SETUP.md](./CODEWIKI_SETUP.md) | Setup paso a paso, troubleshooting, personalización |
| [CODEWIKI_QUICKSTART.md](./CODEWIKI_QUICKSTART.md) | Setup rápido en 5 minutos |
| [CODEWIKI_ARCHITECTURE.md](./CODEWIKI_ARCHITECTURE.md) | Arquitectura técnica, diagramas, performance |
| [.github/scripts/README.md](.github/scripts/README.md) | Comandos útiles, debug, contribuciones |

---

## 🎯 Casos de Uso

### 1. Documentación de Proyectos

Mantén README, arquitectura, guías actualizadas en NotebookLM para consultas rápidas con IA.

### 2. Knowledge Base Empresarial

Consolida docs de múltiples repos en un solo lugar para onboarding de nuevos devs.

### 3. Research & Analysis

Analiza evolución de docs con NotebookLM (comparar versiones, extraer insights).

### 4. Technical Writing

Escribe en Markdown (familiar), consume en Google Docs (formateado), analiza con IA (NotebookLM).

---

## ✅ Checklist de Implementación

### Setup Inicial
- [ ] Service Account creada
- [ ] APIs habilitadas (Drive + Docs)
- [ ] Carpeta CodeWiki creada en Drive
- [ ] Service account con permisos en carpeta
- [ ] Secrets configurados en GitHub

### Primer Repo
- [ ] Archivos `.github/` copiados
- [ ] Workflow ejecutado exitosamente
- [ ] Docs aparecen en Drive
- [ ] Docs importados en NotebookLM

### Siguientes Repos
- [ ] Archivos `.github/` copiados
- [ ] Secrets reutilizados
- [ ] Push realizado
- [ ] Verificación en Drive

---

## 🚀 Próximos Pasos

1. **Ahora:** Lee [CODEWIKI_SETUP.md](./CODEWIKI_SETUP.md) para setup detallado
2. **Después:** Sigue [CODEWIKI_QUICKSTART.md](./CODEWIKI_QUICKSTART.md) para implementar
3. **Opcional:** Lee [CODEWIKI_ARCHITECTURE.md](./CODEWIKI_ARCHITECTURE.md) para entender profundidad técnica

---

## 📞 Soporte

- **Issues:** Abre un issue en GitHub
- **Preguntas:** Ver troubleshooting en docs
- **Contribuciones:** PRs bienvenidos

---

## 🎉 Resultado Final

```
Haces push → 2 minutos después → Docs en NotebookLM

Sin copiar/pegar
Sin formato manual
Sin sincronización manual
Sin esfuerzo

Solo escribir Markdown y push.
```

**Eso es todo.** 🚀

---

**Creado con:** GitHub Actions + Google Drive API + NotebookLM

**Licencia:** MIT

**¿Listo para empezar?** → [CODEWIKI_SETUP.md](./CODEWIKI_SETUP.md)
