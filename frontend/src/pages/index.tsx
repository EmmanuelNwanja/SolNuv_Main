import Head from 'next/head';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import {
  RiSunLine, RiLeafLine, RiFileTextLine, RiTrophyLine, RiArrowRightLine,
  RiCheckLine, RiShieldCheckLine, RiMapPinLine, RiFlashlightLine,
  RiBarChartLine, RiCalculatorLine, RiRecycleLine, RiGlobalLine,
  RiTeamLine, RiBriefcaseLine, RiArrowDownLine, RiRobotLine,
  RiBatteryChargeLine, RiLineChartLine, RiDraftLine,
} from 'react-icons/ri';
import { calculatorAPI, dashboardAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useRouter } from 'next/router';
import { MotionItem, MotionSection, MotionStagger } from '../components/PageMotion';
import { getPublicLayout } from '../components/Layout';

const CLIMATE_ZONES = [
  { value: 'coastal_humid', label: 'Coastal / Humid (Lagos, Rivers, Delta)' },
  { value: 'sahel_dry',     label: 'Sahel / Dry Heat (Kano, Sokoto, Borno)' },
  { value: 'se_humid',      label: 'Southeast Humid (Enugu, Anambra, Imo)' },
  { value: 'mixed',         label: 'Mixed / Inland (FCT, Oyo, Kaduna)' },
];

const PARTNERS_ROW1 = [
  { name: 'NESREA', tag: 'EPR Framework', color: 'text-forest-900 bg-emerald-50 border-emerald-200' },
  { name: 'Secure Gateway', tag: 'Payments', color: 'text-slate-800 bg-slate-50 border-slate-200' },
  { name: 'REA Nigeria', tag: 'Electrification', color: 'text-forest-900 bg-amber-50 border-amber-200' },
  { name: 'REAN', tag: 'Industry Body', color: 'text-emerald-800 bg-emerald-50 border-emerald-200' },
  { name: 'NERC', tag: 'Tariff Regulator', color: 'text-slate-800 bg-slate-50 border-slate-200' },
  { name: 'Jinko Solar', tag: 'Panel Brand', color: 'text-forest-900 bg-white border-slate-200' },
  { name: 'BYD', tag: 'Battery Brand', color: 'text-slate-800 bg-slate-50 border-slate-200' },
  { name: 'Growatt', tag: 'Inverter Brand', color: 'text-emerald-800 bg-emerald-50 border-emerald-200' },
];
const PARTNERS_ROW2 = [
  { name: 'Schneider Electric', tag: 'Energy Systems', color: 'text-slate-800 bg-slate-50 border-slate-200' },
  { name: 'UNDP Nigeria', tag: 'Development', color: 'text-forest-900 bg-amber-50 border-amber-200' },
  { name: 'SolarAid', tag: 'Solar Access', color: 'text-amber-700 bg-amber-50 border-amber-200' },
  { name: 'Longi Solar', tag: 'Panel Brand', color: 'text-forest-900 bg-emerald-50 border-emerald-200' },
  { name: 'Victron Energy', tag: 'Power Systems', color: 'text-slate-800 bg-slate-50 border-slate-200' },
  { name: 'Pylontech', tag: 'Storage', color: 'text-emerald-800 bg-emerald-50 border-emerald-200' },
  { name: 'GreenTech Africa', tag: 'Impact Partner', color: 'text-forest-900 bg-white border-slate-200' },
  { name: 'NAERG', tag: 'Renewable Energy', color: 'text-slate-800 bg-slate-50 border-slate-200' },
];

export default function Home() {
  const { session, loading, profileResolved, isOnboarded, isPlatformAdmin } = useAuth();
  const router = useRouter();

  const [calcTab, setCalcTab] = useState('panel');
  const [silverForm, setSilverForm] = useState({
    size_watts: 400, quantity: 10,
    installation_date: '2018-01-01',
    climate_zone: 'coastal_humid',
  });
  const [silverResult, setSilverResult] = useState(null);
  const [calcLoading, setCalcLoading] = useState(false);
  const [platformSummary, setPlatformSummary] = useState<{
    totals?: Record<string, number>;
    ai?: Record<string, number | boolean>;
    v2?: Record<string, number>;
  } | null>(null);

  useEffect(() => {
    const schedule = typeof window !== 'undefined' && 'requestIdleCallback' in window
      ? (fn) => window.requestIdleCallback(fn, { timeout: 4000 })
      : (fn) => setTimeout(fn, 1500);
    schedule(() => runSilverCalc(silverForm));
  }, []);

  useEffect(() => {
    if (!loading && session && profileResolved) {
      if (isPlatformAdmin) {
        router.replace('/admin');
      } else if (!isOnboarded) {
        router.replace('/onboarding');
      } else {
        router.replace('/dashboard');
      }
    }
  }, [loading, session, profileResolved, isOnboarded, isPlatformAdmin, router]);

  useEffect(() => {
    let isMounted = true;

    const loadPublicSummary = async () => {
      try {
        const { data } = await dashboardAPI.getPublicSummary();
        if (isMounted) setPlatformSummary(data?.data || null);
      } catch {
        if (isMounted) setPlatformSummary(null);
      }
    };

    loadPublicSummary();
    return () => { isMounted = false; };
  }, []);

  async function runSilverCalc(form = silverForm) {
    setCalcLoading(true);
    try {
      const { data } = await calculatorAPI.panel(form);
      setSilverResult(data.data);
    } catch { /* silent fail on landing page */ }
    finally { setCalcLoading(false); }
  }

  const summaryTotals = platformSummary?.totals || {};
  const summaryAI = platformSummary?.ai || {};
  const summaryV2 = platformSummary?.v2 || {};
  const aiDefinitionsCount = Number(summaryAI?.active_agent_definitions || 0);
  const aiFeedbackCount = Number(summaryAI?.design_feedback_generated_count || 0);

  const formatWithThreshold = (
    value: number | undefined,
    threshold: number,
    formatter: (val: number) => string,
    placeholder: string
  ) => {
    const safe = Number(value || 0);
    return safe >= threshold ? formatter(safe) : placeholder;
  };

  const heroStats = [
    {
      value: formatWithThreshold(summaryTotals?.simulation_runs, 50, (v) => `${v.toLocaleString()}+`, 'Scaling Fast'),
      label: 'Simulation Runs',
    },
    {
      value: formatWithThreshold(aiDefinitionsCount, 3, (v) => `${v}`, 'Multi-Agent'),
      label: 'AI Agents Active',
    },
    {
      value: summaryAI?.provider_ready ? 'Live' : 'Standby',
      label: 'AI Provider Readiness',
    },
    {
      value: formatWithThreshold(summaryV2?.serialized_assets, 20, (v) => `${v.toLocaleString()}+`, 'Serial-First'),
      label: 'V2 Serialized Assets',
    },
  ];

  const impactStats = [
    {
      label: 'Projects Registered',
      value: formatWithThreshold(summaryTotals?.projects, 25, (v) => v.toLocaleString(), 'Growing Portfolio'),
    },
    {
      label: 'Recovered / Decommissioned Projects',
      value: formatWithThreshold(summaryTotals?.recovered_projects, 10, (v) => v.toLocaleString(), 'Lifecycle Active'),
    },
    {
      label: 'V2 Escrow Decisions',
      value: formatWithThreshold(summaryV2?.escrow_decisions, 10, (v) => v.toLocaleString(), 'Pilot In Progress'),
    },
    {
      label: 'AI Design Feedback Generated',
      value: formatWithThreshold(aiFeedbackCount, 20, (v) => `${v.toLocaleString()}+`, 'AI Advisor Live'),
    },
  ];

  return (
    <>
      <Head>
        <title>SolNuv — Solar Engineering, Compliance &amp; Lifecycle Intelligence</title>
        <meta name="description" content="SolNuv helps solar teams design and evaluate systems, manage project evidence, support compliance workflows, and track lifecycle outcomes in one secure workspace." />
        <meta name="keywords" content="solar design software, solar BESS sizing tool, solar engineering platform, NESREA EPR workflow, solar financial modelling, PV simulation, load profile analysis, tariff analysis, solar project management, lifecycle tracking" />
        <meta property="og:title" content="SolNuv — Solar Engineering &amp; Lifecycle Intelligence" />
        <meta property="og:description" content="A unified platform for solar project design, financial scenario modelling, compliance support, and lifecycle traceability." />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="SolNuv — Solar Engineering &amp; Lifecycle Intelligence" />
        <meta name="twitter:description" content="Design and evaluate systems, run financial scenarios, support compliance workflows, and track assets across the lifecycle." />
        <link rel="canonical" href="https://solnuv.com" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="font-body relative">
        <MotionSection className="marketing-section-dark marketing-section-animated rounded-3xl overflow-hidden mb-8" id="top">
          <MotionStagger className="grid lg:grid-cols-2 gap-8 items-end">
            <MotionItem>
              <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-widest bg-white/10 text-emerald-200">
                End-to-end solar intelligence platform
              </span>
              <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-bold leading-tight mt-4">
                Plan, Track, & Recover
                <br />
                Solar Operations and Equipment.
              </h1>
              <p className="text-base md:text-lg text-white/75 leading-relaxed mt-5 max-w-2xl">
                Run design workflows, financial scenario analysis, lifecycle tracking, and compliance-ready reporting from one connected environment.
              </p>
              <div className="marketing-cta-row">
                <Link href="/register" className="btn-amber inline-flex items-center gap-2">
                  Create account <RiArrowRightLine />
                </Link>
                <Link href="/contact" className="btn-outline border-white/30 text-white hover:bg-white/10">
                  Partner with SolNuv
                </Link>
              </div>
            </MotionItem>
            <MotionStagger className="grid grid-cols-2 gap-3 sm:gap-4" delay={0.08}>
              {heroStats.map((s) => (
                <MotionItem key={s.label} className="rounded-2xl border border-white/15 bg-white/5 p-4 reveal-lift">
                  <p className="font-display text-2xl font-bold text-amber-300">{s.value}</p>
                  <p className="text-xs text-white/65 mt-1">{s.label}</p>
                </MotionItem>
              ))}
            </MotionStagger>
          </MotionStagger>
        </MotionSection>

        {/* PARTNERS / ECOSYSTEM — hidden until signed partnership agreements are in place */}
        {false && <section className="py-10 bg-white border-b border-slate-100 overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 mb-5 text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Ecosystem Partners &amp; Supported Brands</p>
          </div>
          <div className="relative overflow-hidden mb-3">
            <div className="flex gap-3 w-max animate-partner-scroll hover:[animation-play-state:paused]">
              {[...PARTNERS_ROW1, ...PARTNERS_ROW1].map((p, i) => (
                <div key={i} className={`flex-shrink-0 flex items-center gap-2.5 px-4 py-2.5 rounded-xl border text-sm font-semibold whitespace-nowrap ${p.color}`}>
                  <span>{p.name}</span>
                  <span className="text-xs font-normal opacity-60">{p.tag}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="relative overflow-hidden">
            <div className="flex gap-3 w-max animate-partner-scroll-reverse hover:[animation-play-state:paused]">
              {[...PARTNERS_ROW2, ...PARTNERS_ROW2].map((p, i) => (
                <div key={i} className={`flex-shrink-0 flex items-center gap-2.5 px-4 py-2.5 rounded-xl border text-sm font-semibold whitespace-nowrap ${p.color}`}>
                  <span>{p.name}</span>
                  <span className="text-xs font-normal opacity-60">{p.tag}</span>
                </div>
              ))}
            </div>
          </div>
        </section>}

        <MotionSection className="marketing-section marketing-section-animated">
          <span className="marketing-kicker">Portfolio Signals</span>
          <h2 className="marketing-headline">Proof of operational momentum</h2>
          <MotionStagger className="mt-6 grid sm:grid-cols-2 lg:grid-cols-4 gap-4" delay={0.05}>
            {impactStats.map(s => (
              <MotionItem key={s.label} className="marketing-proof-card reveal-lift">
                <p className="font-display font-bold text-2xl text-forest-900">{s.value}</p>
                <p className="text-xs text-slate-500 font-medium mt-1">{s.label}</p>
              </MotionItem>
            ))}
          </MotionStagger>
        </MotionSection>

        {/* HOW IT WORKS */}
        <MotionSection id="how-it-works" className="marketing-section marketing-section-animated">
          <span className="marketing-kicker">How It Works</span>
          <h2 className="marketing-headline">From setup to lifecycle governance</h2>
          <p className="marketing-subcopy">
            SolNuv structures project operations into a clear sequence so technical work, partner communication, and compliance evidence remain synchronised.
          </p>
          <MotionStagger className="marketing-card-grid" delay={0.03}>
              {[
                { step: '01', icon: RiShieldCheckLine, title: 'Set roles and access boundaries', desc: 'Configure clear permissions for installers, managers, analysts, partners, and reviewers so every activity is attributable and auditable.' },
                { step: '02', icon: RiFlashlightLine, title: 'Build and compare system options', desc: 'Create solar and storage configurations, adjust assumptions, and compare alternatives before finalising project decisions.' },
                { step: '03', icon: RiLineChartLine, title: 'Model long-horizon financial outcomes', desc: 'Run scenario-based projections across tariffs, demand profiles, and cost assumptions to support planning and investment conversations.' },
                { step: '04', icon: RiSunLine, title: 'Register assets for traceability', desc: 'Capture equipment records and project identifiers early so lifecycle evidence remains organised from commissioning through end-of-life.' },
                { step: '05', icon: RiMapPinLine, title: 'Track operational and degradation context', desc: 'Use location-aware and usage-aware signals to improve maintenance planning, replacement decisions, and performance reviews.' },
                { step: '06', icon: RiRobotLine, title: 'Scale productivity with AI assistants', desc: 'Use guided assistants to speed up drafts, validation checks, and report preparation while keeping humans in control of final decisions.' },
                { step: '07', icon: RiFileTextLine, title: 'Manage evidence and approval workflows', desc: 'Record milestone evidence, support partner reviews, and maintain decision logs for structured execution and handover.' },
                { step: '08', icon: RiRecycleLine, title: 'Support lifecycle compliance and recovery', desc: 'Prepare compliance-facing reports and evaluate end-of-life routes with clearer visibility into potential recovery pathways.' },
              ].map((item, i) => (
                <MotionItem key={i} className="card-hover relative z-10 bg-white reveal-lift">
                    <div className="flex items-center gap-3 mb-4">
                      <span className="text-xs font-bold text-slate-400">{item.step}</span>
                      <div className="w-10 h-10 bg-forest-900 rounded-xl flex items-center justify-center">
                        <item.icon className="text-amber-400 text-lg" />
                      </div>
                    </div>
                    <h3 className="font-semibold text-forest-900 mb-2">{item.title}</h3>
                    <p className="text-sm text-slate-500 leading-relaxed">{item.desc}</p>
                </MotionItem>
              ))}
            </MotionStagger>
        </MotionSection>

        {/* WHY IT MATTERS */}
        <MotionSection id="impact" className="marketing-section-dark marketing-section-animated">
            <MotionStagger className="grid lg:grid-cols-2 gap-16 items-center">
              <MotionItem>
                <span className="text-xs font-semibold uppercase tracking-widest text-emerald-400">Why This Matters</span>
                <h2 className="font-display text-4xl font-bold mt-3 mb-6 leading-tight">
                  High-growth solar markets need<br />
                  <span className="text-amber-400">operational discipline, not more tools.</span>
                </h2>
                <p className="text-white/70 leading-relaxed mb-6">
                  Teams often work across disconnected spreadsheets, messaging apps, and isolated tools. That fragmentation slows delivery, weakens audit trails, and creates risk during financing, compliance, and partner reporting.
                </p>
                <p className="text-white/70 leading-relaxed mb-8">
                  SolNuv unifies technical planning, financial communication, and lifecycle documentation so teams can execute with greater consistency, credibility, and speed.
                </p>
                <p className="text-emerald-300 font-semibold leading-relaxed">
                  Built for serious solar operators who need dependable workflows across projects, portfolios, and partnerships.
                </p>
              </MotionItem>
              <MotionStagger className="grid grid-cols-2 gap-4" delay={0.1}>
                {[
                  { icon: RiFlashlightLine, color: 'bg-emerald-500/20 border-emerald-500/30', title: 'Decision-ready system planning', desc: 'Move from concept to structured designs with assumptions, comparisons, and outputs your internal and external stakeholders can review.' },
                  { icon: RiGlobalLine, color: 'bg-amber-500/20 border-amber-500/30', title: 'Market-aware financial communication', desc: 'Frame project economics with tariff-aware and demand-aware scenarios that are easier to explain to clients, financiers, and management teams.' },
                  { icon: RiShieldCheckLine, color: 'bg-emerald-500/20 border-emerald-500/30', title: 'Compliance support by design', desc: 'Generate cleaner records and reports to support environmental and regulatory workflows without exposing proprietary internal methods.' },
                  { icon: RiBriefcaseLine, color: 'bg-amber-500/20 border-amber-500/30', title: 'Lifecycle visibility', desc: 'Maintain asset continuity from deployment to end-of-life decisions so reporting and handovers remain accurate over time.' },
                ].map((card, i) => (
                  <MotionItem key={i} className={`rounded-2xl p-5 border ${card.color} reveal-lift`}>
                    <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center mb-3">
                      <card.icon className="text-white text-lg" />
                    </div>
                    <h4 className="font-semibold text-white text-sm mb-2">{card.title}</h4>
                    <p className="text-white/60 text-xs leading-relaxed">{card.desc}</p>
                  </MotionItem>
                ))}
              </MotionStagger>
            </MotionStagger>
        </MotionSection>

        {/* LIVE CALCULATOR */}
        <MotionSection id="calculator" className="marketing-section marketing-section-animated">
            <div className="text-center mb-10">
              <span className="text-xs font-semibold uppercase tracking-widest text-emerald-600">Try It Now</span>
              <h2 className="section-title mb-4 mt-2">See What Your Panels Are Worth</h2>
              <p className="text-slate-500">No account needed. Run a sample estimate to see lifecycle value signals for panel assets.</p>
            </div>
            <div className="bg-white rounded-3xl shadow-lg overflow-hidden">
              <div className="flex border-b border-slate-100">
                {[
                  { id: 'panel',   label: '☀️ Panel Value',      sub: 'Silver + Second-Life' },
                  { id: 'battery', label: '🔋 Battery Value',     sub: 'Sign in to calculate' },
                  { id: 'degrade', label: '📅 Decommission Date', sub: 'Sign in to calculate' },
                ].map(tab => (
                  <button key={tab.id} onClick={() => setCalcTab(tab.id)}
                    className={`flex-1 py-4 flex flex-col items-center transition-all ${calcTab === tab.id ? 'bg-forest-900 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>
                    <span className="text-sm font-semibold">{tab.label}</span>
                    <span className={`text-xs mt-0.5 ${calcTab === tab.id ? 'text-white/60' : 'text-slate-400'}`}>{tab.sub}</span>
                  </button>
                ))}
              </div>

              <div className="p-6 md:p-10">
                {calcTab === 'panel' && (
                  <div className="grid md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="label">Panel Wattage (W)</label>
                          <input type="number" className="input" value={silverForm.size_watts} min="50" max="800"
                            onChange={e => setSilverForm(f => ({ ...f, size_watts: Number(e.target.value) }))} />
                        </div>
                        <div>
                          <label className="label">Number of Panels</label>
                          <input type="number" className="input" value={silverForm.quantity} min="1"
                            onChange={e => setSilverForm(f => ({ ...f, quantity: Number(e.target.value) }))} />
                        </div>
                      </div>
                      <div>
                        <label className="label">Installation Date</label>
                        <input type="date" className="input" value={silverForm.installation_date}
                          onChange={e => setSilverForm(f => ({ ...f, installation_date: e.target.value }))} />
                        <p className="text-xs text-slate-400 mt-1">Older panels had more silver — date affects accuracy.</p>
                      </div>
                      <div>
                        <label className="label">Climate Zone</label>
                        <select className="input" value={silverForm.climate_zone}
                          onChange={e => setSilverForm(f => ({ ...f, climate_zone: e.target.value }))}>
                          {CLIMATE_ZONES.map(z => <option key={z.value} value={z.value}>{z.label}</option>)}
                        </select>
                      </div>
                      <button onClick={() => runSilverCalc()} disabled={calcLoading} className="btn-primary w-full">
                        {calcLoading ? 'Calculating...' : 'Calculate Panel Value →'}
                      </button>
                    </div>
                    <div>
                      {silverResult ? (
                        <div className="space-y-4">
                          <div className="bg-slate-50 rounded-2xl p-4">
                            <div className="flex justify-between items-end mb-2">
                              <p className="text-sm font-medium text-slate-600">Panel Health</p>
                              <p className="font-display font-bold text-2xl text-forest-900">
                                {silverResult.panel_health?.soh_pct ?? Math.round((silverResult.panel_health?.soh || 0.85) * 100)}%
                              </p>
                            </div>
                            <div className="w-full bg-slate-200 rounded-full h-3">
                              <div className="h-3 bg-emerald-500 rounded-full"
                                style={{ width: `${silverResult.panel_health?.soh_pct ?? 85}%` }} />
                            </div>
                            <p className="text-xs text-slate-400 mt-2">
                              Each {silverResult.original_watts}W panel now produces ~<strong>{silverResult.panel_health?.remaining_watts}W</strong> tested output
                            </p>
                          </div>
                          {silverResult.comparison?.recommendation && (
                            <div className={`rounded-xl p-3 text-sm ${silverResult.comparison.recommendation.route === 'second_life' ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-amber-50 border border-amber-200 text-amber-800'}`}>
                              <p className="font-semibold mb-0.5">
                                {silverResult.comparison.recommendation.route === 'second_life' ? '✅ Best Route: Refurbish for Second-Life' : '⚙️ Best Route: Silver Recycling'}
                              </p>
                              <p className="text-xs opacity-80">{silverResult.comparison.recommendation.reason}</p>
                            </div>
                          )}
                          <div className="grid grid-cols-2 gap-3">
                            <div className="bg-slate-100 rounded-xl p-4">
                              <p className="text-xs font-semibold text-slate-400 mb-1">SILVER RECYCLING</p>
                              <p className="font-display font-bold text-lg text-slate-700">
                                ₦{(silverResult.silver_recycling?.installer_receives_ngn || 0).toLocaleString('en-NG')}
                              </p>
                              <p className="text-xs text-slate-400 mt-1">{silverResult.silver_recycling?.total_silver_grams?.toFixed(3)}g total silver</p>
                            </div>
                            <div className={`rounded-xl p-4 ${silverResult.second_life_refurbishment?.is_viable ? 'bg-emerald-600 text-white' : 'bg-slate-100'}`}>
                              <p className={`text-xs font-semibold mb-1 ${silverResult.second_life_refurbishment?.is_viable ? 'text-white/70' : 'text-slate-400'}`}>SECOND-LIFE REFURB</p>
                              {silverResult.second_life_refurbishment?.is_viable ? (
                                <>
                                  <p className="font-display font-bold text-lg text-white">
                                    ₦{(silverResult.second_life_refurbishment?.installer_receives_ngn || 0).toLocaleString('en-NG')}
                                  </p>
                                  <p className="text-xs text-white/70 mt-1">at {silverResult.panel_health?.remaining_watts}W tested rating</p>
                                </>
                              ) : (
                                <p className="text-sm text-slate-400 mt-1">SOH below 70% threshold</p>
                              )}
                            </div>
                          </div>
                          {silverResult.comparison?.refurb_vs_silver_multiple > 1 && (
                            <div className="bg-forest-900 rounded-xl p-4 text-center text-white">
                              <p className="font-display font-bold text-3xl text-amber-400">{silverResult.comparison.refurb_vs_silver_multiple}×</p>
                              <p className="text-sm text-white/70 mt-1">more value from refurbishment vs. dismantling for silver</p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="h-full flex items-center justify-center text-slate-300 min-h-[200px]">
                          <p className="text-sm">Results will appear here</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {(calcTab === 'battery' || calcTab === 'degrade') && (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="w-16 h-16 bg-forest-900 rounded-2xl flex items-center justify-center mb-4">
                      <span className="text-3xl">{calcTab === 'battery' ? '🔋' : '📅'}</span>
                    </div>
                    <h3 className="font-display font-bold text-xl text-forest-900 mb-2">
                      {calcTab === 'battery' ? 'Battery Recovery Calculator' : 'West African Decommission Predictor'}
                    </h3>
                    <p className="text-slate-500 text-sm max-w-md mb-2">
                      {calcTab === 'battery'
                        ? 'Calculate recycling value and second-life potential for lead-acid and lithium batteries — including chemistry-specific material recovery and State of Health analysis.'
                        : 'Get a climate-adjusted decommission date using our algorithm covering all 36 Nigerian states — accounting for coastal humidity, Sahel heat, and inverter surge damage.'}
                    </p>
                    <p className="text-slate-400 text-xs mb-6">An account is required — takes 2 minutes to set up.</p>
                    <div className="flex gap-3">
                      <Link href="/register" className="btn-primary flex items-center gap-2">Create Account →</Link>
                      <Link href="/login" className="btn-outline">Sign In</Link>
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-forest-900 px-8 py-4 flex items-center justify-between">
                <p className="text-white/70 text-sm">Ready to track your full fleet automatically?</p>
                <Link href="/register" className="btn-amber text-sm px-4 py-2 rounded-xl">Create Account →</Link>
              </div>
            </div>
        </MotionSection>

        {/* FEATURES */}
        <MotionSection className="marketing-section marketing-section-animated" id="platform">
            <div className="text-center mb-14">
              <span className="text-xs font-semibold uppercase tracking-widest text-emerald-600">Platform Capabilities</span>
              <h2 className="section-title mb-4 mt-2">Built for technical teams and commercial outcomes</h2>
              <p className="text-slate-500 max-w-xl mx-auto">Core capabilities designed to improve delivery quality, stakeholder confidence, and operational consistency.</p>
            </div>
            <MotionStagger className="grid md:grid-cols-3 gap-6" delay={0.03}>
              {[
                { icon: RiBatteryChargeLine, color: 'bg-forest-900', title: 'Solar + storage design workflows', desc: 'Create and refine technical configurations with structured inputs, comparison views, and consistent output formats.' },
                { icon: RiLineChartLine, color: 'bg-emerald-500', title: 'Long-range scenario modelling', desc: 'Evaluate project performance across planning horizons with transparent assumptions and adjustable cost/tariff factors.' },
                { icon: RiDraftLine, color: 'bg-forest-900', title: 'Share-ready reporting', desc: 'Generate clear report outputs for internal alignment, customer communication, partner reviews, and approval processes.' },
                { icon: RiMapPinLine, color: 'bg-amber-500', title: 'Location-aware lifecycle signals', desc: 'Use site context and operating patterns to inform maintenance timing and lifecycle planning decisions.' },
                { icon: RiLeafLine, color: 'bg-emerald-500', title: 'Material recovery insights', desc: 'Estimate end-of-life pathways and compare route options to support commercially and environmentally responsible decisions.' },
                { icon: RiBarChartLine, color: 'bg-forest-900', title: 'Load and usage analysis', desc: 'Work with measured or estimated demand profiles to improve system sizing logic and planning confidence.' },
                { icon: RiShieldCheckLine, color: 'bg-amber-500', title: 'Compliance workflow support', desc: 'Prepare evidence-backed records and structured documents to support external compliance and internal governance needs.' },
                { icon: RiCalculatorLine, color: 'bg-emerald-500', title: 'Tariff and return analysis', desc: 'Model commercial outcomes across energy pricing structures with outputs suitable for business decision-making.' },
                { icon: RiRobotLine, color: 'bg-forest-900', title: 'AI assistants for execution', desc: 'Use built-in assistants to accelerate drafting, interpretation, and workflow support while keeping expert oversight in place.' },
                { icon: RiTrophyLine, color: 'bg-amber-500', title: 'Performance visibility tools', desc: 'Monitor portfolio and team performance indicators with controls for public or private visibility by account settings.' },
                { icon: RiTeamLine, color: 'bg-emerald-500', title: 'Organisation and team controls', desc: 'Manage workspace members, responsibilities, and workflow accountability as your projects and partnerships expand.' },
                { icon: RiRecycleLine, color: 'bg-forest-900', title: 'Asset health and lifecycle records', desc: 'Maintain operational histories and condition snapshots to support quality assurance, warranty conversations, and handovers.' },
              ].map((f, i) => (
                <MotionItem key={i} className="card-hover reveal-lift">
                  <div className={`w-11 h-11 ${f.color} rounded-xl flex items-center justify-center mb-4`}>
                    <f.icon className={`text-xl ${f.color === 'bg-amber-500' ? 'text-forest-900' : 'text-white'}`} />
                  </div>
                  <h3 className="font-semibold text-forest-900 mb-2">{f.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
                </MotionItem>
              ))}
            </MotionStagger>
        </MotionSection>

        {/* WHO IT'S FOR */}
        <MotionSection className="marketing-section marketing-section-animated">
            <div className="text-center mb-12">
              <span className="text-xs font-semibold uppercase tracking-widest text-emerald-600">Who Uses SolNuv</span>
              <h2 className="section-title mb-4 mt-2">Built for modern solar stakeholders</h2>
            </div>
            <MotionStagger className="grid md:grid-cols-4 gap-6" delay={0.03}>
              {[
                {
                  emoji: '🔧',
                  title: 'Solar Design Engineers',
                  points: ['Size solar+BESS systems with satellite irradiance data', 'Model 25-year financials under real tariffs', 'Generate professional design reports in minutes', 'Let AI auto-optimise system configuration'],
                },
                {
                  emoji: '⚡',
                  title: 'Solar Installers & EPCs',
                  points: ['Log projects in under 2 minutes — works offline', 'Get climate-specific decommission timelines', 'Close deals with bankable ROI proposals', 'Stay NESREA-compliant automatically'],
                },
                {
                  emoji: '🏢',
                  title: 'Asset Managers & Corporates',
                  points: ['Track your entire panel + battery fleet', 'Monitor degradation across all sites', 'Forecast end-of-life material recovery value', 'Exportable audit trails for due diligence'],
                },
                {
                  emoji: '🌍',
                  title: 'Investors & Development Finance',
                  points: ['Validate project designs with independent modelling', 'Evidence for ESG and green finance reporting', 'Lifecycle data for circular economy mandates', 'First-mover access to Africa\'s e-waste recovery market'],
                },
              ].map((persona, i) => (
                <MotionItem key={i} className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm reveal-lift">
                  <div className="text-3xl mb-4">{persona.emoji}</div>
                  <h3 className="font-display font-bold text-forest-900 text-lg mb-4">{persona.title}</h3>
                  <ul className="space-y-2.5">
                    {persona.points.map((pt, j) => (
                      <li key={j} className="flex items-start gap-2 text-sm text-slate-600">
                        <RiCheckLine className="text-emerald-500 flex-shrink-0 mt-0.5" />
                        {pt}
                      </li>
                    ))}
                  </ul>
                </MotionItem>
              ))}
            </MotionStagger>
        </MotionSection>

        {/* PLANS */}
        <MotionSection id="plans" className="marketing-section marketing-section-animated">
            <div className="text-center mb-14">
              <span className="text-xs font-semibold uppercase tracking-widest text-emerald-600">Pricing</span>
              <h2 className="section-title mb-4 mt-2">Simple, Naira-First Pricing</h2>
              <p className="text-slate-500">No FX surprises. All prices in Naira. Start with our Basic plan and scale as you grow. Annual billing saves 10%.</p>
            </div>
            <MotionStagger className="grid md:grid-cols-4 gap-6 items-start" delay={0.03}>
              {[
                { name: 'Basic', price: '₦15,000', period: '/mo', cta: 'Get Basic', href: '/register', features: ['Unlimited project logging', 'Solar+BESS system design', 'Satellite irradiance data access', 'Decommission predictions', '54 calculator uses/month', 'Basic financial modelling', 'SolNuv AI Assistant', '1 user / 1 device'] },
                { name: 'Pro', price: '₦40,000', period: '/mo', cta: 'Start Pro', href: '/register?plan=pro', popular: true, features: ['Everything in Basic', 'Full 25-year financial simulations', 'Professional PDF & Excel reports', 'Public report sharing links', 'NESREA EPR Reports', 'Load profile analysis (CSV/manual/synthetic)', 'AI Design Engineer agent', 'Team access (5 users)'] },
                { name: 'Elite', price: '₦100,000', period: '/mo', cta: 'Go Elite', href: '/register?plan=elite', features: ['Everything in Pro', 'Auto-send to NESREA', 'System Schematic Diagram (wiring & single-line)', 'Advanced tariff modelling (TOU, multi-band, regional)', '4 AI Agents (Project Manager, Advisor, Compliance, Reports)', 'Auto-optimised system sizing', 'Team access (15 users)', 'Priority support + onboarding', 'Featured installer badge'] },
                { name: 'Enterprise', price: '₦250,000+', period: '/mo', cta: 'Contact Us', href: '/contact', features: ['Everything in Elite', 'All AI Agents + priority & async tasks', 'Custom API integrations', 'Bulk project design import', 'White-label design reports', 'Team access (50 users)', 'Dedicated account manager', 'Quarterly advisory sessions'] },
              ].map((plan, i) => (
                <MotionItem key={i} className={`rounded-2xl overflow-hidden reveal-lift ${plan.popular ? 'ring-2 ring-forest-900 shadow-xl' : 'border border-slate-200'}`}>
                  {plan.popular && <div className="bg-forest-900 text-center py-1.5 text-xs font-bold text-amber-400">MOST POPULAR</div>}
                  <div className="p-6 bg-white">
                    <h3 className="font-display font-bold text-forest-900 text-lg mb-2">{plan.name}</h3>
                    <div className="flex items-end gap-1 mb-5">
                      <span className="font-display font-bold text-3xl text-forest-900">{plan.price}</span>
                      <span className="text-slate-400 text-sm pb-1">{plan.period}</span>
                    </div>
                    <ul className="space-y-2.5 mb-6">
                      {plan.features.map((f, j) => (
                        <li key={j} className="flex items-start gap-2 text-sm text-slate-600">
                          <RiCheckLine className="text-emerald-500 flex-shrink-0 mt-0.5" />
                          {f}
                        </li>
                      ))}
                    </ul>
                    <Link href={plan.href} className={`block text-center py-3 rounded-xl font-semibold text-sm transition-all ${plan.popular ? 'btn-primary' : 'btn-outline'}`}>
                      {plan.cta}
                    </Link>
                  </div>
                </MotionItem>
              ))}
            </MotionStagger>
        </MotionSection>

        {/* CTA */}
        <MotionSection className="marketing-section-dark marketing-section-animated text-center">
            <span className="text-xs font-semibold uppercase tracking-widest text-emerald-400 mb-3 block">Start in minutes</span>
            <h2 className="font-display font-bold text-4xl text-white mb-4 leading-tight">Build higher-confidence solar workflows<br />with one connected platform</h2>
            <p className="text-white/70 mb-8 max-w-xl mx-auto">Support technical decisions, partner communication, and lifecycle accountability with tools designed for modern solar operations.</p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link href="/register" className="btn-amber inline-flex items-center gap-2 text-base px-8 py-4 rounded-2xl">
                Create Your Account <RiArrowRightLine />
              </Link>
              <Link href="/contact" className="inline-flex items-center gap-2 border border-white/30 text-white px-6 py-4 rounded-2xl text-sm font-semibold hover:bg-white/10 transition-all">
                Partner With Us
              </Link>
            </div>
            <p className="text-white/40 text-xs mt-6">No credit card required · Structured onboarding · Plan controls for teams and partners</p>
        </MotionSection>
      </div>
    </>
  );
}

Home.getLayout = getPublicLayout;
