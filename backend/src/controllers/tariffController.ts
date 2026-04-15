/**
 * SolNuv Tariff Controller
 * CRUD operations for multi-country tariff structures.
 */

const supabase = require('../config/database');
const { sendSuccess, sendError } = require('../utils/responseHelper');
const { getTOUScheduleForDisplay, calculateAnnualBill } = require('../services/tariffService');
const logger = require('../utils/logger');

/**
 * GET /api/tariffs/templates
 * List system-seeded tariff templates.
 */
exports.listTemplates = async (req, res) => {
  try {
    const { country } = req.query;
    let query = supabase
      .from('tariff_structures')
      .select('id, country, utility_name, tariff_name, tariff_type, currency, seasons, created_at')
      .eq('is_template', true)
      .order('country')
      .order('tariff_name');

    if (country) query = query.eq('country', country.toUpperCase());

    const { data, error } = await query;
    if (error) throw error;

    return sendSuccess(res, data, 'Tariff templates retrieved');
  } catch (err) {
    logger.error('listTemplates error', { message: err.message });
    return sendError(res, 'Failed to retrieve tariff templates');
  }
};

/**
 * GET /api/tariffs
 * List user's custom tariffs + system templates.
 */
exports.listTariffs = async (req, res) => {
  try {
    const companyId = req.user.company_id;
    const { data, error } = await supabase
      .from('tariff_structures')
      .select('id, country, utility_name, tariff_name, tariff_type, currency, seasons, is_template, created_at')
      .or(`is_template.eq.true,company_id.eq.${companyId}`)
      .order('is_template', { ascending: false })
      .order('tariff_name');

    if (error) throw error;
    return sendSuccess(res, data, 'Tariffs retrieved');
  } catch (err) {
    logger.error('listTariffs error', { message: err.message });
    return sendError(res, 'Failed to retrieve tariffs');
  }
};

/**
 * POST /api/tariffs
 * Create a custom tariff (optionally from a template).
 */
exports.createTariff = async (req, res) => {
  try {
    const {
      template_id, country, utility_name, tariff_name, tariff_type,
      currency, seasons, rates, ancillary_charges,
    } = req.body;

    if (!tariff_name) return sendError(res, 'Tariff name is required', 400);

    let structureData;

    // If cloning from template, fetch template and overlay user changes
    if (template_id) {
      const { data: tpl, error: tplErr } = await supabase
        .from('tariff_structures')
        .select('*')
        .eq('id', template_id)
        .single();

      if (tplErr || !tpl) return sendError(res, 'Template not found', 404);

      structureData = {
        user_id: req.user.id,
        company_id: req.user.company_id,
        country: country || tpl.country,
        utility_name: utility_name || tpl.utility_name,
        tariff_name,
        tariff_type: tariff_type || tpl.tariff_type,
        currency: currency || tpl.currency,
        seasons: seasons || tpl.seasons,
        is_template: false,
      };
    } else {
      structureData = {
        user_id: req.user.id,
        company_id: req.user.company_id,
        country: country || 'NG',
        utility_name,
        tariff_name,
        tariff_type: tariff_type || 'tou',
        currency: currency || 'NGN',
        seasons: seasons || [],
        is_template: false,
      };
    }

    // Insert structure
    const { data: newStructure, error: structErr } = await supabase
      .from('tariff_structures')
      .insert(structureData)
      .select()
      .single();

    if (structErr) throw structErr;

    // Insert rates
    if (rates && rates.length > 0) {
      const rateRows = rates.map(r => ({
        tariff_structure_id: newStructure.id,
        season_key: r.season_key,
        period_name: r.period_name,
        weekday_hours: r.weekday_hours || [],
        saturday_hours: r.saturday_hours || [],
        sunday_hours: r.sunday_hours || [],
        rate_per_kwh: r.rate_per_kwh,
      }));
      const { error: rErr } = await supabase.from('tariff_rates').insert(rateRows);
      if (rErr) throw rErr;
    } else if (template_id) {
      // Clone rates from template
      const { data: tplRates } = await supabase
        .from('tariff_rates')
        .select('season_key, period_name, weekday_hours, saturday_hours, sunday_hours, rate_per_kwh')
        .eq('tariff_structure_id', template_id);

      if (tplRates && tplRates.length > 0) {
        const clonedRates = tplRates.map(r => ({ ...r, tariff_structure_id: newStructure.id }));
        await supabase.from('tariff_rates').insert(clonedRates);
      }
    }

    // Insert ancillary charges
    if (ancillary_charges && ancillary_charges.length > 0) {
      const chargeRows = ancillary_charges.map(c => ({
        tariff_structure_id: newStructure.id,
        charge_type: c.charge_type,
        charge_label: c.charge_label,
        rate: c.rate,
        unit: c.unit,
      }));
      const { error: cErr } = await supabase.from('tariff_ancillary_charges').insert(chargeRows);
      if (cErr) throw cErr;
    } else if (template_id) {
      // Clone ancillary from template
      const { data: tplCharges } = await supabase
        .from('tariff_ancillary_charges')
        .select('charge_type, charge_label, rate, unit')
        .eq('tariff_structure_id', template_id);

      if (tplCharges && tplCharges.length > 0) {
        const cloned = tplCharges.map(c => ({ ...c, tariff_structure_id: newStructure.id }));
        await supabase.from('tariff_ancillary_charges').insert(cloned);
      }
    }

    return sendSuccess(res, newStructure, 'Tariff created', 201);
  } catch (err) {
    logger.error('createTariff error', { message: err.message });
    return sendError(res, 'Failed to create tariff');
  }
};

/**
 * GET /api/tariffs/:id
 * Full tariff detail with rates and ancillary charges.
 */
exports.getTariff = async (req, res) => {
  try {
    const { id } = req.params;

    const [structRes, ratesRes, chargesRes] = await Promise.all([
      supabase.from('tariff_structures').select('*').eq('id', id).single(),
      supabase.from('tariff_rates').select('*').eq('tariff_structure_id', id).order('season_key').order('period_name'),
      supabase.from('tariff_ancillary_charges').select('*').eq('tariff_structure_id', id),
    ]);

    if (structRes.error || !structRes.data) return sendError(res, 'Tariff not found', 404);

    // Access check: must be template or owned by user's company
    const tariff = structRes.data;
    if (!tariff.is_template && tariff.company_id !== req.user.company_id) {
      return sendError(res, 'Access denied', 403);
    }

    const touSchedule = getTOUScheduleForDisplay(tariff, ratesRes.data || []);

    return sendSuccess(res, {
      ...tariff,
      rates: ratesRes.data || [],
      ancillary_charges: chargesRes.data || [],
      tou_schedule: touSchedule,
    }, 'Tariff details retrieved');
  } catch (err) {
    logger.error('getTariff error', { message: err.message });
    return sendError(res, 'Failed to retrieve tariff');
  }
};

/**
 * PUT /api/tariffs/:id
 * Update a custom tariff (owner only, not templates).
 */
exports.updateTariff = async (req, res) => {
  try {
    const { id } = req.params;

    // Verify ownership
    const { data: existing, error: fetchErr } = await supabase
      .from('tariff_structures')
      .select('id, user_id, company_id, is_template')
      .eq('id', id)
      .single();

    if (fetchErr || !existing) return sendError(res, 'Tariff not found', 404);
    if (existing.is_template) return sendError(res, 'Cannot edit system templates. Clone it first.', 403);
    if (existing.company_id !== req.user.company_id) return sendError(res, 'Access denied', 403);

    const {
      country, utility_name, tariff_name, tariff_type,
      currency, seasons, rates, ancillary_charges,
    } = req.body;

    // Update structure
    const updates: Record<string, any> = {};
    if (country !== undefined) updates.country = country;
    if (utility_name !== undefined) updates.utility_name = utility_name;
    if (tariff_name !== undefined) updates.tariff_name = tariff_name;
    if (tariff_type !== undefined) updates.tariff_type = tariff_type;
    if (currency !== undefined) updates.currency = currency;
    if (seasons !== undefined) updates.seasons = seasons;

    if (Object.keys(updates).length > 0) {
      const { error: upErr } = await supabase
        .from('tariff_structures')
        .update(updates)
        .eq('id', id);
      if (upErr) throw upErr;
    }

    // Replace rates if provided
    if (rates) {
      await supabase.from('tariff_rates').delete().eq('tariff_structure_id', id);
      if (rates.length > 0) {
        const rateRows = rates.map(r => ({
          tariff_structure_id: id,
          season_key: r.season_key,
          period_name: r.period_name,
          weekday_hours: r.weekday_hours || [],
          saturday_hours: r.saturday_hours || [],
          sunday_hours: r.sunday_hours || [],
          rate_per_kwh: r.rate_per_kwh,
        }));
        await supabase.from('tariff_rates').insert(rateRows);
      }
    }

    // Replace ancillary charges if provided
    if (ancillary_charges) {
      await supabase.from('tariff_ancillary_charges').delete().eq('tariff_structure_id', id);
      if (ancillary_charges.length > 0) {
        const chargeRows = ancillary_charges.map(c => ({
          tariff_structure_id: id,
          charge_type: c.charge_type,
          charge_label: c.charge_label,
          rate: c.rate,
          unit: c.unit,
        }));
        await supabase.from('tariff_ancillary_charges').insert(chargeRows);
      }
    }

    return sendSuccess(res, { id }, 'Tariff updated');
  } catch (err) {
    logger.error('updateTariff error', { message: err.message });
    return sendError(res, 'Failed to update tariff');
  }
};

/**
 * DELETE /api/tariffs/:id
 */
exports.deleteTariff = async (req, res) => {
  try {
    const { id } = req.params;

    const { data: existing } = await supabase
      .from('tariff_structures')
      .select('id, company_id, is_template')
      .eq('id', id)
      .single();

    if (!existing) return sendError(res, 'Tariff not found', 404);
    if (existing.is_template) return sendError(res, 'Cannot delete system templates', 403);
    if (existing.company_id !== req.user.company_id) return sendError(res, 'Access denied', 403);

    const { error } = await supabase.from('tariff_structures').delete().eq('id', id);
    if (error) throw error;

    return sendSuccess(res, null, 'Tariff deleted');
  } catch (err) {
    logger.error('deleteTariff error', { message: err.message });
    return sendError(res, 'Failed to delete tariff');
  }
};
