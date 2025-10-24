# Diagrama de Relaciones - Base de Datos Casino TITO

## Estructura General

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│     TICKETS     │    │   OPERADORES    │    │    USUARIOS     │
├─────────────────┤    ├─────────────────┤    ├─────────────────┤
│ id (PK)         │    │ id (PK)         │    │ id (PK)         │
│ code (UNIQUE)   │    │ codigo (UNIQUE) │    │ username (UNIQUE)│
│ amount          │    │ nombre          │    │ password_hash   │
│ currency        │    │ pin             │    │ password_salt   │
│ mesa            │────│ mesa_asignada   │    │ role            │
│ estado          │    │ activo          │    │ activo          │
│ fecha_emision   │    │ fecha_registro  │    │ creado          │
│ fecha_cobro     │    └─────────────────┘    │ ultimo_acceso   │
│ cajero_id       │                           │ intentos_fallidos│
│ hash_seguridad  │                           │ bloqueado_hasta │
│ qr_data         │                           └─────────────────┘
│ sincronizado    │                                    │
│ notas           │                                    │
└─────────────────┘                                    │
         │                                             │
         │                                             │
         ▼                                             ▼
┌─────────────────┐                           ┌─────────────────┐
│    AUDITORIA    │◄──────────────────────────│ CONFIGURACION   │
├─────────────────┤                           ├─────────────────┤
│ id (PK)         │                           │ clave (PK)      │
│ tipo_evento     │                           │ valor           │
│ ticket_code (FK)│                           │ actualizado     │
│ usuario_id (FK) │                           │ descripcion     │
│ descripcion     │                           │ tipo_dato       │
│ fecha           │                           │ categoria       │
│ datos_adicionales│                          └─────────────────┘
│ ip_address      │
│ user_agent      │
│ session_id      │
│ nivel_criticidad│
│ modulo          │
│ accion          │
│ resultado       │
└─────────────────┘
```

## Relaciones Detalladas

### 1. TICKETS ↔ OPERADORES
- **Relación**: Muchos a Uno (N:1)
- **Campo de enlace**: `tickets.mesa` → `operadores.mesa_asignada`
- **Descripción**: Cada ticket es emitido por una mesa específica asignada a un operador

### 2. TICKETS ↔ AUDITORIA
- **Relación**: Uno a Muchos (1:N)
- **Campo de enlace**: `tickets.code` → `auditoria.ticket_code`
- **Descripción**: Cada ticket puede tener múltiples registros de auditoría

### 3. USUARIOS ↔ AUDITORIA
- **Relación**: Uno a Muchos (1:N)
- **Campo de enlace**: `usuarios.username` → `auditoria.usuario_id`
- **Descripción**: Cada usuario puede realizar múltiples acciones auditadas

### 4. CONFIGURACION ↔ AUDITORIA
- **Relación**: Uno a Muchos (1:N) (via triggers)
- **Descripción**: Los cambios en configuración se auditan automáticamente

## Flujo de Datos Principal

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   USUARIO   │───▶│   LOGIN     │───▶│   ACCIÓN    │───▶│  AUDITORIA  │
│  (Mesa/Caja)│    │ (Validación)│    │ (Ticket/    │    │ (Registro)  │
│             │    │             │    │  Config)    │    │             │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
       │                                       │
       │                                       ▼
       │                              ┌─────────────┐
       └─────────────────────────────▶│   TICKETS   │
                                      │ (Creación/  │
                                      │  Canje)     │
                                      └─────────────┘
```

## Tipos de Datos y Restricciones

### TICKETS
- `estado`: CHECK ('activo', 'usado', 'cancelado', 'expirado')
- `currency`: CHECK ('USD', 'DOP')
- `code`: UNIQUE, NOT NULL
- `amount`: DECIMAL(10,2), NOT NULL

### USUARIOS
- `role`: CHECK ('ADMIN', 'MESA', 'CAJA', 'AUDITOR')
- `username`: UNIQUE, NOT NULL
- `activo`: INTEGER (0/1)

### AUDITORIA
- `nivel_criticidad`: CHECK ('BAJO', 'MEDIO', 'ALTO', 'CRITICO')
- `resultado`: CHECK ('EXITO', 'FALLO', 'ADVERTENCIA')
- `datos_adicionales`: TEXT (JSON format)

### CONFIGURACION
- `tipo_dato`: CHECK ('STRING', 'NUMBER', 'BOOLEAN', 'JSON')
- `clave`: PRIMARY KEY

## Índices de Rendimiento

### Índices Principales
- `idx_ticket_code`: tickets(code) - Búsqueda rápida de tickets
- `idx_ticket_estado`: tickets(estado) - Filtrado por estado
- `idx_auditoria_fecha`: auditoria(fecha) - Consultas por fecha
- `idx_usuario_username`: usuarios(username) - Login rápido

### Índices de Auditoría
- `idx_auditoria_criticidad`: auditoria(nivel_criticidad)
- `idx_auditoria_modulo`: auditoria(modulo)
- `idx_auditoria_usuario`: auditoria(usuario_id)

## Triggers Automáticos

### 1. audit_config_changes
- **Activación**: AFTER UPDATE ON configuracion
- **Función**: Registra automáticamente cambios en configuración
- **Nivel**: ALTO

### 2. audit_user_creation
- **Activación**: AFTER INSERT ON usuarios
- **Función**: Registra creación de nuevos usuarios
- **Nivel**: ALTO

### 3. audit_ticket_status_change
- **Activación**: AFTER UPDATE OF estado ON tickets
- **Función**: Registra cambios de estado en tickets
- **Nivel**: Variable (BAJO/MEDIO/ALTO según estado)

## Categorías de Configuración

- **MONEDA**: Tasas de cambio y configuraciones monetarias
- **TICKETS**: Parámetros de tickets y vouchers
- **SEGURIDAD**: Configuraciones de seguridad y acceso
- **SISTEMA**: Configuraciones generales del sistema
- **AUDITORIA**: Parámetros de auditoría y logging

## Roles y Permisos

### ADMIN
- ✅ Acceso completo a todas las tablas
- ✅ Gestión de usuarios y configuración
- ✅ Acceso total a auditoría

### CAJA
- ✅ Gestión de tickets (canje, consulta)
- ✅ Consulta de auditoría limitada
- ❌ Modificación de configuración

### MESA
- ✅ Creación de tickets
- ✅ Consulta de tickets propios
- ❌ Acceso a auditoría

### AUDITOR
- ✅ Acceso completo a auditoría
- ✅ Consulta de todas las tablas
- ❌ Modificación de datos operativos