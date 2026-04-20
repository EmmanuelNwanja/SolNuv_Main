/**
 * SolNuv Auth Controller
 * Handles user registration, login, onboarding, profile creation
 */

const supabase = require('../config/database');
const { sendSuccess, sendError } = require('../utils/responseHelper');
const { sendWelcomeNotification } = require('../services/notificationService');
const { sendSms, normalizePhone } = require('../services/termiiService');
const { sendTeamInvitation } = require('../services/emailService');
const logger = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

// Temporary incident diagnostics for targeted login tracing.
const AUTH_DEBUG_EMAIL = String(process.env.AUTH_DEBUG_EMAIL || 'emmanuelnwanja@gmail.com').toLowerCase();
function shouldTraceAuth(email) {
  return String(email || '').toLowerCase().trim() === AUTH_DEBUG_EMAIL;
}

async function fetchPartnerMembershipsForUser(userId) {
  if (!userId) return [];
  const { data, error } = await supabase
    .from('v2_org_memberships')
    .select(
      'role_code, v2_organizations ( id, name, organization_type, verification_status, jurisdiction )',
    )
    .eq('user_id', userId);
  if (error || !data) return [];
  return data
    .map((row) => ({
      role_code: row.role_code,
      organization:
        row.v2_organizations && typeof row.v2_organizations === 'object' ? row.v2_organizations : null,
    }))
    .filter((m) => m.organization);
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70);
}

function sanitizeLeaderboardDisplayName(value) {
  const cleaned = String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned ? cleaned.slice(0, 120) : null;
}

function isPartnerUserType(value) {
  return ['recycler', 'financier', 'training_institute'].includes(String(value || ''));
}

async function ensurePartnerCompanyContext(userRow) {
  if (!userRow || !isPartnerUserType(userRow.user_type)) return { user: userRow, company: null };
  if (userRow.company_id) {
    const { data: existingCompany } = await supabase
      .from('companies')
      .select('*')
      .eq('id', userRow.company_id)
      .maybeSingle();
    return { user: userRow, company: existingCompany || null };
  }

  const fallbackName =
    String(userRow.brand_name || '').trim() ||
    `${String(userRow.first_name || 'Partner').trim()} Workspace`;

  const { data: newCompany, error: createErr } = await supabase
    .from('companies')
    .insert({
      name: fallbackName,
      email: userRow.email,
      user_type: userRow.user_type,
      business_type: userRow.business_type || 'solo',
      subscription_plan: 'free',
      max_team_members: 2,
    })
    .select('*')
    .single();
  if (createErr) throw createErr;

  await supabase
    .from('users')
    .update({
      company_id: newCompany.id,
      role: userRow.role || 'super_admin',
      updated_at: new Date().toISOString(),
    })
    .eq('id', userRow.id);

  return {
    user: { ...userRow, company_id: newCompany.id, role: userRow.role || 'super_admin' },
    company: newCompany,
  };
}

async function ensureUniquePublicSlug(base, userId = null) {
  const fallback = `engineer-${uuidv4().slice(0, 8)}`;
  const normalized = slugify(base) || fallback;

  let candidate = normalized;
  let suffix = 1;

  while (suffix <= 50) {
    let query = supabase
      .from('users')
      .select('id')
      .eq('public_slug', candidate)
      .limit(1);

    if (userId) query = query.neq('id', userId);

    const { data } = await query;
    if (!data || data.length === 0) return candidate;

    suffix += 1;
    candidate = `${normalized}-${suffix}`;
  }

  return `${normalized}-${uuidv4().slice(0, 6)}`;
}

/**
 * POST /api/auth/profile
 * Called after Supabase auth to create/update user profile
 */
exports.createOrUpdateProfile = async (req, res) => {
  try {
    const { supabaseUser } = req;
    const {
      first_name, last_name, phone,
      user_type, business_type,
      brand_name, // for solo
      company_name, company_email, company_address, company_state, company_city,
      nesrea_registration_number,
      address,
      city,
      website,
      logo_url,
      signature_url,
      company_signature_url,
      branding_primary_color,
      notification_preferences,
      public_slug,
      public_bio,
      is_public_profile,
      leaderboard_public_display_enabled,
      leaderboard_public_display_name,
    } = req.body;

    if (!first_name) return sendError(res, 'First name is required', 400);
    if (!user_type) return sendError(res, 'User type is required', 400);

    // Pre-fetch existing user row so we can reuse their company_id and avoid
    // accidentally creating a duplicate company (which would revert a paid plan to free).
    // First try by supabase_uid, then fallback to email for legacy users without supabase_uid
    let { data: preCheckUser } = await supabase
      .from('users')
      .select('id, company_id')
      .eq('supabase_uid', supabaseUser.id)
      .maybeSingle();
    
    // Legacy user fallback: find by email and link supabase_uid
    // Use ilike for case-insensitive match and trim for whitespace
    if (!preCheckUser) {
      const normalizedEmail = supabaseUser.email.toLowerCase().trim();
      
      const { data: legacyUser } = await supabase
        .from('users')
        .select('id, company_id')
        .ilike('email', normalizedEmail)
        .maybeSingle();
      
      if (legacyUser) {
        // Link supabase_uid to existing legacy user
        await supabase
          .from('users')
          .update({ supabase_uid: supabaseUser.id })
          .eq('id', legacyUser.id);
        preCheckUser = { ...legacyUser, supabase_uid: supabaseUser.id };
      }
    }

    let companyId = null;
    const isPartnerType = isPartnerUserType(user_type);

    // Create company if registered business
    if (business_type === 'registered') {
      if (!company_name) return sendError(res, 'Company name is required for registered businesses', 400);

      if (preCheckUser?.company_id) {
        // Existing user — always use their current company to preserve subscription plan.
        // Never do an email-based lookup/create path here; that path can create a brand-new
        // free company and overwrite the user's paid plan.
        companyId = preCheckUser.company_id;

        // Solo → registered upgrade path: update the company's identity fields so the
        // real registered name/email replaces any generated name (e.g. "John's Workspace"
        // created by ensureCompanyForBilling).  Subscription/billing columns are untouched.
        await supabase
          .from('companies')
          .update({
            name: company_name,
            business_type: 'registered',
            ...(company_email ? { email: company_email } : {}),
          })
          .eq('id', companyId);
      } else {
        // New registration — find or create company by email
        const { data: existingCompany } = await supabase
          .from('companies')
          .select('id')
          .eq('email', company_email || supabaseUser.email)
          .maybeSingle();

        if (existingCompany) {
          companyId = existingCompany.id;
        } else {
          const { data: newCompany, error: companyError } = await supabase
            .from('companies')
            .insert({
              name: company_name,
              email: company_email || supabaseUser.email,
              address: company_address,
              state: company_state,
              city: company_city,
              user_type,
              business_type: 'registered',
              subscription_plan: 'free',
              max_team_members: isPartnerType ? 2 : 1,
            })
            .select()
            .single();

          if (companyError) throw companyError;
          companyId = newCompany.id;
        }
      }

      // Keep company profile details in sync from settings edits
    }

    // Partner users should always have at least a base company profile so team/settings work.
    if (isPartnerType && !companyId && !preCheckUser?.company_id) {
      const fallbackCompanyName =
        String(company_name || brand_name || '').trim() || `${String(first_name || 'Partner').trim()} Workspace`;
      const { data: partnerCompany, error: partnerCompanyError } = await supabase
        .from('companies')
        .insert({
          name: fallbackCompanyName,
          email: company_email || supabaseUser.email,
          user_type,
          business_type: business_type || 'solo',
          subscription_plan: 'free',
          max_team_members: 2,
        })
        .select()
        .single();
      if (partnerCompanyError) throw partnerCompanyError;
      companyId = partnerCompany.id;
    }

    // Sync company details for ALL users who have a company — including solo users whose
    // billing company was created by ensureCompanyForBilling (Paystack upgrade path).
    // Running this outside the 'registered' block means solo upgraders can also update
    // their company/branding fields from Settings without being silently ignored.
    // Use conditional spreads (not `|| undefined`) so empty strings clear fields to null.
    const resolvedCompanyId = companyId ?? preCheckUser?.company_id;
    const hasCompanyFields = [
      company_address, address, company_state, company_city, city,
      nesrea_registration_number, website, logo_url, company_signature_url,
      branding_primary_color, notification_preferences,
    ].some((f) => f !== undefined);

    if (resolvedCompanyId && hasCompanyFields) {
      const companyUpdate = {
        ...(company_address !== undefined || address !== undefined
          ? { address: company_address || address || null } : {}),
        ...(company_state !== undefined ? { state: company_state || null } : {}),
        ...(company_city !== undefined || city !== undefined
          ? { city: company_city || city || null } : {}),
        ...(nesrea_registration_number !== undefined
          ? { nesrea_registration_number: nesrea_registration_number || null } : {}),
        ...(website !== undefined ? { website: website || null } : {}),
        ...(logo_url !== undefined ? { logo_url: logo_url || null } : {}),
        ...(company_signature_url !== undefined
          ? { company_signature_url: company_signature_url || null } : {}),
        ...(branding_primary_color !== undefined
          ? { branding_primary_color: branding_primary_color || null } : {}),
        ...(notification_preferences !== undefined
          ? { notification_preferences } : {}),
      };

      if (Object.keys(companyUpdate).length > 0) {
        const { error: companyUpdateError } = await supabase
          .from('companies')
          .update(companyUpdate)
          .eq('id', resolvedCompanyId);
        if (companyUpdateError) {
          logger.warn('Company profile update failed', {
            company_id: resolvedCompanyId,
            error: companyUpdateError.message,
          });
        }
      }
    }

    if (isPartnerType && resolvedCompanyId) {
      const { data: companyRow } = await supabase
        .from('companies')
        .select('id, max_team_members')
        .eq('id', resolvedCompanyId)
        .maybeSingle();
      const currentSeats = Number(companyRow?.max_team_members || 0);
      if (currentSeats < 2) {
        await supabase
          .from('companies')
          .update({ max_team_members: 2, updated_at: new Date().toISOString() })
          .eq('id', resolvedCompanyId);
      }
    }

    // Check if user profile exists (reuse pre-check result to avoid a duplicate query)
    const existingUser = preCheckUser;

    let user;

    if (existingUser) {
      const resolvedSlug = await ensureUniquePublicSlug(
        public_slug || brand_name || `${first_name}-${last_name || ''}`,
        existingUser.id
      );

      // Update existing profile
      const { data: updatedUser, error } = await supabase
        .from('users')
        .update({
          first_name,
          last_name,
          phone,
          user_type,
          business_type,
          brand_name,
          // Only update company_id when we actually resolved one; never null it out
          ...(companyId !== null ? { company_id: companyId } : {}),
          signature_url: signature_url || undefined,
          notification_preferences: notification_preferences || undefined,
          public_slug: resolvedSlug,
          public_bio: public_bio || undefined,
          is_public_profile: typeof is_public_profile === 'boolean' ? is_public_profile : undefined,
          leaderboard_public_display_enabled:
            typeof leaderboard_public_display_enabled === 'boolean'
              ? leaderboard_public_display_enabled
              : undefined,
          leaderboard_public_display_name:
            leaderboard_public_display_name !== undefined
              ? sanitizeLeaderboardDisplayName(leaderboard_public_display_name)
              : undefined,
          is_onboarded: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingUser.id)
        .select('*, companies:companies!users_company_id_fkey(*)')
        .single();

      if (error) throw error;
      user = updatedUser;
    } else {
      const resolvedSlug = await ensureUniquePublicSlug(
        public_slug || brand_name || `${first_name}-${last_name || ''}`
      );

      // Create new profile
      const { data: newUser, error } = await supabase
        .from('users')
        .insert({
          supabase_uid: supabaseUser.id,
          email: supabaseUser.email,
          first_name,
          last_name,
          phone,
          user_type,
          business_type,
          brand_name,
          company_id: companyId,
          role: companyId ? 'super_admin' : 'super_admin',
          avatar_url: supabaseUser.user_metadata?.avatar_url,
          signature_url: signature_url || null,
          public_slug: resolvedSlug,
          public_bio: public_bio || null,
          is_public_profile: typeof is_public_profile === 'boolean' ? is_public_profile : true,
          leaderboard_public_display_enabled:
            typeof leaderboard_public_display_enabled === 'boolean'
              ? leaderboard_public_display_enabled
              : false,
          leaderboard_public_display_name: sanitizeLeaderboardDisplayName(leaderboard_public_display_name),
          is_onboarded: true,
          verification_status: 'unverified',
        })
        .select('*, companies:companies!users_company_id_fkey(*)')
        .single();

      if (error) throw error;
      user = newUser;

      // Send welcome notification via Termii
      sendWelcomeNotification(newUser).catch(console.error);
    }

    return sendSuccess(res, user, 'Profile saved successfully', 200);
  } catch (error) {
    console.error('Profile error:', error);
    return sendError(res, error.message || 'Failed to save profile', 500);
  }
};

/**
 * GET /api/auth/me
 * Get current user profile
 */
exports.getMe = async (req, res) => {
  try {
    if (shouldTraceAuth(req.supabaseUser?.email || req.user?.email)) {
      logger.info('[auth-trace] getMe entered', {
        email: String(req.supabaseUser?.email || req.user?.email || '').toLowerCase(),
        req_is_new_user: !!req.isNewUser,
        has_req_user: !!req.user,
      });
    }

    if (req.isNewUser || !req.user) {
      // Defensive fallback for legacy rows: on fresh logins a user may be marked as
      // new before their existing record is linked to supabase_uid.
      const normalizedEmail = String(req.supabaseUser?.email || '').toLowerCase().trim();
      if (normalizedEmail) {
        const { data: legacyUsers, error: legacyError } = await supabase
          .from('users')
          .select('*, companies:companies!users_company_id_fkey(*)')
          .ilike('email', normalizedEmail)
          .order('created_at', { ascending: true })
          .limit(1);

        const legacyUser = !legacyError && Array.isArray(legacyUsers) ? legacyUsers[0] : null;
        if (legacyUser) {
          if (shouldTraceAuth(normalizedEmail)) {
            logger.info('[auth-trace] getMe legacy fallback hit', {
              email: normalizedEmail,
              legacy_user_id: legacyUser.id,
              legacy_is_onboarded: legacyUser.is_onboarded === true,
              has_first_name: !!legacyUser.first_name,
              has_user_type: !!legacyUser.user_type,
            });
          }

          if (!legacyUser.supabase_uid && req.supabaseUser?.id) {
            await supabase
              .from('users')
              .update({ supabase_uid: req.supabaseUser.id })
              .eq('id', legacyUser.id);

            if (shouldTraceAuth(normalizedEmail)) {
              logger.info('[auth-trace] getMe linked legacy supabase_uid', {
                email: normalizedEmail,
                legacy_user_id: legacyUser.id,
                supabase_uid: req.supabaseUser.id,
              });
            }
          }

          const isOnboarded = !!(
            legacyUser.is_onboarded ||
            (legacyUser.first_name && String(legacyUser.first_name).trim() && legacyUser.user_type)
          );

          if (shouldTraceAuth(normalizedEmail)) {
            logger.info('[auth-trace] getMe returning legacy fallback user', {
              email: normalizedEmail,
              legacy_user_id: legacyUser.id,
              computed_is_onboarded: isOnboarded,
            });
          }

          const partner_memberships = await fetchPartnerMembershipsForUser(legacyUser.id);
          return sendSuccess(res, {
            ...legacyUser,
            is_onboarded: isOnboarded,
            partner_memberships,
          });
        }
      }

      if (shouldTraceAuth(normalizedEmail)) {
        logger.info('[auth-trace] getMe returning minimal new-user payload', {
          email: normalizedEmail,
          supabase_uid: req.supabaseUser?.id || null,
        });
      }

      return sendSuccess(res, {
        supabase_uid: req.supabaseUser?.id,
        email: req.supabaseUser?.email,
        avatar_url: req.supabaseUser?.user_metadata?.avatar_url,
        is_onboarded: false,
      });
    }

    // Get fresh data with related info
    const { data: user, error } = await supabase
      .from('users')
      .select('*, companies:companies!users_company_id_fkey(*)')
      .eq('id', req.user.id)
      .single();

    if (error) throw error;

    // Keep onboarding truth stable for legacy rows with complete profile fields.
    user.is_onboarded = !!(
      user.is_onboarded ||
      (user.first_name && String(user.first_name).trim() && user.user_type)
    );

    if (shouldTraceAuth(user.email)) {
      logger.info('[auth-trace] getMe returning persisted user', {
        email: String(user.email || '').toLowerCase(),
        user_id: user.id,
        computed_is_onboarded: user.is_onboarded === true,
        has_first_name: !!user.first_name,
        has_user_type: !!user.user_type,
      });
    }

    // Compute effective subscription plan and grace state.
    // Hard cutoff = subscription_grace_until (7 days after expiry).
    // If still within grace period: plan stays active but is_in_grace_period = true.
    // After grace period: plan downgraded to 'free' (does NOT modify DB).
    if (user.companies && user.companies.subscription_plan !== 'free') {
      const graceUntil = user.companies.subscription_grace_until;
      const expiresAt  = user.companies.subscription_expires_at;
      const now        = new Date();
      const hardCutoff = graceUntil ? new Date(graceUntil) : (expiresAt ? new Date(expiresAt) : null);
      const softExpired = expiresAt && new Date(expiresAt) < now;

      if (hardCutoff && hardCutoff < now) {
        // Past grace period → treat as free
        user.companies = {
          ...user.companies,
          subscription_plan: 'free',
          subscription_interval: null,
          subscription_auto_renew: false,
          is_in_grace_period: false,
        };
      } else if (softExpired) {
        // Between subscription expiry and grace_until → active but in grace
        user.companies = { ...user.companies, is_in_grace_period: true };
      } else {
        user.companies = { ...user.companies, is_in_grace_period: false };
      }
    } else if (user.companies) {
      user.companies = { ...user.companies, is_in_grace_period: false };
    }

    // Get unread notification count
    const { count: unreadCount } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_read', false);

    const { data: adminMembership } = await supabase
      .from('admin_users')
      .select('role, is_active, can_manage_admins')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single();

    const partner_memberships = await fetchPartnerMembershipsForUser(user.id);

    return sendSuccess(res, {
      ...user,
      unread_notifications: unreadCount || 0,
      is_platform_admin: !!adminMembership,
      platform_admin_role: adminMembership?.role || null,
      platform_admin_permissions: adminMembership || null,
      partner_memberships,
    });
  } catch (error) {
    logger.error('Failed to fetch profile', { user_id: req.user?.id || null, message: error.message });
    return sendError(res, 'Failed to fetch profile', 500);
  }
};

/**
 * GET /api/auth/profile-status
 * Check if user has completed onboarding (requireAuth but NOT requireProfile)
 */
exports.getProfileStatus = async (req, res) => {
  try {
    if (!req.user) {
      return sendSuccess(res, {
        is_onboarded: false,
        supabase_uid: req.supabaseUser?.id,
        email: req.supabaseUser?.email,
      });
    }

    const isOnboarded = !!(
      req.user &&
      req.user.first_name?.trim() &&
      req.user.user_type
    );

    return sendSuccess(res, {
      is_onboarded: isOnboarded,
      user_id: req.user.id,
      first_name: req.user.first_name,
      company_id: req.user.company_id,
    });
  } catch (error) {
    logger.error('Failed to check profile status', { user_id: req.user?.id || null, message: error.message });
    return sendError(res, 'Failed to check profile status', 500);
  }
};

/**
 * POST /api/auth/invite
 * Invite team member
 */
exports.inviteTeamMember = async (req, res) => {
  try {
    let actor = req.user;
    let actorCompany = req.company || req.user?.companies || null;
    if (!actor?.company_id && isPartnerUserType(actor?.user_type)) {
      const ensured = await ensurePartnerCompanyContext(actor);
      actor = ensured.user;
      actorCompany = ensured.company || actorCompany;
    }

    if (!actor?.company_id) return sendError(res, 'You need to be in a company to invite members', 400);
    if (!['super_admin', 'admin'].includes(actor.role)) return sendError(res, 'Only admins can invite members', 403);

    const { email, phone, role, invite_channel = 'sms' } = req.body;
    if (!email) return sendError(res, 'Email is required', 400);
    if (!['admin', 'manager'].includes(role)) return sendError(res, 'Invalid role. Use admin or manager', 400);

    // Create invitation token
    const { data: invite, error } = await supabase
      .from('team_invitations')
      .insert({
        company_id: actor.company_id,
        invited_by: actor.id,
        email,
        role,
      })
      .select()
      .single();

    if (error) throw error;

    const inviteLink = `https://solnuv.com/invite/${invite.token}`;
    const companyName = actorCompany?.name || actor?.companies?.name || 'your organization';

    if (phone) {
      const smsText = `SolNuv invite: ${actor.first_name} invited you as ${role} to ${companyName}. Accept: ${inviteLink}`;
      await sendSms({
        to: phone,
        message: smsText,
        channel: invite_channel === 'whatsapp' ? 'whatsapp' : 'generic',
      });
    } else {
      await sendTeamInvitation(
        email,
        `${actor.first_name} ${actor.last_name || ''}`.trim(),
        companyName,
        inviteLink,
        role
      );
    }

    return sendSuccess(res, { invite_id: invite.id, email, phone, role }, 'Invitation sent successfully');
  } catch (error) {
    logger.error('Failed to send team invitation', { user_id: req.user?.id || null, message: error.message });
    return sendError(res, 'Failed to send invitation', 500);
  }
};

/**
 * POST /api/auth/accept-invite/:token
 * Accept team invitation
 */
exports.acceptInvite = async (req, res) => {
  try {
    const { token } = req.params;

    const { data: invite, error } = await supabase
      .from('team_invitations')
      .select('*, companies(*)')
      .eq('token', token)
      .eq('accepted', false)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (error || !invite) return sendError(res, 'Invalid or expired invitation', 404);

    // Link user to company
    if (req.user) {
      await supabase.from('users').update({
        company_id: invite.company_id,
        role: invite.role,
      }).eq('id', req.user.id);

      await supabase.from('team_invitations').update({ accepted: true }).eq('id', invite.id);

      return sendSuccess(res, { company: invite.companies }, 'Successfully joined team');
    }

    // Return invite details for onboarding flow
    return sendSuccess(res, {
      email: invite.email,
      company_name: invite.companies?.name,
      role: invite.role,
      company_id: invite.company_id,
    }, 'Invitation valid');
  } catch (error) {
    logger.error('Failed to process team invitation', { user_id: req.user?.id || null, token: req.params?.token || null, message: error.message });
    return sendError(res, 'Failed to process invitation', 500);
  }
};

/**
 * GET /api/auth/team
 * Get organization team members
 */
exports.getTeamMembers = async (req, res) => {
  try {
    let actor = req.user;
    if (!actor?.company_id && isPartnerUserType(actor?.user_type)) {
      const ensured = await ensurePartnerCompanyContext(actor);
      actor = ensured.user;
    }
    if (!actor?.company_id) return sendError(res, 'No organization found', 404);

    const { data: members } = await supabase
      .from('users')
      .select('id, first_name, last_name, email, role, avatar_url, last_login_at, created_at')
      .eq('company_id', actor.company_id)
      .eq('is_active', true);

    const { data: pending } = await supabase
      .from('team_invitations')
      .select('email, role, created_at, expires_at')
      .eq('company_id', actor.company_id)
      .eq('accepted', false)
      .gt('expires_at', new Date().toISOString());

    const { data: company } = await supabase
      .from('companies')
      .select('id, max_team_members')
      .eq('id', actor.company_id)
      .maybeSingle();
    const isPartnerType = isPartnerUserType(actor.user_type);
    const baseLimit = Number(company?.max_team_members || 1);
    const effectiveMaxTeamMembers = isPartnerType ? Math.max(baseLimit, 2) : baseLimit;
    const memberCount = Array.isArray(members) ? members.length : 0;

    return sendSuccess(res, {
      members: members || [],
      pending_invitations: pending || [],
      effective_max_team_members: effectiveMaxTeamMembers,
      current_member_count: memberCount,
      limit_reached: memberCount >= effectiveMaxTeamMembers,
    });
  } catch (error) {
    logger.error('Failed to fetch team members', { user_id: req.user?.id || null, company_id: req.user?.company_id || null, message: error.message });
    return sendError(res, 'Failed to fetch team', 500);
  }
};

/**
 * GET /api/auth/notifications
 * ?mark_read=true to also mark all as read (called by the notifications page)
 */
exports.getNotifications = async (req, res) => {
  try {
    const { data: notifications } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(30);

    // Only mark as read when the notifications page explicitly requests it
    if (req.query.mark_read === 'true') {
      await supabase.from('notifications')
        .update({ is_read: true })
        .eq('user_id', req.user.id)
        .eq('is_read', false);
    }

    return sendSuccess(res, notifications || []);
  } catch (error) {
    logger.error('Failed to fetch notifications', { user_id: req.user?.id || null, message: error.message });
    return sendError(res, 'Failed to fetch notifications', 500);
  }
};

/**
 * PATCH /api/auth/notifications/:id/read
 * Mark a single notification as read for current user.
 */
exports.markNotificationRead = async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return sendError(res, 'Notification ID is required', 400);

    const { data, error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)
      .eq('user_id', req.user.id)
      .select('id, is_read')
      .maybeSingle();

    if (error) throw error;
    if (!data) return sendError(res, 'Notification not found', 404);

    return sendSuccess(res, data, 'Notification marked as read');
  } catch (error) {
    logger.error('Failed to mark notification read', {
      user_id: req.user?.id || null,
      notification_id: req.params?.id || null,
      message: error.message,
    });
    return sendError(res, 'Failed to update notification', 500);
  }
};

/**
 * POST /api/auth/password-reset/request
 */
exports.requestPasswordResetOtp = async (req, res) => {
  try {
    const { email, phone, channel = 'sms' } = req.body || {};
    if (!email || !phone) {
      return sendError(res, 'Email and phone are required', 400);
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const normalizedPhone = normalizePhone(phone);

    const { data: user } = await supabase
      .from('users')
      .select('id, phone')
      .eq('email', normalizedEmail)
      .single();

    if (!user) return sendError(res, 'Account not found', 404);

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + (10 * 60 * 1000));

    // Check for an existing valid (unused, non-expired) OTP to prevent accumulating
    // multiple simultaneous valid codes which would multiply the brute-force attack surface.
    const { data: existingOtp } = await supabase
      .from('password_reset_otps')
      .select('id')
      .eq('email', normalizedEmail)
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (existingOtp) {
      // Return a success-looking response so the client can proceed to verification,
      // but don't reveal whether we actually sent a new OTP or not.
      return sendSuccess(res, { expires_in_minutes: 10 }, 'OTP sent successfully');
    }

    await supabase
      .from('password_reset_otps')
      .insert({
        email: normalizedEmail,
        phone: normalizedPhone,
        otp_code: otp,
        channel: channel === 'whatsapp' ? 'whatsapp' : 'sms',
        expires_at: expiresAt.toISOString(),
      });

    const message = `Your SolNuv password reset code is ${otp}. It expires in 10 minutes.`;
    const sendResult = await sendSms({
      to: normalizedPhone,
      message,
      channel: channel === 'whatsapp' ? 'whatsapp' : 'generic',
    });

    if (!sendResult.success) {
      return sendError(res, sendResult.reason || 'Failed to send OTP', 500);
    }

    return sendSuccess(res, { expires_in_minutes: 10 }, 'OTP sent successfully');
  } catch (error) {
    logger.error('Failed to send password reset OTP', { email: req.body?.email || null, message: error.message });
    return sendError(res, 'Failed to send reset OTP', 500);
  }
};

/**
 * POST /api/auth/password-reset/verify
 */
exports.verifyPasswordResetOtp = async (req, res) => {
  try {
    const { email, otp } = req.body || {};
    if (!email || !otp) return sendError(res, 'Email and OTP are required', 400);

    const normalizedEmail = String(email).trim().toLowerCase();
    const nowIso = new Date().toISOString();

    const { data: row } = await supabase
      .from('password_reset_otps')
      .select('*')
      .eq('email', normalizedEmail)
      .eq('otp_code', String(otp).trim())
      .eq('used', false)
      .gt('expires_at', nowIso)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!row) return sendError(res, 'Invalid or expired OTP', 400);

    return sendSuccess(res, { verified: true }, 'OTP verified');
  } catch (error) {
    logger.error('Failed to verify password reset OTP', { email: req.body?.email || null, message: error.message });
    return sendError(res, 'Failed to verify OTP', 500);
  }
};

/**
 * POST /api/auth/password-reset/complete
 */
exports.completePasswordReset = async (req, res) => {
  try {
    const { email, otp, new_password } = req.body || {};
    if (!email || !otp || !new_password) {
      return sendError(res, 'Email, OTP, and new password are required', 400);
    }
    if (String(new_password).length < 8) {
      return sendError(res, 'Password must be at least 8 characters', 400);
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const nowIso = new Date().toISOString();

    // Atomically claim the OTP row — set used=true in one UPDATE with all filters.
    // Any concurrent request racing on the same OTP will see 0 rows returned.
    const { data: row, error: claimError } = await supabase
      .from('password_reset_otps')
      .update({ used: true })
      .eq('email', normalizedEmail)
      .eq('otp_code', String(otp).trim())
      .eq('used', false)
      .gt('expires_at', nowIso)
      .select()
      .maybeSingle();

    if (claimError || !row) return sendError(res, 'Invalid or expired OTP', 400);

    const { data: profile } = await supabase
      .from('users')
      .select('supabase_uid')
      .eq('email', normalizedEmail)
      .single();

    if (!profile?.supabase_uid) return sendError(res, 'User account not found', 404);

    const { error: resetError } = await supabase.auth.admin.updateUserById(
      profile.supabase_uid,
      { password: new_password }
    );

    if (resetError) {
      // Restore OTP as unused so the user can retry with the same code
      await supabase.from('password_reset_otps').update({ used: false }).eq('id', row.id);
      return sendError(res, resetError.message || 'Failed to update password', 500);
    }

    // Invalidate all existing sessions to protect against session hijacking
    // (attacker who had a stolen session can no longer access the account)
    try {
      await supabase.auth.admin.signOut(profile.supabase_uid, { scope: 'global' });
    } catch (signOutErr) {
      logger.warn('Failed to invalidate sessions after password reset', {
        supabase_uid: profile.supabase_uid,
        message: signOutErr.message,
      });
    }

    return sendSuccess(res, null, 'Password reset successful');
  } catch (error) {
    logger.error('Failed to complete password reset', { email: req.body?.email || null, message: error.message });
    return sendError(res, 'Failed to complete password reset', 500);
  }
};

/**
 * POST /api/auth/phone-verification/request
 * Send OTP for signup phone verification
 */
exports.requestPhoneVerificationOtp = async (req, res) => {
  try {
    const { phone, channel = 'sms' } = req.body || {};
    const fallbackPhone = req.supabaseUser?.user_metadata?.phone || null;
    const normalizedPhone = normalizePhone(phone || fallbackPhone);
    if (!normalizedPhone) return sendError(res, 'Phone number is required', 400);

    const email = String(req.supabaseUser?.email || '').toLowerCase();
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + (10 * 60 * 1000)).toISOString();

    // Prevent multiple valid OTPs from accumulating for the same user/phone
    const { data: existingPhoneOtp } = await supabase
      .from('phone_verification_otps')
      .select('id')
      .eq('supabase_uid', req.supabaseUser.id)
      .eq('phone', normalizedPhone)
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (existingPhoneOtp) {
      return sendSuccess(res, { phone: normalizedPhone, expires_in_minutes: 10 }, 'Verification OTP sent');
    }

    await supabase
      .from('phone_verification_otps')
      .insert({
        supabase_uid: req.supabaseUser.id,
        email,
        phone: normalizedPhone,
        otp_code: otp,
        channel: channel === 'whatsapp' ? 'whatsapp' : 'sms',
        expires_at: expiresAt,
      });

    const message = `Your SolNuv verification code is ${otp}. It expires in 10 minutes.`;
    const sendResult = await sendSms({
      to: normalizedPhone,
      message,
      channel: channel === 'whatsapp' ? 'whatsapp' : 'generic',
    });

    if (!sendResult.success) {
      return sendError(res, sendResult.reason || 'Failed to send OTP', 500);
    }

    return sendSuccess(res, { phone: normalizedPhone, expires_in_minutes: 10 }, 'Verification OTP sent');
  } catch (error) {
    logger.error('Failed to send phone verification OTP', { user_id: req.user?.id || null, supabase_uid: req.supabaseUser?.id || null, message: error.message });
    return sendError(res, 'Failed to send verification OTP', 500);
  }
};

/**
 * POST /api/auth/phone-verification/verify
 * Verify signup OTP and mark auth metadata phone_verified=true
 */
exports.verifyPhoneVerificationOtp = async (req, res) => {
  try {
    const { phone, otp } = req.body || {};
    if (!phone || !otp) return sendError(res, 'Phone and OTP are required', 400);

    const normalizedPhone = normalizePhone(phone);
    const normalizedEmail = String(req.supabaseUser?.email || '').toLowerCase();
    const nowIso = new Date().toISOString();

    // Atomically claim the phone verification OTP — prevents concurrent requests
    // from consuming the same OTP code twice (TOCTOU race condition).
    const { data: signupRow } = await supabase
      .from('phone_verification_otps')
      .update({ used: true })
      .eq('supabase_uid', req.supabaseUser.id)
      .eq('phone', normalizedPhone)
      .eq('otp_code', String(otp).trim())
      .eq('used', false)
      .gt('expires_at', nowIso)
      .select()
      .maybeSingle();

    // Fallback source: admin-generated OTPs are currently created in password_reset_otps.
    // Accepting them here allows account verification even when SMS providers are offline.
    let row = signupRow;
    let otpSource = 'phone_verification_otps';

    if (!row) {
      // Fallback: atomically claim an admin-generated OTP from password_reset_otps
      const { data: adminRow } = await supabase
        .from('password_reset_otps')
        .update({ used: true })
        .eq('email', normalizedEmail)
        .eq('phone', normalizedPhone)
        .eq('otp_code', String(otp).trim())
        .eq('used', false)
        .gt('expires_at', nowIso)
        .select()
        .maybeSingle();

      if (adminRow) {
        row = adminRow;
        otpSource = 'password_reset_otps';
      }
    }

    if (!row) return sendError(res, 'Invalid or expired OTP', 400);

    // Both paths above already set used=true atomically — no separate update needed.

    const existingMeta = req.supabaseUser?.user_metadata || {};
    const updateResult = await supabase.auth.admin.updateUserById(req.supabaseUser.id, {
      user_metadata: {
        ...existingMeta,
        phone: normalizedPhone,
        phone_verified: true,
        phone_verified_at: new Date().toISOString(),
      },
    });

    const metadataUpdated = !updateResult.error;

    if (req.user?.id) {
      await supabase
        .from('users')
        .update({ phone: normalizedPhone, updated_at: new Date().toISOString() })
        .eq('id', req.user.id);
    }

    return sendSuccess(res, {
      verified: true,
      phone: normalizedPhone,
      otp_source: otpSource,
      metadata_updated: metadataUpdated,
    }, metadataUpdated ? 'Phone verified successfully' : 'Phone verified. Metadata update will be retried client-side.');
  } catch (error) {
    logger.error('Failed to verify phone OTP', { user_id: req.user?.id || null, supabase_uid: req.supabaseUser?.id || null, message: error.message });
    return sendError(res, 'Failed to verify phone OTP', 500);
  }
};

/**
 * POST /api/auth/signup
 * Backend-mediated signup using Supabase Admin API to bypass client-side rate limits
 */
exports.signup = async (req, res) => {
  try {
    const { email, password, phone, business_type } = req.body;

    if (!email || !password || !phone) {
      return sendError(res, 'Email, password, and phone are required', 400);
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return sendError(res, 'Invalid email format', 400);
    }

    if (password.length < 8) {
      return sendError(res, 'Password must be at least 8 characters', 400);
    }

    const phoneRegex = /^(\+?234|0)[789][01]\d{8}$/;
    const cleanedPhone = (phone || '').replace(/\s/g, '');
    if (!phoneRegex.test(cleanedPhone)) {
      return sendError(res, 'Invalid Nigerian phone number format', 400);
    }

    // Check if email exists in our users table (profile records)
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase())
      .maybeSingle();

    if (existingUser) {
      return sendError(res, 'This email is already registered. Try signing in instead.', 409);
    }

    // Check if email exists in Supabase auth.users (might have Google account but no profile yet)
    try {
      const { data: existingAuthUser } = await supabase.auth.admin.findUserByEmail(email);
      if (existingAuthUser) {
        return sendError(res, 'An account with this email already exists. Please sign in using your existing login method.', 409);
      }
    } catch (authCheckError) {
      // findUserByEmail throws if user not found, which is expected - continue signup
      if (authCheckError.message !== 'User not found') {
        logger.warn('Auth user lookup failed', { message: authCheckError.message });
      }
    }

    const frontendUrl = process.env.FRONTEND_URL || 'https://solnuv.com';
    const redirectTo = `${frontendUrl}/auth/callback`;

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: email.toLowerCase(),
      password,
      email_confirm: true,
      user_metadata: {
        phone: cleanedPhone,
        business_type: business_type || 'solo',
      },
      data: {
        phone: cleanedPhone,
        business_type: business_type || 'solo',
      },
    });

    if (authError) {
      logger.error('Supabase signup error', { message: authError.message, code: authError.code });
      
      if (authError.code === 'signup_disabled') {
        return sendError(res, 'Account creation is currently disabled. Please try again later.', 503);
      }
      
      if (authError.message?.toLowerCase().includes('already') || authError.code === 'user_already_exists') {
        return sendError(res, 'An account with this email already exists. Please sign in using your existing login method.', 409);
      }
      
      return sendError(res, authError.message || 'Failed to create account', 500);
    }

    logger.info('User signup successful via backend', { user_id: authData.user.id, email });
    
    return sendSuccess(res, {
      user: { id: authData.user.id, email: authData.user.email },
      message: 'Account created successfully',
    });
  } catch (err) {
    logger.error('Signup error', { message: err.message, stack: err.stack });
    return sendError(res, 'An unexpected error occurred', 500);
  }
};

/**
 * GET /api/auth/verification-status
 * Get current user's verification status and documents
 */
exports.getVerificationStatus = async (req, res) => {
  try {
    if (!req.user) {
      return sendError(res, 'User profile not found', 404);
    }

    const { data: user } = await supabase
      .from('users')
      .select('verification_status, verification_requested_at, verified_at, verified_by, verification_notes, verification_rejection_reason')
      .eq('id', req.user.id)
      .single();

    const { data: documents } = await supabase
      .from('verification_documents')
      .select('id, document_type, file_url, original_filename, uploaded_at')
      .eq('user_id', req.user.id);

    return sendSuccess(res, {
      ...user,
      documents: documents || [],
    });
  } catch (error) {
    logger.error('Failed to get verification status', { user_id: req.user?.id, message: error.message });
    return sendError(res, 'Failed to get verification status', 500);
  }
};

/**
 * POST /api/auth/verification-request
 * Request verification (solo: self-attestation, company: CAC upload)
 */
exports.requestVerification = async (req, res) => {
  try {
    if (!req.user) {
      return sendError(res, 'User profile not found', 404);
    }

    const { notes, document_url, document_type, original_filename } = req.body;

    const userId = req.user.id;
    const businessType = req.user.business_type;

    // Check current status
    const { data: currentUser } = await supabase
      .from('users')
      .select('verification_status, business_type')
      .eq('id', userId)
      .single();

    if (currentUser?.verification_status === 'verified') {
      return sendError(res, 'Your account is already verified', 400);
    }

    if (currentUser?.verification_status === 'pending' || currentUser?.verification_status === 'pending_admin_review') {
      return sendError(res, 'Verification request already pending. Please wait for admin review.', 400);
    }

    // Solo users: self-attestation (no document required)
    // Company users: CAC document required
    if (businessType === 'registered') {
      if (!document_url) {
        return sendError(res, 'CAC certificate document is required for company verification', 400);
      }

      // Store verification document
      await supabase.from('verification_documents').insert({
        user_id: userId,
        document_type: 'cac_certificate',
        file_url: document_url,
        original_filename: original_filename || 'cac_certificate',
      });
    } else {
      // Solo users: create self-attestation record
      await supabase.from('verification_documents').insert({
        user_id: userId,
        document_type: 'solo_attestation',
        file_url: null,
        original_filename: null,
      });
    }

    // Update user verification status
    const newStatus = businessType === 'registered' ? 'pending_admin_review' : 'pending';
    const { error: updateError } = await supabase
      .from('users')
      .update({
        verification_status: newStatus,
        verification_requested_at: new Date().toISOString(),
        verification_notes: notes || null,
        verification_rejection_reason: null,
      })
      .eq('id', userId);

    if (updateError) throw updateError;

    // Notify admins of new verification request
    const { notifyAdminsOfVerificationRequest } = require('../services/notificationService');
    await notifyAdminsOfVerificationRequest(req.user, businessType === 'registered' ? 'company' : 'solo');

    return sendSuccess(res, {
      verification_status: newStatus,
      message: businessType === 'registered' 
        ? 'Verification request submitted. Admin will review your CAC document.' 
        : 'Self-attestation submitted. Your account will be verified shortly.',
    });
  } catch (error) {
    logger.error('Failed to request verification', { user_id: req.user?.id, message: error.message });
    return sendError(res, 'Failed to submit verification request', 500);
  }
};

/**
 * DELETE /api/auth/verification-request
 * Cancel pending verification request
 */
exports.cancelVerificationRequest = async (req, res) => {
  try {
    if (!req.user) {
      return sendError(res, 'User profile not found', 404);
    }

    const { data: currentUser } = await supabase
      .from('users')
      .select('verification_status')
      .eq('id', req.user.id)
      .single();

    if (!['pending', 'pending_admin_review', 'rejected'].includes(currentUser?.verification_status)) {
      return sendError(res, 'No pending verification request to cancel', 400);
    }

    // Delete verification documents
    await supabase
      .from('verification_documents')
      .delete()
      .eq('user_id', req.user.id);

    // Reset verification status
    await supabase
      .from('users')
      .update({
        verification_status: 'unverified',
        verification_requested_at: null,
        verification_notes: null,
        verification_rejection_reason: null,
      })
      .eq('id', req.user.id);

    return sendSuccess(res, { message: 'Verification request cancelled' });
  } catch (error) {
    logger.error('Failed to cancel verification request', { user_id: req.user?.id, message: error.message });
    return sendError(res, 'Failed to cancel verification request', 500);
  }
};
