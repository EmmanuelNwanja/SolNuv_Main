const supabase = require('../config/database');
const { sendError } = require('../utils/responseHelper');

async function requireV2Membership(req, res, next) {
  try {
    const organizationId = req.body?.organization_id || req.query?.organization_id || req.params?.organizationId;
    if (!organizationId) return sendError(res, 'organization_id is required for V2 access', 400);

    const { data, error } = await supabase
      .from('v2_org_memberships')
      .select('id, role_code, organization_id')
      .eq('organization_id', organizationId)
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (error) throw error;
    if (!data) return sendError(res, 'You are not a member of this V2 organization', 403);

    req.v2Membership = data;
    next();
  } catch (error) {
    return sendError(res, error.message || 'Failed to verify V2 membership', 500);
  }
}

function requireV2Role(...allowedRoles) {
  return (req, res, next) => {
    const role = req.v2Membership?.role_code;
    if (!role) return sendError(res, 'V2 membership context missing', 403);
    if (!allowedRoles.includes(role)) {
      return sendError(res, `This action requires one of: ${allowedRoles.join(', ')}`, 403);
    }
    next();
  };
}

module.exports = {
  requireV2Membership,
  requireV2Role,
};

