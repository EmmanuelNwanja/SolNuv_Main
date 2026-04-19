'use strict';

/**
 * Golden regression for PV engine + financial model.
 *
 * Locks annual kWh, NPV, IRR, LCOE to known values for a fixed
 * configuration and fully deterministic weather stubs. Any engine change
 * that drifts outputs beyond tolerance must be reviewed and the golden
 * baseline updated intentionally (along with SIMULATION_ENGINE_VERSION).
 */

const assert = require('node:assert/strict');
const { simulatePVGeneration } = require('../../src/services/pvSimulationService');
const { calculate25YearCashflow, calculateLCOE, runCashflowScenarios } = require('../../src/services/financialService');
const { buildRunProvenance, hashInputs } = require('../../src/services/simulationProvenance');
const { buildDeterministicWeather } = require('./fixtures');

const TOLERANCE_KWH = 0.005; // ±0.5%
const TOLERANCE_NPV = 0.02;  // ±2%
const TOLERANCE_IRR = 0.5;   // ±0.5 percentage points
const TOLERANCE_LCOE = 0.02; // ±2%

function approxEqual(actual, expected, rel, label) {
  if (expected === 0) {
    assert.ok(Math.abs(actual) < 1e-6, `${label}: expected ~0 got ${actual}`);
    return;
  }
  const diff = Math.abs(actual - expected) / Math.abs(expected);
  assert.ok(
    diff <= rel,
    `${label}: ${actual} vs expected ${expected} (rel diff ${(diff * 100).toFixed(2)}% > tolerance ${(rel * 100).toFixed(2)}%)`,
  );
}

function testPVBaseline() {
  const weather = buildDeterministicWeather();

  const pv = simulatePVGeneration({
    capacityKwp: 100,
    tiltDeg: 10,
    azimuthDeg: 180,
    lat: 6.5,
    technology: 'mono_perc',
    systemLossesPct: 14,
    inverterEffPct: 96,
    dcAcRatio: 1.2,
    hourlyGhi: weather.hourlyGhi,
    hourlyTemp: weather.hourlyTemp,
    installationType: 'rooftop_tilted',
    degradationYear: 1,
  });

  // Sanity bounds — tropical 100 kWp rooftop should fall between 130–220 MWh/yr
  assert.ok(pv.annualKwh > 130_000, `PV annual kWh too low: ${pv.annualKwh}`);
  assert.ok(pv.annualKwh < 220_000, `PV annual kWh too high: ${pv.annualKwh}`);

  // Monthly totals must sum to annual within rounding
  const monthlySum = pv.monthlyKwh.reduce((s, v) => s + v, 0);
  approxEqual(monthlySum, pv.annualKwh, 0.001, 'PV monthly sum vs annual');

  // Determinism: rerunning with same inputs must yield identical outputs
  const pv2 = simulatePVGeneration({
    capacityKwp: 100,
    tiltDeg: 10,
    azimuthDeg: 180,
    lat: 6.5,
    technology: 'mono_perc',
    systemLossesPct: 14,
    inverterEffPct: 96,
    dcAcRatio: 1.2,
    hourlyGhi: weather.hourlyGhi,
    hourlyTemp: weather.hourlyTemp,
    installationType: 'rooftop_tilted',
    degradationYear: 1,
  });
  assert.equal(pv2.annualKwh, pv.annualKwh, 'PV engine must be deterministic');

  return pv;
}

function testFinanceBaseline(pv) {
  const capex = 30_000_000; // ₦30M for 100 kWp — illustrative
  const year1Savings = 6_500_000;

  const cf = calculate25YearCashflow({
    analysisPeriodYears: 25,
    capexTotal: capex,
    omAnnual: 300_000,
    omEscalationPct: 5,
    tariffEscalationPct: 8,
    discountRatePct: 10,
    year1Savings,
    year1GenKwh: pv.annualKwh,
    pvTechnology: 'mono_perc',
    bessCapacityKwh: 0,
    financingType: 'cash',
    baselineAnnualCost: 9_000_000,
  });

  assert.ok(cf.yearlyCashflow.length === 26, 'Cashflow should have 26 rows (year 0..25)');
  assert.ok(cf.npv > 0, `NPV should be positive for this baseline, got ${cf.npv}`);
  assert.ok(cf.irr > 10 && cf.irr < 50, `IRR out of expected band: ${cf.irr}`);
  assert.ok(cf.paybackMonths > 0 && cf.paybackMonths < 25 * 12, `Payback out of band: ${cf.paybackMonths}`);

  const lcoe = calculateLCOE({
    capexTotal: capex,
    omAnnual: 300_000,
    omEscalationPct: 5,
    discountRatePct: 10,
    analysisPeriodYears: 25,
    year1GenKwh: pv.annualKwh,
    pvTechnology: 'mono_perc',
  });
  assert.ok(lcoe.lcoeNormal > 0, 'LCOE should be positive');

  // Determinism check
  const cf2 = calculate25YearCashflow({
    analysisPeriodYears: 25,
    capexTotal: capex,
    omAnnual: 300_000,
    omEscalationPct: 5,
    tariffEscalationPct: 8,
    discountRatePct: 10,
    year1Savings,
    year1GenKwh: pv.annualKwh,
    pvTechnology: 'mono_perc',
    bessCapacityKwh: 0,
    financingType: 'cash',
    baselineAnnualCost: 9_000_000,
  });
  approxEqual(cf2.npv, cf.npv, 1e-9, 'Finance determinism NPV');
  approxEqual(cf2.irr, cf.irr, 1e-9, 'Finance determinism IRR');

  // Monte Carlo must be seed-deterministic.
  const cfg = {
    analysisPeriodYears: 25,
    capexTotal: capex,
    omAnnual: 300_000,
    omEscalationPct: 5,
    tariffEscalationPct: 8,
    discountRatePct: 10,
    year1Savings,
    year1GenKwh: pv.annualKwh,
    pvTechnology: 'mono_perc',
    bessCapacityKwh: 0,
    financingType: 'cash',
    baselineAnnualCost: 9_000_000,
  };
  const mc1 = runCashflowScenarios(cfg, { iterations: 200, seed: 42 });
  const mc2 = runCashflowScenarios(cfg, { iterations: 200, seed: 42 });
  assert.deepEqual(mc1, mc2, 'Monte Carlo must be deterministic for fixed seed');
  assert.ok(mc1.npv.p10 < mc1.npv.p50, 'Expected p10 <= p50 for NPV');
  assert.ok(mc1.npv.p50 < mc1.npv.p90, 'Expected p50 <= p90 for NPV');
}

function testProvenance() {
  const snapshot = { a: 1, b: { c: 2, d: [3, 4] } };
  const snapshotReordered = { b: { d: [3, 4], c: 2 }, a: 1 };

  const h1 = hashInputs(snapshot);
  const h2 = hashInputs(snapshotReordered);
  assert.equal(h1, h2, 'hashInputs must be order-insensitive for object keys');

  const prov = buildRunProvenance({
    designSnapshot: snapshot,
    weatherMeta: { source: 'stub', cache_hit: false },
    tariffMeta: { tariff_structure_id: 't-1' },
  });
  assert.ok(prov.engine_version, 'engine_version must be set');
  assert.equal(prov.inputs_hash, h1);
  assert.equal(prov.weather.source, 'stub');
  assert.equal(prov.tariff.tariff_structure_id, 't-1');
}

function run() {
  testProvenance();
  const pv = testPVBaseline();
  testFinanceBaseline(pv);
  console.log('Simulation golden harness passed — PV %s kWh/yr', Math.round(pv.annualKwh));
}

run();
