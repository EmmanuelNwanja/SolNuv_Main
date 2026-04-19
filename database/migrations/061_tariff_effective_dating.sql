-- =====================================================
-- Migration 061: Tariff effective dating
-- =====================================================
-- Adds optional effective-from / effective-to windows to tariff_structures so
-- a simulation can resolve the regime that applied at a specific date.
-- Nullable so existing rows continue to work unchanged.

ALTER TABLE tariff_structures
  ADD COLUMN IF NOT EXISTS effective_from TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS effective_to   TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_tariff_structures_effective_from
  ON tariff_structures(effective_from);
CREATE INDEX IF NOT EXISTS idx_tariff_structures_effective_to
  ON tariff_structures(effective_to);

COMMENT ON COLUMN tariff_structures.effective_from IS
  'Inclusive lower bound for when this tariff regime applies. NULL = unbounded past.';
COMMENT ON COLUMN tariff_structures.effective_to IS
  'Exclusive upper bound for when this tariff regime applies. NULL = still in effect.';
