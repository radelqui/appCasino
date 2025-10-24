# Paso 3: Implementar TDD - Tests PRIMERO para generador QR
import os

# Crear test para generador QR (TDD - Test First)
qr_generator_test = '''// tests/unit/qr-generator.test.js
const { generateTicketQR, parseTicketQR, validateTicketQR } = require('../../src/main/utils/qr-generator');

describe('QR Generator', () => {
  const mockTicketData = {
    id: 'T123456789',
    valor: 534.00,
    moneda: 'DOP',
    fecha: '2025-10-12T08:02:00Z'
  };

  describe('generateTicketQR', () => {
    test('should generate QR with correct data structure', async () => {
      const result = await generateTicketQR(mockTicketData);
      
      expect(result).toHaveProperty('qrCode');
      expect(result).toHaveProperty('hash');
      expect(result).toHaveProperty('qrString');
      expect(result.qrCode).toMatch(/^data:image\\/png;base64,/);
      expect(result.hash).toHaveLength(16);
    });

    test('should generate different hashes for different data', async () => {
      const data1 = { ...mockTicketData, valor: 100 };
      const data2 = { ...mockTicketData, valor: 200 };
      
      const result1 = await generateTicketQR(data1);
      const result2 = await generateTicketQR(data2);
      
      expect(result1.hash).not.toBe(result2.hash);
    });

    test('should handle different currencies', async () => {
      const dopData = { ...mockTicketData, moneda: 'DOP' };
      const usdData = { ...mockTicketData, moneda: 'USD' };
      
      const dopResult = await generateTicketQR(dopData);
      const usdResult = await generateTicketQR(usdData);
      
      expect(dopResult.qrString).toContain('DOP');
      expect(usdResult.qrString).toContain('USD');
    });
  });

  describe('parseTicketQR', () => {
    test('should parse valid QR string correctly', () => {
      const qrString = 'T123456789|534.00|DOP|2025-10-12T08:02:00Z|abc123def456';
      const parsed = parseTicketQR(qrString);
      
      expect(parsed).toEqual({
        id: 'T123456789',
        valor: 534.00,
        moneda: 'DOP',
        fecha: '2025-10-12T08:02:00Z',
        hash: 'abc123def456'
      });
    });

    test('should throw error for invalid QR format', () => {
      const invalidQR = 'invalid|format';
      
      expect(() => parseTicketQR(invalidQR)).toThrow('Invalid QR format');
    });

    test('should handle numeric conversion correctly', () => {
      const qrString = 'T123|1234.56|USD|2025-10-12T08:02:00Z|hash';
      const parsed = parseTicketQR(qrString);
      
      expect(parsed.valor).toBe(1234.56);
      expect(typeof parsed.valor).toBe('number');
    });
  });

  describe('validateTicketQR', () => {
    test('should validate correct QR string', async () => {
      const result = await generateTicketQR(mockTicketData);
      const isValid = validateTicketQR(result.qrString);
      
      expect(isValid).toBe(true);
    });

    test('should reject tampered QR string', () => {
      const tamperedQR = 'T123456789|999.00|DOP|2025-10-12T08:02:00Z|invalidhash';
      const isValid = validateTicketQR(tamperedQR);
      
      expect(isValid).toBe(false);
    });

    test('should reject malformed QR string', () => {
      const malformedQR = 'invalid-qr-string';
      const isValid = validateTicketQR(malformedQR);
      
      expect(isValid).toBe(false);
    });
  });
});
'''

with open('tito-casino-system/tests/unit/qr-generator.test.js', 'w') as f:
    f.write(qr_generator_test)

print("✅ Test para generador QR creado (TDD - Test First)")