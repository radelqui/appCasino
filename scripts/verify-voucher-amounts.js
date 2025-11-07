// Verificar estructura de vouchers y preparar para valores preestablecidos
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verifyVoucherAmounts() {
  console.log('\n=== VERIFICACIÓN DE ESTRUCTURA DE VOUCHERS ===\n');

  const report = {
    timestamp: new Date().toISOString(),
    structure: {},
    amount_ranges: {},
    tests: {},
    performance: {},
    recommendations: []
  };

  try {
    // ============================================
    // 1. VERIFICAR ESTRUCTURA Y RANGOS
    // ============================================
    console.log('📊 1. Verificando rangos de montos por moneda...\n');

    const { data: stats, error: statsError } = await supabase
      .from('vouchers')
      .select('currency, amount');

    if (statsError) {
      console.error('❌ Error obteniendo stats:', statsError.message);
      return;
    }

    // Agrupar por moneda
    const byCurrency = stats.reduce((acc, v) => {
      if (!acc[v.currency]) {
        acc[v.currency] = [];
      }
      acc[v.currency].push(parseFloat(v.amount));
      return acc;
    }, {});

    for (const [currency, amounts] of Object.entries(byCurrency)) {
      const min = Math.min(...amounts);
      const max = Math.max(...amounts);
      const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length;

      console.log(`${currency}:`);
      console.log(`  Total vouchers: ${amounts.length}`);
      console.log(`  Mínimo: $${min.toFixed(2)}`);
      console.log(`  Máximo: $${max.toFixed(2)}`);
      console.log(`  Promedio: $${avg.toFixed(2)}`);

      report.amount_ranges[currency] = {
        count: amounts.length,
        min: min,
        max: max,
        avg: avg
      };
    }

    // ============================================
    // 2. PROBAR VALORES PREESTABLECIDOS
    // ============================================
    console.log('\n⚡ 2. Probando inserción de valores típicos...\n');

    const testVouchers = [
      { code: 'TEST-USD-20', amount: 20, currency: 'USD' },
      { code: 'TEST-USD-50', amount: 50, currency: 'USD' },
      { code: 'TEST-USD-100', amount: 100, currency: 'USD' },
      { code: 'TEST-USD-500', amount: 500, currency: 'USD' },
      { code: 'TEST-DOP-100', amount: 100, currency: 'DOP' },
      { code: 'TEST-DOP-500', amount: 500, currency: 'DOP' },
      { code: 'TEST-DOP-1000', amount: 1000, currency: 'DOP' },
      { code: 'TEST-DOP-5000', amount: 5000, currency: 'DOP' }
    ];

    let testsPassed = 0;
    let testsFailed = 0;

    for (const test of testVouchers) {
      const { data, error } = await supabase
        .from('vouchers')
        .insert({
          voucher_code: test.code,
          amount: test.amount,
          currency: test.currency,
          status: 'active'
        })
        .select()
        .single();

      if (!error) {
        console.log(`✅ ${test.code}: $${test.amount} ${test.currency}`);
        testsPassed++;
      } else {
        console.log(`❌ ${test.code}: ${error.message}`);
        testsFailed++;
      }
    }

    console.log(`\nTests: ${testsPassed} exitosos, ${testsFailed} fallidos`);

    report.tests = {
      passed: testsPassed,
      failed: testsFailed,
      total: testVouchers.length
    };

    // ============================================
    // 3. VERIFICAR VOUCHERS DE PRUEBA
    // ============================================
    console.log('\n📋 3. Verificando vouchers de prueba insertados...\n');

    const { data: testResults, error: testError } = await supabase
      .from('vouchers')
      .select('*')
      .like('voucher_code', 'TEST-%');

    if (!testError && testResults) {
      console.log(`Vouchers de prueba encontrados: ${testResults.length}`);
      testResults.forEach(v => {
        console.log(`  ${v.voucher_code}: $${v.amount} ${v.currency} [${v.status}]`);
      });
    }

    // ============================================
    // 4. LIMPIAR VOUCHERS DE PRUEBA
    // ============================================
    console.log('\n🧹 4. Limpiando vouchers de prueba...\n');

    const { error: deleteError } = await supabase
      .from('vouchers')
      .delete()
      .like('voucher_code', 'TEST-%');

    if (!deleteError) {
      console.log('✅ Vouchers de prueba eliminados');
    } else {
      console.log(`⚠️ Error al limpiar: ${deleteError.message}`);
    }

    // ============================================
    // 5. PRUEBA DE PERFORMANCE
    // ============================================
    console.log('\n⚡ 5. Prueba de performance con filtros...\n');

    // Query típica con límites
    const startTime = Date.now();
    const { data: perfTest, error: perfError } = await supabase
      .from('vouchers')
      .select('id, voucher_code, amount, currency, status')
      .eq('currency', 'USD')
      .gte('amount', 5)
      .lte('amount', 10000)
      .eq('status', 'active')
      .limit(10);

    const queryTime = Date.now() - startTime;

    console.log(`Query con filtros de límites: ${queryTime}ms`);
    console.log(`Resultados: ${perfTest?.length || 0} vouchers`);

    report.performance.query_with_limits = {
      time_ms: queryTime,
      results: perfTest?.length || 0,
      status: queryTime < 100 ? '✅ RÁPIDO' : '⚠️ LENTO'
    };

    // ============================================
    // 6. RECOMENDACIONES
    // ============================================
    console.log('\n💡 6. Recomendaciones...\n');

    // Verificar si hay montos fuera de rangos esperados
    for (const [currency, range] of Object.entries(report.amount_ranges)) {
      if (currency === 'USD') {
        if (range.min < 5) {
          const rec = `Hay vouchers USD con monto menor a $5 (mínimo: $${range.min})`;
          console.log(`⚠️  ${rec}`);
          report.recommendations.push(rec);
        }
        if (range.max > 10000) {
          const rec = `Hay vouchers USD con monto mayor a $10,000 (máximo: $${range.max})`;
          console.log(`⚠️  ${rec}`);
          report.recommendations.push(rec);
        }
      } else if (currency === 'DOP') {
        if (range.min < 50) {
          const rec = `Hay vouchers DOP con monto menor a $50 (mínimo: $${range.min})`;
          console.log(`⚠️  ${rec}`);
          report.recommendations.push(rec);
        }
        if (range.max > 500000) {
          const rec = `Hay vouchers DOP con monto mayor a $500,000 (máximo: $${range.max})`;
          console.log(`⚠️  ${rec}`);
          report.recommendations.push(rec);
        }
      }
    }

    if (report.recommendations.length === 0) {
      console.log('✅ Todos los montos están dentro de rangos aceptables');
    }

    // ============================================
    // 7. ESTADÍSTICAS GENERALES
    // ============================================
    console.log('\n📊 7. Estadísticas generales...\n');

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

    report.summary = {
      total: totalVouchers,
      active: activeVouchers,
      redeemed: redeemedVouchers,
      redemption_rate: totalVouchers > 0 ? ((redeemedVouchers / totalVouchers) * 100).toFixed(2) + '%' : 'N/A'
    };

    // ============================================
    // GUARDAR INFORME
    // ============================================
    const fs = require('fs');

    let markdown = `# 💰 VERIFICACIÓN DE ESTRUCTURA DE VOUCHERS\n\n`;
    markdown += `**Fecha**: ${new Date().toLocaleString('es-DO')}\n\n`;
    markdown += `---\n\n`;

    markdown += `## 📊 RANGOS DE MONTOS POR MONEDA\n\n`;
    markdown += `| Moneda | Total | Mínimo | Máximo | Promedio |\n`;
    markdown += `|--------|-------|--------|--------|----------|\n`;
    Object.entries(report.amount_ranges).forEach(([currency, range]) => {
      markdown += `| ${currency} | ${range.count} | $${range.min.toFixed(2)} | $${range.max.toFixed(2)} | $${range.avg.toFixed(2)} |\n`;
    });
    markdown += `\n`;

    markdown += `## ⚡ PRUEBAS DE INSERCIÓN\n\n`;
    markdown += `**Valores típicos probados**:\n\n`;
    markdown += `- USD: 20, 50, 100, 500\n`;
    markdown += `- DOP: 100, 500, 1000, 5000\n\n`;
    markdown += `**Resultados**:\n\n`;
    markdown += `- ✅ Exitosos: ${report.tests.passed}\n`;
    markdown += `- ❌ Fallidos: ${report.tests.failed}\n`;
    markdown += `- Total: ${report.tests.total}\n\n`;

    markdown += `## ⚡ PERFORMANCE\n\n`;
    markdown += `**Query con filtros de límites**: ${report.performance.query_with_limits.time_ms}ms ${report.performance.query_with_limits.status}\n\n`;
    markdown += `Resultados: ${report.performance.query_with_limits.results} vouchers\n\n`;

    markdown += `## 💡 RECOMENDACIONES\n\n`;
    if (report.recommendations.length > 0) {
      report.recommendations.forEach((rec, i) => {
        markdown += `${i + 1}. ${rec}\n`;
      });
    } else {
      markdown += `✅ No hay recomendaciones - estructura correcta\n`;
    }
    markdown += `\n`;

    markdown += `## 📊 ESTADÍSTICAS GENERALES\n\n`;
    markdown += `- **Total vouchers**: ${report.summary.total}\n`;
    markdown += `- **Activos**: ${report.summary.active}\n`;
    markdown += `- **Cobrados**: ${report.summary.redeemed}\n`;
    markdown += `- **Tasa de cobro**: ${report.summary.redemption_rate}\n\n`;

    markdown += `---\n\n`;
    markdown += `**FIN DEL INFORME**\n`;

    fs.writeFileSync('VERIFICACION_VOUCHER_AMOUNTS.md', markdown);
    console.log(`\n✅ Informe guardado en: VERIFICACION_VOUCHER_AMOUNTS.md`);

    fs.writeFileSync('voucher-amounts-report.json', JSON.stringify(report, null, 2));
    console.log(`✅ Datos JSON guardados en: voucher-amounts-report.json`);

  } catch (error) {
    console.error('\n❌ Error durante verificación:', error.message);
    console.error(error);
  }

  console.log('\n=== FIN DE VERIFICACIÓN ===\n');
}

verifyVoucherAmounts();
