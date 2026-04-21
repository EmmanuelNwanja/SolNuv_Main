'use strict';

const assert = require('node:assert/strict');
const { calculateAnnualBill } = require('../../src/services/tariffService');
const { calculateEnergyComparison } = require('../../src/services/energyComparisonService');
const { computeEnergyUncertainty } = require('../../src/services/uncertaintyService');

function buildFlatTariff() {
  return {
    seasons: [{ key: 'all', label: 'All Year', months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] }],
  };
}

function buildFlatRates(ratePerKwh) {
  return [
    {
      season_key: 'all',
      period_name: 'off_peak',
      weekday_hours: [],
      saturday_hours: [],
      sunday_hours: [],
      rate_per_kwh: ratePerKwh,
    },
  ];
}

function testTariffDeterminism() {
  const profile = new Array(8760).fill(10);
  const structure = buildFlatTariff();
  const rates = buildFlatRates(50);
  const b1 = calculateAnnualBill(profile, structure, rates, []);
  const b2 = calculateAnnualBill(profile, structure, rates, []);

  assert.equal(b1.annual.total_kwh, 87600);
  assert.equal(b1.annual.total_cost, 4380000);
  assert.deepEqual(b1, b2, 'Tariff billing must be deterministic');
}

function testEnergyComparisonSanity() {
  const comparison = calculateEnergyComparison({
    annualLoadKwh: 120000,
    annualSolarGenKwh: 90000,
    solarUtilisedKwh: 85000,
    gridImportKwh: 35000,
    unmetLoadKwh: 0,
    gridTopology: 'grid_tied_bess',
    baselineAnnualCost: 6000000,
    withSolarAnnualCost: 2800000,
    capexTotal: 28000000,
    analysisPeriodYears: 25,
    tariffEscalationPct: 8,
    dieselPricePerLitre: 1100,
    petrolPricePerLitre: 700,
    fuelEscalationPct: 10,
    country: 'NG',
  });
  assert.ok(comparison.annual_savings.vs_grid > 0, 'Solar should save against grid for this fixture');
  assert.ok(comparison.environmental.co2_avoided_vs_grid_kg > 0, 'CO2 avoided vs grid should be positive');
}

function testUncertaintyDeterminism() {
  const a = computeEnergyUncertainty({ annualGenerationKwh: 300000 });
  const b = computeEnergyUncertainty({ annualGenerationKwh: 300000 });
  assert.deepEqual(a, b, 'Uncertainty output must be deterministic');
}

function run() {
  testTariffDeterminism();
  testEnergyComparisonSanity();
  testUncertaintyDeterminism();
  console.log('Integration golden harness passed');
}

run();

