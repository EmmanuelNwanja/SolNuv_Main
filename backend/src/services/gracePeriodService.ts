/**
 * Shared grace period calculation helpers.
 *
 * Subscription expiry logic is:
 *   - subscription_expires_at  → "soft" expiry (plan still active but is_in_grace_period)
 *   - subscription_grace_until → "hard" cutoff (7 days after soft expiry; features blocked)
 *
 * Previously this logic was duplicated in subscriptionMiddleware, agentMiddleware,
 * and authController. All callers should use these helpers instead.
 */

/**
 * Returns true if the subscription has passed its hard cutoff (grace period exhausted).
 * @param {object} company – company record from DB (or req.company / req.user.companies)
 * @returns {boolean}
 */
function isSubscriptionHardExpired(company) {
  if (!company) return false;
  if (company.subscription_plan === 'free') return false;

  const graceUntil = company.subscription_grace_until;
  const expiresAt  = company.subscription_expires_at;
  const hardCutoff = graceUntil ? new Date(graceUntil) : (expiresAt ? new Date(expiresAt) : null);

  return !!(hardCutoff && hardCutoff < new Date());
}

/**
 * Returns a detailed expiry status object with grace period awareness.
 * Used where code needs to distinguish between soft-expired and hard-expired states.
 * @param {object} company – company record
 * @returns {{ isHardExpired: boolean, isInGracePeriod: boolean, effectivePlan: string }}
 */
function getSubscriptionExpiryStatus(company) {
  if (!company || company.subscription_plan === 'free') {
    return { isHardExpired: false, isInGracePeriod: false, effectivePlan: 'free' };
  }

  const graceUntil  = company.subscription_grace_until;
  const expiresAt   = company.subscription_expires_at;
  const now         = new Date();
  const hardCutoff  = graceUntil ? new Date(graceUntil) : (expiresAt ? new Date(expiresAt) : null);
  const softExpired = expiresAt && new Date(expiresAt) < now;
  const hardExpired = !!(hardCutoff && hardCutoff < now);

  if (hardExpired) {
    return { isHardExpired: true, isInGracePeriod: false, effectivePlan: 'free' };
  }
  if (softExpired) {
    return { isHardExpired: false, isInGracePeriod: true, effectivePlan: company.subscription_plan };
  }
  return { isHardExpired: false, isInGracePeriod: false, effectivePlan: company.subscription_plan };
}

module.exports = { isSubscriptionHardExpired, getSubscriptionExpiryStatus };
