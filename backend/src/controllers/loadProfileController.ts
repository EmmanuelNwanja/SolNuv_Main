/**
 * SolNuv Load Profile Controller
 * Upload, manual entry, and synthetic generation of load profiles.
 */

const supabase = require('../config/database');
const { sendSuccess, sendError } = require('../utils/responseHelper');
const { parseCSV, parseExcel, distributeMonthlyToHourly, generateSyntheticProfile, calculateProfileStats } = require('../services/loadProfileService');
const logger = require('../utils/logger');

/**
 * Verify that the authenticated user owns the project.
 * Supports both company-scoped and solo-engineer (user_id) scoped access.
 */
async function verifyProjectOwnership(projectId, user) {
  let query = supabase
    .from('projects')
    .select('id, company_id, user_id')
    .eq('id', projectId);

  if (user.company_id) {
    query = query.eq('company_id', user.company_id);
  } else {
    query = query.eq('user_id', user.id);
  }

  const { data } = await query.single();
  return data;
}

/**
 * POST /api/load-profiles/upload
 * Upload CSV/Excel load profile data.
 */
exports.uploadProfile = async (req, res) => {
  try {
    const { project_id } = req.body;
    if (!project_id) return sendError(res, 'project_id is required', 400);
    if (!req.file) return sendError(res, 'File is required', 400);

    // Verify project ownership
    const project = await verifyProjectOwnership(project_id, req.user);
    if (!project) return sendError(res, 'Project not found or access denied', 404);

    // Parse file
    let parseResult;
    const ext = req.file.originalname?.toLowerCase() || '';

    if (ext.endsWith('.csv') || ext.endsWith('.txt')) {
      parseResult = parseCSV(req.file.buffer.toString('utf-8'));
    } else if (ext.endsWith('.xlsx') || ext.endsWith('.xls')) {
      parseResult = await parseExcel(req.file.buffer);
    } else {
      return sendError(res, 'Unsupported file format. Use CSV or Excel.', 400);
    }

    if (!parseResult.hourlyKw || parseResult.hourlyKw.length === 0) {
      return sendError(res, 'Could not parse load data from file', 400);
    }

    const stats = calculateProfileStats(parseResult.hourlyKw);

    // Delete existing profile for this project
    const { data: existing } = await supabase
      .from('load_profiles')
      .select('id')
      .eq('project_id', project_id);
    if (existing?.length > 0) {
      await supabase.from('load_profiles').delete().eq('project_id', project_id);
    }

    // Create profile
    const { data: profile, error: profileErr } = await supabase
      .from('load_profiles')
      .insert({
        project_id,
        source_type: 'upload',
        data_interval_minutes: parseResult.interval,
        annual_consumption_kwh: stats.annualKwh,
        peak_demand_kw: stats.peakKw,
        load_factor: stats.loadFactor,
        confirmed_by_user: true,
      })
      .select()
      .single();

    if (profileErr) throw profileErr;

    // Store hourly data
    await supabase.from('load_profile_data').insert({
      load_profile_id: profile.id,
      year: 1,
      hourly_kw: parseResult.hourlyKw,
    });

    // Update design reference
    await supabase
      .from('project_designs')
      .update({ load_profile_id: profile.id })
      .eq('project_id', project_id);

    return sendSuccess(res, {
      profile_id: profile.id,
      stats,
      warnings: parseResult.errors,
    }, 'Load profile uploaded', 201);
  } catch (err) {
    logger.error('uploadProfile error', { message: err.message });
    return sendError(res, 'Failed to upload load profile');
  }
};

/**
 * POST /api/load-profiles/manual
 * Create profile from 12 monthly kWh values.
 */
exports.manualEntry = async (req, res) => {
  try {
    const { project_id, monthly_kwh, peak_kw, business_type } = req.body;
    if (!project_id) return sendError(res, 'project_id is required', 400);
    if (!monthly_kwh || !Array.isArray(monthly_kwh) || monthly_kwh.length !== 12) {
      return sendError(res, 'monthly_kwh must be an array of 12 values', 400);
    }

    const project = await verifyProjectOwnership(project_id, req.user);
    if (!project) return sendError(res, 'Project not found or access denied', 404);

    const hourlyKw = distributeMonthlyToHourly(
      monthly_kwh.map(v => Number(v) || 0),
      Number(peak_kw) || 0,
      business_type || 'office'
    );
    const stats = calculateProfileStats(hourlyKw);

    // Replace existing profile
    await supabase.from('load_profiles').delete().eq('project_id', project_id);

    const { data: profile, error: profileErr } = await supabase
      .from('load_profiles')
      .insert({
        project_id,
        source_type: 'manual',
        data_interval_minutes: 60,
        annual_consumption_kwh: stats.annualKwh,
        peak_demand_kw: stats.peakKw,
        load_factor: stats.loadFactor,
        business_type: business_type || null,
        confirmed_by_user: true,
      })
      .select()
      .single();

    if (profileErr) throw profileErr;

    await supabase.from('load_profile_data').insert({
      load_profile_id: profile.id,
      year: 1,
      hourly_kw: hourlyKw,
    });

    await supabase
      .from('project_designs')
      .update({ load_profile_id: profile.id })
      .eq('project_id', project_id);

    return sendSuccess(res, { profile_id: profile.id, stats }, 'Load profile created', 201);
  } catch (err) {
    logger.error('manualEntry error', { message: err.message });
    return sendError(res, 'Failed to create load profile');
  }
};

/**
 * POST /api/load-profiles/synthetic
 * Generate synthetic profile for user confirmation.
 */
exports.generateSynthetic = async (req, res) => {
  try {
    const { project_id, business_type, annual_kwh, peak_kw, country, priority_mode } = req.body;
    if (!project_id) return sendError(res, 'project_id is required', 400);
    if (!annual_kwh) return sendError(res, 'annual_kwh is required', 400);

    const project = await verifyProjectOwnership(project_id, req.user);
    if (!project) return sendError(res, 'Project not found or access denied', 404);

    const synthetic = generateSyntheticProfile({
      businessType: business_type || 'office',
      annualKwh: Number(annual_kwh),
      peakKw: Number(peak_kw) || 0,
      country: country || 'NG',
      priorityMode: String(priority_mode || 'annual').toLowerCase() === 'peak' ? 'peak' : 'annual',
    });

    const hourlyKw = synthetic.hourlyKw || [];
    const stats = calculateProfileStats(hourlyKw);

    // Return preview — user must confirm before saving
    return sendSuccess(res, {
      preview: true,
      stats,
      business_type: business_type || 'office',
      priority_mode: synthetic.priorityMode,
      warnings: synthetic.warnings || [],
      requested_peak_kw: synthetic.requestedPeakKw || 0,
      achieved_peak_kw: synthetic.achievedPeakKw || stats.peakKw,
      achieved_annual_kwh: synthetic.achievedAnnualKwh || stats.annualKwh,
      // Return hourly summary (monthly breakdown) rather than full 8760 array
      monthly_kwh: stats.monthlyKwh,
    }, 'Synthetic profile generated — confirm to save');
  } catch (err) {
    logger.error('generateSynthetic error', { message: err.message });
    return sendError(res, 'Failed to generate synthetic profile');
  }
};

/**
 * POST /api/load-profiles/synthetic/confirm
 * Confirm and save a synthetic profile.
 */
exports.confirmSynthetic = async (req, res) => {
  try {
    const { project_id, business_type, annual_kwh, peak_kw, country, priority_mode } = req.body;
    if (!project_id) return sendError(res, 'project_id is required', 400);

    const project = await verifyProjectOwnership(project_id, req.user);
    if (!project) return sendError(res, 'Project not found or access denied', 404);

    const synthetic = generateSyntheticProfile({
      businessType: business_type || 'office',
      annualKwh: Number(annual_kwh),
      peakKw: Number(peak_kw) || 0,
      country: country || 'NG',
      priorityMode: String(priority_mode || 'annual').toLowerCase() === 'peak' ? 'peak' : 'annual',
    });
    const hourlyKw = synthetic.hourlyKw || [];
    const stats = calculateProfileStats(hourlyKw);

    await supabase.from('load_profiles').delete().eq('project_id', project_id);

    const { data: profile, error: profileErr } = await supabase
      .from('load_profiles')
      .insert({
        project_id,
        source_type: 'synthetic',
        data_interval_minutes: 60,
        annual_consumption_kwh: stats.annualKwh,
        peak_demand_kw: stats.peakKw,
        load_factor: stats.loadFactor,
        business_type: business_type || null,
        synthetic_priority_mode: synthetic.priorityMode || 'annual',
        synthetic_requested_peak_kw: synthetic.requestedPeakKw || Number(peak_kw) || 0,
        synthetic_achieved_peak_kw: synthetic.achievedPeakKw || stats.peakKw,
        synthetic_requested_annual_kwh: Number(annual_kwh) || 0,
        synthetic_achieved_annual_kwh: synthetic.achievedAnnualKwh || stats.annualKwh,
        synthetic_warnings: synthetic.warnings?.length ? synthetic.warnings : null,
        confirmed_by_user: true,
      })
      .select()
      .single();

    if (profileErr) throw profileErr;

    await supabase.from('load_profile_data').insert({
      load_profile_id: profile.id,
      year: 1,
      hourly_kw: hourlyKw,
    });

    await supabase
      .from('project_designs')
      .update({ load_profile_id: profile.id })
      .eq('project_id', project_id);

    return sendSuccess(res, {
      profile_id: profile.id,
      stats,
      priority_mode: synthetic.priorityMode,
      warnings: synthetic.warnings || [],
      requested_peak_kw: synthetic.requestedPeakKw || 0,
      achieved_peak_kw: synthetic.achievedPeakKw || stats.peakKw,
      achieved_annual_kwh: synthetic.achievedAnnualKwh || stats.annualKwh,
    }, 'Synthetic profile saved', 201);
  } catch (err) {
    logger.error('confirmSynthetic error', { message: err.message });
    return sendError(res, 'Failed to save synthetic profile');
  }
};

/**
 * GET /api/load-profiles/:projectId
 * Get project's active load profile with summary stats.
 */
exports.getProfile = async (req, res) => {
  try {
    const { projectId } = req.params;

    const project = await verifyProjectOwnership(projectId, req.user);
    if (!project) return sendError(res, 'Project not found', 404);

    const { data: profile } = await supabase
      .from('load_profiles')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!profile) return sendError(res, 'No load profile found', 404);

    return sendSuccess(res, profile, 'Load profile retrieved');
  } catch (err) {
    logger.error('getProfile error', { message: err.message });
    return sendError(res, 'Failed to retrieve load profile');
  }
};

/**
 * GET /api/load-profiles/:projectId/hourly
 * Get hourly load data for charting.
 */
exports.getHourlyData = async (req, res) => {
  try {
    const { projectId } = req.params;

    const project = await verifyProjectOwnership(projectId, req.user);
    if (!project) return sendError(res, 'Project not found', 404);

    const { data: profile } = await supabase
      .from('load_profiles')
      .select('id')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!profile) return sendError(res, 'No load profile found', 404);

    const { data: profileData } = await supabase
      .from('load_profile_data')
      .select('hourly_kw, hourly_kva')
      .eq('load_profile_id', profile.id)
      .single();

    if (!profileData) return sendError(res, 'No hourly data', 404);

    return sendSuccess(res, profileData, 'Hourly data retrieved');
  } catch (err) {
    logger.error('getHourlyData error', { message: err.message });
    return sendError(res, 'Failed to retrieve hourly data');
  }
};
