const supabase = require('../../config/database');

function normalizeSerials(rawSerials = []) {
  if (!Array.isArray(rawSerials)) return [];
  return [...new Set(
    rawSerials
      .map((s) => String(s || '').trim().toUpperCase())
      .filter(Boolean)
  )];
}

async function detectDuplicateSerials(serials = []) {
  if (!serials.length) return { duplicates: [] };
  const { data, error } = await supabase
    .from('v2_asset_units')
    .select('serial_number, id, project_id, organization_id')
    .in('serial_number', serials);

  if (error) throw error;
  return { duplicates: data || [] };
}

function basicSerialChecks(serials = []) {
  const invalid = serials.filter((s) => s.length < 6 || s.length > 128);
  return {
    valid: invalid.length === 0,
    invalid,
  };
}

module.exports = {
  normalizeSerials,
  detectDuplicateSerials,
  basicSerialChecks,
};

