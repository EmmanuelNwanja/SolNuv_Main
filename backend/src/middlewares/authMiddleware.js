/**
 * SolNuv Auth Middleware
 * Verifies Supabase JWT tokens
 */

const { createClient } = require('@supabase/supabase-js');
const supabase = require('../config/database');
const { sendError } = require('../utils/responseHelper');

// Public Supabase client for token verification
const supabasePublic = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

/**
 * Require authenticated user
 */
async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendError(res, 'No authentication token provided', 401);
    }

    const token = authHeader.replace('Bearer ', '');

    // Verify token with Supabase
    const { data: { user }, error } = await supabasePublic.auth.getUser(token);

    if (error || !user) {
      return sendError(res, 'Invalid or expired token', 401);
    }

    // Get our internal user record
    const { data: dbUser, error: dbError } = await supabase
      .from('users')
      .select('*, companies:companies!users_company_id_fkey(*)')
      .eq('supabase_uid', user.id)
      .single();

    if (dbError || !dbUser) {
      // User authenticated but no profile yet - provide minimal info
      req.supabaseUser = user;
      req.user = null;
      req.isNewUser = true;
      return next();
    }

    req.supabaseUser = user;
    req.user = dbUser;
    req.company = dbUser.companies;
    next();
  } catch (err) {
    return sendError(res, 'Authentication error', 500);
  }
}

/**
 * Require user to have a complete profile
 */
async function requireProfile(req, res, next) {
  if (!req.user) {
    return sendError(res, 'Incomplete profile - please complete onboarding at /onboarding', 403, { 
      code: 'PROFILE_INCOMPLETE',
      redirect_to: '/onboarding'
    });
  }
  next();
}

/**
 * Require specific organization role
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) return sendError(res, 'Authentication required', 401);

    if (!allowedRoles.includes(req.user.role)) {
      return sendError(res, `This action requires ${allowedRoles.join(' or ')} role`, 403);
    }
    next();
  };
}

/**
 * Require user to be in the same company as the resource
 */
function requireSameCompany(req, res, next) {
  if (!req.user) return sendError(res, 'Authentication required', 401);
  // Company check is done in individual controller queries
  next();
}

/**
 * Optional auth - attach user if token present but don't fail if not
 */
async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabasePublic.auth.getUser(token);

    if (user) {
      const { data: dbUser } = await supabase
        .from('users')
        .select('*, companies:companies!users_company_id_fkey(*)')
        .eq('supabase_uid', user.id)
        .single();
      req.user = dbUser;
      req.company = dbUser?.companies;
    }
  } catch (err) {
    // Silent fail for optional auth
  }
  next();
}

module.exports = { requireAuth, requireProfile, requireRole, requireSameCompany, optionalAuth };
