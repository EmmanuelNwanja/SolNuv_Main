const supabase = require('../config/database');
const { sendSuccess, sendError } = require('../utils/responseHelper');
const logger = require('../utils/logger');

const runtimeCache = new Map();
const CACHE_TTL_MS = 60 * 1000;
const runtimeMetrics = {
  cache_hits: 0,
  cache_misses: 0,
  fallback_hits: 0,
};

const MAJOR_PAGE_SEEDS = [
  { page_key: 'home', title: 'Homepage', route_path: '/', scope: 'public' },
  { page_key: 'pricing', title: 'Pricing', route_path: '/pricing', scope: 'public' },
  { page_key: 'contact', title: 'Contact', route_path: '/contact', scope: 'public' },
  { page_key: 'blog_index', title: 'Blog', route_path: '/blog', scope: 'public' },
  { page_key: 'faq', title: 'FAQ', route_path: '/faq', scope: 'public' },
  { page_key: 'project_verification', title: 'Project Verification', route_path: '/project-verification', scope: 'public' },
  { page_key: 'pitch', title: 'Pitch', route_path: '/pitch', scope: 'public' },
  { page_key: 'dashboard', title: 'Dashboard', route_path: '/dashboard', scope: 'app' },
  { page_key: 'projects', title: 'Projects', route_path: '/projects', scope: 'app' },
  { page_key: 'reports', title: 'Reports', route_path: '/reports', scope: 'app' },
  { page_key: 'settings', title: 'Settings', route_path: '/settings', scope: 'app' },
  { page_key: 'partner_recycling', title: 'Partner Recycling', route_path: '/partners/recycling', scope: 'partner' },
  { page_key: 'partner_finance', title: 'Partner Finance', route_path: '/partners/finance', scope: 'partner' },
  { page_key: 'partner_training', title: 'Partner Training', route_path: '/partners/training', scope: 'partner' },
];

function getCacheKey(routePath) {
  return String(routePath || '').trim().toLowerCase();
}

function getCached(routePath) {
  const key = getCacheKey(routePath);
  const value = runtimeCache.get(key);
  if (!value) return null;
  if (Date.now() - value.ts > CACHE_TTL_MS) {
    runtimeCache.delete(key);
    return null;
  }
  return value.payload;
}

function setCached(routePath, payload) {
  runtimeCache.set(getCacheKey(routePath), { ts: Date.now(), payload });
}

function invalidatePageCache(routePath) {
  if (!routePath) return;
  runtimeCache.delete(getCacheKey(routePath));
}

function requiredBySectionType(section) {
  const sectionType = String(section?.section_type || 'generic');
  if (sectionType === 'hero') {
    if (!String(section?.title || '').trim()) return 'Hero section requires title';
    if (!String(section?.body || '').trim()) return 'Hero section requires body';
  }
  if (sectionType === 'stats') {
    if (!String(section?.title || '').trim()) return 'Stats section requires title';
  }
  return null;
}

function requiredByCardType(card) {
  const cardType = String(card?.card_type || 'generic');
  if (cardType === 'metric') {
    if (!String(card?.title || '').trim()) return 'Metric card requires title';
    if (!String(card?.body || '').trim()) return 'Metric card requires body';
  }
  if (cardType === 'testimonial') {
    if (!String(card?.body || '').trim()) return 'Testimonial card requires body';
  }
  return null;
}

async function buildPagePayload(pageId) {
  const { data: page, error: pageError } = await supabase
    .from('cms_pages')
    .select('*')
    .eq('id', pageId)
    .single();
  if (pageError) throw pageError;

  const { data: sections, error: sectionError } = await supabase
    .from('cms_sections')
    .select('*')
    .eq('page_id', pageId)
    .order('order_index', { ascending: true });
  if (sectionError) throw sectionError;

  const sectionIds = (sections || []).map((s) => s.id);
  const { data: cards, error: cardsError } = sectionIds.length
    ? await supabase
        .from('cms_cards')
        .select('*')
        .in('section_id', sectionIds)
        .order('order_index', { ascending: true })
    : { data: [], error: null };
  if (cardsError) throw cardsError;

  const cardIds = (cards || []).map((c) => c.id);
  const { data: links, error: linksError } = await supabase
    .from('cms_links')
    .select('*')
    .or(
      [
        `page_id.eq.${pageId}`,
        sectionIds.length ? `section_id.in.(${sectionIds.join(',')})` : null,
        cardIds.length ? `card_id.in.(${cardIds.join(',')})` : null,
      ]
        .filter(Boolean)
        .join(','),
    )
    .order('order_index', { ascending: true });
  if (linksError) throw linksError;

  const cardsBySection = {};
  for (const card of cards || []) {
    if (!cardsBySection[card.section_id]) cardsBySection[card.section_id] = [];
    cardsBySection[card.section_id].push(card);
  }

  const linksByOwner = {};
  for (const link of links || []) {
    const owner = link.card_id || link.section_id || link.page_id;
    if (!owner) continue;
    if (!linksByOwner[owner]) linksByOwner[owner] = [];
    linksByOwner[owner].push(link);
  }

  return {
    ...page,
    sections: (sections || []).map((section) => ({
      ...section,
      links: linksByOwner[section.id] || [],
      cards: (cardsBySection[section.id] || []).map((card) => ({
        ...card,
        links: linksByOwner[card.id] || [],
      })),
    })),
    links: linksByOwner[pageId] || [],
  };
}

async function createRevision(pageId, actorId, note = null) {
  const payload = await buildPagePayload(pageId);
  const revisionNumber = Number(payload.current_revision || 1) + 1;
  await supabase.from('cms_revisions').insert({
    page_id: pageId,
    revision_number: revisionNumber,
    snapshot: payload,
    change_note: note,
    created_by: actorId || null,
  });
  await supabase
    .from('cms_pages')
    .update({
      current_revision: revisionNumber,
      updated_by: actorId || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', pageId);
  return revisionNumber;
}

async function logCmsEvent(pageId, actorId, eventType, metadata = {}, fromRevision = null, toRevision = null) {
  await supabase.from('cms_publish_events').insert({
    page_id: pageId,
    event_type: eventType,
    actor_user_id: actorId || null,
    from_revision: fromRevision,
    to_revision: toRevision,
    metadata,
  });
}

exports.resolveRuntimePage = async (req, res) => {
  try {
    const routePath = String(req.query?.route_path || req.params?.routePath || '').trim();
    if (!routePath) return sendError(res, 'route_path is required', 400);

    const cached = getCached(routePath);
    if (cached) {
      runtimeMetrics.cache_hits += 1;
      return sendSuccess(res, { ...cached, source: 'cms-cache-hit', telemetry: runtimeMetrics });
    }
    runtimeMetrics.cache_misses += 1;

    const { data: page, error } = await supabase
      .from('cms_pages')
      .select('*')
      .eq('route_path', routePath)
      .eq('is_enabled', true)
      .eq('is_published', true)
      .maybeSingle();
    if (error) throw error;
    if (!page) {
      runtimeMetrics.fallback_hits += 1;
      return sendSuccess(res, {
        route_path: routePath,
        page: null,
        sections: [],
        links: [],
        source: 'fallback-static',
        fallback: true,
        telemetry: runtimeMetrics,
      });
    }

    const payload = await buildPagePayload(page.id);
    const responsePayload = {
      route_path: routePath,
      page: payload,
      sections: payload.sections || [],
      links: payload.links || [],
      publishedAt: payload.published_at || null,
      revision: payload.current_revision || 1,
      source: 'cms-db',
      fallback: false,
      telemetry: runtimeMetrics,
    };
    setCached(routePath, responsePayload);
    return sendSuccess(res, responsePayload);
  } catch (error) {
    logger.error('cms:resolveRuntimePage failed', { message: error.message });
    return sendError(res, 'Failed to resolve runtime page', 500);
  }
};

exports.adminListPages = async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from('cms_pages')
      .select('*')
      .order('scope', { ascending: true })
      .order('route_path', { ascending: true });
    if (error) throw error;
    return sendSuccess(res, { pages: data || [] });
  } catch (error) {
    logger.error('cms:adminListPages failed', { message: error.message });
    return sendError(res, 'Failed to load CMS pages', 500);
  }
};

exports.adminBootstrapSeeds = async (req, res) => {
  try {
    const actorId = req.user?.id || null;
    const createdPages = [];
    const existingPages = [];

    for (const seed of MAJOR_PAGE_SEEDS) {
      const { data: existing } = await supabase
        .from('cms_pages')
        .select('id, page_key')
        .eq('page_key', seed.page_key)
        .maybeSingle();

      if (existing?.id) {
        existingPages.push(existing.page_key);
        continue;
      }

      const { data: page, error } = await supabase
        .from('cms_pages')
        .insert({
          ...seed,
          description: `${seed.title} managed via Content Studio`,
          is_enabled: true,
          is_published: false,
          current_revision: 1,
          schema_version: 1,
          metadata: {},
          created_by: actorId,
          updated_by: actorId,
        })
        .select('*')
        .single();
      if (error) throw error;

      const { data: section } = await supabase
        .from('cms_sections')
        .insert({
          page_id: page.id,
          section_key: 'hero',
          section_type: 'hero',
          title: seed.title,
          subtitle: 'Editable heading',
          body: `Content for ${seed.title}`,
          order_index: 0,
          is_visible: true,
          metadata: {},
        })
        .select('id')
        .single();

      if (section?.id) {
        await supabase.from('cms_cards').insert({
          section_id: section.id,
          card_key: 'intro_card',
          card_type: 'feature',
          title: 'Intro card',
          body: `Update this card for ${seed.title}`,
          order_index: 0,
          is_visible: true,
          metadata: {},
        });
      }

      await logCmsEvent(page.id, actorId, 'save', { entity: 'seed_bootstrap' }, 1, 1);
      createdPages.push(page.page_key);
    }

    return sendSuccess(res, {
      created_count: createdPages.length,
      created_pages: createdPages,
      existing_pages: existingPages,
    }, 'CMS seeds bootstrapped');
  } catch (error) {
    logger.error('cms:adminBootstrapSeeds failed', { message: error.message });
    return sendError(res, 'Failed to bootstrap CMS seeds', 500);
  }
};

exports.adminGetPage = async (req, res) => {
  try {
    const id = String(req.params?.id || '');
    if (!id) return sendError(res, 'Page id required', 400);
    const payload = await buildPagePayload(id);
    const { data: revisions } = await supabase
      .from('cms_revisions')
      .select('id, revision_number, change_note, created_at, created_by')
      .eq('page_id', id)
      .order('revision_number', { ascending: false })
      .limit(20);
    return sendSuccess(res, { ...payload, revisions: revisions || [] });
  } catch (error) {
    logger.error('cms:adminGetPage failed', { message: error.message });
    return sendError(res, 'Failed to load CMS page', 500);
  }
};

exports.adminUpsertPage = async (req, res) => {
  try {
    const actorId = req.user?.id || null;
    const payload = req.body || {};
    const id = String(payload.id || '').trim();
    const patch = {
      page_key: String(payload.page_key || '').trim(),
      title: String(payload.title || '').trim(),
      route_path: String(payload.route_path || '').trim(),
      scope: String(payload.scope || 'public').trim(),
      description: payload.description || null,
      is_enabled: payload.is_enabled !== false,
      is_published: Boolean(payload.is_published),
      metadata: typeof payload.metadata === 'object' && payload.metadata ? payload.metadata : {},
      updated_by: actorId,
      updated_at: new Date().toISOString(),
    };
    if (!patch.page_key || !patch.title || !patch.route_path) {
      return sendError(res, 'page_key, title, route_path are required', 400);
    }
    if (!['public', 'partner', 'app', 'admin'].includes(patch.scope)) {
      return sendError(res, 'Invalid scope value', 400);
    }

    let result;
    if (id) {
      result = await supabase.from('cms_pages').update(patch).eq('id', id).select('*').single();
    } else {
      result = await supabase
        .from('cms_pages')
        .insert({
          ...patch,
          current_revision: 1,
          schema_version: 1,
          created_by: actorId,
        })
        .select('*')
        .single();
    }
    if (result.error) throw result.error;
    invalidatePageCache(result.data.route_path);
    await logCmsEvent(result.data.id, actorId, 'save', { entity: 'page' }, result.data.current_revision, result.data.current_revision);
    return sendSuccess(res, result.data, 'CMS page saved');
  } catch (error) {
    logger.error('cms:adminUpsertPage failed', { message: error.message });
    return sendError(res, 'Failed to save CMS page', 500);
  }
};

exports.adminUpsertSection = async (req, res) => {
  try {
    const payload = req.body || {};
    const id = String(payload.id || '').trim();
    const patch = {
      page_id: payload.page_id,
      section_key: String(payload.section_key || '').trim(),
      section_type: String(payload.section_type || 'generic'),
      title: payload.title || null,
      subtitle: payload.subtitle || null,
      body: payload.body || null,
      order_index: Number(payload.order_index || 0),
      is_visible: payload.is_visible !== false,
      style_token: payload.style_token || null,
      metadata: typeof payload.metadata === 'object' && payload.metadata ? payload.metadata : {},
      updated_at: new Date().toISOString(),
    };
    if (!patch.page_id || !patch.section_key) return sendError(res, 'page_id and section_key are required', 400);
    const requiredError = requiredBySectionType(patch);
    if (requiredError) return sendError(res, requiredError, 400);

    let result;
    if (id) {
      result = await supabase.from('cms_sections').update(patch).eq('id', id).select('*').single();
    } else {
      result = await supabase.from('cms_sections').insert(patch).select('*').single();
    }
    if (result.error) throw result.error;

    const nextRevision = await createRevision(patch.page_id, req.user?.id || null, 'Section updated');
    await logCmsEvent(patch.page_id, req.user?.id || null, 'save', { entity: 'section', entity_id: result.data.id }, nextRevision - 1, nextRevision);
    const { data: page } = await supabase.from('cms_pages').select('route_path').eq('id', patch.page_id).single();
    invalidatePageCache(page?.route_path);
    return sendSuccess(res, result.data, 'Section saved');
  } catch (error) {
    logger.error('cms:adminUpsertSection failed', { message: error.message });
    return sendError(res, 'Failed to save section', 500);
  }
};

exports.adminDeleteSection = async (req, res) => {
  try {
    const id = String(req.params?.id || '');
    if (!id) return sendError(res, 'section id required', 400);
    const { data: section } = await supabase.from('cms_sections').select('id, page_id').eq('id', id).single();
    const { error } = await supabase.from('cms_sections').delete().eq('id', id);
    if (error) throw error;
    if (section?.page_id) {
      const nextRevision = await createRevision(section.page_id, req.user?.id || null, 'Section deleted');
      await logCmsEvent(section.page_id, req.user?.id || null, 'save', { entity: 'section_delete', entity_id: id }, nextRevision - 1, nextRevision);
      const { data: page } = await supabase
        .from('cms_pages')
        .select('route_path')
        .eq('id', section.page_id)
        .single();
      invalidatePageCache(page?.route_path);
    }
    return sendSuccess(res, { id }, 'Section deleted');
  } catch (error) {
    logger.error('cms:adminDeleteSection failed', { message: error.message });
    return sendError(res, 'Failed to delete section', 500);
  }
};

exports.adminUpsertCard = async (req, res) => {
  try {
    const payload = req.body || {};
    const id = String(payload.id || '').trim();
    const patch = {
      section_id: payload.section_id,
      card_key: String(payload.card_key || '').trim(),
      card_type: String(payload.card_type || 'generic'),
      title: payload.title || null,
      body: payload.body || null,
      image_url: payload.image_url || null,
      icon_name: payload.icon_name || null,
      badge_label: payload.badge_label || null,
      order_index: Number(payload.order_index || 0),
      is_visible: payload.is_visible !== false,
      metadata: typeof payload.metadata === 'object' && payload.metadata ? payload.metadata : {},
      updated_at: new Date().toISOString(),
    };
    if (!patch.section_id || !patch.card_key) return sendError(res, 'section_id and card_key are required', 400);
    const cardRequiredError = requiredByCardType(patch);
    if (cardRequiredError) return sendError(res, cardRequiredError, 400);

    let result;
    if (id) {
      result = await supabase.from('cms_cards').update(patch).eq('id', id).select('*').single();
    } else {
      result = await supabase.from('cms_cards').insert(patch).select('*').single();
    }
    if (result.error) throw result.error;

    const { data: section } = await supabase
      .from('cms_sections')
      .select('id, page_id')
      .eq('id', patch.section_id)
      .single();
    if (section?.page_id) {
      const nextRevision = await createRevision(section.page_id, req.user?.id || null, 'Card updated');
      await logCmsEvent(section.page_id, req.user?.id || null, 'save', { entity: 'card', entity_id: result.data.id }, nextRevision - 1, nextRevision);
      const { data: page } = await supabase
        .from('cms_pages')
        .select('route_path')
        .eq('id', section.page_id)
        .single();
      invalidatePageCache(page?.route_path);
    }
    return sendSuccess(res, result.data, 'Card saved');
  } catch (error) {
    logger.error('cms:adminUpsertCard failed', { message: error.message });
    return sendError(res, 'Failed to save card', 500);
  }
};

exports.adminDeleteCard = async (req, res) => {
  try {
    const id = String(req.params?.id || '');
    if (!id) return sendError(res, 'card id required', 400);
    const { data: card } = await supabase
      .from('cms_cards')
      .select('id, section_id')
      .eq('id', id)
      .single();
    const { error } = await supabase.from('cms_cards').delete().eq('id', id);
    if (error) throw error;
    if (card?.section_id) {
      const { data: section } = await supabase
        .from('cms_sections')
        .select('page_id')
        .eq('id', card.section_id)
        .single();
      if (section?.page_id) {
        const nextRevision = await createRevision(section.page_id, req.user?.id || null, 'Card deleted');
        await logCmsEvent(section.page_id, req.user?.id || null, 'save', { entity: 'card_delete', entity_id: id }, nextRevision - 1, nextRevision);
        const { data: page } = await supabase
          .from('cms_pages')
          .select('route_path')
          .eq('id', section.page_id)
          .single();
        invalidatePageCache(page?.route_path);
      }
    }
    return sendSuccess(res, { id }, 'Card deleted');
  } catch (error) {
    logger.error('cms:adminDeleteCard failed', { message: error.message });
    return sendError(res, 'Failed to delete card', 500);
  }
};

exports.adminUpsertLink = async (req, res) => {
  try {
    const payload = req.body || {};
    const id = String(payload.id || '').trim();
    const patch = {
      page_id: payload.page_id || null,
      section_id: payload.section_id || null,
      card_id: payload.card_id || null,
      link_key: String(payload.link_key || '').trim(),
      label: String(payload.label || '').trim(),
      href: String(payload.href || '').trim(),
      target: payload.target === '_blank' ? '_blank' : '_self',
      rel: payload.rel || null,
      order_index: Number(payload.order_index || 0),
      is_visible: payload.is_visible !== false,
      metadata: typeof payload.metadata === 'object' && payload.metadata ? payload.metadata : {},
      updated_at: new Date().toISOString(),
    };
    if (!patch.link_key || !patch.label || !patch.href) return sendError(res, 'link_key, label and href are required', 400);
    if (!patch.page_id && !patch.section_id && !patch.card_id) {
      return sendError(res, 'One owner is required: page_id, section_id or card_id', 400);
    }

    let result;
    if (id) {
      result = await supabase.from('cms_links').update(patch).eq('id', id).select('*').single();
    } else {
      result = await supabase.from('cms_links').insert(patch).select('*').single();
    }
    if (result.error) throw result.error;

    let pageId = patch.page_id;
    if (!pageId && patch.section_id) {
      const { data: section } = await supabase
        .from('cms_sections')
        .select('page_id')
        .eq('id', patch.section_id)
        .single();
      pageId = section?.page_id || null;
    }
    if (!pageId && patch.card_id) {
      const { data: card } = await supabase
        .from('cms_cards')
        .select('section_id')
        .eq('id', patch.card_id)
        .single();
      if (card?.section_id) {
        const { data: section } = await supabase
          .from('cms_sections')
          .select('page_id')
          .eq('id', card.section_id)
          .single();
        pageId = section?.page_id || null;
      }
    }

    if (pageId) {
      const nextRevision = await createRevision(pageId, req.user?.id || null, 'Link updated');
      await logCmsEvent(pageId, req.user?.id || null, 'save', { entity: 'link', entity_id: result.data.id }, nextRevision - 1, nextRevision);
      const { data: page } = await supabase.from('cms_pages').select('route_path').eq('id', pageId).single();
      invalidatePageCache(page?.route_path);
    }

    return sendSuccess(res, result.data, 'Link saved');
  } catch (error) {
    logger.error('cms:adminUpsertLink failed', { message: error.message });
    return sendError(res, 'Failed to save link', 500);
  }
};

exports.adminDeleteLink = async (req, res) => {
  try {
    const id = String(req.params?.id || '');
    if (!id) return sendError(res, 'link id required', 400);
    const { data: link } = await supabase
      .from('cms_links')
      .select('id, page_id, section_id, card_id')
      .eq('id', id)
      .single();
    const { error } = await supabase.from('cms_links').delete().eq('id', id);
    if (error) throw error;

    let pageId = link?.page_id || null;
    if (!pageId && link?.section_id) {
      const { data: section } = await supabase
        .from('cms_sections')
        .select('page_id')
        .eq('id', link.section_id)
        .single();
      pageId = section?.page_id || null;
    }
    if (!pageId && link?.card_id) {
      const { data: card } = await supabase
        .from('cms_cards')
        .select('section_id')
        .eq('id', link.card_id)
        .single();
      if (card?.section_id) {
        const { data: section } = await supabase
          .from('cms_sections')
          .select('page_id')
          .eq('id', card.section_id)
          .single();
        pageId = section?.page_id || null;
      }
    }

    if (pageId) {
      const nextRevision = await createRevision(pageId, req.user?.id || null, 'Link deleted');
      await logCmsEvent(pageId, req.user?.id || null, 'save', { entity: 'link_delete', entity_id: id }, nextRevision - 1, nextRevision);
      const { data: page } = await supabase.from('cms_pages').select('route_path').eq('id', pageId).single();
      invalidatePageCache(page?.route_path);
    }
    return sendSuccess(res, { id }, 'Link deleted');
  } catch (error) {
    logger.error('cms:adminDeleteLink failed', { message: error.message });
    return sendError(res, 'Failed to delete link', 500);
  }
};

exports.adminPublishPage = async (req, res) => {
  try {
    const actorId = req.user?.id || null;
    const pageId = String(req.params?.id || '');
    if (!pageId) return sendError(res, 'page id required', 400);

    const { data: page, error } = await supabase.from('cms_pages').select('*').eq('id', pageId).single();
    if (error || !page) return sendError(res, 'Page not found', 404);

    const revisionNumber = await createRevision(pageId, actorId, 'Page published');
    const { data: updated, error: updateErr } = await supabase
      .from('cms_pages')
      .update({
        is_published: true,
        published_by: actorId,
        published_at: new Date().toISOString(),
        updated_by: actorId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', pageId)
      .select('*')
      .single();
    if (updateErr) throw updateErr;

    await logCmsEvent(pageId, actorId, 'publish', {}, Number(page.current_revision || 1), revisionNumber);

    invalidatePageCache(updated.route_path);
    return sendSuccess(res, updated, 'Page published');
  } catch (error) {
    logger.error('cms:adminPublishPage failed', { message: error.message });
    return sendError(res, 'Failed to publish page', 500);
  }
};

exports.adminUnpublishPage = async (req, res) => {
  try {
    const actorId = req.user?.id || null;
    const pageId = String(req.params?.id || '');
    if (!pageId) return sendError(res, 'page id required', 400);
    const { data: updated, error } = await supabase
      .from('cms_pages')
      .update({
        is_published: false,
        updated_by: actorId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', pageId)
      .select('*')
      .single();
    if (error) throw error;
    await logCmsEvent(pageId, actorId, 'unpublish', {}, Number(updated.current_revision || 1), Number(updated.current_revision || 1));
    invalidatePageCache(updated.route_path);
    return sendSuccess(res, updated, 'Page unpublished');
  } catch (error) {
    logger.error('cms:adminUnpublishPage failed', { message: error.message });
    return sendError(res, 'Failed to unpublish page', 500);
  }
};

exports.adminDeletePage = async (req, res) => {
  try {
    const pageId = String(req.params?.id || '');
    if (!pageId) return sendError(res, 'page id required', 400);
    const { data: page } = await supabase.from('cms_pages').select('id, route_path').eq('id', pageId).single();
    const { error } = await supabase.from('cms_pages').delete().eq('id', pageId);
    if (error) throw error;
    invalidatePageCache(page?.route_path);
    return sendSuccess(res, { id: pageId }, 'Page deleted');
  } catch (error) {
    logger.error('cms:adminDeletePage failed', { message: error.message });
    return sendError(res, 'Failed to delete page', 500);
  }
};

exports.adminReorder = async (req, res) => {
  try {
    const actorId = req.user?.id || null;
    const entity = String(req.body?.entity || '').trim();
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    if (!entity || !items.length) return sendError(res, 'entity and items[] are required', 400);

    const table = entity === 'sections' ? 'cms_sections' : entity === 'cards' ? 'cms_cards' : entity === 'links' ? 'cms_links' : null;
    if (!table) return sendError(res, 'entity must be sections, cards or links', 400);

    let pageIds = new Set();
    for (const item of items) {
      const id = String(item?.id || '').trim();
      const order = Number(item?.order_index || 0);
      if (!id) continue;
      const { error } = await supabase.from(table).update({ order_index: order, updated_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;

      if (entity === 'sections') {
        const { data: row } = await supabase.from('cms_sections').select('page_id').eq('id', id).single();
        if (row?.page_id) pageIds.add(row.page_id);
      } else if (entity === 'cards') {
        const { data: row } = await supabase.from('cms_cards').select('section_id').eq('id', id).single();
        if (row?.section_id) {
          const { data: section } = await supabase.from('cms_sections').select('page_id').eq('id', row.section_id).single();
          if (section?.page_id) pageIds.add(section.page_id);
        }
      } else if (entity === 'links') {
        const { data: row } = await supabase.from('cms_links').select('page_id, section_id, card_id').eq('id', id).single();
        if (row?.page_id) pageIds.add(row.page_id);
        if (row?.section_id) {
          const { data: section } = await supabase.from('cms_sections').select('page_id').eq('id', row.section_id).single();
          if (section?.page_id) pageIds.add(section.page_id);
        }
        if (row?.card_id) {
          const { data: card } = await supabase.from('cms_cards').select('section_id').eq('id', row.card_id).single();
          if (card?.section_id) {
            const { data: section } = await supabase.from('cms_sections').select('page_id').eq('id', card.section_id).single();
            if (section?.page_id) pageIds.add(section.page_id);
          }
        }
      }
    }

    for (const pageId of pageIds) {
      const nextRevision = await createRevision(pageId, actorId, `${entity} reordered`);
      await logCmsEvent(pageId, actorId, 'save', { entity: `${entity}_reorder` }, nextRevision - 1, nextRevision);
      const { data: page } = await supabase.from('cms_pages').select('route_path').eq('id', pageId).single();
      invalidatePageCache(page?.route_path);
    }

    return sendSuccess(res, { entity, count: items.length }, 'Order updated');
  } catch (error) {
    logger.error('cms:adminReorder failed', { message: error.message });
    return sendError(res, 'Failed to reorder content', 500);
  }
};

exports.adminRollbackPage = async (req, res) => {
  try {
    const actorId = req.user?.id || null;
    const pageId = String(req.params?.id || '');
    const revision = Number(req.body?.revision_number || 0);
    if (!pageId || !revision) return sendError(res, 'page id and revision_number are required', 400);

    const { data: target, error } = await supabase
      .from('cms_revisions')
      .select('*')
      .eq('page_id', pageId)
      .eq('revision_number', revision)
      .single();
    if (error || !target) return sendError(res, 'Revision not found', 404);

    const snapshot = target.snapshot || {};
    const snapshotSections = Array.isArray(snapshot.sections) ? snapshot.sections : [];
    const pageRoute = snapshot.route_path;

    await supabase.from('cms_sections').delete().eq('page_id', pageId);
    await supabase.from('cms_links').delete().eq('page_id', pageId);

    for (const section of snapshotSections) {
      const { data: insertedSection } = await supabase
        .from('cms_sections')
        .insert({
          page_id: pageId,
          section_key: section.section_key,
          section_type: section.section_type || 'generic',
          title: section.title || null,
          subtitle: section.subtitle || null,
          body: section.body || null,
          order_index: Number(section.order_index || 0),
          is_visible: section.is_visible !== false,
          style_token: section.style_token || null,
          metadata: section.metadata || {},
        })
        .select('*')
        .single();

      for (const card of section.cards || []) {
        const { data: insertedCard } = await supabase
          .from('cms_cards')
          .insert({
            section_id: insertedSection.id,
            card_key: card.card_key,
            card_type: card.card_type || 'generic',
            title: card.title || null,
            body: card.body || null,
            image_url: card.image_url || null,
            icon_name: card.icon_name || null,
            badge_label: card.badge_label || null,
            order_index: Number(card.order_index || 0),
            is_visible: card.is_visible !== false,
            metadata: card.metadata || {},
          })
          .select('*')
          .single();

        for (const link of card.links || []) {
          await supabase.from('cms_links').insert({
            card_id: insertedCard.id,
            link_key: link.link_key,
            label: link.label,
            href: link.href,
            target: link.target === '_blank' ? '_blank' : '_self',
            rel: link.rel || null,
            order_index: Number(link.order_index || 0),
            is_visible: link.is_visible !== false,
            metadata: link.metadata || {},
          });
        }
      }

      for (const link of section.links || []) {
        await supabase.from('cms_links').insert({
          section_id: insertedSection.id,
          link_key: link.link_key,
          label: link.label,
          href: link.href,
          target: link.target === '_blank' ? '_blank' : '_self',
          rel: link.rel || null,
          order_index: Number(link.order_index || 0),
          is_visible: link.is_visible !== false,
          metadata: link.metadata || {},
        });
      }
    }

    for (const link of snapshot.links || []) {
      await supabase.from('cms_links').insert({
        page_id: pageId,
        link_key: link.link_key,
        label: link.label,
        href: link.href,
        target: link.target === '_blank' ? '_blank' : '_self',
        rel: link.rel || null,
        order_index: Number(link.order_index || 0),
        is_visible: link.is_visible !== false,
        metadata: link.metadata || {},
      });
    }

    await createRevision(pageId, actorId, `Rolled back to revision ${revision}`);
    const { data: updated } = await supabase
      .from('cms_pages')
      .update({
        is_published: true,
        published_by: actorId,
        published_at: new Date().toISOString(),
        updated_by: actorId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', pageId)
      .select('*')
      .single();

    await logCmsEvent(
      pageId,
      actorId,
      'rollback',
      { rollback_target_revision: revision },
      Number(updated.current_revision || 1),
      revision,
    );

    invalidatePageCache(pageRoute || updated.route_path);
    return sendSuccess(res, updated, 'Page rolled back');
  } catch (error) {
    logger.error('cms:adminRollbackPage failed', { message: error.message });
    return sendError(res, 'Failed to rollback page', 500);
  }
};
