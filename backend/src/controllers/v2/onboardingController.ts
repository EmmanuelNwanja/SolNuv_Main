const supabase = require('../../config/database');
const { sendError, sendSuccess } = require('../../utils/responseHelper');

const ALLOWED_ACTOR_TYPES = [
  'installer',
  'epc',
  'financier',
  'recycler',
  'buyer',
  'regulator',
  'solnuv_admin',
];

exports.registerActorProfile = async (req, res) => {
  try {
    const {
      organization_name,
      actor_type,
      role_title = 'member',
      jurisdiction = 'NG',
      metadata = {},
    } = req.body || {};

    if (!organization_name || !actor_type) {
      return sendError(res, 'organization_name and actor_type are required', 400);
    }
    if (!ALLOWED_ACTOR_TYPES.includes(actor_type)) {
      return sendError(res, 'Invalid actor_type supplied', 400);
    }

    const { data: org, error: orgErr } = await supabase
      .from('v2_organizations')
      .insert({
        name: organization_name,
        organization_type: actor_type,
        jurisdiction,
        metadata,
      })
      .select('*')
      .single();
    if (orgErr) throw orgErr;

    const { data: membership, error: memErr } = await supabase
      .from('v2_org_memberships')
      .insert({
        organization_id: org.id,
        user_id: req.user.id,
        role_code: role_title,
      })
      .select('*')
      .single();
    if (memErr) throw memErr;

    return sendSuccess(res, {
      organization: org,
      membership,
      onboarding_gate_status: 'pending_verification',
      next_steps: [
        'Complete role-specific KYB/KYC artifacts',
        'Define operational scope and certifications',
        'Await role verification to unlock transactional modules',
      ],
    }, 'V2 actor profile registered', 201);
  } catch (error) {
    return sendError(res, error.message || 'Failed to register actor profile', 500);
  }
};

