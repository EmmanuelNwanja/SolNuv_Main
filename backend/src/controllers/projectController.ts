/**
 * SolNuv Project Controller
 * Manages solar installation projects and equipment
 */

const supabase = require('../config/database');
const { sendSuccess, sendError, sendPaginated } = require('../utils/responseHelper');
const { calculateDecommissionDate } = require('../services/degradationService');
const { calculatePanelSilver, calculateProjectRecycleIncome } = require('../services/silverService');
const { PANEL_TECHNOLOGIES } = require('../constants/technologyConstants');
const { refreshLeaderboard } = require('../services/schedulerService');
const { verifyCoordinatesAgainstAddress, verifyDeviceGPS } = require('../services/geoVerificationService');
const logger = require('../utils/logger');
const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const { validateUUIDParam } = require('../utils/validation');

// ---------------------------------------------------------------------------
// Capacity helpers
// ---------------------------------------------------------------------------

/**
 * Calculate combined system capacity in kW.
 * Panel contribution  : sum(size_watts × quantity) / 1000
 * Battery contribution: sum(capacity_kwh × quantity)  (kWh treated as kW equivalent)
 * Either side defaults to 0 if absent.
 */
function calcCapacityKw(panels = [], batteries = []) {
  const panelKw = panels.reduce((sum, p) => {
    return sum + (Number(p.size_watts || 0) * Number(p.quantity || 0)) / 1000;
  }, 0);
  const batteryKw = batteries.reduce((sum, b) => {
    return sum + Number(b.capacity_kwh || 0) * Number(b.quantity || 0);
  }, 0);
  return Math.round((panelKw + batteryKw) * 100) / 100;
}

/**
 * Derive capacity category from combined kW value.
 * home              : 0.1 – 30 kW
 * commercial        : >30 – 100 kW
 * industrial_minigrid: >100 – 1000 kW
 * utility           : >1000 kW
 */
function getCapacityCategory(kw) {
  if (kw <= 0) return null;
  if (kw <= 30) return 'home';
  if (kw <= 100) return 'commercial';
  if (kw <= 1000) return 'industrial_minigrid';
  return 'utility';
}

const VALID_PROJECT_STATUSES = ['draft', 'active', 'maintenance', 'decommissioned', 'recycled', 'pending_recovery'];
const EDITABLE_STAGES = ['draft', 'maintenance'];
const BATTERY_QR_LOG_ACTION = 'battery_qr_log_submit';

function normalizeSerialNumbers(input) {
  if (!Array.isArray(input)) return [];
  const normalized = input
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .map((value) => value.toUpperCase());
  return [...new Set(normalized)];
}

function signBatteryLedgerWriteToken(qrCode) {
  const secret = process.env.JWT_SECRET;
  if (!secret || !qrCode) return null;
  const expiresInSeconds = 15 * 60;
  return jwt.sign(
    { action: BATTERY_QR_LOG_ACTION, qr_code: qrCode },
    secret,
    { expiresIn: expiresInSeconds }
  );
}

function verifyBatteryLedgerWriteToken(token, qrCode) {
  const secret = process.env.JWT_SECRET;
  if (!secret || !token || !qrCode) return false;
  try {
    const decoded = jwt.verify(String(token), secret);
    return decoded?.action === BATTERY_QR_LOG_ACTION && decoded?.qr_code === qrCode;
  } catch (_err) {
    return false;
  }
}

// ---------------------------------------------------------------------------
// History helper
// ---------------------------------------------------------------------------

/**
 * Insert a project_history row.
 * @param {string} projectId
 * @param {object} opts
 */
async function createHistoryEntry(projectId, {
  changedBy = null,
  actorName = null,
  projectStage = null,
  changeType,
  changeSummary = null,
  changedFields = null,
}) {
  try {
    await supabase.from('project_history').insert({
      project_id: projectId,
      changed_by: changedBy,
      actor_name: actorName,
      project_stage: projectStage,
      change_type: changeType,
      change_summary: changeSummary,
      changed_fields: changedFields || null,
    });
  } catch (err) {
    // History failures must never break the main request
    logger.warn('project_history insert failed', { project_id: projectId, message: err.message });
  }
}

async function rollbackCreatedProject(projectId) {
  if (!projectId) return;
  try {
    await supabase.from('equipment').delete().eq('project_id', projectId);
    await supabase.from('projects').delete().eq('id', projectId);
  } catch (cleanupErr) {
    logger.error('createProject rollback failed', { project_id: projectId, message: cleanupErr.message });
  }
}

/**
 * Diff two project snapshots and return { changedFields, changeSummary }.
 * Only compares human-visible text/enum fields.
 */
function diffProjectFields(oldProject, newData) {
  const WATCHED = ['name', 'client_name', 'description', 'state', 'city', 'address', 'notes', 'status'];
  const changedFields = {};
  const labelMap = {
    name: 'Name',
    client_name: 'Client',
    description: 'Description',
    state: 'State',
    city: 'City',
    address: 'Address',
    notes: 'Notes',
    status: 'Stage',
  };
  for (const field of WATCHED) {
    if (newData[field] === undefined) continue;
    const oldVal = oldProject[field] ?? null;
    const newVal = newData[field] ?? null;
    if (String(oldVal ?? '') !== String(newVal ?? '')) {
      changedFields[field] = { from: oldVal, to: newVal };
    }
  }
  const keys = Object.keys(changedFields);
  if (keys.length === 0) return null;
  const summary = 'Updated ' + keys.map(k => labelMap[k] || k).join(', ');
  return { changedFields, changeSummary: summary };
}

/**
 * GET /api/projects
 * List projects for authenticated user or organization
 */
exports.getProjects = async (req, res) => {
  try {
    const { page = 1, limit = 20, status, state, search, geo_verified, capacity_category } = req.query;
    const offset = (page - 1) * limit;

    let query = supabase
      .from('projects')
      .select(`
        *,
        equipment(id, equipment_type, brand, model, size_watts, capacity_kwh, quantity, condition, estimated_silver_grams, adjusted_failure_date),
        recovery_requests(id, status, preferred_date)
      `, { count: 'exact' });

    // Scope to user or organization.
    // Also include any legacy projects created before this user had a company
    // (company_id was null at creation time for solo users who later upgraded).
    if (req.user.company_id) {
      query = query.or(`company_id.eq.${req.user.company_id},and(user_id.eq.${req.user.id},company_id.is.null)`);
    } else {
      query = query.eq('user_id', req.user.id);
    }

    if (status) query = query.eq('status', status);
    if (state) query = query.eq('state', state);
    if (search) query = query.ilike('name', `%${search}%`);
    if (geo_verified === 'true') query = query.eq('geo_verified', true);
    if (geo_verified === 'false') query = query.eq('geo_verified', false);
    if (capacity_category) query = query.eq('capacity_category', capacity_category);

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
        // Re-calculate capacity if not yet stored (backward compat with rows created before migration)
        capacity_kw: (p.capacity_kw ?? calcCapacityKw(
          p.equipment?.filter(e => e.equipment_type === 'panel') || [],
          p.equipment?.filter(e => e.equipment_type === 'battery') || []
        )) || null,
        capacity_category: p.capacity_category ?? getCapacityCategory(
          calcCapacityKw(
            p.equipment?.filter(e => e.equipment_type === 'panel') || [],
            p.equipment?.filter(e => e.equipment_type === 'battery') || []
          )
        ),
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
  let createdProjectId = null;
  let coreWriteCommitted = false;
  try {
    const {
      name, client_name, description,
      state, city, address, latitude, longitude,
      installation_date,
      notes,
      status: requestedStatus = 'active',
      panels = [], // array of { brand, model, size_watts, quantity, condition, sourcing_info }
      batteries = [], // array of { brand, model, capacity_kwh, quantity, condition, sourcing_info }
      inverters = [], // array of { brand, model, power_kw, quantity, condition, sourcing_info }
    } = req.body;

    if (!name) return sendError(res, 'Project name is required', 400);
    if (!state) return sendError(res, 'State is required', 400);
    if (!city) return sendError(res, 'City is required', 400);
    if (!installation_date) return sendError(res, 'Installation date is required', 400);
    if (panels.length === 0 && batteries.length === 0) return sendError(res, 'Add at least one panel or battery', 400);

    // Validate requested stage
    const safeStatus = VALID_PROJECT_STATUSES.includes(requestedStatus) ? requestedStatus : 'active';

    // Compute capacity
    const capacityKw = calcCapacityKw(panels, batteries);
    const capacityCategory = getCapacityCategory(capacityKw);

    // Generate QR code data
    const qrData = uuidv4().replace(/-/g, '');

    // Calculate decommission date from degradation algo
    const degradation = await calculateDecommissionDate(state, installation_date);

    // Determine geo verification source
    const { geo_source = 'none', project_photo_url = null } = req.body;
    const validGeoSources = ['image_exif', 'manual', 'device_gps', 'none'];
    const safeGeoSource = validGeoSources.includes(geo_source) ? geo_source : 'none';

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
        status: safeStatus,
        capacity_kw: capacityKw > 0 ? capacityKw : null,
        capacity_category: capacityCategory,
        geo_source: safeGeoSource,
        project_photo_url: project_photo_url || null,
      })
      .select()
      .single();

    if (projectError) throw projectError;
    createdProjectId = project.id;

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
        sourcing_info: panel.sourcing_info || null,
        panel_technology: (panel.panel_technology && PANEL_TECHNOLOGIES[panel.panel_technology]) ? panel.panel_technology : null,
        serial_numbers: normalizeSerialNumbers(panel.serial_numbers),
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
        sourcing_info: battery.sourcing_info || null,
        battery_chemistry: battery.battery_chemistry || null,
        serial_numbers: normalizeSerialNumbers(battery.serial_numbers),
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
        sourcing_info: inverter.sourcing_info || null,
        serial_numbers: normalizeSerialNumbers(inverter.serial_numbers),
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
    const { error: qrUpdateError } = await supabase
      .from('projects')
      .update({ qr_code_url: qrCodeDataUrl })
      .eq('id', project.id);
    if (qrUpdateError) throw qrUpdateError;
    coreWriteCommitted = true;

    // Fetch complete project
    const { data: completeProject } = await supabase
      .from('projects')
      .select('*, equipment(*)')
      .eq('id', project.id)
      .single();

    // Record project creation in history
    createHistoryEntry(project.id, {
      changedBy: req.user.id,
      actorName: `${req.user.first_name || ''} ${req.user.last_name || ''}`.trim() || req.user.email || null,
      projectStage: safeStatus,
      changeType: 'project_created',
      changeSummary: `Project "${name}" created with ${equipmentRecords.length} equipment item(s)`,
    }).catch(() => {});

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
    if (createdProjectId && !coreWriteCommitted) {
      await rollbackCreatedProject(createdProjectId);
    }
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
    validateUUIDParam(id, 'project ID');

    let query = supabase
      .from('projects')
      .select(`
        *,
        equipment(*),
        recovery_requests(*),
        users!projects_user_id_fkey(first_name, last_name, email, avatar_url)
      `)
      .eq('id', id);

    // Scope check — include orphaned projects (created before user had a company)
    if (req.user.company_id) {
      query = query.or(`company_id.eq.${req.user.company_id},and(user_id.eq.${req.user.id},company_id.is.null)`);
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
    const allowedFields = [
      'name',
      'client_name',
      'description',
      'address',
      'city',
      'state',
      'latitude',
      'longitude',
      'geo_source',
      'project_photo_url',
      'notes',
      'status',
      'capacity_kw',
      'capacity_category',
      'actual_decommission_date',
      'recycling_date',
      'recycler_name',
    ];

    const updateData: Record<string, any> = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) updateData[field] = req.body[field];
    }

    // If marking as decommissioned, require an approved pickup request
    if (req.body.status === 'decommissioned') {
      const { data: approvedRequest } = await supabase
        .from('recovery_requests')
        .select('id')
        .eq('project_id', id)
        .eq('decommission_approved', true)
        .limit(1)
        .maybeSingle();
      if (!approvedRequest) {
        return sendError(res, 'A pickup request must be approved by SolNuv before marking a project as decommissioned', 403);
      }
      if (!req.body.actual_decommission_date) {
        updateData.actual_decommission_date = new Date().toISOString().split('T')[0];
      }
    }

    // Sanitise status value if provided
    if (updateData.status && !VALID_PROJECT_STATUSES.includes(updateData.status)) {
      return sendError(res, 'Invalid project status', 400);
    }

    // Fetch old project for history diff
    const { data: oldProject } = await supabase
      .from('projects')
      .select('name, client_name, description, state, city, address, notes, status')
      .eq('id', id)
      .maybeSingle();

    // Build ownership query - match by company_id OR by user_id (for orphaned projects)
    let ownershipQuery = supabase
      .from('projects')
      .update(updateData)
      .eq('id', id);

    if (req.user.company_id) {
      ownershipQuery = ownershipQuery.or(`company_id.eq.${req.user.company_id},and(user_id.eq.${req.user.id},company_id.is.null)`);
    } else {
      ownershipQuery = ownershipQuery.eq('user_id', req.user.id);
    }

    const { data: project, error } = await ownershipQuery.select('*, equipment(*)').single();

    if (error) throw error;

    // Record history (non-blocking)
    if (oldProject) {
      const diff = diffProjectFields(oldProject, updateData);
      if (diff) {
        createHistoryEntry(id, {
          changedBy: req.user.id,
          actorName: `${req.user.first_name || ''} ${req.user.last_name || ''}`.trim() || req.user.email || null,
          projectStage: project.status,
          changeType: 'project_updated',
          changeSummary: diff.changeSummary,
          changedFields: diff.changedFields,
        }).catch(() => {});
      }
    }

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
    const userId = req.user.id;
    const companyId = req.user.company_id;

    // Build ownership query - match by company_id OR by user_id (for orphaned projects created before user had a company)
    let query = supabase
      .from('projects')
      .select('id, name, company_id, user_id')
      .eq('id', id);

    // Match by company_id OR by user_id (orphaned projects)
    if (companyId) {
      // User has a company - can delete projects belonging to:
      // 1. Their company, OR
      // 2. Projects they personally created (company_id is null but user_id matches)
      query = query.or(`company_id.eq.${companyId},and(user_id.eq.${userId},company_id.is.null)`);
    } else {
      // User has no company - can only delete their own projects
      query = query.eq('user_id', userId);
    }

    const { data: existingProject, error: fetchError } = await query.single();

    if (fetchError || !existingProject) {
      return sendError(res, 'Project not found or access denied', 404);
    }

    // Delete the project
    const { error: deleteError } = await supabase
      .from('projects')
      .delete()
      .eq('id', id);

    if (deleteError) throw deleteError;

    logger.info('Project deleted', { 
      projectId: id, 
      projectName: existingProject.name, 
      deletedBy: userId,
      wasOrphaned: existingProject.company_id === null 
    });
    return sendSuccess(res, null, 'Project deleted');
  } catch (_error) {
    logger.error('Failed to delete project', { projectId: req.params.id, error: _error.message });
    return sendError(res, 'Failed to delete project', 500);
  }
};

/**
 * POST /api/projects/:id/geo-verify
 * AI-assisted geolocation verification.
 * Accepts device GPS or manual coordinates, verifies against project address.
 */
exports.geoVerify = async (req, res) => {
  try {
    const { id } = req.params;
    const { latitude, longitude, source, accuracy_m } = req.body;

    if (!latitude || !longitude) return sendError(res, 'latitude and longitude are required', 400);
    const lat = parseFloat(latitude);
    const lon = parseFloat(longitude);
    if (isNaN(lat) || isNaN(lon)) return sendError(res, 'Invalid coordinates', 400);
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return sendError(res, 'Coordinates out of range', 400);

    // Verify ownership — include orphaned projects (created before user had a company)
    let query = supabase.from('projects').select('id, state, city, address, latitude, longitude, geo_source, geo_verified').eq('id', id);
    if (req.user.company_id) {
      query = query.or(`company_id.eq.${req.user.company_id},and(user_id.eq.${req.user.id},company_id.is.null)`);
    } else {
      query = query.eq('user_id', req.user.id);
    }
    const { data: project } = await query.single();
    if (!project) return sendError(res, 'Project not found', 404);

    const projectAddress = {
      state: project.state,
      city: project.city,
      address: project.address,
    };

    // Choose verification method based on source
    const isDeviceGPS = source === 'device_gps';
    const accuracyM = (accuracy_m && !isNaN(parseFloat(accuracy_m))) ? parseFloat(accuracy_m) : null;
    const result = isDeviceGPS
      ? await verifyDeviceGPS(lat, lon, projectAddress, accuracyM)
      : await verifyCoordinatesAgainstAddress(lat, lon, projectAddress);

    const geoSource = isDeviceGPS ? 'device_gps' : (project.geo_source === 'image_exif' ? 'image_exif' : 'manual');

    // Update project with verification results
    const updateData: Record<string, any> = {
      latitude: lat,
      longitude: lon,
      geo_source: geoSource,
      geo_confidence_pct: result.confidence_pct,
      geo_verification_method: result.method,
      geo_verification_details: result.details,
    };

    // Auto-verify if confidence >= 85%
    if (result.verified) {
      updateData.geo_verified = true;
      updateData.geo_verified_at = new Date().toISOString();
      updateData.geo_verified_by = req.user.id;
    }

    const { error: updateError } = await supabase
      .from('projects')
      .update(updateData)
      .eq('id', id);

    if (updateError) throw updateError;

    const safeDistanceM = Number.isFinite(result.distance_m) ? Math.round(result.distance_m) : null;
    const verificationMessage = result.verified
      ? `Location verified with ${result.confidence_pct}% confidence`
      : safeDistanceM !== null
        ? `Verification incomplete — ${result.confidence_pct}% confidence (${safeDistanceM}m from address)`
        : `Verification incomplete — ${result.confidence_pct}% confidence (distance unavailable; retry shortly)`;

    return sendSuccess(res, {
      verified: result.verified,
      confidence_pct: result.confidence_pct,
      distance_m: safeDistanceM,
      method: result.method,
      geo_source: geoSource,
      details: {
        geocoded_address: result.details.geocoded_address,
        geocoded_display: result.details.geocoded_display,
        reverse_display: result.details.reverse_display,
        reverse_zoom: result.details.reverse_zoom ?? null,
        state_match: result.details.state_match,
        city_match: result.details.city_match,
        address_token_score: result.details.address_token_score ?? null,
        address_hint_match: result.details.address_hint_match ?? null,
        used_fallback_geocode: result.details.used_fallback_geocode ?? null,
      },
    }, verificationMessage);
  } catch (err) {
    logger.error('geoVerify error', { message: err.message });
    return sendError(res, 'Geolocation verification failed');
  }
};

/**
 * POST /api/projects/:id/recovery
 * Request recovery for a project
 */
exports.requestRecovery = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      preferred_date,
      pickup_address,
      notes,
      preferred_recycler,
      contact_name,
      contact_phone,
      contact_email,
      requester_company_name,
      project_summary,
    } = req.body;

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
      projectQuery = projectQuery.or(`company_id.eq.${req.user.company_id},and(user_id.eq.${req.user.id},company_id.is.null)`);
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
        preferred_recycler: preferred_recycler || null,
        contact_name: contact_name || null,
        contact_phone: contact_phone || null,
        contact_email: contact_email || null,
        requester_company_name: requester_company_name || null,
        project_summary: project_summary || null,
        status: 'requested',
      })
      .select()
      .single();

    if (error) throw error;

    // Update project status
    await supabase.from('projects').update({ status: 'pending_recovery' }).eq('id', id);

    // Notify confirmations
    const { sendRecoveryConfirmation, notifyAdminOfPickupRequest } = require('../services/notificationService');
    sendRecoveryConfirmation(req.user, project, recovery).catch(console.error);
    notifyAdminOfPickupRequest(project, recovery).catch(console.error);

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
      .select(`
        id,
        user_id,
        company_id,
        name,
        client_name,
        description,
        state,
        city,
        address,
        latitude,
        longitude,
        status,
        installation_date,
        estimated_decommission_date,
        actual_decommission_date,
        recycling_date,
        total_system_size_kw,
        created_at,
        geo_source,
        geo_verified,
        geo_verified_at,
        project_photo_url,
        equipment(
          equipment_type,
          brand,
          model,
          size_watts,
          capacity_kwh,
          power_kw,
          quantity,
          condition
        )
      `)
      .eq('qr_code_data', qrCode)
      .single();

    if (!project) return sendError(res, 'Project not found', 404);

    let companyMeta = null;
    if (project.company_id) {
      const { data: company } = await supabase
        .from('companies')
        .select('id, name, email, phone, address, city, state, logo_url, website, nesrea_registration_number')
        .eq('id', project.company_id)
        .maybeSingle();
      companyMeta = company || null;
    }

    const { data: owner } = await supabase
      .from('users')
      .select('id, first_name, last_name, brand_name, email, phone')
      .eq('id', project.user_id)
      .maybeSingle();

    const equipment = project.equipment || [];
    const panels = equipment.filter((item) => item.equipment_type === 'panel');
    const batteries = equipment.filter((item) => item.equipment_type === 'battery');
    const inverters = equipment.filter((item) => item.equipment_type === 'inverter');

    const panelQuantity = panels.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const batteryQuantity = batteries.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const inverterQuantity = inverters.reduce((sum, item) => sum + Number(item.quantity || 0), 0);

    const panelCapacityKw = panels.reduce(
      (sum, item) => sum + ((Number(item.size_watts || 0) * Number(item.quantity || 0)) / 1000),
      0
    );
    const inverterCapacityKw = inverters.reduce(
      (sum, item) => sum + (Number(item.power_kw || 0) * Number(item.quantity || 0)),
      0
    );
    const batteryCapacityKwh = batteries.reduce(
      (sum, item) => sum + (Number(item.capacity_kwh || 0) * Number(item.quantity || 0)),
      0
    );

    const inferredCapacityKw = Number(project.total_system_size_kw || 0) || panelCapacityKw || inverterCapacityKw;

    const uniqueManufacturers = {
      panel: [...new Set(panels.map((item) => item.brand).filter(Boolean))],
      battery: [...new Set(batteries.map((item) => item.brand).filter(Boolean))],
      inverter: [...new Set(inverters.map((item) => item.brand).filter(Boolean))],
    };

    const brandName = companyMeta?.name || owner?.brand_name || `${owner?.first_name || ''} ${owner?.last_name || ''}`.trim();
    const brandEmail = companyMeta?.email || owner?.email || null;
    const brandPhone = companyMeta?.phone || owner?.phone || null;
    const brandAddress = companyMeta?.address
      || [companyMeta?.city, companyMeta?.state].filter(Boolean).join(', ')
      || null;

    // Fetch project history for appendix
    const { data: historyRows } = await supabase
      .from('project_history')
      .select('id, change_type, change_summary, project_stage, changed_fields, actor_name, created_at')
      .eq('project_id', project.id)
      .order('created_at', { ascending: true });

    return sendSuccess(res, {
      brand: {
        name: brandName || 'SolNuv Verified Installer',
        logo_url: companyMeta?.logo_url || null,
        website: companyMeta?.website || null,
        registration: companyMeta?.nesrea_registration_number || null,
        contact: {
          phone: brandPhone,
          email: brandEmail,
          address: brandAddress,
        },
      },
      project: {
        id: project.id,
        name: project.name,
        client_name: project.client_name,
        description: project.description,
        status: project.status,
        location: `${project.city}, ${project.state}`,
        state: project.state,
        city: project.city,
        address: project.address,
        latitude: project.latitude,
        longitude: project.longitude,
        commissioning_date: project.installation_date,
        logging_date: project.created_at,
        estimated_decommission_date: project.estimated_decommission_date,
        actual_decommission_date: project.actual_decommission_date,
        recycling_date: project.recycling_date,
      },
      summary: {
        total_project_capacity_mw: Number((inferredCapacityKw / 1000).toFixed(4)),
        total_project_capacity_kw: Number(inferredCapacityKw.toFixed(2)),
        battery_storage_capacity_mwh: Number((batteryCapacityKwh / 1000).toFixed(4)),
        battery_storage_capacity_kwh: Number(batteryCapacityKwh.toFixed(2)),
        total_panels: panelQuantity,
        total_batteries: batteryQuantity,
        total_inverters: inverterQuantity,
      },
      equipment_breakdown: {
        panel: panels,
        battery: batteries,
        inverter: inverters,
      },
      manufacturers: uniqueManufacturers,
      verification_status: project.geo_verified
        ? 'Verified'
        : project.geo_source === 'image_exif'
          ? 'Authenticated'
          : 'Unverified',
      geo_source: project.geo_source || 'none',
      geo_verified: project.geo_verified || false,
      geo_verified_at: project.geo_verified_at || null,
      project_photo_url: project.project_photo_url || null,
      verified_by: project.geo_verified ? 'SolNuv Admin' : 'SolNuv Platform',
      verified_at: project.geo_verified_at || new Date().toISOString(),
      history: (historyRows || []).map(h => ({
        id: h.id,
        change_type: h.change_type,
        change_summary: h.change_summary,
        project_stage: h.project_stage,
        changed_fields: h.changed_fields,
        actor_name: h.actor_name,
        created_at: h.created_at,
      })),
    });
  } catch (_error) {
    return sendError(res, 'Verification failed', 500);
  }
};

// ---------------------------------------------------------------------------
// Equipment CRUD (only in draft / maintenance stages)
// ---------------------------------------------------------------------------

/**
 * POST /api/projects/:id/equipment
 * Add a new equipment item to an existing project.
 * Only allowed while project status is draft or maintenance.
 */
exports.addEquipment = async (req, res) => {
  try {
    const { id } = req.params;
    const { equipment_type, brand, model, size_watts, capacity_kwh, power_kw, quantity, condition, sourcing_info, panel_technology, battery_chemistry, serial_numbers } = req.body;

    if (!equipment_type || !['panel', 'battery', 'inverter'].includes(equipment_type)) {
      return sendError(res, 'equipment_type must be panel, battery, or inverter', 400);
    }
    if (!brand) return sendError(res, 'brand is required', 400);
    if (!quantity || Number(quantity) < 1) return sendError(res, 'quantity must be at least 1', 400);

    // Fetch project and check ownership + stage
    let projectQuery = supabase.from('projects').select('id, status, state, installation_date, user_id, company_id').eq('id', id);
    if (req.user.company_id) {
      projectQuery = projectQuery.or(`company_id.eq.${req.user.company_id},and(user_id.eq.${req.user.id},company_id.is.null)`);
    } else {
      projectQuery = projectQuery.eq('user_id', req.user.id);
    }
    const { data: project } = await projectQuery.maybeSingle();
    if (!project) return sendError(res, 'Project not found', 404);
    if (!EDITABLE_STAGES.includes(project.status)) {
      return sendError(res, `Equipment can only be added when project is in draft or maintenance stage (current: ${project.status})`, 403);
    }

    const record: Record<string, any> = {
      project_id: id,
      equipment_type,
      brand,
      model: model || null,
      quantity: Number(quantity),
      condition: condition || 'good',
      sourcing_info: sourcing_info || null,
      serial_numbers: normalizeSerialNumbers(serial_numbers),
    };

    if (equipment_type === 'panel') {
      if (!size_watts) return sendError(res, 'size_watts is required for panels', 400);
      record.size_watts = Number(size_watts);
      record.total_panels_wattage = Number(size_watts) * Number(quantity);
      const validTech = (panel_technology && PANEL_TECHNOLOGIES[panel_technology]) ? panel_technology : null;
      const degradation = await calculateDecommissionDate(project.state, project.installation_date, null, validTech);
      const silverCalc = await calculatePanelSilver(size_watts, quantity, brand);
      record.estimated_silver_grams = silverCalc.total_silver_grams;
      record.estimated_silver_value_ngn = silverCalc.recovery_value_expected_ngn;
      record.adjusted_failure_date = degradation.adjusted_failure_date;
      record.climate_zone = degradation.climate_zone;
      record.degradation_factor = degradation.degradation_factor;
      record.panel_technology = validTech;
    } else if (equipment_type === 'battery') {
      if (capacity_kwh) record.capacity_kwh = Number(capacity_kwh);
      record.battery_chemistry = battery_chemistry || null;
    } else if (equipment_type === 'inverter') {
      if (power_kw) record.size_watts = Number(power_kw) * 1000;
    }

    const { data: newEquipment, error } = await supabase.from('equipment').insert(record).select().single();
    if (error) throw error;

    // Update project capacity
    const { data: allEquip } = await supabase.from('equipment').select('equipment_type, size_watts, capacity_kwh, quantity').eq('project_id', id);
    const newCapacityKw = calcCapacityKw(
      (allEquip || []).filter(e => e.equipment_type === 'panel'),
      (allEquip || []).filter(e => e.equipment_type === 'battery')
    );
    await supabase.from('projects').update({ capacity_kw: newCapacityKw || null, capacity_category: getCapacityCategory(newCapacityKw) }).eq('id', id);

    createHistoryEntry(id, {
      changedBy: req.user.id,
      actorName: `${req.user.first_name || ''} ${req.user.last_name || ''}`.trim() || req.user.email || null,
      projectStage: project.status,
      changeType: 'equipment_added',
      changeSummary: `Added ${quantity}× ${brand}${model ? ' ' + model : ''} ${equipment_type}`,
      changedFields: { equipment_type, brand, model, quantity: Number(quantity) },
    }).catch(() => {});

    return sendSuccess(res, newEquipment, 'Equipment added', 201);
  } catch (err) {
    logger.error('addEquipment error', { message: err.message });
    return sendError(res, err.message || 'Failed to add equipment', 500);
  }
};

/**
 * PUT /api/projects/:id/equipment/:equipmentId
 * Update an existing equipment item.
 * Only allowed while project status is draft or maintenance.
 */
exports.updateEquipment = async (req, res) => {
  try {
    const { id, equipmentId } = req.params;
    const { brand, model, size_watts, capacity_kwh, power_kw, quantity, condition, sourcing_info, panel_technology, battery_chemistry, serial_numbers } = req.body;

    let projectQuery = supabase.from('projects').select('id, status, state, installation_date, user_id, company_id').eq('id', id);
    if (req.user.company_id) {
      projectQuery = projectQuery.or(`company_id.eq.${req.user.company_id},and(user_id.eq.${req.user.id},company_id.is.null)`);
    } else {
      projectQuery = projectQuery.eq('user_id', req.user.id);
    }
    const { data: project } = await projectQuery.maybeSingle();
    if (!project) return sendError(res, 'Project not found', 404);
    if (!EDITABLE_STAGES.includes(project.status)) {
      return sendError(res, `Equipment can only be edited when project is in draft or maintenance stage (current: ${project.status})`, 403);
    }

    const { data: existing } = await supabase.from('equipment').select('*').eq('id', equipmentId).eq('project_id', id).maybeSingle();
    if (!existing) return sendError(res, 'Equipment not found', 404);

    const updateData: Record<string, any> = {};
    if (brand !== undefined) updateData.brand = brand;
    if (model !== undefined) updateData.model = model || null;
    if (quantity !== undefined) updateData.quantity = Number(quantity);
    if (condition !== undefined) updateData.condition = condition;
    if (sourcing_info !== undefined) updateData.sourcing_info = sourcing_info || null;
    if (serial_numbers !== undefined) updateData.serial_numbers = normalizeSerialNumbers(serial_numbers);

    if (existing.equipment_type === 'panel') {
      if (size_watts !== undefined) {
        updateData.size_watts = Number(size_watts);
        const qty = updateData.quantity ?? existing.quantity;
        updateData.total_panels_wattage = Number(size_watts) * qty;
        const silverCalc = await calculatePanelSilver(size_watts, qty, updateData.brand || existing.brand);
        updateData.estimated_silver_grams = silverCalc.total_silver_grams;
        updateData.estimated_silver_value_ngn = silverCalc.recovery_value_expected_ngn;
      }
      if (panel_technology !== undefined) {
        updateData.panel_technology = (panel_technology && PANEL_TECHNOLOGIES[panel_technology]) ? panel_technology : null;
      }
    } else if (existing.equipment_type === 'battery') {
      if (capacity_kwh !== undefined) updateData.capacity_kwh = capacity_kwh ? Number(capacity_kwh) : null;
      if (battery_chemistry !== undefined) updateData.battery_chemistry = battery_chemistry || null;
    } else if (existing.equipment_type === 'inverter') {
      if (power_kw !== undefined) updateData.size_watts = power_kw ? Number(power_kw) * 1000 : null;
    }

    const { data: updated, error } = await supabase.from('equipment').update(updateData).eq('id', equipmentId).select().single();
    if (error) throw error;

    // Update project capacity
    const { data: allEquip } = await supabase.from('equipment').select('equipment_type, size_watts, capacity_kwh, quantity').eq('project_id', id);
    const newCapacityKw = calcCapacityKw(
      (allEquip || []).filter(e => e.equipment_type === 'panel'),
      (allEquip || []).filter(e => e.equipment_type === 'battery')
    );
    await supabase.from('projects').update({ capacity_kw: newCapacityKw || null, capacity_category: getCapacityCategory(newCapacityKw) }).eq('id', id);

    // Build change summary
    const changedKeys = Object.keys(updateData);
    createHistoryEntry(id, {
      changedBy: req.user.id,
      actorName: `${req.user.first_name || ''} ${req.user.last_name || ''}`.trim() || req.user.email || null,
      projectStage: project.status,
      changeType: 'equipment_updated',
      changeSummary: `Updated ${existing.equipment_type} (${existing.brand}${existing.model ? ' ' + existing.model : ''}): ${changedKeys.filter(k => !['total_panels_wattage','estimated_silver_grams','estimated_silver_value_ngn'].includes(k)).join(', ')}`,
      changedFields: updateData,
    }).catch(() => {});

    return sendSuccess(res, updated, 'Equipment updated');
  } catch (err) {
    logger.error('updateEquipment error', { message: err.message });
    return sendError(res, err.message || 'Failed to update equipment', 500);
  }
};

/**
 * DELETE /api/projects/:id/equipment/:equipmentId
 * Remove an equipment item.
 * Only allowed while project status is draft or maintenance.
 */
exports.deleteEquipment = async (req, res) => {
  try {
    const { id, equipmentId } = req.params;

    let projectQuery = supabase.from('projects').select('id, status, user_id, company_id').eq('id', id);
    if (req.user.company_id) {
      projectQuery = projectQuery.or(`company_id.eq.${req.user.company_id},and(user_id.eq.${req.user.id},company_id.is.null)`);
    } else {
      projectQuery = projectQuery.eq('user_id', req.user.id);
    }
    const { data: project } = await projectQuery.maybeSingle();
    if (!project) return sendError(res, 'Project not found', 404);
    if (!EDITABLE_STAGES.includes(project.status)) {
      return sendError(res, `Equipment can only be removed when project is in draft or maintenance stage (current: ${project.status})`, 403);
    }

    const { data: existing } = await supabase.from('equipment').select('equipment_type, brand, model, quantity').eq('id', equipmentId).eq('project_id', id).maybeSingle();
    if (!existing) return sendError(res, 'Equipment not found', 404);

    const { error } = await supabase.from('equipment').delete().eq('id', equipmentId);
    if (error) throw error;

    // Update project capacity
    const { data: allEquip } = await supabase.from('equipment').select('equipment_type, size_watts, capacity_kwh, quantity').eq('project_id', id);
    const newCapacityKw = calcCapacityKw(
      (allEquip || []).filter(e => e.equipment_type === 'panel'),
      (allEquip || []).filter(e => e.equipment_type === 'battery')
    );
    await supabase.from('projects').update({ capacity_kw: newCapacityKw || null, capacity_category: getCapacityCategory(newCapacityKw) }).eq('id', id);

    createHistoryEntry(id, {
      changedBy: req.user.id,
      actorName: `${req.user.first_name || ''} ${req.user.last_name || ''}`.trim() || req.user.email || null,
      projectStage: project.status,
      changeType: 'equipment_removed',
      changeSummary: `Removed ${existing.quantity}× ${existing.brand}${existing.model ? ' ' + existing.model : ''} ${existing.equipment_type}`,
    }).catch(() => {});

    return sendSuccess(res, null, 'Equipment removed');
  } catch (err) {
    logger.error('deleteEquipment error', { message: err.message });
    return sendError(res, err.message || 'Failed to remove equipment', 500);
  }
};

/**
 * GET /api/projects/:id/history
 * Return project change history (owner/company only).
 */
exports.getProjectHistory = async (req, res) => {
  try {
    const { id } = req.params;

    let projectQuery = supabase.from('projects').select('id, user_id, company_id').eq('id', id);
    if (req.user.company_id) {
      projectQuery = projectQuery.or(`company_id.eq.${req.user.company_id},and(user_id.eq.${req.user.id},company_id.is.null)`);
    } else {
      projectQuery = projectQuery.eq('user_id', req.user.id);
    }
    const { data: project } = await projectQuery.maybeSingle();
    if (!project) return sendError(res, 'Project not found', 404);

    const { data: rows, error } = await supabase
      .from('project_history')
      .select('*')
      .eq('project_id', id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return sendSuccess(res, rows || []);
  } catch (err) {
    return sendError(res, 'Failed to fetch history', 500);
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
      query = query.or(`company_id.eq.${req.user.company_id},and(user_id.eq.${req.user.id},company_id.is.null)`);
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
    const writeToken = signBatteryLedgerWriteToken(qrCode);

    return sendSuccess(res, {
      asset,
      latest_log: latest,
      logs: logs || [],
      field_actions: {
        can_submit_log: true,
      },
      write_auth: writeToken ? {
        token: writeToken,
        expires_in_seconds: 15 * 60,
      } : null,
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
    if (technician_name && String(technician_name).trim().length > 120) {
      return sendError(res, 'technician_name is too long', 400);
    }
    if (notes && String(notes).trim().length > 1200) {
      return sendError(res, 'notes is too long', 400);
    }

    // Anonymous field submissions must include a short-lived QR write token.
    if (!req.user?.id) {
      const writeToken = req.headers['x-battery-log-token'] || req.body?.write_token;
      const validToken = verifyBatteryLedgerWriteToken(writeToken, qrCode);
      if (!validToken) {
        return sendError(res, 'Valid battery log authorization token is required', 401);
      }
    }

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

