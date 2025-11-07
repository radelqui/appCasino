// ============================================
// VERIFICAR VISTAS SQL EN SUPABASE
// ============================================

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: Variables de entorno no configuradas');
  console.log('SUPABASE_URL:', supabaseUrl ? 'OK' : 'FALTA');
  console.log('SUPABASE_SERVICE_ROLE_KEY:', supabaseKey ? 'OK' : 'FALTA');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Lista de vistas que deben existir
const expectedViews = [
  'voucher_reports_by_shift',
  'voucher_reports_by_operator',
  'voucher_reports_by_station',
  'voucher_anomalies',
  'daily_summary',
  'top_operators_performance',
  'mesa_productivity_ranking'
];

// Función esperada
const expectedFunction = 'detect_fraud_patterns';

async function verifyViews() {
  console.log('🔍 Verificando vistas SQL en Supabase...\n');

  try {
    // Verificar vistas
    const { data: views, error: viewsError } = await supabase
      .rpc('execute_sql', {
        query: `
          SELECT viewname
          FROM pg_views
          WHERE schemaname = 'public'
          AND viewname IN (${expectedViews.map(v => `'${v}'`).join(',')})
        `
      });

    if (viewsError) {
      console.log('ℹ️  No se pudo verificar usando RPC, intentando método alternativo...\n');

      // Método alternativo: intentar consultar cada vista directamente
      const results = [];

      for (const viewName of expectedViews) {
        console.log(`  Verificando: ${viewName}`);

        const { data, error } = await supabase
          .from(viewName)
          .select('*')
          .limit(1);

        if (error) {
          console.log(`    ❌ NO EXISTE - ${error.message}`);
          results.push({ view: viewName, exists: false, error: error.message });
        } else {
          console.log(`    ✅ EXISTE`);
          results.push({ view: viewName, exists: true });
        }
      }

      // Resumen
      const existing = results.filter(r => r.exists);
      const missing = results.filter(r => !r.exists);

      console.log('\n📊 RESUMEN:');
      console.log(`  ✅ Vistas existentes: ${existing.length}/${expectedViews.length}`);
      console.log(`  ❌ Vistas faltantes: ${missing.length}/${expectedViews.length}`);

      if (missing.length > 0) {
        console.log('\n⚠️  VISTAS FALTANTES:');
        missing.forEach(m => {
          console.log(`  - ${m.view}`);
        });

        console.log('\n💡 SOLUCIÓN:');
        console.log('  1. Abrir Supabase Dashboard → SQL Editor');
        console.log('  2. Ejecutar el archivo: SqulInstrucciones/advanced-reports-views.sql');
        console.log('  3. Tiempo estimado: 2-3 minutos');
      } else {
        console.log('\n✅ TODAS LAS VISTAS ESTÁN CREADAS');
        console.log('   El módulo de reportes está 100% funcional');
      }

      return results;

    } else {
      // Si RPC funcionó
      const existingViews = views.map(v => v.viewname);
      const missingViews = expectedViews.filter(v => !existingViews.includes(v));

      console.log('📊 RESUMEN:');
      console.log(`  ✅ Vistas existentes: ${existingViews.length}/${expectedViews.length}`);
      console.log(`  ❌ Vistas faltantes: ${missingViews.length}/${expectedViews.length}`);

      if (missingViews.length > 0) {
        console.log('\n⚠️  VISTAS FALTANTES:');
        missingViews.forEach(v => console.log(`  - ${v}`));

        console.log('\n💡 SOLUCIÓN:');
        console.log('  1. Abrir Supabase Dashboard → SQL Editor');
        console.log('  2. Ejecutar el archivo: SqulInstrucciones/advanced-reports-views.sql');
        console.log('  3. Tiempo estimado: 2-3 minutos');
      } else {
        console.log('\n✅ TODAS LAS VISTAS ESTÁN CREADAS');
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);

    console.log('\n💡 RECOMENDACIÓN:');
    console.log('  Ejecutar manualmente en Supabase SQL Editor:');
    console.log('  → SqulInstrucciones/advanced-reports-views.sql');
  }
}

// Ejecutar verificación
verifyViews().then(() => {
  console.log('\n✅ Verificación completada');
  process.exit(0);
}).catch(error => {
  console.error('\n❌ Error:', error);
  process.exit(1);
});
