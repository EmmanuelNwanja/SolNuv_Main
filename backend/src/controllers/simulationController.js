/**
 * SolNuv Simulation Controller
 * API endpoints for project simulation and auto-sizing.
 */

const supabase = require('../config/database');
const { sendSuccess, sendError } = require('../utils/responseHelper');
const { runSimulation } = require('../services/simulationService');
const { getHourlySolarResource, estimateOptimalTilt, estimateOptimalAzimuth } = require('../services/solarResourceService');
const logger = require('../utils/logger');

/**
 * POST /api/simulation/run
 * Run full simulation for a project design.
 */
exports.runProjectSimulation = async (req, res) => {
  try {
    const { project_id } = req.body;
    if (!project_id) return sendError(res, 'project_id is required', 400);

    // Verify ownership
    const { data: project } = await supabase
      .from('projects')
      .select('id, company_id')
      .eq('id', project_id)
      .eq('company_id', req.user.company_id)
      .single();

    if (!project) return sendError(res, 'Project not found or access denied', 404);

    // Get design
    const { data: design } = await supabase
      .from('project_designs')
      .select('id')
      .eq('project_id', project_id)
      .single();

    if (!design) return sendError(res, 'No design configuration found. Complete the design wizard first.', 400);

    const results = await runSimulation(design.id);

    // Strip hourly data from response (too large for JSON response)
    const { hourly_flows, ...summary } = results;

    return sendSuccess(res, summary, 'Simulation completed');
  } catch (err) {
    logger.error('runProjectSimulation error', { message: err.message, stack: err.stack });
    return sendError(res, 'Simulation failed: ' + err.message);
  }
};

/**
 * GET /api/simulation/:projectId/results
 * Get latest simulation results for a project.
 */
exports.getSimulationResults = async (req, res) => {
  try {
    const { projectId } = req.params;

    // Verify ownership
    const { data: project } = await supabase
      .from('projects')
      .select('id, company_id')
      .eq('id', projectId)
      .eq('company_id', req.user.company_id)
      .single();

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

    const { data: project } = await supabase
      .from('projects')
      .select('id, company_id')
      .eq('id', projectId)
      .eq('company_id', req.user.company_id)
      .single();

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
    const { project_id } = req.body;
    if (!project_id) return sendError(res, 'project_id is required', 400);

    // Verify ownership
    const { data: project } = await supabase
      .from('projects')
      .select('id, company_id')
      .eq('id', project_id)
      .eq('company_id', req.user.company_id)
      .single();

    if (!project) return sendError(res, 'Project not found', 404);

    // Get design and load profile
    const { data: design } = await supabase
      .from('project_designs')
      .select('*, load_profiles!project_designs_load_profile_id_fkey(*)')
      .eq('project_id', project_id)
      .single();

    if (!design) return sendError(res, 'No design found', 404);

    const loadProfile = design.load_profiles;
    const annualKwh = Number(loadProfile?.annual_consumption_kwh) || 0;
    const peakKw = Number(loadProfile?.peak_demand_kw) || 0;

    if (annualKwh <= 0) return sendError(res, 'Load profile required for auto-sizing', 400);

    // Fetch solar resource
    const lat = Number(design.location_lat) || 6.5;
    const lon = Number(design.location_lon) || 3.4;
    const solar = await getHourlySolarResource(lat, lon);
    const annualGhi = solar.annualGhiKwhM2;

    // PV sizing: target 65-75% of annual consumption offset
    // PR assumption: 1500-1700 kWh/kWp typical for Africa
    const targetPR = 1550; // kWh/kWp
    const targetOffset = 0.70; // 70% of consumption
    const pvCapacity = Math.round((annualKwh * targetOffset) / targetPR);

    // BESS sizing: 2-4 hours of peak demand, or TOU arbitrage window
    const bessHours = design.bess_dispatch_strategy === 'peak_shave' ? 2 : 4;
    const bessCapacity = Math.round(peakKw * bessHours);

    // CAPEX estimate (per kWp for PV, per kWh for BESS) — African market rates
    const pvCostPerKwp = 15000; // NGN or contextual currency
    const bessCostPerKwh = 250000;
    const bosCost = pvCapacity * pvCostPerKwp * 0.15; // 15% of PV for BoS
    const installCost = (pvCapacity * pvCostPerKwp + bessCapacity * bessCostPerKwh) * 0.1;

    const recommendation = {
      pv_capacity_kwp: pvCapacity,
      pv_tilt_deg: estimateOptimalTilt(lat),
      pv_azimuth_deg: estimateOptimalAzimuth(lat),
      pv_technology: 'topcon_bi',
      bess_capacity_kwh: bessCapacity,
      bess_chemistry: 'lfp',
      bess_dod_pct: 80,
      bess_c_rate: 0.5,
      estimated_capex: {
        pv: pvCapacity * pvCostPerKwp,
        bess: bessCapacity * bessCostPerKwh,
        bos: Math.round(bosCost),
        installation: Math.round(installCost),
        total: Math.round(pvCapacity * pvCostPerKwp + bessCapacity * bessCostPerKwh + bosCost + installCost),
      },
      reasoning: {
        pv: `${pvCapacity} kWp sized to offset ~${Math.round(targetOffset * 100)}% of ${Math.round(annualKwh / 1000)} MWh annual consumption at ${targetPR} kWh/kWp performance ratio for this location (${Math.round(annualGhi)} kWh/m²/yr GHI).`,
        bess: `${bessCapacity} kWh (${bessHours}h at ${peakKw} kW peak) sized for ${design.bess_dispatch_strategy === 'peak_shave' ? 'peak demand shaving' : 'self-consumption + TOU arbitrage'}.`,
        technology: 'n-type TOPCon Bifacial recommended for best balance of efficiency, degradation, and heat tolerance in African conditions.',
      },
    };

    return sendSuccess(res, recommendation, 'System sizing recommendation generated');
  } catch (err) {
    logger.error('autoSizeSystem error', { message: err.message });
    return sendError(res, 'Auto-sizing failed');
  }
};
