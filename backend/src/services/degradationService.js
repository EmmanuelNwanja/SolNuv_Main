/**
 * SolNuv Degradation Service
 * West African Climate-Adjusted Panel Lifespan Calculator
 * 
 * Based on research: Standard 20-25 year OEM warranty drops to
 * 7-12 years in West African conditions due to:
 * - Coastal humidity (Lagos, Rivers, Delta)
 * - Extreme heat (Kano, Sokoto)
 * - Irregular inverter surges
 */

const supabase = require('../config/database');
const { PANEL_TECHNOLOGIES } = require('../constants/technologyConstants');

// Base lifespan range (in years) - West African conditions
const BASE_LIFESPAN_YEARS = { min: 7, max: 12 };

// Climate zone degradation factors (multiplier on YEARS, so lower = shorter life)
const CLIMATE_DEFAULTS = {
  coastal_humid: { factor: 0.72, description: 'Coastal Humid Zone' },
  sahel_dry: { factor: 0.75, description: 'Sahel/Desert Zone' },
  se_humid: { factor: 0.78, description: 'Southeast Humid Zone' },
  mixed: { factor: 0.85, description: 'Mixed Climate Zone' },
  default: { factor: 0.80, description: 'Unknown Zone' },
};

/**
 * Fetch climate data for a Nigerian state
 */
async function getStateClimate(state) {
  const { data, error } = await supabase
    .from('nigeria_climate_zones')
    .select('*')
    .eq('state', state)
    .single();

  if (error || !data) {
    // Default to mixed if state not found
    return {
      climate_zone: 'mixed',
      humidity_factor: 1.10,
      heat_factor: 1.15,
      surge_factor: 1.18,
      degradation_multiplier: 1.15,
    };
  }
  return data;
}

/**
 * Calculate expected decommissioning date for a panel
 * @param {string} state - Nigerian state name
 * @param {Date} installationDate - Date of installation
 * @param {string} panelBrand - Brand name (kept for backward compat, not used in calc)
 * @param {string} panelTechnology - Optional panel technology key from PANEL_TECHNOLOGIES
 * @returns {object}
 */
async function calculateDecommissionDate(state, installationDate, panelBrand = 'Other', panelTechnology = null) {
  const climate = await getStateClimate(state);

  // Technology-specific degradation rate takes precedence when known.
  // We derive expected lifespan from: when does cumulative degradation hit 80% (i.e. 20% loss)?
  // lifespan = (degradation_threshold - first_year_loss) / annual_deg_rate_per_year
  const tech = panelTechnology && PANEL_TECHNOLOGIES[panelTechnology];

  let clampedLifespan;

  if (tech) {
    // West African lifespan approach: start from the original climate-factor
    // lifespan (7–12 years), then adjust by technology quality ratio.
    //
    // A technology with LOWER degradation than the average (mono_perc, 0.45%/yr)
    // gets a proportional lifespan bonus. One with HIGHER degradation gets a penalty.
    //
    // Example: HJT (0.25%/yr) in Sahel → original ~7yr × (0.45/0.25) = ~12.6yr
    //          poly_bsf (0.70%/yr) in Sahel → ~7yr × (0.45/0.70) = ~4.5yr (clamped to 5)
    const baseLifespan = 9.5;
    const climateDegradation = climate.degradation_multiplier || 1.15;
    const originalLifespan = baseLifespan / (climateDegradation - 1 + 1.1);
    const REFERENCE_DEG_RATE = 0.45; // mono_perc rate — the most common technology
    const techQualityRatio = REFERENCE_DEG_RATE / Math.max(0.10, tech.deg_rate_pct_yr);
    const rawLifespan = originalLifespan * techQualityRatio;
    clampedLifespan = Math.min(15, Math.max(4, rawLifespan));
  } else {
    // Original climate-factor-based calculation
    const baseLifespan = 9.5;
    const climateDegradation = climate.degradation_multiplier || 1.15;
    const adjustedLifespan = baseLifespan / (climateDegradation - 1 + 1.1);
    clampedLifespan = Math.min(12, Math.max(5, adjustedLifespan));
  }

  const installDate = new Date(installationDate);
  const decommissionDate = new Date(installDate);
  decommissionDate.setFullYear(decommissionDate.getFullYear() + Math.round(clampedLifespan));

  // Days until decommission
  const today = new Date();
  const daysUntil = Math.ceil((decommissionDate - today) / (1000 * 60 * 60 * 24));

  let urgency = 'normal';
  if (daysUntil < 0) urgency = 'overdue';
  else if (daysUntil < 180) urgency = 'critical';
  else if (daysUntil < 365) urgency = 'soon';

  const techNote = tech
    ? ` (${tech.label}: ${tech.deg_rate_pct_yr}%/yr degradation rate)`
    : '';

  return {
    adjusted_failure_date: decommissionDate.toISOString().split('T')[0],
    climate_zone: climate.climate_zone,
    degradation_factor: parseFloat(clampedLifespan.toFixed(2)),
    years_expected: parseFloat(clampedLifespan.toFixed(1)),
    days_until_decommission: daysUntil,
    urgency,
    panel_technology: panelTechnology || null,
    panel_technology_label: tech ? tech.label : null,
    explanation: `In ${state} (${climate.climate_zone.replace(/_/g, ' ')}), ${tech ? tech.label + ' panels' : 'panels'} are estimated to last ~${clampedLifespan.toFixed(1)} years due to ${getClimateExplanation(climate.climate_zone)}${techNote}.`,
  };
}

function getClimateExplanation(zone) {
  const explanations = {
    coastal_humid: 'high coastal humidity accelerating corrosion and PID (Potential Induced Degradation)',
    sahel_dry: 'extreme heat cycles causing thermal stress and sand abrasion',
    se_humid: 'high humidity and frequent rain causing moisture ingress',
    mixed: 'moderate heat and humidity with irregular power surge damage',
  };
  return explanations[zone] || 'West African climate conditions';
}

/**
 * Bulk calculate for multiple projects (used for leaderboard refresh)
 */
async function bulkUpdateProjectDecommissionDates() {
  const { data: projects } = await supabase
    .from('projects')
    .select(`
      id, state, installation_date,
      equipment(id, equipment_type, brand)
    `)
    .eq('status', 'active');

  if (!projects) return { updated: 0 };

  let updated = 0;
  for (const project of projects) {
    const calc = await calculateDecommissionDate(project.state, project.installation_date);

    // Update project
    await supabase
      .from('projects')
      .update({ estimated_decommission_date: calc.adjusted_failure_date })
      .eq('id', project.id);

    // Update panel equipment
    for (const eq of project.equipment || []) {
      if (eq.equipment_type === 'panel') {
        await supabase
          .from('equipment')
          .update({
            adjusted_failure_date: calc.adjusted_failure_date,
            climate_zone: calc.climate_zone,
            degradation_factor: calc.degradation_factor,
          })
          .eq('id', eq.id);
      }
    }
    updated++;
  }
  return { updated };
}

module.exports = {
  calculateDecommissionDate,
  bulkUpdateProjectDecommissionDates,
  getStateClimate,
};
