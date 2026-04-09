-- Migration 042: Extend calculator_usage calc_type check for design usage tracking keys.

ALTER TABLE calculator_usage
  DROP CONSTRAINT IF EXISTS valid_calc_type;

ALTER TABLE calculator_usage
  ADD CONSTRAINT valid_calc_type CHECK (
    calc_type IN (
      'panel',
      'battery',
      'degradation',
      'roi',
      'battery-soh',
      'cable-size',
      'design_simulation',
      'design_load_profile',
      'design_auto_size'
    )
  );
