const supabase = require('../../config/database');
const { sendError, sendSuccess } = require('../../utils/responseHelper');

exports.createPolicyTemplate = async (req, res) => {
  try {
    const {
      organization_id,
      template_name,
      policy_version = 'v2.0.0',
      required_conditions = [],
      penalty_mode = 'hold',
      metadata = {},
    } = req.body || {};

    if (!organization_id || !template_name) {
      return sendError(res, 'organization_id and template_name are required', 400);
    }

    const { data, error } = await supabase
      .from('v2_escrow_policy_templates')
      .insert({
        organization_id,
        template_name,
        policy_version,
        required_conditions,
        penalty_mode,
        metadata,
        created_by: req.user.id,
      })
      .select('*')
      .single();
    if (error) throw error;

    return sendSuccess(res, data, 'Escrow policy template created', 201);
  } catch (error) {
    return sendError(res, error.message || 'Failed to create policy template', 500);
  }
};

exports.listPolicyTemplates = async (req, res) => {
  try {
    const organizationId = req.query.organization_id;
    if (!organizationId) return sendError(res, 'organization_id is required', 400);

    const { data, error } = await supabase
      .from('v2_escrow_policy_templates')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });
    if (error) throw error;

    return sendSuccess(res, data || []);
  } catch (error) {
    return sendError(res, error.message || 'Failed to list policy templates', 500);
  }
};

