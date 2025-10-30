// test-supabase-connection.js - Script temporal para probar conexión a Supabase
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

function generateUUID() {
  return crypto.randomUUID();
}

async function testConnection() {
  console.log('================================================');
  console.log('🔍 PROBANDO CONEXIÓN A SUPABASE');
  console.log('================================================\n');

  // 1. Verificar variables de entorno
  console.log('1️⃣ Variables de entorno:');
  console.log('   SUPABASE_URL:', process.env.SUPABASE_URL ? '✅ OK' : '❌ FALTA');
  console.log('   SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? '✅ OK' : '❌ FALTA');
  console.log('   SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ OK' : '❌ FALTA');
  console.log('');

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Faltan variables de entorno requeridas');
    process.exit(1);
  }

  // 2. Crear cliente Supabase
  console.log('2️⃣ Creando cliente Supabase...');
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  console.log('   ✅ Cliente creado\n');

  // 3. Probar conexión básica
  console.log('3️⃣ Probando conexión a la base de datos...');
  try {
    const { data, error } = await supabase
      .from('vouchers')
      .select('voucher_code')
      .limit(1);

    if (error) {
      console.error('   ❌ Error:', error.message);
      console.error('   Detalles:', error);
      return false;
    }

    console.log('   ✅ Conexión exitosa a tabla "vouchers"');
    console.log('   Resultado:', data);
    console.log('');
  } catch (e) {
    console.error('   ❌ Error inesperado:', e.message);
    return false;
  }

  // 4. Verificar estructura de tabla vouchers
  console.log('4️⃣ Verificando estructura de tabla vouchers...');
  try {
    const { data, error } = await supabase
      .from('vouchers')
      .select('*')
      .limit(1);

    if (error) {
      console.error('   ❌ Error:', error.message);
      return false;
    }

    if (data && data.length > 0) {
      console.log('   ✅ Estructura de vouchers:');
      console.log('   Columnas:', Object.keys(data[0]).join(', '));
    } else {
      console.log('   ⚠️  Tabla "vouchers" está vacía');
    }
    console.log('');
  } catch (e) {
    console.error('   ❌ Error:', e.message);
  }

  // 5. Inspeccionar voucher existente para ver los tipos
  console.log('5️⃣ Inspeccionando voucher existente...');
  try {
    const { data, error } = await supabase
      .from('vouchers')
      .select('*')
      .limit(1)
      .single();

    if (!error && data) {
      console.log('   ✅ Voucher ejemplo:');
      console.log('   ', JSON.stringify(data, null, 2));
      console.log('');
    }
  } catch (e) {
    console.log('   ⚠️  No hay vouchers en la BD');
  }

  // 6. Probar INSERT (crear voucher de prueba)
  console.log('6️⃣ Probando INSERT de voucher de prueba...');
  try {
    const voucherCode = `TEST-${Date.now()}`;
    const amount = 100.00;
    const currency = 'DOP';
    const qrData = `${voucherCode}|${amount}|${currency}`;
    const qrHash = crypto.createHash('sha256').update(qrData + process.env.QR_SECRET).digest('hex');

    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + 365 * 24 * 60 * 60 * 1000); // +365 días

    const testVoucher = {
      voucher_code: voucherCode,
      qr_data: qrData,
      qr_hash: qrHash,
      amount: amount,
      currency: currency,
      issued_at_station_id: 1, // INTEGER - ID de mesa/estación existente
      issued_by_user_id: '85397c30-3856-4d82-a4bb-06791b8cacd0', // UUID de usuario existente
      status: 'active',
      issued_at: issuedAt.toISOString(),
      expires_at: expiresAt.toISOString()
    };

    const { data, error } = await supabase
      .from('vouchers')
      .insert(testVoucher)
      .select()
      .single();

    if (error) {
      console.error('   ❌ Error en INSERT:', error.message);
      console.error('   Detalles:', error);
      return false;
    }

    console.log('   ✅ INSERT exitoso');
    console.log('   Voucher creado:', data.voucher_code);
    console.log('');

    // 7. Probar SELECT del voucher recién creado
    console.log('7️⃣ Probando SELECT del voucher creado...');
    const { data: selectData, error: selectError } = await supabase
      .from('vouchers')
      .select('*')
      .eq('voucher_code', testVoucher.voucher_code)
      .single();

    if (selectError) {
      console.error('   ❌ Error en SELECT:', selectError.message);
      return false;
    }

    console.log('   ✅ SELECT exitoso');
    console.log('   Voucher encontrado:', selectData.voucher_code);
    console.log('');

    // 8. Limpiar - DELETE del voucher de prueba
    console.log('8️⃣ Limpiando voucher de prueba...');
    const { error: deleteError } = await supabase
      .from('vouchers')
      .delete()
      .eq('voucher_code', testVoucher.voucher_code);

    if (deleteError) {
      console.warn('   ⚠️  No se pudo eliminar voucher de prueba:', deleteError.message);
    } else {
      console.log('   ✅ Voucher de prueba eliminado');
    }
    console.log('');

  } catch (e) {
    console.error('   ❌ Error inesperado:', e.message);
    return false;
  }

  // Resultado final
  console.log('================================================');
  console.log('✅ TODAS LAS PRUEBAS PASARON EXITOSAMENTE');
  console.log('✅ Supabase está configurado correctamente');
  console.log('✅ Listo para integración en la aplicación');
  console.log('================================================');

  return true;
}

// Ejecutar test
testConnection()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('\n❌ ERROR FATAL:', error.message);
    console.error(error);
    process.exit(1);
  });
