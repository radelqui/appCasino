-- ═══════════════════════════════════════════════════════════════
-- FIX ESPECÍFICO: admin@casino.com
-- ═══════════════════════════════════════════════════════════════
--
-- PROBLEMA:
-- - admin@casino.com da "Database error querying schema" al hacer login
-- - Los otros 8 usuarios funcionan correctamente con Casino2024!
--
-- CAUSA PROBABLE:
-- - Datos corruptos en auth.users para este usuario específico
-- - Posible problema con auth.identities o auth.sessions
--
-- SOLUCIÓN:
-- - Limpiar completamente este usuario de todas las tablas auth
-- - Recrear desde cero
--
-- ═══════════════════════════════════════════════════════════════

-- Paso 1: Ver el estado actual del usuario
SELECT
  'auth.users' as tabla,
  id,
  email,
  email_confirmed_at,
  phone,
  raw_user_meta_data,
  created_at,
  updated_at
FROM auth.users
WHERE email = 'admin@casino.com';

-- Paso 2: Ver si tiene identities problemáticas
SELECT
  'auth.identities' as tabla,
  id,
  user_id,
  provider_id,
  identity_data
FROM auth.identities
WHERE user_id IN (SELECT id FROM auth.users WHERE email = 'admin@casino.com');

-- Paso 3: Ver si tiene sesiones activas
SELECT
  'auth.sessions' as tabla,
  id,
  user_id,
  created_at,
  updated_at
FROM auth.sessions
WHERE user_id IN (SELECT id FROM auth.users WHERE email = 'admin@casino.com');

-- ═══════════════════════════════════════════════════════════════
-- LIMPIEZA COMPLETA DEL USUARIO
-- ═══════════════════════════════════════════════════════════════

-- Paso 4: Guardar el ID actual (para mantener foreign keys)
DO $$
DECLARE
  user_id_to_keep UUID;
BEGIN
  -- Obtener el ID actual
  SELECT id INTO user_id_to_keep FROM auth.users WHERE email = 'admin@casino.com';

  -- Eliminar sesiones
  DELETE FROM auth.sessions WHERE user_id = user_id_to_keep;

  -- Eliminar identities
  DELETE FROM auth.identities WHERE user_id = user_id_to_keep;

  -- Eliminar refresh tokens
  DELETE FROM auth.refresh_tokens WHERE user_id = user_id_to_keep;

  -- Actualizar el usuario con datos limpios
  UPDATE auth.users
  SET
    encrypted_password = crypt('Casino2024!', gen_salt('bf')),
    email_confirmed_at = now(),
    phone_confirmed_at = NULL,
    confirmation_token = NULL,
    confirmation_sent_at = NULL,
    recovery_token = NULL,
    recovery_sent_at = NULL,
    email_change_token_new = NULL,
    email_change = NULL,
    email_change_sent_at = NULL,
    email_change_confirm_status = 0,
    phone = NULL,
    phone_change = NULL,
    phone_change_token = NULL,
    phone_change_sent_at = NULL,
    reauthentication_token = NULL,
    reauthentication_sent_at = NULL,
    updated_at = now(),
    raw_user_meta_data = jsonb_build_object(
      'full_name', 'Administrador',
      'role', 'admin',
      'pin_code', '1234'
    ),
    raw_app_meta_data = jsonb_build_object(
      'provider', 'email',
      'providers', jsonb_build_array('email')
    )
  WHERE id = user_id_to_keep;

  -- Recrear identity básica
  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  )
  SELECT
    gen_random_uuid(),
    user_id_to_keep,
    jsonb_build_object(
      'email', 'admin@casino.com',
      'sub', user_id_to_keep::text
    ),
    'email',
    user_id_to_keep::text,
    now(),
    now(),
    now()
  WHERE NOT EXISTS (
    SELECT 1 FROM auth.identities WHERE user_id = user_id_to_keep AND provider = 'email'
  );

  RAISE NOTICE 'Usuario admin@casino.com limpiado y actualizado correctamente';
END $$;

-- ═══════════════════════════════════════════════════════════════
-- Verificación POST-FIX
-- ═══════════════════════════════════════════════════════════════

-- Ver estado después del fix
SELECT
  'POST-FIX: auth.users' as estado,
  id,
  email,
  email_confirmed_at IS NOT NULL as email_confirmed,
  raw_user_meta_data->>'role' as role,
  raw_user_meta_data->>'pin_code' as pin
FROM auth.users
WHERE email = 'admin@casino.com';

SELECT
  'POST-FIX: auth.identities' as estado,
  id,
  provider,
  identity_data->>'email' as email
FROM auth.identities
WHERE user_id IN (SELECT id FROM auth.users WHERE email = 'admin@casino.com');

-- ═══════════════════════════════════════════════════════════════
-- RESULTADO ESPERADO:
-- ═══════════════════════════════════════════════════════════════
-- ✅ Usuario admin@casino.com limpiado
-- ✅ Password actualizado a Casino2024!
-- ✅ Identity recreada correctamente
-- ✅ Login debería funcionar ahora
--
-- PROBAR:
-- node test-login-all-users.js
--
-- Esperado: 9/9 usuarios con login exitoso
-- ═══════════════════════════════════════════════════════════════
