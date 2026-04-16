const supabase = require('../../config/database');

async function enqueue(eventType, aggregateId, payload) {
  const { data, error } = await supabase
    .from('v2_outbox_events')
    .insert({
      event_type: eventType,
      aggregate_id: aggregateId || null,
      payload: payload || {},
      status: 'pending',
      attempts: 0,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

async function moveToDeadLetter(source, eventType, payload, errorMessage) {
  const { error } = await supabase
    .from('v2_dead_letter_queue')
    .insert({
      source,
      event_type: eventType || null,
      payload: payload || {},
      error_message: errorMessage || 'Unknown error',
    });
  if (error) throw error;
}

module.exports = {
  enqueue,
  moveToDeadLetter,
};

