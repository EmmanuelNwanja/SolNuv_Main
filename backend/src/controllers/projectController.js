/**
 * SolNuv Project Controller
 * Manages solar installation projects and equipment
 */

const supabase = require('../config/database');
const { sendSuccess, sendError, sendPaginated } = require('../utils/responseHelper');
const { calculateDecommissionDate } = require('../services/degradationService');
const { calculatePanelSilver, calculateBatteryValue } = require('../services/silverService');
const { refreshLeaderboard } = require('../services/schedulerService');
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

    if (equipmentRecords.length > 0) {
      const { error: eqError } = await supabase.from('equipment').insert(equipmentRecords);
      if (eqError) throw eqError;
    }

    // Generate QR code URL (data URL for now, can be uploaded to storage)
    const qrCodeDataUrl = await QRCode.toDataURL(`https://solnuv.com/projects/verify/${qrData}`, {
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

    refreshLeaderboard().catch(err => logger.error('Leaderboard refresh failed:', err.message));

    return sendSuccess(res, {
      project: completeProject,
      degradation_info: degradation,
    }, 'Project created successfully', 201);

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

    // Recalculate degradation for display
    const degradation = await calculateDecommissionDate(project.state, project.installation_date);

    return sendSuccess(res, { ...project, degradation_info: degradation });
  } catch (error) {
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

     // Refresh leaderboard if status changed
    if (req.body.status) {
      refreshLeaderboard().catch(() => {});
    }

    return sendSuccess(res, project, 'Project updated');
    
    return sendSuccess(res, project, 'Project updated');
  } catch (error) {
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
  } catch (error) {
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

    // Verify project ownership
    const { data: project } = await supabase.from('projects').select('id, name').eq('id', id).single();
    if (!project) return sendError(res, 'Project not found', 404);

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

    // Send confirmation email
    const { sendRecoveryConfirmation } = require('../services/emailService');
    sendRecoveryConfirmation(req.user, project, recovery).catch(console.error);

    return sendSuccess(res, recovery, 'Recovery request submitted', 201);
  } catch (error) {
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
  } catch (error) {
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
  } catch (error) {
    return sendError(res, 'Failed to export CSV', 500);
  }
};
