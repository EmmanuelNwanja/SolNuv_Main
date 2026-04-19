/**
 * Partner portal APIs — recycler pickups & financier funding (scoped by v2_org_memberships).
 */
import type { Request, Response } from 'express';

const supabase = require('../config/database');
const { sendError, sendSuccess } = require('../utils/responseHelper');
const logger = require('../utils/logger');

function normalizeOrgRow(row: { role_code?: string; v2_organizations?: Record<string, unknown> | null }) {
  const org = row.v2_organizations;
  return {
    role_code: row.role_code,
    organization: org && typeof org === 'object' ? org : null,
  };
}

async function membershipsForUser(userId: string) {
  const { data, error } = await supabase
    .from('v2_org_memberships')
    .select(
      'role_code, v2_organizations ( id, name, organization_type, verification_status, jurisdiction )',
    )
    .eq('user_id', userId);
  if (error) {
    logger.warn('partner: v2_org_memberships query failed', { message: error.message });
    return [];
  }
  return (data || []).map(normalizeOrgRow).filter((m) => m.organization);
}

function orgsOfType(
  memberships: ReturnType<typeof normalizeOrgRow>[],
  type: string,
) {
  return memberships.filter((m) => String(m.organization?.organization_type || '') === type);
}

exports.listRecyclerPickups = async (req: Request, res: Response) => {
  try {
    const userId = (req as unknown as { user?: { id: string } }).user?.id;
    if (!userId) return sendError(res, 'Unauthorized', 401);

    const memberships = await membershipsForUser(userId);
    const recycler = orgsOfType(memberships, 'recycler');
    if (!recycler.length) return sendSuccess(res, { pickups: [] });

    const orgIds = recycler.map((m) => m.organization?.id).filter(Boolean) as string[];
    const orgNames = recycler.map((m) => String(m.organization?.name || '').trim()).filter(Boolean);

    const { data: rows, error } = await supabase
      .from('recovery_requests')
      .select(
        `
        *,
        project:projects(id, name, city, state, status),
        requester:users!recovery_requests_user_id_fkey(id, first_name, last_name, email, phone)
      `,
      )
      .eq('decommission_approved', true)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const pickups = (rows || []).filter(
      (r: {
        assigned_partner_org_id?: string | null;
        assigned_recycler?: string | null;
        preferred_recycler?: string | null;
      }) => {
        if (r.assigned_partner_org_id && orgIds.includes(r.assigned_partner_org_id)) return true;
        const ar = String(r.assigned_recycler || '').toLowerCase();
        const pr = String(r.preferred_recycler || '').toLowerCase();
        return orgNames.some((n) => {
          const nl = n.toLowerCase();
          return (ar && ar.includes(nl)) || (pr && pr.includes(nl)) || nl === ar || nl === pr;
        });
      },
    );

    return sendSuccess(res, { pickups });
  } catch (e: unknown) {
    const err = e as { message?: string };
    logger.error('listRecyclerPickups failed', { message: err.message });
    return sendError(res, 'Failed to load pickups', 500);
  }
};

exports.recyclerSlaSummary = async (req: Request, res: Response) => {
  try {
    const userId = (req as unknown as { user?: { id: string } }).user?.id;
    if (!userId) return sendError(res, 'Unauthorized', 401);

    const memberships = await membershipsForUser(userId);
    const recycler = orgsOfType(memberships, 'recycler');
    if (!recycler.length) {
      return sendSuccess(res, { completed_count: 0, avg_days_request_to_complete: null });
    }

    const orgIds = recycler.map((m) => m.organization?.id).filter(Boolean) as string[];
    const orgNames = recycler.map((m) => String(m.organization?.name || '').trim()).filter(Boolean);

    const { data: rows } = await supabase
      .from('recovery_requests')
      .select('created_at, completed_at, assigned_partner_org_id, assigned_recycler, preferred_recycler')
      .eq('decommission_approved', true)
      .not('completed_at', 'is', null);

    const done = (rows || []).filter(
      (r: {
        assigned_partner_org_id?: string | null;
        assigned_recycler?: string | null;
        preferred_recycler?: string | null;
      }) => {
        if (r.assigned_partner_org_id && orgIds.includes(r.assigned_partner_org_id)) return true;
        const ar = String(r.assigned_recycler || '').toLowerCase();
        const pr = String(r.preferred_recycler || '').toLowerCase();
        return orgNames.some((n) => {
          const nl = n.toLowerCase();
          return (ar && ar.includes(nl)) || (pr && pr.includes(nl));
        });
      },
    );

    let sumDays = 0;
    let n = 0;
    for (const r of done) {
      const a = r.created_at ? new Date(String(r.created_at)).getTime() : 0;
      const b = r.completed_at ? new Date(String(r.completed_at)).getTime() : 0;
      if (a && b && b >= a) {
        sumDays += (b - a) / 86400000;
        n += 1;
      }
    }

    return sendSuccess(res, {
      completed_count: n,
      avg_days_request_to_complete: n > 0 ? Math.round((sumDays / n) * 10) / 10 : null,
    });
  } catch (e: unknown) {
    const err = e as { message?: string };
    logger.error('recyclerSlaSummary failed', { message: err.message });
    return sendError(res, 'Failed to load SLA summary', 500);
  }
};

exports.logPartnerEvent = async (req: Request, res: Response) => {
  try {
    const userId = (req as unknown as { user?: { id: string } }).user?.id;
    if (!userId) return sendError(res, 'Unauthorized', 401);
    const { event_type, payload = {} } = (req.body || {}) as { event_type?: string; payload?: unknown };
    if (!event_type || typeof event_type !== 'string') return sendError(res, 'event_type required', 400);

    const memberships = await membershipsForUser(userId);
    const orgId = memberships[0]?.organization?.id as string | undefined;
    if (!orgId) return sendError(res, 'No partner organization', 403);

    const { error } = await supabase.from('partner_portal_events').insert({
      organization_id: orgId,
      event_type,
      payload: typeof payload === 'object' && payload !== null ? payload : {},
    });
    if (error) throw error;
    return sendSuccess(res, { ok: true });
  } catch (e: unknown) {
    const err = e as { message?: string };
    logger.error('logPartnerEvent failed', { message: err.message });
    return sendError(res, 'Failed to log event', 500);
  }
};

exports.listPartnerEvents = async (req: Request, res: Response) => {
  try {
    const userId = (req as unknown as { user?: { id: string } }).user?.id;
    if (!userId) return sendError(res, 'Unauthorized', 401);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query?.limit || '30'), 10) || 30));

    const memberships = await membershipsForUser(userId);
    const orgIds = memberships.map((m) => m.organization?.id).filter(Boolean) as string[];
    if (!orgIds.length) return sendSuccess(res, { events: [] });

    const { data, error } = await supabase
      .from('partner_portal_events')
      .select('id, organization_id, event_type, payload, created_at')
      .in('organization_id', orgIds)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return sendSuccess(res, { events: data || [] });
  } catch (e: unknown) {
    const err = e as { message?: string };
    logger.error('listPartnerEvents failed', { message: err.message });
    return sendError(res, 'Failed to load events', 500);
  }
};

exports.listFinancierFundingRequests = async (req: Request, res: Response) => {
  try {
    const userId = (req as unknown as { user?: { id: string } }).user?.id;
    if (!userId) return sendError(res, 'Unauthorized', 401);

    const memberships = await membershipsForUser(userId);
    const financier = orgsOfType(memberships, 'financier');
    if (!financier.length) return sendSuccess(res, { requests: [] });

    const orgIds = financier.map((m) => m.organization?.id).filter(Boolean) as string[];

    const { data, error } = await supabase
      .from('partner_funding_requests')
      .select(
        `
        *,
        project:projects(id, name, city, state, status)
      `,
      )
      .in('financier_organization_id', orgIds)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return sendSuccess(res, { requests: data || [] });
  } catch (e: unknown) {
    const err = e as { message?: string };
    logger.error('listFinancierFundingRequests failed', { message: err.message });
    return sendError(res, 'Failed to load funding requests', 500);
  }
};

exports.createFinancierFundingRequest = async (req: Request, res: Response) => {
  try {
    const userId = (req as unknown as { user?: { id: string } }).user?.id;
    if (!userId) return sendError(res, 'Unauthorized', 401);

    const memberships = await membershipsForUser(userId);
    const financier = orgsOfType(memberships, 'financier');
    const orgId = financier[0]?.organization?.id as string | undefined;
    if (!orgId) return sendError(res, 'Financier organization required', 403);

    const { project_id, design_share_url, portfolio_url, notes } = (req.body || {}) as Record<string, unknown>;
    if (!project_id || typeof project_id !== 'string') return sendError(res, 'project_id required', 400);

    const { data, error } = await supabase
      .from('partner_funding_requests')
      .insert({
        financier_organization_id: orgId,
        project_id,
        design_share_url: design_share_url || null,
        portfolio_url: portfolio_url || null,
        notes: notes || null,
        created_by_user_id: userId,
      })
      .select('*')
      .single();

    if (error) throw error;
    return sendSuccess(res, data, 'Funding request created', 201);
  } catch (e: unknown) {
    const err = e as { message?: string };
    logger.error('createFinancierFundingRequest failed', { message: err.message });
    return sendError(res, err.message || 'Failed to create request', 500);
  }
};

exports.financierFinancialsSummary = async (req: Request, res: Response) => {
  try {
    const userId = (req as unknown as { user?: { id: string } }).user?.id;
    if (!userId) return sendError(res, 'Unauthorized', 401);

    const memberships = await membershipsForUser(userId);
    const financier = orgsOfType(memberships, 'financier');
    if (!financier.length) {
      return sendSuccess(res, {
        escrow_released_ngn: 0,
        escrow_held_ngn: 0,
        release_decision_count: 0,
        co2_fund_placeholder_ngn: null,
      });
    }

    const orgIds = financier.map((m) => m.organization?.id).filter(Boolean) as string[];

    const { data: decisions, error } = await supabase
      .from('v2_release_decisions')
      .select('approved_release_amount_ngn, approved_hold_amount_ngn')
      .in('organization_id', orgIds);

    if (error) throw error;

    let released = 0;
    let held = 0;
    for (const d of decisions || []) {
      released += Number(d.approved_release_amount_ngn) || 0;
      held += Number(d.approved_hold_amount_ngn) || 0;
    }

    return sendSuccess(res, {
      escrow_released_ngn: released,
      escrow_held_ngn: held,
      release_decision_count: (decisions || []).length,
      co2_fund_placeholder_ngn: null,
    });
  } catch (e: unknown) {
    const err = e as { message?: string };
    logger.error('financierFinancialsSummary failed', { message: err.message });
    return sendError(res, 'Failed to load financials', 500);
  }
};

exports.listFinancierEscrowDecisions = async (req: Request, res: Response) => {
  try {
    const userId = (req as unknown as { user?: { id: string } }).user?.id;
    if (!userId) return sendError(res, 'Unauthorized', 401);

    const memberships = await membershipsForUser(userId);
    const financier = orgsOfType(memberships, 'financier');
    if (!financier.length) return sendSuccess(res, { decisions: [] });

    const orgIds = financier.map((m) => m.organization?.id).filter(Boolean) as string[];

    const statusFilter = typeof req.query.status === 'string' ? req.query.status : null;
    const limitRaw = Number(req.query.limit);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 200) : 50;

    let q = supabase
      .from('v2_release_decisions')
      .select(
        'id, organization_id, project_id, escrow_account_id, decision_type, approved_release_amount_ngn, approved_hold_amount_ngn, failed_conditions, rationale, policy_version, condition_flags, tx_hash, chain_id, network_name, block_number, decided_at, created_at',
      )
      .in('organization_id', orgIds)
      .order('decided_at', { ascending: false, nullsFirst: false })
      .limit(limit);

    if (statusFilter && ['RELEASE_APPROVED', 'PARTIAL_RELEASE', 'HOLD'].includes(statusFilter)) {
      q = q.eq('decision_type', statusFilter);
    }

    const { data, error } = await q;
    if (error) throw error;

    return sendSuccess(res, { decisions: data || [] });
  } catch (e: unknown) {
    const err = e as { message?: string };
    logger.error('listFinancierEscrowDecisions failed', { message: err.message });
    return sendError(res, 'Failed to load escrow decisions', 500);
  }
};

exports.listV2OrganizationsAdmin = async (req: Request, res: Response) => {
  try {
    const type = req.query?.organization_type as string | undefined;
    let q = supabase.from('v2_organizations').select('*').order('created_at', { ascending: false }).limit(200);
    if (type && typeof type === 'string') q = q.eq('organization_type', type);
    const { data, error } = await q;
    if (error) throw error;
    return sendSuccess(res, { organizations: data || [] });
  } catch (e: unknown) {
    const err = e as { message?: string };
    logger.error('listV2OrganizationsAdmin failed', { message: err.message });
    return sendError(res, 'Failed to load organizations', 500);
  }
};

exports.assignRecoveryPartner = async (req: Request, res: Response) => {
  try {
    const adminUser = (req as unknown as { user?: { id: string } }).user;
    if (!adminUser?.id) return sendError(res, 'Unauthorized', 401);

    const requestId = req.params?.id;
    const orgId = (req.body || {}) as { organization_id?: string };
    const organization_id = orgId.organization_id;
    if (!requestId) return sendError(res, 'id required', 400);
    if (!organization_id || typeof organization_id !== 'string') return sendError(res, 'organization_id required', 400);

    const { data: org, error: orgErr } = await supabase
      .from('v2_organizations')
      .select('id, name, organization_type')
      .eq('id', organization_id)
      .single();
    if (orgErr || !org || org.organization_type !== 'recycler') {
      return sendError(res, 'Invalid recycler organization', 400);
    }

    const { data, error } = await supabase
      .from('recovery_requests')
      .update({
        assigned_partner_org_id: organization_id,
        assigned_recycler: org.name,
        updated_at: new Date().toISOString(),
      })
      .eq('id', requestId)
      .select('id, assigned_partner_org_id, assigned_recycler')
      .single();

    if (error) throw error;
    return sendSuccess(res, data, 'Partner assigned');
  } catch (e: unknown) {
    const err = e as { message?: string };
    logger.error('assignRecoveryPartner failed', { message: err.message });
    return sendError(res, err.message || 'Failed to assign partner', 500);
  }
};
