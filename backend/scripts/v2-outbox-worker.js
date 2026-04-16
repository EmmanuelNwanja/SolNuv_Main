#!/usr/bin/env node
/**
 * Minimal V2 outbox worker for live reliability tests.
 * Marks pending events as processed; failures move to DLQ.
 * Intended as baseline primitive before queue infra upgrade.
 */

require('dotenv').config();
const supabase = require('../src/config/database');

async function run() {
  const nowIso = new Date().toISOString();
  const { data: rows, error } = await supabase
    .from('v2_outbox_events')
    .select('*')
    .eq('status', 'pending')
    .lte('next_attempt_at', nowIso)
    .order('created_at', { ascending: true })
    .limit(100);

  if (error) throw error;
  if (!rows || rows.length === 0) {
    console.log('No pending outbox events');
    return;
  }

  for (const row of rows) {
    try {
      // Placeholder dispatch for now (webhook bus / queue integration comes next).
      await supabase
        .from('v2_outbox_events')
        .update({
          status: 'processed',
          attempts: Number(row.attempts || 0) + 1,
          processed_at: new Date().toISOString(),
          last_error: null,
        })
        .eq('id', row.id);
    } catch (err) {
      const attempts = Number(row.attempts || 0) + 1;
      if (attempts >= 5) {
        await supabase.from('v2_dead_letter_queue').insert({
          source: 'v2-outbox-worker',
          event_type: row.event_type,
          payload: row.payload || {},
          error_message: err.message || 'Outbox dispatch failed',
        });
        await supabase
          .from('v2_outbox_events')
          .update({
            status: 'dead_lettered',
            attempts,
            last_error: err.message || 'Outbox dispatch failed',
          })
          .eq('id', row.id);
      } else {
        const nextAttempt = new Date(Date.now() + attempts * 15000).toISOString();
        await supabase
          .from('v2_outbox_events')
          .update({
            attempts,
            next_attempt_at: nextAttempt,
            last_error: err.message || 'Outbox dispatch failed',
          })
          .eq('id', row.id);
      }
    }
  }

  console.log(`Processed ${rows.length} outbox event(s)`);
}

run().catch((err) => {
  console.error('v2-outbox-worker failed:', err.message);
  process.exit(1);
});

