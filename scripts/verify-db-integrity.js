// Verificación de integridad de bases de datos
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verifyDatabaseIntegrity() {
  console.log('\n=== VERIFICACIÓN DE INTEGRIDAD DE BASES DE DATOS ===\n');

  const report = {
    timestamp: new Date().toISOString(),
    tables: {},
    triggers: {},
    indexes: {},
    rls: {},
    performance: {},
    recommendations: []
  };

  try {
    // ============================================
    // 1. VERIFICAR ESTRUCTURA DE TABLA VOUCHERS
    // ============================================
    console.log('📋 1. Verificando estructura de tabla VOUCHERS...\n');

    const { data: voucherColumns, error: voucherError } = await supabase
      .rpc('exec_sql', {
        query: `
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns
          WHERE table_name = 'vouchers'
          ORDER BY ordinal_position;
        `
      })
      .single();

    if (voucherError) {
      // Intentar query directa
      const { data: vouchers, error: vError } = await supabase
        .from('vouchers')
        .select('*')
        .limit(1);

      if (!vError && vouchers) {
        const columns = vouchers.length > 0 ? Object.keys(vouchers[0]) : [];
        report.tables.vouchers = {
          status: '✅ EXISTE',
          columns: columns,
          sample_columns: columns.join(', ')
        };
        console.log('✅ Tabla vouchers existe');
        console.log('Columnas encontradas:', columns.join(', '));
      }
    }

    // Verificar campos críticos
    const { data: sampleVoucher } = await supabase
      .from('vouchers')
      .select('*')
      .limit(1)
      .single();

    const requiredFields = [
      'id', 'voucher_code', 'amount', 'currency', 'status',
      'qr_data', 'qr_hash', 'issued_at', 'created_at', 'updated_at'
    ];

    const presentFields = sampleVoucher ? Object.keys(sampleVoucher) : [];
    const missingFields = requiredFields.filter(f => !presentFields.includes(f));

    report.tables.vouchers = {
      ...report.tables.vouchers,
      required_fields: requiredFields,
      present_fields: presentFields,
      missing_fields: missingFields,
      fields_status: missingFields.length === 0 ? '✅ COMPLETO' : '⚠️ FALTAN CAMPOS'
    };

    console.log(`\nCampos requeridos: ${requiredFields.length}`);
    console.log(`Campos presentes: ${presentFields.length}`);
    if (missingFields.length > 0) {
      console.log(`⚠️  Campos faltantes: ${missingFields.join(', ')}`);
      report.recommendations.push(`Agregar campos faltantes a vouchers: ${missingFields.join(', ')}`);
    } else {
      console.log('✅ Todos los campos requeridos están presentes');
    }

    // ============================================
    // 2. VERIFICAR OTRAS TABLAS
    // ============================================
    console.log('\n📋 2. Verificando otras tablas...\n');

    const tables = ['users', 'operadores', 'stations'];

    for (const table of tables) {
      const { data, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: false })
        .limit(1);

      if (!error) {
        const columns = data.length > 0 ? Object.keys(data[0]) : [];
        const { count } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true });

        report.tables[table] = {
          status: '✅ EXISTE',
          columns: columns,
          record_count: count
        };

        console.log(`✅ Tabla ${table}: ${count} registros, ${columns.length} columnas`);
      } else {
        report.tables[table] = {
          status: '❌ ERROR',
          error: error.message
        };
        console.log(`❌ Tabla ${table}: ${error.message}`);
      }
    }

    // ============================================
    // 3. VERIFICAR TRIGGERS
    // ============================================
    console.log('\n⚡ 3. Verificando triggers...\n');

    // Crear un voucher de prueba y verificar si updated_at se actualiza
    const testCode = `TEST-${Date.now()}`;

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
      const createdAt = newVoucher.created_at;
      const updatedAt = newVoucher.updated_at;

      console.log(`Voucher de prueba creado: ${testCode}`);
      console.log(`created_at: ${createdAt}`);
      console.log(`updated_at: ${updatedAt}`);

      // Esperar 1 segundo y actualizar
      await new Promise(resolve => setTimeout(resolve, 1000));

      const { data: updatedVoucher, error: updateError } = await supabase
        .from('vouchers')
        .update({ amount: 200 })
        .eq('voucher_code', testCode)
        .select()
        .single();

      if (!updateError && updatedVoucher) {
        const newUpdatedAt = updatedVoucher.updated_at;
        console.log(`Después de UPDATE: updated_at: ${newUpdatedAt}`);

        const triggerWorks = new Date(newUpdatedAt) > new Date(updatedAt);

        report.triggers.updated_at = {
          status: triggerWorks ? '✅ FUNCIONA' : '❌ NO FUNCIONA',
          test_code: testCode,
          original_updated_at: updatedAt,
          new_updated_at: newUpdatedAt
        };

        console.log(triggerWorks ? '✅ Trigger updated_at funciona correctamente' : '❌ Trigger updated_at NO funciona');

        if (!triggerWorks) {
          report.recommendations.push('Crear trigger para updated_at en tabla vouchers');
        }
      }

      // Limpiar voucher de prueba
      await supabase.from('vouchers').delete().eq('voucher_code', testCode);
      console.log(`Voucher de prueba eliminado`);
    }

    // ============================================
    // 4. VERIFICAR ÍNDICES
    // ============================================
    console.log('\n🔍 4. Verificando índices...\n');

    // Índices recomendados
    const recommendedIndexes = {
      vouchers: ['voucher_code', 'status', 'issued_at', 'created_at'],
      users: ['email', 'role'],
      operadores: ['codigo', 'activo'],
      stations: ['station_number', 'is_active']
    };

    report.indexes = {
      note: 'Verificación limitada - se requiere acceso directo a PostgreSQL para ver índices completos',
      recommended: recommendedIndexes
    };

    console.log('Índices recomendados:');
    Object.entries(recommendedIndexes).forEach(([table, indexes]) => {
      console.log(`  ${table}: ${indexes.join(', ')}`);
    });

    // ============================================
    // 5. VERIFICAR RLS (Row Level Security)
    // ============================================
    console.log('\n🔒 5. Verificando políticas RLS...\n');

    // Intentar acceso sin autenticación (debería fallar si RLS está activo)
    const anonClient = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

    const { data: anonVouchers, error: anonError } = await anonClient
      .from('vouchers')
      .select('count')
      .limit(1);

    report.rls.vouchers = {
      anon_access: anonError ? '❌ BLOQUEADO (correcto)' : '⚠️ PERMITIDO (revisar)',
      error: anonError?.message || 'Sin error'
    };

    if (anonError) {
      console.log('✅ RLS está activo - acceso anónimo bloqueado');
      console.log(`   Error: ${anonError.message}`);
    } else {
      console.log('⚠️  RLS podría no estar configurado - acceso anónimo permitido');
      report.recommendations.push('Revisar políticas RLS en tabla vouchers');
    }

    // ============================================
    // 6. PRUEBAS DE PERFORMANCE
    // ============================================
    console.log('\n⚡ 6. Pruebas de performance...\n');

    // Query 1: Buscar voucher por código
    const startTime1 = Date.now();
    const { data: byCode } = await supabase
      .from('vouchers')
      .select('*')
      .eq('voucher_code', 'PREV-022810')
      .single();
    const queryTime1 = Date.now() - startTime1;

    console.log(`Query por voucher_code: ${queryTime1}ms ${queryTime1 < 100 ? '✅' : '⚠️'}`);

    // Query 2: Listar vouchers activos
    const startTime2 = Date.now();
    const { data: active } = await supabase
      .from('vouchers')
      .select('*')
      .eq('status', 'active')
      .limit(10);
    const queryTime2 = Date.now() - startTime2;

    console.log(`Query vouchers activos: ${queryTime2}ms ${queryTime2 < 200 ? '✅' : '⚠️'}`);

    // Query 3: Contar vouchers por status
    const startTime3 = Date.now();
    const { count } = await supabase
      .from('vouchers')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');
    const queryTime3 = Date.now() - startTime3;

    console.log(`Query count activos: ${queryTime3}ms ${queryTime3 < 200 ? '✅' : '⚠️'}`);

    report.performance = {
      query_by_code: { time_ms: queryTime1, status: queryTime1 < 100 ? '✅ RÁPIDO' : '⚠️ LENTO' },
      query_active: { time_ms: queryTime2, status: queryTime2 < 200 ? '✅ RÁPIDO' : '⚠️ LENTO' },
      query_count: { time_ms: queryTime3, status: queryTime3 < 200 ? '✅ RÁPIDO' : '⚠️ LENTO' }
    };

    if (queryTime1 > 100 || queryTime2 > 200 || queryTime3 > 200) {
      report.recommendations.push('Considerar agregar índices para mejorar performance de queries');
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

    report.statistics = {
      total_vouchers: totalVouchers,
      active_vouchers: activeVouchers,
      redeemed_vouchers: redeemedVouchers,
      redemption_rate: totalVouchers > 0 ? ((redeemedVouchers / totalVouchers) * 100).toFixed(2) + '%' : 'N/A'
    };

    console.log(`Total vouchers: ${totalVouchers}`);
    console.log(`Activos: ${activeVouchers}`);
    console.log(`Cobrados: ${redeemedVouchers}`);
    console.log(`Tasa de cobro: ${report.statistics.redemption_rate}`);

    // ============================================
    // GUARDAR REPORTE
    // ============================================
    const fs = require('fs');
    const reportPath = 'INFORME_INTEGRIDAD_BD.md';

    let markdown = `# 🔍 INFORME DE INTEGRIDAD DE BASES DE DATOS\n\n`;
    markdown += `**Fecha**: ${new Date().toLocaleString('es-DO')}\n\n`;
    markdown += `---\n\n`;

    markdown += `## 📋 1. ESTRUCTURA DE TABLAS\n\n`;
    markdown += `### Tabla VOUCHERS\n\n`;
    markdown += `**Estado**: ${report.tables.vouchers?.fields_status || '❓'}\n\n`;
    markdown += `**Campos presentes** (${report.tables.vouchers?.present_fields?.length || 0}):\n`;
    markdown += report.tables.vouchers?.present_fields?.map(f => `- ${f}`).join('\n') || '';
    markdown += `\n\n`;

    if (report.tables.vouchers?.missing_fields?.length > 0) {
      markdown += `**⚠️ Campos faltantes**:\n`;
      markdown += report.tables.vouchers.missing_fields.map(f => `- ${f}`).join('\n');
      markdown += `\n\n`;
    }

    markdown += `### Otras Tablas\n\n`;
    markdown += `| Tabla | Estado | Registros | Columnas |\n`;
    markdown += `|-------|--------|-----------|----------|\n`;
    ['users', 'operadores', 'stations'].forEach(table => {
      const t = report.tables[table];
      if (t) {
        markdown += `| ${table} | ${t.status} | ${t.record_count || 'N/A'} | ${t.columns?.length || 'N/A'} |\n`;
      }
    });
    markdown += `\n`;

    markdown += `## ⚡ 2. TRIGGERS\n\n`;
    markdown += `### updated_at Trigger\n\n`;
    markdown += `**Estado**: ${report.triggers.updated_at?.status || 'No verificado'}\n\n`;
    if (report.triggers.updated_at) {
      markdown += `- Código de prueba: \`${report.triggers.updated_at.test_code}\`\n`;
      markdown += `- updated_at original: ${report.triggers.updated_at.original_updated_at}\n`;
      markdown += `- updated_at después de UPDATE: ${report.triggers.updated_at.new_updated_at}\n\n`;
    }

    markdown += `## 🔍 3. ÍNDICES\n\n`;
    markdown += `### Índices Recomendados\n\n`;
    Object.entries(recommendedIndexes).forEach(([table, indexes]) => {
      markdown += `**${table}**:\n`;
      indexes.forEach(idx => {
        markdown += `- \`${idx}\`\n`;
      });
      markdown += `\n`;
    });

    markdown += `## 🔒 4. ROW LEVEL SECURITY (RLS)\n\n`;
    markdown += `**Vouchers**: ${report.rls.vouchers?.anon_access}\n\n`;
    if (report.rls.vouchers?.error) {
      markdown += `Error de acceso anónimo: \`${report.rls.vouchers.error}\`\n\n`;
    }

    markdown += `## ⚡ 5. PERFORMANCE\n\n`;
    markdown += `| Query | Tiempo | Estado |\n`;
    markdown += `|-------|--------|--------|\n`;
    markdown += `| Buscar por código | ${report.performance.query_by_code?.time_ms}ms | ${report.performance.query_by_code?.status} |\n`;
    markdown += `| Listar activos | ${report.performance.query_active?.time_ms}ms | ${report.performance.query_active?.status} |\n`;
    markdown += `| Count activos | ${report.performance.query_count?.time_ms}ms | ${report.performance.query_count?.status} |\n\n`;

    markdown += `## 📊 6. ESTADÍSTICAS\n\n`;
    markdown += `- **Total vouchers**: ${report.statistics.total_vouchers}\n`;
    markdown += `- **Vouchers activos**: ${report.statistics.active_vouchers}\n`;
    markdown += `- **Vouchers cobrados**: ${report.statistics.redeemed_vouchers}\n`;
    markdown += `- **Tasa de cobro**: ${report.statistics.redemption_rate}\n\n`;

    markdown += `## 💡 7. RECOMENDACIONES\n\n`;
    if (report.recommendations.length > 0) {
      report.recommendations.forEach((rec, i) => {
        markdown += `${i + 1}. ${rec}\n`;
      });
    } else {
      markdown += `✅ No hay recomendaciones - todo está en orden\n`;
    }
    markdown += `\n`;

    markdown += `---\n\n`;
    markdown += `**FIN DEL INFORME**\n`;

    fs.writeFileSync(reportPath, markdown);
    console.log(`\n✅ Informe guardado en: ${reportPath}`);

    // También guardar JSON
    fs.writeFileSync('db-integrity-report.json', JSON.stringify(report, null, 2));
    console.log(`✅ Datos JSON guardados en: db-integrity-report.json`);

  } catch (error) {
    console.error('\n❌ Error durante verificación:', error.message);
    console.error(error);
  }

  console.log('\n=== FIN DE VERIFICACIÓN ===\n');
}

verifyDatabaseIntegrity();
