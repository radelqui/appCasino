#!/usr/bin/env node
/**
 * SCRIPT DE VERIFICACIÓN: Handlers Restaurados
 *
 * Verifica que los 7 handlers IPC recuperados estén correctamente
 * declarados en pure/main.js
 */

const fs = require('fs');
const path = require('path');

const mainJsPath = path.join(__dirname, 'pure', 'main.js');
const content = fs.readFileSync(mainJsPath, 'utf8');

// Lista de handlers que deben estar presentes
const requiredHandlers = [
  'printer:detect',
  'printer:save-config',
  'printer:get-config',
  'printer:set-default',
  'printer:test-print',
  'currency:get-config',
  'currency:save-config'
];

console.log('🔍 Verificando handlers restaurados en pure/main.js...\n');

let allFound = true;
const results = [];

requiredHandlers.forEach(handler => {
  // Buscar patrón: safeIpcHandle('handler-name',
  const pattern = new RegExp(`safeIpcHandle\\(['"]${handler.replace(':', '\\:')}['"]`, 'g');
  const matches = content.match(pattern);

  if (matches && matches.length > 0) {
    results.push({ handler, status: '✅', found: true, count: matches.length });
  } else {
    results.push({ handler, status: '❌', found: false, count: 0 });
    allFound = false;
  }
});

// Mostrar resultados
console.log('═══════════════════════════════════════════════════');
console.log('HANDLERS DE CONFIGURACIÓN RESTAURADOS:');
console.log('═══════════════════════════════════════════════════\n');

console.log('📋 Impresoras (5 handlers):');
results.slice(0, 5).forEach(r => {
  console.log(`  ${r.status} ${r.handler} ${r.found ? `(${r.count}x)` : '- NO ENCONTRADO'}`);
});

console.log('\n💰 Monedas (2 handlers):');
results.slice(5, 7).forEach(r => {
  console.log(`  ${r.status} ${r.handler} ${r.found ? `(${r.count}x)` : '- NO ENCONTRADO'}`);
});

console.log('\n═══════════════════════════════════════════════════');
console.log(`RESULTADO: ${allFound ? '✅ TODOS LOS HANDLERS RESTAURADOS' : '❌ FALTAN ALGUNOS HANDLERS'}`);
console.log('═══════════════════════════════════════════════════\n');

// Verificar también que no haya duplicados
const duplicates = results.filter(r => r.count > 1);
if (duplicates.length > 0) {
  console.log('⚠️  ADVERTENCIA: Handlers duplicados detectados:');
  duplicates.forEach(d => {
    console.log(`   - ${d.handler}: ${d.count} veces`);
  });
  console.log();
}

// Estadísticas
console.log('📊 Estadísticas:');
console.log(`   - Handlers requeridos: ${requiredHandlers.length}`);
console.log(`   - Handlers encontrados: ${results.filter(r => r.found).length}`);
console.log(`   - Handlers faltantes: ${results.filter(r => !r.found).length}`);
console.log();

// Buscar también los archivos HTML que los usan
console.log('🔗 Verificando módulos HTML:');

const htmlModules = [
  { file: 'impresoras.html', handlers: ['printer:detect', 'printer:get-config', 'printer:save-config', 'printer:set-default', 'printer:test-print'] },
  { file: 'monedas.html', handlers: ['currency:get-config', 'currency:save-config'] }
];

htmlModules.forEach(module => {
  const htmlPath = path.join(__dirname, 'pure', module.file);
  if (fs.existsSync(htmlPath)) {
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');
    console.log(`   ✅ ${module.file} (${module.handlers.length} handlers)`);

    module.handlers.forEach(handler => {
      const pattern = new RegExp(`['"]${handler.replace(':', '\\:')}['"]`);
      const found = pattern.test(htmlContent);
      if (!found) {
        console.log(`      ⚠️  Handler "${handler}" no usado en HTML`);
      }
    });
  } else {
    console.log(`   ❌ ${module.file} - NO ENCONTRADO`);
  }
});

console.log();

// Exit code
process.exit(allFound ? 0 : 1);
