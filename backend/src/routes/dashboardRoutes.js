const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { requireAuth, requireProfile, optionalAuth } = require('../middlewares/authMiddleware');
const supabase = require('../config/database');

// Public
router.get('/leaderboard', optionalAuth, dashboardController.getLeaderboard);

// Inline handler — no dependency on controller export
router.get('/refresh-leaderboard', async (req, res) => {
  try {
    const { data: users }     = await supabase.from('users').select('id, first_name, last_name, brand_name, company_id, companies(name)');
    const { data: projects }  = await supabase.from('projects').select('id, user_id, company_id, status');
    const { data: equipment } = await supabase.from('equipment').select('project_id, equipment_type, quantity, estimated_silver_grams');

    if (!users || !projects) {
      return res.status(500).json({ success: false, message: 'Failed to fetch data' });
    }

    const eqByProject = {};
    for (const eq of equipment || []) {
      if (!eqByProject[eq.project_id]) eqByProject[eq.project_id] = [];
      eqByProject[eq.project_id].push(eq);
    }

    const entries = [];

    for (const user of users) {
      const userProjects = projects.filter(p =>
        p.user_id === user.id ||
        (user.company_id && p.company_id === user.company_id)
      );

      if (userProjects.length === 0) continue;

      const active       = userProjects.filter(p => p.status === 'active');
      const decommission = userProjects.filter(p => p.status === 'decommissioned');
      const recycled     = userProjects.filter(p => p.status === 'recycled');

      let totalPanels = 0, totalBatteries = 0, totalSilver = 0, expectedSilver = 0;

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
          if (eq.equipment_type === 'panel') expectedSilver += eq.estimated_silver_grams || 0;
        }
      }

      const impactScore = (recycled.length * 3) + (decommission.length * 2) + (active.length * 1) + (totalSilver * 0.1);
      const entityName  = user.companies?.name || user.brand_name || `${user.first_name} ${user.last_name || ''}`.trim();

      entries.push({
        entity_id:             user.id,
        entity_name:           entityName,
        entity_type:           'user',
        active_projects_count: active.length,
        decommissioned_count:  decommission.length,
        recycled_count:        recycled.length,
        total_panels:          totalPanels,
        total_batteries:       totalBatteries,
        total_silver_grams:    parseFloat(totalSilver.toFixed(4)),
        expected_silver_grams: parseFloat(expectedSilver.toFixed(4)),
        impact_score:          parseFloat(impactScore.toFixed(2)),
        updated_at:            new Date().toISOString(),
      });
    }

    // Assign ranks
    const byActive   = [...entries].sort((a, b) => b.active_projects_count - a.active_projects_count);
    const byRecycled = [...entries].sort((a, b) => b.recycled_count - a.recycled_count);
    const byImpact   = [...entries].sort((a, b) => b.impact_score - a.impact_score);

    for (const e of entries) {
      e.rank_active   = byActive.findIndex(x => x.entity_id === e.entity_id) + 1;
      e.rank_recycled = byRecycled.findIndex(x => x.entity_id === e.entity_id) + 1;
      e.rank_impact   = byImpact.findIndex(x => x.entity_id === e.entity_id) + 1;
    }

    await supabase.from('leaderboard_cache').delete().gt('updated_at', '2000-01-01');

    if (entries.length > 0) {
      await supabase.from('leaderboard_cache').insert(entries);
    }

    return res.json({ success: true, refreshed: entries.length, message: `Leaderboard rebuilt with ${entries.length} entries` });
  } catch (error) {
    console.error('Refresh leaderboard error:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

// Protected
router.use(requireAuth, requireProfile);
router.get('/', dashboardController.getDashboard);
router.get('/impact', dashboardController.getImpact);

module.exports = router;