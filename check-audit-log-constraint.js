#!/usr/bin/env node
/**
 * Script para verificar el constraint de la tabla audit_log en Supabase
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY son requeridos en .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkConstraint() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('   🔍 VERIFICANDO CONSTRAINT DE audit_log');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Consultar información sobre el constraint
  const { data, error } = await supabase.rpc('exec_sql', {
    query: `
      SELECT constraint_name, check_clause
      FROM information_schema.check_constraints
      WHERE constraint_name LIKE '%audit_log%action%';
    `
  });

  if (error) {
    console.log('⚠️  No se pudo consultar constraints via RPC, intentando método alternativo...\n');

    // Intentar obtener un registro de ejemplo para ver la estructura
    const { data: sampleData, error: sampleError } = await supabase
      .from('audit_log')
      .select('*')
      .limit(5);

    if (sampleError) {
      console.error('❌ Error al obtener datos de muestra:', sampleError.message);
    } else {
      console.log('📋 Últimos 5 registros de audit_log:\n');
      sampleData.forEach((record, idx) => {
        console.log(`${idx + 1}. Action: "${record.action}" (ID: ${record.id})`);
        console.log(`   User: ${record.user_id || 'N/A'}`);
        console.log(`   Details: ${JSON.stringify(record.details || {}).substring(0, 60)}...`);
        console.log('');
      });
    }

    // Obtener todos los action types únicos usados
    console.log('═══════════════════════════════════════════════════════════');
    console.log('   📊 ACTION TYPES ÚNICOS EN LA BD');
    console.log('═══════════════════════════════════════════════════════════\n');

    const { data: allData, error: allError } = await supabase
      .from('audit_log')
      .select('action');

    if (!allError && allData) {
      const uniqueActions = [...new Set(allData.map(r => r.action))].sort();
      console.log(`Total de action types únicos: ${uniqueActions.length}\n`);
      uniqueActions.forEach((action, idx) => {
        console.log(`${(idx + 1).toString().padStart(2, ' ')}. "${action}"`);
      });
    }

    // Intentar insertar un registro con 'voucher_issued' para verificar si funciona
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log('   🧪 PRUEBA: Intentar insertar "voucher_issued"');
    console.log('═══════════════════════════════════════════════════════════\n');

    const { data: testData, error: testError } = await supabase
      .from('audit_log')
      .insert({
        action: 'voucher_issued',
        user_id: null,
        user_role: null,
        station_id: null,
        voucher_id: null,
        details: { test: true, timestamp: new Date().toISOString() },
        ip_address: null
      })
      .select()
      .single();

    if (testError) {
      console.log('❌ ERROR al insertar "voucher_issued":');
      console.log(`   ${testError.message}\n`);
      console.log('   Este es el error que está causando el freeze de Mesa.\n');
    } else {
      console.log('✅ Se insertó correctamente "voucher_issued"');
      console.log(`   ID creado: ${testData.id}\n`);

      // Limpiar el registro de prueba
      await supabase.from('audit_log').delete().eq('id', testData.id);
      console.log('   ✅ Registro de prueba eliminado\n');
    }
  } else {
    console.log('✅ Constraint encontrado:\n');
    console.log(data);
  }

  console.log('═══════════════════════════════════════════════════════════\n');
}

checkConstraint()
  .catch(error => {
    console.error('\n❌ Error fatal:', error.message);
    console.error(error.stack);
    process.exit(1);
  });
