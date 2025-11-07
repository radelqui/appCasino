-- ═══════════════════════════════════════════════════════════════
-- FIX COMPLETO: Usuarios de Supabase Auth
-- ═══════════════════════════════════════════════════════════════
--
-- PROBLEMA:
-- - Solo admin@test.com puede hacer login
-- - Otros 8 usuarios tienen credenciales inválidas o corruptas
-- - Auth SDK listUsers() falla con "Database error finding users"
-- - admin@casino.com da "Database error querying schema"
--
-- SOLUCIÓN:
-- - Eliminar TODOS los usuarios de auth.users
-- - Recrear usuarios con contraseña conocida
-- - Sincronizar con tabla public.users
--
-- EJECUTAR EN: Supabase SQL Editor
-- ADVERTENCIA: Esto eliminará todos los usuarios de Auth
-- ═══════════════════════════════════════════════════════════════

-- Paso 1: Backup de usuarios actuales (opcional, para seguridad)
CREATE TABLE IF NOT EXISTS auth_users_backup AS
SELECT * FROM auth.users;

-- Paso 2: Eliminar todos los usuarios de Auth
-- ADVERTENCIA: Esto deslogueará a todos los usuarios
DELETE FROM auth.users;

-- Paso 3: Recrear usuarios con la extensión pgcrypto para hashear contraseñas
-- La contraseña será: Casino2024!

-- Insertar admin@test.com
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  aud,
  role,
  raw_user_meta_data
)
SELECT
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000000',
  'admin@test.com',
  crypt('Casino2024!', gen_salt('bf')),
  now(),
  now(),
  now(),
  'authenticated',
  'authenticated',
  jsonb_build_object(
    'full_name', 'Administrador de Prueba',
    'role', 'admin',
    'pin_code', '9999'
  )
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users WHERE email = 'admin@test.com'
);

-- Insertar admin@casino.com
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  aud,
  role,
  raw_user_meta_data
)
SELECT
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000000',
  'admin@casino.com',
  crypt('Casino2024!', gen_salt('bf')),
  now(),
  now(),
  now(),
  'authenticated',
  'authenticated',
  jsonb_build_object(
    'full_name', 'Administrador',
    'role', 'admin',
    'pin_code', '1234'
  )
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users WHERE email = 'admin@casino.com'
);

-- Insertar admin@casinosusua.com
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  aud,
  role,
  raw_user_meta_data
)
SELECT
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000000',
  'admin@casinosusua.com',
  crypt('Casino2024!', gen_salt('bf')),
  now(),
  now(),
  now(),
  'authenticated',
  'authenticated',
  jsonb_build_object(
    'full_name', 'Administrador Principal',
    'role', 'admin',
    'pin_code', '0000'
  )
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users WHERE email = 'admin@casinosusua.com'
);

-- Insertar caja@casinosusua.com
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  aud,
  role,
  raw_user_meta_data
)
SELECT
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000000',
  'caja@casinosusua.com',
  crypt('Casino2024!', gen_salt('bf')),
  now(),
  now(),
  now(),
  'authenticated',
  'authenticated',
  jsonb_build_object(
    'full_name', 'Cajero Principal',
    'role', 'caja',
    'pin_code', '2222'
  )
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users WHERE email = 'caja@casinosusua.com'
);

-- Insertar mesa1@casinosusua.com
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  aud,
  role,
  raw_user_meta_data
)
SELECT
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000000',
  'mesa1@casinosusua.com',
  crypt('Casino2024!', gen_salt('bf')),
  now(),
  now(),
  now(),
  'authenticated',
  'authenticated',
  jsonb_build_object(
    'full_name', 'Operador Mesa 1',
    'role', 'mesa',
    'pin_code', '1111'
  )
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users WHERE email = 'mesa1@casinosusua.com'
);

-- Insertar mesa2@casinosusua.com
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  aud,
  role,
  raw_user_meta_data
)
SELECT
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000000',
  'mesa2@casinosusua.com',
  crypt('Casino2024!', gen_salt('bf')),
  now(),
  now(),
  now(),
  'authenticated',
  'authenticated',
  jsonb_build_object(
    'full_name', 'Operador Mesa 2',
    'role', 'mesa',
    'pin_code', '2222'
  )
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users WHERE email = 'mesa2@casinosusua.com'
);

-- Insertar mesa3@casinosusua.com
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  aud,
  role,
  raw_user_meta_data
)
SELECT
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000000',
  'mesa3@casinosusua.com',
  crypt('Casino2024!', gen_salt('bf')),
  now(),
  now(),
  now(),
  'authenticated',
  'authenticated',
  jsonb_build_object(
    'full_name', 'Operador Mesa 3',
    'role', 'mesa',
    'pin_code', '3333'
  )
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users WHERE email = 'mesa3@casinosusua.com'
);

-- Insertar mesa4@casinosusua.com
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  aud,
  role,
  raw_user_meta_data
)
SELECT
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000000',
  'mesa4@casinosusua.com',
  crypt('Casino2024!', gen_salt('bf')),
  now(),
  now(),
  now(),
  'authenticated',
  'authenticated',
  jsonb_build_object(
    'full_name', 'Operador Mesa 4',
    'role', 'mesa',
    'pin_code', '4444'
  )
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users WHERE email = 'mesa4@casinosusua.com'
);

-- Insertar auditor@casinosusua.com
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  aud,
  role,
  raw_user_meta_data
)
SELECT
  gen_random_uuid(),
  '00000000-0000-0000-0000-000000000000',
  'auditor@casinosusua.com',
  crypt('Casino2024!', gen_salt('bf')),
  now(),
  now(),
  now(),
  'authenticated',
  'authenticated',
  jsonb_build_object(
    'full_name', 'Auditor Principal',
    'role', 'auditor',
    'pin_code', '5555'
  )
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users WHERE email = 'auditor@casinosusua.com'
);

-- Paso 4: Sincronizar IDs con tabla public.users
UPDATE public.users u
SET id = (SELECT au.id FROM auth.users au WHERE au.email = u.email)
WHERE EXISTS (SELECT 1 FROM auth.users au WHERE au.email = u.email);

-- Paso 5: Verificación
SELECT
  'Auth Users' as source,
  email,
  email_confirmed_at IS NOT NULL as confirmed,
  raw_user_meta_data->>'role' as role,
  raw_user_meta_data->>'pin_code' as pin
FROM auth.users
ORDER BY email;

SELECT
  'Public Users' as source,
  email,
  full_name,
  role,
  pin_code,
  is_active
FROM public.users
ORDER BY email;

-- ═══════════════════════════════════════════════════════════════
-- RESULTADO ESPERADO:
-- ═══════════════════════════════════════════════════════════════
-- ✅ 9 usuarios creados en auth.users
-- ✅ Todos con contraseña: Casino2024!
-- ✅ IDs sincronizados con public.users
-- ✅ Todos pueden hacer login
--
-- CREDENCIALES PARA TODOS:
-- Password: Casino2024!
--
-- - admin@test.com - PIN: 9999
-- - admin@casino.com - PIN: 1234
-- - admin@casinosusua.com - PIN: 0000
-- - caja@casinosusua.com - PIN: 2222
-- - mesa1@casinosusua.com - PIN: 1111
-- - mesa2@casinosusua.com - PIN: 2222
-- - mesa3@casinosusua.com - PIN: 3333
-- - mesa4@casinosusua.com - PIN: 4444
-- - auditor@casinosusua.com - PIN: 5555
-- ═══════════════════════════════════════════════════════════════
