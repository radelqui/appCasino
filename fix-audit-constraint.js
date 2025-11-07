#!/usr/bin/env node
/**
 * Script para arreglar el constraint de audit_log en Supabase
 * PROBLEMA: Solo permite 3 actions, pero el código usa 13
 * SOLUCIÓN: Actualizar el constraint para incluir todas las actions
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY son requeridos en .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixConstraint() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('   🔧 ARREGLANDO CONSTRAINT DE audit_log');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log('📋 Problema identificado:');
  console.log('   • Constraint actual solo permite: user_login, voucher_created, voucher_redeemed');
  console.log('   • Código usa 13 actions diferentes');
  console.log('   • Causa: "violates check constraint audit_log_action_check"\n');

  console.log('🔧 Solución:');
  console.log('   • Eliminar constraint viejo');
  console.log('   • Crear constraint nuevo con 13 actions\n');

  console.log('═══════════════════════════════════════════════════════════');
  console.log('   ⚙️  APLICANDO FIX...');
  console.log('═══════════════════════════════════════════════════════════\n');

  // NOTA: Supabase client no permite ALTER TABLE directamente por seguridad
  // Debemos usar el método rpc() con una función almacenada O ejecutar el SQL manualmente

  console.log('⚠️  IMPORTANTE:');
  console.log('   El cliente de Supabase no permite ALTER TABLE por seguridad.\n');

  console.log('📝 INSTRUCCIONES PARA APLICAR EL FIX:\n');
  console.log('1. Abre Supabase Dashboard:');
  console.log(`   ${supabaseUrl.replace('/rest/v1', '')}\n`);

  console.log('2. Ve a: SQL Editor (icono </>)\n');

  console.log('3. Copia y pega este SQL:\n');
  console.log('─'.repeat(70));
  console.log(`
-- Eliminar constraint viejo
ALTER TABLE audit_log
DROP CONSTRAINT IF EXISTS audit_log_action_check;

-- Crear constraint nuevo con todas las actions
ALTER TABLE audit_log
ADD CONSTRAINT audit_log_action_check
CHECK (action IN (
  'voucher_created',
  'voucher_issued',
  'voucher_redeemed',
  'voucher_cancelled',
  'voucher_expired',
  'user_login',
  'user_logout',
  'user_created',
  'user_updated',
  'operator_created',
  'operator_updated',
  'session_closed',
  'config_changed'
));
  `);
  console.log('─'.repeat(70));
  console.log('');

  console.log('4. Click "Run" (botón verde)\n');

  console.log('5. Verifica que aparezca: "Success. No rows returned"\n');

  console.log('6. Ejecuta este script de nuevo para verificar el fix\n');

  console.log('═══════════════════════════════════════════════════════════');
  console.log('   🧪 VERIFICANDO SI YA ESTÁ ARREGLADO...');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Intentar insertar 'voucher_issued' para verificar si ya funciona
  const { data: testData, error: testError } = await supabase
    .from('audit_log')
    .insert({
      action: 'voucher_issued',
      user_id: null,
      user_role: null,
      station_id: null,
      voucher_id: null,
      details: { test: true, fix_verification: true, timestamp: new Date().toISOString() },
      ip_address: null
    })
    .select()
    .single();

  if (testError) {
    console.log('❌ CONSTRAINT AÚN NO ARREGLADO');
    console.log(`   Error: ${testError.message}\n`);
    console.log('👆 Sigue las instrucciones arriba para arreglarlo manualmente\n');
    console.log('═══════════════════════════════════════════════════════════\n');
    return false;
  } else {
    console.log('✅ ¡CONSTRAINT ARREGLADO EXITOSAMENTE!');
    console.log(`   Se insertó correctamente "voucher_issued" (ID: ${testData.id})\n`);

    // Limpiar el registro de prueba
    await supabase.from('audit_log').delete().eq('id', testData.id);
    console.log('   ✅ Registro de prueba eliminado\n');

    console.log('═══════════════════════════════════════════════════════════');
    console.log('   ✅ MESA YA NO SE CONGELARÁ');
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('Puedes probar ahora:');
    console.log('   npm start → Login → Mesa → Click valor rápido → Emitir\n');
    console.log('═══════════════════════════════════════════════════════════\n');
    return true;
  }
}

fixConstraint()
  .then(fixed => {
    if (!fixed) {
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('\n❌ Error fatal:', error.message);
    console.error(error.stack);
    process.exit(1);
  });
