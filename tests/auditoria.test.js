const { describe, test, expect, beforeEach } = require('@jest/globals');

describe('🔍 AUDITORÍA - Tests TDD', () => {

  // ============================================
  // 1. MAPEO DE ESTADOS SUPABASE → FRONTEND
  // ============================================
  describe('Mapeo de Estados Supabase → Frontend', () => {

    function mapearVouchersSupabase(vouchers) {
      return vouchers.map(v => ({
        code: v.voucher_code,
        amount: v.amount,
        currency: v.currency,
        estado: v.status === 'active' ? 'emitido' :
                v.status === 'redeemed' ? 'canjeado' :
                v.status === 'cancelled' ? 'cancelado' : v.status,
        created_at: v.issued_at,
        used_at: v.redeemed_at,
        mesa: v.issued_at_station_id ? `Mesa ${v.issued_at_station_id}` : 'N/A',
        operador: v.customer_name || (v.issued_by_user_id ? `Usuario ${v.issued_by_user_id.substring(0, 8)}` : 'N/A')
      }));
    }

    test('✅ Debe mapear status "active" a "emitido"', () => {
      const voucher = {
        voucher_code: 'TEST-001',
        amount: 100,
        currency: 'DOP',
        status: 'active',
        issued_at: '2025-10-29T12:00:00Z',
        redeemed_at: null,
        issued_at_station_id: 1,
        customer_name: null,
        issued_by_user_id: '12345678-1234-1234-1234-123456789012'
      };

      const resultado = mapearVouchersSupabase([voucher])[0];

      expect(resultado.estado).toBe('emitido');
      expect(resultado.code).toBe('TEST-001');
      expect(resultado.mesa).toBe('Mesa 1');
    });

    test('✅ Debe mapear status "redeemed" a "canjeado"', () => {
      const voucher = {
        voucher_code: 'TEST-002',
        amount: 200,
        currency: 'USD',
        status: 'redeemed',
        issued_at: '2025-10-29T12:00:00Z',
        redeemed_at: '2025-10-29T14:00:00Z',
        issued_at_station_id: 2,
        customer_name: 'Juan Pérez',
        issued_by_user_id: '12345678-1234-1234-1234-123456789012'
      };

      const resultado = mapearVouchersSupabase([voucher])[0];

      expect(resultado.estado).toBe('canjeado');
      expect(resultado.used_at).toBe('2025-10-29T14:00:00Z');
      expect(resultado.operador).toBe('Juan Pérez');
    });

    test('✅ Debe mapear status "cancelled" a "cancelado"', () => {
      const voucher = {
        voucher_code: 'TEST-003',
        amount: 50,
        currency: 'DOP',
        status: 'cancelled',
        issued_at: '2025-10-29T12:00:00Z',
        redeemed_at: null,
        issued_at_station_id: null,
        customer_name: null,
        issued_by_user_id: null
      };

      const resultado = mapearVouchersSupabase([voucher])[0];

      expect(resultado.estado).toBe('cancelado');
      expect(resultado.mesa).toBe('N/A');
      expect(resultado.operador).toBe('N/A');
    });

    test('✅ Debe usar customer_name como operador si existe', () => {
      const voucher = {
        voucher_code: 'TEST-004',
        amount: 150,
        currency: 'DOP',
        status: 'active',
        issued_at: '2025-10-29T12:00:00Z',
        redeemed_at: null,
        issued_at_station_id: 3,
        customer_name: 'María López',
        issued_by_user_id: '12345678-1234-1234-1234-123456789012'
      };

      const resultado = mapearVouchersSupabase([voucher])[0];

      expect(resultado.operador).toBe('María López');
    });

    test('✅ Debe usar primeros 8 chars del UUID si no hay customer_name', () => {
      const voucher = {
        voucher_code: 'TEST-005',
        amount: 75,
        currency: 'USD',
        status: 'active',
        issued_at: '2025-10-29T12:00:00Z',
        redeemed_at: null,
        issued_at_station_id: 1,
        customer_name: null,
        issued_by_user_id: 'abcdef12-3456-7890-abcd-ef1234567890'
      };

      const resultado = mapearVouchersSupabase([voucher])[0];

      expect(resultado.operador).toBe('Usuario abcdef12');
    });
  });

  // ============================================
  // 2. MAPEO DE ESTADOS FRONTEND → SUPABASE
  // ============================================
  describe('Mapeo de Estados Frontend → Supabase (Filtros)', () => {

    function mapearEstadoFrontendASupabase(estado) {
      const estadoMap = {
        'emitido': 'active',
        'activo': 'active',
        'canjeado': 'redeemed',
        'usado': 'redeemed',
        'cancelado': 'cancelled'
      };
      return estadoMap[estado.toLowerCase()] || estado;
    }

    test('✅ Debe convertir "emitido" a "active"', () => {
      expect(mapearEstadoFrontendASupabase('emitido')).toBe('active');
    });

    test('✅ Debe convertir "activo" a "active"', () => {
      expect(mapearEstadoFrontendASupabase('activo')).toBe('active');
    });

    test('✅ Debe convertir "canjeado" a "redeemed"', () => {
      expect(mapearEstadoFrontendASupabase('canjeado')).toBe('redeemed');
    });

    test('✅ Debe convertir "usado" a "redeemed"', () => {
      expect(mapearEstadoFrontendASupabase('usado')).toBe('redeemed');
    });

    test('✅ Debe convertir "cancelado" a "cancelled"', () => {
      expect(mapearEstadoFrontendASupabase('cancelado')).toBe('cancelled');
    });

    test('✅ Debe manejar mayúsculas correctamente', () => {
      expect(mapearEstadoFrontendASupabase('EMITIDO')).toBe('active');
      expect(mapearEstadoFrontendASupabase('Canjeado')).toBe('redeemed');
    });

    test('❌ BUG POTENCIAL: Estado desconocido debe retornar el original', () => {
      expect(mapearEstadoFrontendASupabase('pendiente')).toBe('pendiente');
      expect(mapearEstadoFrontendASupabase('expirado')).toBe('expirado');
    });
  });

  // ============================================
  // 3. CÁLCULO DE ESTADÍSTICAS
  // ============================================
  describe('Cálculo de Estadísticas', () => {

    function calcularEstadisticas(tickets) {
      const emitidos = tickets.filter(t =>
        ['emitido', 'active', 'activo'].includes(String(t.estado || t.status || '').toLowerCase())
      );
      const canjeados = tickets.filter(t =>
        ['canjeado', 'redeemed', 'usado'].includes(String(t.estado || t.status || '').toLowerCase())
      );
      const cancelados = tickets.filter(t =>
        ['cancelado', 'cancelled'].includes(String(t.estado || t.status || '').toLowerCase())
      );

      const totalDOP = tickets
        .filter(t => (t.currency || t.moneda) === 'DOP')
        .reduce((sum, t) => sum + (Number(t.amount || t.valor) || 0), 0);

      const totalUSD = tickets
        .filter(t => (t.currency || t.moneda) === 'USD')
        .reduce((sum, t) => sum + (Number(t.amount || t.valor) || 0), 0);

      const canjeadosDOP = canjeados
        .filter(t => (t.currency || t.moneda) === 'DOP')
        .reduce((sum, t) => sum + (Number(t.amount || t.valor) || 0), 0);

      const canjeadosUSD = canjeados
        .filter(t => (t.currency || t.moneda) === 'USD')
        .reduce((sum, t) => sum + (Number(t.amount || t.valor) || 0), 0);

      return {
        total: tickets.length,
        emitidos: emitidos.length,
        canjeados: canjeados.length,
        cancelados: cancelados.length,
        pendientes: emitidos.length,
        totalDOP: totalDOP.toFixed(2),
        totalUSD: totalUSD.toFixed(2),
        canjeadosDOP: canjeadosDOP.toFixed(2),
        canjeadosUSD: canjeadosUSD.toFixed(2),
        pendientesDOP: (totalDOP - canjeadosDOP).toFixed(2),
        pendientesUSD: (totalUSD - canjeadosUSD).toFixed(2)
      };
    }

    test('✅ Debe calcular estadísticas con datos de Supabase', () => {
      const tickets = [
        { status: 'active', amount: 100, currency: 'DOP' },
        { status: 'active', amount: 200, currency: 'USD' },
        { status: 'redeemed', amount: 50, currency: 'DOP' }
      ];

      const stats = calcularEstadisticas(tickets);

      expect(stats.total).toBe(3);
      expect(stats.emitidos).toBe(2);
      expect(stats.canjeados).toBe(1);
      expect(stats.totalDOP).toBe('150.00');
      expect(stats.totalUSD).toBe('200.00');
    });

    test('✅ Debe calcular estadísticas con datos de SQLite', () => {
      const tickets = [
        { estado: 'emitido', amount: 100, currency: 'DOP' },
        { estado: 'emitido', amount: 200, currency: 'USD' },
        { estado: 'usado', amount: 50, currency: 'DOP' }
      ];

      const stats = calcularEstadisticas(tickets);

      expect(stats.total).toBe(3);
      expect(stats.emitidos).toBe(2);
      expect(stats.canjeados).toBe(1); // ✅ Ahora reconoce 'usado'
      expect(stats.totalDOP).toBe('150.00');
      expect(stats.totalUSD).toBe('200.00');
    });

    test('✅ Debe calcular estadísticas mixtas (Supabase + SQLite)', () => {
      const tickets = [
        { status: 'active', amount: 100, currency: 'DOP' },
        { estado: 'emitido', valor: 150, moneda: 'DOP' },
        { status: 'redeemed', amount: 75, currency: 'USD' }
      ];

      const stats = calcularEstadisticas(tickets);

      expect(stats.total).toBe(3);
      expect(stats.emitidos).toBe(2);
      expect(stats.canjeados).toBe(1);
      expect(stats.totalDOP).toBe('250.00');
      expect(stats.totalUSD).toBe('75.00');
    });

    test('✅ Debe calcular pendientes correctamente', () => {
      const tickets = [
        { status: 'active', amount: 300, currency: 'DOP' },
        { status: 'redeemed', amount: 100, currency: 'DOP' },
        { status: 'active', amount: 200, currency: 'USD' }
      ];

      const stats = calcularEstadisticas(tickets);

      expect(stats.pendientes).toBe(2); // 2 activos
      expect(stats.pendientesDOP).toBe('300.00'); // 400 total - 100 canjeados
      expect(stats.pendientesUSD).toBe('200.00'); // 200 total - 0 canjeados
    });

    test('❌ BUG POTENCIAL: Debe manejar valores null/undefined', () => {
      const tickets = [
        { status: 'active', amount: null, currency: 'DOP' },
        { estado: 'emitido', valor: undefined, moneda: 'USD' },
        { status: 'redeemed', amount: 0, currency: 'DOP' }
      ];

      const stats = calcularEstadisticas(tickets);

      expect(stats.total).toBe(3);
      expect(stats.totalDOP).toBe('0.00'); // null + 0 = 0
      expect(stats.totalUSD).toBe('0.00'); // undefined = 0
    });

    test('❌ BUG POTENCIAL: Debe manejar montos negativos', () => {
      const tickets = [
        { status: 'active', amount: -100, currency: 'DOP' }
      ];

      const stats = calcularEstadisticas(tickets);

      // ⚠️ El sistema NO valida montos negativos
      expect(stats.totalDOP).toBe('-100.00');
    });

    test('✅ Debe manejar array vacío', () => {
      const stats = calcularEstadisticas([]);

      expect(stats.total).toBe(0);
      expect(stats.emitidos).toBe(0);
      expect(stats.canjeados).toBe(0);
      expect(stats.totalDOP).toBe('0.00');
      expect(stats.totalUSD).toBe('0.00');
    });
  });

  // ============================================
  // 4. FILTROS DE BÚSQUEDA
  // ============================================
  describe('Filtros de Búsqueda', () => {

    test('✅ Debe convertir mesa "P01" a station_id 1', () => {
      const mesa = 'P01';
      const stationNum = mesa.match(/\d+/);
      const stationId = stationNum ? parseInt(stationNum[0]) : null;

      expect(stationId).toBe(1);
    });

    test('✅ Debe convertir mesa "P12" a station_id 12', () => {
      const mesa = 'P12';
      const stationNum = mesa.match(/\d+/);
      const stationId = stationNum ? parseInt(stationNum[0]) : null;

      expect(stationId).toBe(12);
    });

    test('✅ Debe convertir mesa "Mesa 5" a station_id 5', () => {
      const mesa = 'Mesa 5';
      const stationNum = mesa.match(/\d+/);
      const stationId = stationNum ? parseInt(stationNum[0]) : null;

      expect(stationId).toBe(5);
    });

    test('❌ BUG POTENCIAL: Mesa sin número debe retornar null', () => {
      const mesa = 'Principal';
      const stationNum = mesa.match(/\d+/);
      const stationId = stationNum ? parseInt(stationNum[0]) : null;

      expect(stationId).toBe(null);
    });
  });

  // ============================================
  // 5. FORMATO DE FECHAS
  // ============================================
  describe('Formato de Fechas para Queries', () => {

    test('✅ Debe formatear fecha inicio correctamente', () => {
      const fechaDesde = '2025-10-29';
      const isoFechaDesde = new Date(fechaDesde).toISOString();

      expect(isoFechaDesde).toContain('2025-10-29');
      expect(isoFechaDesde).toContain('T00:00:00'); // Inicio del día
    });

    test('✅ Debe formatear fecha fin con hora 23:59:59', () => {
      const fechaHasta = '2025-10-29';
      // Usar el método corregido (setUTCHours)
      const fechaFin = new Date(fechaHasta);
      fechaFin.setUTCHours(23, 59, 59, 999);
      const isoFechaHasta = fechaFin.toISOString();

      expect(isoFechaHasta).toContain('2025-10-29');
      expect(isoFechaHasta).toContain('T23:59:59'); // Fin del día
    });

    test('❌ BUG POTENCIAL: Fecha inválida debe ser manejada', () => {
      const fechaInvalida = 'invalid-date';
      const fecha = new Date(fechaInvalida);

      expect(fecha.toString()).toBe('Invalid Date');
      // ⚠️ El sistema NO valida fechas inválidas antes de enviar a Supabase
    });
  });

  // ============================================
  // 6. VALIDACIONES DE DATOS
  // ============================================
  describe('Validaciones de Datos', () => {

    test('❌ BUG: Debe validar que voucher_code no esté vacío', () => {
      const voucher = {
        voucher_code: '',
        amount: 100,
        currency: 'DOP',
        status: 'active'
      };

      // El sistema NO valida códigos vacíos
      expect(voucher.voucher_code).toBe('');
    });

    test('❌ BUG: Debe validar que amount sea positivo', () => {
      const voucher = {
        voucher_code: 'TEST-001',
        amount: -50,
        currency: 'DOP',
        status: 'active'
      };

      // El sistema NO valida montos negativos
      expect(voucher.amount).toBeLessThan(0);
    });

    test('❌ BUG: Debe validar que currency sea USD o DOP', () => {
      const voucher = {
        voucher_code: 'TEST-001',
        amount: 100,
        currency: 'EUR', // Moneda inválida
        status: 'active'
      };

      const monedasValidas = ['USD', 'DOP'];
      const esValido = monedasValidas.includes(voucher.currency);

      // El sistema NO valida monedas inválidas en auditoría
      expect(esValido).toBe(false);
    });
  });

  // ============================================
  // 7. PAGINACIÓN
  // ============================================
  describe('Paginación', () => {

    test('✅ Debe calcular offset correctamente para página 1', () => {
      const page = 1;
      const limit = 20;
      const offset = (page - 1) * limit;

      expect(offset).toBe(0);
    });

    test('✅ Debe calcular offset correctamente para página 3', () => {
      const page = 3;
      const limit = 20;
      const offset = (page - 1) * limit;

      expect(offset).toBe(40);
    });

    test('✅ Debe calcular total de páginas correctamente', () => {
      const total = 47;
      const limit = 20;
      const totalPages = Math.ceil(total / limit);

      expect(totalPages).toBe(3); // 20 + 20 + 7 = 47
    });

    test('❌ BUG POTENCIAL: Página negativa debe ser manejada', () => {
      const page = -1;
      const limit = 20;
      const offset = (page - 1) * limit;

      // ⚠️ Offset negativo causará error en query
      expect(offset).toBe(-40);
    });

    test('❌ BUG POTENCIAL: Límite cero debe ser manejado', () => {
      const page = 1;
      const limit = 0;
      const offset = (page - 1) * limit;

      // ⚠️ Límite 0 causará problemas
      expect(offset).toBe(0);
      expect(limit).toBe(0);
    });
  });

});
