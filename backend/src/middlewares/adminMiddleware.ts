const supabase = require('../config/database');
const { sendError } = require('../utils/responseHelper');

async function requireAdmin(req, res, next) {
  try {
    if (!req.user) return sendError(res, 'Authentication required', 401);

    const { data: admin } = await supabase
      .from('admin_users')
      .select('id, role, is_active, can_manage_admins')
      .eq('user_id', req.user.id)
      .eq('is_active', true)
      .single();

    if (!admin) {
      return sendError(res, 'Admin access required', 403, { code: 'ADMIN_ACCESS_REQUIRED' });
    }

    req.admin = admin;
    return next();
  } catch (error) {
    return sendError(res, 'Failed to validate admin access', 500);
  }
}

function requireAdminRole(...roles) {
  return (req, res, next) => {
    if (!req.admin) return sendError(res, 'Admin access required', 403);
    if (!roles.includes(req.admin.role)) {
      return sendError(res, `This action requires ${roles.join(' or ')} admin role`, 403);
    }
    return next();
  };
}

module.exports = { requireAdmin, requireAdminRole };
