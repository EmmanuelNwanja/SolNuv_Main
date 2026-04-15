-- 048_equipment_technology_fields.sql
-- Add panel_technology and battery_chemistry columns to equipment table.
-- These store which technology/chemistry was selected when the equipment was registered,
-- enabling accurate SOH, degradation, and valuation calculations per-record.

ALTER TABLE equipment ADD COLUMN IF NOT EXISTS panel_technology  VARCHAR(50)  DEFAULT NULL;
ALTER TABLE equipment ADD COLUMN IF NOT EXISTS battery_chemistry VARCHAR(50)  DEFAULT NULL;
