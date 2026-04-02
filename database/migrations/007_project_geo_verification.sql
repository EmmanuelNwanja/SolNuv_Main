-- =====================================================
-- SolNuv Migration 007 - Project Geo Verification, Photo & Admin Controls
-- Adds per-project geolocation verification status, project photo,
-- admin delist flag, and leaderboard verification counters.
-- =====================================================

-- 1. Extend the projects table
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS geo_source VARCHAR(20) NOT NULL DEFAULT 'none'
    CONSTRAINT projects_geo_source_check CHECK (geo_source IN ('image_exif', 'manual', 'none')),
  ADD COLUMN IF NOT EXISTS geo_verified BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS geo_verified_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS geo_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS project_photo_url TEXT,
  ADD COLUMN IF NOT EXISTS is_delisted BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Extend the leaderboard_cache table (populated by schedulerService.refreshLeaderboard)
ALTER TABLE leaderboard_cache
  ADD COLUMN IF NOT EXISTS verified_projects_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unverified_projects_count INTEGER NOT NULL DEFAULT 0;

-- 3. Performance indexes
CREATE INDEX IF NOT EXISTS idx_projects_geo_verified   ON projects(geo_verified);
CREATE INDEX IF NOT EXISTS idx_projects_geo_source     ON projects(geo_source);
CREATE INDEX IF NOT EXISTS idx_projects_is_delisted    ON projects(is_delisted);

-- 4. Supabase Storage bucket for project photos (run manually in the Supabase dashboard
--    OR via the Storage API, because they are not pure SQL objects).
--
--   bucket name : project-photos
--   public      : true          (photos are displayed on public QR pages)
--   file size   : 5 MB max
--   MIME types  : image/jpeg, image/png, image/webp
--
-- To create via SQL (Supabase >= 2.0 only):
--   INSERT INTO storage.buckets (id, name, public)
--   VALUES ('project-photos', 'project-photos', true)
--   ON CONFLICT (id) DO NOTHING;
