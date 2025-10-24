# Coral Reef Casino — Sistema TITO

Sistema TITO (Ticket-In Ticket-Out) para casino pequeño. Incluye emisión y canje de vouchers, impresión térmica, lector de QR, auditoría y configuración.

## Características
- Emisión y validación de tickets (Mesa / Caja)
- Impresión en modo PDF o impresora térmica (Spooler Windows)
- Lectura y validación de QR con seguridad
- Auditoría de operaciones y reportes básicos
- Build portable de Windows con `electron-builder`

## Requisitos
- Node.js 18+ (recomendado 20)
- npm 9+
- Windows 10/11 para portable

## Instalación y ejecución
```bash
# Instalar dependencias
npm install

# Ejecutar la versión Pure (Electron)
npm run start:pure

# Ejecutar Electron con React (si aplica)
npm start
```

## Build portable (Windows)
Hay dos opciones:

1) Script npm directo:
```bash
npm run build:portable
```
Esto usa `electron-builder.portable.json` y genera `dist/CasinoVouchers.exe`.

2) Script auxiliar:
```bash
node make-portable.js
```

## CI/CD — GitHub Actions
El repo incluye un workflow en `.github/workflows/build-portable.yml` que:
- Corre en `windows-latest`.
- Instala dependencias con `npm ci`.
- Ejecuta `npm run build:portable`.
- Publica el artefacto generado (`dist/**`).

Se ejecuta automáticamente en cada push a `main` o manualmente con `workflow_dispatch`.

## Estructura relevante
- `Electron_Puro/` • Main de Electron puro + preload
- `Caja/` • Vistas HTML (caja, panel) y handlers
- `src/main/` • Proceso principal (IPC, servicios, seguridad)
- `src/renderer/` • Vistas React (Mesa, Caja, Auditoría)

## Entorno
- `.env.example` contiene las variables de entorno. Copiar a `.env` y ajustar.
- `.gitignore` evita subir `node_modules`, builds, bases de datos y `.env`.

## Scripts útiles
```bash
npm run start:pure       # Inicia Electron_Puro/main.js
npm run build:portable   # Construye ejecutable portable (Windows)
npm run build:pure:dir   # Empaqueta versión Pure en directorio
npm run test             # Ejecuta tests
```

## Licencia
ISC. Ver `package.json`.
