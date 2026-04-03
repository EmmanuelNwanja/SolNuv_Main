-- ============================================================
-- Migration 010: Blog, Ads, Contact Forms & Analytics
-- ============================================================

-- ── Blog Posts ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS blog_posts (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  slug            text NOT NULL UNIQUE,
  title           text NOT NULL,
  excerpt         text,
  content         text NOT NULL,
  cover_image_url text,
  author_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  status          text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  category        text,
  tags            text[] DEFAULT '{}',
  read_time_mins  smallint DEFAULT 1,
  published_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_blog_posts_status ON blog_posts (status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_blog_posts_slug   ON blog_posts (slug);

ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read published posts" ON blog_posts
  FOR SELECT USING (status = 'published');

-- ── Blog Post Analytics (reads / link clicks) ─────────────────
CREATE TABLE IF NOT EXISTS blog_post_reads (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id     uuid NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
  user_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ip_hash     text,
  referrer    text,
  read_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_blog_reads_post ON blog_post_reads (post_id, read_at);

ALTER TABLE blog_post_reads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages blog reads" ON blog_post_reads FOR ALL USING (false);

CREATE TABLE IF NOT EXISTS blog_link_clicks (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id     uuid NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
  url         text NOT NULL,
  user_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ip_hash     text,
  clicked_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_blog_clicks_post ON blog_link_clicks (post_id, clicked_at);

ALTER TABLE blog_link_clicks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages link clicks" ON blog_link_clicks FOR ALL USING (false);

-- ── Ads ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ads (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title           text NOT NULL,
  image_url       text,
  target_url      text,
  body_text       text,
  placement       text NOT NULL DEFAULT 'sidebar' CHECK (placement IN ('sidebar','banner','in-feed','footer','blog-top','blog-bottom','popup')),
  is_active       boolean NOT NULL DEFAULT true,
  priority        smallint NOT NULL DEFAULT 0,
  start_date      date,
  end_date        date,
  created_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ads_active ON ads (is_active, placement, priority DESC);

ALTER TABLE ads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can view active ads" ON ads FOR SELECT USING (is_active = true);

-- ── Ad Impressions & Clicks ───────────────────────────────────
CREATE TABLE IF NOT EXISTS ad_impressions (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ad_id       uuid NOT NULL REFERENCES ads(id) ON DELETE CASCADE,
  user_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ip_hash     text,
  page_path   text,
  shown_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ad_impressions_ad ON ad_impressions (ad_id, shown_at);

ALTER TABLE ad_impressions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages ad impressions" ON ad_impressions FOR ALL USING (false);

CREATE TABLE IF NOT EXISTS ad_clicks (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ad_id       uuid NOT NULL REFERENCES ads(id) ON DELETE CASCADE,
  user_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ip_hash     text,
  page_path   text,
  clicked_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ad_clicks_ad ON ad_clicks (ad_id, clicked_at);

ALTER TABLE ad_clicks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages ad clicks" ON ad_clicks FOR ALL USING (false);

-- ── Page View Analytics ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS page_views (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  path        text NOT NULL,
  user_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id  text,
  ip_hash     text,
  referrer    text,
  user_agent  text,
  country     text,
  duration_s  int,   -- populated on exit via beacon
  viewed_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_page_views_path ON page_views (path, viewed_at);
CREATE INDEX IF NOT EXISTS idx_page_views_user ON page_views (user_id, viewed_at);

ALTER TABLE page_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages page views" ON page_views FOR ALL USING (false);

-- ── Contact Form Submissions ──────────────────────────────────
CREATE TABLE IF NOT EXISTS contact_submissions (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name          text NOT NULL,
  email         text NOT NULL,
  phone         text,
  subject       text,
  message       text NOT NULL,
  status        text NOT NULL DEFAULT 'new' CHECK (status IN ('new','in_progress','resolved','spam')),
  admin_notes   text,
  resolved_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at   timestamptz,
  submitted_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contact_status ON contact_submissions (status, submitted_at DESC);

ALTER TABLE contact_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages contact submissions" ON contact_submissions FOR ALL USING (false);
