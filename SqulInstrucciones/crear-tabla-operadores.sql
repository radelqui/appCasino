-- ═══════════════════════════════════════════════════════════
-- SISTEMA DE GESTIÓN DE OPERADORES
-- ═══════════════════════════════════════════════════════════
-- Ejecutar este script en Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════

-- 1️⃣ Crear tabla de operadores
CREATE TABLE IF NOT EXISTS operadores (
  id BIGSERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  activo BOOLEAN DEFAULT true,
  mesas_asignadas TEXT[], -- Array de mesas donde puede trabajar (ej: ['P01', 'P02'])
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2️⃣ Crear índice para búsquedas rápidas por estado activo
CREATE INDEX idx_operadores_activo ON operadores(activo);

-- 3️⃣ Crear índice para búsquedas por nombre
CREATE INDEX idx_operadores_nombre ON operadores(nombre);

-- 4️⃣ Insertar datos iniciales de ejemplo
INSERT INTO operadores (nombre, activo, mesas_asignadas) VALUES
('Juan Pérez', true, ARRAY['P01', 'P02']),
('María López', true, ARRAY['P03', 'P04']),
('Carlos Rodríguez', true, ARRAY['P01', 'P02', 'P03', 'P04']),
('Ana Martínez', false, ARRAY['P02']); -- Ejemplo de operador inactivo

-- 5️⃣ Verificar que se creó correctamente
SELECT * FROM operadores ORDER BY activo DESC, nombre;

-- ═══════════════════════════════════════════════════════════
-- RESULTADO ESPERADO:
-- ═══════════════════════════════════════════════════════════
-- id | nombre            | activo | mesas_asignadas        | created_at           | updated_at
-- ---|-------------------|--------|------------------------|----------------------|----------------------
--  1 | Juan Pérez        | true   | {P01,P02}              | 2024-01-01 12:00:00  | 2024-01-01 12:00:00
--  2 | María López       | true   | {P03,P04}              | 2024-01-01 12:00:00  | 2024-01-01 12:00:00
--  3 | Carlos Rodríguez  | true   | {P01,P02,P03,P04}      | 2024-01-01 12:00:00  | 2024-01-01 12:00:00
--  4 | Ana Martínez      | false  | {P02}                  | 2024-01-01 12:00:00  | 2024-01-01 12:00:00
-- ═══════════════════════════════════════════════════════════
