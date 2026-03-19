/**
 * SolNuv Scheduler Service
 * Daily cron jobs for decommission alerts, leaderboard refresh, etc.
 * Runs every day at 8:00 AM WAT (West Africa Time = UTC+1)
 */

const cron = require('node-cron');
const supabase = require('../config/database');
const { sendDecommissionAlert } = require('./emailService');
const { bulkUpdateProjectDecommissionDates } = require('./degradationService');
const { calculatePortfolioSilver } = require('./silverService');
const logger = require('../utils/logger');

/**
 * Refresh leaderboard cache
 */
async function refreshLeaderboard() {
  logger.info('Refreshing leaderboard cache...');
  try {
    // Get all users with their projects summary
    const { data: users } = await supabase
      .from('users')
      .select(`
        id, first_name, last_name, brand_name, company_id,
        companies(name),
        projects(id, status, equipment(equipment_type, quantity, estimated_silver_grams))
      `);

    if (!users) return;

    // Clear existing cache
    await supabase.from('leaderboard_cache').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    const leaderboardEntries = [];

    for (const user of users) {
      const projects = user.projects || [];
      const active = projects.filter(p => p.status === 'active');
      const decommissioned = projects.filter(p => p.status === 'decommissioned');
      const recycled = projects.filter(p => p.status === 'recycled');

      let totalPanels = 0, totalBatteries = 0, totalSilver = 0, expectedSilver = 0;

      for (const proj of projects) {
        for (const eq of proj.equipment || []) {
          if (eq.equipment_type === 'panel') {
            totalPanels += eq.quantity;
            totalSilver += eq.estimated_silver_grams || 0;
          } else {
            totalBatteries += eq.quantity;
          }
        }
      }

      // Expected silver from active projects
      for (const proj of active) {
        for (const eq of proj.equipment || []) {
          if (eq.equipment_type === 'panel') {
            expectedSilver += eq.estimated_silver_grams || 0;
          }
        }
      }

      // Impact score formula: recycled * 3 + decommissioned * 2 + active * 1 + silver * 0.1
      const impactScore = (recycled.length * 3) + (decommissioned.length * 2) + (active.length * 1) + (totalSilver * 0.1);

      const entityName = user.companies?.name || user.brand_name || `${user.first_name} ${user.last_name || ''}`.trim();

      leaderboardEntries.push({
        entity_id: user.id,
        entity_name: entityName,
        entity_type: 'user',
        active_projects_count: active.length,
        decommissioned_count: decommissioned.length,
        recycled_count: recycled.length,
        total_panels: totalPanels,
        total_batteries: totalBatteries,
        total_silver_grams: parseFloat(totalSilver.toFixed(4)),
        expected_silver_grams: parseFloat(expectedSilver.toFixed(4)),
        impact_score: parseFloat(impactScore.toFixed(2)),
        updated_at: new Date().toISOString(),
      });
    }

    // Sort and assign ranks
    const sortedByActive = [...leaderboardEntries].sort((a, b) => b.active_projects_count - a.active_projects_count);
    const sortedByRecycled = [...leaderboardEntries].sort((a, b) => b.recycled_count - a.recycled_count);
    const sortedByImpact = [...leaderboardEntries].sort((a, b) => b.impact_score - a.impact_score);

    leaderboardEntries.forEach(entry => {
      entry.rank_active = sortedByActive.findIndex(e => e.entity_id === entry.entity_id) + 1;
      entry.rank_recycled = sortedByRecycled.findIndex(e => e.entity_id === entry.entity_id) + 1;
      entry.rank_impact = sortedByImpact.findIndex(e => e.entity_id === entry.entity_id) + 1;
    });

    if (leaderboardEntries.length > 0) {
      await supabase.from('leaderboard_cache').insert(leaderboardEntries);
    }

    logger.info(`Leaderboard refreshed with ${leaderboardEntries.length} entries`);
    return { refreshed: leaderboardEntries.length };
  } catch (error) {
    logger.error('Leaderboard refresh error:', error.message);
    return { error: error.message };
  }
}

/**
 * Send decommission alert emails
 * Sends to users whose projects are:
 * - 12 months from decommission
 * - 6 months from decommission
 * - 3 months from decommission
 * - 1 month from decommission
 * - Overdue
 */
async function sendDecommissionAlerts() {
  logger.info('Sending decommission alerts...');
  try {
    const today = new Date();
    const alertWindows = [365, 180, 90, 30, 0]; // days

    let totalSent = 0;

    for (const days of alertWindows) {
      const targetDate = new Date(today);
      targetDate.setDate(targetDate.getDate() + days);

      const windowStart = new Date(targetDate);
      windowStart.setDate(windowStart.getDate() - 3); // 3-day window

      const windowEnd = new Date(targetDate);
      windowEnd.setDate(windowEnd.getDate() + 3);

      const { data: projects } = await supabase
        .from('projects')
        .select(`
          *,
          users(id, first_name, last_name, email),
          equipment(equipment_type, quantity, estimated_silver_grams, adjusted_failure_date)
        `)
        .eq('status', 'active')
        .gte('estimated_decommission_date', windowStart.toISOString().split('T')[0])
        .lte('estimated_decommission_date', windowEnd.toISOString().split('T')[0]);

      if (projects && projects.length > 0) {
        for (const project of projects) {
          if (project.users?.email) {
            const daysUntil = Math.ceil((new Date(project.estimated_decommission_date) - today) / (1000 * 60 * 60 * 24));
            await sendDecommissionAlert(project.users, project, { days_until_decommission: daysUntil });
            totalSent++;

            // Create in-app notification
            await supabase.from('notifications').insert({
              user_id: project.users.id,
              type: 'decommission_alert',
              title: `Decommission Alert: ${project.name}`,
              message: `${Math.abs(daysUntil)} days ${daysUntil < 0 ? 'overdue' : 'until decommission'}`,
              data: { project_id: project.id, days_until: daysUntil },
            });
          }
        }
      }
    }

    logger.info(`Sent ${totalSent} decommission alerts`);
    return { sent: totalSent };
  } catch (error) {
    logger.error('Alert send error:', error.message);
    return { error: error.message };
  }
}

/**
 * Update silver values in equipment table
 */
async function updateSilverValues() {
  const { silverService } = require('./silverService');
  logger.info('Updating silver values...');
  // This runs as part of equipment creation/update - just log here
  return { note: 'Silver values are calculated on equipment save' };
}

/**
 * Start all cron jobs
 */
function startScheduler() {
  logger.info('Starting SolNuv cron scheduler...');

  // Every day at 8:00 AM WAT (UTC+1 = 7:00 AM UTC)
  cron.schedule('0 7 * * *', async () => {
    logger.info('Running daily 8AM WAT jobs...');
    await bulkUpdateProjectDecommissionDates();
    await sendDecommissionAlerts();
    await refreshLeaderboard();
  }, { timezone: 'Africa/Lagos' });

  // Every week on Monday: refresh silver prices (manual trigger recommended)
  cron.schedule('0 9 * * 1', async () => {
    logger.info('Weekly: Checking silver price...');
    // In production, integrate with metals API here
  }, { timezone: 'Africa/Lagos' });

  logger.info('Cron scheduler started successfully');
}

module.exports = { startScheduler, refreshLeaderboard, sendDecommissionAlerts };
