-- ============================================
-- FIX: Tabla usuarios para soportar UUIDs de Supabase
-- ============================================
-- EJECUTAR EN: C:\appCasino\Caja\casino.db
-- Usar DB Browser for SQLite o comando: sqlite3 Caja/casino.db < FIX_USUARIOS_TABLE.sql
-- ============================================

-- 1. Crear tabla temporal con estructura correcta
CREATE TABLE IF NOT EXISTS usuarios_new (
  id TEXT PRIMARY KEY,  -- ✅ Cambiado de INTEGER a TEXT para soportar UUIDs
  username TEXT NOT NULL,
  password_hash TEXT,
  password_salt TEXT,
  email TEXT UNIQUE NOT NULL,  -- ✅ Único para UPSERT
  role TEXT NOT NULL CHECK(role IN ('ADMIN', 'MESA', 'CAJA', 'AUDITOR')),
  activo INTEGER DEFAULT 1,
  sincronizado INTEGER DEFAULT 0,
  creado DATETIME DEFAULT CURRENT_TIMESTAMP,
  modificado DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Copiar datos existentes (si hay)
INSERT OR IGNORE INTO usuarios_new (id, username, password_hash, password_salt, email, role, activo, sincronizado, creado, modificado)
SELECT
  CAST(id AS TEXT) as id,  -- Convertir IDs existentes a TEXT
  username,
  password_hash,
  password_salt,
  email,
  role,
  activo,
  sincronizado,
  creado,
  modificado
FROM usuarios
WHERE email IS NOT NULL;  -- Solo copiar usuarios con email

-- 3. Eliminar tabla antigua
DROP TABLE usuarios;

-- 4. Renombrar tabla nueva
ALTER TABLE usuarios_new RENAME TO usuarios;

-- 5. Crear índice único en email (para ON CONFLICT)
CREATE UNIQUE INDEX IF NOT EXISTS idx_usuario_email ON usuarios(email);

-- 6. Crear índice en role para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_usuario_role ON usuarios(role);

-- 7. Verificar estructura
SELECT
  '✅ Tabla usuarios reparada' as status,
  COUNT(*) as total_usuarios
FROM usuarios;

-- ============================================
-- FIN DEL SCRIPT
-- ============================================
