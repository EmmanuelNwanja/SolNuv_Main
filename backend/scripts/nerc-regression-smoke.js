'use strict';

const assert = require('node:assert/strict');
const {
  computeRegulatoryPathway,
  computeReportingCadence,
  computeMiniGridType,
  addBusinessDays,
} = require('../src/services/nercComplianceService');

function run() {
  assert.equal(computeRegulatoryPathway(99.99), 'registration');
  assert.equal(computeRegulatoryPathway(100), 'registration');
  assert.equal(computeRegulatoryPathway(100.01), 'permit_required');

  assert.equal(computeReportingCadence(999.99), 'annual');
  assert.equal(computeReportingCadence(1000), 'quarterly');

  assert.equal(computeMiniGridType('off_grid'), 'isolated');
  assert.equal(computeMiniGridType('hybrid'), 'interconnected');

  const friday = new Date('2026-04-17T09:00:00.000Z');
  const dueDate = addBusinessDays(friday, 1);
  assert.equal(dueDate.getUTCDay(), 1, 'Business-day SLA should skip weekend');

  console.log('NERC regression smoke checks passed');
}

run();
