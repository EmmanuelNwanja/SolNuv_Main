/**
 * SolNuv Geo Verification Service
 * AI-assisted geolocation verification using reverse/forward geocoding
 * and distance-based confidence scoring.
 */

/* global fetch */
const logger = require('../utils/logger');
const { extractNetworkErrorMeta } = require('../utils/httpClient');

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';
const USER_AGENT = 'SolNuv/1.0 (https://solnuv.com)';
const NOMINATIM_TIMEOUT_MS = 10_000;
const AbortControllerRef = globalThis.AbortController;

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

/**
 * Haversine distance between two {lat, lon} points in meters.
 */
function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6_371_000; // Earth radius in meters
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Distance-to-confidence mapping.
 * < 100m   → 100%
 * < 500m   →  95%
 * < 1km    →  85%
 * < 2km    →  70%
 * < 5km    →  50%
 * < 10km   →  30%
 * >= 10km  →  10%
 */
function distanceToConfidence(distanceM) {
  if (distanceM < 100) return 100;
  if (distanceM < 500) return 95;
  if (distanceM < 1000) return 85;
  if (distanceM < 2000) return 70;
  if (distanceM < 5000) return 50;
  if (distanceM < 10000) return 30;
  return 10;
}

/**
 * Build Nominatim query URL manually to avoid URLSearchParams browser API
 */
function buildNominatimSearchUrl(params) {
  const query = Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  return `${NOMINATIM_BASE}/search?${query}`;
}

function buildNominatimReverseUrl(params) {
  const query = Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  return `${NOMINATIM_BASE}/reverse?${query}`;
}

/**
 * Forward geocode an address string → { lat, lon, displayName }
 * Uses Nominatim (OpenStreetMap) — free, no API key.
 */
async function forwardGeocode(address) {
  const url = buildNominatimSearchUrl({
    q: address,
    format: 'json',
    limit: '1',
    addressdetails: '1',
  });
  const res = await fetchWithTimeout(url, {
    headers: { 'User-Agent': USER_AGENT },
  });
  if (!res) return null;
  if (!res.ok) {
    logger.warn('Nominatim forward geocode failed', { status: res.status });
    return null;
  }
  const results = await res.json();
  if (!results.length) return null;
  const r = results[0];
  return {
    lat: parseFloat(r.lat),
    lon: parseFloat(r.lon),
    displayName: r.display_name,
    address: r.address,
  };
}

/**
 * Reverse geocode coordinates → address details.
 */
async function reverseGeocode(lat, lon) {
  const url = buildNominatimReverseUrl({
    lat: String(lat),
    lon: String(lon),
    format: 'json',
    addressdetails: '1',
    zoom: '18',
  });
  const res = await fetchWithTimeout(url, {
    headers: { 'User-Agent': USER_AGENT },
  });
  if (!res) return null;
  if (!res.ok) {
    logger.warn('Nominatim reverse geocode failed', { status: res.status });
    return null;
  }
  const data = await res.json();
  return {
    displayName: data.display_name,
    address: data.address || {},
  };
}

/**
 * Verify coordinates against a project address (state, city, address).
 * Used for manual coordinate entry — distance from forward-geocoded address is primary.
 *
 * @param {number} actualLat
 * @param {number} actualLon
 * @param {object} projectAddress - { state, city, address }
 * @returns {{ confidence_pct, distance_m, method, verified, details }}
 */
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
  const addressQuery = parts.join(', ');

  const geocoded = await forwardGeocode(addressQuery);
  if (!geocoded) {
    // Fallback: city + state centroid only
    const fallback = await forwardGeocode([city, state].filter(Boolean).join(', '));
    if (!fallback) {
      return {
        confidence_pct: 0,
        distance_m: null,
        method: 'address_match',
        verified: false,
        details: { error: 'Could not geocode project address', address_query: addressQuery },
      };
    }

    const distM = haversineMeters(actualLat, actualLon, fallback.lat, fallback.lon);
    let conf = distanceToConfidence(distM);

    // Always run reverse-geocode for name boost, even in fallback path
    const reversed = await reverseGeocode(actualLat, actualLon);
    let stateMatch = false;
    let cityMatch  = false;
    if (reversed?.address) {
      const revState = (reversed.address.state || reversed.address.region || '').toLowerCase();
      const revCity  = (reversed.address.city || reversed.address.town || reversed.address.village || '').toLowerCase();
      stateMatch = !!state && revState.includes(state.toLowerCase());
      cityMatch  = !!city  && revCity.includes(city.toLowerCase());
      if (stateMatch && cityMatch && conf < 70) conf = 70;
      if (stateMatch && !cityMatch && conf < 50) conf = 50;
    }

    return {
      confidence_pct: conf,
      distance_m:     Math.round(distM),
      method:         'address_match',
      verified:       conf >= 85,
      details: {
        geocoded_address: [city, state].filter(Boolean).join(', '),
        geocoded_coords:  { lat: fallback.lat, lon: fallback.lon },
        actual_coords:    { lat: actualLat, lon: actualLon },
        reverse_display:  reversed?.displayName || null,
        state_match:      stateMatch,
        city_match:       cityMatch,
        note: 'Geocoded from city/state only — full address not resolvable',
      },
    };
  }

  const distM = haversineMeters(actualLat, actualLon, geocoded.lat, geocoded.lon);
  let confidence = distanceToConfidence(distM);

  const reversed = await reverseGeocode(actualLat, actualLon);
  let stateMatch = false;
  let cityMatch  = false;

  if (reversed?.address) {
    const revState = (reversed.address.state || reversed.address.region || '').toLowerCase();
    const revCity  = (reversed.address.city || reversed.address.town || reversed.address.village || '').toLowerCase();
    stateMatch = !!state && revState.includes(state.toLowerCase());
    cityMatch  = !!city  && revCity.includes(city.toLowerCase());
    // Boost for name match — stays below auto-verify for manual entries intentionally
    if (stateMatch && cityMatch && confidence < 70) confidence = 70;
    if (stateMatch && !cityMatch && confidence < 50) confidence = 50;
  }

  return {
    confidence_pct: confidence,
    distance_m:     Math.round(distM),
    method:         'address_match',
    verified:       confidence >= 85,
    details: {
      geocoded_address: addressQuery,
      geocoded_coords:  { lat: geocoded.lat, lon: geocoded.lon },
      geocoded_display: geocoded.displayName,
      actual_coords:    { lat: actualLat, lon: actualLon },
      reverse_display:  reversed?.displayName || null,
      state_match:      stateMatch,
      city_match:       cityMatch,
    },
  };
}

/**
 * Verify device GPS coordinates against project address.
 *
 * For device GPS the user's reverse-geocoded location is the PRIMARY trust signal.
 * Distance from the forward-geocoded address is a secondary refinement only.
 *
 * Rationale: In Africa, Nominatim often returns a city/LGA centroid that is
 * 30–80 km from the actual installation site, making pure distance checks
 * produce 0% confidence even when the user is standing at the project.
 * Reverse-geocoding the device's GPS is reliable because the user is physically
 * present at the location and OSM reverse lookup is accurate at point level.
 *
 * @param {number} deviceLat
 * @param {number} deviceLon
 * @param {object} projectAddress - { state, city, address }
 * @param {number} [accuracyM]    - Device GPS accuracy radius in metres (from browser API)
 */
async function verifyDeviceGPS(deviceLat, deviceLon, projectAddress, accuracyM) {
  const { state, city, address } = projectAddress;

  // ── Step 1: Reverse-geocode the device's actual location (primary signal) ──
  const reversed = await reverseGeocode(deviceLat, deviceLon);
  let stateMatch = false;
  let cityMatch  = false;

  if (reversed?.address) {
    const revState = (reversed.address.state || reversed.address.region || '').toLowerCase();
    const revCity  = (
      reversed.address.city    ||
      reversed.address.town    ||
      reversed.address.county  ||
      reversed.address.village || ''
    ).toLowerCase();
    stateMatch = !!state && revState.includes(state.toLowerCase());
    cityMatch  = !!city  && revCity.includes(city.toLowerCase());
  }

  // ── Step 2: Forward-geocode project address → distance (secondary signal) ──
  const addressQuery = [address, city, state].filter(Boolean).join(', ');
  let geocoded       = await forwardGeocode(addressQuery);
  let usedFallback   = false;
  if (!geocoded && (city || state)) {
    geocoded     = await forwardGeocode([city, state].filter(Boolean).join(', '));
    usedFallback = true;
  }

  let distM        = null;
  let effectiveDistM = null;
  if (geocoded) {
    distM = Math.round(haversineMeters(deviceLat, deviceLon, geocoded.lat, geocoded.lon));
    // Subtract GPS accuracy radius so marginal cases aren't penalised unfairly
    const gpsRadius = (accuracyM && accuracyM > 0) ? Math.min(accuracyM, 500) : 0;
    effectiveDistM  = Math.max(0, distM - gpsRadius);
  }

  // ── Step 3: Score via reverse-geocode presence, refined by distance ──────
  let confidence = 0;
  let verified   = false;

  if (stateMatch && cityMatch) {
    // Device is physically in the correct city/state — strong presence signal.
    // Large distM here usually means Nominatim returned a centroid, not a real failure.
    if      (effectiveDistM !== null && effectiveDistM < 2_000)  { confidence = 95; }
    else if (effectiveDistM !== null && effectiveDistM < 10_000) { confidence = 90; }
    else                                                          { confidence = 88; }
    verified = true;

  } else if (stateMatch && !cityMatch) {
    // Correct state, different city — could be Nominatim boundary misclassification
    if (effectiveDistM !== null && effectiveDistM < 2_000) {
      confidence = 78;   // below 85 — visible result but admin can override
    } else {
      confidence = 40;
    }
    verified = false;

  } else {
    // No reverse-geocode name match — fall back to raw distance only
    if (effectiveDistM !== null) {
      confidence = distanceToConfidence(effectiveDistM);
      verified   = confidence >= 85;
    } else {
      confidence = 10;
      verified   = false;
    }
  }

  return {
    confidence_pct: confidence,
    distance_m:     distM,
    method:         'device_proximity',
    verified,
    details: {
      geocoded_address:      usedFallback ? [city, state].filter(Boolean).join(', ') : addressQuery,
      geocoded_coords:       geocoded ? { lat: geocoded.lat, lon: geocoded.lon } : null,
      geocoded_display:      geocoded?.displayName || null,
      actual_coords:         { lat: deviceLat, lon: deviceLon },
      reverse_display:       reversed?.displayName || null,
      state_match:           stateMatch,
      city_match:            cityMatch,
      gps_accuracy_m:        accuracyM || null,
      used_fallback_geocode: usedFallback,
    },
  };
}

module.exports = {
  haversineMeters,
  distanceToConfidence,
  forwardGeocode,
  reverseGeocode,
  verifyCoordinatesAgainstAddress,
  verifyDeviceGPS,
};
