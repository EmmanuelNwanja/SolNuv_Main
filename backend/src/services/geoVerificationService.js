/**
 * SolNuv Geo Verification Service
 * AI-assisted geolocation verification using reverse/forward geocoding
 * and distance-based confidence scoring.
 */

const logger = require('../utils/logger');

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';
const USER_AGENT = 'SolNuv/1.0 (https://solnuv.com)';

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
 * Forward geocode an address string → { lat, lon, displayName }
 * Uses Nominatim (OpenStreetMap) — free, no API key.
 */
async function forwardGeocode(address) {
  const url = `${NOMINATIM_BASE}/search?` + new URLSearchParams({
    q: address,
    format: 'json',
    limit: '1',
    addressdetails: '1',
  });
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
  });
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
  const url = `${NOMINATIM_BASE}/reverse?` + new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    format: 'json',
    addressdetails: '1',
    zoom: '18',
  });
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
  });
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
 *
 * Strategy:
 * 1. Forward-geocode the project address → expected coordinates
 * 2. Calculate haversine distance between expected and actual
 * 3. Reverse-geocode the actual coordinates for additional context
 * 4. Cross-check state/city names for extra validation
 * 5. Return confidence score and details
 *
 * @param {number} actualLat - Coordinates to verify (device GPS or manual entry)
 * @param {number} actualLon
 * @param {object} projectAddress - { state, city, address }
 * @returns {{ confidence_pct, distance_m, method, verified, details }}
 */
async function verifyCoordinatesAgainstAddress(actualLat, actualLon, projectAddress) {
  const { state, city, address } = projectAddress;

  // Build address query — use most specific available
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

  // Forward geocode the project address
  const geocoded = await forwardGeocode(addressQuery);
  if (!geocoded) {
    // Try with just city + state as fallback
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
    // Use fallback but note it's less precise
    const distM = haversineMeters(actualLat, actualLon, fallback.lat, fallback.lon);
    const conf = Math.max(distanceToConfidence(distM) - 10, 0); // penalty for imprecise geocode
    return {
      confidence_pct: conf,
      distance_m: Math.round(distM),
      method: 'address_match',
      verified: conf >= 70,
      details: {
        geocoded_address: [city, state].filter(Boolean).join(', '),
        geocoded_coords: { lat: fallback.lat, lon: fallback.lon },
        actual_coords: { lat: actualLat, lon: actualLon },
        note: 'Geocoded from city/state only — full address not resolvable',
      },
    };
  }

  const distM = haversineMeters(actualLat, actualLon, geocoded.lat, geocoded.lon);
  let confidence = distanceToConfidence(distM);

  // Reverse geocode actual coordinates for state/city cross-check
  const reversed = await reverseGeocode(actualLat, actualLon);
  let stateMatch = false;
  let cityMatch = false;

  if (reversed?.address) {
    const revState = (reversed.address.state || reversed.address.region || '').toLowerCase();
    const revCity = (reversed.address.city || reversed.address.town || reversed.address.village || '').toLowerCase();
    stateMatch = state && revState.includes(state.toLowerCase());
    cityMatch = city && revCity.includes(city.toLowerCase());

    // Boost confidence if state/city names match even with large distance (area is big)
    if (stateMatch && cityMatch && confidence < 70) confidence = 70;
    if (stateMatch && !cityMatch && confidence < 50) confidence = 50;
  }

  const verified = confidence >= 85;

  return {
    confidence_pct: confidence,
    distance_m: Math.round(distM),
    method: 'address_match',
    verified,
    details: {
      geocoded_address: addressQuery,
      geocoded_coords: { lat: geocoded.lat, lon: geocoded.lon },
      geocoded_display: geocoded.displayName,
      actual_coords: { lat: actualLat, lon: actualLon },
      reverse_display: reversed?.displayName || null,
      state_match: stateMatch,
      city_match: cityMatch,
    },
  };
}

/**
 * Verify device GPS coordinates against project address.
 * Same as above but uses a higher confidence threshold (95% vicinity).
 */
async function verifyDeviceGPS(deviceLat, deviceLon, projectAddress) {
  const result = await verifyCoordinatesAgainstAddress(deviceLat, deviceLon, projectAddress);
  result.method = 'device_proximity';
  // Device GPS is inherently more trustworthy — boost confidence for close matches
  if (result.distance_m !== null && result.distance_m < 200) {
    result.confidence_pct = Math.max(result.confidence_pct, 98);
    result.verified = true;
  }
  return result;
}

module.exports = {
  haversineMeters,
  distanceToConfidence,
  forwardGeocode,
  reverseGeocode,
  verifyCoordinatesAgainstAddress,
  verifyDeviceGPS,
};
