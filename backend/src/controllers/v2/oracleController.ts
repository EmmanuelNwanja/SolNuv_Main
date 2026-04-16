const supabase = require('../../config/database');
const { sendError, sendSuccess } = require('../../utils/responseHelper');
const { evaluateEscrowDecision } = require('../../services/v2/escrowPolicyEngine');
const chainAdapter = require('../../services/v2/chainAdapterService');
const custodianAdapter = require('../../services/v2/custodianAdapterService');
const idempotencyService = require('../../services/v2/idempotencyService');
const outboxService = require('../../services/v2/outboxService');

exports.getHealth = async (_req, res) => {
  return sendSuccess(res, {
    status: 'ok',
    platform: 'SolNuv V2 Oracle',
    mode: 'parallel',
    chain_provider: process.env.V2_CHAIN_PROVIDER || 'simulated',
    timestamp: new Date().toISOString(),
  });
};

exports.evaluateEscrow = async (req, res) => {
  try {
    const idempotencyKey = req.headers['x-idempotency-key'];
    const endpointKey = 'v2.escrow.decisions.evaluate';
    if (idempotencyKey) {
      const existing = await idempotencyService.getExisting(endpointKey, String(idempotencyKey));
      if (existing) {
        return sendSuccess(
          res,
          existing.response_payload || {},
          'Idempotent replay: returning previously computed response',
          200
        );
      }
    }

    const {
      organization_id,
      project_id,
      escrow_account_id = null,
      condition_flags = {},
      release_amount_ngn = 0,
      hold_amount_ngn = 0,
      policy_version = 'v2.0.0',
    } = req.body || {};

    if (!organization_id || !project_id) {
      return sendError(res, 'organization_id and project_id are required', 400);
    }

    const evaluated = evaluateEscrowDecision({
      policy_version,
      condition_flags,
      release_amount_ngn,
      hold_amount_ngn,
    });

    const decisionPayload = {
      organization_id,
      project_id,
      escrow_account_id,
      ...evaluated,
      condition_flags,
      decided_by_user_id: req.user?.id || null,
      decided_at: new Date().toISOString(),
    };

    const anchor = await chainAdapter.anchorAttestation({
      type: 'escrow_decision',
      project_id,
      organization_id,
      policy_version,
      decision_type: evaluated.decision_type,
      failed_conditions: evaluated.failed_conditions,
      condition_flags,
      amounts: {
        release_amount_ngn: evaluated.approved_release_amount_ngn,
        hold_amount_ngn: evaluated.approved_hold_amount_ngn,
      },
    });

    const { data, error } = await supabase
      .from('v2_release_decisions')
      .insert({
        ...decisionPayload,
        chain_id: anchor.chain_id,
        network_name: anchor.network_name,
        tx_hash: anchor.tx_hash,
        block_number: anchor.block_number,
        contract_address: anchor.contract_address,
        payload_hash: anchor.payload_hash,
      })
      .select('*')
      .single();

    if (error) throw error;

    const responsePayload = {
      decision: data,
      chain_attestation: anchor,
    };

    if (idempotencyKey) {
      await idempotencyService.saveRecord({
        endpointKey,
        idempotencyKey: String(idempotencyKey),
        payload: req.body || {},
        responsePayload,
        createdBy: req.user?.id || null,
      });
    }

    await outboxService.enqueue('escrow.decision.created', data.id, responsePayload);

    return sendSuccess(res, responsePayload, 'Escrow decision evaluated and attested', 201);
  } catch (error) {
    return sendError(res, error.message || 'Failed to evaluate escrow decision', 500);
  }
};

exports.executeCustodianRelease = async (req, res) => {
  try {
    const idempotencyKey = req.headers['x-idempotency-key'];
    const endpointKey = 'v2.escrow.executions.submit';
    if (idempotencyKey) {
      const existing = await idempotencyService.getExisting(endpointKey, String(idempotencyKey));
      if (existing) {
        return sendSuccess(
          res,
          existing.response_payload || {},
          'Idempotent replay: returning previously submitted execution',
          200
        );
      }
    }

    const { decision_id } = req.body || {};
    if (!decision_id) return sendError(res, 'decision_id is required', 400);

    const { data: decision, error: decisionErr } = await supabase
      .from('v2_release_decisions')
      .select('*')
      .eq('id', decision_id)
      .single();
    if (decisionErr || !decision) return sendError(res, 'Decision not found', 404);

    const execution = await custodianAdapter.executeRelease({ decision });
    const { data, error } = await supabase
      .from('v2_escrow_executions')
      .insert({
        release_decision_id: decision.id,
        provider: execution.provider,
        execution_status: execution.execution_status,
        external_reference: execution.external_reference,
        executed_at: execution.executed_at,
        payload: execution,
        initiated_by: req.user.id,
      })
      .select('*')
      .single();
    if (error) throw error;

    const responsePayload = { decision, execution: data };

    if (idempotencyKey) {
      await idempotencyService.saveRecord({
        endpointKey,
        idempotencyKey: String(idempotencyKey),
        payload: req.body || {},
        responsePayload,
        createdBy: req.user?.id || null,
      });
    }

    await outboxService.enqueue('escrow.execution.submitted', data.id, responsePayload);

    return sendSuccess(res, responsePayload, 'Custodian execution submitted', 201);
  } catch (error) {
    await outboxService.moveToDeadLetter(
      'oracleController.executeCustodianRelease',
      'escrow.execution.submitted',
      req.body || {},
      error.message || 'Unknown execution error'
    ).catch(() => {});
    return sendError(res, error.message || 'Failed to execute custodian release', 500);
  }
};

