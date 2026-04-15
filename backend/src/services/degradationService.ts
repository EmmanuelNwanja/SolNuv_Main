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
 * Classify a climate stressor factor into a severity level.
 * Factor is a multiplier where 1.0 = baseline; higher = more stressful.
 */
function classifyFactor(factor) {
  if (factor >= 1.35) return 'severe';
  if (factor >= 1.20) return 'high';
  if (factor >= 1.10) return 'moderate';
  return 'low';
}

/**
 * Generate actionable maintenance recommendations specific to a state's climate profile.
 */
function buildMaintenanceRecommendations(climateZone, stressors, primaryStressor, state) {
  const recs = [];

  // Universal Nigeria recommendation — grid transients damage equipment across all zones
  recs.push('Install Type 2 surge protection devices (SPD) on both DC and AC sides — grid voltage transients are the leading cause of MPPT and inverter failure in Nigeria.');

  // Zone-specific soiling / harmattan guidance
  if (climateZone === 'sahel_dry') {
    recs.push('Clean panels every 2 weeks during harmattan season (Nov–Feb). Anti-soiling coated glass recovers 5–8% annual output vs. standard glass.');
    recs.push('Inspect panel glass annually for sand-blast micro-abrasion — scratched glass scatters incoming light and accelerates EVA delamination under UV.');
  } else if (climateZone === 'mixed') {
    recs.push('Clean panels monthly year-round; increase to bi-weekly during harmattan (Nov–Jan) when dust plumes reach southern savanna states.');
  } else if (climateZone === 'coastal_humid') {
    recs.push('Inspect junction boxes and MC4 glands every 6 months for salt-corrosion. Use marine-grade stainless-steel mounting hardware throughout.');
    recs.push('Rain self-cleans panels frequently, but bird droppings and industrial particulate create hotspots — inspect monthly and spot-clean as needed.');
  } else if (climateZone === 'se_humid') {
    recs.push('Inspect mounting rails and fasteners annually for rust — persistent humidity accelerates galvanic corrosion at aluminium-steel interfaces.');
    recs.push('Clean panels monthly; confirm drainage channels beneath modules are clear to prevent moisture pooling under the frame.');
  }

  // Heat stressor recommendations
  if (stressors.heat.severity === 'high' || stressors.heat.severity === 'severe') {
    recs.push('Ensure ≥150 mm rear-ventilation clearance behind each panel — elevated racking reduces steady-state cell temperature by 3–5 °C and measurably extends panel life.');
    recs.push('Mount inverter in shade or a ventilated metal enclosure on an east-facing wall to limit afternoon ambient temperature around the unit.');
  }

  // Humidity stressor recommendations
  if (stressors.humidity.severity === 'high' || stressors.humidity.severity === 'severe') {
    recs.push('Apply conformal coating to inverter PCBs or specify an IP65/NEMA-4X rated inverter enclosure to resist humid air and condensation ingress.');
    recs.push('Torque-check all MC4 connector pairs annually — humidity cycling loosens plugs, leading to resistance heating and potential arcing faults.');
  }

  // Elevated surge risk
  if (stressors.surge.severity === 'high' || stressors.surge.severity === 'severe') {
    recs.push(`Grid instability in ${state} is rated "${stressors.surge.severity}". Consider an Automatic Voltage Stabiliser (AVS) or online double-conversion UPS on the AC output to protect loads from both sags and spikes.`);
    recs.push('Log generator start/stop events — abrupt generator shutdowns produce transient over-voltages that can damage MPPT inputs more severely than NEPA grid events.');
  }

  return recs;
}

/**
 * Analyse climate stressors from DB-sourced state data and return structured breakdown.
 */
function analyseStressors(climate, state) {
  const {
    humidity_factor = 1.10,
    heat_factor     = 1.15,
    surge_factor    = 1.18,
    climate_zone    = 'mixed',
  } = climate;

  const stressors = {
    humidity: {
      factor:      parseFloat(Number(humidity_factor).toFixed(3)),
      severity:    classifyFactor(humidity_factor),
      description: 'Coastal salt-mist and persistent moisture — drives PID, encapsulant yellowing, and junction-box corrosion.',
    },
    heat: {
      factor:      parseFloat(Number(heat_factor).toFixed(3)),
      severity:    classifyFactor(heat_factor),
      description: 'Extreme heat cycling (35–45 °C ambient → 65–75 °C cell) — causes thermal stress, solder fatigue, and glass micro-cracking.',
    },
    surge: {
      factor:      parseFloat(Number(surge_factor).toFixed(3)),
      severity:    classifyFactor(surge_factor),
      description: 'Grid instability and transient over-voltage events — damages bypass diodes, MPPT inputs, and inverter capacitors.',
    },
  };

  // Primary stressor = factor with greatest deviation above 1.0 (most impact on panel life)
  const primary = ['humidity', 'heat', 'surge']
    .map(k => ({ key: k, dev: (climate[`${k}_factor`] || 1.0) - 1.0 }))
    .sort((a, b) => b.dev - a.dev)[0].key;

  const recommendations = buildMaintenanceRecommendations(climate_zone, stressors, primary, state);

  return {
    stressors,
    primary_stressor:            primary,
    surge_risk_level:            stressors.surge.severity,
    maintenance_recommendations: recommendations,
  };
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
  const daysUntil = Math.ceil((+decommissionDate - +today) / (1000 * 60 * 60 * 24));

  let urgency = 'normal';
  if (daysUntil < 0) urgency = 'overdue';
  else if (daysUntil < 180) urgency = 'critical';
  else if (daysUntil < 365) urgency = 'soon';

  const techNote = tech
    ? ` (${tech.label}: ${tech.deg_rate_pct_yr}%/yr degradation rate)`
    : '';

  const stressorAnalysis = analyseStressors(climate, state);

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
    climate_stressors:           stressorAnalysis.stressors,
    primary_stressor:            stressorAnalysis.primary_stressor,
    surge_risk_level:            stressorAnalysis.surge_risk_level,
    maintenance_recommendations: stressorAnalysis.maintenance_recommendations,
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
