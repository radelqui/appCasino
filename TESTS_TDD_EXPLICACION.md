# Tests TDD - Explicación Simple

## ¿Qué son estos tests?

Son **pruebas automatizadas** que **BUSCAN ERRORES EN EL CÓDIGO** antes de que rompan la app.

### Diferencia con el Sistema de Salud

| Sistema de Salud | Tests TDD |
|------------------|-----------|
| Detecta cuando la app se BLOQUEA | Detecta cuando el código tiene BUGS |
| Funciona en producción (cuando usas la app) | Funciona ANTES de desplegar (cuando estás desarrollando) |
| Te dice "la app está colgada" | Te dice "este código tiene un error" |
| NO previene bugs | SÍ previene bugs |

**Los dos trabajan juntos:**
- Tests TDD → Encuentran bugs ANTES
- Sistema de Salud → Detecta bloqueos DESPUÉS

## ¿Qué tests están funcionando?

✅ **62 tests pasando** que detectan:

### 1. Errores de Validación
- Amount inválido (texto en vez de número)
- Moneda inválida (EUR en vez de DOP/USD)
- Código de voucher mal formateado
- Campos requeridos faltantes

### 2. Errores de Lógica
- **Doble canje** (canjear un ticket ya canjeado)
- **Campos faltantes** (mesa y operador no aparecen en Caja)
- **Estados incorrectos** (intentar canjear ticket cancelado)

### 3. Errores de Supabase
- Variables de entorno faltantes
- Foreign key constraints
- Errores de conexión

## Cómo ejecutar los tests

```bash
# Ejecutar todos los tests
npm test

# Ver resultados en tiempo real mientras editas código
npm run test:watch

# Ver cobertura de código
npm run test:coverage
```

## Ejemplo: Cómo los tests encuentran bugs

### Bug Real: Doble Canje

**Código SIN test (con bug):**
```javascript
async function redeemVoucher(code, cajeroId) {
  // ❌ NO valida estado - permite doble canje
  db.updateTicket(code, { estado: 'canjeado' });
  return { success: true };
}
```

**Test que detecta el bug:**
```javascript
test('Debe rechazar ticket ya canjeado', () => {
  const ticket = { code: 'PREV-001', estado: 'canjeado' };

  const result = redeemVoucher(ticket.code, 'Cajero1');

  expect(result.success).toBe(false); // ❌ FALLA - el código tiene bug
});
```

**Código CORREGIDO (sin bug):**
```javascript
async function redeemVoucher(code, cajeroId) {
  const ticket = db.getTicket(code);

  // ✅ Valida estado antes de canjear
  if (ticket.estado !== 'emitido') {
    return { success: false, error: 'Ticket ya canjeado' };
  }

  db.updateTicket(code, { estado: 'canjeado' });
  return { success: true };
}
```

**Test ahora pasa:**
```javascript
test('Debe rechazar ticket ya canjeado', () => {
  const ticket = { code: 'PREV-001', estado: 'canjeado' };

  const result = redeemVoucher(ticket.code, 'Cajero1');

  expect(result.success).toBe(false); // ✅ PASA - código corregido
});
```

## Resultados al ejecutar

### ✅ Cuando todos pasan:
```
PASS tests/validation.test.js
  ✓ ✅ Debe aceptar números válidos
  ✓ ❌ Debe rechazar valores inválidos
  ✓ ✅ Debe aceptar monedas válidas

Test Suites: 3 passed, 3 total
Tests:       62 passed, 62 total
```

**Significado:** Tu código funciona bien. Puedes hacer commit y desplegar.

### ❌ Cuando hay errores:
```
FAIL tests/handlers.test.js
  ✗ Debe validar que amount sea un número

    Expected: false
    Received: true

Test Suites: 1 failed, 2 passed, 3 total
Tests:       1 failed, 61 passed, 62 total
```

**Significado:** Hay un BUG en el código. Arreglar ANTES de hacer commit.

## Cuándo ejecutar tests

### SIEMPRE ejecutar ANTES de:
1. ✅ Hacer commit en git
2. ✅ Desplegar a producción
3. ✅ Crear un build/release
4. ✅ Después de cambiar código crítico

### Workflow recomendado:
```bash
# 1. Hacer cambios en el código
# (editar archivos .js)

# 2. Ejecutar tests
npm test

# 3. Si pasan, hacer commit
git add .
git commit -m "fix: corregir validación de voucher"

# 4. Si fallan, arreglar primero
# (no hacer commit hasta que pasen)
```

## ¿Qué bugs detectan estos tests?

### ✅ Bug 1: Doble canje
Intenta canjear un ticket que ya fue canjeado antes.

### ✅ Bug 2: Campos faltantes
Falta el campo `mesa` u `operador` en la respuesta (por eso Caja mostraba "N/A").

### ✅ Bug 3: Input inválido
Se envía texto en vez de número en el campo `amount`.

### ✅ Bug 4: Moneda incorrecta
Se intenta usar EUR cuando solo se permite DOP/USD.

### ✅ Bug 5: Código mal formateado
Se envía "INVALID" en vez de "PREV-123456".

### ✅ Bug 6: Estados incorrectos
Se intenta canjear un ticket que está "cancelado" o "expirado".

## Resumen

**Tests TDD = Búsqueda Automática de Bugs**

- ✅ **62 tests funcionando** que encuentran errores de código
- ✅ Ejecuta con `npm test` antes de cada commit
- ✅ Si fallan, significa que hay un BUG que debes arreglar
- ✅ Si pasan, significa que el código funciona correctamente

**Sistema de Salud = Detección de Bloqueos**

- ✅ Detecta cuando la app se congela en producción
- ✅ Muestra qué operación está colgada (DB, Supabase, Impresora)
- ✅ Indicador visual en esquina superior derecha

**Ambos juntos = App estable sin bugs ni bloqueos** 🚀
