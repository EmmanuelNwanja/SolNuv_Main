/**
 * SolNuv Auth Controller
 * Handles user registration, login, onboarding, profile creation
 */

const supabase = require('../config/database');
const { sendSuccess, sendError } = require('../utils/responseHelper');
const { sendWelcomeEmail, sendTeamInvitation } = require('../services/emailService');
const { v4: uuidv4 } = require('uuid');

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
    }

    // Check if user profile exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('supabase_uid', supabaseUser.id)
      .single();

    let user;

    if (existingUser) {
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
          is_onboarded: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingUser.id)
        .select('*, companies(*)')
        .single();

      if (error) throw error;
      user = updatedUser;
    } else {
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
          is_onboarded: true,
        })
        .select('*, companies(*)')
        .single();

      if (error) throw error;
      user = newUser;

      // Send welcome email
      sendWelcomeEmail(newUser).catch(console.error);
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

    return sendSuccess(res, { ...user, unread_notifications: unreadCount || 0 });
  } catch (error) {
    return sendError(res, 'Failed to fetch profile', 500);
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

    const { email, role } = req.body;
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

    // Send invitation email
    await sendTeamInvitation(
      email,
      `${req.user.first_name} ${req.user.last_name || ''}`.trim(),
      req.company.name,
      inviteLink,
      role
    );

    return sendSuccess(res, { invite_id: invite.id, email, role }, 'Invitation sent successfully');
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
