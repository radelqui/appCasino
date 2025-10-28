# Guía del Proyecto — Electron Puro (Coral Reef Casino TITO)

Este documento concentra las instrucciones del proyecto para evitar repetir indicaciones. Actualízalo aquí cuando cambien políticas, flujos o prioridades. No se hacen commits a GitHub salvo que el usuario lo indique explícitamente.

## Objetivo y Alcance
- Aplicación de **emisión y gestión de vouchers** (TITO) en modo **Electron Puro**.
- La **versión activa** es la "Pure": `npm start` carga `Electron_Puro/main.js` y la vista `pure/mesa.html`.
- Flujo principal: Mesa emite, Caja valida/canjea, Auditoría consulta.

## Políticas Operativas
- **Commits a GitHub**: solo cuando el usuario lo indique.
- **Branch**: `main` para cambios aprobados. PRs o tags se crean bajo instrucción.
- **Identidad Git**: Nombre `Supabase Casino`, Email `supabase.casino@huyghusrl.com` (ya configurado localmente).

## Estructura Clave
- `Electron_Puro/main.js`: Proceso principal, ventanas y gating por rol.
- `Electron_Puro/preload.js`: API segura expuesta al renderer.
- `pure/mesa.html`: Vista de Mesa (emisión y vista previa).
- `Caja/`: Handlers, base de datos local, vista y preload de Caja.
- `src/main/ipc/`: Handlers IPC (tickets, impresora, perfil, preview, roles).
- `src/main/utils/pdf-generator.js`: Generación de PDF del ticket.
- `scripts/preview-pdf.js`: Servidor opcional para vista previa vía HTTP (fallback/manual).
- `electron-builder.pure.json`: Config de build Pure.
- `.github/workflows/build-pure-portable.yml`: CI para build portable en Windows.

## Arranque y Pruebas Rápidas
- Arrancar app Pure: `npm start`
- Vista previa manual (opcional): `node scripts/preview-pdf.js` y abrir `http://localhost:8088/`
- Tests (si aplica): `npm test` (ver `jest.config.js` y tests en raíz).

## Vista Previa del Ticket (Mesa)
- La **vista previa** ahora usa el IPC `get-ticket-preview` directamente.
- Actualiza en tiempo real al cambiar: `Valor`, `Moneda`, `Mesa`, `Emitido por`.
- Perfil de impresión configurable: `get-print-profile` / `set-print-profile` (persistido en `userData`).

## Build y Artefactos
- Script local: `npm run build:pure:portable` (Electron Builder con `electron-builder.pure.json`).
- CI: cada push a `main` ejecuta "Build Pure Portable (Windows)" y sube el contenido de `dist/` como artefacto.

## Entorno y Variables
- `.env.example` con referencia de variables. Añadir `.env` según despliegue.

## Convenciones y Cómo Dejar Indicaciones
- Escribe nuevas instrucciones aquí, usando secciones y fechas.
- Si una instrucción impacta código, añade un subtítulo con: **Acción**, **Archivos**, **Scripts**, **Riesgos**.
- Ejemplo:
  - Fecha: 2025-10-24
  - Acción: Cambiar vista previa a IPC
  - Archivos: `pure/mesa.html`, `src/main/ipc/printerHandlers.js`
  - Scripts: `npm start`
  - Riesgos: Ninguno; sin dependencia de servidor HTTP

## Checklist Antes de Solicitar Commit
- [ ] App arranca (`npm start`) sin errores.
- [ ] Vista previa opera via IPC y refleja cambios de inputs.
- [ ] `.gitignore` excluye `node_modules`, `build`, `.env`, DB SQLite.
- [ ] No hay secretos en el repo.
- [ ] Mensaje de commit y alcance definidos.

## Próximos Pasos Sugeridos (opcional)
- Página de Config (ADMIN) con perfil de impresión y habilitar Caja (ya disponible en `Electron_Puro/config.html`).
- Renderizar esta guía en una ventana "Ayuda" o enlace desde el panel.
- Workflow adicional para empaquetar `build:pure:dir` como artefacto.

---
Autor: Equipo Coral Reef Casino · Última actualización: 2025-10-24
