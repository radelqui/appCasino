/**
 * Script para resetear los PINs de los usuarios del sistema
 * Ejecutar con: node reset-users-pins.js
 */

const Database = require('better-sqlite3');
// Usar bcryptjs para evitar compilación nativa en Windows/Node
const bcrypt = require('bcryptjs');

// Abrir la base de datos
const db = new Database('./casino_vouchers.db');

// Usuarios con sus PINs por defecto
const usuarios = [
  { email: 'admin@casinosusua.com', pin: '0000', role: 'admin' },
  { email: 'mesa1@casinosusua.com', pin: '1111', role: 'operator' },
  { email: 'mesa2@casinosusua.com', pin: '2222', role: 'operator' },
  { email: 'mesa3@casinosusua.com', pin: '3333', role: 'operator' },
  { email: 'mesa4@casinosusua.com', pin: '4444', role: 'operator' },
  { email: 'caja@casinosusua.com', pin: '5555', role: 'cashier' },
  { email: 'auditor@casinosusua.com', pin: '9999', role: 'auditor' }
];

console.log('🔄 Iniciando reseteo de PINs...\n');

// Preparar statements
const updateStmt = db.prepare('UPDATE users SET pin = ? WHERE email = ?');
const verifyStmt = db.prepare('SELECT email, role FROM users WHERE email = ?');

for (const usuario of usuarios) {
  try {
    // Hashear el PIN
    const hashedPin = bcrypt.hashSync(usuario.pin, 10);
    
    // Actualizar en la base de datos
    const result = updateStmt.run(hashedPin, usuario.email);
    
    if (result.changes > 0) {
      console.log(`✅ ${usuario.email} (${usuario.role})`);
      console.log(`   PIN: ${usuario.pin}`);
      console.log(`   Hash: ${hashedPin.substring(0, 20)}...`);
    } else {
      console.log(`⚠️  ${usuario.email} - Usuario no encontrado`);
    }
  } catch (error) {
    console.log(`❌ Error al actualizar ${usuario.email}:`, error.message);
  }
  console.log('');
}

// Verificar usuarios actualizados
console.log('\n📋 Verificación de usuarios en la base de datos:');
const allUsers = db.prepare('SELECT email, role, active FROM users').all();
console.table(allUsers);

console.log('\n✨ Proceso completado!');
console.log('\n📝 Credenciales de acceso:');
console.log('═'.repeat(50));
usuarios.forEach(u => {
  console.log(`${u.role.toUpperCase().padEnd(10)} | ${u.email.padEnd(30)} | PIN: ${u.pin}`);
});
console.log('═'.repeat(50));

db.close();
