const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'tito.db');
console.log('📂 Abriendo base de datos:', dbPath);

const db = new Database(dbPath);

try {
  // Ver estructura de la tabla tickets
  console.log('\n📋 Estructura de tabla "tickets":');
  const schema = db.prepare("PRAGMA table_info(tickets)").all();
  console.table(schema);

  // Ver algunos registros de ejemplo
  console.log('\n📋 Registros de ejemplo:');
  const tickets = db.prepare('SELECT * FROM tickets LIMIT 3').all();
  console.log(JSON.stringify(tickets, null, 2));

  // Contar tickets
  const count = db.prepare('SELECT COUNT(*) as total FROM tickets').get();
  console.log('\n📊 Total de tickets:', count.total);

} catch (error) {
  console.error('❌ Error:', error.message);
} finally {
  db.close();
}
