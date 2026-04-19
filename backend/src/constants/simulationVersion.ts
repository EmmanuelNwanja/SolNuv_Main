/**
 * SolNuv Simulation Engine Version
 *
 * Bump on any change to simulation physics, financial math, or output schema
 * that affects reproducibility. Format: MAJOR.MINOR.PATCH.
 *
 * Stamped onto every simulation_results row via run_provenance.engine_version
 * so historical runs remain interpretable when the engine evolves.
 */

const SIMULATION_ENGINE_VERSION = '1.0.0';

module.exports = {
  SIMULATION_ENGINE_VERSION,
};
