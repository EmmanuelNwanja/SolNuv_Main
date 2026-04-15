/**
 * SolNuv Verification Middleware
 * Enforces user verification for sensitive operations
 */

const { sendError } = require('../utils/responseHelper');

/**
 * Require user to be verified
 */
function requireVerified(req, res, next) {
  if (!req.user) return sendError(res, 'Authentication required', 401);

  const verificationStatus = req.user.verification_status;

  if (!verificationStatus || verificationStatus === 'unverified') {
    return sendError(res, 'Account verification required to access this feature.', 403, {
      code: 'VERIFICATION_REQUIRED',
      verification_status: verificationStatus || 'unverified',
      verification_url: '/settings/verification',
    });
  }

  if (verificationStatus === 'pending' || verificationStatus === 'pending_admin_review') {
    return sendError(res, 'Your verification is pending review. You will be notified once approved.', 403, {
      code: 'VERIFICATION_PENDING',
      verification_status: verificationStatus,
    });
  }

  if (verificationStatus === 'rejected') {
    return sendError(res, 'Your verification was rejected. Please submit a new verification request.', 403, {
      code: 'VERIFICATION_REJECTED',
      verification_status: verificationStatus,
      verification_url: '/settings/verification',
    });
  }

  next();
}

/**
 * Check if user has completed verification (passes or soft-fails)
 * Used for features that should work for all users including unverified
 * but show different UI/messages
 */
function checkVerificationStatus(req, res, next) {
  if (!req.user) return next();

  req.isVerified = req.user.verification_status === 'verified';
  req.verificationStatus = req.user.verification_status || 'unverified';
  next();
}

module.exports = { requireVerified, checkVerificationStatus };
