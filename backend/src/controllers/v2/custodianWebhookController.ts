const supabase = require('../../config/database');
const { sendError, sendSuccess } = require('../../utils/responseHelper');
const { verifyPayloadSignature } = require('../../services/v2/signatureService');

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
      external_reference = null,
      executed_at = new Date().toISOString(),
      payload = {},
    } = req.body || {};

    if (!release_decision_id || !execution_status) {
      return sendError(res, 'release_decision_id and execution_status are required', 400);
    }

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

    return sendSuccess(res, { execution: data }, 'Callback accepted', 201);
  } catch (error) {
    return sendError(res, error.message || 'Failed to process callback', 500);
  }
};

