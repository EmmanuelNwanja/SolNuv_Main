const supabase = require('../config/database');
const logger = require('../utils/logger');

async function logPlatformActivity({
  actorUserId = null,
  actorEmail = null,
  action,
  resourceType = null,
  resourceId = null,
  details = null,
}) {
  try {
    if (!action) return;
    await supabase.from('platform_activity_logs').insert({
      actor_user_id: actorUserId,
      actor_email: actorEmail,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      details,
    });
  } catch (error) {
    logger.warn('Failed to write platform activity log', { message: error.message, action });
  }
}

module.exports = { logPlatformActivity };
