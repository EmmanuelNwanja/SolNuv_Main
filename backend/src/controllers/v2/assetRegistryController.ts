const supabase = require('../../config/database');
const { sendError, sendSuccess } = require('../../utils/responseHelper');
const {
  normalizeSerials,
  detectDuplicateSerials,
  basicSerialChecks,
} = require('../../services/v2/serialValidationService');

exports.registerProjectSerials = async (req, res) => {
  try {
    const {
      organization_id,
      project_id,
      equipment_type,
      serial_numbers = [],
      financed = true,
      lot_reference = null,
      model = null,
      brand = null,
    } = req.body || {};

    if (!organization_id || !project_id || !equipment_type) {
      return sendError(res, 'organization_id, project_id, and equipment_type are required', 400);
    }

    const normalized = normalizeSerials(serial_numbers);
    if (financed && normalized.length === 0) {
      return sendError(res, 'Serial numbers are mandatory for financed registrations', 400);
    }

    const serialCheck = basicSerialChecks(normalized);
    if (!serialCheck.valid) {
      return sendError(res, 'One or more serial numbers failed validation', 400, {
        invalid_serials: serialCheck.invalid,
      });
    }

    const duplicateCheck = await detectDuplicateSerials(normalized);
    if (duplicateCheck.duplicates.length > 0) {
      return sendError(res, 'Duplicate serials already exist in registry', 409, {
        duplicates: duplicateCheck.duplicates,
      });
    }

    const rows = normalized.map((serial) => ({
      organization_id,
      project_id,
      equipment_type,
      serial_number: serial,
      lot_reference,
      model,
      brand,
      registration_source: 'manual',
      financed,
      registered_by: req.user.id,
    }));

    const { data, error } = await supabase
      .from('v2_asset_units')
      .insert(rows)
      .select('*');
    if (error) throw error;

    return sendSuccess(res, {
      registered_count: data?.length || 0,
      serials: data || [],
      registration_status: financed ? 'serial_validated' : 'registered',
    }, 'Project serials registered', 201);
  } catch (error) {
    return sendError(res, error.message || 'Failed to register serials', 500);
  }
};

