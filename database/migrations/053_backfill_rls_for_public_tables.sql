-- =====================================================
-- Migration 053: Backfill RLS on public tables flagged by Supabase linter
-- Purpose: Enable RLS on exposed tables and ensure only service_role has
-- default table-level access unless a stricter policy already exists.
-- =====================================================

BEGIN;

DO $$
DECLARE
  t TEXT;
  flagged_tables TEXT[] := ARRAY[
    'ai_providers',
    'promo_codes',
    'promo_redemptions',
    'admin_users',
    'nigeria_climate_zones',
    'platform_activity_logs',
    'paystack_plan_catalog',
    'ai_agent_instances',
    'proposal_scenarios',
    'team_invitations',
    'battery_assets',
    'silver_prices',
    'battery_health_logs',
    'nesrea_reports',
    'cable_compliance_records',
    'password_reset_otps',
    'project_feedback',
    'leaderboard_cache',
    'phone_verification_otps',
    'audit_logs',
    'panel_brands',
    'battery_brands',
    'inverter_brands',
    'project_history',
    'subscription_transactions',
    'recovery_requests',
    'platform_settings',
    'push_notifications',
    'ai_token_usage',
    'tariff_structures',
    'tariff_rates',
    'tariff_ancillary_charges',
    'ai_agent_definitions',
    'solar_resource_cache',
    'report_shares',
    'platform_payment_settings',
    'webhook_events',
    'nerc_applications',
    'nerc_reporting_cycles',
    'project_regulatory_profiles',
    'nerc_submission_events',
    'platform_config',
    'nerc_rule_config',
    'v2_organizations',
    'v2_org_memberships',
    'v2_asset_units',
    'v2_release_decisions',
    'v2_escrow_policy_templates',
    'v2_escrow_executions',
    'v2_asset_events',
    'v2_idempotency_records',
    'v2_callback_events',
    'v2_outbox_events',
    'v2_dead_letter_queue'
  ];
BEGIN
  FOREACH t IN ARRAY flagged_tables
  LOOP
    IF to_regclass(format('public.%I', t)) IS NULL THEN
      RAISE NOTICE 'Skipping missing table public.%', t;
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = t
        AND policyname = format('service_role_full_access_%s', t)
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)',
        format('service_role_full_access_%s', t),
        t
      );
    END IF;
  END LOOP;
END;
$$;

COMMIT;
