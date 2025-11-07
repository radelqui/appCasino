// Debug script para verificar qué está causando que electron sea undefined
console.log('===== INICIO DEBUG =====');

console.log('1. Intentando cargar electron...');
let path;
try {
  const electron = require('electron');
  console.log('✅ electron cargado');
  console.log('  Propiedades:', Object.keys(electron).filter(k => isNaN(k)).join(', '));
  console.log('✅ app:', typeof electron.app);
  console.log('✅ ipcMain:', typeof electron.ipcMain);
  console.log('✅ BrowserWindow:', typeof electron.BrowserWindow);
} catch (e) {
  console.error('❌ Error cargando electron:', e.message);
}

console.log('\n2. Intentando cargar path...');
try {
  path = require('path');
  console.log('✅ path cargado');
} catch (e) {
  console.error('❌ Error:', e.message);
}

console.log('\n3. Intentando cargar dotenv...');
try {
  require('dotenv').config();
  console.log('✅ dotenv cargado');
} catch (e) {
  console.error('❌ Error:', e.message);
}

console.log('\n4. Intentando cargar healthMonitor...');
try {
  const { getHealthMonitor } = require(path.join(__dirname, 'pure', 'healthMonitor'));
  console.log('✅ healthMonitor cargado');
} catch (e) {
  console.error('❌ Error:', e.message);
}

console.log('\n5. Intentando cargar supabaseManager...');
try {
  const { getSupabaseManager } = require(path.join(__dirname, 'pure', 'supabaseManager'));
  console.log('✅ supabaseManager cargado');
} catch (e) {
  console.error('❌ Error:', e.message);
}

console.log('\n6. Intentando cargar safeOperations...');
try {
  const { SafeDatabaseOperations, SafeSupabaseOperations } = require(path.join(__dirname, 'pure', 'safeOperations'));
  console.log('✅ safeOperations cargado');
} catch (e) {
  console.error('❌ Error:', e.message);
}

console.log('\n7. Intentando cargar CasinoDatabase...');
try {
  const CasinoDatabase = require(path.join(__dirname, 'Caja', 'database'));
  console.log('✅ CasinoDatabase cargado');
} catch (e) {
  console.error('❌ Error:', e.message);
}

console.log('\n===== FIN DEBUG =====');
