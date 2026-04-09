/**
 * Validation Utilities
 * Common validation functions for the SolNuv backend
 */

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Check if a string is a valid UUID
 * @param {string} str - String to validate
 * @returns {boolean}
 */
function isValidUUID(str) {
  return typeof str === 'string' && UUID_REGEX.test(str);
}

/**
 * Sanitize a string input
 * @param {string} str - String to sanitize
 * @param {number} maxLength - Maximum allowed length (default: 1000)
 * @returns {string}
 */
function sanitizeString(str, maxLength = 1000) {
  if (typeof str !== 'string') return str;
  return str.trim().slice(0, maxLength);
}

/**
 * Validate that a required field is present
 * @param {any} value - Value to check
 * @param {string} fieldName - Name of the field for error message
 * @throws {Error} If value is missing
 */
function validateRequired(value, fieldName) {
  if (value === undefined || value === null || value === '') {
    throw new Error(`${fieldName} is required`);
  }
}

/**
 * Validate UUID parameter and throw if invalid
 * @param {string} id - UUID to validate
 * @param {string} paramName - Parameter name for error message
 * @throws {Error} If UUID is invalid
 */
function validateUUIDParam(id, paramName) {
  if (!isValidUUID(id)) {
    const error = new Error(`Invalid ${paramName}`);
    error.status = 400;
    throw error;
  }
}

module.exports = {
  isValidUUID,
  sanitizeString,
  validateRequired,
  validateUUIDParam,
};
