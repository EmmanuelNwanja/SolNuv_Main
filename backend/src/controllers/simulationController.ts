/**
 * SolNuv Simulation Controller
 * API endpoints for project simulation and auto-sizing.
 */

const supabase = require('../config/database');
const { sendSuccess, sendError } = require('../utils/responseHelper');
const { runSimulation, runSimulationPreview } = require('../services/simulationService');
const { generateFeedback, saveEditedFeedback } = require('../services/aiDesignFeedbackService');
const { getHourlySolarResource, estimateOptimalTilt, estimateOptimalAzimuth } = require('../services/solarResourceService');
const logger = require('../utils/logger');

/**
 * Verify that the authenticated user owns the project.
 * Supports orphaned projects (created before user joined a company).
 */
async function verifyProjectOwnership(projectId, user) {
  const userId = user.id;
  const companyId = user.company_id;

  let query = supabase
    .from('projects')
    .select('id, company_id, user_id')
    .eq('id', projectId);

  if (companyId) {
    // User has a company - can access projects belonging to:
    // 1. Their company, OR
    // 2. Projects they personally created (company_id is null but user_id matches)
    query = query.or(`company_id.eq.${companyId},and(user_id.eq.${userId},company_id.is.null)`);
  } else {
    // User has no company - can only access their own projects
    query = query.eq('user_id', userId);
  }

  const { data } = await query.single();
  return data;
}

/**
 * POST /api/simulation/run
 * Upsert the project design from wizard payload, then run full simulation.
 */
exports.runProjectSimulation = async (req, res) => {
  try {
    const {
      project_id,
      tariff_id,
      location_lat,
      location_lon,
      pv_capacity_kwp,
      panel_technology,
      tilt_angle,
      azimuth_angle,
      pv_generation_source,
      system_losses_pct,
      annual_degradation_pct,
      bess_capacity_kwh,
      bess_power_kw,
      battery_chemistry,
      bess_dispatch_strategy,
      bess_min_soc,
      bess_round_trip_efficiency,
      total_cost,
      financing_type,
      discount_rate_pct,
      tariff_escalation_pct,
      om_cost_annual,
      loan_interest_rate_pct,
      loan_term_years,
      // Grid topology fields
      grid_topology,
      installation_type,
      autonomy_days,
      backup_generator_kw,
      diesel_cost_per_litre,
      petrol_price_per_litre,
      fuel_escalation_pct,
      grid_availability_pct,
      grid_outage_hours_day,
      feed_in_tariff_per_kwh,
      project_horizon_years,
      user_pv_module_make,
      user_pv_module_model,
      user_pv_module_power_w,
      user_pv_module_vmp,
      user_pv_module_imp,
      user_battery_make,
      user_battery_model,
      user_battery_capacity_kwh,
      user_battery_voltage,
      user_battery_max_discharge_kw,
      user_pcs_make,
      user_pcs_model,
      user_pcs_power_kw,
      user_inverter_make,
      user_inverter_model,
      user_inverter_power_kw,
      user_inverter_voltage,
    } = req.body;

    if (!project_id) return sendError(res, 'project_id is required', 400);
    if (!pv_capacity_kwp) return sendError(res, 'PV capacity is required', 400);

    const project = await verifyProjectOwnership(project_id, req.user);
    if (!project) return sendError(res, 'Project not found or access denied', 404);

    // Map panel_technology to DB enum value
    const techMap = {
      'Monocrystalline PERC': 'mono_perc',
      'Polycrystalline': 'poly',
      'Thin-Film CdTe': 'cdte',
      'Thin-Film CIGS': 'cigs',
      'TOPCon': 'topcon',
      'HJT': 'hjt',
      'Bifacial Mono PERC': 'bifacial_perc',
      'Bifacial TOPCon': 'topcon_bi',
      'Bifacial HJT': 'hjt_bi',
      'Amorphous Silicon': 'a_si',
      'Organic PV': 'organic',
    };

    // Map battery_chemistry to DB value
    const chemMap = {
      'LFP': 'lfp',
      'NMC': 'nmc',
      'NCA': 'nca',
      'LTO': 'lto',
      'NiCd': 'nicd',
      'Lead-Acid (Flooded)': 'lead_acid_flooded',
      'Lead-Acid (AGM)': 'lead_acid_agm',
      'Lead-Acid (Gel)': 'lead_acid_gel',
      'Sodium-Ion': 'sodium_ion',
      'Flow (Vanadium)': 'flow_vrfb',
    };

    const bessRoundTripInput = parseFloat(bess_round_trip_efficiency);
    const bessRoundTripPct = Number.isFinite(bessRoundTripInput)
      ? (bessRoundTripInput <= 1 ? bessRoundTripInput * 100 : bessRoundTripInput)
      : 92;

    const designRow = {
      project_id,
      tariff_structure_id: tariff_id || null,
      location_lat: parseFloat(location_lat) || null,
      location_lon: parseFloat(location_lon) || null,
      pv_capacity_kwp: parseFloat(pv_capacity_kwp) || null,
      pv_technology: techMap[panel_technology] || 'mono_perc',
      pv_tilt_deg: parseFloat(tilt_angle) || 0,
      pv_azimuth_deg: parseFloat(azimuth_angle) || 0,
      pv_generation_source: pv_generation_source === 'modelled' ? 'calculated' : pv_generation_source || 'calculated',
      pv_system_losses_pct: parseFloat(system_losses_pct) || 14,
      pv_degradation_annual_pct: parseFloat(annual_degradation_pct) || 0.5,
      pv_brand: user_pv_module_make || null,
      pv_model: user_pv_module_model || null,
      pv_rated_power_kw: user_pv_module_power_w ? parseFloat(user_pv_module_power_w) / 1000 : null,
      pv_type: panel_technology || null,
      pv_voltage: user_pv_module_vmp ? parseFloat(user_pv_module_vmp) : null,
      pv_current: user_pv_module_imp ? parseFloat(user_pv_module_imp) : null,
      bess_capacity_kwh: grid_topology === 'grid_tied' ? 0 : (parseFloat(bess_capacity_kwh) || 0),
      bess_power_kw: grid_topology === 'grid_tied' ? 0 : (parseFloat(bess_power_kw) || null),
      bess_chemistry: chemMap[battery_chemistry] || 'lfp',
      bess_dod_pct: bess_min_soc != null ? (100 - parseFloat(bess_min_soc) * 100) : 80,
      bess_round_trip_eff_pct: bessRoundTripPct,
      bess_dispatch_strategy: bess_dispatch_strategy || 'self_consumption',
      battery_brand: user_battery_make || null,
      battery_model: user_battery_model || null,
      battery_chemistry: battery_chemistry ? String(battery_chemistry).toLowerCase() : null,
      battery_capacity_kwh: user_battery_capacity_kwh ? parseFloat(user_battery_capacity_kwh) : null,
      battery_power_kw: user_battery_max_discharge_kw ? parseFloat(user_battery_max_discharge_kw) : null,
      battery_voltage: user_battery_voltage ? parseFloat(user_battery_voltage) : null,
      battery_crate:
        user_battery_capacity_kwh && user_battery_max_discharge_kw
          ? parseFloat(user_battery_max_discharge_kw) / Math.max(parseFloat(user_battery_capacity_kwh), 0.0001)
          : null,
      battery_is_complete_package: !!(user_battery_make || user_battery_model || user_pcs_make || user_pcs_model),
      pcs_power_kw: user_pcs_power_kw ? parseFloat(user_pcs_power_kw) : null,
      pcs_type: user_pcs_model || user_pcs_make || null,
      inverter_brand: user_inverter_make || null,
      inverter_model: user_inverter_model || null,
      inverter_rated_power_kw: user_inverter_power_kw ? parseFloat(user_inverter_power_kw) : null,
      inverter_max_voltage: user_inverter_voltage ? parseFloat(user_inverter_voltage) : null,
      capex_total: parseFloat(total_cost) || 0,
      om_annual: parseFloat(om_cost_annual) || 0,
      discount_rate_pct: parseFloat(discount_rate_pct) || 10,
      tariff_escalation_pct: parseFloat(tariff_escalation_pct) || 8,
      financing_type: financing_type || 'cash',
      loan_interest_rate_pct: parseFloat(loan_interest_rate_pct) || 0,
      loan_term_years: parseInt(loan_term_years) || 0,
      analysis_period_years: parseInt(project_horizon_years) || 25,
      // Grid topology
      grid_topology: grid_topology || 'grid_tied_bess',
      installation_type: installation_type || 'rooftop_tilted',
      autonomy_days: parseFloat(autonomy_days) || 2.0,
      backup_generator_kw: parseFloat(backup_generator_kw) || null,
      diesel_cost_per_litre: parseFloat(diesel_cost_per_litre) || null,
      diesel_price_per_litre: parseFloat(diesel_cost_per_litre) || 1100,
      petrol_price_per_litre: parseFloat(petrol_price_per_litre) || 700,
      fuel_escalation_pct: parseFloat(fuel_escalation_pct) || 10,
      grid_availability_pct: parseFloat(grid_availability_pct) || 100,
      grid_outage_hours_day: parseFloat(grid_outage_hours_day) || null,
      feed_in_tariff_per_kwh: parseFloat(feed_in_tariff_per_kwh) || null,
    };

    // Upsert: insert or update the design for this project (unique: project_id)
    const { data: design, error: upsertErr } = await supabase
      .from('project_designs')
      .upsert(designRow, { onConflict: 'project_id' })
      .select('id')
      .single();

    if (upsertErr) {
      logger.error('Design upsert failed', { message: upsertErr.message });
      return sendError(res, 'Failed to save design configuration');
    }

    // Verify load profile exists for this project before running simulation
    const { data: loadProfile } = await supabase
      .from('load_profiles')
      .select('id')
      .eq('project_id', project_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!loadProfile) {
      return sendError(res, 'No load profile saved. Go to the Load Profile step and confirm your synthetic profile or upload data before simulating.', 400);
    }

    // Ensure design references the latest load profile
    if (loadProfile.id) {
      await supabase
        .from('project_designs')
        .update({ load_profile_id: loadProfile.id })
        .eq('id', design.id);
    }

    // Auto-set peak_shave_threshold_kw for peak_shave dispatch strategy
    // Use 80% of load profile peak as default if no explicit threshold was provided
    if (designRow.bess_dispatch_strategy === 'peak_shave' && !req.body.peak_shave_threshold_kw) {
      const { data: lpStats } = await supabase
        .from('load_profiles')
        .select('peak_demand_kw')
        .eq('id', loadProfile.id)
        .single();

      const peakKw = Number(lpStats?.peak_demand_kw) || 0;
      if (peakKw > 0) {
        const threshold = Math.round(peakKw * 0.8 * 100) / 100;
        await supabase
          .from('project_designs')
          .update({ peak_shave_threshold_kw: threshold })
          .eq('id', design.id);
      }
    } else if (req.body.peak_shave_threshold_kw) {
      // Explicit threshold provided by user
      await supabase
        .from('project_designs')
        .update({ peak_shave_threshold_kw: parseFloat(req.body.peak_shave_threshold_kw) })
        .eq('id', design.id);
    }

    const results = await runSimulation(design.id);

    // Update project design_completed_at timestamp
    await supabase
      .from('projects')
      .update({ design_completed_at: new Date().toISOString() })
      .eq('id', project_id);

    // Strip hourly data from response (too large for JSON)
    const { hourly_flows, ...summary } = results;

    return sendSuccess(res, summary, 'Simulation completed');
  } catch (err) {
    logger.error('runProjectSimulation error', { message: err.message, stack: err.stack });
    return sendError(res, 'Simulation failed: ' + err.message);
  }
};

/**
 * GET /api/simulation/:projectId/design-config
 * Return saved design payload for wizard prefill.
 */
exports.getDesignConfig = async (req, res) => {
  try {
    const { projectId } = req.params;
    const project = await verifyProjectOwnership(projectId, req.user);
    if (!project) return sendError(res, 'Project not found or access denied', 404);

    const { data: design, error } = await supabase
      .from('project_designs')
      .select('*')
      .eq('project_id', projectId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return sendSuccess(res, design || null, 'Design config retrieved');
  } catch (err) {
    logger.error('getDesignConfig error', { message: err.message });
    return sendError(res, 'Failed to retrieve design config');
  }
};

/**
 * GET /api/simulation/:projectId/design-versions
 * List simulation runs with restorable design snapshots.
 */
exports.getDesignVersions = async (req, res) => {
  try {
    const { projectId } = req.params;
    const project = await verifyProjectOwnership(projectId, req.user);
    if (!project) return sendError(res, 'Project not found or access denied', 404);

    const { data: design } = await supabase
      .from('project_designs')
      .select('id')
      .eq('project_id', projectId)
      .maybeSingle();
    if (!design) return sendSuccess(res, [], 'No design versions yet');

    const { data, error } = await supabase
      .from('simulation_results')
      .select('id, run_at, annual_solar_gen_kwh, year1_savings, simple_payback_months, design_snapshot')
      .eq('project_design_id', design.id)
      .order('run_at', { ascending: false })
      .limit(25);
    if (error) throw error;

    return sendSuccess(res, data || [], 'Design versions retrieved');
  } catch (err) {
    logger.error('getDesignVersions error', { message: err.message });
    return sendError(res, 'Failed to retrieve design versions');
  }
};

/**
 * POST /api/simulation/:projectId/design-versions/:resultId/restore
 * Restore project_designs config from a specific simulation result snapshot.
 */
exports.restoreDesignVersion = async (req, res) => {
  try {
    const { projectId, resultId } = req.params;
    const project = await verifyProjectOwnership(projectId, req.user);
    if (!project) return sendError(res, 'Project not found or access denied', 404);

    const { data: design } = await supabase
      .from('project_designs')
      .select('id')
      .eq('project_id', projectId)
      .maybeSingle();
    if (!design) return sendError(res, 'No project design found', 404);

    const { data: result, error: resultErr } = await supabase
      .from('simulation_results')
      .select('id, project_design_id, design_snapshot')
      .eq('id', resultId)
      .eq('project_design_id', design.id)
      .maybeSingle();
    if (resultErr) throw resultErr;
    if (!result) return sendError(res, 'Design version not found', 404);
    if (!result.design_snapshot || typeof result.design_snapshot !== 'object') {
      return sendError(res, 'Selected version has no restorable snapshot', 422);
    }

    const s = result.design_snapshot || {};
    const updatePayload = {
      tariff_structure_id: s.tariff_structure_id || null,
      load_profile_id: s.load_profile_id || null,
      location_lat: s.location_lat || null,
      location_lon: s.location_lon || null,
      pv_capacity_kwp: s.pv_capacity_kwp || null,
      pv_technology: s.pv_technology || 'mono_perc',
      pv_tilt_deg: s.pv_tilt_deg || 0,
      pv_azimuth_deg: s.pv_azimuth_deg || 0,
      pv_generation_source: s.pv_generation_source || 'calculated',
      pv_system_losses_pct: s.pv_system_losses_pct || 14,
      pv_degradation_annual_pct: s.pv_degradation_annual_pct || 0.5,
      bess_capacity_kwh: s.bess_capacity_kwh || 0,
      bess_chemistry: s.bess_chemistry || 'lfp',
      bess_dispatch_strategy: s.bess_dispatch_strategy || 'self_consumption',
      peak_shave_threshold_kw: s.peak_shave_threshold_kw || null,
      bess_dod_pct: s.bess_dod_pct || 80,
      bess_round_trip_eff_pct: s.bess_round_trip_eff_pct || 92,
      capex_total: s.capex_total || 0,
      om_annual: s.om_annual || 0,
      discount_rate_pct: s.discount_rate_pct || 10,
      tariff_escalation_pct: s.tariff_escalation_pct || 8,
      financing_type: s.financing_type || 'cash',
      loan_interest_rate_pct: s.loan_interest_rate_pct || 0,
      loan_term_years: s.loan_term_years || 0,
      analysis_period_years: s.analysis_period_years || 25,
      grid_topology: s.grid_topology || 'grid_tied_bess',
      installation_type: s.installation_type || 'rooftop_tilted',
      autonomy_days: s.autonomy_days || 2,
      backup_generator_kw: s.backup_generator_kw || null,
      diesel_cost_per_litre: s.diesel_cost_per_litre || null,
      grid_availability_pct: s.grid_availability_pct || 100,
      grid_outage_hours_day: s.grid_outage_hours_day || null,
      feed_in_tariff_per_kwh: s.feed_in_tariff_per_kwh || null,
    };

    const { data: restored, error: updateErr } = await supabase
      .from('project_designs')
      .update(updatePayload)
      .eq('id', design.id)
      .select('*')
      .single();
    if (updateErr) throw updateErr;

    return sendSuccess(res, restored, 'Design version restored');
  } catch (err) {
    logger.error('restoreDesignVersion error', { message: err.message });
    return sendError(res, 'Failed to restore design version');
  }
};

/**
 * POST /api/simulation/preview
 *
 * Lightweight preview simulation — no DB writes, no hourly persistence.
 * Returns headline metrics (annual kWh, savings, NPV, IRR, LCOE, loss waterfall,
 * and risk bands) for live feedback in the design wizard.
 */
exports.runSimulationPreview = async (req, res) => {
  try {
    const cfg = req.body || {};
    if (!cfg.pv_capacity_kwp && !cfg.annual_load_kwh) {
      return sendError(res, 'pv_capacity_kwp or annual_load_kwh is required', 400);
    }
    const out = await runSimulationPreview(cfg);
    return sendSuccess(res, out, 'Preview simulation complete');
  } catch (err) {
    logger.error('runSimulationPreview error', { message: err.message });
    return sendError(res, 'Failed to run preview simulation');
  }
};

/**
 * GET /api/simulation/:projectId/results
 * Get latest simulation results for a project.
 */
exports.getSimulationResults = async (req, res) => {
  try {
    const { projectId } = req.params;

    const project = await verifyProjectOwnership(projectId, req.user);
    if (!project) return sendError(res, 'Project not found or access denied', 404);

    // Get design
    const { data: design } = await supabase
      .from('project_designs')
      .select('id')
      .eq('project_id', projectId)
      .single();

    if (!design) return sendError(res, 'No design found', 404);

    // Get latest results
    const { data: results, error } = await supabase
      .from('simulation_results')
      .select('*')
      .eq('project_design_id', design.id)
      .order('run_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !results) return sendError(res, 'No simulation results found. Run simulation first.', 404);

    return sendSuccess(res, results, 'Simulation results retrieved');
  } catch (err) {
    logger.error('getSimulationResults error', { message: err.message });
    return sendError(res, 'Failed to retrieve simulation results');
  }
};

/**
 * GET /api/simulation/:projectId/results/hourly
 * Get hourly flows data (streamed for large payloads).
 */
exports.getHourlyFlows = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { month } = req.query; // Optional: filter by month (1-12)

    const project = await verifyProjectOwnership(projectId, req.user);
    if (!project) return sendError(res, 'Project not found', 404);

    const { data: design } = await supabase
      .from('project_designs')
      .select('id')
      .eq('project_id', projectId)
      .single();

    if (!design) return sendError(res, 'No design found', 404);

    const { data: results } = await supabase
      .from('simulation_results')
      .select('hourly_flows')
      .eq('project_design_id', design.id)
      .order('run_at', { ascending: false })
      .limit(1)
      .single();

    if (!results?.hourly_flows) return sendError(res, 'No hourly data available', 404);

    let flows = results.hourly_flows;

    // Filter by month if specified
    if (month) {
      const m = parseInt(month);
      if (m >= 1 && m <= 12) {
        const DAYS_PER_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
        let startIdx = 0;
        for (let i = 0; i < m - 1; i++) startIdx += DAYS_PER_MONTH[i] * 24;
        const endIdx = startIdx + DAYS_PER_MONTH[m - 1] * 24;
        flows = flows.slice(startIdx, endIdx);
      }
    }

    return sendSuccess(res, flows, 'Hourly flows retrieved');
  } catch (err) {
    logger.error('getHourlyFlows error', { message: err.message });
    return sendError(res, 'Failed to retrieve hourly data');
  }
};

/**
 * GET /api/simulation/solar-resource
 * Preview solar resource data for a location.
 */
exports.getSolarResource = async (req, res) => {
  try {
    const { lat, lon } = req.query;
    if (!lat || !lon) return sendError(res, 'lat and lon query parameters are required', 400);

    const latNum = parseFloat(lat);
    const lonNum = parseFloat(lon);
    if (isNaN(latNum) || isNaN(lonNum)) return sendError(res, 'Invalid coordinates', 400);
    if (latNum < -60 || latNum > 60 || lonNum < -180 || lonNum > 180) {
      return sendError(res, 'Coordinates out of range', 400);
    }

    const resource = await getHourlySolarResource(latNum, lonNum);

    // Return summary instead of full 8760 arrays
    const monthlyGhi = [];
    const monthlyTemp = [];
    const DAYS_PER_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    let idx = 0;
    for (let m = 0; m < 12; m++) {
      const hours = DAYS_PER_MONTH[m] * 24;
      let ghiSum = 0, tempSum = 0;
      for (let h = 0; h < hours; h++, idx++) {
        ghiSum += resource.hourlyGhi[idx] || 0;
        tempSum += resource.hourlyTemp[idx] || 0;
      }
      monthlyGhi.push(Math.round(ghiSum / 1000 * 10) / 10); // kWh/m²
      monthlyTemp.push(Math.round(tempSum / hours * 10) / 10);
    }

    return sendSuccess(res, {
      lat: latNum,
      lon: lonNum,
      annual_ghi_kwh_m2: resource.annualGhiKwhM2,
      monthly_ghi_kwh_m2: monthlyGhi,
      monthly_avg_temp_c: monthlyTemp,
      optimal_tilt_deg: estimateOptimalTilt(latNum),
      optimal_azimuth_deg: estimateOptimalAzimuth(latNum),
    }, 'Solar resource data retrieved');
  } catch (err) {
    logger.error('getSolarResource error', { message: err.message });
    return sendError(res, 'Failed to retrieve solar resource data');
  }
};

/**
 * POST /api/simulation/auto-size
 * AI-recommended PV+BESS sizing based on load profile and location.
 */
exports.autoSizeSystem = async (req, res) => {
  try {
    const { project_id, annual_kwh, peak_kw, location_lat, location_lon, include_bess } = req.body;

    // auto-size can work with direct params (from wizard) or from saved design
    let annualKwh = Number(annual_kwh) || 0;
    let peakKw = Number(peak_kw) || 0;
    let lat = Number(location_lat) || 6.5;
    let lon = Number(location_lon) || 3.4;
    let dispatchStrategy = 'self_consumption';
    let gridTopology = 'grid_tied_bess';

    // If project_id is provided, try to use saved design data
    if (project_id) {
      const project = await verifyProjectOwnership(project_id, req.user);
      if (!project) return sendError(res, 'Project not found', 404);

      const { data: design } = await supabase
        .from('project_designs')
        .select('*, load_profiles!project_designs_load_profile_id_fkey(*)')
        .eq('project_id', project_id)
        .single();

      if (design) {
        const loadProfile = design.load_profiles;
        if (!annualKwh && loadProfile) annualKwh = Number(loadProfile.annual_consumption_kwh) || 0;
        if (!peakKw && loadProfile) peakKw = Number(loadProfile.peak_demand_kw) || 0;
        if (design.location_lat) lat = Number(design.location_lat);
        if (design.location_lon) lon = Number(design.location_lon);
        if (design.bess_dispatch_strategy) dispatchStrategy = design.bess_dispatch_strategy;
        if (design.grid_topology) gridTopology = design.grid_topology;
      }
    }

    if (annualKwh <= 0) return sendError(res, 'Annual consumption (kWh) is required for auto-sizing', 400);

    // Derived demand metrics
    const avgDailyKwh = annualKwh / 365;
    const avgKw = annualKwh / 8760;
    // If no peak provided, estimate from average using typical residential load factor ~0.35
    if (peakKw <= 0) peakKw = Math.round(avgKw / 0.35 * 100) / 100;
    const loadFactor = peakKw > 0 ? avgKw / peakKw : 0.35;

    // Fetch solar resource
    const solar = await getHourlySolarResource(lat, lon);
    const annualGhi = solar.annualGhiKwhM2;

    // ─── PV Sizing ───
    // Target 65-75% solar fraction; use location-specific PR estimate
    // Higher peak:average ratio (low load factor) → slight PV oversize for self-consumption
    const targetPR = 1550; // kWh/kWp typical for Africa
    const targetOffset = loadFactor < 0.3 ? 0.65 : loadFactor < 0.5 ? 0.70 : 0.75;
    let pvCapacity = Math.round((annualKwh * targetOffset) / targetPR);

    // For off-grid: PV must be able to cover average daytime load + battery charging
    // Assume ~5 peak sun hours/day for Africa
    if (gridTopology === 'off_grid') {
      const minPvOffGrid = Math.ceil(avgDailyKwh / 5); // kWp needed for daily energy
      pvCapacity = Math.max(pvCapacity, minPvOffGrid);
    }

    // ─── BESS Sizing ───
    // Self-consumption: cover average evening load (non-sun hours ~16h × avgKw) within DoD limits
    // Peak-shave: cover 2h of peak demand
    // Off-grid: cover overnight demand + autonomy margin
    const dod = 0.80; // LFP standard
    let bessCapacity;
    if (dispatchStrategy === 'peak_shave') {
      bessCapacity = Math.round(peakKw * 2 / dod);
    } else if (gridTopology === 'off_grid') {
      // Off-grid: 2 days autonomy at average daily usage
      bessCapacity = Math.round(avgDailyKwh * 2 / dod);
    } else {
      // Self-consumption: average evening/night consumption (~60% of daily load happens outside peak sun)
      const eveningKwh = avgDailyKwh * 0.6;
      bessCapacity = Math.round(eveningKwh / dod);
    }

    // ─── Inverter Sizing ───
    // Must handle whichever is larger: PV output or load peak
    // Off-grid: must handle full peak load from battery alone
    // Grid-tied: typically sized to PV capacity / DC:AC ratio, but should accommodate load peak for hybrid
    const dcAcRatio = 1.2;
    const pvInverterKva = Math.round(pvCapacity / dcAcRatio * 10) / 10;
    let minInverterKva;
    if (gridTopology === 'off_grid') {
      // Off-grid: inverter MUST serve full peak load (no grid backup)
      minInverterKva = Math.ceil(peakKw * 1.25); // 25% safety margin
    } else if (gridTopology === 'hybrid') {
      // Hybrid: should handle peak load during outages
      minInverterKva = Math.ceil(peakKw * 1.1);
    } else {
      // Grid-tied: sized to PV, grid handles peak excess
      minInverterKva = pvInverterKva;
    }
    const recommendedInverterKva = Math.max(pvInverterKva, minInverterKva);

    // ─── BESS Power Rating ───
    // Must be able to discharge at peak demand rate (minus available solar at night)
    const bessCRate = 0.5;
    const bessPowerKw = Math.round(bessCapacity * bessCRate * 10) / 10;
    const bessPowerAdequate = bessPowerKw >= peakKw * 0.8; // Can handle 80% of peak

    // ─── CAPEX estimate ───
    const pvCostPerKwp = 15000;
    const bessCostPerKwh = 250000;
    const inverterCostPerKva = 8000;
    const bosCost = pvCapacity * pvCostPerKwp * 0.15;
    const installCost = (pvCapacity * pvCostPerKwp + bessCapacity * bessCostPerKwh) * 0.1;

    const recommendation = {
      pv_capacity_kwp: pvCapacity,
      pv_tilt_deg: estimateOptimalTilt(lat),
      pv_azimuth_deg: estimateOptimalAzimuth(lat),
      pv_technology: 'topcon_bi',
      bess_capacity_kwh: include_bess !== false ? bessCapacity : 0,
      bess_chemistry: 'lfp',
      bess_dod_pct: 80,
      bess_c_rate: bessCRate,
      inverter_kva: recommendedInverterKva,
      bess_power_kw: include_bess !== false ? bessPowerKw : 0,
      load_metrics: {
        annual_kwh: Math.round(annualKwh),
        avg_daily_kwh: Math.round(avgDailyKwh * 10) / 10,
        peak_kw: peakKw,
        avg_kw: Math.round(avgKw * 100) / 100,
        load_factor: Math.round(loadFactor * 1000) / 1000,
      },
      estimated_capex: {
        pv: pvCapacity * pvCostPerKwp,
        bess: include_bess !== false ? bessCapacity * bessCostPerKwh : 0,
        inverter: Math.round(recommendedInverterKva * inverterCostPerKva),
        bos: Math.round(bosCost),
        installation: Math.round(installCost),
        total: Math.round(pvCapacity * pvCostPerKwp + (include_bess !== false ? bessCapacity * bessCostPerKwh : 0) + recommendedInverterKva * inverterCostPerKva + bosCost + installCost),
      },
      warnings: [],
      reasoning: {
        pv: `${pvCapacity} kWp sized to offset ~${Math.round(targetOffset * 100)}% of ${Math.round(annualKwh / 1000)} MWh annual consumption (${Math.round(avgDailyKwh)} kWh/day avg) at ${targetPR} kWh/kWp performance ratio for this location (${Math.round(annualGhi)} kWh/m²/yr GHI).`,
        bess: include_bess !== false
          ? `${bessCapacity} kWh${dispatchStrategy === 'peak_shave'
            ? ` (2h at ${peakKw} kW peak ÷ ${(dod * 100)}% DoD) for peak demand shaving`
            : gridTopology === 'off_grid'
              ? ` (2 days × ${Math.round(avgDailyKwh)} kWh/day ÷ ${(dod * 100)}% DoD) for off-grid autonomy`
              : ` (${Math.round(avgDailyKwh * 0.6)} kWh evening load ÷ ${(dod * 100)}% DoD) for self-consumption`
          }. Power rating: ${bessPowerKw} kW (${bessCRate}C).`
          : 'BESS not included.',
        inverter: `${recommendedInverterKva} kVA — ${gridTopology === 'off_grid'
          ? `must handle full ${peakKw} kW peak load (off-grid, 25% safety margin)`
          : gridTopology === 'hybrid'
            ? `must handle ${peakKw} kW peak load during outages (10% margin)`
            : `sized to PV array at ${dcAcRatio} DC:AC ratio`
        }.`,
        technology: 'n-type TOPCon Bifacial recommended for best balance of efficiency, degradation, and heat tolerance in African conditions.',
      },
    };

    // Add warnings for potential issues
    if (include_bess !== false && !bessPowerAdequate) {
      recommendation.warnings.push({
        type: 'bess_power_low',
        message: `Battery power rating (${bessPowerKw} kW at ${bessCRate}C) may be insufficient for ${peakKw} kW peak demand. Consider a higher C-rate or larger battery.`,
      });
    }
    if (loadFactor < 0.2) {
      recommendation.warnings.push({
        type: 'spiky_load',
        message: `Very spiky load profile (load factor ${(loadFactor * 100).toFixed(0)}%). Peak demand (${peakKw} kW) is ${Math.round(peakKw / avgKw)}× average. Inverter and battery power ratings are critical — validate equipment can handle peak.`,
      });
    }

    return sendSuccess(res, recommendation, 'System sizing recommendation generated');
  } catch (err) {
    logger.error('autoSizeSystem error', { message: err.message });
    return sendError(res, 'Auto-sizing failed');
  }
};

/**
 * POST /api/simulation/:projectId/ai-feedback
 * Generate AI expert feedback for the latest simulation results.
 */
exports.generateAIFeedback = async (req, res) => {
  try {
    const { projectId } = req.params;

    const project = await verifyProjectOwnership(projectId, req.user);
    if (!project) return sendError(res, 'Project not found or access denied', 404);

    // Get design
    const { data: design } = await supabase
      .from('project_designs')
      .select('id')
      .eq('project_id', projectId)
      .single();

    if (!design) return sendError(res, 'No design found', 404);

    // Get latest results
    const { data: result } = await supabase
      .from('simulation_results')
      .select('id, ai_expert_feedback, ai_feedback_generated_at')
      .eq('project_design_id', design.id)
      .order('run_at', { ascending: false })
      .limit(1)
      .single();

    if (!result) return sendError(res, 'No simulation results found. Run simulation first.', 404);

    const feedback = await generateFeedback(result.id);

    return sendSuccess(res, {
      feedback,
      generated_at: new Date().toISOString(),
    }, 'AI expert feedback generated');
  } catch (err) {
    logger.error('generateAIFeedback error', { message: err.message });
    return sendError(res, 'Failed to generate AI feedback: ' + err.message);
  }
};

/**
 * PUT /api/simulation/:projectId/ai-feedback
 * Save user-edited AI feedback text.
 */
exports.saveAIFeedback = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { edited_text } = req.body;

    if (typeof edited_text !== 'string') return sendError(res, 'edited_text is required', 400);

    const project = await verifyProjectOwnership(projectId, req.user);
    if (!project) return sendError(res, 'Project not found or access denied', 404);

    const { data: design } = await supabase
      .from('project_designs')
      .select('id')
      .eq('project_id', projectId)
      .single();

    if (!design) return sendError(res, 'No design found', 404);

    const { data: result } = await supabase
      .from('simulation_results')
      .select('id')
      .eq('project_design_id', design.id)
      .order('run_at', { ascending: false })
      .limit(1)
      .single();

    if (!result) return sendError(res, 'No simulation results found', 404);

    await saveEditedFeedback(result.id, edited_text);

    return sendSuccess(res, null, 'Feedback saved');
  } catch (err) {
    logger.error('saveAIFeedback error', { message: err.message });
    return sendError(res, 'Failed to save feedback');
  }
};
