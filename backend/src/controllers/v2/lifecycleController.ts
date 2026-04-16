const supabase = require('../../config/database');
const { sendError, sendSuccess } = require('../../utils/responseHelper');
const chainAdapter = require('../../services/v2/chainAdapterService');

exports.recordAssetEvent = async (req, res) => {
  try {
    const {
      organization_id,
      project_id,
      asset_unit_id = null,
      event_type,
      event_payload = {},
    } = req.body || {};

    if (!organization_id || !project_id || !event_type) {
      return sendError(res, 'organization_id, project_id, and event_type are required', 400);
    }

    const attestation = await chainAdapter.anchorAttestation({
      type: 'asset_event',
      organization_id,
      project_id,
      asset_unit_id,
      event_type,
      event_payload,
      actor_user_id: req.user.id,
    });

    const { data, error } = await supabase
      .from('v2_asset_events')
      .insert({
        organization_id,
        project_id,
        asset_unit_id,
        event_type,
        event_payload,
        evidence_hash: attestation.payload_hash,
        actor_user_id: req.user.id,
      })
      .select('*')
      .single();
    if (error) throw error;

    return sendSuccess(res, { event: data, attestation }, 'Lifecycle event recorded', 201);
  } catch (error) {
    return sendError(res, error.message || 'Failed to record lifecycle event', 500);
  }
};

exports.listAssetEvents = async (req, res) => {
  try {
    const { organization_id, project_id, asset_unit_id } = req.query;
    if (!organization_id) return sendError(res, 'organization_id is required', 400);

    let query = supabase
      .from('v2_asset_events')
      .select('*')
      .eq('organization_id', organization_id)
      .order('created_at', { ascending: false })
      .limit(500);

    if (project_id) query = query.eq('project_id', project_id);
    if (asset_unit_id) query = query.eq('asset_unit_id', asset_unit_id);

    const { data, error } = await query;
    if (error) throw error;
    return sendSuccess(res, data || []);
  } catch (error) {
    return sendError(res, error.message || 'Failed to list lifecycle events', 500);
  }
};

