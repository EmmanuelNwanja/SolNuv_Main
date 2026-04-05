-- ============================================================
-- Migration 014: FAQs
-- Publicly visible FAQ entries, admin-managed, optionally
-- linked to a blog post for deeper reading.
-- ============================================================

CREATE TABLE IF NOT EXISTS faqs (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  question      text NOT NULL,
  answer        text NOT NULL,
  category      text NOT NULL DEFAULT 'General',
  order_index   smallint NOT NULL DEFAULT 0,
  is_published  boolean NOT NULL DEFAULT false,
  blog_post_slug text,                          -- optional link to a blog post
  blog_post_label text,                         -- CTA button label, e.g. "Read the full guide"
  created_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_faqs_published    ON faqs (is_published, category, order_index);
CREATE INDEX IF NOT EXISTS idx_faqs_blog_slug    ON faqs (blog_post_slug) WHERE blog_post_slug IS NOT NULL;

ALTER TABLE faqs ENABLE ROW LEVEL SECURITY;
-- Public can read published FAQs; writes go through the service role (backend)
CREATE POLICY "Public read published FAQs" ON faqs
  FOR SELECT USING (is_published = true);
