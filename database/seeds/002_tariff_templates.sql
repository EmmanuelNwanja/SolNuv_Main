-- 002_tariff_templates.sql
-- Pre-loaded tariff templates for Nigeria (MYTO) and South Africa (Eskom)
-- Column references match migration 024_design_modelling_system.sql:
--   tariff_structures: tariff_name (not name), no effective_from
--   tariff_rates: tariff_structure_id (not tariff_id), season_key (not season_name),
--                 weekday/saturday/sunday_hours as [[start,end_exclusive],...] range arrays
--   tariff_ancillary_charges: tariff_structure_id, charge_label, rate, unit

-- ============================================================
--  NIGERIA — MYTO (Multi-Year Tariff Order) Band A–E
--  Simplified: flat-rate per band (no TOU), plus service charge
-- ============================================================

-- Band A (20+ hours supply) — Ikeja, Eko, Abuja (premium feeders)
INSERT INTO tariff_structures (tariff_name, country, utility_name, tariff_type, currency, is_template, seasons)
VALUES (
  'Nigeria MYTO Band A (Premium)',
  'NG', 'Generic DisCo', 'flat', 'NGN', true,
  '[{"key":"year_round","label":"Year-round","months":[1,2,3,4,5,6,7,8,9,10,11,12]}]'
);
INSERT INTO tariff_rates (tariff_structure_id, season_key, period_name, rate_per_kwh, weekday_hours, saturday_hours, sunday_hours)
SELECT id, 'year_round', 'flat', 225.00, '[]', '[]', '[]'
FROM tariff_structures WHERE tariff_name = 'Nigeria MYTO Band A (Premium)' AND is_template = true;
INSERT INTO tariff_ancillary_charges (tariff_structure_id, charge_type, charge_label, rate, unit)
SELECT id, 'daily', 'Fixed Service Charge', 18.32, '₦/day'
FROM tariff_structures WHERE tariff_name = 'Nigeria MYTO Band A (Premium)' AND is_template = true;

-- Band B (16–20 hours supply)
INSERT INTO tariff_structures (tariff_name, country, utility_name, tariff_type, currency, is_template, seasons)
VALUES (
  'Nigeria MYTO Band B',
  'NG', 'Generic DisCo', 'flat', 'NGN', true,
  '[{"key":"year_round","label":"Year-round","months":[1,2,3,4,5,6,7,8,9,10,11,12]}]'
);
INSERT INTO tariff_rates (tariff_structure_id, season_key, period_name, rate_per_kwh, weekday_hours, saturday_hours, sunday_hours)
SELECT id, 'year_round', 'flat', 63.36, '[]', '[]', '[]'
FROM tariff_structures WHERE tariff_name = 'Nigeria MYTO Band B' AND is_template = true;
INSERT INTO tariff_ancillary_charges (tariff_structure_id, charge_type, charge_label, rate, unit)
SELECT id, 'daily', 'Fixed Service Charge', 18.32, '₦/day'
FROM tariff_structures WHERE tariff_name = 'Nigeria MYTO Band B' AND is_template = true;

-- Band C (12–16 hours supply)
INSERT INTO tariff_structures (tariff_name, country, utility_name, tariff_type, currency, is_template, seasons)
VALUES (
  'Nigeria MYTO Band C',
  'NG', 'Generic DisCo', 'flat', 'NGN', true,
  '[{"key":"year_round","label":"Year-round","months":[1,2,3,4,5,6,7,8,9,10,11,12]}]'
);
INSERT INTO tariff_rates (tariff_structure_id, season_key, period_name, rate_per_kwh, weekday_hours, saturday_hours, sunday_hours)
SELECT id, 'year_round', 'flat', 50.00, '[]', '[]', '[]'
FROM tariff_structures WHERE tariff_name = 'Nigeria MYTO Band C' AND is_template = true;
INSERT INTO tariff_ancillary_charges (tariff_structure_id, charge_type, charge_label, rate, unit)
SELECT id, 'daily', 'Fixed Service Charge', 18.32, '₦/day'
FROM tariff_structures WHERE tariff_name = 'Nigeria MYTO Band C' AND is_template = true;

-- Band D (8–12 hours supply)
INSERT INTO tariff_structures (tariff_name, country, utility_name, tariff_type, currency, is_template, seasons)
VALUES (
  'Nigeria MYTO Band D',
  'NG', 'Generic DisCo', 'flat', 'NGN', true,
  '[{"key":"year_round","label":"Year-round","months":[1,2,3,4,5,6,7,8,9,10,11,12]}]'
);
INSERT INTO tariff_rates (tariff_structure_id, season_key, period_name, rate_per_kwh, weekday_hours, saturday_hours, sunday_hours)
SELECT id, 'year_round', 'flat', 43.80, '[]', '[]', '[]'
FROM tariff_structures WHERE tariff_name = 'Nigeria MYTO Band D' AND is_template = true;

-- Band E (< 8 hours supply)
INSERT INTO tariff_structures (tariff_name, country, utility_name, tariff_type, currency, is_template, seasons)
VALUES (
  'Nigeria MYTO Band E',
  'NG', 'Generic DisCo', 'flat', 'NGN', true,
  '[{"key":"year_round","label":"Year-round","months":[1,2,3,4,5,6,7,8,9,10,11,12]}]'
);
INSERT INTO tariff_rates (tariff_structure_id, season_key, period_name, rate_per_kwh, weekday_hours, saturday_hours, sunday_hours)
SELECT id, 'year_round', 'flat', 32.69, '[]', '[]', '[]'
FROM tariff_structures WHERE tariff_name = 'Nigeria MYTO Band E' AND is_template = true;


-- ============================================================
--  SOUTH AFRICA — Eskom Megaflex (TOU, Voltage > 500V)
--  Two seasons: High Demand (Jun–Aug) and Low Demand (Sep–May)
--  Three periods: Peak, Standard, Off-peak
--  Hours stored as [[start, end_exclusive], ...] ranges per getTOUPeriod()
-- ============================================================

INSERT INTO tariff_structures (tariff_name, country, utility_name, tariff_type, currency, is_template, seasons)
VALUES (
  'Eskom Megaflex 2024/25',
  'ZA', 'Eskom', 'tou', 'ZAR', true,
  '[{"key":"high_demand","label":"High Demand","months":[6,7,8]},{"key":"low_demand","label":"Low Demand","months":[1,2,3,4,5,9,10,11,12]}]'
);

-- High Demand Season rates (R/kWh)
INSERT INTO tariff_rates (tariff_structure_id, season_key, period_name, rate_per_kwh, weekday_hours, saturday_hours, sunday_hours)
SELECT id, 'high_demand', 'peak', 3.7979,
  '[[6,10],[17,19]]', '[]', '[]'
FROM tariff_structures WHERE tariff_name = 'Eskom Megaflex 2024/25' AND is_template = true;

INSERT INTO tariff_rates (tariff_structure_id, season_key, period_name, rate_per_kwh, weekday_hours, saturday_hours, sunday_hours)
SELECT id, 'high_demand', 'standard', 1.3189,
  '[[10,17],[19,22]]', '[[7,13],[17,21]]', '[]'
FROM tariff_structures WHERE tariff_name = 'Eskom Megaflex 2024/25' AND is_template = true;

INSERT INTO tariff_rates (tariff_structure_id, season_key, period_name, rate_per_kwh, weekday_hours, saturday_hours, sunday_hours)
SELECT id, 'high_demand', 'off_peak', 0.6366,
  '[[0,6],[22,24]]', '[[0,7],[13,17],[21,24]]', '[[0,24]]'
FROM tariff_structures WHERE tariff_name = 'Eskom Megaflex 2024/25' AND is_template = true;

-- Low Demand Season rates
INSERT INTO tariff_rates (tariff_structure_id, season_key, period_name, rate_per_kwh, weekday_hours, saturday_hours, sunday_hours)
SELECT id, 'low_demand', 'peak', 1.2379,
  '[[7,10],[17,19]]', '[]', '[]'
FROM tariff_structures WHERE tariff_name = 'Eskom Megaflex 2024/25' AND is_template = true;

INSERT INTO tariff_rates (tariff_structure_id, season_key, period_name, rate_per_kwh, weekday_hours, saturday_hours, sunday_hours)
SELECT id, 'low_demand', 'standard', 0.8419,
  '[[6,7],[10,17],[19,22]]', '[[7,13],[17,21]]', '[]'
FROM tariff_structures WHERE tariff_name = 'Eskom Megaflex 2024/25' AND is_template = true;

INSERT INTO tariff_rates (tariff_structure_id, season_key, period_name, rate_per_kwh, weekday_hours, saturday_hours, sunday_hours)
SELECT id, 'low_demand', 'off_peak', 0.5002,
  '[[0,6],[22,24]]', '[[0,7],[13,17],[21,24]]', '[[0,24]]'
FROM tariff_structures WHERE tariff_name = 'Eskom Megaflex 2024/25' AND is_template = true;

-- Eskom Megaflex ancillary charges
INSERT INTO tariff_ancillary_charges (tariff_structure_id, charge_type, charge_label, rate, unit)
SELECT id, 'netw_demand', 'Network Access Charge', 89.54, 'R/kVA'
FROM tariff_structures WHERE tariff_name = 'Eskom Megaflex 2024/25' AND is_template = true;

INSERT INTO tariff_ancillary_charges (tariff_structure_id, charge_type, charge_label, rate, unit)
SELECT id, 'daily', 'Service Charge', 299.78, 'R/day'
FROM tariff_structures WHERE tariff_name = 'Eskom Megaflex 2024/25' AND is_template = true;


-- ============================================================
--  SOUTH AFRICA — Eskom Miniflex (Smaller C&I, < 1MVA)
-- ============================================================

INSERT INTO tariff_structures (tariff_name, country, utility_name, tariff_type, currency, is_template, seasons)
VALUES (
  'Eskom Miniflex 2024/25',
  'ZA', 'Eskom', 'tou', 'ZAR', true,
  '[{"key":"high_demand","label":"High Demand","months":[6,7,8]},{"key":"low_demand","label":"Low Demand","months":[1,2,3,4,5,9,10,11,12]}]'
);

INSERT INTO tariff_rates (tariff_structure_id, season_key, period_name, rate_per_kwh, weekday_hours, saturday_hours, sunday_hours)
SELECT id, 'high_demand', 'peak', 4.2189,
  '[[6,10],[17,19]]', '[]', '[]'
FROM tariff_structures WHERE tariff_name = 'Eskom Miniflex 2024/25' AND is_template = true;

INSERT INTO tariff_rates (tariff_structure_id, season_key, period_name, rate_per_kwh, weekday_hours, saturday_hours, sunday_hours)
SELECT id, 'high_demand', 'standard', 1.4956,
  '[[10,17],[19,22]]', '[[7,13],[17,21]]', '[]'
FROM tariff_structures WHERE tariff_name = 'Eskom Miniflex 2024/25' AND is_template = true;

INSERT INTO tariff_rates (tariff_structure_id, season_key, period_name, rate_per_kwh, weekday_hours, saturday_hours, sunday_hours)
SELECT id, 'high_demand', 'off_peak', 0.7186,
  '[[0,6],[22,24]]', '[[0,7],[13,17],[21,24]]', '[[0,24]]'
FROM tariff_structures WHERE tariff_name = 'Eskom Miniflex 2024/25' AND is_template = true;

INSERT INTO tariff_rates (tariff_structure_id, season_key, period_name, rate_per_kwh, weekday_hours, saturday_hours, sunday_hours)
SELECT id, 'low_demand', 'peak', 1.3979,
  '[[7,10],[17,19]]', '[]', '[]'
FROM tariff_structures WHERE tariff_name = 'Eskom Miniflex 2024/25' AND is_template = true;

INSERT INTO tariff_rates (tariff_structure_id, season_key, period_name, rate_per_kwh, weekday_hours, saturday_hours, sunday_hours)
SELECT id, 'low_demand', 'standard', 0.9519,
  '[[6,7],[10,17],[19,22]]', '[[7,13],[17,21]]', '[]'
FROM tariff_structures WHERE tariff_name = 'Eskom Miniflex 2024/25' AND is_template = true;

INSERT INTO tariff_rates (tariff_structure_id, season_key, period_name, rate_per_kwh, weekday_hours, saturday_hours, sunday_hours)
SELECT id, 'low_demand', 'off_peak', 0.5658,
  '[[0,6],[22,24]]', '[[0,7],[13,17],[21,24]]', '[[0,24]]'
FROM tariff_structures WHERE tariff_name = 'Eskom Miniflex 2024/25' AND is_template = true;

INSERT INTO tariff_ancillary_charges (tariff_structure_id, charge_type, charge_label, rate, unit)
SELECT id, 'netw_demand', 'Network Demand Charge', 112.76, 'R/kVA'
FROM tariff_structures WHERE tariff_name = 'Eskom Miniflex 2024/25' AND is_template = true;

INSERT INTO tariff_ancillary_charges (tariff_structure_id, charge_type, charge_label, rate, unit)
SELECT id, 'daily', 'Service Charge', 145.89, 'R/day'
FROM tariff_structures WHERE tariff_name = 'Eskom Miniflex 2024/25' AND is_template = true;
