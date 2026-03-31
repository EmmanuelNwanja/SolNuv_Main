const axios = require('axios');

const TERMII_BASE = process.env.TERMII_BASE_URL || 'https://api.ng.termii.com/api';
const TERMII_API_KEY = process.env.TERMII_API_KEY;
const TERMII_SENDER_ID = process.env.TERMII_SENDER_ID || 'SolNuv';

function normalizePhone(phone) {
  const raw = String(phone || '').trim();
  if (!raw) return '';
  if (raw.startsWith('+')) return raw;
  if (raw.startsWith('0')) return `+234${raw.slice(1)}`;
  if (raw.startsWith('234')) return `+${raw}`;
  return raw;
}

async function sendSms({ to, message, channel = 'generic' }) {
  if (!TERMII_API_KEY) {
    return { success: false, reason: 'TERMII_API_KEY is not configured' };
  }

  const destination = normalizePhone(to);
  if (!destination) {
    return { success: false, reason: 'Recipient phone is required' };
  }

  try {
    const response = await axios.post(`${TERMII_BASE}/sms/send`, {
      api_key: TERMII_API_KEY,
      to: destination,
      from: TERMII_SENDER_ID,
      sms: message,
      type: 'plain',
      channel,
    });

    return { success: true, data: response.data };
  } catch (error) {
    return {
      success: false,
      reason: error.response?.data?.message || error.message,
    };
  }
}

module.exports = {
  sendSms,
  normalizePhone,
};
