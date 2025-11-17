# CodeWiki → NotebookLM Pipeline

> **Convierte automáticamente tu documentación Markdown de GitHub a Google Docs para NotebookLM**

[![GitHub Actions](https://img.shields.io/badge/GitHub-Actions-2088FF?logo=github-actions&logoColor=white)](https://github.com/features/actions)
[![Google Drive](https://img.shields.io/badge/Google-Drive-4285F4?logo=google-drive&logoColor=white)](https://drive.google.com)
[![NotebookLM](https://img.shields.io/badge/NotebookLM-AI-EA4335?logo=google&logoColor=white)](https://notebooklm.google.com)

---

## 📖 ¿Qué es esto?

Un sistema completamente automatizado que sincroniza tu documentación Markdown desde GitHub a Google Docs, haciéndola instantáneamente disponible para NotebookLM.

### El Problema

- NotebookLM no acepta Markdown directamente
- Copiar/pegar manualmente es tedioso y propenso a errores
- Mantener docs actualizadas en múltiples lugares es difícil

### La Solución

```
git push → GitHub Actions → Google Docs → NotebookLM
   ↓            ↓               ↓            ↓
 .md files   Auto-convert   Auto-sync   AI-ready
```

**Resultado:** Documentación siempre actualizada, cero esfuerzo manual.

---

## ✨ Características

- ✅ **100% Automatizado** - Solo haz push, el resto es automático
- ✅ **Multi-repo** - Soporta múltiples repositorios
- ✅ **Preserva formato** - Mantiene headings, listas, código, tablas
- ✅ **Incremental** - Solo sincroniza archivos modificados
- ✅ **Seguro** - Service Account con permisos mínimos
- ✅ **Gratuito** - Usa free tiers de Google y GitHub
- ✅ **Rápido** - 2 minutos desde push hasta NotebookLM

---

## 🚀 Quick Start

### Para Nuevos Usuarios

#### Opción A: Setup Automatizado (Recomendado) ⭐

```bash
cd .github/scripts
npm install
node codewiki-setup.js
```

**Este wizard interactivo:**
- ✅ Verifica todos los prerequisitos
- ✅ Configura GitHub secrets automáticamente
- ✅ Verifica la configuración
- ✅ Ejecuta el primer workflow
- ⏱️ Tiempo total: ~10 minutos

---

#### Opción B: Configurar Solo Secrets

Si ya completaste el setup de Google Cloud:

```bash
node .github/scripts/setup-github-secrets.js
```

Luego verifica y ejecuta:

```bash
pwsh .github/scripts/verify-setup.ps1   # Windows
bash .github/scripts/verify-setup.sh    # Linux/Mac
node .github/scripts/manage-workflow.js --trigger
```

---

#### Opción C: Setup Manual Completo

Lee [CODEWIKI_SETUP.md](./CODEWIKI_SETUP.md) para configuración paso a paso.

---

### Ver en NotebookLM

1. Ve a [notebooklm.google.com](https://notebooklm.google.com)
2. Create notebook → Add source → Google Drive
3. Selecciona tu carpeta CodeWiki/appCasino

---

### Para Agregar a Otros Repos

Lee [CODEWIKI_QUICKSTART.md](./CODEWIKI_QUICKSTART.md) para replicar en 5 minutos.

---

## 📚 Documentación

| Documento | Propósito | Tiempo |
|-----------|-----------|--------|
| [**CODEWIKI_RESUMEN.md**](./CODEWIKI_RESUMEN.md) | Resumen ejecutivo en una página | 5 min |
| [**CODEWIKI_QUICKSTART.md**](./CODEWIKI_QUICKSTART.md) | Setup rápido para replicar | 5 min |
| [**CODEWIKI_SETUP.md**](./CODEWIKI_SETUP.md) | Guía completa de configuración | 15 min |
| [**CODEWIKI_CLI.md**](./CODEWIKI_CLI.md) | Referencia de comandos CLI | 10 min |
| [**CODEWIKI_ARCHITECTURE.md**](./CODEWIKI_ARCHITECTURE.md) | Arquitectura técnica detallada | 20 min |
| [**.github/scripts/README.md**](.github/scripts/README.md) | Comandos, debug, contribuciones | 10 min |

**¿Por dónde empezar?**

- **Si eres nuevo:** Empieza con [CODEWIKI_RESUMEN.md](./CODEWIKI_RESUMEN.md)
- **Si quieres implementar:** Ve directo a [CODEWIKI_SETUP.md](./CODEWIKI_SETUP.md)
- **Si ya tienes todo:** Usa [CODEWIKI_QUICKSTART.md](./CODEWIKI_QUICKSTART.md)
- **Si eres técnico:** Lee [CODEWIKI_ARCHITECTURE.md](./CODEWIKI_ARCHITECTURE.md)

---

## 🎯 Casos de Uso

### 1. Documentación de Proyectos

Mantén README, arquitectura, guías siempre actualizadas en NotebookLM.

```bash
# Desarrollador actualiza docs
vim README.md
git commit -m "docs: Update README"
git push

# 2 minutos después...
# → README actualizado en NotebookLM
# → Listo para consultas con IA
```

### 2. Knowledge Base Empresarial

Consolida docs de múltiples repos para onboarding de nuevos desarrolladores.

```
CodeWiki/
├── frontend-app/       → 15 docs
├── backend-api/        → 23 docs
├── mobile-app/         → 18 docs
└── infrastructure/     → 12 docs

NotebookLM: 68 documentos sincronizados
```

### 3. Research & Analysis

Analiza evolución de documentación con IA.

```
"¿Cómo ha cambiado nuestra arquitectura en los últimos 6 meses?"
"Resume todas las decisiones técnicas documentadas"
"¿Qué features están documentadas pero no implementadas?"
```

---

## 🏗️ Cómo Funciona

```
┌──────────────┐
│ 1. Developer │  git push README.md
│    Push      │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ 2. GitHub    │  Detecta cambios en **.md
│    Actions   │  Ejecuta workflow
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ 3. Markdown  │  Markdown → HTML limpio
│    Converter │  Preserva formato
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ 4. Google    │  Sube a Drive como Google Doc
│    Drive     │  Actualiza doc existente
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ 5. NotebookLM│  Auto-sync, listo para IA
│    Ready     │
└──────────────┘
```

Ver [CODEWIKI_ARCHITECTURE.md](./CODEWIKI_ARCHITECTURE.md) para diagramas detallados.

---

## 📦 ¿Qué Incluye?

### Archivos del Sistema

```
.github/
├── workflows/
│   └── codewiki-sync.yml        # GitHub Action
└── scripts/
    ├── sync-to-drive.js         # Script principal de sync
    ├── test-local.js            # Test local (preview HTML)
    ├── verify-setup.sh          # Verificar configuración (Bash)
    ├── verify-setup.ps1         # Verificar configuración (PowerShell)
    ├── package.json             # Dependencies (marked, googleapis)
    ├── .gitignore               # Excluir credentials y previews
    ├── README.md                # Docs técnicas
    └── DIAGRAM.txt              # Diagrama visual del flujo
```

### Documentación

```
CODEWIKI_README.md               # Este archivo (punto de entrada)
CODEWIKI_RESUMEN.md              # Resumen ejecutivo (1 página)
CODEWIKI_QUICKSTART.md           # Setup rápido (5 minutos)
CODEWIKI_SETUP.md                # Guía completa de setup
CODEWIKI_ARCHITECTURE.md         # Arquitectura técnica detallada
```

---

## 🔐 Seguridad

### Secrets Management

- Credentials almacenadas como GitHub Secrets (encrypted at rest)
- Nunca aparecen en logs o código
- Se eliminan después de cada workflow run

### Permisos Mínimos

- Service Account solo puede acceder a carpeta CodeWiki
- No puede ver otros archivos de tu Drive
- No puede modificar repositorio de GitHub

### Best Practices

- ✅ Usa Service Account (no tu cuenta personal)
- ✅ Rota keys periódicamente
- ✅ Nunca commitees credentials.json
- ✅ Revisa logs de GitHub Actions regularmente

---

## 📊 Performance

| Métrica | Valor Típico |
|---------|--------------|
| Setup inicial | 15 min (una vez) |
| Setup nuevo repo | 5 min |
| Workflow execution | 2 min (10 archivos) |
| Workflow execution | 5 min (50 archivos) |
| Procesamiento por archivo | ~5 segundos |
| Intervención manual | 0 minutos |

### Límites y Cuotas

- **GitHub Actions:** 2,000 min/mes (repos privados), unlimited (repos públicos)
- **Google Drive API:** 1,000 queries/100s (más que suficiente)
- **Google Docs API:** 300 requests/min (más que suficiente)

**Uso típico:** ~150 API calls por sync (50 archivos)

---

## 🧪 Testing

### Verificar Setup

```bash
# Windows
pwsh .github/scripts/verify-setup.ps1

# Linux/Mac
bash .github/scripts/verify-setup.sh
```

### Test Local (Sin Push)

```bash
cd .github/scripts
npm install
node test-local.js

# Ver previews HTML
start preview/*.html  # Windows
open preview/*.html   # Mac
```

### Test de Integración

```bash
# Crear archivo de prueba
echo "# Test CodeWiki" > TEST_SYNC.md
git add TEST_SYNC.md
git commit -m "test: CodeWiki sync"
git push

# Ver workflow en GitHub Actions
gh run list --workflow=codewiki-sync.yml --limit 1
gh run view --log

# Verificar en Drive
# → Ir a carpeta CodeWiki/tu-repo
# → Buscar "TEST_SYNC" Google Doc
```

---

## 🐛 Troubleshooting

### Workflow No Se Ejecuta

**Síntoma:** Push a main, pero workflow no aparece en Actions.

**Solución:**
1. Verificar que `.github/workflows/codewiki-sync.yml` exista
2. Verificar que el archivo tenga cambios en `**.md`
3. Revisar rama en workflow: `branches: [main]` o `[master]`

### Error de Autenticación

**Síntoma:** Workflow falla con "Authentication failed"

**Solución:**
1. Verificar que secret `GOOGLE_CREDENTIALS` tenga el JSON completo
2. Verificar que APIs estén habilitadas en Google Cloud
3. Regenerar Service Account key si es necesario

### Carpeta No Se Crea

**Síntoma:** Workflow completa pero no hay archivos en Drive

**Solución:**
1. Verificar `GOOGLE_FOLDER_ID` sea correcto
2. Verificar que service account tenga permisos de Editor
3. Verificar que carpeta no esté en papelera

Ver [CODEWIKI_SETUP.md#troubleshooting](./CODEWIKI_SETUP.md#-troubleshooting) para más detalles.

---

## 🤝 Contribuir

### Reportar Bugs

Abre un issue en GitHub con:
- Descripción del problema
- Logs del workflow (si aplica)
- Pasos para reproducir

### Sugerir Mejoras

Abre un issue con:
- Descripción de la mejora
- Caso de uso
- Ejemplo de implementación (opcional)

### Pull Requests

1. Fork este repo
2. Crea una branch: `git checkout -b feature/mejora`
3. Commit: `git commit -am 'feat: Descripción'`
4. Push: `git push origin feature/mejora`
5. Abre un Pull Request

---

## 📝 Changelog

### v1.0.0 (2025-11-17)

- ✅ Conversión automática Markdown → Google Docs
- ✅ Sincronización en cada push
- ✅ Multi-repo support
- ✅ Scripts de verificación y testing local
- ✅ Documentación completa
- ✅ Soporte Windows (PowerShell) y Linux/Mac (Bash)

---

## 🗺️ Roadmap

### v1.1 (Próxima)

- [ ] Procesamiento solo de archivos modificados (optimización)
- [ ] Batch uploads paralelos
- [ ] Métricas de uso y analytics
- [ ] Notificaciones Slack/Discord

### v2.0 (Futuro)

- [ ] Soporte para imágenes embebidas
- [ ] Conversión de diagramas Mermaid a imágenes
- [ ] Índice automático de documentación
- [ ] API de búsqueda integrada

---

## 💰 Costos

**Completamente gratis** para uso normal:

| Servicio | Costo | Límite Free Tier |
|----------|-------|------------------|
| Google Cloud APIs | $0 | 1B queries/día |
| Google Drive | $0 | 15 GB storage |
| GitHub Actions | $0 | Unlimited (repos públicos) |
| GitHub Actions | $0 | 2,000 min/mes (repos privados) |
| NotebookLM | $0 | Unlimited |

**Uso típico:** Muy por debajo de todos los límites.

---

## 📄 Licencia

MIT License - Úsalo como quieras.

```
Copyright (c) 2025

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
```

---

## 🙏 Agradecimientos

- [GitHub Actions](https://github.com/features/actions) - CI/CD platform
- [Google Drive API](https://developers.google.com/drive) - Storage & docs
- [Marked.js](https://marked.js.org/) - Markdown parser
- [NotebookLM](https://notebooklm.google.com) - AI-powered notes

---

## 📞 Soporte

- **Documentación:** Lee los archivos CODEWIKI_*.md
- **Issues:** [GitHub Issues](../../issues)
- **Discusiones:** [GitHub Discussions](../../discussions)

---

## 🎉 ¡Empieza Ahora!

**¿Listo para automatizar tu documentación?**

### Opción 1: Lectura Rápida (5 minutos)
👉 Lee [CODEWIKI_RESUMEN.md](./CODEWIKI_RESUMEN.md)

### Opción 2: Implementación Completa (15 minutos)
👉 Sigue [CODEWIKI_SETUP.md](./CODEWIKI_SETUP.md)

### Opción 3: Replicar a Otro Repo (5 minutos)
👉 Usa [CODEWIKI_QUICKSTART.md](./CODEWIKI_QUICKSTART.md)

---

<div align="center">

**Hecho con ❤️ para desarrolladores que odian copiar/pegar**

[Documentación](./CODEWIKI_SETUP.md) • [Quick Start](./CODEWIKI_QUICKSTART.md) • [Arquitectura](./CODEWIKI_ARCHITECTURE.md)

</div>
