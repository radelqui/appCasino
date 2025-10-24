-- ============================================
-- ESQUEMA COMPLETO DE BASE DE DATOS SQLITE
-- Sistema Casino TITO - Ticket In Ticket Out
-- ============================================

-- Tabla de tickets (vouchers)
CREATE TABLE IF NOT EXISTS tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,                    -- Código único del ticket
    amount DECIMAL(10,2) NOT NULL,                -- Monto del ticket
    currency TEXT CHECK(currency IN ('USD', 'DOP')) NOT NULL, -- Moneda
    mesa TEXT NOT NULL,                           -- Mesa que emitió el ticket
    estado TEXT CHECK(estado IN ('activo', 'usado', 'cancelado', 'expirado')) DEFAULT 'activo',
    fecha_emision DATETIME DEFAULT CURRENT_TIMESTAMP,
    fecha_cobro DATETIME,                         -- Fecha de canje
    cajero_id TEXT,                              -- ID del cajero que procesó
    hash_seguridad TEXT NOT NULL,               -- Hash de seguridad
    qr_data TEXT NOT NULL,                       -- Datos del código QR
    sincronizado INTEGER DEFAULT 0,             -- Sincronizado con Supabase
    notas TEXT                                   -- Notas adicionales
);

-- Tabla de operadores (personal de mesas)
CREATE TABLE IF NOT EXISTS operadores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    codigo TEXT UNIQUE NOT NULL,                 -- Código del operador
    nombre TEXT NOT NULL,                        -- Nombre completo
    pin TEXT NOT NULL,                          -- PIN de acceso
    mesa_asignada TEXT,                         -- Mesa asignada
    activo INTEGER DEFAULT 1,                   -- Estado activo/inactivo
    fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de usuarios del sistema (login general)
CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,               -- Nombre de usuario único
    password_hash TEXT NOT NULL,                 -- Hash de la contraseña
    password_salt TEXT NOT NULL,                 -- Salt para el hash
    role TEXT CHECK(role IN ('ADMIN','MESA','CAJA','AUDITOR')) NOT NULL, -- Rol del usuario
    activo INTEGER DEFAULT 1,                    -- Estado activo/inactivo
    creado DATETIME DEFAULT CURRENT_TIMESTAMP,   -- Fecha de creación
    ultimo_acceso DATETIME,                      -- Último acceso al sistema
    intentos_fallidos INTEGER DEFAULT 0,        -- Contador de intentos fallidos
    bloqueado_hasta DATETIME                     -- Fecha hasta la cual está bloqueado
);

-- Tabla de auditoría completa
CREATE TABLE IF NOT EXISTS auditoria (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo_evento TEXT NOT NULL,                   -- Tipo de evento auditado
    ticket_code TEXT,                           -- Código de ticket relacionado
    usuario_id TEXT,                            -- Usuario que realizó la acción
    descripcion TEXT,                           -- Descripción del evento
    fecha DATETIME DEFAULT CURRENT_TIMESTAMP,   -- Fecha y hora del evento
    datos_adicionales TEXT,                     -- Datos adicionales en JSON
    ip_address TEXT,                            -- Dirección IP del usuario
    user_agent TEXT,                            -- User agent del navegador
    session_id TEXT,                            -- ID de sesión
    nivel_criticidad TEXT CHECK(nivel_criticidad IN ('BAJO', 'MEDIO', 'ALTO', 'CRITICO')) DEFAULT 'MEDIO',
    modulo TEXT,                                -- Módulo del sistema
    accion TEXT,                                -- Acción específica realizada
    resultado TEXT CHECK(resultado IN ('EXITO', 'FALLO', 'ADVERTENCIA')) DEFAULT 'EXITO'
);

-- Tabla de configuración del sistema
CREATE TABLE IF NOT EXISTS configuracion (
    clave TEXT PRIMARY KEY,                      -- Clave de configuración
    valor TEXT,                                 -- Valor de configuración
    actualizado DATETIME DEFAULT CURRENT_TIMESTAMP, -- Última actualización
    descripcion TEXT,                           -- Descripción de la configuración
    tipo_dato TEXT CHECK(tipo_dato IN ('STRING', 'NUMBER', 'BOOLEAN', 'JSON')) DEFAULT 'STRING',
    categoria TEXT                              -- Categoría de configuración
);

-- ============================================
-- ÍNDICES PARA OPTIMIZACIÓN DE CONSULTAS
-- ============================================

-- Índices para tickets
CREATE INDEX IF NOT EXISTS idx_ticket_code ON tickets(code);
CREATE INDEX IF NOT EXISTS idx_ticket_estado ON tickets(estado);
CREATE INDEX IF NOT EXISTS idx_ticket_fecha ON tickets(fecha_emision);
CREATE INDEX IF NOT EXISTS idx_ticket_mesa ON tickets(mesa);
CREATE INDEX IF NOT EXISTS idx_ticket_sincronizado ON tickets(sincronizado);

-- Índices para operadores
CREATE INDEX IF NOT EXISTS idx_operador_codigo ON operadores(codigo);
CREATE INDEX IF NOT EXISTS idx_operador_mesa ON operadores(mesa_asignada);

-- Índices para usuarios
CREATE INDEX IF NOT EXISTS idx_usuario_username ON usuarios(username);
CREATE INDEX IF NOT EXISTS idx_usuario_role ON usuarios(role);
CREATE INDEX IF NOT EXISTS idx_usuario_activo ON usuarios(activo);

-- Índices para auditoría
CREATE INDEX IF NOT EXISTS idx_auditoria_fecha ON auditoria(fecha);
CREATE INDEX IF NOT EXISTS idx_auditoria_usuario ON auditoria(usuario_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_tipo ON auditoria(tipo_evento);
CREATE INDEX IF NOT EXISTS idx_auditoria_criticidad ON auditoria(nivel_criticidad);
CREATE INDEX IF NOT EXISTS idx_auditoria_modulo ON auditoria(modulo);

-- Índices para configuración
CREATE INDEX IF NOT EXISTS idx_config_categoria ON configuracion(categoria);

-- ============================================
-- CONFIGURACIÓN INICIAL DEL SISTEMA
-- ============================================

-- Configuraciones básicas
INSERT OR IGNORE INTO configuracion (clave, valor, descripcion, tipo_dato, categoria) VALUES
('tasa_usd_dop', '57.50', 'Tasa de cambio USD a DOP', 'NUMBER', 'MONEDA'),
('dias_expiracion', '365', 'Días para expiración de tickets', 'NUMBER', 'TICKETS'),
('max_intentos_login', '5', 'Máximo intentos de login fallidos', 'NUMBER', 'SEGURIDAD'),
('tiempo_bloqueo_minutos', '30', 'Tiempo de bloqueo tras intentos fallidos', 'NUMBER', 'SEGURIDAD'),
('backup_automatico', 'true', 'Realizar backup automático', 'BOOLEAN', 'SISTEMA'),
('intervalo_backup_horas', '24', 'Intervalo de backup en horas', 'NUMBER', 'SISTEMA'),
('auditoria_detallada', 'true', 'Activar auditoría detallada', 'BOOLEAN', 'AUDITORIA'),
('retener_logs_dias', '90', 'Días para retener logs de auditoría', 'NUMBER', 'AUDITORIA');

-- ============================================
-- DATOS INICIALES
-- ============================================

-- Usuario administrador por defecto (se crea via script)
-- Username: admin@casino
-- Password: Admin2024!
-- Role: ADMIN

-- Operador de prueba
INSERT OR IGNORE INTO operadores (codigo, nombre, pin, mesa_asignada) VALUES
('OP001', 'Operador Mesa 1', '1234', 'P01');

-- ============================================
-- TRIGGERS PARA AUDITORÍA AUTOMÁTICA
-- ============================================

-- Trigger para auditar cambios en configuración
CREATE TRIGGER IF NOT EXISTS audit_config_changes
AFTER UPDATE ON configuracion
FOR EACH ROW
BEGIN
    INSERT INTO auditoria (
        tipo_evento, descripcion, datos_adicionales, 
        nivel_criticidad, modulo, accion, resultado
    ) VALUES (
        'config_change',
        'Configuración ' || NEW.clave || ' modificada',
        json_object('clave', NEW.clave, 'valor_anterior', OLD.valor, 'valor_nuevo', NEW.valor),
        'ALTO',
        'CONFIGURACION',
        'UPDATE',
        'EXITO'
    );
END;

-- Trigger para auditar creación de usuarios
CREATE TRIGGER IF NOT EXISTS audit_user_creation
AFTER INSERT ON usuarios
FOR EACH ROW
BEGIN
    INSERT INTO auditoria (
        tipo_evento, usuario_id, descripcion, datos_adicionales,
        nivel_criticidad, modulo, accion, resultado
    ) VALUES (
        'user_create',
        NEW.username,
        'Usuario ' || NEW.username || ' creado',
        json_object('role', NEW.role, 'activo', NEW.activo),
        'ALTO',
        'USUARIOS',
        'CREATE',
        'EXITO'
    );
END;

-- Trigger para auditar cambios críticos en tickets
CREATE TRIGGER IF NOT EXISTS audit_ticket_status_change
AFTER UPDATE OF estado ON tickets
FOR EACH ROW
WHEN OLD.estado != NEW.estado
BEGIN
    INSERT INTO auditoria (
        tipo_evento, ticket_code, descripcion, datos_adicionales,
        nivel_criticidad, modulo, accion, resultado
    ) VALUES (
        'ticket_status_change',
        NEW.code,
        'Estado de ticket cambiado de ' || OLD.estado || ' a ' || NEW.estado,
        json_object('estado_anterior', OLD.estado, 'estado_nuevo', NEW.estado, 'monto', NEW.amount),
        CASE 
            WHEN NEW.estado = 'usado' THEN 'MEDIO'
            WHEN NEW.estado = 'cancelado' THEN 'ALTO'
            ELSE 'BAJO'
        END,
        'TICKETS',
        'UPDATE',
        'EXITO'
    );
END;