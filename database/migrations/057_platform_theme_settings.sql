-- Platform theme availability (admin-controlled). At least one of light/dark must stay enabled.
--
-- Prerequisite: public.platform_seo_settings is created in 027_seo_platform_settings.sql
-- (which requires users from 001_initial_schema.sql).

DO $pre$
BEGIN
  IF to_regclass('public.platform_seo_settings') IS NULL THEN
    RAISE EXCEPTION
      'Table platform_seo_settings does not exist. Run database/migrations/001_initial_schema.sql first, then 027_seo_platform_settings.sql, then re-run this migration.';
  END IF;
END
$pre$;

ALTER TABLE platform_seo_settings
  ADD COLUMN IF NOT EXISTS theme_light_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS theme_dark_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS theme_default TEXT NOT NULL DEFAULT 'light';

ALTER TABLE platform_seo_settings
  DROP CONSTRAINT IF EXISTS platform_seo_settings_theme_default_check;

ALTER TABLE platform_seo_settings
  ADD CONSTRAINT platform_seo_settings_theme_default_check
  CHECK (theme_default IN ('light', 'dark'));
