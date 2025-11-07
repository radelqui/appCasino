#!/usr/bin/env node
/**
 * Script para verificar la estructura actual de audit_log
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: Variables de entorno no configuradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAuditLogStructure() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('   🔍 VERIFICANDO ESTRUCTURA DE audit_log');
  console.log('═══════════════════════════════════════════════════════════\n');

  try {
    // Obtener un registro de ejemplo para ver la estructura
    const { data, error } = await supabase
      .from('audit_log')
      .select('*')
      .limit(1);

    if (error) {
      console.error('❌ Error:', error.message);
      return;
    }

    if (!data || data.length === 0) {
      console.log('⚠️  La tabla está vacía, no podemos ver la estructura');
      console.log('\nIntentando obtener columnas via información del sistema...\n');
      return;
    }

    console.log('✅ Estructura actual de audit_log:\n');
    console.log('Columnas encontradas:');

    const columns = Object.keys(data[0]);
    columns.forEach(col => {
      const value = data[0][col];
      const type = typeof value;
      console.log(`  • ${col.padEnd(25)} (${type})`);
    });

    console.log('\n📊 Registro de ejemplo:');
    console.log(JSON.stringify(data[0], null, 2));

  } catch (err) {
    console.error('❌ Error:', err.message);
  }

  console.log('\n═══════════════════════════════════════════════════════════\n');
}

checkAuditLogStructure();
