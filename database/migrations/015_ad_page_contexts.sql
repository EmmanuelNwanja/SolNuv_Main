-- ============================================================
-- Migration 015: Ad Page Contexts
-- Replaces the narrow blog-specific placement values with a
-- flexible page_contexts array so admins can target any page/section.
--
-- New model:
--   placement  = the "slot type" within the page
--                (sidebar | banner | in-feed | footer | inline | popup)
--   page_contexts = which pages the ad should appear on
--                   e.g. {blog,blog_post} or {all}
-- ============================================================

-- 1. Add page_contexts column (default = 'all' = show everywhere)
ALTER TABLE ads
  ADD COLUMN IF NOT EXISTS page_contexts text[] NOT NULL DEFAULT '{all}';

-- 2. GIN index for fast array-containment queries
CREATE INDEX IF NOT EXISTS idx_ads_page_contexts ON ads USING gin(page_contexts);

-- 3. Migrate legacy placement values to new scheme
--    blog-top  → banner slot, scoped to blog + blog_post pages
UPDATE ads
  SET placement = 'banner',
      page_contexts = '{blog,blog_post}'
  WHERE placement = 'blog-top';

--    blog-bottom → footer slot, scoped to blog + blog_post pages
UPDATE ads
  SET placement = 'footer',
      page_contexts = '{blog,blog_post}'
  WHERE placement = 'blog-bottom';

-- 4. Update placement check constraint (remove old blog-specific names, add inline)
ALTER TABLE ads DROP CONSTRAINT IF EXISTS ads_placement_check;

ALTER TABLE ads
  ADD CONSTRAINT ads_placement_check
  CHECK (placement IN ('sidebar', 'banner', 'in-feed', 'footer', 'inline', 'popup'));

-- 5. Helpful comments
COMMENT ON COLUMN ads.page_contexts IS
  'Pages/sections where this ad is eligible. ''{all}'' = everywhere. '
  'Recognised values: all, home, blog, blog_post, faq, contact, dashboard, calculator, plans';

COMMENT ON COLUMN ads.placement IS
  'Slot type within the page: sidebar | banner | in-feed | footer | inline | popup';
