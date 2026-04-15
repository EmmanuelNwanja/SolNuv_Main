'use strict';

const cron     = require('node-cron');
const supabase = require('../config/database');
const logger   = require('../utils/logger');
const {
  createResilientHttpClient,
  requestWithRetry,
  isTransientNetworkError,
  extractNetworkErrorMeta,
} = require('../utils/httpClient');
const { sendDecommissionAlert } = require('./emailService');
const { runInternalAgent, checkExpiredSubscriptions, seedAgentDefinitions } = require('./aiAgentService');

const keepAliveHttp = createResilientHttpClient({ timeout: 30_000 });

// ─── KEEP-ALIVE ──────────────────────────────────────────────────────────────
// Render free-tier web services sleep after 15 minutes of inactivity.
// This self-ping fires every 8 minutes so the process is never idle,
// even when zero users are on the platform.
function startKeepAlive() {
  const mode = String(process.env.KEEP_ALIVE_MODE || 'auto').toLowerCase();
  const isProduction = process.env.NODE_ENV === 'production';
  if (mode === 'off' || (isProduction && mode === 'auto')) {
    logger.info('Keep-alive disabled (production auto mode)');
    return;
  }

  let baseUrl = '';
  if (mode === 'local') {
    const port = process.env.PORT || 5000;
    baseUrl = `http://127.0.0.1:${port}`;
  } else {
    baseUrl = (process.env.RENDER_EXTERNAL_URL || '').replace(/\/$/, '');
  }

  if (!baseUrl) {
    logger.warn('Keep-alive not configured. Set KEEP_ALIVE_MODE=local|external|off');
    return;
  }

  const pingUrl = `${baseUrl}/api/health`;
  let lastWarnTs = 0;

  setInterval(async () => {
    try {
      await requestWithRetry(
        () => keepAliveHttp.get(pingUrl),
        { retries: 2, shouldRetry: isTransientNetworkError }
      );
      logger.info(`Keep-alive ✓ ${pingUrl}`);
    } catch (err) {
      const now = Date.now();
      if (now - lastWarnTs > 60_000) {
        lastWarnTs = now;
        logger.warn('Keep-alive ping failed', {
          pingUrl,
          message: err.message,
          ...extractNetworkErrorMeta(err),
        });
      }
    }
  }, 8 * 60 * 1000); // every 8 minutes

  logger.info(`Keep-alive active -> ${pingUrl} (every 8 min, mode=${mode})`);
}

// ─── LEADERBOARD REFRESH ─────────────────────────────────────────────────────
async function refreshLeaderboard() {
  logger.info('Refreshing leaderboard cache...');
  try {
    // Step 1: Get all users (include verification_status for account-verified bonus)
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, first_name, last_name, brand_name, company_id, verification_status, companies(name)');

    if (usersError || !users) {
      logger.error('Leaderboard: failed to fetch users', usersError);
      return { error: 'Failed to fetch users' };
    }

    // Step 2: Get all projects with equipment in a single flat query
    const { data: projects, error: projError } = await supabase
      .from('projects')
      .select('id, user_id, company_id, status, geo_verified');

    const { data: equipment, error: eqError } = await supabase
      .from('equipment')
      .select('project_id, equipment_type, quantity, estimated_silver_grams');

    const { data: feedbackRows } = await supabase
      .from('project_feedback')
      .select('project_id, rating');

    if (projError || eqError) {
      logger.error('Leaderboard: failed to fetch projects/equipment');
      return { error: 'Failed to fetch projects' };
    }

    // Step 2b: Fetch new platform-activity signals (flat queries, keyed by user_id)
    const { data: designRows } = await supabase
      .from('project_designs')
      .select('project_id, design_completed_at')
      .not('design_completed_at', 'is', null);

    const { data: aiConvRows } = await supabase
      .from('ai_conversations')
      .select('user_id')
      .eq('status', 'completed');

    const { data: savedCalcRows } = await supabase
      .from('saved_calculations')
      .select('user_id');

    // Build lookup sets for quick counting inside the user loop
    const completedDesignsByProject = new Set((designRows || []).map(d => d.project_id));
    const aiConvByUser = {};
    for (const row of (aiConvRows || [])) {
      aiConvByUser[row.user_id] = (aiConvByUser[row.user_id] || 0) + 1;
    }
    const savedCalcByUser = {};
    for (const row of (savedCalcRows || [])) {
      savedCalcByUser[row.user_id] = (savedCalcByUser[row.user_id] || 0) + 1;
    }

    // Step 3: Build equipment map keyed by project_id
    const eqByProject = {};
    for (const eq of equipment || []) {
      if (!eqByProject[eq.project_id]) eqByProject[eq.project_id] = [];
      eqByProject[eq.project_id].push(eq);
    }

    const feedbackByProject = {};
    for (const fb of feedbackRows || []) {
      if (!feedbackByProject[fb.project_id]) feedbackByProject[fb.project_id] = [];
      feedbackByProject[fb.project_id].push(fb);
    }

    // Step 4: Build leaderboard entries
    const leaderboardEntries = [];

    for (const user of users) {
      const userProjects = (projects || []).filter(p =>
        p.user_id === user.id ||
        (user.company_id && p.company_id === user.company_id)
      );

      const active       = userProjects.filter(p => p.status === 'active');
      const decommission = userProjects.filter(p => p.status === 'decommissioned');
      const recycled     = userProjects.filter(p => p.status === 'recycled');

      let totalPanels = 0, totalBatteries = 0, totalSilver = 0, expectedSilver = 0;
      let co2AvoidedKg = 0;
      let totalFeedbacks = 0, ratingSum = 0;

      for (const proj of userProjects) {
        for (const eq of eqByProject[proj.id] || []) {
          if (eq.equipment_type === 'panel') {
            totalPanels += eq.quantity;
            totalSilver += eq.estimated_silver_grams || 0;
          } else {
            totalBatteries += eq.quantity;
          }
        }
      }

      for (const proj of active) {
        for (const eq of eqByProject[proj.id] || []) {
          if (eq.equipment_type === 'panel') {
            expectedSilver += eq.estimated_silver_grams || 0;
          }
        }
      }

      for (const proj of recycled) {
        for (const eq of eqByProject[proj.id] || []) {
          if (eq.equipment_type === 'panel') {
            co2AvoidedKg += (eq.quantity || 0) * 230;
          }
        }
      }

      for (const proj of userProjects) {
        for (const fb of feedbackByProject[proj.id] || []) {
          totalFeedbacks += 1;
          ratingSum += Number(fb.rating || 0);
        }
      }

      const averageRating = totalFeedbacks > 0 ? (ratingSum / totalFeedbacks) : 0;

      // Geo-verified project trust score
      const verifiedCount   = userProjects.filter(p => p.geo_verified === true).length;
      const unverifiedCount = userProjects.length - verifiedCount;

      // Platform-activity signals
      const userProjectIds     = userProjects.map(p => p.id);
      const designsCompleted   = userProjectIds.filter(pid => completedDesignsByProject.has(pid)).length;
      const aiConversations    = aiConvByUser[user.id] || 0;
      const savedCalcs         = savedCalcByUser[user.id] || 0;
      const accountIsVerified  = user.verification_status === 'verified';
      const accountVerifiedBonus = accountIsVerified ? 15 : 0;

      // ── Rebalanced impact formula ────────────────────────────────────────
      // Lifecycle events (core platform value)
      //   recycled    × 5  — highest-value outcome: material recovered + CO2 avoided
      //   decommission × 3 — end-of-life managed correctly
      //   active       × 2 — evidence of tracked, live deployment
      // Material / environmental quality signals
      //   silver       × 0.5  — actual material declared (vs 0.1 before)
      //   co2          × 0.05 — carbon avoided; up 5× to make it meaningful
      // Community trust
      //   averageRating × 5  — reduced from 8 so it can't overwhelm project work
      // Geo-verification trust
      //   verifiedProjects × 5, unverified × 1  — stronger verified premium
      // Platform engagement (new)
      //   designsCompleted × 3, aiConversations × 1, savedCalcs × 0.5
      // Account-level trust (new; one-time flat bonus)
      //   accountVerifiedBonus = 15
      const impactScore =
        (recycled.length    * 5) +
        (decommission.length * 3) +
        (active.length       * 2) +
        (totalSilver         * 0.5) +
        (co2AvoidedKg        * 0.05) +
        (averageRating       * 5) +
        (verifiedCount       * 5) +
        (unverifiedCount     * 1) +
        (designsCompleted    * 3) +
        (aiConversations     * 1) +
        (savedCalcs          * 0.5) +
        accountVerifiedBonus;

      // Only include users who have at least one project
      if (userProjects.length === 0) continue;

      const entityName =
        user.companies?.name ||
        user.brand_name ||
        `${user.first_name} ${user.last_name || ''}`.trim();

      leaderboardEntries.push({
        entity_id:            user.id,
        entity_name:          entityName,
        entity_type:          'user',
        active_projects_count: active.length,
        decommissioned_count:  decommission.length,
        recycled_count:        recycled.length,
        total_panels:          totalPanels,
        total_batteries:       totalBatteries,
        total_silver_grams:    parseFloat(totalSilver.toFixed(4)),
        expected_silver_grams: parseFloat(expectedSilver.toFixed(4)),
        co2_avoided_kg:        parseFloat(co2AvoidedKg.toFixed(2)),
        average_rating:        parseFloat(averageRating.toFixed(2)),
        total_feedbacks:       totalFeedbacks,
        impact_score:                parseFloat(impactScore.toFixed(2)),
        verified_projects_count:     verifiedCount,
        unverified_projects_count:   unverifiedCount,
        designs_completed_count:     designsCompleted,
        ai_conversations_count:      aiConversations,
        saved_calculations_count:    savedCalcs,
        account_verified:            accountIsVerified,
        updated_at:                  new Date().toISOString(),
      });
    }

    // Step 5: Assign ranks
    const byActive   = [...leaderboardEntries].sort((a, b) => b.active_projects_count - a.active_projects_count);
    const byRecycled = [...leaderboardEntries].sort((a, b) => b.recycled_count - a.recycled_count);
    const byImpact   = [...leaderboardEntries].sort((a, b) => b.impact_score - a.impact_score);

    for (const entry of leaderboardEntries) {
      entry.rank_active   = byActive.findIndex(e => e.entity_id === entry.entity_id) + 1;
      entry.rank_recycled = byRecycled.findIndex(e => e.entity_id === entry.entity_id) + 1;
      entry.rank_impact   = byImpact.findIndex(e => e.entity_id === entry.entity_id) + 1;
    }

    // Step 6: Replace cache — delete all then insert fresh
    await supabase.from('leaderboard_cache').delete().gt('updated_at', '2000-01-01');

    if (leaderboardEntries.length > 0) {
      const { error: insertError } = await supabase
        .from('leaderboard_cache')
        .insert(leaderboardEntries);

      if (insertError) {
        logger.error('Leaderboard insert error:', insertError.message);
        return { error: insertError.message };
      }
    }

    logger.info(`Leaderboard refreshed: ${leaderboardEntries.length} entries`);
    return { refreshed: leaderboardEntries.length };
  } catch (error) {
    logger.error('Leaderboard refresh error:', error.message);
    return { error: error.message };
  }
}

// ─── DECOMMISSION ALERTS ─────────────────────────────────────────────────────
// Queries active projects whose estimated_decommission_date is within 180 days
// (or already overdue) and sends alert emails to each project's owner.
async function sendDecommissionAlerts() {
  logger.info('Running decommission alert sweep...');
  try {
    const today      = new Date();
    const cutoffDate = new Date(today);
    cutoffDate.setDate(cutoffDate.getDate() + 180);

    const { data: projects, error } = await supabase
      .from('projects')
      .select(`
        id, name, city, state, estimated_decommission_date,
        users ( id, first_name, last_name, email )
      `)
      .eq('status', 'active')
      .lte('estimated_decommission_date', cutoffDate.toISOString())
      .not('estimated_decommission_date', 'is', null);

    if (error) {
      logger.error('Decommission alerts: query failed', error.message);
      return { error: error.message };
    }

    let sent = 0;
    for (const project of projects || []) {
      const user = project.users;
      if (!user?.email) continue;

      const decommDate   = new Date(project.estimated_decommission_date);
      const daysUntil    = Math.round((+decommDate - +today) / (1000 * 60 * 60 * 24));
      const equipment    = { days_until_decommission: daysUntil };

      try {
        await sendDecommissionAlert(user, project, equipment);
        sent++;
      } catch (emailErr) {
        logger.warn(`Decommission alert failed for project ${project.id}: ${emailErr.message}`);
      }
    }

    logger.info(`Decommission alerts sent: ${sent}/${(projects || []).length} projects`);
    return { sent, total: (projects || []).length };
  } catch (err) {
    logger.error('Decommission alert sweep error:', err.message);
    return { error: err.message };
  }
}

async function processNercComplianceDaily() {
  try {
    const nowIso = new Date().toISOString();
    const today = new Date();
    const todayDate = today.toISOString().split('T')[0];

    const { error: slaError } = await supabase
      .from('nerc_applications')
      .update({ sla_breached: true })
      .in('status', ['submitted', 'in_review'])
      .lt('sla_due_at', nowIso)
      .eq('sla_breached', false);
    if (slaError) throw slaError;

    const { error: overdueError } = await supabase
      .from('nerc_reporting_cycles')
      .update({ status: 'overdue' })
      .eq('status', 'pending')
      .lt('due_date', todayDate);
    if (overdueError) throw overdueError;

    const { data: profiles, error: profileError } = await supabase
      .from('project_regulatory_profiles')
      .select('id, project_id, reporting_cadence')
      .eq('is_active', true);
    if (profileError) throw profileError;

    for (const profile of (profiles || [])) {
      let periodStart;
      let periodEnd;
      if (profile.reporting_cadence === 'quarterly') {
        const quarter = Math.floor(today.getMonth() / 3);
        periodStart = new Date(Date.UTC(today.getUTCFullYear(), quarter * 3, 1));
        periodEnd = new Date(Date.UTC(today.getUTCFullYear(), quarter * 3 + 3, 0));
      } else {
        periodStart = new Date(Date.UTC(today.getUTCFullYear(), 0, 1));
        periodEnd = new Date(Date.UTC(today.getUTCFullYear(), 11, 31));
      }
      const dueDate = new Date(periodEnd);
      dueDate.setUTCDate(dueDate.getUTCDate() + 14);

      const { data: existing, error: existingError } = await supabase
        .from('nerc_reporting_cycles')
        .select('id')
        .eq('project_id', profile.project_id)
        .eq('cadence', profile.reporting_cadence)
        .eq('period_start', periodStart.toISOString().split('T')[0])
        .eq('period_end', periodEnd.toISOString().split('T')[0])
        .maybeSingle();
      if (existingError) throw existingError;

      if (!existing) {
        const { error: insertError } = await supabase
          .from('nerc_reporting_cycles')
          .insert({
            project_id: profile.project_id,
            regulatory_profile_id: profile.id,
            cadence: profile.reporting_cadence,
            period_start: periodStart.toISOString().split('T')[0],
            period_end: periodEnd.toISOString().split('T')[0],
            due_date: dueDate.toISOString().split('T')[0],
            status: 'pending',
            created_by_scheduler: true,
          });
        if (insertError) throw insertError;
      }
    }
  } catch (error) {
    logger.error('NERC daily compliance job failed', { message: error.message });
  }
}

async function sendWeeklyNercRegistrationReminders() {
  try {
    const now = new Date();
    const weekKey = `${now.getUTCFullYear()}-W${Math.ceil((((now.getTime() - Date.UTC(now.getUTCFullYear(), 0, 1)) / 86400000) + 1) / 7)}`;

    const { data: projects, error: projectError } = await supabase
      .from('projects')
      .select('id, name, user_id, company_id, capacity_kw, status')
      .in('status', ['draft', 'active', 'maintenance']);
    if (projectError) throw projectError;
    if (!projects || projects.length === 0) return;

    const projectIds = projects.map((p) => p.id);
    const { data: applications, error: appError } = await supabase
      .from('nerc_applications')
      .select('project_id, status')
      .in('project_id', projectIds)
      .in('status', ['submitted', 'in_review', 'approved']);
    if (appError) throw appError;

    const registeredProjectIds = new Set((applications || []).map((a) => a.project_id));
    const unregistered = projects.filter((p) => !registeredProjectIds.has(p.id));
    if (unregistered.length === 0) return;

    const groupedByUser = new Map();
    for (const project of unregistered) {
      const arr = groupedByUser.get(project.user_id) || [];
      arr.push(project);
      groupedByUser.set(project.user_id, arr);
    }

    let sent = 0;
    for (const [userId, userProjects] of groupedByUser.entries()) {
      const { data: existing } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', userId)
        .eq('type', 'account_activity')
        .contains('data', { nerc_week_key: weekKey })
        .limit(1)
        .maybeSingle();
      if (existing?.id) continue;

      const sample = userProjects.slice(0, 3).map((p) => p.name).join(', ');
      const moreCount = Math.max(0, userProjects.length - 3);
      const message = moreCount > 0
        ? `You have ${userProjects.length} unregistered projects pending NERC action. Examples: ${sample}, and ${moreCount} more.`
        : `You have ${userProjects.length} unregistered project(s) pending NERC action: ${sample}.`;

      const { error: insertError } = await supabase.from('notifications').insert({
        user_id: userId,
        type: 'account_activity',
        title: 'Weekly NERC Reminder',
        message: `${message} Open the project Regulatory page to register with NERC or request SolNuv assisted filing.`,
        data: {
          nerc_week_key: weekKey,
          project_ids: userProjects.map((p) => p.id),
          reminder_type: 'weekly_nerc_registration',
        },
      });
      if (!insertError) sent += 1;
    }

    logger.info('Weekly NERC registration reminders sent', { users_notified: sent, unregistered_projects: unregistered.length });
  } catch (error) {
    logger.error('Weekly NERC reminder job failed', { message: error.message });
  }
}

// ─── SCHEDULER ENTRY POINT ───────────────────────────────────────────────────
// Called by server.ts on startup. Schedules:
//   • Daily 8AM WAT (07:00 UTC) — leaderboard refresh + decommission alerts
//   • Every 10 min              — keep-alive self-ping (Render free-tier)
function startScheduler() {
  // Seed AI agent definitions on startup (idempotent)
  seedAgentDefinitions().catch(e => logger.warn('Agent seeding on startup failed', { message: e.message }));

  // 8AM WAT = 07:00 UTC
  cron.schedule('0 7 * * *', async () => {
    logger.info('Daily cron fired — refreshing leaderboard and checking decommissions');
    await refreshLeaderboard();
    await sendDecommissionAlerts();
    await processNercComplianceDaily();
    // Check for expired subscriptions & revoke agents
    await checkExpiredSubscriptions();
  }, { timezone: 'UTC' });

  // Weekly NERC reminder: Mondays 08:30 WAT (07:30 UTC)
  cron.schedule('30 7 * * 1', async () => {
    logger.info('Cron: Weekly NERC registration reminders');
    await sendWeeklyNercRegistrationReminders();
  }, { timezone: 'UTC' });

  // AI Internal Agents — staggered schedules to stay within rate limits
  // SEO Blog Writer: 9AM WAT (08:00 UTC), Mon/Wed/Fri
  cron.schedule('0 8 * * 1,3,5', () => {
    logger.info('Cron: SEO Blog Writer');
    runInternalAgent('seo-blog-writer').catch(e => logger.error('SEO agent cron error', { message: e.message }));
  }, { timezone: 'UTC' });

  // Holiday Notifier: 7AM WAT (06:00 UTC), daily
  cron.schedule('0 6 * * *', () => {
    logger.info('Cron: Holiday Notifier');
    runInternalAgent('holiday-notifier').catch(e => logger.error('Holiday agent cron error', { message: e.message }));
  }, { timezone: 'UTC' });

  // Security Specialist: every 6 hours
  cron.schedule('0 */6 * * *', () => {
    logger.info('Cron: Security Specialist');
    runInternalAgent('security-specialist').catch(e => logger.error('Security agent cron error', { message: e.message }));
  }, { timezone: 'UTC' });

  // User Behaviour Analyst: 10AM WAT (09:00 UTC), weekly Monday
  cron.schedule('0 9 * * 1', () => {
    logger.info('Cron: User Behaviour Analyst');
    runInternalAgent('user-behaviour-analyst').catch(e => logger.error('Behaviour agent cron error', { message: e.message }));
  }, { timezone: 'UTC' });

  // Market Analyst: 11AM WAT (10:00 UTC), Tue/Thu
  cron.schedule('0 10 * * 2,4', () => {
    logger.info('Cron: Market Analyst');
    runInternalAgent('market-analyst').catch(e => logger.error('Market agent cron error', { message: e.message }));
  }, { timezone: 'UTC' });

  // Tariff Rate Monitor: 6AM WAT (05:00 UTC), weekly Sunday
  cron.schedule('0 5 * * 0', () => {
    logger.info('Cron: Tariff Rate Monitor');
    runInternalAgent('tariff-rate-monitor').catch(e => logger.error('Tariff agent cron error', { message: e.message }));
  }, { timezone: 'UTC' });

  logger.info('⏰ Daily scheduler registered (08:00 WAT / 07:00 UTC)');

  // Keep the Render free-tier process alive 24/7
  startKeepAlive();
}

// ─── EXPORTS ─────────────────────────────────────────────────────────────────
module.exports = {
  startScheduler,
  refreshLeaderboard,
  sendDecommissionAlerts,
  processNercComplianceDaily,
};