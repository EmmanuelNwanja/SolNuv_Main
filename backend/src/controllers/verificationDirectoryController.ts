const supabase = require('../config/database');
const { sendSuccess, sendError } = require('../utils/responseHelper');
const logger = require('../utils/logger');
const ExcelJS = require('exceljs');

function normalizeName(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function parseCsv(buffer) {
  const text = buffer.toString('utf8');
  const rows = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!rows.length) return [];
  const header = rows[0].split(',').map((h) => normalizeName(h));
  const firstNameIdx = header.findIndex((h) => h.includes('first'));
  const lastNameIdx = header.findIndex((h) => h.includes('last'));
  const emailIdx = header.findIndex((h) => h.includes('email'));

  return rows.slice(1).map((line) => {
    const cols = line.split(',').map((c) => String(c || '').trim());
    return {
      first_name: cols[firstNameIdx] || '',
      last_name: cols[lastNameIdx] || '',
      email: cols[emailIdx] || '',
    };
  }).filter((row) => row.first_name || row.last_name || row.email);
}

async function parseXlsx(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];
  const headerRow = sheet.getRow(1).values || [];
  const headers = Array.isArray(headerRow)
    ? headerRow.map((h) => normalizeName(typeof h === 'object' ? h?.text : h))
    : [];
  const firstNameIdx = headers.findIndex((h) => h.includes('first'));
  const lastNameIdx = headers.findIndex((h) => h.includes('last'));
  const emailIdx = headers.findIndex((h) => h.includes('email'));

  const rows = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const vals = row.values || [];
    const getCell = (idx) => {
      if (idx < 0) return '';
      const value = Array.isArray(vals) ? vals[idx + 1] : '';
      if (value && typeof value === 'object' && value.text) return String(value.text);
      return String(value || '').trim();
    };
    const item = {
      first_name: getCell(firstNameIdx),
      last_name: getCell(lastNameIdx),
      email: getCell(emailIdx),
    };
    if (item.first_name || item.last_name || item.email) rows.push(item);
  });
  return rows;
}

async function membershipsForUser(userId) {
  const { data, error } = await supabase
    .from('v2_org_memberships')
    .select('role_code, v2_organizations(id, name, organization_type)')
    .eq('user_id', userId);
  if (error) return [];
  return (data || []).filter((row) => row.v2_organizations);
}

function pickTrainingOrg(memberships) {
  return memberships.find((m) => String(m.v2_organizations?.organization_type || '') === 'training_institute');
}

async function createAudit(verificationRequestId, actorUserId, actorRole, action, payload = {}) {
  await supabase.from('competency_verification_audits').insert({
    verification_request_id: verificationRequestId,
    actor_user_id: actorUserId || null,
    actor_role: actorRole || null,
    action,
    payload,
  });
}

exports.searchProfessionals = async (req, res) => {
  try {
    const q = normalizeName(req.query?.q || '');
    const limit = Math.min(50, Math.max(1, Number(req.query?.limit || 20)));
    if (q.length < 2) return sendSuccess(res, { results: [] });

    const [first, ...rest] = q.split(' ');
    const last = rest.join(' ');
    let query = supabase
      .from('users')
      .select('id, first_name, last_name, email, user_type, verification_status, competency_verification_status, public_profile_slug')
      .order('first_name', { ascending: true })
      .limit(limit);

    if (last) {
      query = query.ilike('first_name', `%${first}%`).ilike('last_name', `%${last}%`);
    } else {
      query = query.or(`first_name.ilike.%${q}%,last_name.ilike.%${q}%,email.ilike.%${q}%`);
    }

    const { data, error } = await query;
    if (error) throw error;

    return sendSuccess(res, {
      results: (data || []).map((u) => ({
        id: u.id,
        first_name: u.first_name,
        last_name: u.last_name,
        full_name: [u.first_name, u.last_name].filter(Boolean).join(' '),
        email: u.email,
        user_type: u.user_type,
        verification_status: u.verification_status || 'unverified',
        professional_status: u.competency_verification_status || 'unverified',
        public_profile_slug: u.public_profile_slug || null,
      })),
    });
  } catch (error) {
    logger.error('verificationDirectory:searchProfessionals failed', { message: error.message });
    return sendError(res, 'Failed to search professionals', 500);
  }
};

exports.searchCompanies = async (req, res) => {
  try {
    const q = normalizeName(req.query?.q || '');
    const limit = Math.min(50, Math.max(1, Number(req.query?.limit || 20)));
    if (q.length < 2) return sendSuccess(res, { results: [] });

    const { data, error } = await supabase
      .from('companies')
      .select('id, name, email, phone, registration_number, website, verified_at')
      .or(`name.ilike.%${q}%,email.ilike.%${q}%`)
      .order('name', { ascending: true })
      .limit(limit);
    if (error) throw error;

    return sendSuccess(res, {
      results: (data || []).map((c) => ({
        id: c.id,
        name: c.name,
        email: c.email,
        phone: c.phone,
        registration_number: c.registration_number,
        website: c.website,
        professional_status: c.verified_at ? 'verified_professional' : 'unverified_professional',
      })),
    });
  } catch (error) {
    logger.error('verificationDirectory:searchCompanies failed', { message: error.message });
    return sendError(res, 'Failed to search companies', 500);
  }
};

exports.listTrainingInstitutes = async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from('v2_organizations')
      .select('id, name, organization_type, jurisdiction, metadata')
      .eq('organization_type', 'training_institute')
      .order('name', { ascending: true });
    if (error) throw error;
    return sendSuccess(res, { institutes: data || [] });
  } catch (error) {
    logger.error('verificationDirectory:listTrainingInstitutes failed', { message: error.message });
    return sendError(res, 'Failed to load training institutes', 500);
  }
};

exports.submitCompetencyVerificationRequest = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return sendError(res, 'Unauthorized', 401);
    const {
      organization_id,
      training_institute_name,
      training_institute_email,
      training_institute_phone,
      training_institute_country,
      training_institute_state,
      training_institute_address,
      training_date,
    } = req.body || {};

    const payload = {
      request_code: `CVR-${Date.now()}`,
      requested_by_user_id: userId,
      target_user_id: userId,
      organization_id: organization_id || null,
      source_mode: organization_id ? 'manual' : 'user_submit_other',
      match_confidence: 0,
      match_signals: {},
      status: 'pending',
      requested_training_institute_name: training_institute_name || null,
      requested_training_institute_email: training_institute_email || null,
      requested_training_institute_phone: training_institute_phone || null,
      requested_training_institute_country: training_institute_country || null,
      requested_training_institute_state: training_institute_state || null,
      requested_training_institute_address: training_institute_address || null,
      requested_training_date: training_date || null,
    };

    const { data, error } = await supabase
      .from('competency_verification_requests')
      .insert(payload)
      .select('*')
      .single();
    if (error) throw error;

    await createAudit(data.id, userId, 'user', 'request_submitted', payload);
    return sendSuccess(res, data, 'Verification request submitted', 201);
  } catch (error) {
    logger.error('verificationDirectory:submitCompetencyVerificationRequest failed', { message: error.message });
    return sendError(res, 'Failed to submit request', 500);
  }
};

exports.importGraduates = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return sendError(res, 'Unauthorized', 401);
    const memberships = await membershipsForUser(userId);
    const trainingMembership = pickTrainingOrg(memberships);
    if (!trainingMembership) return sendError(res, 'Training institute access required', 403);

    if (!req.file?.buffer) return sendError(res, 'Upload file required', 400);
    const fileName = String(req.file.originalname || 'graduates.csv');
    const ext = fileName.toLowerCase().endsWith('.xlsx') ? 'xlsx' : 'csv';

    const { data: batch, error: batchError } = await supabase
      .from('training_graduate_import_batches')
      .insert({
        organization_id: trainingMembership.v2_organizations.id,
        imported_by_user_id: userId,
        source_filename: fileName,
        source_kind: ext,
        status: 'processing',
      })
      .select('*')
      .single();
    if (batchError) throw batchError;

    const rows = ext === 'xlsx' ? await parseXlsx(req.file.buffer) : parseCsv(req.file.buffer);
    let inserted = 0;
    for (const row of rows) {
      const firstName = String(row.first_name || '').trim();
      const lastName = String(row.last_name || '').trim();
      const email = normalizeEmail(row.email || '');
      if (!firstName && !lastName && !email) continue;

      const { data: graduate, error: gradError } = await supabase
        .from('training_graduate_records')
        .insert({
          batch_id: batch.id,
          organization_id: trainingMembership.v2_organizations.id,
          first_name: firstName || 'Unknown',
          last_name: lastName || 'Unknown',
          email: email || null,
        })
        .select('*')
        .single();
      if (gradError) continue;
      inserted += 1;

      const emailMatch = email
        ? await supabase.from('users').select('id, first_name, last_name, email').eq('email', email).limit(1).maybeSingle()
        : { data: null };
      const nameMatch = !emailMatch.data
        ? await supabase
            .from('users')
            .select('id, first_name, last_name, email')
            .ilike('first_name', firstName)
            .ilike('last_name', lastName)
            .limit(1)
            .maybeSingle()
        : { data: null };

      const matchedUser = emailMatch.data || nameMatch.data;
      if (!matchedUser) continue;
      const confidence = emailMatch.data ? 0.97 : 0.68;
      const signals = {
        email_exact: Boolean(emailMatch.data),
        full_name_exact: Boolean(nameMatch.data),
      };

      const { data: requestRow, error: requestError } = await supabase
        .from('competency_verification_requests')
        .insert({
          request_code: `CVR-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          requested_by_user_id: userId,
          target_user_id: matchedUser.id,
          organization_id: trainingMembership.v2_organizations.id,
          graduate_record_id: graduate.id,
          source_mode: 'auto_match',
          match_confidence: confidence,
          match_signals: signals,
          status: confidence >= 0.9 ? 'under_review' : 'pending',
        })
        .select('*')
        .single();
      if (!requestError && requestRow) {
        await createAudit(requestRow.id, userId, 'training_institute', 'auto_match_created', signals);
      }
    }

    await supabase
      .from('training_graduate_import_batches')
      .update({
        total_rows: rows.length,
        processed_rows: inserted,
        status: 'completed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', batch.id);

    return sendSuccess(res, {
      batch_id: batch.id,
      total_rows: rows.length,
      processed_rows: inserted,
    }, 'Graduate import completed');
  } catch (error) {
    logger.error('verificationDirectory:importGraduates failed', { message: error.message });
    return sendError(res, 'Failed to import graduates', 500);
  }
};

exports.listTrainingVerificationRequests = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return sendError(res, 'Unauthorized', 401);
    const memberships = await membershipsForUser(userId);
    const trainingMembership = pickTrainingOrg(memberships);
    if (!trainingMembership) return sendError(res, 'Training institute access required', 403);

    const { data, error } = await supabase
      .from('competency_verification_requests')
      .select(`
        *,
        target_user:users!competency_verification_requests_target_user_id_fkey(id, first_name, last_name, email),
        graduate:training_graduate_records!competency_verification_requests_graduate_record_id_fkey(id, first_name, last_name, email)
      `)
      .eq('organization_id', trainingMembership.v2_organizations.id)
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) throw error;
    return sendSuccess(res, { requests: data || [] });
  } catch (error) {
    logger.error('verificationDirectory:listTrainingVerificationRequests failed', { message: error.message });
    return sendError(res, 'Failed to load training verification requests', 500);
  }
};

exports.decideTrainingVerificationRequest = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return sendError(res, 'Unauthorized', 401);
    const memberships = await membershipsForUser(userId);
    const trainingMembership = pickTrainingOrg(memberships);
    if (!trainingMembership) return sendError(res, 'Training institute access required', 403);

    const requestId = String(req.params?.id || '');
    const decision = String(req.body?.decision || '').toLowerCase();
    const reason = String(req.body?.reason || '').trim();
    if (!requestId) return sendError(res, 'Request id required', 400);
    if (!['approve', 'reject'].includes(decision)) return sendError(res, 'decision must be approve or reject', 400);

    const { data: requestRow, error: requestError } = await supabase
      .from('competency_verification_requests')
      .select('*')
      .eq('id', requestId)
      .eq('organization_id', trainingMembership.v2_organizations.id)
      .single();
    if (requestError || !requestRow) return sendError(res, 'Request not found', 404);

    const status = decision === 'approve' ? 'approved' : 'rejected';
    const { data, error } = await supabase
      .from('competency_verification_requests')
      .update({
        status,
        decision_reason: reason || null,
        decided_by_user_id: userId,
        decided_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', requestId)
      .select('*')
      .single();
    if (error) throw error;

    if (requestRow.target_user_id) {
      await supabase
        .from('users')
        .update({
          competency_verification_status: status === 'approved' ? 'verified' : 'rejected',
          competency_verified_at: status === 'approved' ? new Date().toISOString() : null,
          competency_verified_by: userId,
          competency_verification_request_id: requestId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', requestRow.target_user_id);
    }

    await createAudit(requestId, userId, 'training_institute', `decision_${status}`, { reason });
    return sendSuccess(res, data, `Request ${status}`);
  } catch (error) {
    logger.error('verificationDirectory:decideTrainingVerificationRequest failed', { message: error.message });
    return sendError(res, 'Failed to process request', 500);
  }
};

exports.adminListCompetencyVerificationRequests = async (req, res) => {
  try {
    const status = String(req.query?.status || '').trim();
    let query = supabase
      .from('competency_verification_requests')
      .select(`
        *,
        target_user:users!competency_verification_requests_target_user_id_fkey(id, first_name, last_name, email),
        organization:v2_organizations!competency_verification_requests_organization_id_fkey(id, name, organization_type)
      `)
      .order('created_at', { ascending: false })
      .limit(300);
    if (status) query = query.eq('status', status);
    const { data, error } = await query;
    if (error) throw error;
    return sendSuccess(res, { requests: data || [] });
  } catch (error) {
    logger.error('verificationDirectory:adminListCompetencyVerificationRequests failed', { message: error.message });
    return sendError(res, 'Failed to load competency verification requests', 500);
  }
};

exports.adminDecideCompetencyVerificationRequest = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return sendError(res, 'Unauthorized', 401);
    const requestId = String(req.params?.id || '');
    const decision = String(req.body?.decision || '').toLowerCase();
    const reason = String(req.body?.reason || '').trim();
    if (!requestId) return sendError(res, 'Request id required', 400);
    if (!['approve', 'reject'].includes(decision)) return sendError(res, 'decision must be approve or reject', 400);
    const status = decision === 'approve' ? 'approved' : 'rejected';

    const { data: requestRow, error: reqError } = await supabase
      .from('competency_verification_requests')
      .select('*')
      .eq('id', requestId)
      .single();
    if (reqError || !requestRow) return sendError(res, 'Request not found', 404);

    const { data, error } = await supabase
      .from('competency_verification_requests')
      .update({
        status,
        decision_reason: reason || null,
        decided_by_user_id: userId,
        decided_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', requestId)
      .select('*')
      .single();
    if (error) throw error;

    if (requestRow.target_user_id) {
      await supabase
        .from('users')
        .update({
          competency_verification_status: status === 'approved' ? 'verified' : 'rejected',
          competency_verified_at: status === 'approved' ? new Date().toISOString() : null,
          competency_verified_by: userId,
          competency_verification_request_id: requestId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', requestRow.target_user_id);
    }
    await createAudit(requestId, userId, 'admin', `decision_${status}`, { reason });
    return sendSuccess(res, data, `Request ${status}`);
  } catch (error) {
    logger.error('verificationDirectory:adminDecideCompetencyVerificationRequest failed', { message: error.message });
    return sendError(res, 'Failed to process request', 500);
  }
};
