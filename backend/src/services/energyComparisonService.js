/**
 * SolNuv Energy Comparison Service
 * Calculates cost, environmental, and benefit comparisons for solar systems
 * against grid-only, diesel generator, and petrol generator alternatives.
 * Works for ALL grid topologies (grid_tied, grid_tied_bess, off_grid, hybrid).
 */

// ── FUEL & EMISSION CONSTANTS ────────────────────────────────────────────────
// Sources: IEA, EPA, Nigerian Electricity Regulatory Commission (NERC), field data

// Diesel generator: 3.5 kWh output per litre at typical 30-40% load factor
const DIESEL_KWH_PER_LITRE = 3.5;
// Petrol/gasoline generator: 2.8 kWh output per litre (lower efficiency)
const PETROL_KWH_PER_LITRE = 2.8;

// CO₂ emission factors (kg CO₂ per unit)
const CO2_KG_PER_KWH_GRID_NIGERIA = 0.43;   // Nigeria grid (gas + hydro mix, NERC/IEA 2023)
const CO2_KG_PER_KWH_GRID_GHANA = 0.35;     // Ghana grid (hydro-dominant)
const CO2_KG_PER_KWH_GRID_KENYA = 0.25;     // Kenya grid (geothermal + hydro)
const CO2_KG_PER_KWH_GRID_SOUTHAFRICA = 0.95; // South Africa (coal-dominant)
const CO2_KG_PER_KWH_GRID_DEFAULT = 0.50;   // Generic Sub-Saharan Africa average

const CO2_KG_PER_LITRE_DIESEL = 2.68;  // EPA, includes combustion + upstream
const CO2_KG_PER_LITRE_PETROL = 2.31;  // EPA

// Generator maintenance costs (₦ per operating hour)
const DIESEL_GEN_MAINTENANCE_PER_HR = 500;  // Oil changes, filters, servicing
const PETROL_GEN_MAINTENANCE_PER_HR = 350;

// Generator lifespan & replacement
const DIESEL_GEN_LIFESPAN_HOURS = 20000;
const PETROL_GEN_LIFESPAN_HOURS = 10000;

// Average tree CO₂ absorption (kg CO₂ per tree per year, tropical mature tree)
const CO2_PER_TREE_PER_YEAR = 22;

// Default fuel prices (NGN/litre) — will be overridden by user inputs when available
const DEFAULT_DIESEL_PRICE = 1100; // ₦/L (2024 market rate)
const DEFAULT_PETROL_PRICE = 700;  // ₦/L (2024 market rate)

/**
 * Get grid CO₂ emission factor by country.
 * @param {string} countryCode - ISO 2-letter code or country name
 * @returns {number} kg CO₂ per kWh
 */
function getGridEmissionFactor(countryCode) {
  const code = (countryCode || '').toUpperCase().trim();
  const map = {
    NG: CO2_KG_PER_KWH_GRID_NIGERIA, NGA: CO2_KG_PER_KWH_GRID_NIGERIA, NIGERIA: CO2_KG_PER_KWH_GRID_NIGERIA,
    GH: CO2_KG_PER_KWH_GRID_GHANA, GHA: CO2_KG_PER_KWH_GRID_GHANA, GHANA: CO2_KG_PER_KWH_GRID_GHANA,
    KE: CO2_KG_PER_KWH_GRID_KENYA, KEN: CO2_KG_PER_KWH_GRID_KENYA, KENYA: CO2_KG_PER_KWH_GRID_KENYA,
    ZA: CO2_KG_PER_KWH_GRID_SOUTHAFRICA, ZAF: CO2_KG_PER_KWH_GRID_SOUTHAFRICA,
  };
  return map[code] || CO2_KG_PER_KWH_GRID_DEFAULT;
}

/**
 * Calculate comprehensive energy source comparison.
 *
 * @param {object} params
 * @param {number} params.annualLoadKwh - Total annual electricity consumption (kWh)
 * @param {number} params.annualSolarGenKwh - Solar system annual generation (kWh)
 * @param {number} params.solarUtilisedKwh - Solar energy directly used (kWh)
 * @param {number} params.gridImportKwh - Grid electricity imported with solar system (kWh)
 * @param {number} params.unmetLoadKwh - Unmet load for off-grid/hybrid (kWh)
 * @param {string} params.gridTopology - System topology
 * @param {number} params.baselineAnnualCost - Grid-only annual electricity cost (₦)
 * @param {number} params.withSolarAnnualCost - Annual cost with solar system (₦)
 * @param {number} params.capexTotal - Total upfront investment (₦)
 * @param {number} params.analysisPeriodYears - Analysis period (default 25)
 * @param {number} params.tariffEscalationPct - Annual tariff escalation (%)
 * @param {number} params.dieselPricePerLitre - Diesel fuel price (₦/L)
 * @param {number} params.petrolPricePerLitre - Petrol fuel price (₦/L)
 * @param {number} params.fuelEscalationPct - Annual fuel price escalation (%)
 * @param {string} params.country - Country for grid emission factor
 * @param {number} params.gridAvailabilityPct - Grid availability (0-100%)
 * @param {number} params.batteryDischargedKwh - Annual battery discharge (kWh)
 * @param {number} params.feedInRevenue - Annual feed-in revenue (₦)
 * @returns {object} Comprehensive comparison results
 */
function calculateEnergyComparison(params) {
  const {
    annualLoadKwh = 0,
    annualSolarGenKwh = 0,
    solarUtilisedKwh = 0,
    gridImportKwh = 0,
    unmetLoadKwh = 0,
    gridTopology = 'grid_tied_bess',
    baselineAnnualCost = 0,
    withSolarAnnualCost = 0,
    capexTotal = 0,
    analysisPeriodYears = 25,
    tariffEscalationPct = 8,
    dieselPricePerLitre = DEFAULT_DIESEL_PRICE,
    petrolPricePerLitre = DEFAULT_PETROL_PRICE,
    fuelEscalationPct = 10,
    country = 'NG',
    gridAvailabilityPct = 100,
    batteryDischargedKwh = 0,
    feedInRevenue = 0,
  } = params;

  const isOffGrid = gridTopology === 'off_grid';
  const gridEmissionFactor = getGridEmissionFactor(country);
  const tariffEsc = tariffEscalationPct / 100;
  const fuelEsc = fuelEscalationPct / 100;

  // ── GRID-ONLY SCENARIO ──
  // If off-grid, grid scenario = diesel generator running 24/7 (no grid available)
  const gridOnlyAnnualCost = isOffGrid ? 0 : baselineAnnualCost;
  const gridOnlyCO2 = isOffGrid ? 0 : annualLoadKwh * gridEmissionFactor;

  // ── DIESEL GENERATOR SCENARIO ──
  // Diesel gen must supply full load (or load minus grid in hybrid scenarios)
  const dieselLoadKwh = annualLoadKwh; // Full load if diesel is the only source
  const dieselLitresAnnual = dieselLoadKwh / DIESEL_KWH_PER_LITRE;
  const dieselFuelCostYear1 = dieselLitresAnnual * dieselPricePerLitre;
  const dieselRunHoursAnnual = dieselLoadKwh > 0 ? Math.min(8760, dieselLoadKwh / (dieselLoadKwh / 8760 + 0.001)) : 0;
  const dieselMaintenanceYear1 = (dieselLoadKwh / (dieselLoadKwh > 0 ? (dieselLoadKwh / 8760) : 1)) > 0
    ? (dieselLitresAnnual / DIESEL_KWH_PER_LITRE) * DIESEL_GEN_MAINTENANCE_PER_HR / DIESEL_KWH_PER_LITRE
    : 0;
  // Simplified: maintenance proportional to run hours
  const dieselEstRunHours = annualLoadKwh > 0 ? 8760 * 0.7 : 0; // ~70% load factor
  const dieselMaintenanceCost = dieselEstRunHours * DIESEL_GEN_MAINTENANCE_PER_HR;
  const dieselTotalYear1 = dieselFuelCostYear1 + dieselMaintenanceCost;
  const dieselCO2 = dieselLitresAnnual * CO2_KG_PER_LITRE_DIESEL;

  // Generator replacement cost (approximate)
  const dieselReplacementsPerPeriod = Math.floor((analysisPeriodYears * dieselEstRunHours) / DIESEL_GEN_LIFESPAN_HOURS);

  // ── PETROL GENERATOR SCENARIO ──
  const petrolLitresAnnual = annualLoadKwh / PETROL_KWH_PER_LITRE;
  const petrolFuelCostYear1 = petrolLitresAnnual * petrolPricePerLitre;
  const petrolEstRunHours = annualLoadKwh > 0 ? 8760 * 0.6 : 0;
  const petrolMaintenanceCost = petrolEstRunHours * PETROL_GEN_MAINTENANCE_PER_HR;
  const petrolTotalYear1 = petrolFuelCostYear1 + petrolMaintenanceCost;
  const petrolCO2 = petrolLitresAnnual * CO2_KG_PER_LITRE_PETROL;
  const petrolReplacementsPerPeriod = Math.floor((analysisPeriodYears * petrolEstRunHours) / PETROL_GEN_LIFESPAN_HOURS);

  // ── SOLAR SYSTEM SCENARIO ──
  const solarAnnualCost = withSolarAnnualCost; // Residual grid cost with solar
  // Solar CO₂: only from grid import portion
  const solarCO2 = gridImportKwh * gridEmissionFactor;

  // ── LIFETIME COST PROJECTIONS ──
  const lifetimeCosts = {
    grid_only: calculateLifetimeCost(gridOnlyAnnualCost, tariffEsc, analysisPeriodYears, 0),
    diesel: calculateLifetimeCost(dieselTotalYear1, fuelEsc, analysisPeriodYears, 0),
    petrol: calculateLifetimeCost(petrolTotalYear1, fuelEsc, analysisPeriodYears, 0),
    solar: capexTotal + calculateLifetimeCost(solarAnnualCost, tariffEsc, analysisPeriodYears, 0)
      - (feedInRevenue * analysisPeriodYears),
  };

  // ── ENVIRONMENTAL IMPACT ──
  const co2AvoidedVsGrid = Math.max(0, gridOnlyCO2 - solarCO2);
  const co2AvoidedVsDiesel = Math.max(0, dieselCO2 - solarCO2);
  const co2AvoidedVsPetrol = Math.max(0, petrolCO2 - solarCO2);
  const treesEquivalent = co2AvoidedVsGrid > 0
    ? Math.round(co2AvoidedVsGrid / CO2_PER_TREE_PER_YEAR)
    : Math.round(co2AvoidedVsDiesel / CO2_PER_TREE_PER_YEAR);

  // ── FUEL SAVINGS ──
  const dieselAvoidedLitres = dieselLitresAnnual; // All diesel avoided if going solar
  const petrolAvoidedLitres = petrolLitresAnnual;

  // ── YEARLY COMPARISON (for chart data) ──
  const yearlyComparison = [];
  for (let year = 1; year <= analysisPeriodYears; year++) {
    const escFactorTariff = Math.pow(1 + tariffEsc, year - 1);
    const escFactorFuel = Math.pow(1 + fuelEsc, year - 1);
    yearlyComparison.push({
      year,
      grid_cost: Math.round(gridOnlyAnnualCost * escFactorTariff),
      diesel_cost: Math.round(dieselTotalYear1 * escFactorFuel),
      petrol_cost: Math.round(petrolTotalYear1 * escFactorFuel),
      solar_cost: year === 1 ? Math.round(capexTotal + solarAnnualCost) : Math.round(solarAnnualCost * escFactorTariff),
    });
  }

  return {
    // Annual Year-1 costs
    annual_costs: {
      grid_only: Math.round(gridOnlyAnnualCost),
      diesel: Math.round(dieselTotalYear1),
      petrol: Math.round(petrolTotalYear1),
      solar: Math.round(solarAnnualCost),
    },
    // Lifetime costs
    lifetime_costs: {
      grid_only: Math.round(lifetimeCosts.grid_only),
      diesel: Math.round(lifetimeCosts.diesel),
      petrol: Math.round(lifetimeCosts.petrol),
      solar: Math.round(lifetimeCosts.solar),
    },
    // Annual savings vs each alternative
    annual_savings: {
      vs_grid: Math.round(gridOnlyAnnualCost - solarAnnualCost),
      vs_diesel: Math.round(dieselTotalYear1 - solarAnnualCost),
      vs_petrol: Math.round(petrolTotalYear1 - solarAnnualCost),
    },
    // Environmental metrics (annual)
    environmental: {
      co2_grid_only_kg: Math.round(gridOnlyCO2),
      co2_diesel_kg: Math.round(dieselCO2),
      co2_petrol_kg: Math.round(petrolCO2),
      co2_solar_kg: Math.round(solarCO2),
      co2_avoided_vs_grid_kg: Math.round(co2AvoidedVsGrid),
      co2_avoided_vs_diesel_kg: Math.round(co2AvoidedVsDiesel),
      co2_avoided_vs_petrol_kg: Math.round(co2AvoidedVsPetrol),
      co2_avoided_lifetime_tonnes: Math.round((co2AvoidedVsGrid > 0 ? co2AvoidedVsGrid : co2AvoidedVsDiesel) * analysisPeriodYears / 1000 * 10) / 10,
      trees_equivalent: treesEquivalent,
      diesel_avoided_litres: Math.round(dieselAvoidedLitres),
      petrol_avoided_litres: Math.round(petrolAvoidedLitres),
    },
    // Fuel consumption comparison (annual)
    fuel_consumption: {
      diesel_litres_annual: Math.round(dieselLitresAnnual),
      petrol_litres_annual: Math.round(petrolLitresAnnual),
      diesel_cost_per_kwh: dieselLoadKwh > 0 ? Math.round(dieselTotalYear1 / dieselLoadKwh * 100) / 100 : 0,
      petrol_cost_per_kwh: annualLoadKwh > 0 ? Math.round(petrolTotalYear1 / annualLoadKwh * 100) / 100 : 0,
    },
    // Generator lifecycle
    generator_lifecycle: {
      diesel_replacements: dieselReplacementsPerPeriod,
      petrol_replacements: petrolReplacementsPerPeriod,
    },
    // Yearly comparison for charts
    yearly_comparison: yearlyComparison,
  };
}

/**
 * Calculate total cost over analysis period with annual escalation.
 */
function calculateLifetimeCost(year1Cost, escalation, years, initialCapex) {
  let total = initialCapex;
  for (let y = 1; y <= years; y++) {
    total += year1Cost * Math.pow(1 + escalation, y - 1);
  }
  return total;
}

module.exports = {
  calculateEnergyComparison,
  getGridEmissionFactor,
  DIESEL_KWH_PER_LITRE,
  PETROL_KWH_PER_LITRE,
  CO2_KG_PER_LITRE_DIESEL,
  CO2_KG_PER_LITRE_PETROL,
  DEFAULT_DIESEL_PRICE,
  DEFAULT_PETROL_PRICE,
};
