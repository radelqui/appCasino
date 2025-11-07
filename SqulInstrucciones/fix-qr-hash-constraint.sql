-- Arreglar constraint NOT NULL en qr_hash
-- Ejecutar en Supabase SQL Editor

-- Hacer qr_hash opcional (nullable)
ALTER TABLE vouchers ALTER COLUMN qr_hash DROP NOT NULL;

-- Verificar constraint eliminado
SELECT
  column_name,
  is_nullable,
  data_type
FROM information_schema.columns
WHERE table_name = 'vouchers'
  AND column_name IN ('qr_hash', 'qr_data');
