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
import { calculatorAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useRouter } from 'next/router';

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

  async function runSilverCalc(form = silverForm) {
    setCalcLoading(true);
    try {
      const { data } = await calculatorAPI.panel(form);
      setSilverResult(data.data);
    } catch { /* silent fail on landing page */ }
    finally { setCalcLoading(false); }
  }

  return (
    <>
      <Head>
        <title>SolNuv — Africa&apos;s Solar Engineering &amp; Lifecycle Intelligence Platform</title>
        <meta name="description" content="Design solar+battery systems, model 25-year financials, automate NESREA EPR compliance, and manage the full lifecycle of every installation — powered by Satellite climate data, AI agents, and built for Africa's energy market." />
        <meta name="keywords" content="solar design software Africa, solar BESS sizing tool, solar engineering Nigeria, NESREA EPR compliance, solar battery storage design, solar financial modelling Africa, PV simulation, load profile analysis, tariff analysis Nigeria, solar project management, solar panel recycling, West African solar, solar lifecycle tracking" />
        <meta property="og:title" content="SolNuv — Design, Model, Track & Comply. Africa's Solar Engineering Platform." />
        <meta property="og:description" content="The only platform that takes you from solar+BESS system design to 25-year financial modelling to NESREA compliance — all in one place. Built for Africa's energy professionals." />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="SolNuv — Africa&apos;s Complete Solar Engineering Platform" />
        <meta name="twitter:description" content="Design solar+BESS systems. Model financials. Automate compliance. Track lifecycles. One platform, built for Africa." />
        <link rel="canonical" href="https://solnuv.com" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="min-h-screen bg-white/60 font-body relative">
        {/* NAV */}
        <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-100/80">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-forest-900 rounded-lg flex items-center justify-center">
                <RiSunLine className="text-amber-400 text-lg" />
              </div>
              <span className="font-display font-bold text-forest-900 text-lg">SolNuv</span>
            </Link>
            <div className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
              <Link href="#how-it-works" className="hover:text-forest-900 transition-colors">How It Works</Link>
              <Link href="#impact" className="hover:text-forest-900 transition-colors">Why SolNuv</Link>
              <Link href="#calculator" className="hover:text-forest-900 transition-colors">Calculator</Link>
              <Link href="#plans" className="hover:text-forest-900 transition-colors">Plans</Link>
              <Link href="/blog" className="hover:text-forest-900 transition-colors">Blog</Link>
              <Link href="/contact" className="hover:text-forest-900 transition-colors">Contact</Link>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/login" className="text-sm font-medium text-slate-600 hover:text-forest-900 transition-colors hidden sm:block">Sign In</Link>
              <Link href="/register" className="btn-primary text-sm px-4 py-2 rounded-xl">Get Started</Link>
            </div>
          </div>
        </nav>

        {/* HERO */}
        <section className="relative bg-forest-900 text-white overflow-hidden">
          <div className="absolute inset-0 bg-grid-forest opacity-30" />
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl" />
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-32">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 mb-6">
                <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                <span className="text-sm font-medium text-white/90">Africa&apos;s AI-Powered Solar Engineering Platform</span>
              </div>
              <h1 className="font-display text-4xl md:text-6xl font-bold leading-tight mb-6">
                Design. Model. Track.<br />
                <span className="text-amber-400">Comply. All in One.</span>
              </h1>
              <p className="text-lg text-white/75 mb-8 leading-relaxed max-w-2xl">
                Size solar + battery storage systems using satellite irradiance data. Model 25-year financials under real African tariffs. Track every installation from commissioning to end-of-life. Auto-generate compliance reports. Let AI be your solar companion.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link href="/register" className="btn-amber inline-flex items-center gap-2">
                  Start Building <RiArrowRightLine />
                </Link>
                <Link href="#how-it-works" className="inline-flex items-center gap-2 border border-white/30 text-white px-6 py-3 rounded-xl text-sm font-semibold hover:bg-white/10 transition-all">
                  See How It Works <RiArrowDownLine />
                </Link>
              </div>
              <div className="mt-10 flex flex-wrap gap-6 text-sm text-white/60">
                <span className="flex items-center gap-2"><RiCheckLine className="text-emerald-400" /> Solar + BESS Design Engine</span>
                <span className="flex items-center gap-2"><RiCheckLine className="text-emerald-400" /> Satellite Climate Data</span>
                <span className="flex items-center gap-2"><RiCheckLine className="text-emerald-400" /> EPR Compliant</span>
                <span className="flex items-center gap-2"><RiCheckLine className="text-emerald-400" /> AI-Powered Helpers</span>
                <span className="flex items-center gap-2"><RiCheckLine className="text-emerald-400" /> Easy to Start</span>
              </div>
            </div>
          </div>
          <div className="relative border-t border-white/10">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 grid grid-cols-2 md:grid-cols-4 gap-6">
              {[
                { value: '25 yrs', label: 'Financial Modelling Horizon' },
                { value: '5', label: 'AI-Powered Helpers' },
                { value: '₦2.4T+', label: 'Nigerian Solar Market Value' },
                { value: '36', label: 'Nigerian States — Degradation Coverage' },
              ].map(s => (
                <div key={s.label}>
                  <p className="font-display font-bold text-2xl text-amber-400">{s.value}</p>
                  <p className="text-xs text-white/50 font-medium mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

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

        {/* STATS BAR */}
        <div className="bg-amber-500">
          <div className="max-w-7xl mx-auto px-4 py-5 flex flex-wrap justify-center gap-8 md:gap-16">
            {[
              { label: 'Avg Grid Savings With Solar+BESS', value: '40-70%' },
              { label: 'Design-to-Report Time', value: '<15 min' },
              { label: 'Climate Data Source', value: 'Satellite' },
              { label: 'Panel Health Lost to Climate/yr', value: '0.85%' },
            ].map(s => (
              <div key={s.label} className="text-center">
                <p className="font-display font-bold text-2xl text-forest-900">{s.value}</p>
                <p className="text-xs text-forest-900/70 font-medium mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* HOW IT WORKS */}
        <section id="how-it-works" className="py-20 bg-white/80 backdrop-blur-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-14">
              <span className="text-xs font-semibold uppercase tracking-widest text-emerald-600">How SolNuv Works</span>
              <h2 className="section-title mb-4 mt-2">From System Design to Lifecycle Recovery</h2>
              <p className="text-slate-500 max-w-xl mx-auto">Six capabilities that cover the entire solar journey — design, finance, install, track, comply, and recover — built for Africa&apos;s energy professionals.</p>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {[
                { step: '01', icon: RiFlashlightLine, title: 'Design Solar + BESS Systems', desc: 'Size PV arrays and battery storage using high-resolution satellite irradiance data for your exact site. Auto-optimise or manually configure — from 1 kW rooftop to MW-scale C&I projects.' },
                { step: '02', icon: RiLineChartLine, title: 'Model 12->25-Year Financials', desc: 'Run full techno-economic simulations under real African tariffs — TOU rates, demand charges, multi-band utility structures. See IRR, NPV, payback period, and LCOE instantly.' },
                { step: '03', icon: RiSunLine, title: 'Log & Track Every Project', desc: 'Register installations with panels, batteries, inverters, brand, and GPS coordinates. Works offline for field teams. Track your fleet in one dashboard.' },
                { step: '04', icon: RiMapPinLine, title: 'Predict Degradation by Location', desc: 'Our West African degradation engine calibrates for Lagos coastal humidity, Kano desert heat, SE humidity, and inverter surge damage across all 36 Nigerian states.' },
                { step: '05', icon: RiFileTextLine, title: 'Auto-Generate Compliance Reports', desc: 'Express NESREA EPR reports, Cradle-to-Grave certificates, and professional design reports. PDF and Excel export. Auto-route on Elite and Enterprise plans.' },
                { step: '06', icon: RiRecycleLine, title: 'Recover End-of-Life Value', desc: 'See the real naira value of recoverable silver, lead, and lithium. Compare second-life refurbishment vs. recycling. Turn decommissioning into revenue.' },
              ].map((item, i) => (
                <div key={i} className="card-hover relative z-10">
                    <div className="flex items-center gap-3 mb-4">
                      <span className="text-xs font-bold text-slate-400">{item.step}</span>
                      <div className="w-10 h-10 bg-forest-900 rounded-xl flex items-center justify-center">
                        <item.icon className="text-amber-400 text-lg" />
                      </div>
                    </div>
                    <h3 className="font-semibold text-forest-900 mb-2">{item.title}</h3>
                    <p className="text-sm text-slate-500 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* WHY IT MATTERS */}
        <section id="impact" className="py-20 bg-forest-900 text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <div>
                <span className="text-xs font-semibold uppercase tracking-widest text-emerald-400">Why This Matters</span>
                <h2 className="font-display text-4xl font-bold mt-3 mb-6 leading-tight">
                  Africa&apos;s Solar Boom Needs<br />
                  <span className="text-amber-400">Smarter Infrastructure</span>
                </h2>
                <p className="text-white/70 leading-relaxed mb-6">
                  Sub-Saharan Africa will add over 100 GW of solar capacity by 2035. But most projects are still designed on spreadsheets, sized by guesswork, and tracked on paper. Meanwhile, the first wave of installations is reaching end-of-life — with no formal recovery infrastructure.
                </p>
                <p className="text-white/70 leading-relaxed mb-8">
                  SolNuv replaces fragmented tools and consultants with one platform — from the first system design through 25 years of operation to responsible decommissioning. Design better systems, close more deals, stay compliant, and capture the full lifecycle value of every installation.
                </p>
                <p className="text-emerald-300 font-semibold leading-relaxed">
                  The platform engineered for how solar actually works in Africa — not a Western tool with an African price tag.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { icon: RiFlashlightLine, color: 'bg-emerald-500/20 border-emerald-500/30', title: 'Bankable System Design', desc: 'Size solar+BESS systems with real irradiance data and hourly simulations. Produce professional design reports that land financing and close commercial deals.' },
                  { icon: RiGlobalLine, color: 'bg-amber-500/20 border-amber-500/30', title: 'African Market Intelligence', desc: 'Built-in multi-band tariff structures, regional utility rates, TOU profiles, and climate-specific degradation models. No more adapting European tools for African conditions.' },
                  { icon: RiShieldCheckLine, color: 'bg-emerald-500/20 border-emerald-500/30', title: 'Regulatory Compliance', desc: 'Meet NESREA EPR 2024 mandates with auto-generated Cradle-to-Grave certificates and audit-ready compliance records. One-click PDF reports.' },
                  { icon: RiBriefcaseLine, color: 'bg-amber-500/20 border-amber-500/30', title: 'Full Lifecycle Value', desc: 'Track every asset from commissioning to decommissioning. Recover silver, lead, and lithium value. Second-life refurbishment delivers up to 74× the value of dismantling.' },
                ].map((card, i) => (
                  <div key={i} className={`rounded-2xl p-5 border ${card.color}`}>
                    <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center mb-3">
                      <card.icon className="text-white text-lg" />
                    </div>
                    <h4 className="font-semibold text-white text-sm mb-2">{card.title}</h4>
                    <p className="text-white/60 text-xs leading-relaxed">{card.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* LIVE CALCULATOR */}
        <section id="calculator" className="py-20 bg-slate-50">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-10">
              <span className="text-xs font-semibold uppercase tracking-widest text-emerald-600">Try It Now</span>
              <h2 className="section-title mb-4 mt-2">See What Your Panels Are Worth</h2>
              <p className="text-slate-500">No account needed. Calculate live recovery value from your panel fleet.</p>
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
          </div>
        </section>

        {/* FEATURES */}
        <section className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-14">
              <span className="text-xs font-semibold uppercase tracking-widest text-emerald-600">Platform Capabilities</span>
              <h2 className="section-title mb-4 mt-2">Everything Solar Professionals Need</h2>
              <p className="text-slate-500 max-w-xl mx-auto">From system design and financial modelling to compliance automation and material recovery — one platform replaces a dozen tools.</p>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {[
                { icon: RiBatteryChargeLine, color: 'bg-forest-900', title: 'Solar + BESS Design Engine', desc: 'Size PV arrays and battery storage using hourly satellite irradiance data. Auto-optimise or manually configure for any site in Africa. Supports TOU tariff-aware dispatch.' },
                { icon: RiLineChartLine, color: 'bg-emerald-500', title: '25-Year Financial Modelling', desc: 'Full techno-economic simulation — IRR, NPV, payback period, LCOE, lifetime savings. Model under real African tariff structures including multi-band and regional utility rates.' },
                { icon: RiDraftLine, color: 'bg-forest-900', title: 'Professional Design Reports', desc: 'Generate client-ready PDF and Excel reports with system specs, energy flows, financial projections, and load analysis. Shareable via public link.' },
                { icon: RiMapPinLine, color: 'bg-amber-500', title: 'West African Degradation Engine', desc: 'Algorithms calibrated for all 36 Nigerian states. Lagos coastal humidity, Kano desert heat, and inverter surge damage — all factored into your decommission timeline.' },
                { icon: RiLeafLine, color: 'bg-emerald-500', title: 'Silver & Material Recovery Calculator', desc: 'Translate every panel and battery into recoverable grams of silver, lead, or lithium — plus real naira estimates across recycling and second-life routes.' },
                { icon: RiBarChartLine, color: 'bg-forest-900', title: 'Load Profile Analysis', desc: 'Upload CSV load data, enter manually, or generate synthetic profiles by building type. Understand consumption patterns before you size a system.' },
                { icon: RiShieldCheckLine, color: 'bg-amber-500', title: 'NESREA EPR Compliance Module', desc: 'Auto-generate Cradle-to-Grave certificates and EPR reports under the 2024 Battery Control Regulations. One click. Audit-ready PDF.' },
                { icon: RiCalculatorLine, color: 'bg-emerald-500', title: 'Tariff & ROI Analysis', desc: 'Model savings across all NERC tariff bands, TOU rates, and generator fuel costs. Generate professional payback proposals with PDF export.' },
                { icon: RiRobotLine, color: 'bg-forest-900', title: '5 AI-Powered Agents', desc: 'AI Assistant on every plan. Pro+ unlocks dedicated Design Engineer, Project Manager, Financial Advisor, Compliance Officer, and Report Specialist agents.' },
                { icon: RiTrophyLine, color: 'bg-amber-500', title: 'Live Competitive Leaderboard', desc: 'Rank against other installers by active projects, recovered equipment weight, and environmental impact. Build reputation with eco-conscious clients.' },
                { icon: RiTeamLine, color: 'bg-emerald-500', title: 'Team & Organisation Management', desc: 'Invite Admins and Managers. Track projects per team member. Scale from a one-man-band to a national EPC firm — one dashboard.' },
                { icon: RiRecycleLine, color: 'bg-forest-900', title: 'Battery SoH & Warranty Ledger', desc: 'Track battery health heuristics, detect deep-cycle abuse, and maintain defendable warranty and maintenance records — per unit, per site.' },
              ].map((f, i) => (
                <div key={i} className="card-hover">
                  <div className={`w-11 h-11 ${f.color} rounded-xl flex items-center justify-center mb-4`}>
                    <f.icon className={`text-xl ${f.color === 'bg-amber-500' ? 'text-forest-900' : 'text-white'}`} />
                  </div>
                  <h3 className="font-semibold text-forest-900 mb-2">{f.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* WHO IT'S FOR */}
        <section className="py-16 bg-slate-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <span className="text-xs font-semibold uppercase tracking-widest text-emerald-600">Who Uses SolNuv</span>
              <h2 className="section-title mb-4 mt-2">Built for Africa&apos;s Solar Value Chain</h2>
            </div>
            <div className="grid md:grid-cols-4 gap-6">
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
                <div key={i} className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
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
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* PLANS */}
        <section id="plans" className="py-20 bg-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-14">
              <span className="text-xs font-semibold uppercase tracking-widest text-emerald-600">Pricing</span>
              <h2 className="section-title mb-4 mt-2">Simple, Naira-First Pricing</h2>
              <p className="text-slate-500">No FX surprises. All prices in Naira. Start with our Basic plan and scale as you grow. Annual billing saves 10%.</p>
            </div>
            <div className="grid md:grid-cols-4 gap-6 items-start">
              {[
                { name: 'Basic', price: '₦15,000', period: '/mo', cta: 'Get Basic', href: '/register', features: ['Unlimited project logging', 'Solar+BESS system design', 'Satellite irradiance data access', 'Decommission predictions', '54 calculator uses/month', 'Basic financial modelling', 'SolNuv AI Assistant', '1 user / 1 device'] },
                { name: 'Pro', price: '₦40,000', period: '/mo', cta: 'Start Pro', href: '/register?plan=pro', popular: true, features: ['Everything in Basic', 'Full 25-year financial simulations', 'Professional PDF & Excel reports', 'Public report sharing links', 'NESREA EPR Reports', 'Load profile analysis (CSV/manual/synthetic)', 'AI Design Engineer agent', 'Team access (5 users)'] },
                { name: 'Elite', price: '₦100,000', period: '/mo', cta: 'Go Elite', href: '/register?plan=elite', features: ['Everything in Pro', 'Auto-send to NESREA', 'System Schematic Diagram (wiring & single-line)', 'Advanced tariff modelling (TOU, multi-band, regional)', '4 AI Agents (Project Manager, Advisor, Compliance, Reports)', 'Auto-optimised system sizing', 'Team access (15 users)', 'Priority support + onboarding', 'Featured installer badge'] },
                { name: 'Enterprise', price: '₦250,000+', period: '/mo', cta: 'Contact Us', href: '/contact', features: ['Everything in Elite', 'All AI Agents + priority & async tasks', 'Custom API integrations', 'Bulk project design import', 'White-label design reports', 'Team access (50 users)', 'Dedicated account manager', 'Quarterly advisory sessions'] },
              ].map((plan, i) => (
                <div key={i} className={`rounded-2xl overflow-hidden ${plan.popular ? 'ring-2 ring-forest-900 shadow-xl' : 'border border-slate-200'}`}>
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
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-forest-900 py-20 relative overflow-hidden">
          <div className="absolute inset-0 bg-grid-forest opacity-20" />
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
          <div className="relative max-w-3xl mx-auto px-4 text-center">
            <span className="text-xs font-semibold uppercase tracking-widest text-emerald-400 mb-3 block">Start in minutes</span>
            <h2 className="font-display font-bold text-4xl text-white mb-4 leading-tight">The Platform Africa&apos;s Solar<br />Industry Has Been Missing</h2>
            <p className="text-white/70 mb-8 max-w-xl mx-auto">Join solar professionals across Africa using SolNuv to design better systems, close bigger deals, automate compliance, and capture the full value of every installation.</p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link href="/register" className="btn-amber inline-flex items-center gap-2 text-base px-8 py-4 rounded-2xl">
                Create Your Account <RiArrowRightLine />
              </Link>
              <Link href="/contact" className="inline-flex items-center gap-2 border border-white/30 text-white px-6 py-4 rounded-2xl text-sm font-semibold hover:bg-white/10 transition-all">
                Partner With Us
              </Link>
            </div>
            <p className="text-white/40 text-xs mt-6">No credit card required · Design your first system in under 15 minutes · NESREA-compliant from day one</p>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="bg-forest-950 text-white/60 py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid md:grid-cols-4 gap-8 mb-8">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 bg-amber-400 rounded flex items-center justify-center">
                    <RiSunLine className="text-forest-900 text-sm" />
                  </div>
                  <span className="font-display font-bold text-white text-sm">SolNuv</span>
                </div>
                <p className="text-xs leading-relaxed">Africa&apos;s complete solar engineering platform. Design systems, model financials, track assets, and automate compliance — from one dashboard.</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-3">Platform</p>
                <div className="space-y-2 text-xs">
                  <Link href="/register" className="block hover:text-white transition-colors">Get Started</Link>
                  <Link href="#calculator" className="block hover:text-white transition-colors">Calculator</Link>
                  <Link href="#plans" className="block hover:text-white transition-colors">Pricing</Link>
                  <Link href="#how-it-works" className="block hover:text-white transition-colors">How It Works</Link>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-3">Resources</p>
                <div className="space-y-2 text-xs">
                  <Link href="/blog" className="block hover:text-white transition-colors">Blog</Link>
                  <Link href="/contact" className="block hover:text-white transition-colors">Contact Us</Link>
                  <a href="mailto:partnerships@solnuv.com" className="block hover:text-white transition-colors">Partnerships</a>
                  <a href="mailto:sales@solnuv.com" className="block hover:text-white transition-colors">Enterprise Sales</a>
                  <Link href="/privacy" className="block hover:text-white transition-colors">Privacy Policy</Link>
                  <Link href="/terms" className="block hover:text-white transition-colors">Terms of Service</Link>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-3">Capabilities</p>
                <div className="space-y-2 text-xs">
                  <p className="flex items-center gap-1.5"><RiCheckLine className="text-emerald-500" /> Solar + BESS Design</p>
                  <p className="flex items-center gap-1.5"><RiCheckLine className="text-emerald-500" /> 25-Year Financial Modelling</p>
                  <p className="flex items-center gap-1.5"><RiCheckLine className="text-emerald-500" /> NESREA EPR Compliance</p>
                  <p className="flex items-center gap-1.5"><RiCheckLine className="text-emerald-500" /> Lifecycle & Material Recovery</p>
                  <p className="flex items-center gap-1.5"><RiCheckLine className="text-emerald-500" /> AI-Powered Agents</p>
                </div>
              </div>
            </div>
            <div className="border-t border-white/10 pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
              <p className="text-xs">© {new Date().getFullYear()} SolNuv by Fudo Greentech. Powering Africa&apos;s solar transition.</p>
              <p className="text-xs text-white/30">Powered by Fudo Greentech · Afrocarb</p>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
