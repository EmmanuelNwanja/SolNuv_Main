/**
 * SolNuv Project Controller
 * Manages solar installation projects and equipment
 */

const supabase = require('../config/database');
const { sendSuccess, sendError, sendPaginated } = require('../utils/responseHelper');
const { calculateDecommissionDate } = require('../services/degradationService');
const { calculatePanelSilver, calculateProjectRecycleIncome } = require('../services/silverService');
const { refreshLeaderboard } = require('../services/schedulerService');
const logger = require('../utils/logger');
const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');

/**
 * GET /api/projects
 * List projects for authenticated user or organization
 */
exports.getProjects = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, state, search } = req.query;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('projects')
      .select(`
        *,
        equipment(id, equipment_type, brand, model, size_watts, capacity_kwh, quantity, condition, estimated_silver_grams, adjusted_failure_date),
        recovery_requests(id, status, preferred_date)
      `, { count: 'exact' });

    // Scope to user or organization
    if (req.user.company_id) {
      query = query.eq('company_id', req.user.company_id);
    } else {
      query = query.eq('user_id', req.user.id);
    }

    if (status) query = query.eq('status', status);
    if (state) query = query.eq('state', state);
    if (search) query = query.ilike('name', `%${search}%`);

    const { data: projects, count, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);

    if (error) throw error;

    // Enrich with summary
    const enriched = (projects || []).map(p => ({
      ...p,
      summary: {
        total_panels: p.equipment?.filter(e => e.equipment_type === 'panel').reduce((s, e) => s + e.quantity, 0) || 0,
        total_batteries: p.equipment?.filter(e => e.equipment_type === 'battery').reduce((s, e) => s + e.quantity, 0) || 0,
        total_silver_grams: p.equipment?.filter(e => e.equipment_type === 'panel').reduce((s, e) => s + (e.estimated_silver_grams || 0), 0) || 0,
        has_pending_recovery: p.recovery_requests?.some(r => r.status === 'requested'),
      }
    }));

    return sendPaginated(res, enriched, count || 0, page, limit);
  } catch (error) {
    console.error('getProjects error:', error);
    return sendError(res, 'Failed to fetch projects', 500);
  }
};

/**
 * POST /api/projects
 * Create new project with equipment
 */
exports.createProject = async (req, res) => {
  try {
    const {
      name, client_name, description,
      state, city, address, latitude, longitude,
      installation_date,
      notes,
      panels = [], // array of { brand, model, size_watts, quantity, condition }
      batteries = [], // array of { brand, model, capacity_kwh, quantity, condition }
      inverters = [], // array of { brand, model, power_kw, quantity, condition }
    } = req.body;

    if (!name) return sendError(res, 'Project name is required', 400);
    if (!state) return sendError(res, 'State is required', 400);
    if (!city) return sendError(res, 'City is required', 400);
    if (!installation_date) return sendError(res, 'Installation date is required', 400);
    if (panels.length === 0 && batteries.length === 0) return sendError(res, 'Add at least one panel or battery', 400);

    // Generate QR code data
    const qrData = uuidv4().replace(/-/g, '');

    // Calculate decommission date from degradation algo
    const degradation = await calculateDecommissionDate(state, installation_date);

    // Create project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .insert({
        user_id: req.user.id,
        company_id: req.user.company_id || null,
        name,
        client_name,
        description,
        state,
        city,
        address,
        latitude: latitude || null,
        longitude: longitude || null,
        installation_date,
        estimated_decommission_date: degradation.adjusted_failure_date,
        notes,
        qr_code_data: qrData,
        status: 'active',
      })
      .select()
      .single();

    if (projectError) throw projectError;

    // Create equipment records
    const equipmentRecords = [];

    for (const panel of panels) {
      if (!panel.brand || !panel.size_watts || !panel.quantity) continue;

      const silverCalc = await calculatePanelSilver(panel.size_watts, panel.quantity, panel.brand);

      equipmentRecords.push({
        project_id: project.id,
        equipment_type: 'panel',
        brand: panel.brand,
        model: panel.model || null,
        size_watts: panel.size_watts,
        quantity: panel.quantity,
        condition: panel.condition || 'good',
        total_panels_wattage: panel.size_watts * panel.quantity,
        estimated_silver_grams: silverCalc.total_silver_grams,
        estimated_silver_value_ngn: silverCalc.recovery_value_expected_ngn,
        adjusted_failure_date: degradation.adjusted_failure_date,
        climate_zone: degradation.climate_zone,
        degradation_factor: degradation.degradation_factor,
      });
    }

    for (const battery of batteries) {
      if (!battery.brand || !battery.quantity) continue;

      equipmentRecords.push({
        project_id: project.id,
        equipment_type: 'battery',
        brand: battery.brand,
        model: battery.model || null,
        capacity_kwh: battery.capacity_kwh || null,
        quantity: battery.quantity,
        condition: battery.condition || 'good',
      });
    }

    for (const inverter of inverters) {
      if (!inverter.brand || !inverter.quantity) continue;

      equipmentRecords.push({
        project_id: project.id,
        equipment_type: 'inverter',
        brand: inverter.brand,
        model: inverter.model || null,
        size_watts: inverter.power_kw ? Number(inverter.power_kw) * 1000 : null,
        quantity: inverter.quantity,
        condition: inverter.condition || 'good',
      });
    }

    if (equipmentRecords.length > 0) {
      const { error: eqError } = await supabase.from('equipment').insert(equipmentRecords);
      if (eqError) {
        const message = String(eqError.message || '');
        const isInverterSchemaGap = message.toLowerCase().includes('inverter') && message.toLowerCase().includes('equipment_type');

        if (!isInverterSchemaGap) throw eqError;

        // Backward compatibility: if inverter enum value is not migrated yet, save panel/battery records only.
        const fallbackRecords = equipmentRecords.filter((r) => r.equipment_type !== 'inverter');
        if (fallbackRecords.length > 0) {
          const { error: fallbackError } = await supabase.from('equipment').insert(fallbackRecords);
          if (fallbackError) throw fallbackError;
        }
      }
    }

    // Generate QR code URL using configured frontend origin
    const frontendBase = process.env.FRONTEND_URL || 'http://localhost:3000';
    const qrVerificationLink = `${frontendBase}/projects/verify/${qrData}`;
    const qrCodeDataUrl = await QRCode.toDataURL(qrVerificationLink, {
      color: { dark: '#0D3B2E', light: '#FFFFFF' },
      width: 300,
    });

    // Update project with QR code
    await supabase.from('projects').update({ qr_code_url: qrCodeDataUrl }).eq('id', project.id);

    // Fetch complete project
    const { data: completeProject } = await supabase
      .from('projects')
      .select('*, equipment(*)')
      .eq('id', project.id)
      .single();

    // Trigger leaderboard refresh asynchronously without hiding failures.
    refreshLeaderboard().catch((refreshError) => {
      logger.error('Leaderboard refresh failed after project creation', {
        project_id: project.id,
        message: refreshError.message,
      });
    });

    return sendSuccess(res, {
      project: completeProject,
      degradation_info: degradation,
    }, 'Project created successfully', 201);
  } catch (error) {
    console.error('createProject error:', error);
    return sendError(res, error.message || 'Failed to create project', 500);
  }
};

/**
 * GET /api/projects/:id
 * Get single project with full details
 */
exports.getProject = async (req, res) => {
  try {
    const { id } = req.params;

    let query = supabase
      .from('projects')
      .select(`
        *,
        equipment(*),
        recovery_requests(*),
        users!projects_user_id_fkey(first_name, last_name, email, avatar_url)
      `)
      .eq('id', id);

    // Scope check
    if (req.user.company_id) {
      query = query.eq('company_id', req.user.company_id);
    } else {
      query = query.eq('user_id', req.user.id);
    }

    const { data: project, error } = await query.single();

    if (error || !project) return sendError(res, 'Project not found', 404);

    // Recalculate degradation for display + compute recycle income (run in parallel)
    const [degradation, recycleIncome] = await Promise.all([
      calculateDecommissionDate(project.state, project.installation_date),
      calculateProjectRecycleIncome(project.equipment || [], project.installation_date),
    ]);

    return sendSuccess(res, { ...project, degradation_info: degradation, recycle_income: recycleIncome });
  } catch (_error) {
    return sendError(res, 'Failed to fetch project', 500);
  }
};

/**
 * PUT /api/projects/:id
 * Update project details
 */
exports.updateProject = async (req, res) => {
  try {
    const { id } = req.params;
    const allowedFields = ['name', 'client_name', 'description', 'address', 'city', 'notes', 'status', 'actual_decommission_date', 'recycling_date', 'recycler_name'];

    const updateData = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) updateData[field] = req.body[field];
    }

    // If marking as decommissioned
    if (req.body.status === 'decommissioned' && !req.body.actual_decommission_date) {
      updateData.actual_decommission_date = new Date().toISOString().split('T')[0];
    }

    const { data: project, error } = await supabase
      .from('projects')
      .update(updateData)
      .eq('id', id)
      .eq(req.user.company_id ? 'company_id' : 'user_id', req.user.company_id || req.user.id)
      .select('*, equipment(*)')
      .single();

    if (error) throw error;

    
    
    return sendSuccess(res, project, 'Project updated');
  } catch (_error) {
    return sendError(res, 'Failed to update project', 500);
  }
};

/**
 * DELETE /api/projects/:id
 */
exports.deleteProject = async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', id)
      .eq(req.user.company_id ? 'company_id' : 'user_id', req.user.company_id || req.user.id);

    if (error) throw error;
    return sendSuccess(res, null, 'Project deleted');
  } catch (_error) {
    return sendError(res, 'Failed to delete project', 500);
  }
};

/**
 * POST /api/projects/:id/recovery
 * Request recovery for a project
 */
exports.requestRecovery = async (req, res) => {
  try {
    const { id } = req.params;
    const { preferred_date, pickup_address, notes } = req.body;

    if (!pickup_address || !String(pickup_address).trim()) {
      return sendError(res, 'Pickup address is required', 400);
    }
    if (!preferred_date) {
      return sendError(res, 'Preferred pickup date is required', 400);
    }

    const requestedDate = new Date(preferred_date);
    if (Number.isNaN(requestedDate.getTime())) {
      return sendError(res, 'Preferred pickup date is invalid', 400);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    requestedDate.setHours(0, 0, 0, 0);
    if (requestedDate < today) {
      return sendError(res, 'Preferred pickup date cannot be in the past', 400);
    }

    let projectQuery = supabase.from('projects').select('id, name').eq('id', id);
    if (req.user.company_id) {
      projectQuery = projectQuery.eq('company_id', req.user.company_id);
    } else {
      projectQuery = projectQuery.eq('user_id', req.user.id);
    }

    const { data: project } = await projectQuery.single();
    if (!project) return sendError(res, 'Project not found', 404);

    const { data: existingRecovery } = await supabase
      .from('recovery_requests')
      .select('id, status')
      .eq('project_id', id)
      .in('status', ['requested', 'scheduled', 'in_progress'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingRecovery) {
      return sendError(res, 'A recovery request is already active for this project', 409);
    }

    const { data: recovery, error } = await supabase
      .from('recovery_requests')
      .insert({
        project_id: id,
        user_id: req.user.id,
        preferred_date,
        pickup_address,
        notes,
        status: 'requested',
      })
      .select()
      .single();

    if (error) throw error;

    // Update project status
    await supabase.from('projects').update({ status: 'pending_recovery' }).eq('id', id);

    // Send confirmation notification
    const { sendRecoveryConfirmation } = require('../services/notificationService');
    sendRecoveryConfirmation(req.user, project, recovery).catch(console.error);

    return sendSuccess(res, recovery, 'Recovery request submitted', 201);
  } catch (error) {
    logger.error('Failed to submit recovery request', { user_id: req.user?.id || null, project_id: req.params?.id || null, message: error.message });
    return sendError(res, 'Failed to submit recovery request', 500);
  }
};

/**
 * GET /api/projects/verify/:qrCode
 * Public endpoint to verify project via QR code
 */
exports.verifyByQR = async (req, res) => {
  try {
    const { qrCode } = req.params;
    const { data: project } = await supabase
      .from('projects')
      .select('id, name, state, city, installation_date, estimated_decommission_date, status, equipment(equipment_type, brand, quantity)')
      .eq('qr_code_data', qrCode)
      .single();

    if (!project) return sendError(res, 'Project not found', 404);

    return sendSuccess(res, {
      project_name: project.name,
      location: `${project.city}, ${project.state}`,
      installation_date: project.installation_date,
      estimated_decommission: project.estimated_decommission_date,
      status: project.status,
      total_panels: project.equipment?.filter(e => e.equipment_type === 'panel').reduce((s, e) => s + e.quantity, 0),
      total_batteries: project.equipment?.filter(e => e.equipment_type === 'battery').reduce((s, e) => s + e.quantity, 0),
      verified_by: 'SolNuv Platform',
      verified_at: new Date().toISOString(),
    });
  } catch (_error) {
    return sendError(res, 'Verification failed', 500);
  }
};

/**
 * GET /api/projects/export/csv
 * Export projects as CSV
 */
exports.exportCSV = async (req, res) => {
  try {
    let query = supabase.from('projects').select('*, equipment(*)');

    if (req.user.company_id) {
      query = query.eq('company_id', req.user.company_id);
    } else {
      query = query.eq('user_id', req.user.id);
    }

    const { data: projects } = await query;

    const rows = [
      ['Project Name', 'Location', 'State', 'Installation Date', 'Est. Decommission', 'Status', 'Total Panels', 'Total Batteries', 'Panel Brands', 'Total Silver (g)'],
    ];

    (projects || []).forEach(p => {
      const panels = p.equipment?.filter(e => e.equipment_type === 'panel') || [];
      const batteries = p.equipment?.filter(e => e.equipment_type === 'battery') || [];
      rows.push([
        p.name,
        `${p.city}, ${p.state}`,
        p.state,
        p.installation_date,
        p.estimated_decommission_date || 'TBD',
        p.status,
        panels.reduce((s, e) => s + e.quantity, 0),
        batteries.reduce((s, e) => s + e.quantity, 0),
        [...new Set(panels.map(e => e.brand))].join('; '),
        panels.reduce((s, e) => s + (e.estimated_silver_grams || 0), 0).toFixed(4),
      ]);
    });

    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=SolNuv_Projects.csv');
    return res.send(csv);
  } catch (_error) {
    return sendError(res, 'Failed to export CSV', 500);
  }
};

/**
 * POST /api/projects/:id/proposal-scenario
 * Save localized ROI proposal snapshot for traceability and follow-up
 */
exports.saveProposalScenario = async (req, res) => {
  try {
    const { id: projectId } = req.params;
    const payload = req.body || {};

    const { data: project } = await supabase
      .from('projects')
      .select('id, user_id, company_id')
      .eq('id', projectId)
      .single();

    if (!project) return sendError(res, 'Project not found', 404);

    if (req.user.company_id) {
      if (project.company_id !== req.user.company_id) return sendError(res, 'Forbidden', 403);
    } else if (project.user_id !== req.user.id) {
      return sendError(res, 'Forbidden', 403);
    }

    const insertPayload = {
      user_id: req.user.id,
      company_id: req.user.company_id || null,
      project_id: projectId,
      client_name: payload.client_name || null,
      tariff_band: payload.tariff_band || 'A',
      tariff_rate_ngn_per_kwh: payload.tariff_rate_ngn_per_kwh || 225,
      generator_fuel_price_ngn_per_liter: payload.generator_fuel_price_ngn_per_liter || 1000,
      current_grid_kwh_per_day: payload.current_grid_kwh_per_day || 0,
      current_generator_liters_per_day: payload.current_generator_liters_per_day || 0,
      proposed_solar_capex_ngn: payload.proposed_solar_capex_ngn || 0,
      annual_om_cost_ngn: payload.annual_om_cost_ngn || 0,
      projected_grid_kwh_offset_per_day: payload.projected_grid_kwh_offset_per_day || 0,
      projected_generator_liters_offset_per_day: payload.projected_generator_liters_offset_per_day || 0,
      payback_months: payload.payback_months || null,
      annual_savings_ngn: payload.annual_savings_ngn || null,
      ten_year_savings_ngn: payload.ten_year_savings_ngn || null,
      snapshot: payload.snapshot || null,
    };

    const { data, error } = await supabase
      .from('proposal_scenarios')
      .insert(insertPayload)
      .select('*')
      .single();

    if (error) throw error;
    return sendSuccess(res, data, 'Proposal scenario saved', 201);
  } catch (_error) {
    return sendError(res, 'Failed to save proposal scenario', 500);
  }
};

/**
 * POST /api/projects/:id/battery-assets
 */
exports.createBatteryAsset = async (req, res) => {
  try {
    const { id: projectId } = req.params;
    const {
      brand,
      chemistry,
      capacity_kwh,
      quantity = 1,
      installation_date,
      warranty_years = 5,
    } = req.body;

    if (!brand || !chemistry || !capacity_kwh || !installation_date) {
      return sendError(res, 'brand, chemistry, capacity_kwh, and installation_date are required', 400);
    }

    const { data: project } = await supabase
      .from('projects')
      .select('id, user_id, company_id')
      .eq('id', projectId)
      .single();

    if (!project) return sendError(res, 'Project not found', 404);
    if (req.user.company_id) {
      if (project.company_id !== req.user.company_id) return sendError(res, 'Forbidden', 403);
    } else if (project.user_id !== req.user.id) {
      return sendError(res, 'Forbidden', 403);
    }

    const { data, error } = await supabase
      .from('battery_assets')
      .insert({
        project_id: projectId,
        user_id: req.user.id,
        company_id: req.user.company_id || null,
        brand,
        chemistry,
        capacity_kwh,
        quantity,
        installation_date,
        warranty_years,
      })
      .select('*')
      .single();

    if (error) throw error;

    const frontendBase = process.env.FRONTEND_URL || 'http://localhost:3000';
    const qrLink = `${frontendBase}/field/battery/${data.qr_code_data}`;
    const qrImageDataUrl = await QRCode.toDataURL(qrLink, {
      color: { dark: '#0D3B2E', light: '#FFFFFF' },
      width: 320,
    });

    return sendSuccess(res, {
      ...data,
      qr_link: qrLink,
      qr_image_data_url: qrImageDataUrl,
    }, 'Battery asset created', 201);
  } catch (_error) {
    return sendError(res, 'Failed to create battery asset', 500);
  }
};

/**
 * GET /api/projects/:id/battery-assets
 */
exports.getBatteryAssets = async (req, res) => {
  try {
    const { id: projectId } = req.params;

    const { data: project } = await supabase
      .from('projects')
      .select('id, user_id, company_id')
      .eq('id', projectId)
      .single();

    if (!project) return sendError(res, 'Project not found', 404);
    if (req.user.company_id) {
      if (project.company_id !== req.user.company_id) return sendError(res, 'Forbidden', 403);
    } else if (project.user_id !== req.user.id) {
      return sendError(res, 'Forbidden', 403);
    }

    const { data: assets, error } = await supabase
      .from('battery_assets')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const frontendBase = process.env.FRONTEND_URL || 'http://localhost:3000';
    const enrichedAssets = await Promise.all((assets || []).map(async (asset) => {
      const qrLink = `${frontendBase}/field/battery/${asset.qr_code_data}`;
      const qrImageDataUrl = await QRCode.toDataURL(qrLink, {
        color: { dark: '#0D3B2E', light: '#FFFFFF' },
        width: 280,
      });

      return {
        ...asset,
        qr_link: qrLink,
        qr_image_data_url: qrImageDataUrl,
      };
    }));

    return sendSuccess(res, enrichedAssets);
  } catch (_error) {
    return sendError(res, 'Failed to fetch battery assets', 500);
  }
};

/**
 * POST /api/projects/:id/battery-assets/:assetId/logs
 */
exports.addBatteryHealthLog = async (req, res) => {
  try {
    const { id: projectId, assetId } = req.params;
    const {
      log_date,
      measured_voltage,
      measured_capacity_kwh,
      avg_depth_of_discharge_pct,
      estimated_cycles_per_day,
      ambient_temperature_c,
      estimated_soh_pct,
      cumulative_damage_pct,
      notes,
    } = req.body;

    if (!log_date) return sendError(res, 'log_date is required', 400);

    const { data: asset } = await supabase
      .from('battery_assets')
      .select('id, project_id, company_id, user_id')
      .eq('id', assetId)
      .eq('project_id', projectId)
      .single();

    if (!asset) return sendError(res, 'Battery asset not found', 404);
    if (req.user.company_id) {
      if (asset.company_id !== req.user.company_id) return sendError(res, 'Forbidden', 403);
    } else if (asset.user_id !== req.user.id) {
      return sendError(res, 'Forbidden', 403);
    }

    const { data, error } = await supabase
      .from('battery_health_logs')
      .insert({
        battery_asset_id: assetId,
        logged_by: req.user.id,
        log_date,
        measured_voltage,
        measured_capacity_kwh,
        avg_depth_of_discharge_pct,
        estimated_cycles_per_day,
        ambient_temperature_c,
        estimated_soh_pct,
        cumulative_damage_pct,
        notes,
      })
      .select('*')
      .single();

    if (error) throw error;
    return sendSuccess(res, data, 'Battery health log saved', 201);
  } catch (_error) {
    return sendError(res, 'Failed to save battery health log', 500);
  }
};

/**
 * GET /api/projects/:id/battery-assets/:assetId/logs
 */
exports.getBatteryHealthLogs = async (req, res) => {
  try {
    const { id: projectId, assetId } = req.params;

    const { data: asset } = await supabase
      .from('battery_assets')
      .select('id, project_id, company_id, user_id')
      .eq('id', assetId)
      .eq('project_id', projectId)
      .single();

    if (!asset) return sendError(res, 'Battery asset not found', 404);
    if (req.user.company_id) {
      if (asset.company_id !== req.user.company_id) return sendError(res, 'Forbidden', 403);
    } else if (asset.user_id !== req.user.id) {
      return sendError(res, 'Forbidden', 403);
    }

    const { data, error } = await supabase
      .from('battery_health_logs')
      .select('*')
      .eq('battery_asset_id', assetId)
      .order('log_date', { ascending: false });

    if (error) throw error;
    return sendSuccess(res, data || []);
  } catch (_error) {
    return sendError(res, 'Failed to fetch battery health logs', 500);
  }
};

/**
 * POST /api/projects/:id/cable-compliance
 */
exports.saveCableCompliance = async (req, res) => {
  try {
    const { id: projectId } = req.params;
    const payload = req.body || {};

    const { data: project } = await supabase
      .from('projects')
      .select('id, user_id, company_id')
      .eq('id', projectId)
      .single();

    if (!project) return sendError(res, 'Project not found', 404);
    if (req.user.company_id) {
      if (project.company_id !== req.user.company_id) return sendError(res, 'Forbidden', 403);
    } else if (project.user_id !== req.user.id) {
      return sendError(res, 'Forbidden', 403);
    }

    const certRef = `CC-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

    const { data, error } = await supabase
      .from('cable_compliance_records')
      .insert({
        project_id: projectId,
        user_id: req.user.id,
        company_id: req.user.company_id || null,
        run_name: payload.run_name || 'Main DC Run',
        current_amps: payload.current_amps,
        one_way_length_m: payload.one_way_length_m,
        system_voltage_v: payload.system_voltage_v,
        allowable_voltage_drop_pct: payload.allowable_voltage_drop_pct || 3,
        ambient_temperature_c: payload.ambient_temperature_c || 30,
        conductor_material: payload.conductor_material || 'copper',
        computed_area_mm2: payload.computed_area_mm2,
        recommended_standard_mm2: payload.recommended_standard_mm2,
        estimated_voltage_drop_v: payload.estimated_voltage_drop_v,
        estimated_voltage_drop_pct: payload.estimated_voltage_drop_pct,
        is_compliant: payload.is_compliant !== false,
        compliance_certificate_ref: certRef,
        snapshot: payload.snapshot || null,
      })
      .select('*')
      .single();

    if (error) throw error;
    return sendSuccess(res, data, 'Cable compliance record saved', 201);
  } catch (_error) {
    return sendError(res, 'Failed to save cable compliance record', 500);
  }
};

/**
 * GET /api/projects/battery-ledger/:qrCode
 * Public QR-linked battery ledger view for field technicians
 */
exports.getBatteryLedgerByQr = async (req, res) => {
  try {
    const { qrCode } = req.params;

    const { data: asset } = await supabase
      .from('battery_assets')
      .select('*, projects(id, name, state, city), users(first_name, last_name, email), companies(name)')
      .eq('qr_code_data', qrCode)
      .single();

    if (!asset) return sendError(res, 'Battery asset not found', 404);

    const { data: logs } = await supabase
      .from('battery_health_logs')
      .select('*')
      .eq('battery_asset_id', asset.id)
      .order('log_date', { ascending: false })
      .limit(60);

    const latest = (logs || [])[0] || null;

    return sendSuccess(res, {
      asset,
      latest_log: latest,
      logs: logs || [],
      field_actions: {
        can_submit_log: true,
      },
    });
  } catch (_error) {
    return sendError(res, 'Failed to load battery ledger', 500);
  }
};

/**
 * POST /api/projects/battery-ledger/:qrCode/log
 * Field-friendly battery health log capture from QR page
 */
exports.addBatteryHealthLogByQr = async (req, res) => {
  try {
    const { qrCode } = req.params;
    const {
      log_date,
      measured_voltage,
      measured_capacity_kwh,
      avg_depth_of_discharge_pct,
      estimated_cycles_per_day,
      ambient_temperature_c,
      estimated_soh_pct,
      cumulative_damage_pct,
      notes,
      technician_name,
    } = req.body;

    if (!log_date) return sendError(res, 'log_date is required', 400);

    const { data: asset } = await supabase
      .from('battery_assets')
      .select('id')
      .eq('qr_code_data', qrCode)
      .single();

    if (!asset) return sendError(res, 'Battery asset not found', 404);

    const { data, error } = await supabase
      .from('battery_health_logs')
      .insert({
        battery_asset_id: asset.id,
        logged_by: req.user?.id || null,
        log_date,
        measured_voltage,
        measured_capacity_kwh,
        avg_depth_of_discharge_pct,
        estimated_cycles_per_day,
        ambient_temperature_c,
        estimated_soh_pct,
        cumulative_damage_pct,
        notes: technician_name ? `[${technician_name}] ${notes || ''}` : notes,
      })
      .select('*')
      .single();

    if (error) throw error;
    return sendSuccess(res, data, 'Battery health log submitted', 201);
  } catch (_error) {
    return sendError(res, 'Failed to submit battery log', 500);
  }
};

