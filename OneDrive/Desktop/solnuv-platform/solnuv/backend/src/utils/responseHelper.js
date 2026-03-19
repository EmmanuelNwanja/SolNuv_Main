/**
 * SolNuv Response Helper
 * Standardized API response format
 */

function sendSuccess(res, data, message = 'Success', statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    timestamp: new Date().toISOString(),
  });
}

function sendError(res, message = 'An error occurred', statusCode = 500, extra = {}) {
  return res.status(statusCode).json({
    success: false,
    message,
    ...extra,
    timestamp: new Date().toISOString(),
  });
}

function sendPaginated(res, data, total, page, limit, message = 'Success') {
  return res.status(200).json({
    success: true,
    message,
    data,
    pagination: {
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total / limit),
      has_next: page * limit < total,
      has_prev: page > 1,
    },
    timestamp: new Date().toISOString(),
  });
}

module.exports = { sendSuccess, sendError, sendPaginated };
