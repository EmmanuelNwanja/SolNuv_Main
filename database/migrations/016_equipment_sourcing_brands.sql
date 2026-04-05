-- =====================================================
-- SolNuv - Equipment Sourcing Info + Custom Brands
-- 016: Equipment supply-chain sourcing fields,
--      inverter_brands table, and is_custom flag for
--      panel_brands / battery_brands.
-- =====================================================

-- 1. Add sourcing_info JSONB column to equipment table
--    Stores supply-chain details (direct import / local purchase) per equipment row.
ALTER TABLE equipment
  ADD COLUMN IF NOT EXISTS sourcing_info JSONB;

COMMENT ON COLUMN equipment.sourcing_info IS
  'Supply sourcing details. Shape: { type: "direct_import"|"local_purchase",
   supply_contract_date, import_eta_date, oem_name, country_of_supply,
   distributor_name, distributor_state, delivery_date }';

-- 2. Extend panel_brands with custom-brand tracking columns
ALTER TABLE panel_brands
  ADD COLUMN IF NOT EXISTS is_custom BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS submitted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- 3. Extend battery_brands with custom-brand tracking columns
ALTER TABLE battery_brands
  ADD COLUMN IF NOT EXISTS is_custom BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS submitted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- 4. Create inverter_brands table (mirrors panel_brands / battery_brands)
CREATE TABLE IF NOT EXISTS inverter_brands (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand         VARCHAR(255) NOT NULL,
  is_popular_in_nigeria BOOLEAN NOT NULL DEFAULT FALSE,
  is_custom     BOOLEAN NOT NULL DEFAULT FALSE,
  submitted_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_inverter_brand UNIQUE (brand)
);

CREATE INDEX IF NOT EXISTS idx_inverter_brands_popular
  ON inverter_brands(is_popular_in_nigeria DESC);
