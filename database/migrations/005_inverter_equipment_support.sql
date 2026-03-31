-- =====================================================
-- SolNuv - Inverter Equipment Support
-- Adds inverter enum support and power_kw column for equipment records
-- =====================================================

DO $$
BEGIN
  ALTER TYPE equipment_type ADD VALUE 'inverter';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE equipment
  ADD COLUMN IF NOT EXISTS power_kw DECIMAL(10, 2);

CREATE INDEX IF NOT EXISTS idx_equipment_type ON equipment(equipment_type);
