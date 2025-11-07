// Verificar implementación de mejoras de seguridad
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verifySecurityImplementation() {
  console.log('\n=== VERIFICACIÓN DE IMPLEMENTACIÓN DE SEGURIDAD ===\n');

  const report = {
    timestamp: new Date().toISOString(),
    indexes: { verified: [], missing: [] },
    trigger: { status: 'unknown', test_results: {} },
    rls: { status: 'unknown', policies: [] },
    performance: {},
    summary: {}
  };

  try {
    // ============================================
    // 1. VERIFICAR RLS ESTÁ HABILITADO
    // ============================================
    console.log('🔒 1. Verificando Row Level Security...\n');

    // Intentar acceso anónimo (debe fallar)
    const anonClient = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

    const { data: anonData, error: anonError } = await anonClient
      .from('vouchers')
      .select('*')
      .limit(1);

    if (anonError) {
      console.log('✅ RLS HABILITADO Y FUNCIONANDO');
      console.log(`   Error esperado: ${anonError.message}`);
      report.rls.status = '✅ ACTIVO';
      report.rls.anon_blocked = true;
      report.rls.error = anonError.message;
    } else {
      console.log('⚠️  RLS NO ESTÁ BLOQUEANDO acceso anónimo');
      console.log(`   Se obtuvieron ${anonData?.length || 0} registros`);
      report.rls.status = '⚠️ INACTIVO';
      report.rls.anon_blocked = false;
    }

    // Verificar acceso con service role (debe funcionar)
    const { data: serviceData, error: serviceError } = await supabase
      .from('vouchers')
      .select('*')
      .limit(1);

    if (!serviceError && serviceData) {
      console.log('✅ Service role tiene acceso completo');
      report.rls.service_access = true;
    } else {
      console.log('❌ Service role NO tiene acceso');
      console.log(`   Error: ${serviceError?.message}`);
      report.rls.service_access = false;
    }

    // ============================================
    // 2. VERIFICAR TRIGGER updated_at
    // ============================================
    console.log('\n⚡ 2. Verificando trigger updated_at...\n');

    const testCode = `TEST-${Date.now()}`;

    // Crear voucher de prueba
    const { data: newVoucher, error: createError } = await supabase
      .from('vouchers')
      .insert({
        voucher_code: testCode,
        amount: 100,
        currency: 'USD',
        status: 'active'
      })
      .select()
      .single();

    if (!createError && newVoucher) {
      const createdAt = new Date(newVoucher.created_at);
      const updatedAt1 = new Date(newVoucher.updated_at);

      console.log(`Voucher creado: ${testCode}`);
      console.log(`  created_at: ${createdAt.toISOString()}`);
      console.log(`  updated_at: ${updatedAt1.toISOString()}`);

      // Esperar 2 segundos
      console.log('\nEsperando 2 segundos...');
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Actualizar voucher
      const { data: updatedVoucher, error: updateError } = await supabase
        .from('vouchers')
        .update({ amount: 200 })
        .eq('voucher_code', testCode)
        .select()
        .single();

      if (!updateError && updatedVoucher) {
        const updatedAt2 = new Date(updatedVoucher.updated_at);

        console.log(`\nVoucher actualizado:`);
        console.log(`  created_at: ${createdAt.toISOString()}`);
        console.log(`  updated_at: ${updatedAt2.toISOString()}`);

        const timeDiff = updatedAt2 - updatedAt1;
        const triggerWorks = timeDiff > 1000; // Más de 1 segundo de diferencia

        console.log(`\nDiferencia: ${timeDiff}ms`);

        if (triggerWorks) {
          console.log('✅ TRIGGER FUNCIONA CORRECTAMENTE');
          report.trigger.status = '✅ FUNCIONANDO';
        } else {
          console.log('❌ TRIGGER NO FUNCIONA');
          report.trigger.status = '❌ NO FUNCIONA';
        }

        report.trigger.test_results = {
          created_at: createdAt.toISOString(),
          initial_updated_at: updatedAt1.toISOString(),
          final_updated_at: updatedAt2.toISOString(),
          time_diff_ms: timeDiff,
          works: triggerWorks
        };
      }

      // Limpiar
      await supabase.from('vouchers').delete().eq('voucher_code', testCode);
      console.log(`\nVoucher de prueba eliminado`);
    } else {
      console.log(`❌ No se pudo crear voucher de prueba: ${createError?.message}`);
      report.trigger.status = '❌ NO SE PUDO PROBAR';
    }

    // ============================================
    // 3. PRUEBAS DE PERFORMANCE
    // ============================================
    console.log('\n⚡ 3. Pruebas de performance (con índices)...\n');

    const perfTests = [
      {
        name: 'Buscar por voucher_code',
        query: () => supabase.from('vouchers').select('*').eq('voucher_code', 'PREV-022810').single(),
        threshold: 50
      },
      {
        name: 'Filtrar por status',
        query: () => supabase.from('vouchers').select('*').eq('status', 'active').limit(10),
        threshold: 100
      },
      {
        name: 'Count por status',
        query: () => supabase.from('vouchers').select('*', { count: 'exact', head: true }).eq('status', 'active'),
        threshold: 150
      },
      {
        name: 'Ordenar por created_at',
        query: () => supabase.from('vouchers').select('*').order('created_at', { ascending: false }).limit(10),
        threshold: 100
      },
      {
        name: 'Filtrar por rango de fechas',
        query: () => supabase.from('vouchers').select('*').gte('issued_at', '2025-10-01').limit(10),
        threshold: 150
      }
    ];

    for (const test of perfTests) {
      const start = Date.now();
      await test.query();
      const duration = Date.now() - start;

      const status = duration < test.threshold ? '✅ RÁPIDO' :
                     duration < test.threshold * 2 ? '⚠️ ACEPTABLE' :
                     '❌ LENTO';

      console.log(`${status} ${test.name}: ${duration}ms (threshold: ${test.threshold}ms)`);

      report.performance[test.name] = {
        duration_ms: duration,
        threshold_ms: test.threshold,
        status: status
      };
    }

    // ============================================
    // 4. ESTADÍSTICAS GENERALES
    // ============================================
    console.log('\n📊 4. Estadísticas generales...\n');

    const { count: totalVouchers } = await supabase
      .from('vouchers')
      .select('*', { count: 'exact', head: true });

    const { count: activeVouchers } = await supabase
      .from('vouchers')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');

    const { count: redeemedVouchers } = await supabase
      .from('vouchers')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'redeemed');

    console.log(`Total vouchers: ${totalVouchers}`);
    console.log(`Activos: ${activeVouchers}`);
    console.log(`Cobrados: ${redeemedVouchers}`);
    console.log(`Tasa de cobro: ${totalVouchers > 0 ? ((redeemedVouchers / totalVouchers) * 100).toFixed(2) : 0}%`);

    report.statistics = {
      total: totalVouchers,
      active: activeVouchers,
      redeemed: redeemedVouchers,
      redemption_rate: totalVouchers > 0 ? ((redeemedVouchers / totalVouchers) * 100).toFixed(2) + '%' : 'N/A'
    };

    // ============================================
    // 5. RESUMEN
    // ============================================
    console.log('\n📋 5. RESUMEN DE IMPLEMENTACIÓN\n');

    const allPerfGood = Object.values(report.performance).every(p => p.status.includes('✅'));
    const rlsActive = report.rls.status.includes('✅');
    const triggerWorks = report.trigger.status.includes('✅');

    report.summary = {
      rls: rlsActive ? '✅ ACTIVO' : '❌ INACTIVO',
      trigger: triggerWorks ? '✅ FUNCIONA' : '❌ NO FUNCIONA',
      performance: allPerfGood ? '✅ ÓPTIMO' : '⚠️ MEJORABLE',
      overall: rlsActive && triggerWorks && allPerfGood ? '✅ TODO CORRECTO' : '⚠️ REVISAR'
    };

    console.log(`RLS: ${report.summary.rls}`);
    console.log(`Trigger updated_at: ${report.summary.trigger}`);
    console.log(`Performance: ${report.summary.performance}`);
    console.log(`\n${report.summary.overall === '✅ TODO CORRECTO' ? '🎉' : '⚠️'} Estado general: ${report.summary.overall}`);

    // ============================================
    // GUARDAR INFORME
    // ============================================
    const fs = require('fs');

    let markdown = `# ✅ INFORME DE VERIFICACIÓN DE SEGURIDAD\n\n`;
    markdown += `**Fecha**: ${new Date().toLocaleString('es-DO')}\n\n`;
    markdown += `---\n\n`;

    markdown += `## 📊 RESUMEN EJECUTIVO\n\n`;
    markdown += `| Componente | Estado |\n`;
    markdown += `|------------|--------|\n`;
    markdown += `| RLS | ${report.summary.rls} |\n`;
    markdown += `| Trigger updated_at | ${report.summary.trigger} |\n`;
    markdown += `| Performance | ${report.summary.performance} |\n`;
    markdown += `| **GENERAL** | **${report.summary.overall}** |\n\n`;

    markdown += `## 🔒 1. ROW LEVEL SECURITY (RLS)\n\n`;
    markdown += `**Estado**: ${report.rls.status}\n\n`;
    markdown += `- Acceso anónimo bloqueado: ${report.rls.anon_blocked ? '✅ SÍ' : '❌ NO'}\n`;
    markdown += `- Service role tiene acceso: ${report.rls.service_access ? '✅ SÍ' : '❌ NO'}\n`;
    if (report.rls.error) {
      markdown += `- Error de acceso anónimo (esperado): \`${report.rls.error}\`\n`;
    }
    markdown += `\n`;

    markdown += `## ⚡ 2. TRIGGER updated_at\n\n`;
    markdown += `**Estado**: ${report.trigger.status}\n\n`;
    if (report.trigger.test_results.works !== undefined) {
      markdown += `**Prueba realizada**:\n\n`;
      markdown += `- created_at: ${report.trigger.test_results.created_at}\n`;
      markdown += `- updated_at inicial: ${report.trigger.test_results.initial_updated_at}\n`;
      markdown += `- updated_at final: ${report.trigger.test_results.final_updated_at}\n`;
      markdown += `- Diferencia: ${report.trigger.test_results.time_diff_ms}ms\n`;
      markdown += `- ${report.trigger.test_results.works ? '✅' : '❌'} Trigger ${report.trigger.test_results.works ? 'funciona' : 'NO funciona'}\n\n`;
    }

    markdown += `## ⚡ 3. PERFORMANCE\n\n`;
    markdown += `| Query | Tiempo (ms) | Threshold (ms) | Estado |\n`;
    markdown += `|-------|-------------|----------------|--------|\n`;
    Object.entries(report.performance).forEach(([name, perf]) => {
      markdown += `| ${name} | ${perf.duration_ms} | ${perf.threshold_ms} | ${perf.status} |\n`;
    });
    markdown += `\n`;

    markdown += `## 📊 4. ESTADÍSTICAS\n\n`;
    markdown += `- **Total vouchers**: ${report.statistics.total}\n`;
    markdown += `- **Activos**: ${report.statistics.active}\n`;
    markdown += `- **Cobrados**: ${report.statistics.redeemed}\n`;
    markdown += `- **Tasa de cobro**: ${report.statistics.redemption_rate}\n\n`;

    markdown += `---\n\n`;
    markdown += `**FIN DEL INFORME**\n`;

    fs.writeFileSync('VERIFICACION_SEGURIDAD.md', markdown);
    console.log(`\n✅ Informe guardado en: VERIFICACION_SEGURIDAD.md`);

    fs.writeFileSync('security-verification-report.json', JSON.stringify(report, null, 2));
    console.log(`✅ Datos JSON guardados en: security-verification-report.json`);

  } catch (error) {
    console.error('\n❌ Error durante verificación:', error.message);
    console.error(error);
  }

  console.log('\n=== FIN DE VERIFICACIÓN ===\n');
}

verifySecurityImplementation();
