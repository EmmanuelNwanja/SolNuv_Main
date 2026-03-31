/**
 * SolNuv Auth Controller
 * Handles user registration, login, onboarding, profile creation
 */

const supabase = require('../config/database');
const { sendSuccess, sendError } = require('../utils/responseHelper');
const { sendWelcomeNotification } = require('../services/notificationService');
const { sendSms, normalizePhone } = require('../services/termiiService');
const { sendTeamInvitation } = require('../services/emailService');
const { v4: uuidv4 } = require('uuid');

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70);
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
    } = req.body;

    if (!first_name) return sendError(res, 'First name is required', 400);
    if (!user_type) return sendError(res, 'User type is required', 400);

    let companyId = null;

    // Create company if registered business
    if (business_type === 'registered') {
      if (!company_name) return sendError(res, 'Company name is required for registered businesses', 400);

      // Check if company already exists
      const { data: existingCompany } = await supabase
        .from('companies')
        .select('id')
        .eq('email', company_email || supabaseUser.email)
        .single();

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
            max_team_members: 1,
          })
          .select()
          .single();

        if (companyError) throw companyError;
        companyId = newCompany.id;
      }

      // Keep company profile details in sync from settings edits
      if (companyId) {
        const companyUpdate = {
          address: company_address || address || undefined,
          state: company_state || undefined,
          city: company_city || city || undefined,
          nesrea_registration_number: nesrea_registration_number || undefined,
          website: website || undefined,
          logo_url: logo_url || undefined,
          company_signature_url: company_signature_url || undefined,
          branding_primary_color: branding_primary_color || undefined,
          notification_preferences: notification_preferences || undefined,
        };

        await supabase
          .from('companies')
          .update(companyUpdate)
          .eq('id', companyId);
      }
    }

    // Check if user profile exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('supabase_uid', supabaseUser.id)
      .single();

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
          company_id: companyId,
          signature_url: signature_url || undefined,
          notification_preferences: notification_preferences || undefined,
          public_slug: resolvedSlug,
          public_bio: public_bio || undefined,
          is_public_profile: typeof is_public_profile === 'boolean' ? is_public_profile : undefined,
          is_onboarded: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingUser.id)
        .select('*, companies(*)')
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
          is_onboarded: true,
        })
        .select('*, companies(*)')
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
    if (req.isNewUser || !req.user) {
      // Return Supabase user data for onboarding
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
      .select('*, companies(*)')
      .eq('id', req.user.id)
      .single();

    if (error) throw error;

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

    return sendSuccess(res, {
      ...user,
      unread_notifications: unreadCount || 0,
      is_platform_admin: !!adminMembership,
      platform_admin_role: adminMembership?.role || null,
      platform_admin_permissions: adminMembership || null,
    });
  } catch (error) {
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

    return sendSuccess(res, {
      is_onboarded: !!req.user,
      user_id: req.user.id,
      first_name: req.user.first_name,
      company_id: req.user.company_id,
    });
  } catch (error) {
    return sendError(res, 'Failed to check profile status', 500);
  }
};

/**
 * POST /api/auth/invite
 * Invite team member
 */
exports.inviteTeamMember = async (req, res) => {
  try {
    if (!req.user?.company_id) return sendError(res, 'You need to be in a company to invite members', 400);
    if (!['super_admin', 'admin'].includes(req.user.role)) return sendError(res, 'Only admins can invite members', 403);

    const { email, phone, role, invite_channel = 'sms' } = req.body;
    if (!email) return sendError(res, 'Email is required', 400);
    if (!['admin', 'manager'].includes(role)) return sendError(res, 'Invalid role. Use admin or manager', 400);

    // Create invitation token
    const { data: invite, error } = await supabase
      .from('team_invitations')
      .insert({
        company_id: req.user.company_id,
        invited_by: req.user.id,
        email,
        role,
      })
      .select()
      .single();

    if (error) throw error;

    const inviteLink = `https://solnuv.com/invite/${invite.token}`;

    if (phone) {
      const smsText = `SolNuv invite: ${req.user.first_name} invited you as ${role} to ${req.company.name}. Accept: ${inviteLink}`;
      await sendSms({
        to: phone,
        message: smsText,
        channel: invite_channel === 'whatsapp' ? 'whatsapp' : 'generic',
      });
    } else {
      await sendTeamInvitation(
        email,
        `${req.user.first_name} ${req.user.last_name || ''}`.trim(),
        req.company.name,
        inviteLink,
        role
      );
    }

    return sendSuccess(res, { invite_id: invite.id, email, phone, role }, 'Invitation sent successfully');
  } catch (error) {
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
    return sendError(res, 'Failed to process invitation', 500);
  }
};

/**
 * GET /api/auth/team
 * Get organization team members
 */
exports.getTeamMembers = async (req, res) => {
  try {
    if (!req.user?.company_id) return sendError(res, 'No organization found', 404);

    const { data: members } = await supabase
      .from('users')
      .select('id, first_name, last_name, email, role, avatar_url, last_login_at, created_at')
      .eq('company_id', req.user.company_id)
      .eq('is_active', true);

    const { data: pending } = await supabase
      .from('team_invitations')
      .select('email, role, created_at, expires_at')
      .eq('company_id', req.user.company_id)
      .eq('accepted', false)
      .gt('expires_at', new Date().toISOString());

    return sendSuccess(res, { members: members || [], pending_invitations: pending || [] });
  } catch (error) {
    return sendError(res, 'Failed to fetch team', 500);
  }
};

/**
 * GET /api/auth/notifications
 */
exports.getNotifications = async (req, res) => {
  try {
    const { data: notifications } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false })
      .limit(20);

    // Mark as read
    await supabase.from('notifications')
      .update({ is_read: true })
      .eq('user_id', req.user.id)
      .eq('is_read', false);

    return sendSuccess(res, notifications || []);
  } catch (error) {
    return sendError(res, 'Failed to fetch notifications', 500);
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
      return sendError(res, resetError.message || 'Failed to update password', 500);
    }

    await supabase
      .from('password_reset_otps')
      .update({ used: true })
      .eq('id', row.id);

    return sendSuccess(res, null, 'Password reset successful');
  } catch (error) {
    return sendError(res, 'Failed to complete password reset', 500);
  }
};
