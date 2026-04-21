'use strict';

const assert = require('node:assert/strict');
const { simulateBESS } = require('../../src/services/bessSimulationService');
const { computeEnergyUncertainty } = require('../../src/services/uncertaintyService');

const HOURS = 8760;

function makeSeries(value) {
  return new Array(HOURS).fill(value);
}

function testSocBounds() {
  const capacityKwh = 240;
  const dodPct = 85;
  const minSocKwh = capacityKwh * (1 - dodPct / 100);
  const maxSocKwh = capacityKwh;
  const res = simulateBESS({
    capacityKwh,
    chemistry: 'lfp',
    dodPct,
    cRate: 0.5,
    powerKw: 120,
    strategy: 'self_consumption',
    hourlyPvKw: makeSeries(32),
    hourlyLoadKw: makeSeries(28),
    gridTopology: 'grid_tied_bess',
  });

  for (const flow of res.hourlyFlows) {
    assert.ok(flow.soc >= minSocKwh - 1e-6, `SOC below min bound: ${flow.soc}`);
    assert.ok(flow.soc <= maxSocKwh + 1e-6, `SOC above max bound: ${flow.soc}`);
    assert.ok(Number.isFinite(flow.soc), 'SOC must be finite');
  }
}

function testEnergyNonNegative() {
  const res = simulateBESS({
    capacityKwh: 200,
    chemistry: 'lfp',
    dodPct: 80,
    cRate: 0.5,
    powerKw: 100,
    strategy: 'peak_shave',
    peakShaveThresholdKw: 20,
    hourlyPvKw: makeSeries(18),
    hourlyLoadKw: makeSeries(22),
    gridTopology: 'hybrid',
    gridAvailability: makeSeries(1),
  });

  const annual = res.annual || {};
  assert.ok(annual.solar_utilised_kwh >= 0, 'solar_utilised_kwh must be non-negative');
  assert.ok(annual.grid_import_kwh >= 0, 'grid_import_kwh must be non-negative');
  assert.ok(annual.grid_export_kwh >= 0, 'grid_export_kwh must be non-negative');
  assert.ok(annual.battery_discharged_kwh >= 0, 'battery_discharged_kwh must be non-negative');
}

function testUncertaintyOrdering() {
  const output = computeEnergyUncertainty({
    annualGenerationKwh: 215000,
    weatherVariabilityPct: 5.0,
    modelVariabilityPct: 2.0,
    componentVariabilityPct: 1.5,
    operationalVariabilityPct: 1.0,
  });
  const p = output.annual_generation_mwh;
  assert.ok(p.p95 <= p.p90, 'Expected p95 <= p90');
  assert.ok(p.p90 <= p.p50, 'Expected p90 <= p50');
  assert.ok(p.p50 <= p.p10, 'Expected p50 <= p10');
}

function run() {
  testSocBounds();
  testEnergyNonNegative();
  testUncertaintyOrdering();
  console.log('Simulation invariants passed');
}

run();

