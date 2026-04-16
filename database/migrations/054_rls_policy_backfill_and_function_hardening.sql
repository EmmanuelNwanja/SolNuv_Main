-- =====================================================
-- Migration 054: RLS policy backfill + function hardening
-- Purpose:
-- 1) Resolve "RLS enabled no policy" findings
-- 2) Fix mutable search_path on trigger function
-- =====================================================

BEGIN;

-- =====================================================
-- 1. Add explicit policies for tables with RLS but no policy
-- Keep behavior unchanged: backend service_role retains access.
-- =====================================================

DO $$
DECLARE
  t TEXT;
  target_tables TEXT[] := ARRAY[
    'ai_tool_executions',
    'companies',
    'equipment',
    'popup_campaigns'
  ];
BEGIN
  FOREACH t IN ARRAY target_tables
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

-- =====================================================
-- 2. Harden trigger helper function with fixed search_path
-- =====================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

COMMIT;
