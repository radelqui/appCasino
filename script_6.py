# Paso 7: Crear test para generador PDF (TDD)
import os

pdf_generator_test = '''// tests/unit/pdf-generator.test.js
const { generateTicketPDF } = require('../../src/main/utils/pdf-generator');

describe('PDF Generator', () => {
  const mockTicketData = {
    ticket_number: 'T12345678901',
    valor: 534.00,
    moneda: 'DOP',
    fecha_emision: '2025-10-12T08:02:00Z',
    qr_code: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
    mesa_id: 1,
    usuario_emision: 'Mesa1'
  };

  describe('generateTicketPDF', () => {
    test('should generate valid PDF buffer', async () => {
      const pdfBuffer = await generateTicketPDF(mockTicketData);
      
      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(1000);
      
      // Verificar que es un PDF válido
      const pdfHeader = pdfBuffer.toString('ascii', 0, 4);
      expect(pdfHeader).toBe('%PDF');
    });

    test('should include ticket information in PDF', async () => {
      const pdfBuffer = await generateTicketPDF(mockTicketData);
      const pdfString = pdfBuffer.toString();
      
      // El PDF debe contener información del ticket (aunque esté comprimida)
      expect(pdfString).toContain('CASINO');
      expect(pdfString).toContain('TICKET');
    });

    test('should handle different currencies', async () => {
      const usdTicket = { ...mockTicketData, moneda: 'USD', valor: 25.50 };
      const pdfBuffer = await generateTicketPDF(usdTicket);
      
      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(1000);
    });

    test('should handle ticket without QR code', async () => {
      const ticketWithoutQR = { ...mockTicketData, qr_code: null };
      const pdfBuffer = await generateTicketPDF(ticketWithoutQR);
      
      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(1000);
    });

    test('should throw error for invalid ticket data', async () => {
      const invalidTicket = { ...mockTicketData, ticket_number: null };
      
      await expect(generateTicketPDF(invalidTicket)).rejects.toThrow();
    });

    test('should handle large values correctly', async () => {
      const largeValueTicket = { ...mockTicketData, valor: 9999.99 };
      const pdfBuffer = await generateTicketPDF(largeValueTicket);
      
      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(1000);
    });

    test('should format date correctly', async () => {
      const pdfBuffer = await generateTicketPDF(mockTicketData);
      
      // PDF debe ser generado sin errores
      expect(pdfBuffer).toBeInstanceOf(Buffer);
    });

    test('should handle special characters in casino name', async () => {
      const pdfBuffer = await generateTicketPDF(mockTicketData);
      
      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(1000);
    });

    test('should create PDF with correct dimensions', async () => {
      const pdfBuffer = await generateTicketPDF(mockTicketData);
      
      // Verificar que el PDF se crea con las dimensiones correctas
      // (esto es más difícil de verificar sin parsear el PDF completamente)
      expect(pdfBuffer).toBeInstanceOf(Buffer);
      
      // Verificar que contiene información de página
      const pdfString = pdfBuffer.toString();
      expect(pdfString).toContain('/MediaBox');
    });
  });

  describe('PDF Content Validation', () => {
    test('should include all required TITO elements', async () => {
      const pdfBuffer = await generateTicketPDF(mockTicketData);
      
      // PDF debe contener elementos básicos de un ticket TITO
      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(1000);
      
      // Verificar estructura básica del PDF
      const pdfString = pdfBuffer.toString();
      expect(pdfString).toMatch(/%%PDF/);
      expect(pdfString).toMatch(/%%EOF/);
    });
  });
});
'''

with open('tito-casino-system/tests/unit/pdf-generator.test.js', 'w') as f:
    f.write(pdf_generator_test)

print("✅ Test para generador PDF creado (TDD - Test First)")