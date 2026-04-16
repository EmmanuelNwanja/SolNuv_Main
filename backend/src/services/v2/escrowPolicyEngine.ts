/**
 * @param {any} input
 */
function evaluateEscrowDecision(input) {
  const payload = input || {};
  const policy_version = payload.policy_version || 'v2.0.0';
  const condition_flags = payload.condition_flags || {};
  const release_amount_ngn = Number(payload.release_amount_ngn || 0);
  const hold_amount_ngn = Number(payload.hold_amount_ngn || 0);

  const requiredFlags = [
    'serials_validated',
    'decommission_request_present',
    'recycler_certificate_present',
    'custody_chain_complete',
    'evidence_bundle_attested',
  ];

  const failed = requiredFlags.filter((flag) => condition_flags[flag] !== true);
  let decision_type = 'RELEASE_APPROVED';
  if (failed.length > 0 && release_amount_ngn > 0) decision_type = 'PARTIAL_RELEASE';
  if (failed.length > 0 && release_amount_ngn <= 0) decision_type = 'HOLD';

  const rationale = failed.length
    ? `Blocked conditions: ${failed.join(', ')}`
    : 'All escrow release conditions satisfied.';

  return {
    decision_type,
    policy_version,
    failed_conditions: failed,
    approved_release_amount_ngn: Number(release_amount_ngn || 0),
    approved_hold_amount_ngn: Number(hold_amount_ngn || 0),
    rationale,
  };
}

module.exports = {
  evaluateEscrowDecision,
};

