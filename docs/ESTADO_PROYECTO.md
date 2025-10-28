# 📄 Informe de Estado del Proyecto — Sistema de Vouchers

**Fecha:** 27 de octubre de 2025  
**Autor:** Programador (Claude Code)  
**Proyecto:** Gran Casino Sosúa — TITO / Vouchers

---

## 🧭 Resumen Ejecutivo
- La aplicación Electron Puro arranca y registra correctamente los handlers de Caja y Autenticación; la base SQLite local está operativa y unificada en `Caja/database.js` con migración automática desde esquemas legacy.
- Supabase está integrado de forma opcional; actualmente el entorno funciona en modo local por cierre de la conexión remota. Los métodos de login y operadores tienen compatibilidad local.
- La interfaz de Caja fue actualizada, conectada a IPC reales y valida/canjéa vouchers, además de mostrar estadísticas diarias. Vistas Mesa/Auditor/Admin existen pero requieren conexión completa y verificación.
- Hay scripts de arranque y build para variantes React y Puro, y dependencias de impresión, QR, HID/Serial y SQLite listas; faltan integrar impresión y validación por QR en UI.

---

## 📁 Árbol de Directorios (3 niveles, hasta 200 entradas)

```
├── .env.example
├── .github\
│   └── workflows\
│       ├── build-portable.yml
│       └── build-pure-portable.yml
├── .gitignore
├── .gitkeep
├── App.css
├── App.js
├── Caja\
│   ├── ARCHIVO ACTUALIZADO caja.txt
│   ├── caja.html
│   ├── cajaHandlers.js
│   ├── database.js
│   ├── panel.html
│   └── preload-caja.js
├── Diseño Ticket\
│   ├── Instaaldor portable
│   ├── diseño con logo.webp
│   ├── logo casino.webp
│   ├── plan diseño.txt
│   ├── preview (1).webp
│   ├── preview.webp
│   └── url del diseño\
│       └── urldiseño.txt
├── Electron_Puro\
│   ├── Arquitectura.txt
│   ├── auditoria.html
│   ├── authHandlers.js
│   ├── config.html
│   ├── main.js
│   └── preload.js
├── PROJECT_FILES.md
├── README.md
├── SYSTEM_SUMMARY.md
├── SqulInstrucciones\
│   └── user.txt
├── build\
│   └── index.html
├── chat241025.txt
├── constants.js
├── create-admin-user.js
├── database-diagram.md
├── database-schema.sql
├── dev.sh
├── docs\
│   ├── SOLICITUD_ESTADO_PROYECTO.md
│   └── guia-proyecto.md
├── electron-builder.portable.json
├── electron-builder.pure.json
├── index.css
├── index.html
├── index.js
├── install.sh
├── jest.config.js
├── main-flow.test.js
├── main.js
├── make-portable.js
├── manifest.json
├── package-lock.json
├── package.json
├── pdf-generator.test.js
├── planmaestro.txt
├── preload.js
├── public\
│   └── index.html
├── pure\
│   ├── app.js
│   ├── caja.html
│   ├── index.html
│   ├── main.js
│   ├── mesa.html
│   └── style.css
├── qr-generator.test.js
├── reports\
│   └── auth-status.md
├── script.py
├── script_1.py
├── script_10.py
├── script_11.py
├── script_12.py
├── script_13.py
├── script_14.py
├── script_15.py
├── script_16.py
├── script_17.py
├── script_18.py
├── script_19.py
├── script_2.py
├── script_3.py
├── script_4.py
├── script_5.py
├── script_6.py
├── script_7.py
├── script_8.py
├── script_9.py
├── scripts\
│   ├── preview-caja.js
│   ├── preview-pdf.js
│   └── serve-panel.js
├── setup.js
├── sqlite.test.js
├── src\
│   ├── index.js
│   ├── main\
│   │   ├── database\
│   │   ├── hardware\
│   │   ├── ipc\
│   │   ├── main.js
│   │   ├── preload.js
│   │   ├── security\
│   │   └── utils\
│   └── renderer\
│       ├── App.jsx
│       ├── styles.css
│       └── views\
├── statsHandlers.js
├── supabaseClient.js
├── syncHandlers.js
└── types.js
```

> Nota: Árbol resumido a 3 niveles para lectura operativa.

---

## 📦 Inventario y Descripción de Archivos (principales)

### Módulo Caja
- `Caja/database.js`: Base SQLite unificada. Tablas: `tickets`, `operadores`, `usuarios`, `auditoria`, `configuracion`. Métodos: creación/validación/canje de tickets, estadísticas, auditoría, usuarios y configuración; migración automática desde esquemas legacy.
- `Caja/cajaHandlers.js`: Handlers IPC `caja:*` (validar, canjear, stats, tickets por fecha, reporte de caja, backup, login operador).
- `Caja/preload-caja.js`: Preload que expone `window.api` para Caja, conectando con `ipcRenderer.invoke`.
- `Caja/caja.html`: UI de Caja actualizada. Validación/canje y estadísticas del día, navegación a Auditoría/Panel.
- `Caja/panel.html`: Panel sencillo para navegación.

### Electron Puro
- `Electron_Puro/main.js`: Entrada del modo Puro. Crea ventanas (`mesa`, `caja`, `auditoria`, `config`), gestiona roles, habilitación de Caja, registra handlers (generales y específicos).
- `Electron_Puro/authHandlers.js`: Autenticación global (`auth:*`): login/logout y CRUD de usuarios, con opción Supabase/Local.
- `Electron_Puro/preload.js`: Preload general para exponer `window.api` (roles, navegación, utilidades).
- `Electron_Puro/auditoria.html`, `config.html`, `Arquitectura.txt`: Vistas y documentación auxiliar.

### Integraciones y Utilidades
- `supabaseClient.js`: Cliente Supabase (login operador/usuario, creación de usuarios). Requiere `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` o `SUPABASE_ANON_KEY`.
- `scripts/serve-panel.js`: Servidor estático para previsualizar `Caja` y `panel` en `http://localhost:5512/`.
- `scripts/preview-caja.js`, `scripts/preview-pdf.js`: Previews y generación/visualización PDF.
- `src/main/*`: Infraestructura de la variante React (IPC/hardware/seguridad); usada en modo React+Electron.
- `pure/*`: Variante simple HTML/CSS/JS de UI.
- `database-schema.sql`, `database-diagram.md`: referencias de esquema.

### Metadatos, Build y Tests
- `package.json`: scripts de arranque/build y dependencias.
- `electron-builder.pure.json`, `electron-builder.portable.json`: configuración de builds.
- `sqlite.test.js`, `qr-generator.test.js`, `pdf-generator.test.js`, `main-flow.test.js`: tests.

---

## 🗃️ Estado de Bases de Datos

**Supabase**
- Integrado opcionalmente mediante `supabaseClient.js`. Requiere `.env` con `SUPABASE_URL` y clave (`SUPABASE_SERVICE_ROLE_KEY` o `SUPABASE_ANON_KEY`).
- Tablas esperadas: `operadores`, `usuarios`, `audit_logs` (según funciones actuales).
- Estado: conexión cerrada por ahora; el sistema opera en modo local.

**SQLite Local**
- Ubicación por defecto: `Caja/data/casino.db` (se puede configurar con `CASINO_DB_PATH`).
- Inicialización y migración automático en `Caja/database.js`.
- Tablas: `tickets`, `operadores`, `usuarios`, `auditoria`, `configuracion` (+ índices).  

---

## 🔩 Dependencias Instaladas y Scripts

**Dependencias** (`package.json`):
- Producción: `@supabase/supabase-js`, `better-sqlite3`, `bwip-js`, `crypto-js`, `dotenv`, `node-hid`, `node-thermal-printer`, `pdf-lib`, `pdf-to-printer`, `qrcode`, `react`, `react-dom`, `react-router-dom`, `serialport`, `sharp`.
- Desarrollo: `electron` (27.x), `electron-builder`, `jest`, `spectron`, `concurrently`, `wait-on`, `react-scripts`.

**Scripts de arranque/build**:
- `npm run start:pure` — Inicia Electron Puro (`Electron_Puro/main.js`).
- `npm run electron-dev` — React + Electron (dev server y app). 
- `npm run build:pure:portable` — Build portable modo Puro.
- `npm test` — Ejecuta pruebas.

> Nota: para usar `better-sqlite3` en Node CLI fuera de Electron, puede requerirse `npm rebuild --runtime=electron --target 27.3.11` por diferencias de binarios nativos.

---

## 🧩 Código Desarrollado y Funcionalidades

- Handlers de Caja y Autenticación operativos y registrados en modo Puro.
- Base SQLite local unificada, con migración legacy y métodos compatibles.
- UI de Caja actualizada: validación/canje/estadísticas y navegación.
- Fallback de roles persistido en SQLite si no existe módulo de seguridad.
- Previews estáticos para validar UI.

Pendientes/parciales:
- UI y lógica de Mesa/Auditor/Admin: conexión a IPC/database y flujos.
- Impresión de tickets y validación por QR (integración UI + servicios).
- Sincronización con Supabase (activar `.env` y definir políticas).
- Servidor REST/Express (si se requiere consumo externo).

---

## 🏗️ Estructura del Proyecto

- Variante Electron Puro: `Electron_Puro/*` con vistas HTML sencillas, preload e IPC.
- Variante React + Electron: `src/main/*` y `src/renderer/*`.
- Módulo Caja y base local: `Caja/*` con UI y DB unificada.

---

## ⚙️ Configuración

- `.env.example` disponible. Variables de entorno relevantes:
  - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` o `SUPABASE_ANON_KEY`
  - `USE_SUPABASE=true|false`
  - `CASINO_DB_PATH`
  - `QR_SECRET`
- Configuración de red/IPs: no hay detección IP específica implementada.

---

## ✅ Funcionalidades Implementadas (checklist)

- [ ] Servidor Express local
- [ ] Endpoints API REST
- [x] Base de datos SQLite
- [ ] Cliente Supabase (activo)
- [ ] Sistema de sincronización
- [ ] Detección online/offline
- [ ] Interfaz Mesa
- [x] Interfaz Caja
- [ ] Interfaz Auditor
- [ ] Interfaz Admin
- [x] Generación de QR (deps y pruebas)
- [ ] Validación de QR (UI integrada)
- [ ] Impresión de tickets (integración)
- [x] Sistema de roles (fallback SQLite)
- [x] Autenticación (local; Supabase opcional)
- [ ] Descubrimiento de IPs

---

## 🚧 Problemas o Bloqueos

- `better-sqlite3` puede requerir recompilación cuando se usa en Node CLI fuera de Electron por incompatibilidad binaria; dentro de Electron Puro está funcionando.
- Supabase desactivado; si se activa en Node <20 aparece aviso de deprecación (no bloqueante).
- No hay servidor REST; la app opera localmente via IPC.
- Impresión y lectura por QR/Scanner requieren integración adicional.

---

## 📈 Porcentaje de Completitud

- Base SQLite local: **85%**
- Caja (UI + IPC): **80%**
- Autenticación/Roles: **75%**
- Mesa: **40%**
- Auditoría (UI): **35%**
- Admin/Config: **30%**
- Supabase/Sync: **30%**
- QR/Impresión: **40%**
- Dev/Build/Portable: **70%**

---

## ▶️ Próximos Pasos Recomendados

1. Conectar UI de Mesa/Auditor/Admin a IPC y `CasinoDatabase` (flujo de emisión, reportes y auditoría visual).
2. Integrar impresión de tickets (`node-thermal-printer`/`pdf-to-printer`) y generación de recibos/modales de confirmación en Caja.
3. Añadir validación por QR y soporte de scanner (`node-hid`/`serialport`) con modo Scanner en UI.
4. Exponer estadísticas por estación/mesa con vistas agregadas en SQLite y handlers IPC dedicados.
5. Si se necesita consumo externo, levantar servidor Express con endpoints básicos (consulta de auditoría y reportes).
6. Activar Supabase con `.env` y definir sincronización controlada (bidireccional o por lotes), con estrategias de conflicto.
7. Estabilizar `better-sqlite3` para utilidades CLI (rebuild nativo acorde a Electron/Node usado).

---

## 🧪 Comandos Útiles

- Arranque modo Puro: 
  - `npx electron ./Electron_Puro/main.js`
  - `npm run start:pure`
- Preview estático de Caja:
  - `node scripts/serve-panel.js` y visitar `http://localhost:5512/caja.html`
- Rebuild nativo (si se usa CLI fuera de Electron):
  - `npm rebuild --runtime=electron --target 27.3.11`

---

> Este informe resume el estado actual y los pasos prácticos para avanzar con rapidez en las áreas críticas (Caja, impresión, QR y vistas administrativas/auditoría).
