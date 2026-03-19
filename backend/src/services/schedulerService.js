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
      .select('id, user_id, company_id, status');

    const { data: equipment, error: eqError } = await supabase
      .from('equipment')
      .select('project_id, equipment_type, quantity, estimated_silver_grams');

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

      const impactScore =
        (recycled.length * 3) +
        (decommission.length * 2) +
        (active.length * 1) +
        (totalSilver * 0.1);

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
        impact_score:          parseFloat(impactScore.toFixed(2)),
        updated_at:            new Date().toISOString(),
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