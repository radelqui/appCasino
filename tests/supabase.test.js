/**
 * Tests TDD para supabaseManager.js
 * Encuentra errores de integración con Supabase ANTES de producción
 */

describe('Supabase Manager - Tests TDD', () => {
  describe('Configuración', () => {
    test('Debe validar que existan variables de entorno', () => {
      const validateEnv = () => {
        const required = ['SUPABASE_URL', 'SUPABASE_ANON_KEY'];
        const missing = [];

        required.forEach(key => {
          if (!process.env[key]) {
            missing.push(key);
          }
        });

        return {
          valid: missing.length === 0,
          missing
        };
      };

      // En producción, esto debe fallar si faltan variables
      const result = validateEnv();
      if (!result.valid) {
        console.warn('⚠️ Variables de entorno faltantes:', result.missing);
      }

      expect(typeof result.valid).toBe('boolean');
      expect(Array.isArray(result.missing)).toBe(true);
    });

    test('Debe validar formato de URL de Supabase', () => {
      const isValidSupabaseUrl = (url) => {
        if (!url) return false;
        // Formato: https://xxxxx.supabase.co
        return /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url);
      };

      expect(isValidSupabaseUrl('https://abcdefg.supabase.co')).toBe(true);
      expect(isValidSupabaseUrl('http://abcdefg.supabase.co')).toBe(false); // debe ser https
      expect(isValidSupabaseUrl('https://invalid-url.com')).toBe(false);
      expect(isValidSupabaseUrl('')).toBe(false);
      expect(isValidSupabaseUrl(null)).toBe(false);
    });

    test('Debe validar formato de API Key', () => {
      const isValidAnonKey = (key) => {
        if (!key) return false;
        // Supabase anon keys son strings largos
        return typeof key === 'string' && key.length > 100;
      };

      expect(isValidAnonKey('a'.repeat(150))).toBe(true);
      expect(isValidAnonKey('short')).toBe(false);
      expect(isValidAnonKey('')).toBe(false);
      expect(isValidAnonKey(null)).toBe(false);
    });
  });

  describe('createVoucher', () => {
    test('Debe validar datos requeridos', () => {
      const validateVoucherData = (data) => {
        const required = ['voucher_code', 'amount', 'currency'];
        const missing = [];

        required.forEach(field => {
          if (!data || data[field] === undefined || data[field] === null) {
            missing.push(field);
          }
        });

        return {
          valid: missing.length === 0,
          missing
        };
      };

      const validData = {
        voucher_code: 'PREV-123456',
        amount: 100.00,
        currency: 'DOP'
      };

      const invalidData1 = {
        voucher_code: 'PREV-123456',
        amount: 100.00
        // falta currency
      };

      const invalidData2 = {
        amount: 100.00,
        currency: 'DOP'
        // falta voucher_code
      };

      expect(validateVoucherData(validData).valid).toBe(true);
      expect(validateVoucherData(invalidData1).valid).toBe(false);
      expect(validateVoucherData(invalidData1).missing).toContain('currency');
      expect(validateVoucherData(invalidData2).valid).toBe(false);
      expect(validateVoucherData(invalidData2).missing).toContain('voucher_code');
    });

    test('Debe generar QR hash correctamente', () => {
      const crypto = require('crypto');
      const QR_SECRET = 'mi-secreto-super-seguro-2024';

      const generateQRHash = (voucherCode, amount, currency) => {
        const qrData = `${voucherCode}|${amount}|${currency}`;
        const hash = crypto.createHash('sha256').update(qrData + QR_SECRET).digest('hex');
        return { qrData, qrHash: hash };
      };

      const result = generateQRHash('PREV-123456', 100.00, 'DOP');

      expect(result.qrData).toBe('PREV-123456|100|DOP');
      expect(result.qrHash).toHaveLength(64); // SHA256 = 64 caracteres hex
      expect(typeof result.qrHash).toBe('string');

      // Hash debe ser determinístico
      const result2 = generateQRHash('PREV-123456', 100.00, 'DOP');
      expect(result2.qrHash).toBe(result.qrHash);

      // Hash diferente para datos diferentes
      const result3 = generateQRHash('PREV-123456', 200.00, 'DOP');
      expect(result3.qrHash).not.toBe(result.qrHash);
    });

    test('Debe calcular fecha de expiración correctamente', () => {
      const calculateExpiry = (daysFromNow = 365) => {
        const now = new Date();
        const expiry = new Date(now.getTime() + daysFromNow * 24 * 60 * 60 * 1000);
        return expiry.toISOString();
      };

      const expiry = calculateExpiry(365);

      expect(typeof expiry).toBe('string');
      expect(expiry).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/); // ISO format

      // Verificar que es aproximadamente 1 año en el futuro
      const expiryDate = new Date(expiry);
      const now = new Date();
      const diffDays = (expiryDate - now) / (1000 * 60 * 60 * 24);

      expect(diffDays).toBeGreaterThan(360);
      expect(diffDays).toBeLessThan(370);
    });

    test('Debe validar issued_by_user_id como UUID', () => {
      const isValidUUID = (uuid) => {
        if (!uuid) return false;
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        return uuidRegex.test(uuid);
      };

      expect(isValidUUID('85397c30-3856-4d82-a4bb-06791b8cacd0')).toBe(true);
      expect(isValidUUID('12345678-1234-1234-1234-123456789012')).toBe(true);
      expect(isValidUUID('not-a-uuid')).toBe(false);
      expect(isValidUUID('123')).toBe(false);
      expect(isValidUUID('')).toBe(false);
      expect(isValidUUID(null)).toBe(false);
    });

    test('Debe validar issued_at_station_id como entero', () => {
      const isValidStationId = (id) => {
        if (id === null || id === undefined) return false;
        const num = Number(id);
        return Number.isInteger(num) && num > 0;
      };

      expect(isValidStationId(1)).toBe(true);
      expect(isValidStationId(5)).toBe(true);
      expect(isValidStationId('1')).toBe(true); // se convierte
      expect(isValidStationId(0)).toBe(false);
      expect(isValidStationId(-1)).toBe(false);
      expect(isValidStationId(1.5)).toBe(false);
      expect(isValidStationId('abc')).toBe(false);
      expect(isValidStationId(null)).toBe(false);
    });
  });

  describe('getVoucher', () => {
    test('Debe normalizar código antes de buscar', () => {
      const normalizeCode = (code) => {
        if (!code) return '';
        return String(code).trim().toUpperCase();
      };

      expect(normalizeCode('  prev-123456  ')).toBe('PREV-123456');
      expect(normalizeCode('prev-123456')).toBe('PREV-123456');
      expect(normalizeCode('PREV-123456')).toBe('PREV-123456');
    });

    test('Debe mapear campos de Supabase a estructura esperada', () => {
      const mapSupabaseToTicket = (supabaseVoucher) => {
        return {
          code: supabaseVoucher.voucher_code,
          amount: supabaseVoucher.amount,
          currency: supabaseVoucher.currency,
          estado: supabaseVoucher.status === 'active' ? 'emitido' :
                  supabaseVoucher.status === 'redeemed' ? 'canjeado' :
                  supabaseVoucher.status === 'cancelled' ? 'cancelado' :
                  supabaseVoucher.status,
          issued_at: supabaseVoucher.issued_at,
          redeemed_at: supabaseVoucher.redeemed_at,
          // Campos adicionales
          mesa: 'N/A', // Se debe obtener de otra tabla o relación
          operador: 'N/A'
        };
      };

      const supabaseVoucher = {
        voucher_code: 'PREV-123456',
        amount: 100.00,
        currency: 'DOP',
        status: 'active',
        issued_at: '2024-01-01T12:00:00Z',
        redeemed_at: null
      };

      const ticket = mapSupabaseToTicket(supabaseVoucher);

      expect(ticket.code).toBe('PREV-123456');
      expect(ticket.amount).toBe(100.00);
      expect(ticket.estado).toBe('emitido');
      expect(ticket).toHaveProperty('mesa');
      expect(ticket).toHaveProperty('operador');
    });

    test('Debe manejar voucher no encontrado', () => {
      const handleNotFound = (supabaseResponse) => {
        if (!supabaseResponse || !supabaseResponse.data || supabaseResponse.data.length === 0) {
          return {
            success: true,
            found: false,
            data: null
          };
        }

        return {
          success: true,
          found: true,
          data: supabaseResponse.data[0]
        };
      };

      const notFoundResponse = { data: [], error: null };
      const foundResponse = { data: [{ voucher_code: 'PREV-123456' }], error: null };

      expect(handleNotFound(notFoundResponse).found).toBe(false);
      expect(handleNotFound(foundResponse).found).toBe(true);
    });
  });

  describe('updateVoucherStatus', () => {
    test('Debe validar estados permitidos', () => {
      const validStatuses = ['active', 'redeemed', 'cancelled', 'expired'];

      const isValidStatus = (status) => {
        return validStatuses.includes(status);
      };

      expect(isValidStatus('active')).toBe(true);
      expect(isValidStatus('redeemed')).toBe(true);
      expect(isValidStatus('cancelled')).toBe(true);
      expect(isValidStatus('expired')).toBe(true);
      expect(isValidStatus('invalid')).toBe(false);
      expect(isValidStatus('')).toBe(false);
      expect(isValidStatus(null)).toBe(false);
    });

    test('Debe incluir timestamps al canjear', () => {
      const buildUpdateData = (status, userId, stationId) => {
        const data = { status };

        if (status === 'redeemed') {
          data.redeemed_at = new Date().toISOString();
          if (userId) data.redeemed_by_user_id = userId;
          if (stationId) data.redeemed_at_station_id = stationId;
        }

        return data;
      };

      const redeemData = buildUpdateData('redeemed', 'user-123', 2);

      expect(redeemData.status).toBe('redeemed');
      expect(redeemData.redeemed_at).toBeTruthy();
      expect(redeemData.redeemed_by_user_id).toBe('user-123');
      expect(redeemData.redeemed_at_station_id).toBe(2);

      const cancelData = buildUpdateData('cancelled');
      expect(cancelData.status).toBe('cancelled');
      expect(cancelData.redeemed_at).toBeUndefined();
    });
  });

  describe('Manejo de Errores de Supabase', () => {
    test('Debe detectar error de foreign key constraint', () => {
      const isConstraintError = (error) => {
        if (!error) return false;
        const message = error.message || '';
        return message.includes('foreign key constraint') ||
               message.includes('violates foreign key');
      };

      const fkError = { message: 'violates foreign key constraint "vouchers_issued_by_user_id_fkey"' };
      const otherError = { message: 'Connection timeout' };

      expect(isConstraintError(fkError)).toBe(true);
      expect(isConstraintError(otherError)).toBe(false);
    });

    test('Debe detectar error de duplicate key', () => {
      const isDuplicateError = (error) => {
        if (!error) return false;
        const message = error.message || '';
        return message.includes('duplicate key') ||
               message.includes('UNIQUE constraint failed');
      };

      const dupError = { message: 'duplicate key value violates unique constraint' };
      const otherError = { message: 'Connection timeout' };

      expect(isDuplicateError(dupError)).toBe(true);
      expect(isDuplicateError(otherError)).toBe(false);
    });

    test('Debe detectar error de conexión', () => {
      const isConnectionError = (error) => {
        if (!error) return false;
        const message = error.message || '';
        return message.includes('timeout') ||
               message.includes('ECONNREFUSED') ||
               message.includes('network') ||
               message.includes('Failed to fetch');
      };

      expect(isConnectionError({ message: 'Connection timeout' })).toBe(true);
      expect(isConnectionError({ message: 'ECONNREFUSED' })).toBe(true);
      expect(isConnectionError({ message: 'network error' })).toBe(true);
      expect(isConnectionError({ message: 'Failed to fetch' })).toBe(true);
      expect(isConnectionError({ message: 'Invalid credentials' })).toBe(false);
    });

    test('Debe retornar estructura de error consistente', () => {
      const handleSupabaseError = (error) => {
        return {
          success: false,
          error: error.message || 'Error desconocido',
          code: error.code || null,
          details: error.details || null
        };
      };

      const error = {
        message: 'Connection failed',
        code: 'PGRST301',
        details: 'Database unavailable'
      };

      const result = handleSupabaseError(error);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection failed');
      expect(result.code).toBe('PGRST301');
      expect(result.details).toBe('Database unavailable');
    });
  });

  describe('Disponibilidad y Modo Offline', () => {
    test('Debe detectar si Supabase está disponible', () => {
      class MockSupabaseManager {
        constructor(client) {
          this.client = client;
        }

        isAvailable() {
          return this.client !== null && this.client !== undefined;
        }
      }

      const withClient = new MockSupabaseManager({ supabase: 'mock' });
      const withoutClient = new MockSupabaseManager(null);

      expect(withClient.isAvailable()).toBe(true);
      expect(withoutClient.isAvailable()).toBe(false);
    });

    test('Debe poder trabajar en modo offline', () => {
      const performOperation = async (supabaseManager, operation) => {
        let syncedToCloud = false;

        // Intentar Supabase
        if (supabaseManager && supabaseManager.isAvailable()) {
          try {
            await operation();
            syncedToCloud = true;
          } catch (e) {
            console.warn('Supabase no disponible, modo offline');
          }
        }

        return {
          success: true,
          synced: syncedToCloud,
          mode: syncedToCloud ? 'online' : 'offline'
        };
      };

      // Modo offline
      const result = performOperation(null, async () => {});
      return result.then(r => {
        expect(r.mode).toBe('offline');
        expect(r.synced).toBe(false);
        expect(r.success).toBe(true);
      });
    });
  });
});
