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
    // Step 1: Get all users
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, first_name, last_name, brand_name, company_id, companies(name)');

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

      // Verification trust score: verified projects = 3pts each, unverified = 1pt each
      const verifiedCount = userProjects.filter(p => p.geo_verified === true).length;
      const unverifiedCount = userProjects.length - verifiedCount;
      const verificationTrustScore = (verifiedCount * 3) + (unverifiedCount * 1);

      const impactScore =
        (recycled.length * 3) +
        (decommission.length * 2) +
        (active.length * 1) +
        (totalSilver * 0.1) +
        (co2AvoidedKg * 0.01) +
        (averageRating * 8) +
        verificationTrustScore;

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
        impact_score:              parseFloat(impactScore.toFixed(2)),
        verified_projects_count:   verifiedCount,
        unverified_projects_count: unverifiedCount,
        updated_at:                new Date().toISOString(),
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
      const daysUntil    = Math.round((decommDate - today) / (1000 * 60 * 60 * 24));
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

// ─── SCHEDULER ENTRY POINT ───────────────────────────────────────────────────
// Called by server.js on startup. Schedules:
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
    // Check for expired subscriptions & revoke agents
    await checkExpiredSubscriptions();
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
};