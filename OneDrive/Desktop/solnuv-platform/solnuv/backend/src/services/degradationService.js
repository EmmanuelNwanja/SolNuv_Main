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
 * @param {string} panelBrand - Brand name for condition factor
 * @returns {object} - { date, climateZone, factor, yearsExpected, explanation }
 */
async function calculateDecommissionDate(state, installationDate, panelBrand = 'Other') {
  const climate = await getStateClimate(state);

  // Base lifespan: 9.5 years average for West Africa
  const baseLifespan = 9.5;

  // Degradation multiplier from climate zone (higher = more degradation = shorter life)
  const climateDegradation = climate.degradation_multiplier || 1.15;

  // Adjusted lifespan: base / climate factor
  // If degradation_multiplier is 1.35 (Lagos), life is 9.5/1.35 = ~7 years
  // If degradation_multiplier is 1.08 (mild zone), life is 9.5/1.08 = ~8.8 years
  const adjustedLifespan = baseLifespan / (climateDegradation - 1 + 1.1);

  // Clamp between 5 and 12 years
  const clampedLifespan = Math.min(12, Math.max(5, adjustedLifespan));

  const installDate = new Date(installationDate);
  const decommissionDate = new Date(installDate);
  decommissionDate.setFullYear(decommissionDate.getFullYear() + Math.round(clampedLifespan));

  // Days until decommission
  const today = new Date();
  const daysUntil = Math.ceil((decommissionDate - today) / (1000 * 60 * 60 * 24));

  let urgency = 'normal';
  if (daysUntil < 0) urgency = 'overdue';
  else if (daysUntil < 180) urgency = 'critical'; // < 6 months
  else if (daysUntil < 365) urgency = 'soon'; // < 1 year

  return {
    adjusted_failure_date: decommissionDate.toISOString().split('T')[0],
    climate_zone: climate.climate_zone,
    degradation_factor: parseFloat(clampedLifespan.toFixed(2)),
    years_expected: parseFloat(clampedLifespan.toFixed(1)),
    days_until_decommission: daysUntil,
    urgency,
    explanation: `In ${state} (${climate.climate_zone.replace(/_/g, ' ')}), panels are estimated to last ~${clampedLifespan.toFixed(1)} years due to ${getClimateExplanation(climate.climate_zone)}.`,
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
