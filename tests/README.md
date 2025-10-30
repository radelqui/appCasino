# Tests TDD Automatizados

Sistema de tests automatizados que **BUSCA Y PREVIENE** errores de código ANTES de que rompan la aplicación.

## 🎯 ¿Qué son estos tests?

Son **tests automatizados (TDD - Test Driven Development)** que verifican el código funciona correctamente antes de ejecutar la app en producción.

### Tests vs Sistema de Salud

| Sistema de Salud | Tests TDD |
|------------------|-----------|
| ✅ Detecta cuando la app se bloquea | ✅ Previene errores ANTES de que sucedan |
| ✅ Muestra qué operación está colgada | ✅ Verifica que el código funciona correctamente |
| ✅ Funciona en tiempo real (producción) | ✅ Se ejecuta ANTES de desplegar |
| ❌ No previene bugs, solo los detecta | ✅ Encuentra bugs en el código |

**Ambos sistemas trabajan juntos:**
- Tests TDD → Previenen errores de código
- Sistema de Salud → Detecta bloqueos en producción

## 📁 Archivos de Tests

### 1. `database.test.js` - Tests de SQLite
Verifica operaciones de base de datos local:
- ✅ Crear tickets con validación
- ✅ Buscar tickets por código
- ✅ Actualizar estado de tickets
- ✅ Prevenir doble canje
- ✅ Transacciones con rollback
- ✅ Sincronización con Supabase

**Errores que detecta:**
- Códigos duplicados
- Campos requeridos faltantes
- Tickets ya canjeados
- Errores de transacción
- Problemas de sincronización

### 2. `handlers.test.js` - Tests de IPC Handlers
Verifica lógica de handlers (pure/main.js):
- ✅ Validación de entrada (amount, currency)
- ✅ Generación de códigos únicos
- ✅ Normalización de códigos
- ✅ Detección de estados válidos
- ✅ Prevención de race conditions

**Errores que detecta:**
- Inputs inválidos (null, NaN, vacíos)
- Códigos con formato incorrecto
- Monedas no permitidas
- Estados inválidos para canje
- Campos faltantes (mesa, operador)

### 3. `supabase.test.js` - Tests de Supabase
Verifica integración con cloud:
- ✅ Validación de variables de entorno
- ✅ Generación de QR hash
- ✅ Cálculo de fechas de expiración
- ✅ Validación de UUIDs
- ✅ Manejo de errores de constraint
- ✅ Modo offline

**Errores que detecta:**
- Variables de entorno faltantes
- Formato de URL incorrecto
- Foreign key constraints
- Códigos duplicados
- Errores de conexión

## 🚀 Cómo Ejecutar los Tests

### Opción 1: Usando el script automatizado (Recomendado)
```bash
run-tests.bat
```

Este script ejecuta:
1. Todos los tests unitarios
2. Genera reporte de cobertura
3. Muestra resultados en consola

### Opción 2: Comandos npm directos
```bash
# Ejecutar todos los tests una vez
npm test

# Ejecutar tests en modo watch (re-ejecuta al guardar cambios)
npm run test:watch

# Ejecutar tests con reporte de cobertura
npm run test:coverage
```

## 📊 Interpretar Resultados

### ✅ Tests Pasando
```
PASS tests/database.test.js
  ✓ Debe crear ticket con código único (15ms)
  ✓ NO debe crear ticket con código duplicado (8ms)
  ✓ Debe encontrar ticket por código exacto (5ms)

Test Suites: 3 passed, 3 total
Tests:       45 passed, 45 total
```

**Significado:** Todo el código funciona correctamente. Puedes desplegar a producción con confianza.

### ❌ Tests Fallando
```
FAIL tests/handlers.test.js
  ✗ Debe validar que amount sea un número (12ms)

    expect(isNaN(amount)).toBe(false)

    Expected: false
    Received: true

Test Suites: 1 failed, 2 passed, 3 total
Tests:       1 failed, 44 passed, 45 total
```

**Significado:** Hay un BUG en el código. El handler NO está validando correctamente el campo `amount`. Arreglar antes de desplegar.

## 🎯 Cuándo Ejecutar Tests

### SIEMPRE ejecutar tests antes de:
- ✅ Hacer commit en git
- ✅ Desplegar a producción
- ✅ Crear un release/build
- ✅ Después de hacer cambios en código crítico

### Ejemplo de workflow:
```bash
# 1. Hacer cambios en el código
# 2. Ejecutar tests
npm test

# 3. Si pasan, hacer commit
git add .
git commit -m "feat: agregar validación de voucher"

# 4. Si fallan, arreglar primero
# (no hacer commit hasta que pasen)
```

## 📈 Reporte de Cobertura

Después de ejecutar `npm run test:coverage`, abre:

```
coverage/index.html
```

Este reporte muestra:
- **% de líneas testeadas** - ¿Cuánto código está cubierto por tests?
- **Líneas sin testear** - ¿Qué código NO tiene tests?
- **Branches sin testear** - ¿Qué condiciones if/else faltan?

**Meta recomendada:** > 70% de cobertura en código crítico

## 🔧 Agregar Nuevos Tests

### Crear un nuevo archivo de test:
```javascript
// tests/miModulo.test.js
describe('Mi Módulo', () => {
  test('Debe hacer algo específico', () => {
    const resultado = miFuncion(input);
    expect(resultado).toBe(esperado);
  });
});
```

### Estructura de un test:
```javascript
test('Descripción de qué debe hacer', () => {
  // 1. Arrange - Preparar datos
  const input = { amount: 100, currency: 'DOP' };

  // 2. Act - Ejecutar función
  const result = validateTicket(input);

  // 3. Assert - Verificar resultado
  expect(result.valid).toBe(true);
});
```

## 🐛 Ejemplos de Bugs que los Tests Detectan

### Bug 1: Doble canje
```javascript
// ❌ Código sin test (permite doble canje)
async function redeemVoucher(code) {
  db.updateTicket(code, { estado: 'canjeado' });
  return { success: true };
}

// ✅ Test detecta el bug
test('Debe rechazar ticket ya canjeado', () => {
  db.insertTicket({ code: 'TEST-001', estado: 'canjeado' });

  const result = redeemVoucher('TEST-001');

  expect(result.success).toBe(false); // FALLA - el código no valida estado
});

// ✅ Código corregido
async function redeemVoucher(code) {
  const ticket = db.getTicket(code);
  if (ticket.estado !== 'emitido') {
    return { success: false, error: 'Ticket ya canjeado' };
  }
  db.updateTicket(code, { estado: 'canjeado' });
  return { success: true };
}
```

### Bug 2: Campo faltante
```javascript
// ❌ Código sin test (falta campo "mesa")
async function validateVoucher(code) {
  const ticket = db.getTicket(code);
  return {
    valid: true,
    voucher: {
      code: ticket.code,
      amount: ticket.amount
      // falta "mesa" y "operador"
    }
  };
}

// ✅ Test detecta el bug
test('Debe retornar campo mesa', () => {
  const result = validateVoucher('TEST-001');

  expect(result.voucher).toHaveProperty('mesa'); // FALLA - campo faltante
});
```

### Bug 3: Input inválido
```javascript
// ❌ Código sin test (no valida input)
function generateTicket(amount) {
  const code = 'PREV-' + Math.random();
  db.insertTicket({ code, amount });
  return code;
}

// ✅ Test detecta el bug
test('Debe rechazar amount inválido', () => {
  expect(() => {
    generateTicket('abc'); // string en vez de número
  }).toThrow(); // FALLA - el código no valida
});

// ✅ Código corregido
function generateTicket(amount) {
  if (isNaN(amount) || amount <= 0) {
    throw new Error('Amount debe ser un número positivo');
  }
  const code = 'PREV-' + Math.random();
  db.insertTicket({ code, amount });
  return code;
}
```

## 🔄 Integración Continua (CI)

Puedes automatizar la ejecución de tests en GitHub Actions:

```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm install
      - run: npm test
```

Esto ejecuta tests automáticamente en cada commit.

## 📚 Recursos Adicionales

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [TDD Explained](https://en.wikipedia.org/wiki/Test-driven_development)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)

## ❓ Preguntas Frecuentes

### ¿Los tests reemplazan el sistema de salud?
No. El sistema de salud detecta bloqueos en producción. Los tests previenen bugs ANTES de desplegar.

### ¿Debo ejecutar tests en cada cambio?
Sí, especialmente en código crítico (handlers, database, validaciones).

### ¿Qué hago si un test falla?
1. Lee el mensaje de error
2. Identifica qué función está fallando
3. Arregla el código
4. Re-ejecuta el test
5. Repite hasta que pase

### ¿Puedo hacer commit si los tests fallan?
No. Nunca hagas commit con tests fallando. Primero arregla el código.

## 🎓 Resumen

**Tests TDD = Prevención de Bugs**

- ✅ Ejecuta antes de desplegar
- ✅ Encuentra errores de código
- ✅ Valida que el código funciona
- ✅ Previene bugs en producción

**Sistema de Salud = Detección de Bloqueos**

- ✅ Ejecuta en producción
- ✅ Detecta operaciones colgadas
- ✅ Muestra timeouts
- ✅ Ayuda a diagnosticar problemas

**Ambos trabajando juntos = App estable y confiable** 🚀
