/**
 * SolNuv AI Design Feedback Service
 * Generates expert solar engineering analysis of simulation results.
 * Feedback is stored as structured JSONB and can be edited by the user.
 */

'use strict';

const supabase = require('../config/database');
const logger = require('../utils/logger');
const { complete } = require('./aiProviderService');

const TOPOLOGY_LABELS = {
  grid_tied: 'Grid-Tied (PV Only)',
  grid_tied_bess: 'Grid-Tied + Battery',
  off_grid: 'Off-Grid',
  hybrid: 'Hybrid (Grid + Islanding)',
};

/**
 * Build the system prompt for expert feedback generation.
 */
function buildSystemPrompt() {
  return `You are a senior solar energy engineer with 20+ years of experience designing PV and battery storage systems across Africa. You provide clear, actionable feedback on solar system designs.

Your analysis should be structured as JSON with these exact keys:
{
  "overall_rating": "excellent" | "good" | "fair" | "needs_improvement",
  "summary": "2-3 sentence executive summary of the design quality",
  "strengths": ["list of 2-4 design strengths"],
  "concerns": ["list of 1-4 design concerns or risks"],
  "recommendations": ["list of 2-5 specific actionable recommendations"],
  "sizing_assessment": {
    "pv_sizing": "undersized" | "appropriate" | "oversized",
    "pv_comment": "brief sizing commentary",
    "battery_sizing": "undersized" | "appropriate" | "oversized" | "not_applicable",
    "battery_comment": "brief sizing commentary"
  },
  "financial_assessment": "2-3 sentence financial outlook"
}

Focus on practical African context: grid reliability, dust/soiling, temperature derating, component availability, and local conditions. Be specific with numbers. Do not use markdown formatting in string values.`;
}

/**
 * Build the user prompt from simulation results and design config.
 */
function buildUserPrompt(design, results) {
  const topology = TOPOLOGY_LABELS[results.grid_topology || design.grid_topology] || 'Unknown';

  const parts = [
    `Analyse this ${topology} solar system design and simulation results:`,
    '',
    '--- DESIGN CONFIGURATION ---',
    `System Type: ${topology}`,
    `Location: ${design.location_lat}°, ${design.location_lon}°`,
    `PV Capacity: ${design.pv_capacity_kwp} kWp (${design.pv_technology || 'mono_perc'})`,
    `Tilt: ${design.pv_tilt_deg}° | Azimuth: ${design.pv_azimuth_deg}°`,
    `System Losses: ${design.pv_system_losses_pct}%`,
  ];

  if (design.bess_capacity_kwh > 0) {
    parts.push(
      `Battery: ${design.bess_capacity_kwh} kWh (${design.bess_chemistry})`,
      `DOD: ${design.bess_dod_pct}% | Strategy: ${design.bess_dispatch_strategy}`,
    );
  }

  if (design.grid_topology === 'off_grid') {
    parts.push(`Autonomy Target: ${design.autonomy_days || 2} days`);
    if (design.backup_generator_kw) parts.push(`Backup Generator: ${design.backup_generator_kw} kW`);
  }

  if (design.grid_topology === 'hybrid') {
    parts.push(`Grid Outage: ${design.grid_outage_hours_day || 0} hrs/day`);
  }

  parts.push(
    '',
    '--- SIMULATION RESULTS (Year 1) ---',
    `Annual PV Generation: ${results.annual_solar_gen_kwh} kWh`,
    `Solar Utilised: ${results.solar_utilised_kwh} kWh`,
    `Self-Consumption: ${results.self_consumption_pct}%`,
    `Utilisation: ${results.utilisation_pct}%`,
    `Performance Ratio: ${results.performance_ratio} kWh/kWp`,
    `Grid Import: ${results.grid_import_kwh} kWh`,
    `Grid Export: ${results.grid_export_kwh} kWh`,
    `Peak Demand Before: ${results.peak_demand_before_kw} kW`,
    `Peak Demand After: ${results.peak_demand_after_kw} kW`,
  );

  if (results.battery_discharged_kwh > 0) {
    parts.push(
      `Battery Discharged: ${results.battery_discharged_kwh} kWh`,
      `Battery Cycles/Year: ${results.battery_cycles_annual}`,
    );
  }

  if (results.unmet_load_kwh > 0) {
    parts.push(
      `Unmet Load: ${results.unmet_load_kwh} kWh (${results.unmet_load_hours} hours)`,
      `Loss of Load: ${results.loss_of_load_pct}%`,
    );
  }

  if (results.autonomy_achieved_days > 0) {
    parts.push(`Autonomy Achieved: ${results.autonomy_achieved_days} days`);
  }

  if (results.islanded_hours > 0) {
    parts.push(`Islanded Hours: ${results.islanded_hours}`);
  }

  parts.push(
    '',
    '--- FINANCIAL ---',
    `CAPEX: ${design.capex_total}`,
    `Year 1 Savings: ${results.year1_savings}`,
    `LCOE: ${results.lcoe_normal}`,
    `NPV (25yr): ${results.npv_25yr}`,
    `IRR: ${results.irr_pct}%`,
    `Payback: ${results.simple_payback_months} months`,
  );

  parts.push('', 'Respond with ONLY valid JSON matching the schema described.');

  return parts.join('\n');
}

/**
 * Generate AI expert feedback for a simulation result.
 * @param {string} simulationResultId
 * @returns {object} Parsed feedback JSON
 */
async function generateFeedback(simulationResultId) {
  // Load simulation result
  const { data: result, error: rErr } = await supabase
    .from('simulation_results')
    .select('*')
    .eq('id', simulationResultId)
    .single();

  if (rErr || !result) throw new Error('Simulation result not found');

  // Load design config
  const { data: design, error: dErr } = await supabase
    .from('project_designs')
    .select('*')
    .eq('id', result.project_design_id)
    .single();

  if (dErr || !design) throw new Error('Design configuration not found');

  const messages = [
    { role: 'system', content: buildSystemPrompt() },
    { role: 'user', content: buildUserPrompt(design, result) },
  ];

  const aiResult = await complete({
    messages,
    tier: 'customer',
    temperature: 0.4,
    maxTokens: 2000,
    responseFormat: 'json',
  });

  let feedback;
  try {
    feedback = JSON.parse(aiResult.content);
  } catch {
    logger.error('AI feedback JSON parse failed', { content: aiResult.content?.substring(0, 200) });
    throw new Error('AI returned invalid feedback format');
  }

  // Store feedback on the simulation result
  const { error: updateErr } = await supabase
    .from('simulation_results')
    .update({
      ai_expert_feedback: feedback,
      ai_feedback_generated_at: new Date().toISOString(),
    })
    .eq('id', simulationResultId);

  if (updateErr) {
    logger.error('Failed to store AI feedback', { message: updateErr.message });
  }

  return feedback;
}

/**
 * Save user-edited feedback text.
 * @param {string} simulationResultId
 * @param {string} editedText
 */
async function saveEditedFeedback(simulationResultId, editedText) {
  const { error } = await supabase
    .from('simulation_results')
    .update({ ai_feedback_edited: editedText })
    .eq('id', simulationResultId);

  if (error) throw error;
}

module.exports = {
  generateFeedback,
  saveEditedFeedback,
};
