/**
 * SolNuv Auth Middleware
 * Verifies Supabase JWT tokens
 */

const { createClient } = require('@supabase/supabase-js');
const supabase = require('../config/database');
const { sendError } = require('../utils/responseHelper');
const logger = require('../utils/logger');

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

    // Get our internal user record (companies join via explicit FK to avoid ambiguity)
    let dbUser = null;
    const { data: dbUserWithCompany, error: dbError } = await supabase
      .from('users')
      .select('*, companies:companies!users_company_id_fkey(*)')
      .eq('supabase_uid', user.id)
      .single();

    if (dbError) {
      // FK join failed (e.g. FK name differs in this environment) — fall back to plain user query
      const { data: plainUser, error: plainError } = await supabase
        .from('users')
        .select('*')
        .eq('supabase_uid', user.id)
        .single();

      if (!plainError && plainUser) {
        dbUser = plainUser;
      }
    } else {
      dbUser = dbUserWithCompany;
    }

    // Legacy user fallback: find by email and link supabase_uid
    // Use ilike for case-insensitive match and trim for whitespace
    if (!dbUser && user.email) {
      const normalizedEmail = user.email.toLowerCase().trim();
      
      const { data: legacyUser, error: legacyError } = await supabase
        .from('users')
        .select('*, companies:companies!users_company_id_fkey(*)')
        .ilike('email', normalizedEmail)
        .maybeSingle();

      if (!legacyError && legacyUser) {
        // Security guard: only link if the Supabase account has a confirmed email.
        // An attacker could create a Supabase account with an unconfirmed email matching
        // a legacy user's address and silently hijack their profile.
        if (!user.email_confirmed_at) {
          // Refuse to link until email is confirmed — treat as new unprovisioned user
          req.supabaseUser = user;
          req.user = null;
          req.isNewUser = true;
          return next();
        }

        // Link supabase_uid to existing legacy user
        await supabase
          .from('users')
          .update({ supabase_uid: user.id })
          .eq('id', legacyUser.id);
        
        // Re-fetch to get updated data with supabase_uid
        const { data: updatedUser } = await supabase
          .from('users')
          .select('*, companies:companies!users_company_id_fkey(*)')
          .eq('id', legacyUser.id)
          .single();
        
        dbUser = updatedUser || { ...legacyUser, supabase_uid: user.id };
      }
    }

    if (!dbUser) {
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
      const { data: dbUserWithCompany, error: dbError } = await supabase
        .from('users')
        .select('*, companies:companies!users_company_id_fkey(*)')
        .eq('supabase_uid', user.id)
        .single();

      if (!dbError && dbUserWithCompany) {
        req.user = dbUserWithCompany;
        req.company = dbUserWithCompany?.companies;
      } else {
        // FK fallback
        const { data: plainUser } = await supabase
          .from('users')
          .select('*')
          .eq('supabase_uid', user.id)
          .single();
        req.user = plainUser;
        req.company = null;
      }
    }
  } catch (err) {
    // Log the error so it surfaces in monitoring, but don't fail the request
    // since auth is optional on these endpoints.
    logger.error('optionalAuth error', { message: err.message });
  }
  next();
}

module.exports = { requireAuth, requireProfile, requireRole, requireSameCompany, optionalAuth };
