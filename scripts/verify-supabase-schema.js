#!/usr/bin/env node
/**
 * Script para verificar el esquema actual de Supabase
 * y compararlo con el esquema requerido
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

// Tablas requeridas según el nuevo diseño
const REQUIRED_TABLES = {
  'users': {
    description: 'Perfiles de usuarios del sistema',
    required_columns: ['id', 'email', 'full_name', 'role', 'pin_code', 'station_id', 'is_active']
  },
  'operators': {
    description: 'Operadores que trabajan en las mesas',
    required_columns: ['id', 'nombre', 'activo', 'mesas_asignadas']
  },
  'operadores': {
    description: 'Operadores (tabla existente, posible duplicado)',
    required_columns: ['id', 'nombre', 'activo']
  },
  'stations': {
    description: 'Mesas de juego y cajas',
    required_columns: ['id', 'station_type', 'station_number', 'station_name', 'is_active']
  },
  'vouchers': {
    description: 'Tickets/vouchers con QR (PRINCIPAL)',
    required_columns: ['id', 'voucher_code', 'amount', 'currency', 'status', 'issued_by_user_id', 'issued_at_station_id']
  },
  'audit_log': {
    description: 'Logs de auditoría',
    required_columns: ['id', 'event_type', 'user_id', 'voucher_id', 'details']
  },
  'audit_logs': {
    description: 'Logs de auditoría (posible duplicado)',
    required_columns: ['id', 'tipo_evento', 'voucher_code', 'user_id']
  }
};

async function getTableInfo(tableName) {
  try {
    // Intentar hacer una query simple para verificar si existe
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .limit(0);

    if (error) {
      // Tabla no existe o no hay permisos
      return { exists: false, error: error.message };
    }

    // Contar registros
    const { count, error: countError } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true });

    return {
      exists: true,
      count: count || 0,
      error: null
    };
  } catch (err) {
    return { exists: false, error: err.message };
  }
}

async function verifySchema() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('   🔍 VERIFICACIÓN DE ESQUEMA SUPABASE');
  console.log('   Sistema Casino TITO - appCasino311025');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log(`📡 Conectando a: ${supabaseUrl}`);
  console.log(`🔑 Proyecto: ${supabaseUrl.match(/https:\/\/(.+)\.supabase\.co/)?.[1]}\n`);

  const results = {
    existing: [],
    missing: [],
    errors: []
  };

  console.log('📋 VERIFICANDO TABLAS REQUERIDAS:\n');
  console.log('─'.repeat(70));

  for (const [tableName, info] of Object.entries(REQUIRED_TABLES)) {
    process.stdout.write(`Verificando tabla '${tableName}'...`.padEnd(40));

    const tableInfo = await getTableInfo(tableName);

    if (tableInfo.exists) {
      console.log(`✅ Existe (${tableInfo.count} registros)`);
      results.existing.push({
        name: tableName,
        description: info.description,
        count: tableInfo.count
      });
    } else {
      console.log(`❌ No existe`);
      results.missing.push({
        name: tableName,
        description: info.description,
        required_columns: info.required_columns
      });
    }
  }

  console.log('─'.repeat(70));
  console.log('\n');

  // Resumen
  console.log('═══════════════════════════════════════════════════════════');
  console.log('   📊 RESUMEN DE VERIFICACIÓN');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log(`✅ Tablas existentes: ${results.existing.length}`);
  if (results.existing.length > 0) {
    results.existing.forEach(table => {
      console.log(`   • ${table.name.padEnd(20)} - ${table.description}`);
      console.log(`     └─ ${table.count} registros`);
    });
  }

  console.log(`\n❌ Tablas faltantes: ${results.missing.length}`);
  if (results.missing.length > 0) {
    results.missing.forEach(table => {
      console.log(`   • ${table.name.padEnd(20)} - ${table.description}`);
      console.log(`     └─ Columnas requeridas: ${table.required_columns.join(', ')}`);
    });
  }

  console.log('\n');

  // Análisis y recomendaciones
  console.log('═══════════════════════════════════════════════════════════');
  console.log('   💡 ANÁLISIS Y RECOMENDACIONES');
  console.log('═══════════════════════════════════════════════════════════\n');

  // Detectar tablas duplicadas
  const hasOperadores = results.existing.find(t => t.name === 'operadores');
  const hasOperators = results.existing.find(t => t.name === 'operators');
  const hasAuditLog = results.existing.find(t => t.name === 'audit_log');
  const hasAuditLogs = results.existing.find(t => t.name === 'audit_logs');

  if (hasOperadores && !hasOperators) {
    console.log('⚠️  Tabla "operadores" existe pero "operators" no');
    console.log('   Opciones:');
    console.log('   a) Renombrar "operadores" a "operators"');
    console.log('   b) Crear "operators" y migrar datos');
    console.log('   c) Usar "operadores" y actualizar código\n');
  }

  if (!hasAuditLog && !hasAuditLogs) {
    console.log('⚠️  No existe ninguna tabla de auditoría');
    console.log('   Recomendación: Crear "audit_log"\n');
  }

  if (!results.existing.find(t => t.name === 'vouchers')) {
    console.log('🚨 CRÍTICO: Tabla "vouchers" no existe');
    console.log('   Esta es la tabla principal del sistema\n');
  }

  if (!results.existing.find(t => t.name === 'stations')) {
    console.log('⚠️  Tabla "stations" no existe');
    console.log('   Necesaria para gestionar mesas y cajas\n');
  }

  if (!results.existing.find(t => t.name === 'users')) {
    console.log('⚠️  Tabla "users" no existe');
    console.log('   Necesaria para perfiles de usuarios\n');
  }

  // Siguiente paso
  console.log('═══════════════════════════════════════════════════════════');
  console.log('   📝 PRÓXIMO PASO');
  console.log('═══════════════════════════════════════════════════════════\n');

  if (results.missing.length > 0) {
    console.log('Se recomienda:');
    console.log('1. Revisar el archivo de migración completo');
    console.log('2. Ejecutar la migración en Supabase SQL Editor');
    console.log('3. Volver a ejecutar este script para verificar\n');
    console.log('Archivo de migración sugerido:');
    console.log('   SqulInstrucciones/complete-schema-migration.sql\n');
  } else {
    console.log('✅ Todas las tablas requeridas existen!');
    console.log('   Puedes proceder con la aplicación\n');
  }

  console.log('═══════════════════════════════════════════════════════════\n');

  return results;
}

// Ejecutar verificación
verifySchema()
  .then(results => {
    if (results.missing.length > 0) {
      process.exit(1); // Exit con error si faltan tablas
    }
  })
  .catch(error => {
    console.error('\n❌ Error fatal:', error.message);
    console.error(error.stack);
    process.exit(1);
  });
