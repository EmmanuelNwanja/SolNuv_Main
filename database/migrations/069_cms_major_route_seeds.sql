-- Seed major routes for immediate CMS onboarding.
-- Safe to re-run via NOT EXISTS guards.

INSERT INTO cms_pages (page_key, title, route_path, scope, description, is_enabled, is_published, current_revision, schema_version, metadata)
SELECT 'home', 'Homepage', '/', 'public', 'Homepage managed via Content Studio', true, false, 1, 1, '{}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM cms_pages WHERE page_key = 'home');

INSERT INTO cms_pages (page_key, title, route_path, scope, description, is_enabled, is_published, current_revision, schema_version, metadata)
SELECT 'pricing', 'Pricing', '/pricing', 'public', 'Pricing page managed via Content Studio', true, false, 1, 1, '{}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM cms_pages WHERE page_key = 'pricing');

INSERT INTO cms_pages (page_key, title, route_path, scope, description, is_enabled, is_published, current_revision, schema_version, metadata)
SELECT 'contact', 'Contact', '/contact', 'public', 'Contact page managed via Content Studio', true, false, 1, 1, '{}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM cms_pages WHERE page_key = 'contact');

INSERT INTO cms_pages (page_key, title, route_path, scope, description, is_enabled, is_published, current_revision, schema_version, metadata)
SELECT 'blog_index', 'Blog', '/blog', 'public', 'Blog index managed via Content Studio', true, false, 1, 1, '{}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM cms_pages WHERE page_key = 'blog_index');

INSERT INTO cms_pages (page_key, title, route_path, scope, description, is_enabled, is_published, current_revision, schema_version, metadata)
SELECT 'faq', 'FAQ', '/faq', 'public', 'FAQ page managed via Content Studio', true, false, 1, 1, '{}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM cms_pages WHERE page_key = 'faq');

INSERT INTO cms_pages (page_key, title, route_path, scope, description, is_enabled, is_published, current_revision, schema_version, metadata)
SELECT 'project_verification', 'Project Verification', '/project-verification', 'public', 'Project verification page managed via Content Studio', true, false, 1, 1, '{}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM cms_pages WHERE page_key = 'project_verification');

INSERT INTO cms_pages (page_key, title, route_path, scope, description, is_enabled, is_published, current_revision, schema_version, metadata)
SELECT 'pitch', 'Pitch', '/pitch', 'public', 'Pitch page managed via Content Studio', true, false, 1, 1, '{}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM cms_pages WHERE page_key = 'pitch');

INSERT INTO cms_pages (page_key, title, route_path, scope, description, is_enabled, is_published, current_revision, schema_version, metadata)
SELECT 'dashboard', 'Dashboard', '/dashboard', 'app', 'Dashboard managed via Content Studio', true, false, 1, 1, '{}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM cms_pages WHERE page_key = 'dashboard');

INSERT INTO cms_pages (page_key, title, route_path, scope, description, is_enabled, is_published, current_revision, schema_version, metadata)
SELECT 'projects', 'Projects', '/projects', 'app', 'Projects page managed via Content Studio', true, false, 1, 1, '{}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM cms_pages WHERE page_key = 'projects');

INSERT INTO cms_pages (page_key, title, route_path, scope, description, is_enabled, is_published, current_revision, schema_version, metadata)
SELECT 'reports', 'Reports', '/reports', 'app', 'Reports page managed via Content Studio', true, false, 1, 1, '{}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM cms_pages WHERE page_key = 'reports');

INSERT INTO cms_pages (page_key, title, route_path, scope, description, is_enabled, is_published, current_revision, schema_version, metadata)
SELECT 'settings', 'Settings', '/settings', 'app', 'Settings page managed via Content Studio', true, false, 1, 1, '{}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM cms_pages WHERE page_key = 'settings');

INSERT INTO cms_pages (page_key, title, route_path, scope, description, is_enabled, is_published, current_revision, schema_version, metadata)
SELECT 'partner_recycling', 'Partner Recycling', '/partners/recycling', 'partner', 'Recycler partner dashboard managed via Content Studio', true, false, 1, 1, '{}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM cms_pages WHERE page_key = 'partner_recycling');

INSERT INTO cms_pages (page_key, title, route_path, scope, description, is_enabled, is_published, current_revision, schema_version, metadata)
SELECT 'partner_finance', 'Partner Finance', '/partners/finance', 'partner', 'Finance partner dashboard managed via Content Studio', true, false, 1, 1, '{}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM cms_pages WHERE page_key = 'partner_finance');

INSERT INTO cms_pages (page_key, title, route_path, scope, description, is_enabled, is_published, current_revision, schema_version, metadata)
SELECT 'partner_training', 'Partner Training', '/partners/training', 'partner', 'Training partner dashboard managed via Content Studio', true, false, 1, 1, '{}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM cms_pages WHERE page_key = 'partner_training');
