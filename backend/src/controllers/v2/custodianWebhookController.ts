const supabase = require('../../config/database');
const { sendError, sendSuccess } = require('../../utils/responseHelper');
const { verifyPayloadSignature } = require('../../services/v2/signatureService');
const outboxService = require('../../services/v2/outboxService');

exports.receiveExecutionStatus = async (req, res) => {
  try {
    const secret = process.env.V2_CUSTODIAN_CALLBACK_SECRET || process.env.V2_CUSTODIAN_WEBHOOK_SECRET || '';
    const signature = req.headers['x-custodian-signature'] || req.headers['x-solnuv-signature'];
    if (secret) {
      if (!signature) return sendError(res, 'Missing callback signature', 401);
      const verified = verifyPayloadSignature(req.body || {}, secret, signature);
      if (!verified) return sendError(res, 'Invalid callback signature', 401);
    }

    const {
      release_decision_id,
      execution_status,
      event_id,
      external_reference = null,
      executed_at = new Date().toISOString(),
      payload = {},
    } = req.body || {};

    if (!release_decision_id || !execution_status || !event_id) {
      return sendError(res, 'release_decision_id, execution_status, and event_id are required', 400);
    }

    const { data: callbackExisting } = await supabase
      .from('v2_callback_events')
      .select('id')
      .eq('provider', 'custodian')
      .eq('event_id', String(event_id))
      .maybeSingle();
    if (callbackExisting) {
      return sendSuccess(res, { replay: true }, 'Duplicate callback ignored');
    }

    const { error: callbackErr } = await supabase
      .from('v2_callback_events')
      .insert({
        provider: 'custodian',
        event_id: String(event_id),
        signature: signature ? String(signature) : null,
        payload: req.body || {},
      });
    if (callbackErr) throw callbackErr;

    const { data, error } = await supabase
      .from('v2_escrow_executions')
      .insert({
        release_decision_id,
        provider: 'custodian_callback',
        execution_status,
        external_reference,
        executed_at,
        payload,
        initiated_by: null,
      })
      .select('*')
      .single();
    if (error) throw error;

    await outboxService.enqueue('escrow.execution.callback.received', data.id, {
      release_decision_id,
      execution_status,
      event_id,
      external_reference,
    });

    return sendSuccess(res, { execution: data }, 'Callback accepted', 201);
  } catch (error) {
    await outboxService.moveToDeadLetter(
      'custodianWebhookController.receiveExecutionStatus',
      'escrow.execution.callback.received',
      req.body || {},
      error.message || 'Callback processing error'
    ).catch(() => {});
    return sendError(res, error.message || 'Failed to process callback', 500);
  }
};

