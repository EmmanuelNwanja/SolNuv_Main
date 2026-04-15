'use strict';

import type { Request, Response } from "express";
import type {
  NercAdminDecisionAction,
  NercApplicationStatus,
  NercReportingCycle,
  NercSubmissionEvent,
  ProjectRegulatoryProfile,
  UUID,
} from "../types/contracts";

const supabase = require('../config/database');
const { sendSuccess, sendError } = require('../utils/responseHelper');
const { logPlatformActivity } = require('../services/auditService');
const {
  deriveRegulatoryProfile,
  computeRegulatoryPathway,
  computeReportingCadence,
  addBusinessDays,
} = require('../services/nercComplianceService');
const logger = require('../utils/logger');

type AuthenticatedUser = {
  id: UUID;
  email?: string;
  company_id?: UUID | null;
};

type AuthenticatedRequest<
  P = Record<string, string>,
  B = Record<string, unknown>,
  Q = Record<string, string | number | boolean>
> = Request<P, unknown, B, Q> & { user: AuthenticatedUser };

type NercProfileUpsertBody = {
  mini_grid_type?: ProjectRegulatoryProfile["mini_grid_type"];
  declared_capacity_kw?: number | string;
  regulatory_pathway?: ProjectRegulatoryProfile["regulatory_pathway"];
  reporting_cadence?: ProjectRegulatoryProfile["reporting_cadence"];
  notes?: string | null;
  regulation_version?: string;
};

type DecisionBody = {
  action: NercAdminDecisionAction;
  regulator_reference?: string | null;
  regulator_decision_note?: string | null;
};

async function getAccessibleProject(req: AuthenticatedRequest, projectId: UUID) {
  const userId = req.user.id;
  const companyId = req.user.company_id;

  let query = supabase
    .from('projects')
    .select('id, name, user_id, company_id, capacity_kw, status, created_at');

  if (companyId) {
    query = query.or(`company_id.eq.${companyId},and(user_id.eq.${userId},company_id.is.null)`);
  } else {
    query = query.eq('user_id', userId);
  }

  const { data, error } = await query.eq('id', projectId).maybeSingle();
  if (error) throw error;
  return data;
}

async function ensureRegulatoryProfile(
  req: AuthenticatedRequest,
  project: { id: UUID; capacity_kw?: number | null }
) {
  const { data: latestDesign } = await supabase
    .from('project_designs')
    .select('grid_topology')
    .eq('project_id', project.id)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const derived = deriveRegulatoryProfile({ project, latestDesign });

  const { data, error } = await supabase
    .from('project_regulatory_profiles')
    .upsert({
      project_id: project.id,
      ...derived,
      created_by: req.user.id,
      is_active: true,
    }, { onConflict: 'project_id' })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

exports.getProjectRegulatoryProfile = async (
  req: AuthenticatedRequest<{ projectId: UUID }>,
  res: Response
) => {
  try {
    const { projectId } = req.params;
    const project = await getAccessibleProject(req, projectId);
    if (!project) return sendError(res, 'Project not found', 404);

    const profile = await ensureRegulatoryProfile(req, project);
    return sendSuccess(res, profile);
  } catch (error) {
    logger.error('NERC get profile failed', { projectId: req.params?.projectId, message: error.message });
    return sendError(res, 'Failed to fetch regulatory profile', 500);
  }
};

exports.upsertProjectRegulatoryProfile = async (
  req: AuthenticatedRequest<{ projectId: UUID }, NercProfileUpsertBody>,
  res: Response
) => {
  try {
    const { projectId } = req.params;
    // #region agent log
    fetch('http://127.0.0.1:7567/ingest/e8cc33b1-e17f-4a70-9052-be1634f820ff',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'94cccd'},body:JSON.stringify({sessionId:'94cccd',runId:'pre-fix',hypothesisId:'H5',location:'backend/src/controllers/nercController.ts:123',message:'Upsert profile input envelope',data:{projectId,hasMiniGridType:typeof req.body?.mini_grid_type==='string',declaredCapacityType:typeof req.body?.declared_capacity_kw,hasPathway:typeof req.body?.regulatory_pathway==='string',hasCadence:typeof req.body?.reporting_cadence==='string'},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    const project = await getAccessibleProject(req, projectId);
    if (!project) return sendError(res, 'Project not found', 404);

    const current = await ensureRegulatoryProfile(req, project);
    const capacity = Number(req.body?.declared_capacity_kw ?? current.declared_capacity_kw ?? project.capacity_kw ?? 0);
    const pathway = req.body?.regulatory_pathway || computeRegulatoryPathway(capacity);
    const cadence = req.body?.reporting_cadence || computeReportingCadence(capacity);

    const payload = {
      mini_grid_type: req.body?.mini_grid_type || current.mini_grid_type,
      declared_capacity_kw: capacity,
      regulatory_pathway: pathway,
      permit_required: pathway === 'permit_required',
      reporting_cadence: cadence,
      notes: req.body?.notes ?? current.notes,
      regulation_version: req.body?.regulation_version || current.regulation_version || 'NERC-R-001-2026',
    };

    const { data, error } = await supabase
      .from('project_regulatory_profiles')
      .update(payload)
      .eq('id', current.id)
      .select('*')
      .single();

    if (error) throw error;

    await logPlatformActivity({
      actorUserId: req.user.id,
      actorEmail: req.user.email,
      action: 'nerc.profile.updated',
      resourceType: 'project_regulatory_profiles',
      resourceId: data.id,
      details: { project_id: projectId, pathway: data.regulatory_pathway, cadence: data.reporting_cadence },
    });

    return sendSuccess(res, data, 'Regulatory profile updated');
  } catch (error) {
    logger.error('NERC upsert profile failed', { projectId: req.params?.projectId, message: error.message });
    return sendError(res, 'Failed to update regulatory profile', 500);
  }
};

exports.listProjectApplications = async (
  req: AuthenticatedRequest<{ projectId: UUID }>,
  res: Response
) => {
  try {
    const { projectId } = req.params;
    const project = await getAccessibleProject(req, projectId);
    if (!project) return sendError(res, 'Project not found', 404);

    const { data, error } = await supabase
      .from('nerc_applications')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return sendSuccess(res, data || []);
  } catch (error) {
    logger.error('NERC list applications failed', { projectId: req.params?.projectId, message: error.message });
    return sendError(res, 'Failed to fetch applications', 500);
  }
};

exports.createApplication = async (
  req: AuthenticatedRequest<{ projectId: UUID }>,
  res: Response
) => {
  try {
    const { projectId } = req.params;
    const project = await getAccessibleProject(req, projectId);
    if (!project) return sendError(res, 'Project not found', 404);

    const profile = await ensureRegulatoryProfile(req, project);
    const payload = {
      project_id: projectId,
      regulatory_profile_id: profile.id,
      application_type: req.body?.application_type || profile.regulatory_pathway,
      title: req.body?.title || `NERC ${profile.regulatory_pathway === 'permit_required' ? 'Permit' : 'Registration'} Filing`,
      application_payload: req.body?.application_payload || {},
      checklist_payload: req.body?.checklist_payload || [],
      submitted_by: req.user.id,
    };

    const { data, error } = await supabase
      .from('nerc_applications')
      .insert(payload)
      .select('*')
      .single();
    if (error) throw error;

    await logPlatformActivity({
      actorUserId: req.user.id,
      actorEmail: req.user.email,
      action: 'nerc.application.created',
      resourceType: 'nerc_applications',
      resourceId: data.id,
      details: { project_id: projectId, application_type: data.application_type },
    });

    return sendSuccess(res, data, 'NERC application draft created', 201);
  } catch (error) {
    logger.error('NERC create application failed', { projectId: req.params?.projectId, message: error.message });
    return sendError(res, 'Failed to create NERC application', 500);
  }
};

exports.updateApplicationDraft = async (
  req: AuthenticatedRequest<{ applicationId: UUID }>,
  res: Response
) => {
  try {
    const { applicationId } = req.params;
    const { data: existing, error: findError } = await supabase
      .from('nerc_applications')
      .select('id, project_id, status')
      .eq('id', applicationId)
      .maybeSingle();

    if (findError) throw findError;
    if (!existing) return sendError(res, 'Application not found', 404);
    if (!['draft', 'changes_requested'].includes(existing.status)) {
      return sendError(res, 'Only draft or changes requested applications can be edited', 409);
    }

    const project = await getAccessibleProject(req, existing.project_id);
    if (!project) return sendError(res, 'Project not found', 404);

    const { data, error } = await supabase
      .from('nerc_applications')
      .update({
        title: req.body?.title,
        application_payload: req.body?.application_payload,
        checklist_payload: req.body?.checklist_payload,
      })
      .eq('id', applicationId)
      .select('*')
      .single();

    if (error) throw error;
    return sendSuccess(res, data, 'Application draft updated');
  } catch (error) {
    logger.error('NERC update application failed', { applicationId: req.params?.applicationId, message: error.message });
    return sendError(res, 'Failed to update application', 500);
  }
};

exports.submitApplication = async (
  req: AuthenticatedRequest<{ applicationId: UUID }>,
  res: Response
) => {
  try {
    const { applicationId } = req.params;
    const { data: existing, error: findError } = await supabase
      .from('nerc_applications')
      .select('id, project_id, status')
      .eq('id', applicationId)
      .maybeSingle();

    if (findError) throw findError;
    if (!existing) return sendError(res, 'Application not found', 404);
    if (!['draft', 'changes_requested'].includes(existing.status)) {
      return sendError(res, 'Application cannot be submitted from current status', 409);
    }

    const project = await getAccessibleProject(req, existing.project_id);
    if (!project) return sendError(res, 'Project not found', 404);

    const submittedAt = new Date();
    const slaDueAt = addBusinessDays(submittedAt, 30).toISOString();
    const { data, error } = await supabase
      .from('nerc_applications')
      .update({
        status: 'submitted',
        submitted_at: submittedAt.toISOString(),
        sla_due_at: slaDueAt,
        sla_breached: false,
        submitted_by: req.user.id,
      })
      .eq('id', applicationId)
      .select('*')
      .single();

    if (error) throw error;
    return sendSuccess(res, data, 'Application submitted to NERC');
  } catch (error) {
    logger.error('NERC submit application failed', { applicationId: req.params?.applicationId, message: error.message });
    return sendError(res, 'Failed to submit application', 500);
  }
};

exports.listProjectReportingCycles = async (
  req: AuthenticatedRequest<{ projectId: UUID }>,
  res: Response
) => {
  try {
    const { projectId } = req.params;
    const project = await getAccessibleProject(req, projectId);
    if (!project) return sendError(res, 'Project not found', 404);

    const { data: cycles, error } = await supabase
      .from('nerc_reporting_cycles')
      .select('*')
      .eq('project_id', projectId)
      .order('period_start', { ascending: false });
    if (error) throw error;

    const cycleRows = (cycles || []) as NercReportingCycle[];
    const cycleIds = cycleRows.map((c) => c.id);
    const { data: events } = cycleIds.length
      ? await supabase
        .from('nerc_submission_events')
        .select('*')
        .in('reporting_cycle_id', cycleIds)
        .order('submitted_at', { ascending: false })
      : { data: [] };

    const eventsByCycle: Record<UUID, NercSubmissionEvent[]> = {};
    (events || []).forEach((event: NercSubmissionEvent) => {
      if (!eventsByCycle[event.reporting_cycle_id]) eventsByCycle[event.reporting_cycle_id] = [];
      eventsByCycle[event.reporting_cycle_id].push(event);
    });

    const rows = cycleRows.map((cycle) => ({
      ...cycle,
      submissions: eventsByCycle[cycle.id] || [],
    }));

    return sendSuccess(res, rows);
  } catch (error) {
    logger.error('NERC list cycles failed', { projectId: req.params?.projectId, message: error.message });
    return sendError(res, 'Failed to fetch reporting cycles', 500);
  }
};

exports.listMyReportingCycles = async (
  req: AuthenticatedRequest<Record<string, never>, Record<string, never>, { status?: string; limit?: number | string }>,
  res: Response
) => {
  try {
    const companyId = req.user.company_id;
    const userId = req.user.id;
    const { status = '', limit = 50 } = req.query;

    let projectQuery = supabase.from('projects').select('id, name');
    if (companyId) {
      projectQuery = projectQuery.or(`company_id.eq.${companyId},and(user_id.eq.${userId},company_id.is.null)`);
    } else {
      projectQuery = projectQuery.eq('user_id', userId);
    }

    const { data: projects, error: projectError } = await projectQuery.limit(300);
    if (projectError) throw projectError;
    const projectIds = (projects || []).map((p) => p.id);
    if (!projectIds.length) return sendSuccess(res, []);

    let cycleQuery = supabase
      .from('nerc_reporting_cycles')
      .select('*')
      .in('project_id', projectIds)
      .order('due_date', { ascending: true })
      .limit(Math.min(Number(limit) || 50, 200));
    if (status) cycleQuery = cycleQuery.eq('status', status);

    const { data: cycles, error } = await cycleQuery;
    if (error) throw error;

    const projectMap: Record<UUID, string> = {};
    (projects || []).forEach((p: { id: UUID; name: string }) => { projectMap[p.id] = p.name; });
    const rows = ((cycles || []) as NercReportingCycle[]).map((cycle) => ({
      ...cycle,
      project_name: projectMap[cycle.project_id] || 'Unknown Project',
    }));
    return sendSuccess(res, rows);
  } catch (error) {
    logger.error('NERC list my cycles failed', { userId: req.user?.id, message: error.message });
    return sendError(res, 'Failed to fetch NERC reporting cycles', 500);
  }
};

exports.createReportingCycle = async (
  req: AuthenticatedRequest<{ projectId: UUID }>,
  res: Response
) => {
  try {
    const { projectId } = req.params;
    const project = await getAccessibleProject(req, projectId);
    if (!project) return sendError(res, 'Project not found', 404);

    const profile = await ensureRegulatoryProfile(req, project);
    const cadence = req.body?.cadence || profile.reporting_cadence;
    const periodStart = req.body?.period_start;
    const periodEnd = req.body?.period_end;
    const dueDate = req.body?.due_date;

    if (!periodStart || !periodEnd || !dueDate) {
      return sendError(res, 'period_start, period_end and due_date are required', 400);
    }

    const { data, error } = await supabase
      .from('nerc_reporting_cycles')
      .insert({
        project_id: projectId,
        regulatory_profile_id: profile.id,
        cadence,
        period_start: periodStart,
        period_end: periodEnd,
        due_date: dueDate,
        report_payload: req.body?.report_payload || {},
        created_by_scheduler: false,
      })
      .select('*')
      .single();
    if (error) throw error;

    return sendSuccess(res, data, 'Reporting cycle created', 201);
  } catch (error) {
    logger.error('NERC create cycle failed', { projectId: req.params?.projectId, message: error.message });
    return sendError(res, 'Failed to create reporting cycle', 500);
  }
};

exports.recordSubmissionEvent = async (
  req: AuthenticatedRequest<{ cycleId: UUID }>,
  res: Response
) => {
  try {
    const { cycleId } = req.params;
    const { data: cycle, error: cycleError } = await supabase
      .from('nerc_reporting_cycles')
      .select('*')
      .eq('id', cycleId)
      .maybeSingle();

    if (cycleError) throw cycleError;
    if (!cycle) return sendError(res, 'Reporting cycle not found', 404);

    const project = await getAccessibleProject(req, cycle.project_id);
    if (!project) return sendError(res, 'Project not found', 404);

    const { data: event, error } = await supabase
      .from('nerc_submission_events')
      .insert({
        reporting_cycle_id: cycleId,
        project_id: cycle.project_id,
        submission_status: req.body?.submission_status || 'submitted',
        submission_payload: req.body?.submission_payload || {},
        regulator_reference: req.body?.regulator_reference || null,
        regulator_message: req.body?.regulator_message || null,
        submitted_by: req.user.id,
      })
      .select('*')
      .single();
    if (error) throw error;

    await supabase
      .from('nerc_reporting_cycles')
      .update({
        status: 'submitted',
        submitted_at: event.submitted_at,
      })
      .eq('id', cycleId);

    return sendSuccess(res, event, 'Submission recorded', 201);
  } catch (error) {
    logger.error('NERC record submission failed', { cycleId: req.params?.cycleId, message: error.message });
    return sendError(res, 'Failed to record submission', 500);
  }
};

exports.adminListApplications = async (
  req: AuthenticatedRequest<Record<string, never>, Record<string, never>, { status?: NercApplicationStatus; page?: number | string; limit?: number | string }>,
  res: Response
) => {
  try {
    const { status = '', page = 1, limit = 30 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = supabase
      .from('nerc_applications')
      .select(`
        id, project_id, application_type, status, title, regulator_reference,
        submitted_at, review_started_at, reviewed_at, approved_at, rejected_at, sla_due_at, sla_breached, created_at,
        projects!inner(id, name, company_id, companies(id, name))
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + Number(limit) - 1);

    if (status) query = query.eq('status', status);

    const { data, count, error } = await query;
    if (error) throw error;

    return sendSuccess(res, {
      applications: data || [],
      total: count || 0,
      page: Number(page),
      limit: Number(limit),
    });
  } catch (error) {
    logger.error('NERC admin list applications failed', { message: error.message });
    return sendError(res, 'Failed to fetch NERC applications', 500);
  }
};

exports.adminDecisionApplication = async (
  req: AuthenticatedRequest<{ applicationId: UUID }, DecisionBody>,
  res: Response
) => {
  try {
    const { applicationId } = req.params;
    const { action, regulator_reference, regulator_decision_note } = req.body || {};
    const validActions: NercAdminDecisionAction[] = ['start_review', 'changes_requested', 'approve', 'reject'];
    if (!validActions.includes(action)) {
      return sendError(res, 'action must be start_review, changes_requested, approve, or reject', 400);
    }

    const { data: existing, error: findError } = await supabase
      .from('nerc_applications')
      .select('id, status')
      .eq('id', applicationId)
      .maybeSingle();

    if (findError) throw findError;
    if (!existing) return sendError(res, 'Application not found', 404);

    const now = new Date().toISOString();
    const updates: {
      reviewed_by: UUID;
      reviewed_at: string;
      regulator_reference: string | null;
      regulator_decision_note: string | null;
      status?: NercApplicationStatus;
      review_started_at?: string;
      approved_at?: string;
      rejected_at?: string;
    } = {
      reviewed_by: req.user.id,
      reviewed_at: now,
      regulator_reference: regulator_reference || null,
      regulator_decision_note: regulator_decision_note || null,
    };

    if (action === 'start_review') {
      updates.status = 'in_review';
      updates.review_started_at = now;
    }
    if (action === 'changes_requested') updates.status = 'changes_requested';
    if (action === 'approve') {
      updates.status = 'approved';
      updates.approved_at = now;
    }
    if (action === 'reject') {
      updates.status = 'rejected';
      updates.rejected_at = now;
    }

    const { data, error } = await supabase
      .from('nerc_applications')
      .update(updates)
      .eq('id', applicationId)
      .select('*')
      .single();
    if (error) throw error;

    await logPlatformActivity({
      actorUserId: req.user.id,
      actorEmail: req.user.email,
      action: `nerc.application.${action}`,
      resourceType: 'nerc_applications',
      resourceId: applicationId,
      details: { new_status: data.status },
    });

    return sendSuccess(res, data, 'Application decision saved');
  } catch (error) {
    logger.error('NERC admin decision failed', { applicationId: req.params?.applicationId, message: error.message });
    return sendError(res, 'Failed to update application decision', 500);
  }
};

exports.adminSlaOverview = async (_req: Request, res: Response) => {
  try {
    const nowIso = new Date().toISOString();
    const [all, pending, breached, dueSoon] = await Promise.all([
      supabase.from('nerc_applications').select('*', { count: 'exact', head: true }),
      supabase.from('nerc_applications').select('*', { count: 'exact', head: true }).in('status', ['submitted', 'in_review']),
      supabase.from('nerc_applications').select('*', { count: 'exact', head: true }).eq('sla_breached', true),
      supabase
        .from('nerc_applications')
        .select('*', { count: 'exact', head: true })
        .in('status', ['submitted', 'in_review'])
        .gte('sla_due_at', nowIso)
        .lte('sla_due_at', new Date(Date.now() + 5 * 24 * 3600_000).toISOString()),
    ]);

    return sendSuccess(res, {
      total: all.count || 0,
      pending_review: pending.count || 0,
      sla_breached: breached.count || 0,
      due_in_5_days: dueSoon.count || 0,
    });
  } catch (error) {
    logger.error('NERC SLA overview failed', { message: error.message });
    return sendError(res, 'Failed to load SLA overview', 500);
  }
};

exports.adminListReportingCycles = async (
  req: AuthenticatedRequest<Record<string, never>, Record<string, never>, { status?: string; page?: number | string; limit?: number | string }>,
  res: Response
) => {
  try {
    const { status = '', page = 1, limit = 50 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    let query = supabase
      .from('nerc_reporting_cycles')
      .select(`
        id, project_id, cadence, period_start, period_end, due_date, status, submitted_at, created_at,
        projects!inner(id, name, company_id, companies(id, name))
      `, { count: 'exact' })
      .order('due_date', { ascending: false })
      .range(offset, offset + Number(limit) - 1);
    if (status) query = query.eq('status', status);

    const { data, error, count } = await query;
    if (error) throw error;

    return sendSuccess(res, {
      cycles: data || [],
      total: count || 0,
      page: Number(page),
      limit: Number(limit),
    });
  } catch (error) {
    logger.error('NERC admin list cycles failed', { message: error.message });
    return sendError(res, 'Failed to load NERC reporting cycles', 500);
  }
};
