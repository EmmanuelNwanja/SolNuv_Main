-- =====================================================
-- SolNuv - Seed Data (run AFTER migrations)
-- Creates demo data for testing
-- =====================================================

-- Nigerian states for climate zone mapping
-- Used by degradation service
-- Format: (state_name, climate_zone, humidity_factor, heat_factor, surge_factor)

CREATE TABLE IF NOT EXISTS nigeria_climate_zones (
  state VARCHAR(100) PRIMARY KEY,
  climate_zone VARCHAR(50) NOT NULL,
  humidity_factor DECIMAL(4, 3) NOT NULL DEFAULT 1.0,
  heat_factor DECIMAL(4, 3) NOT NULL DEFAULT 1.0,
  surge_factor DECIMAL(4, 3) NOT NULL DEFAULT 1.0,
  degradation_multiplier DECIMAL(4, 3) GENERATED ALWAYS AS (
    1.0 + ((humidity_factor - 1.0) * 0.4) + ((heat_factor - 1.0) * 0.4) + ((surge_factor - 1.0) * 0.2)
  ) STORED
);

-- coastal/humid = faster degradation (Lagos, Rivers, Bayelsa, Delta, Cross River, Akwa Ibom)
-- Sahel/dry = faster due to heat + sand (Kano, Sokoto, Kebbi, Zamfara, Borno, Yobe, Jigawa)
-- Mixed/central = moderate (Abuja, Kwara, Niger, Kogi, Benue)
-- Southeast = moderate-high humidity (Enugu, Anambra, Imo, Abia, Ebonyi)

INSERT INTO nigeria_climate_zones (state, climate_zone, humidity_factor, heat_factor, surge_factor) VALUES
  ('Lagos', 'coastal_humid', 1.35, 1.10, 1.25),
  ('Rivers', 'coastal_humid', 1.40, 1.05, 1.20),
  ('Bayelsa', 'coastal_humid', 1.45, 1.05, 1.15),
  ('Delta', 'coastal_humid', 1.38, 1.08, 1.18),
  ('Cross River', 'coastal_humid', 1.30, 1.10, 1.15),
  ('Akwa Ibom', 'coastal_humid', 1.35, 1.08, 1.18),
  ('Kano', 'sahel_dry', 1.05, 1.40, 1.30),
  ('Sokoto', 'sahel_dry', 1.02, 1.45, 1.25),
  ('Kebbi', 'sahel_dry', 1.03, 1.43, 1.22),
  ('Zamfara', 'sahel_dry', 1.04, 1.42, 1.20),
  ('Borno', 'sahel_dry', 1.03, 1.40, 1.20),
  ('Yobe', 'sahel_dry', 1.04, 1.38, 1.18),
  ('Jigawa', 'sahel_dry', 1.05, 1.38, 1.20),
  ('Katsina', 'sahel_dry', 1.05, 1.38, 1.20),
  ('Adamawa', 'mixed', 1.18, 1.25, 1.15),
  ('FCT', 'mixed', 1.10, 1.15, 1.20),
  ('Kwara', 'mixed', 1.15, 1.18, 1.18),
  ('Niger', 'mixed', 1.12, 1.20, 1.15),
  ('Kogi', 'mixed', 1.15, 1.20, 1.18),
  ('Benue', 'mixed', 1.18, 1.18, 1.15),
  ('Plateau', 'mixed', 1.10, 1.08, 1.20),
  ('Nasarawa', 'mixed', 1.12, 1.18, 1.18),
  ('Taraba', 'mixed', 1.20, 1.22, 1.15),
  ('Kaduna', 'mixed', 1.10, 1.25, 1.22),
  ('Oyo', 'mixed', 1.20, 1.18, 1.22),
  ('Osun', 'mixed', 1.22, 1.15, 1.20),
  ('Ogun', 'mixed', 1.25, 1.12, 1.22),
  ('Ondo', 'mixed', 1.28, 1.12, 1.18),
  ('Ekiti', 'mixed', 1.22, 1.12, 1.18),
  ('Edo', 'mixed', 1.30, 1.10, 1.20),
  ('Enugu', 'se_humid', 1.28, 1.15, 1.18),
  ('Anambra', 'se_humid', 1.30, 1.12, 1.18),
  ('Imo', 'se_humid', 1.32, 1.12, 1.18),
  ('Abia', 'se_humid', 1.30, 1.12, 1.18),
  ('Ebonyi', 'se_humid', 1.28, 1.15, 1.15),
  ('Gombe', 'mixed', 1.10, 1.30, 1.20),
  ('Bauchi', 'mixed', 1.08, 1.32, 1.20),
  ('Imo', 'se_humid', 1.32, 1.12, 1.18)
ON CONFLICT (state) DO NOTHING;

-- =====================================================
-- Panel brands with silver content data
-- Silver content in mg per watt-peak (mg/Wp)
-- Source: Research data - ~0.05% mass, ~47% economic value
-- Average: ~0.1g silver per 300W panel
-- =====================================================

CREATE TABLE IF NOT EXISTS panel_brands (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand VARCHAR(255) NOT NULL,
  silver_content_mg_per_wp DECIMAL(8, 4) NOT NULL DEFAULT 0.35,
  is_popular_in_nigeria BOOLEAN DEFAULT FALSE
);

INSERT INTO panel_brands (brand, silver_content_mg_per_wp, is_popular_in_nigeria) VALUES
  ('Jinko Solar', 0.38, TRUE),
  ('Canadian Solar', 0.36, TRUE),
  ('Longi Solar', 0.32, TRUE),
  ('Luminous', 0.40, TRUE),
  ('Felicity Solar', 0.38, TRUE),
  ('Phocos', 0.35, TRUE),
  ('BioSolar', 0.33, FALSE),
  ('Astronergy', 0.35, FALSE),
  ('Trina Solar', 0.37, TRUE),
  ('Sunrun', 0.36, FALSE),
  ('Risen Energy', 0.35, FALSE),
  ('GoodWe', 0.36, FALSE),
  ('Q CELLS', 0.34, FALSE),
  ('SunPower', 0.30, FALSE),
  ('First Solar', 0.10, FALSE), -- thin-film, less silver
  ('Other', 0.35, FALSE)
ON CONFLICT DO NOTHING;

-- Battery brands
CREATE TABLE IF NOT EXISTS battery_brands (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  brand VARCHAR(255) NOT NULL,
  chemistry VARCHAR(100) DEFAULT 'lithium',
  key_materials JSONB,
  is_popular_in_nigeria BOOLEAN DEFAULT FALSE
);

INSERT INTO battery_brands (brand, chemistry, key_materials, is_popular_in_nigeria) VALUES
  ('Felicity', 'lithium-iron-phosphate', '{"lithium": 1.2, "iron": 8.5, "phosphate": 5.2}', TRUE),
  ('Luminous', 'lead-acid', '{"lead": 65.0, "sulfuric_acid": 15.0}', TRUE),
  ('Felicity Lithium', 'lithium-iron-phosphate', '{"lithium": 1.2, "iron": 8.5}', TRUE),
  ('RITAR', 'lead-acid', '{"lead": 63.0, "sulfuric_acid": 15.0}', TRUE),
  ('Leoch', 'lithium', '{"lithium": 1.1, "cobalt": 0.8}', FALSE),
  ('BYD', 'lithium-iron-phosphate', '{"lithium": 1.2, "iron": 8.5}', TRUE),
  ('Pylontech', 'lithium-iron-phosphate', '{"lithium": 1.2, "iron": 8.5}', TRUE),
  ('Trojan', 'lead-acid', '{"lead": 67.0, "sulfuric_acid": 16.0}', FALSE),
  ('Other Lead-Acid', 'lead-acid', '{"lead": 65.0}', FALSE),
  ('Other Lithium', 'lithium', '{"lithium": 1.0}', FALSE)
ON CONFLICT DO NOTHING;
