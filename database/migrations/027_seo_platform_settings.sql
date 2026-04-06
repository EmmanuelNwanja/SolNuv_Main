-- ─── Migration 027: SEO & Platform Settings ────────────────────────────────
-- Stores site-wide SEO and branding settings, managed by super_admin.
-- Single-row table (enforced via unique constraint on row_key).

CREATE TABLE IF NOT EXISTS platform_seo_settings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  row_key       TEXT NOT NULL DEFAULT 'global' UNIQUE,   -- always 'global'
  site_name     TEXT NOT NULL DEFAULT 'SolNuv',
  default_title TEXT NOT NULL DEFAULT 'SolNuv — Africa''s Solar Engineering & Lifecycle Intelligence Platform',
  default_description TEXT NOT NULL DEFAULT 'Design, model, monitor and report on solar+BESS projects across Africa. Professional tools for solar engineers, companies and asset managers.',
  default_keywords TEXT NOT NULL DEFAULT 'solar engineering Africa, BESS design, solar PV software, Nigeria solar, renewable energy, solar calculator',
  og_image_url  TEXT DEFAULT NULL,                        -- Absolute URL to default OG image
  twitter_handle TEXT DEFAULT '@solnuv',
  canonical_base TEXT NOT NULL DEFAULT 'https://solnuv.com',
  google_site_verification TEXT DEFAULT NULL,             -- Google Search Console meta content
  google_analytics_id TEXT DEFAULT NULL,                  -- GA4 measurement ID (G-XXXXXXXX)
  structured_data JSONB DEFAULT NULL,                     -- JSON-LD org schema override
  extra_head_tags TEXT DEFAULT NULL,                      -- Raw HTML injected into <head>
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by    UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Seed the default row
INSERT INTO platform_seo_settings (row_key)
VALUES ('global')
ON CONFLICT (row_key) DO NOTHING;
