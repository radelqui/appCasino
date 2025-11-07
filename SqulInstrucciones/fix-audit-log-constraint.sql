-- ═══════════════════════════════════════════════════════════
-- FIX: audit_log action constraint
-- ═══════════════════════════════════════════════════════════
-- PROBLEMA: La tabla audit_log en Supabase solo permite 3 actions:
--   - user_login
--   - voucher_created
--   - voucher_redeemed
--
-- PERO el código usa 13 actions diferentes, causando errores como:
--   "new row for relation 'audit_log' violates check constraint 'audit_log_action_check'"
--
-- SOLUCIÓN: Eliminar el constraint viejo y crear uno nuevo con todas las actions usadas
-- ═══════════════════════════════════════════════════════════

-- Paso 1: Eliminar el constraint existente
ALTER TABLE audit_log
DROP CONSTRAINT IF EXISTS audit_log_action_check;

-- Paso 2: Crear nuevo constraint con TODAS las actions usadas en el código
ALTER TABLE audit_log
ADD CONSTRAINT audit_log_action_check
CHECK (action IN (
  -- Voucher actions
  'voucher_created',
  'voucher_issued',
  'voucher_redeemed',
  'voucher_cancelled',
  'voucher_expired',
  -- User actions
  'user_login',
  'user_logout',
  'user_created',
  'user_updated',
  -- Operator actions
  'operator_created',
  'operator_updated',
  -- Session actions
  'session_closed',
  -- Config actions
  'config_changed'
));

-- ═══════════════════════════════════════════════════════════
-- VERIFICACIÓN
-- ═══════════════════════════════════════════════════════════
-- Ejecutar esta query después para verificar que el constraint fue actualizado:
--
-- SELECT conname, pg_get_constraintdef(oid)
-- FROM pg_constraint
-- WHERE conrelid = 'audit_log'::regclass
-- AND conname = 'audit_log_action_check';
-- ═══════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════
-- NOTAS IMPORTANTES:
-- ═══════════════════════════════════════════════════════════
-- 1. Este script debe ejecutarse en Supabase SQL Editor
-- 2. Usa el service_role para tener permisos completos
-- 3. Los registros existentes NO se ven afectados
-- 4. Solo nuevos INSERT serán validados con el nuevo constraint
-- ═══════════════════════════════════════════════════════════
