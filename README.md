# Sistema TITO para Casino

Sistema completo de Ticket-In Ticket-Out (TITO) para casino pequeño con 3 mesas y caja manual. Desarrollado con metodología TDD usando Electron.js, React, Node.js, SQLite local y sincronización con Supabase.

## 🎯 Características Principales

- **Emisión de tickets** con valor monetario real (DOP y USD)
- **Códigos QR seguros** con validación criptográfica
- **Impresión térmica** en formato TITO estándar (156x65mm)
- **Lectura de QR** con dispositivos USB o modo teclado
- **Base de datos local** (SQLite) para operación offline
- **Sincronización en la nube** con Supabase
- **Interfaz moderna** con React y diseño responsive
- **Arquitectura robusta** con manejo de errores y logging

## 🏗️ Arquitectura del Sistema

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Mesa 1-3      │    │      Caja       │    │   Supabase      │
│                 │    │                 │    │   (Cloud DB)    │
│ • Electron App  │    │ • Electron App  │    │                 │
│ • Genera QR     │◄──►│ • Escanea QR    │◄──►│ • Sincronización│
│ • Imprime       │    │ • Valida Ticket │    │ • Respaldo      │
│ • SQLite Local  │    │ • Procesa Pago  │    │ • Auditoría     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🔧 Tecnologías Utilizadas

### Frontend
- **React 18** - Interfaz de usuario moderna
- **CSS3** - Estilos con gradientes y glassmorphism
- **Responsive Design** - Compatible con tablets y PC

### Backend
- **Electron.js** - Aplicación desktop multiplataforma
- **Node.js** - Runtime del lado del servidor
- **Better-SQLite3** - Base de datos local rápida

### Hardware Integration
- **Impresora térmica** - Epson TM-T20II (recomendada)
- **Lector QR** - Honeywell Voyager 1400g (recomendado)
- **Tablets Windows** - Surface Go 3 o equivalente

### Cloud & Database
- **Supabase** - Backend as a Service con PostgreSQL
- **PDF-lib** - Generación de tickets en PDF
- **QRCode** - Generación de códigos QR seguros

## 📋 Requisitos del Sistema

### Mínimos
- **OS:** Windows 10/11, macOS 10.14+, Ubuntu 18.04+
- **RAM:** 4GB (8GB recomendado)
- **Almacenamiento:** 2GB libres
- **Red:** WiFi o Ethernet para sincronización

### Hardware Recomendado
- **Tablet:** Microsoft Surface Go 3 o similar
- **Impresora:** Epson TM-T20II o compatible térmica
- **Lector QR:** Honeywell Voyager 1400g USB
- **Papel:** Térmico grado TM1075 (156x65mm)

## 🚀 Instalación y Configuración

### 1. Clonar e Instalar Dependencias

```bash
git clone <repository-url>
cd tito-casino-system
npm install
```

### 2. Configurar Variables de Entorno

```bash
cp .env.example .env
```

Editar `.env` con tus credenciales:

```env
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key

# Security
QR_SECRET=your-secret-key-for-qr-hashing

# Hardware
PRINTER_NAME=TM-T20II
SQLITE_DB_PATH=./data/tito.db

# App
NODE_ENV=development
CASINO_NAME=Casino El Paraíso
```

### 3. Configurar Base de Datos en Supabase

1. Crear proyecto en [Supabase](https://supabase.com)
2. Ejecutar el script SQL proporcionado:

```sql
-- Ver src/main/database/schema.sql para el script completo
CREATE TABLE tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number VARCHAR(50) UNIQUE NOT NULL,
  valor DECIMAL(10,2) NOT NULL,
  moneda VARCHAR(3) NOT NULL CHECK (moneda IN ('DOP', 'USD')),
  -- ... más campos
);
```

### 4. Ejecutar en Desarrollo

```bash
# Terminal 1: React development server
npm run react-start

# Terminal 2: Electron app
npm run electron-dev
```

### 5. Construir para Producción

```bash
npm run build
```

Esto genera un instalador en `dist/` listo para instalar en las tablets.

## 🎫 Uso del Sistema

### Aplicación Mesa

1. **Seleccionar mesa** (1, 2 o 3)
2. **Elegir moneda** (DOP o USD)
3. **Ingresar valor** del ticket
4. **Generar e imprimir** ticket
5. **Entregar al cliente**

### Aplicación Caja

1. **Mantener foco** en campo de entrada
2. **Escanear QR** del ticket cliente
3. **Verificar información** mostrada
4. **Procesar pago** si es válido
5. **Entregar efectivo** al cliente

## 🧪 Testing

El proyecto incluye tests completos con metodología TDD:

```bash
# Ejecutar todos los tests
npm test

# Tests con coverage
npm run test:coverage

# Tests en modo watch
npm run test:watch
```

### Estructura de Tests

```
tests/
├── unit/               # Tests unitarios
│   ├── qr-generator.test.js
│   ├── sqlite.test.js
│   └── pdf-generator.test.js
├── integration/        # Tests de integración
└── e2e/               # Tests end-to-end
```

## 📊 Funcionalidades del Sistema

### Emisión de Tickets (Mesa)
- ✅ Generación de números únicos
- ✅ Códigos QR con hash de seguridad
- ✅ Soporte multi-moneda (DOP/USD)
- ✅ Impresión térmica automática
- ✅ Validación de entrada
- ✅ Estadísticas en tiempo real

### Validación y Canje (Caja)
- ✅ Lectura QR por hardware o teclado
- ✅ Validación criptográfica
- ✅ Verificación de estado
- ✅ Procesamiento de pagos
- ✅ Auditoría completa
- ✅ Interfaz intuitiva

### Gestión de Datos
- ✅ SQLite para operación offline
- ✅ Sincronización con Supabase
- ✅ Respaldo automático
- ✅ Reportes y estadísticas
- ✅ Manejo de concurrencia
- ✅ Logs detallados

## 🔒 Seguridad

### Nivel de Ticket
- **Hash HMAC-SHA256** para integridad
- **Números únicos** no predecibles
- **Validación temporal** de escaneos
- **Estado inmutable** una vez canjeado

### Nivel de Aplicación
- **Autenticación** por roles
- **Comunicación HTTPS** con Supabase
- **Logs de auditoría** completos
- **Validación de entrada** estricta

### Nivel de Hardware
- **Papel térmico** con marcas de agua
- **Impresoras dedicadas** no compartidas
- **Lectores QR** certificados
- **Red local** segura

## 📈 Monitoreo y Reportes

### Estadísticas en Tiempo Real
- Tickets emitidos por mesa
- Valores totales por moneda
- Tickets canjeados vs pendientes
- Rendimiento por periodo

### Reportes Disponibles
- Resumen diario/semanal/mensual
- Análisis por mesa y cajero
- Detección de anomalías
- Exportación a CSV/PDF

## 🛠️ Mantenimiento

### Tareas Rutinarias
- **Limpieza de archivos temporales** (automática)
- **Sincronización forzada** (manual/automática)
- **Verificación de impresoras** (diaria)
- **Respaldo de base local** (semanal)

### Solución de Problemas
- **Modo offline** para contingencias
- **Logs detallados** para debugging
- **Herramientas de diagnóstico** integradas
- **Documentación técnica** completa

## 📞 Soporte

### Documentación
- `docs/` - Documentación técnica completa
- `README.md` - Este archivo
- Comentarios en código fuente

### Logs y Debugging
- Logs automáticos en `logs/`
- Console logging en desarrollo
- Error tracking integrado

### Contacto
Para soporte técnico o consultas sobre implementación, revisar la documentación en `docs/` o consultar los logs del sistema.

## 📜 Licencia

Este proyecto está desarrollado para uso interno del casino. Todos los derechos reservados.

## 🔄 Changelog

### v1.0.0 (Actual)
- ✅ Sistema completo TITO funcional
- ✅ Apps Mesa y Caja implementadas
- ✅ Integración hardware completa
- ✅ Base de datos local y remota
- ✅ Tests TDD completos
- ✅ Documentación técnica

### Próximas Versiones
- 🔄 Dashboard administrativo web
- 🔄 Reportes avanzados con gráficos
- 🔄 Integración con sistemas POS existentes
- 🔄 API REST para integraciones externas
- 🔄 App móvil para supervisión

---

**Desarrollado con ❤️ para Casino El Paraíso**
