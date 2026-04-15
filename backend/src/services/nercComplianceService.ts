'use strict';

function toNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function computeRegulatoryPathway(capacityKw) {
  const kw = toNumber(capacityKw, 0);
  return kw > 100 ? 'permit_required' : 'registration';
}

function computeReportingCadence(capacityKw) {
  const kw = toNumber(capacityKw, 0);
  return kw >= 1000 ? 'quarterly' : 'annual';
}

function computeMiniGridType(gridTopology) {
  return gridTopology === 'off_grid' ? 'isolated' : 'interconnected';
}

function addBusinessDays(startDate, businessDays) {
  const date = new Date(startDate);
  let added = 0;
  while (added < businessDays) {
    date.setDate(date.getDate() + 1);
    const day = date.getDay();
    if (day !== 0 && day !== 6) added += 1;
  }
  return date;
}

function deriveRegulatoryProfile({ project = null, latestDesign = null }) {
  const capacityKw = toNumber(project?.capacity_kw, 0);
  return {
    mini_grid_type: computeMiniGridType(latestDesign?.grid_topology),
    declared_capacity_kw: capacityKw,
    regulatory_pathway: computeRegulatoryPathway(capacityKw),
    permit_required: computeRegulatoryPathway(capacityKw) === 'permit_required',
    reporting_cadence: computeReportingCadence(capacityKw),
    permit_threshold_kw: 100,
    annual_reporting_threshold_kw: 1000,
    regulation_version: 'NERC-R-001-2026',
  };
}

module.exports = {
  computeRegulatoryPathway,
  computeReportingCadence,
  computeMiniGridType,
  addBusinessDays,
  deriveRegulatoryProfile,
};
