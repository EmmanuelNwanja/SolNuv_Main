-- Global CMS foundation for public, partner, and authenticated app pages.

CREATE TABLE IF NOT EXISTS cms_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_key TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  route_path TEXT NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN ('public', 'partner', 'app', 'admin')),
  description TEXT,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  is_published BOOLEAN NOT NULL DEFAULT false,
  current_revision INTEGER NOT NULL DEFAULT 1,
  schema_version INTEGER NOT NULL DEFAULT 1,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
  published_by UUID REFERENCES users(id) ON DELETE SET NULL,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cms_pages_route
  ON cms_pages (route_path);

CREATE INDEX IF NOT EXISTS idx_cms_pages_scope_enabled
  ON cms_pages (scope, is_enabled, is_published);

CREATE TABLE IF NOT EXISTS cms_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID NOT NULL REFERENCES cms_pages(id) ON DELETE CASCADE,
  section_key TEXT NOT NULL,
  section_type TEXT NOT NULL DEFAULT 'generic',
  title TEXT,
  subtitle TEXT,
  body TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  style_token TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(page_id, section_key)
);

CREATE INDEX IF NOT EXISTS idx_cms_sections_page_order
  ON cms_sections (page_id, order_index);

CREATE TABLE IF NOT EXISTS cms_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id UUID NOT NULL REFERENCES cms_sections(id) ON DELETE CASCADE,
  card_key TEXT NOT NULL,
  card_type TEXT NOT NULL DEFAULT 'generic',
  title TEXT,
  body TEXT,
  image_url TEXT,
  icon_name TEXT,
  badge_label TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(section_id, card_key)
);

CREATE INDEX IF NOT EXISTS idx_cms_cards_section_order
  ON cms_cards (section_id, order_index);

CREATE TABLE IF NOT EXISTS cms_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID REFERENCES cms_pages(id) ON DELETE CASCADE,
  section_id UUID REFERENCES cms_sections(id) ON DELETE CASCADE,
  card_id UUID REFERENCES cms_cards(id) ON DELETE CASCADE,
  link_key TEXT NOT NULL,
  label TEXT NOT NULL,
  href TEXT NOT NULL,
  target TEXT NOT NULL DEFAULT '_self' CHECK (target IN ('_self', '_blank')),
  rel TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cms_links_page_order
  ON cms_links (page_id, order_index);

CREATE INDEX IF NOT EXISTS idx_cms_links_section_order
  ON cms_links (section_id, order_index);

CREATE INDEX IF NOT EXISTS idx_cms_links_card_order
  ON cms_links (card_id, order_index);

CREATE UNIQUE INDEX IF NOT EXISTS uq_cms_links_scope_key
  ON cms_links (
    coalesce(page_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(section_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(card_id, '00000000-0000-0000-0000-000000000000'::uuid),
    link_key
  );

CREATE TABLE IF NOT EXISTS cms_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID NOT NULL REFERENCES cms_pages(id) ON DELETE CASCADE,
  revision_number INTEGER NOT NULL,
  snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  change_note TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(page_id, revision_number)
);

CREATE INDEX IF NOT EXISTS idx_cms_revisions_page_rev
  ON cms_revisions (page_id, revision_number DESC);

CREATE TABLE IF NOT EXISTS cms_publish_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID NOT NULL REFERENCES cms_pages(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('save', 'publish', 'unpublish', 'rollback')),
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  from_revision INTEGER,
  to_revision INTEGER,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cms_publish_events_page
  ON cms_publish_events (page_id, created_at DESC);
