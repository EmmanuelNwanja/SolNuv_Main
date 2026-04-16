/**
 * SolNuv Geo Verification Service
 * Geolocation verification using Nominatim forward/reverse geocoding,
 * multi-zoom reverse lookups, token-based address corroboration, and distance scoring.
 */

/* global fetch */
const logger = require('../utils/logger');
const { extractNetworkErrorMeta } = require('../utils/httpClient');

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';
const USER_AGENT = 'SolNuv/1.0 (https://solnuv.com)';
const NOMINATIM_TIMEOUT_MS = 10_000;
const NOMINATIM_429_BACKOFF_MS = 2_200;
/** Street-first zoom down to city context — Nominatim returns richer fields at different scales */
const REVERSE_ZOOM_LEVELS = [18, 16, 14, 12, 10];
const AbortControllerRef = globalThis.AbortController;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url, options = {}, timeoutMs = NOMINATIM_TIMEOUT_MS) {
  if (!AbortControllerRef) {
    logger.warn('AbortController unavailable; using plain fetch for Nominatim');
    return fetch(url, options);
  }

  const controller = new AbortControllerRef();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } catch (err) {
    logger.warn('Nominatim fetch failed', {
      url,
      timeoutMs,
      message: err.message,
      ...extractNetworkErrorMeta(err),
    });
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

/** Single request with 429 backoff (Nominatim usage policy). */
async function nominatimRequest(url, timeoutMs = NOMINATIM_TIMEOUT_MS) {
  const headers = {
    'User-Agent': USER_AGENT,
    'Accept-Language': 'en',
  };
  let res = await fetchWithTimeout(url, { headers }, timeoutMs);
  if (res?.status === 429) {
    logger.warn('Nominatim rate limited; retrying after backoff', { path: url.split('?')[0] });
    await sleep(NOMINATIM_429_BACKOFF_MS);
    res = await fetchWithTimeout(url, { headers }, timeoutMs + 3000);
  }
  return res;
}

function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6_371_000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function distanceToConfidence(distanceM) {
  if (distanceM < 100) return 100;
  if (distanceM < 500) return 95;
  if (distanceM < 1000) return 85;
  if (distanceM < 2000) return 70;
  if (distanceM < 5000) return 50;
  if (distanceM < 10000) return 30;
  return 10;
}

function buildNominatimSearchUrl(params) {
  const query = Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
  return `${NOMINATIM_BASE}/search?${query}`;
}

function buildNominatimReverseUrl(params) {
  const query = Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
  return `${NOMINATIM_BASE}/reverse?${query}`;
}

function normalizeLocationText(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/local\s+government\s+area|lga/g, '')
    .replace(/[#|'’.,]/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function locationNameMatches(projectValue, candidates = []) {
  const left = normalizeLocationText(projectValue);
  if (!left) return false;

  const leftTokens = new Set(left.split(' ').filter((t) => t.length > 2));
  for (const rawCandidate of candidates) {
    const right = normalizeLocationText(rawCandidate);
    if (!right) continue;

    if (left === right || left.includes(right) || right.includes(left)) return true;

    const rightTokens = new Set(right.split(' ').filter((t) => t.length > 2));
    if (!leftTokens.size || !rightTokens.size) continue;
    let overlap = 0;
    for (const token of leftTokens) {
      if (rightTokens.has(token)) overlap += 1;
    }
    const minSize = Math.min(leftTokens.size, rightTokens.size);
    if (minSize > 0 && overlap / minSize >= 0.6) return true;
  }

  return false;
}

function extractReverseAddressCandidates(address: Record<string, any> = {}) {
  return {
    states: [address.state, address.region, address.state_district].filter(Boolean),
    cities: [
      address.city,
      address.town,
      address.village,
      address.county,
      address.municipality,
      address.city_district,
      address.suburb,
      address.neighbourhood,
      address.hamlet,
    ].filter(Boolean),
    localHints: [
      address.house_number,
      address.house_name,
      address.road,
      address.pedestrian,
      address.path,
      address.neighbourhood,
      address.suburb,
      address.city_district,
      address.quarter,
      address.residential,
      address.hamlet,
      address.amenity,
      address.building,
      address.shop,
      address.retail,
    ].filter(Boolean),
  };
}

function scoreAddressRichness(addr) {
  if (!addr || typeof addr !== 'object') return 0;
  return Object.values(addr).filter((v) => v != null && String(v).trim() !== '').length;
}

function collectReverseSearchHaystacks(reversed) {
  const hay = [];
  if (!reversed) return hay;
  if (reversed.displayName) {
    hay.push(normalizeLocationText(reversed.displayName));
    for (const part of reversed.displayName.split(',')) {
      const n = normalizeLocationText(part);
      if (n.length > 2) hay.push(n);
    }
  }
  if (reversed.address && typeof reversed.address === 'object') {
    for (const v of Object.values(reversed.address)) {
      if (v == null) continue;
      const s = normalizeLocationText(String(v));
      if (s.length > 2) hay.push(s);
    }
  }
  return hay;
}

/**
 * 0–1 score: how many normalized project tokens appear in reverse-geocode text fields.
 */
function addressCorroborationScore(projectAddress, reversed) {
  const { state, city, address } = projectAddress;
  const projectFull = normalizeLocationText([address, city, state].filter(Boolean).join(' '));
  if (!projectFull || projectFull.length < 2) return 0;

  const tokens = [...new Set(projectFull.split(' ').filter((t) => t.length >= 2))];
  if (!tokens.length) return 0;

  const haystacks = collectReverseSearchHaystacks(reversed);
  if (!haystacks.length) return 0;

  let hits = 0;
  for (const tok of tokens) {
    if (tok.length === 2 && !/[a-z]/.test(tok)) continue;

    const matched = haystacks.some((h) => {
      if (tok.length >= 4) return h.includes(tok);
      if (tok.length === 3) {
        return (
          h === tok ||
          h.startsWith(`${tok} `) ||
          h.endsWith(` ${tok}`) ||
          h.includes(` ${tok} `)
        );
      }
      return h.includes(tok);
    });
    if (matched) hits += 1;
  }

  return Math.min(1, hits / Math.max(tokens.length, 1));
}

/** Bidirectional match: estate / road / block tokens vs OSM hints */
function projectMatchesLocalHints(projectNorm, hints) {
  if (!projectNorm || !hints?.length) return false;
  return hints.some((raw) => {
    const h = normalizeLocationText(String(raw));
    if (h.length < 3) return false;
    if (h.length >= 4 && (projectNorm.includes(h) || (projectNorm.length >= 6 && h.includes(projectNorm)))) {
      return true;
    }
    const hTokens = h.split(' ').filter((t) => t.length > 3);
    const pTokens = projectNorm.split(' ').filter((t) => t.length > 3);
    if (!pTokens.length) return false;
    let overlap = 0;
    for (const t of pTokens) {
      if (hTokens.includes(t)) overlap += 1;
    }
    if (overlap > 0 && overlap / pTokens.length >= 0.34) return true;
    for (const t of pTokens) {
      if (t.length >= 4 && h.includes(t)) return true;
    }
    return false;
  });
}

function applyManualCorroborationBoost(confidence, distM, stateMatch, cityMatch, tokenScore) {
  let c = confidence;
  if (tokenScore >= 0.38 && stateMatch && cityMatch) {
    c = Math.max(c, Math.round(68 + tokenScore * 22));
  }
  if (tokenScore >= 0.5 && distM < 8_000) {
    c = Math.max(c, 80);
  }
  if (tokenScore >= 0.55 && stateMatch && cityMatch && distM < 12_000) {
    c = Math.max(c, 85);
  }
  if (tokenScore >= 0.22 && !cityMatch && stateMatch && distM < 1_500) {
    c = Math.max(c, Math.min(74, c + 14));
  }
  return Math.min(95, c);
}

async function forwardGeocode(address) {
  const url = buildNominatimSearchUrl({
    q: address,
    format: 'json',
    limit: '1',
    addressdetails: '1',
  });
  const res = await nominatimRequest(url);
  if (!res) return null;
  if (!res.ok) {
    logger.warn('Nominatim forward geocode failed', { status: res.status });
    return null;
  }
  const results = (await res.json()) as any[];
  if (!results.length) return null;
  const r = results[0];
  return {
    lat: parseFloat(r.lat),
    lon: parseFloat(r.lon),
    displayName: r.display_name,
    address: r.address,
  };
}

async function forwardGeocodeBestEffort(projectAddress) {
  const { state, city, address } = projectAddress;
  const queries = [
    [address, city, state].filter(Boolean).join(', '),
    [address, city, state, 'Nigeria'].filter(Boolean).join(', '),
    [address, city, 'Nigeria'].filter(Boolean).join(', '),
    [city, state, 'Nigeria'].filter(Boolean).join(', '),
    [city, state].filter(Boolean).join(', '),
    [state, 'Nigeria'].filter(Boolean).join(', '),
  ].filter((q, i, a) => q && a.indexOf(q) === i);

  for (let i = 0; i < queries.length; i++) {
    const q = queries[i];
    const g = await forwardGeocode(q);
    if (g && Number.isFinite(g.lat) && Number.isFinite(g.lon)) {
      return { ...g, queryUsed: q, used_fallback_geocode: i > 0 };
    }
  }
  return null;
}

async function reverseGeocodeAtZoom(lat, lon, zoom) {
  const url = buildNominatimReverseUrl({
    lat: String(lat),
    lon: String(lon),
    format: 'json',
    addressdetails: '1',
    zoom: String(zoom),
  });
  const res = await nominatimRequest(url);
  if (!res) return null;
  if (!res.ok) {
    logger.warn('Nominatim reverse geocode failed', { status: res.status, zoom });
    return null;
  }
  const data = (await res.json()) as { error?: string; display_name?: string; address?: Record<string, any> };
  if (data.error) {
    logger.warn('Nominatim reverse returned error', { zoom, error: data.error });
    return null;
  }
  return {
    displayName: data.display_name,
    address: data.address || {},
    zoom,
  };
}

/** Try several zoom levels; keep the richest address payload for matching. */
async function reverseGeocodeBestEffort(lat, lon) {
  let best = null;
  let bestRich = -1;
  let bestZoom = null;

  for (const zoom of REVERSE_ZOOM_LEVELS) {
    const one = await reverseGeocodeAtZoom(lat, lon, zoom);
    if (!one) continue;
    const rich = scoreAddressRichness(one.address) + (one.displayName ? 2 : 0);
    if (rich > bestRich) {
      bestRich = rich;
      best = one;
      bestZoom = zoom;
    }
  }

  if (!best) return null;
  return {
    displayName: best.displayName,
    address: best.address,
    reverse_zoom: bestZoom,
  };
}

async function verifyCoordinatesAgainstAddress(actualLat, actualLon, projectAddress) {
  const { state, city, address } = projectAddress;

  const parts = [address, city, state].filter(Boolean);
  if (!parts.length) {
    return {
      confidence_pct: 0,
      distance_m: null,
      method: 'address_match',
      verified: false,
      details: { error: 'No address provided for verification' },
    };
  }

  const geocoded = await forwardGeocodeBestEffort(projectAddress);
  const addressQuery = geocoded?.queryUsed || parts.join(', ');

  if (!geocoded) {
    const reversed = await reverseGeocodeBestEffort(actualLat, actualLon);
    let conf = 15;
    let stateMatch = false;
    let cityMatch = false;
    let tokenScore = 0;
    if (reversed?.address) {
      const reverseCandidates = extractReverseAddressCandidates(reversed.address);
      stateMatch = locationNameMatches(state, reverseCandidates.states);
      cityMatch = locationNameMatches(city, reverseCandidates.cities);
      tokenScore = addressCorroborationScore(projectAddress, reversed);
      if (stateMatch && cityMatch) conf = Math.max(conf, 55 + Math.round(tokenScore * 25));
      else if (stateMatch) conf = Math.max(conf, 40 + Math.round(tokenScore * 20));
      if (tokenScore >= 0.45) conf = Math.max(conf, 62);
    }
    return {
      confidence_pct: Math.min(95, conf),
      distance_m: null,
      method: 'address_match',
      verified: conf >= 85,
      details: {
        error: 'Could not geocode project address',
        address_query: addressQuery,
        reverse_display: reversed?.displayName || null,
        reverse_zoom: reversed?.reverse_zoom ?? null,
        state_match: stateMatch,
        city_match: cityMatch,
        address_token_score: tokenScore,
        note: 'Forward geocode failed — used reverse + token corroboration only',
      },
    };
  }

  const distM = haversineMeters(actualLat, actualLon, geocoded.lat, geocoded.lon);
  let confidence = distanceToConfidence(distM);

  const reversed = await reverseGeocodeBestEffort(actualLat, actualLon);
  let stateMatch = false;
  let cityMatch = false;
  let tokenScore = 0;

  if (reversed?.address) {
    const reverseCandidates = extractReverseAddressCandidates(reversed.address);
    stateMatch = locationNameMatches(state, reverseCandidates.states);
    cityMatch = locationNameMatches(city, reverseCandidates.cities);
    tokenScore = addressCorroborationScore(projectAddress, reversed);
    if (stateMatch && cityMatch && confidence < 70) confidence = 70;
    if (stateMatch && !cityMatch && confidence < 50) confidence = 50;
    confidence = applyManualCorroborationBoost(
      confidence,
      distM,
      stateMatch,
      cityMatch,
      tokenScore,
    );
  }

  return {
    confidence_pct: confidence,
    distance_m: Math.round(distM),
    method: 'address_match',
    verified: confidence >= 85,
    details: {
      geocoded_address: addressQuery,
      geocoded_coords: { lat: geocoded.lat, lon: geocoded.lon },
      geocoded_display: geocoded.displayName,
      used_fallback_geocode: Boolean(geocoded.used_fallback_geocode),
      actual_coords: { lat: actualLat, lon: actualLon },
      reverse_display: reversed?.displayName || null,
      reverse_zoom: reversed?.reverse_zoom ?? null,
      state_match: stateMatch,
      city_match: cityMatch,
      address_token_score: tokenScore,
    },
  };
}

async function verifyDeviceGPS(deviceLat, deviceLon, projectAddress, accuracyM) {
  const { state, city, address } = projectAddress;

  const reversed = await reverseGeocodeBestEffort(deviceLat, deviceLon);
  let stateMatch = false;
  let cityMatch = false;
  let addressHintMatch = false;
  let tokenScore = 0;

  if (reversed?.address) {
    const reverseCandidates = extractReverseAddressCandidates(reversed.address);
    stateMatch = locationNameMatches(state, reverseCandidates.states);
    cityMatch = locationNameMatches(city, reverseCandidates.cities);
    const projectAddressText = normalizeLocationText(address);
    addressHintMatch = projectMatchesLocalHints(projectAddressText, reverseCandidates.localHints);
    tokenScore = addressCorroborationScore(projectAddress, reversed);
    if (!addressHintMatch && tokenScore >= 0.35) {
      addressHintMatch = true;
    }
  }

  const addressQuery = [address, city, state].filter(Boolean).join(', ');
  let geocoded = await forwardGeocodeBestEffort(projectAddress);
  let usedFb = geocoded?.used_fallback_geocode || false;

  if (!geocoded && (city || state)) {
    const g2 = await forwardGeocode([city, state].filter(Boolean).join(', '));
    if (g2) {
      geocoded = { ...g2, queryUsed: [city, state].filter(Boolean).join(', '), used_fallback_geocode: true };
      usedFb = true;
    }
  }

  let distM = null;
  let effectiveDistM = null;
  if (geocoded) {
    distM = Math.round(haversineMeters(deviceLat, deviceLon, geocoded.lat, geocoded.lon));
    const gpsRadius = accuracyM && accuracyM > 0 ? Math.min(accuracyM, 500) : 0;
    effectiveDistM = Math.max(0, distM - gpsRadius);
  }

  let confidence = 0;
  let verified = false;

  if (stateMatch && cityMatch) {
    if (effectiveDistM !== null && effectiveDistM < 2_000) confidence = 95;
    else if (effectiveDistM !== null && effectiveDistM < 10_000) confidence = 90;
    else confidence = 88;
    if (tokenScore >= 0.45 || addressHintMatch) confidence = Math.min(97, confidence + 2);
    verified = true;
  } else if (stateMatch && !cityMatch) {
    if (addressHintMatch || tokenScore >= 0.4) {
      confidence = Math.max(86, 84 + Math.round(tokenScore * 8));
      verified = true;
    } else if (effectiveDistM !== null && effectiveDistM < 3_000) {
      confidence = 86;
      verified = true;
    } else if (effectiveDistM !== null && effectiveDistM < 10_000) {
      confidence = tokenScore >= 0.28 ? 76 : 72;
      verified = false;
    } else {
      confidence = tokenScore >= 0.32 ? 62 : 55;
      verified = false;
    }
  } else {
    if (effectiveDistM !== null) {
      confidence = distanceToConfidence(effectiveDistM);
      if (tokenScore >= 0.45 && effectiveDistM < 6_000) {
        confidence = Math.max(confidence, 83);
      }
      if (tokenScore >= 0.55 && effectiveDistM < 12_000) {
        confidence = Math.max(confidence, 85);
      }
      if (addressHintMatch && effectiveDistM < 15_000) {
        confidence = Math.max(confidence, 80);
      }
      verified = confidence >= 85;
    } else if (tokenScore >= 0.48 && reversed?.displayName) {
      confidence = 78;
      verified = false;
    } else {
      confidence = 10;
      verified = false;
    }
  }

  return {
    confidence_pct: confidence,
    distance_m: distM,
    method: 'device_proximity',
    verified,
    details: {
      geocoded_address: geocoded?.queryUsed || addressQuery,
      geocoded_coords: geocoded ? { lat: geocoded.lat, lon: geocoded.lon } : null,
      geocoded_display: geocoded?.displayName || null,
      actual_coords: { lat: deviceLat, lon: deviceLon },
      reverse_display: reversed?.displayName || null,
      reverse_zoom: reversed?.reverse_zoom ?? null,
      state_match: stateMatch,
      city_match: cityMatch,
      address_hint_match: addressHintMatch,
      address_token_score: tokenScore,
      gps_accuracy_m: accuracyM || null,
      used_fallback_geocode: usedFb,
    },
  };
}

async function reverseGeocode(lat, lon) {
  return reverseGeocodeBestEffort(lat, lon);
}

module.exports = {
  haversineMeters,
  distanceToConfidence,
  forwardGeocode,
  reverseGeocode,
  verifyCoordinatesAgainstAddress,
  verifyDeviceGPS,
};
