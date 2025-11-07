-- ═══════════════════════════════════════════════════════════════
-- FIX USUARIOS AUTH - SOLO UPDATE (SIN DELETE)
-- ═══════════════════════════════════════════════════════════════
--
-- PROBLEMA:
-- - No podemos eliminar usuarios porque tienen foreign keys en vouchers
-- - Solo admin@test.com puede hacer login
-- - Otros usuarios tienen contraseñas corruptas/desconocidas
--
-- SOLUCIÓN:
-- - Actualizar contraseñas de usuarios existentes a Casino2024!
-- - Crear usuarios que no existan
-- - Confirmar emails de todos
--
-- EJECUTAR EN: Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- Habilitar extensión pgcrypto si no está habilitada
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ═══════════════════════════════════════════════════════════════
-- OPCIÓN 1: UPDATE de contraseñas para usuarios existentes
-- ═══════════════════════════════════════════════════════════════

-- Actualizar admin@test.com
UPDATE auth.users
SET
  encrypted_password = crypt('Casino2024!', gen_salt('bf')),
  email_confirmed_at = COALESCE(email_confirmed_at, now()),
  updated_at = now(),
  raw_user_meta_data = jsonb_build_object(
    'full_name', 'Administrador de Prueba',
    'role', 'admin',
    'pin_code', '9999'
  )
WHERE email = 'admin@test.com';

-- Actualizar admin@casino.com
UPDATE auth.users
SET
  encrypted_password = crypt('Casino2024!', gen_salt('bf')),
  email_confirmed_at = COALESCE(email_confirmed_at, now()),
  updated_at = now(),
  raw_user_meta_data = jsonb_build_object(
    'full_name', 'Administrador',
    'role', 'admin',
    'pin_code', '1234'
  )
WHERE email = 'admin@casino.com';

-- Actualizar admin@casinosusua.com
UPDATE auth.users
SET
  encrypted_password = crypt('Casino2024!', gen_salt('bf')),
  email_confirmed_at = COALESCE(email_confirmed_at, now()),
  updated_at = now(),
  raw_user_meta_data = jsonb_build_object(
    'full_name', 'Administrador Principal',
    'role', 'admin',
    'pin_code', '0000'
  )
WHERE email = 'admin@casinosusua.com';

-- Actualizar caja@casinosusua.com
UPDATE auth.users
SET
  encrypted_password = crypt('Casino2024!', gen_salt('bf')),
  email_confirmed_at = COALESCE(email_confirmed_at, now()),
  updated_at = now(),
  raw_user_meta_data = jsonb_build_object(
    'full_name', 'Cajero Principal',
    'role', 'caja',
    'pin_code', '2222'
  )
WHERE email = 'caja@casinosusua.com';

-- Actualizar mesa1@casinosusua.com
UPDATE auth.users
SET
  encrypted_password = crypt('Casino2024!', gen_salt('bf')),
  email_confirmed_at = COALESCE(email_confirmed_at, now()),
  updated_at = now(),
  raw_user_meta_data = jsonb_build_object(
    'full_name', 'Operador Mesa 1',
    'role', 'mesa',
    'pin_code', '1111'
  )
WHERE email = 'mesa1@casinosusua.com';

-- Actualizar mesa2@casinosusua.com
UPDATE auth.users
SET
  encrypted_password = crypt('Casino2024!', gen_salt('bf')),
  email_confirmed_at = COALESCE(email_confirmed_at, now()),
  updated_at = now(),
  raw_user_meta_data = jsonb_build_object(
    'full_name', 'Operador Mesa 2',
    'role', 'mesa',
    'pin_code', '2222'
  )
WHERE email = 'mesa2@casinosusua.com';

-- Actualizar mesa3@casinosusua.com
UPDATE auth.users
SET
  encrypted_password = crypt('Casino2024!', gen_salt('bf')),
  email_confirmed_at = COALESCE(email_confirmed_at, now()),
  updated_at = now(),
  raw_user_meta_data = jsonb_build_object(
    'full_name', 'Operador Mesa 3',
    'role', 'mesa',
    'pin_code', '3333'
  )
WHERE email = 'mesa3@casinosusua.com';

-- Actualizar mesa4@casinosusua.com
UPDATE auth.users
SET
  encrypted_password = crypt('Casino2024!', gen_salt('bf')),
  email_confirmed_at = COALESCE(email_confirmed_at, now()),
  updated_at = now(),
  raw_user_meta_data = jsonb_build_object(
    'full_name', 'Operador Mesa 4',
    'role', 'mesa',
    'pin_code', '4444'
  )
WHERE email = 'mesa4@casinosusua.com';

-- Actualizar auditor@casinosusua.com
UPDATE auth.users
SET
  encrypted_password = crypt('Casino2024!', gen_salt('bf')),
  email_confirmed_at = COALESCE(email_confirmed_at, now()),
  updated_at = now(),
  raw_user_meta_data = jsonb_build_object(
    'full_name', 'Auditor Principal',
    'role', 'auditor',
    'pin_code', '5555'
  )
WHERE email = 'auditor@casinosusua.com';

-- ═══════════════════════════════════════════════════════════════
-- OPCIÓN 2: Crear usuarios que no existan
-- ═══════════════════════════════════════════════════════════════

-- Insertar admin@test.com si no existe
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

-- Insertar admin@casino.com si no existe
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

-- Insertar admin@casinosusua.com si no existe
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

-- Insertar caja@casinosusua.com si no existe
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

-- Insertar mesa1@casinosusua.com si no existe
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

-- Insertar mesa2@casinosusua.com si no existe
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

-- Insertar mesa3@casinosusua.com si no existe
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

-- Insertar mesa4@casinosusua.com si no existe
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

-- Insertar auditor@casinosusua.com si no existe
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

-- ═══════════════════════════════════════════════════════════════
-- Sincronizar IDs con tabla public.users
-- ═══════════════════════════════════════════════════════════════

UPDATE public.users u
SET id = (SELECT au.id FROM auth.users au WHERE au.email = u.email)
WHERE EXISTS (SELECT 1 FROM auth.users au WHERE au.email = u.email);

-- ═══════════════════════════════════════════════════════════════
-- Verificación
-- ═══════════════════════════════════════════════════════════════

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
-- ✅ 9 usuarios con contraseñas actualizadas a: Casino2024!
-- ✅ Todos los emails confirmados
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
