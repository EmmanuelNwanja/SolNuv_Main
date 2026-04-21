/**
 * SolNuv Simulation Provenance Helpers
 *
 * Builds the reproducibility blob persisted on every simulation_results row:
 *   - engine_version (from constants/simulationVersion)
 *   - inputs_hash: deterministic SHA-256 of the canonical design snapshot
 *   - weather meta (source, fetched_at, grid cell, cache hit flag)
 *   - tariff meta (structure id, resolved-as-of timestamp, band snapshot/hash)
 *
 * Kept intentionally small — payload size matters because hourly_flows already
 * dominates simulation_results row size.
 */

const crypto = require('crypto');
const { SIMULATION_ENGINE_VERSION } = require('../constants/simulationVersion');
const { getFormulaBundleHash } = require('./formulaRegistry');

/**
 * Recursively sort object keys so JSON stringification is deterministic.
 * Arrays preserve order. Non-plain values pass through.
 */
function canonicalize(value) {
  if (Array.isArray(value)) {
    return value.map((v) => canonicalize(v));
  }
  if (value && typeof value === 'object' && value.constructor === Object) {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        acc[key] = canonicalize(value[key]);
        return acc;
      }, {});
  }
  return value;
}

/**
 * Stable SHA-256 hex digest of a design payload. Order-insensitive for objects.
 */
function hashInputs(snapshot) {
  const serialized = JSON.stringify(canonicalize(snapshot ?? {}));
  return crypto.createHash('sha256').update(serialized).digest('hex');
}

function hashWeatherDataset(weatherMeta: any): string | null {
  if (!weatherMeta || typeof weatherMeta !== 'object') return null;
  const candidate = {
    source: weatherMeta.source || null,
    lat_rounded: weatherMeta.lat_rounded || null,
    lon_rounded: weatherMeta.lon_rounded || null,
    fetched_at: weatherMeta.fetched_at || null,
    cache_hit: weatherMeta.cache_hit ?? null,
  };
  const serialized = JSON.stringify(canonicalize(candidate));
  return crypto.createHash('sha256').update(serialized).digest('hex');
}

/**
 * Build the run_provenance blob. Each sub-object is optional — callers pass
 * whatever metadata they have, and unknown sections are omitted.
 *
 * @param {object} params
 * @param {object} params.designSnapshot - the same snapshot stored on simulation_results.design_snapshot
 * @param {object} [params.weatherMeta]  - from solarResourceService.getHourlySolarResource
 * @param {object} [params.tariffMeta]   - {tariff_structure_id, as_of, snapshot, band_hash}
 * @param {object} [params.extra]        - anything else (grid topology, load profile id, etc.)
 * @returns {object} run_provenance
 */
function buildRunProvenance(opts: any = {}) {
  const { designSnapshot, weatherMeta, tariffMeta, extra } = opts;
  const inputsHash = hashInputs(designSnapshot);
  const weatherHash = hashWeatherDataset(weatherMeta);
  const provenance: any = {
    engine_version: SIMULATION_ENGINE_VERSION,
    inputs_hash: inputsHash,
    input_snapshot_hash: inputsHash,
    formula_bundle_hash: getFormulaBundleHash(),
    weather_dataset_hash: weatherHash,
    generated_at: new Date().toISOString(),
  };
  if (weatherMeta) provenance.weather = weatherMeta;
  if (tariffMeta) provenance.tariff = tariffMeta;
  if (extra && typeof extra === 'object') provenance.extra = extra;
  return provenance;
}

module.exports = {
  buildRunProvenance,
  hashInputs,
  hashWeatherDataset,
  canonicalize,
  SIMULATION_ENGINE_VERSION,
};
