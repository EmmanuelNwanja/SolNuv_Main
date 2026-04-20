const supabase = require('../config/database');
const { sendSuccess, sendError } = require('../utils/responseHelper');
const logger = require('../utils/logger');

function sanitizeSlug(input) {
  const value = String(input || 'pitch').trim().toLowerCase();
  return value.replace(/[^a-z0-9-_]/g, '') || 'pitch';
}

async function loadDeckTree(deckId) {
  const { data: deck, error: deckError } = await supabase
    .from('pitch_decks')
    .select('*')
    .eq('id', deckId)
    .single();
  if (deckError) throw deckError;

  const { data: slides, error: slidesError } = await supabase
    .from('pitch_slides')
    .select('*')
    .eq('deck_id', deckId)
    .order('order_index', { ascending: true });
  if (slidesError) throw slidesError;

  const slideIds = (slides || []).map((s) => s.id);
  let cards = [];
  if (slideIds.length) {
    const cardsRes = await supabase
      .from('pitch_slide_cards')
      .select('*')
      .in('slide_id', slideIds)
      .order('order_index', { ascending: true });
    if (cardsRes.error) throw cardsRes.error;
    cards = cardsRes.data || [];
  }

  const { data: metrics, error: metricsError } = await supabase
    .from('pitch_metric_bindings')
    .select('*')
    .eq('deck_id', deckId)
    .order('metric_key', { ascending: true });
  if (metricsError) throw metricsError;

  const cardsBySlide = {};
  for (const card of cards) {
    if (!cardsBySlide[card.slide_id]) cardsBySlide[card.slide_id] = [];
    cardsBySlide[card.slide_id].push(card);
  }

  return {
    ...deck,
    slides: (slides || []).map((slide) => ({
      ...slide,
      cards: cardsBySlide[slide.id] || [],
    })),
    metrics: metrics || [],
  };
}

async function resolveLiveMetric(metricKey) {
  const key = String(metricKey || '').toLowerCase();
  if (key === 'github_stars') {
    try {
      const response = await fetch('https://api.github.com/repos/EmmanuelNwanja/pitchdeck');
      const payload = await response.json() as Record<string, unknown>;
      return Number(payload?.stargazers_count || 0);
    } catch {
      return 0;
    }
  }

  if (key === 'private_beta_users' || key === 'transactions') {
    try {
      const { data } = await supabase
        .from('users')
        .select('id', { count: 'exact', head: true });
      if (key === 'private_beta_users') return Number(data?.length || 0);
    } catch {
      // ignore and fallback below
    }
  }

  if (key === 'transactions') {
    try {
      const { count } = await supabase
        .from('simulation_runs')
        .select('id', { count: 'exact', head: true });
      return Number(count || 0);
    } catch {
      return 0;
    }
  }

  return 0;
}

async function resolveMetrics(deckId) {
  const { data: metrics, error } = await supabase
    .from('pitch_metric_bindings')
    .select('*')
    .eq('deck_id', deckId);
  if (error) throw error;

  const resolved = [];
  for (const metric of metrics || []) {
    let value = null;
    let liveFetched = false;
    const mode = String(metric.source_mode || 'live');
    if (mode === 'manual') {
      value = metric.manual_value;
    } else if (mode === 'empty_fallback_live' && metric.manual_value !== null && metric.manual_value !== undefined) {
      value = metric.manual_value;
    } else {
      value = await resolveLiveMetric(metric.metric_key);
      liveFetched = true;
    }
    resolved.push({
      ...metric,
      value,
      liveFetched,
      resolvedAt: new Date().toISOString(),
    });
  }

  return resolved;
}

exports.getPublicDeck = async (req, res) => {
  try {
    const slug = sanitizeSlug(req.params?.slug || req.query?.slug || 'pitch');
    const { data: deck, error } = await supabase
      .from('pitch_decks')
      .select('*')
      .eq('slug', slug)
      .eq('is_published', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!deck) {
      return sendSuccess(res, {
        slug,
        deck: null,
        slides: [],
        metrics: [],
      });
    }

    const tree = await loadDeckTree(deck.id);
    const metrics = await resolveMetrics(deck.id);
    return sendSuccess(res, {
      slug,
      deck: tree,
      slides: tree.slides || [],
      metrics,
    });
  } catch (error) {
    logger.error('pitchDeck:getPublicDeck failed', { message: error.message });
    return sendError(res, 'Failed to load public pitch deck', 500);
  }
};

exports.adminListDecks = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('pitch_decks')
      .select('*')
      .order('updated_at', { ascending: false });
    if (error) throw error;
    return sendSuccess(res, { decks: data || [] });
  } catch (error) {
    logger.error('pitchDeck:adminListDecks failed', { message: error.message });
    return sendError(res, 'Failed to load pitch decks', 500);
  }
};

exports.adminGetDeck = async (req, res) => {
  try {
    const id = String(req.params?.id || '');
    if (!id) return sendError(res, 'Deck id required', 400);
    const tree = await loadDeckTree(id);
    return sendSuccess(res, tree);
  } catch (error) {
    logger.error('pitchDeck:adminGetDeck failed', { message: error.message });
    return sendError(res, 'Failed to load deck', 500);
  }
};

exports.adminUpsertDeck = async (req, res) => {
  try {
    const userId = req.user?.id || null;
    const payload = req.body || {};
    const id = String(payload.id || '').trim();
    const deckPatch = {
      slug: sanitizeSlug(payload.slug || 'pitch'),
      title: String(payload.title || 'SolNuv Pitch Deck'),
      description: payload.description || null,
      is_active: Boolean(payload.is_active),
      is_published: Boolean(payload.is_published),
      version: Number(payload.version || 1),
      updated_by: userId,
      updated_at: new Date().toISOString(),
    };

    let query = supabase.from('pitch_decks');
    let result;
    if (id) {
      result = await query.update(deckPatch).eq('id', id).select('*').single();
    } else {
      result = await query
        .insert({
          ...deckPatch,
          created_by: userId,
        })
        .select('*')
        .single();
    }
    if (result.error) throw result.error;
    return sendSuccess(res, result.data, 'Deck saved');
  } catch (error) {
    logger.error('pitchDeck:adminUpsertDeck failed', { message: error.message });
    return sendError(res, 'Failed to save deck', 500);
  }
};

exports.adminUpsertSlide = async (req, res) => {
  try {
    const payload = req.body || {};
    const id = String(payload.id || '').trim();
    const patch = {
      deck_id: payload.deck_id,
      slide_key: String(payload.slide_key || ''),
      title: payload.title || null,
      subtitle: payload.subtitle || null,
      order_index: Number(payload.order_index || 0),
      is_visible: payload.is_visible !== false,
      metadata: payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : {},
      updated_at: new Date().toISOString(),
    };
    if (!patch.deck_id || !patch.slide_key) return sendError(res, 'deck_id and slide_key are required', 400);

    let result;
    if (id) {
      result = await supabase.from('pitch_slides').update(patch).eq('id', id).select('*').single();
    } else {
      result = await supabase.from('pitch_slides').insert(patch).select('*').single();
    }
    if (result.error) throw result.error;
    return sendSuccess(res, result.data, 'Slide saved');
  } catch (error) {
    logger.error('pitchDeck:adminUpsertSlide failed', { message: error.message });
    return sendError(res, 'Failed to save slide', 500);
  }
};

exports.adminDeleteSlide = async (req, res) => {
  try {
    const id = String(req.params?.id || '');
    if (!id) return sendError(res, 'Slide id required', 400);
    const { error } = await supabase.from('pitch_slides').delete().eq('id', id);
    if (error) throw error;
    return sendSuccess(res, { id }, 'Slide deleted');
  } catch (error) {
    logger.error('pitchDeck:adminDeleteSlide failed', { message: error.message });
    return sendError(res, 'Failed to delete slide', 500);
  }
};

exports.adminUpsertCard = async (req, res) => {
  try {
    const payload = req.body || {};
    const id = String(payload.id || '').trim();
    const patch = {
      slide_id: payload.slide_id,
      card_key: String(payload.card_key || ''),
      order_index: Number(payload.order_index || 0),
      card_type: String(payload.card_type || 'generic'),
      title: payload.title || null,
      body: payload.body || null,
      image_url: payload.image_url || null,
      cta_label: payload.cta_label || null,
      cta_url: payload.cta_url || null,
      metadata: payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : {},
      updated_at: new Date().toISOString(),
    };
    if (!patch.slide_id || !patch.card_key) return sendError(res, 'slide_id and card_key are required', 400);

    let result;
    if (id) {
      result = await supabase.from('pitch_slide_cards').update(patch).eq('id', id).select('*').single();
    } else {
      result = await supabase.from('pitch_slide_cards').insert(patch).select('*').single();
    }
    if (result.error) throw result.error;
    return sendSuccess(res, result.data, 'Card saved');
  } catch (error) {
    logger.error('pitchDeck:adminUpsertCard failed', { message: error.message });
    return sendError(res, 'Failed to save card', 500);
  }
};

exports.adminDeleteCard = async (req, res) => {
  try {
    const id = String(req.params?.id || '');
    if (!id) return sendError(res, 'Card id required', 400);
    const { error } = await supabase.from('pitch_slide_cards').delete().eq('id', id);
    if (error) throw error;
    return sendSuccess(res, { id }, 'Card deleted');
  } catch (error) {
    logger.error('pitchDeck:adminDeleteCard failed', { message: error.message });
    return sendError(res, 'Failed to delete card', 500);
  }
};

exports.adminUpsertMetric = async (req, res) => {
  try {
    const payload = req.body || {};
    const id = String(payload.id || '').trim();
    const patch = {
      deck_id: payload.deck_id,
      metric_key: String(payload.metric_key || ''),
      label: payload.label || null,
      source_mode: payload.source_mode || 'live',
      manual_value: payload.manual_value === '' ? null : payload.manual_value,
      live_endpoint: payload.live_endpoint || null,
      updated_at: new Date().toISOString(),
    };
    if (!patch.deck_id || !patch.metric_key) return sendError(res, 'deck_id and metric_key are required', 400);

    let result;
    if (id) {
      result = await supabase.from('pitch_metric_bindings').update(patch).eq('id', id).select('*').single();
    } else {
      result = await supabase.from('pitch_metric_bindings').insert(patch).select('*').single();
    }
    if (result.error) throw result.error;
    return sendSuccess(res, result.data, 'Metric binding saved');
  } catch (error) {
    logger.error('pitchDeck:adminUpsertMetric failed', { message: error.message });
    return sendError(res, 'Failed to save metric binding', 500);
  }
};
