// Test script para verificar db.createTicket()
const path = require('path');

// Cargar la clase de base de datos
const CasinoDatabase = require(path.join(__dirname, 'Caja', 'database'));

// Crear instancia
const dbPath = path.join(__dirname, 'data', 'casino.db');
const db = new CasinoDatabase(dbPath);

console.log('🧪 Probando db.createTicket()...\n');

// Test 1: Con objeto
const testData = {
  amount: 335.45,
  currency: 'DOP',
  mesa: 'P03',
  usuario_emision: 'Carlos Rodríguez'
};

console.log('📥 Datos de entrada:', testData);

try {
  const result = db.createTicket(testData);
  console.log('\n📦 Resultado COMPLETO de db.createTicket():');
  console.log(JSON.stringify(result, null, 2));

  console.log('\n🔍 Verificando campos:');
  console.log('  result.code:', result.code);
  console.log('  result.ticket_number:', result.ticket_number);
  console.log('  result.id:', result.id);

  // Verificar en la base de datos
  if (result.ticket_number) {
    const ticket = db.getTicket(result.ticket_number);
    console.log('\n✅ Ticket en BD:', ticket);
  }

} catch (error) {
  console.error('\n❌ Error:', error);
  console.error(error.stack);
} finally {
  db.close();
  console.log('\n✅ Test completado');
}
