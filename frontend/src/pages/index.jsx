import Head from 'next/head';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import {
  RiSunLine, RiLeafLine, RiFileTextLine, RiTrophyLine, RiArrowRightLine,
  RiCheckLine, RiShieldCheckLine, RiMapPinLine, RiFlashlightLine,
  RiBarChartLine, RiCalculatorLine, RiRecycleLine, RiGlobalLine,
  RiTeamLine, RiBriefcaseLine, RiArrowDownLine,
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
  { name: 'Paystack', tag: 'Payments', color: 'text-slate-800 bg-slate-50 border-slate-200' },
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
        <title>SolNuv — Nigeria&apos;s Solar Lifecycle &amp; E-Waste Compliance Platform</title>
        <meta name="description" content="Nigeria's first solar lifecycle intelligence platform. Track installations, predict decommissioning using West African climate data, recover silver and battery value, and auto-generate NESREA EPR compliance reports — all in one platform." />
        <meta name="keywords" content="solar e-waste Nigeria, NESREA EPR compliance, solar panel recycling, silver recovery, solar lifecycle tracking, West African solar" />
        <meta property="og:title" content="SolNuv — Turn Solar E-Waste Into Business Value" />
        <meta property="og:description" content="Solar installers and EPCs across Nigeria use SolNuv to track panel lifecycles, recover material value, and comply with NESREA EPR mandates — automatically." />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="SolNuv — Nigeria&apos;s Solar Lifecycle Intelligence Platform" />
        <meta name="twitter:description" content="Track, recover, and comply. Nigeria&apos;s first end-to-end solar e-waste management platform for installers, EPCs, and asset managers." />
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
              <Link href="#impact" className="hover:text-forest-900 transition-colors">Impact</Link>
              <Link href="#calculator" className="hover:text-forest-900 transition-colors">Calculator</Link>
              <Link href="#plans" className="hover:text-forest-900 transition-colors">Plans</Link>
              <Link href="/blog" className="hover:text-forest-900 transition-colors">Blog</Link>
              <Link href="/contact" className="hover:text-forest-900 transition-colors">Contact</Link>
            </div>
            <div className="flex items-center gap-3">
              <Link href="/login" className="text-sm font-medium text-slate-600 hover:text-forest-900 transition-colors hidden sm:block">Sign In</Link>
              <Link href="/register" className="btn-primary text-sm px-4 py-2 rounded-xl">Get Started Free</Link>
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
                <span className="text-sm font-medium text-white/90">Nigeria&apos;s First · Solar Lifecycle Intelligence Platform</span>
              </div>
              <h1 className="font-display text-4xl md:text-6xl font-bold leading-tight mb-6">
                Turn Solar E-Waste<br />
                <span className="text-amber-400">Into Business Value</span>
              </h1>
              <p className="text-lg text-white/75 mb-8 leading-relaxed max-w-2xl">
                Get the intelligence to track every panel from day one to end-of-life — predict failure using West African climate data, recover silver and battery material value, and generate EPR compliance reports with ease.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link href="/register" className="btn-amber inline-flex items-center gap-2">
                  Start Tracking Free <RiArrowRightLine />
                </Link>
                <Link href="#how-it-works" className="inline-flex items-center gap-2 border border-white/30 text-white px-6 py-3 rounded-xl text-sm font-semibold hover:bg-white/10 transition-all">
                  See How It Works <RiArrowDownLine />
                </Link>
              </div>
              <div className="mt-10 flex flex-wrap gap-6 text-sm text-white/60">
                <span className="flex items-center gap-2"><RiCheckLine className="text-emerald-400" /> NESREA EPR Compliant</span>
                <span className="flex items-center gap-2"><RiCheckLine className="text-emerald-400" /> All 36 Nigerian States</span>
                <span className="flex items-center gap-2"><RiCheckLine className="text-emerald-400" /> Free to Start</span>
                <span className="flex items-center gap-2"><RiCheckLine className="text-emerald-400" /> Paystack Payments</span>
              </div>
            </div>
          </div>
          <div className="relative border-t border-white/10">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 grid grid-cols-2 md:grid-cols-4 gap-6">
              {[
                { value: '₦2.4T+', label: 'Nigerian Solar Market Value' },
                { value: '0%', label: 'Formally Recycled Today' },
                { value: '2024', label: 'NESREA EPR Mandate Active' },
                { value: '7–10 yrs', label: 'Avg Panel Lifespan in Lagos' },
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
              { label: 'Silver per 300W Panel', value: '~0.1g' },
              { label: 'Value From 2nd-Life vs Silver', value: '74×' },
              { label: 'Panel Health Lost to Climate/yr', value: '0.85%' },
              { label: 'Material Value Lost to Informal Sector', value: '~₦0' },
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
              <h2 className="section-title mb-4 mt-2">From Installation to Full Recovery</h2>
              <p className="text-slate-500 max-w-xl mx-auto">Four steps to responsible solar lifecycle management — built for Nigeria&apos;s energy sector and the NESREA EPR mandate.</p>
            </div>
            <div className="grid md:grid-cols-4 gap-6">
              {[
                { step: '01', icon: RiSunLine, title: 'Log Your Projects', desc: 'Register every installation with panels, batteries, brand, and GPS location. Takes under 2 minutes. Works offline for field teams.' },
                { step: '02', icon: RiMapPinLine, title: 'Get Local Predictions', desc: 'Our degradation engine calibrates for Lagos coastal humidity, Kano desert heat, SE humidity, and inverter surge damage across all 36 states.' },
                { step: '03', icon: RiFlashlightLine, title: 'Recover Material Value', desc: 'See the real naira value of recoverable silver, lead, and lithium in your fleet. Compare second-life refurbishment vs. dismantling — instantly.' },
                { step: '04', icon: RiFileTextLine, title: 'Comply With Ease', desc: 'Express NESREA EPR reports and Cradle-to-Grave certificates. Auto-route to regulatory bodies on Elite and Enterprise plans.' },
              ].map((item, i) => (
                <div key={i} className="relative">
                  {i < 3 && <div className="hidden md:block absolute top-8 left-[calc(100%-1rem)] w-8 h-0.5 bg-slate-200 z-0" />}
                  <div className="card-hover relative z-10">
                    <div className="flex items-center gap-3 mb-4">
                      <span className="text-xs font-bold text-slate-400">{item.step}</span>
                      <div className="w-10 h-10 bg-forest-900 rounded-xl flex items-center justify-center">
                        <item.icon className="text-amber-400 text-lg" />
                      </div>
                    </div>
                    <h3 className="font-semibold text-forest-900 mb-2">{item.title}</h3>
                    <p className="text-sm text-slate-500 leading-relaxed">{item.desc}</p>
                  </div>
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
                  Nigeria&apos;s Solar Boom Is Creating<br />
                  <span className="text-amber-400">A Hidden Crisis</span>
                </h2>
                <p className="text-white/70 leading-relaxed mb-6">
                  Over 1 million solar panels have been deployed across Nigeria in the last decade. With average lifespans of 7–10 years in West African conditions, the decommissioning wave has already begun — with almost no formal recovery infrastructure in place.
                </p>
                <p className="text-white/70 leading-relaxed mb-8">
                  Informal scrapyards capture panels at near-zero value. Silver, lead, and lithium — worth billions in aggregate — are either landfilled or exported at commodity prices. Meanwhile, NESREA&apos;s 2024 EPR mandate requires compliance that most installers are not yet equipped to meet.
                </p>
                <p className="text-emerald-300 font-semibold leading-relaxed">
                  SolNuv bridges this gap — turning compliance burden into a competitive advantage and e-waste into a measurable economic return.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { icon: RiLeafLine, color: 'bg-emerald-500/20 border-emerald-500/30', title: 'Environmental Recovery', desc: 'Redirect panels from landfill to certified recyclers or second-life markets. Track your fleet\'s environmental footprint end-to-end.' },
                  { icon: RiGlobalLine, color: 'bg-amber-500/20 border-amber-500/30', title: 'Economic Recovery', desc: 'Recover silver, lead, and lithium value. Second-life refurbishment delivers up to 74× the value of silver-only dismantling.' },
                  { icon: RiShieldCheckLine, color: 'bg-emerald-500/20 border-emerald-500/30', title: 'Regulatory Compliance', desc: 'Meet NESREA EPR 2024 mandates with auto-generated Cradle-to-Grave certificates and audit-ready compliance records.' },
                  { icon: RiBriefcaseLine, color: 'bg-amber-500/20 border-amber-500/30', title: 'Business Differentiation', desc: 'Lead clients with real decommission timelines and recovery estimates. Close more projects and build long-term asset relationships.' },
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
                            onChange={e => setSilverForm(f => ({ ...f, size_watts: e.target.value }))} />
                        </div>
                        <div>
                          <label className="label">Number of Panels</label>
                          <input type="number" className="input" value={silverForm.quantity} min="1"
                            onChange={e => setSilverForm(f => ({ ...f, quantity: e.target.value }))} />
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
                    <p className="text-slate-400 text-xs mb-6">Free account required — takes 2 minutes to set up.</p>
                    <div className="flex gap-3">
                      <Link href="/register" className="btn-primary flex items-center gap-2">Create Free Account →</Link>
                      <Link href="/login" className="btn-outline">Sign In</Link>
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-forest-900 px-8 py-4 flex items-center justify-between">
                <p className="text-white/70 text-sm">Ready to track your full fleet automatically?</p>
                <Link href="/register" className="btn-amber text-sm px-4 py-2 rounded-xl">Create Free Account →</Link>
              </div>
            </div>
          </div>
        </section>

        {/* FEATURES */}
        <section className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-14">
              <span className="text-xs font-semibold uppercase tracking-widest text-emerald-600">Platform Capabilities</span>
              <h2 className="section-title mb-4 mt-2">Built for Nigeria&apos;s Solar Sector</h2>
              <p className="text-slate-500 max-w-xl mx-auto">Every tool your team needs — from field logging to boardroom compliance — in one integrated platform.</p>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {[
                { icon: RiMapPinLine, color: 'bg-forest-900', title: 'West African Degradation Engine', desc: 'Algorithms calibrated for all 36 Nigerian states. Lagos coastal humidity, Kano desert heat, and inverter surge damage — all factored into your decommission timeline.' },
                { icon: RiLeafLine, color: 'bg-emerald-500', title: 'Silver & Material Recovery Calculator', desc: 'Translate every panel and battery into recoverable grams of silver, lead, or lithium — plus real naira estimates across recycling and second-life routes.' },
                { icon: RiBarChartLine, color: 'bg-forest-900', title: 'Hybrid ROI Proposal Engine', desc: 'Model savings across all NERC tariff bands and generator fuel costs. Generate professional payback proposals with PDF export.' },
                { icon: RiShieldCheckLine, color: 'bg-amber-500', title: 'NESREA EPR Compliance Module', desc: 'Auto-generate Cradle-to-Grave certificates and EPR reports under the 2024 Battery Control Regulations. One click. Audit-ready PDF.' },
                { icon: RiTrophyLine, color: 'bg-forest-900', title: 'Live Competitive Leaderboard', desc: 'Rank against other installers by active projects, recovered equipment weight, and environmental impact. Build reputation with eco-conscious clients.' },
                { icon: RiRecycleLine, color: 'bg-emerald-500', title: 'Battery SoH Warranty Ledger', desc: 'Track battery health heuristics, detect deep-cycle abuse, and maintain defendable warranty and maintenance records — per unit, per site.' },
                { icon: RiCalculatorLine, color: 'bg-amber-500', title: 'Offline-Ready DC Cable Compliance', desc: 'Calculate voltage drop and cable sizing with African temperature assumptions. Queue offline and auto-sync compliance evidence when back online.' },
                { icon: RiTeamLine, color: 'bg-forest-900', title: 'Team & Organisation Management', desc: 'Invite Admins and Managers. Track projects per team member. Scale from a one-man-band to a national EPC firm — one dashboard.' },
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
              <h2 className="section-title mb-4 mt-2">Built for Everyone in the Solar Value Chain</h2>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {[
                {
                  emoji: '⚡',
                  title: 'Solar Installers & EPCs',
                  points: ['Log projects in under 2 minutes', 'Get precise decommission timelines per site', 'Close deals with ROI proposals & payback data', 'Stay NESREA-compliant automatically'],
                },
                {
                  emoji: '🏢',
                  title: 'Asset Managers & Corporates',
                  points: ['Track your entire panel fleet in one dashboard', 'Monitor battery fleet State of Health', 'Forecast end-of-life material recovery value', 'Exportable audit trails for due diligence'],
                },
                {
                  emoji: '🌍',
                  title: 'Investors & Development Finance',
                  points: ['Measure portfolio environmental impact', 'Evidence for ESG and green finance reporting', 'Lifecycle data for circular economy mandates', "First-mover access to Nigeria's e-waste recovery market"],
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
              <p className="text-slate-500">No FX surprises. All prices in Naira. Annual billing saves 10% on all plans.</p>
            </div>
            <div className="grid md:grid-cols-4 gap-6 items-start">
              {[
                { name: 'Basic', price: '₦5,000', period: '/mo', cta: 'Get Basic', href: '/register', features: ['Unlimited project logging', 'West African decommission predictions', '42 calculator uses/month (7 per tool)', 'Decommission alerts', 'Basic silver estimator', '1 user / 1 device', '₦54,000 yearly (save 10%)'] },
                { name: 'Pro', price: '₦15,000', period: '/mo', cta: 'Start Pro', href: '/register?plan=pro', popular: true, features: ['Everything in Basic', 'NESREA EPR PDF Reports (coming soon)', 'Cradle-to-Grave Certificates', 'CSV & Excel export', 'QR code traceability', 'Custom public portfolio', 'Team access (5 users)', '₦162,000 yearly (save 10%)'] },
                { name: 'Elite', price: '₦40,000', period: '/mo', cta: 'Go Elite', href: '/register?plan=elite', features: ['Everything in Pro', 'Auto-send to NESREA', 'ROI + Cable Compliance PDFs', 'Team access (15 users)', 'Priority support + onboarding', 'Featured installer badge', 'AI Portfolio Analysis (coming soon)', '₦432,000 yearly (save 10%)'] },
                { name: 'Enterprise', price: '₦100,000+', period: '/mo', cta: 'Contact Us', href: '/contact', features: ['Everything in Elite', 'Custom API integrations', 'Team access (50 users)', 'Dedicated account manager', 'Quarterly EPR advisory', 'White-label PDF reports', '₦1,080,000 yearly (save 10%)'] },
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
            <h2 className="font-display font-bold text-4xl text-white mb-4 leading-tight">Nigeria&apos;s Solar Future Needs<br />Responsible Infrastructure</h2>
            <p className="text-white/70 mb-8 max-w-xl mx-auto">Join installers and EPC contractors using SolNuv to track millions of naira in recoverable solar materials across Nigeria — and stay ahead of the NESREA EPR mandate.</p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link href="/register" className="btn-amber inline-flex items-center gap-2 text-base px-8 py-4 rounded-2xl">
                Create Free Account <RiArrowRightLine />
              </Link>
              <Link href="/contact" className="inline-flex items-center gap-2 border border-white/30 text-white px-6 py-4 rounded-2xl text-sm font-semibold hover:bg-white/10 transition-all">
                Talk to the Team
              </Link>
            </div>
            <p className="text-white/40 text-xs mt-6">No credit card required · Cancel anytime · NESREA-compliant from day one</p>
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
                <p className="text-xs leading-relaxed">Nigeria&apos;s solar lifecycle intelligence platform. Serving the full value of solar, one installation at a time.</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-3">Platform</p>
                <div className="space-y-2 text-xs">
                  <Link href="/register" className="block hover:text-white transition-colors">Get Started Free</Link>
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
                  <a href="mailto:sales@solnuv.com" className="block hover:text-white transition-colors">Enterprise Sales</a>
                  <Link href="/privacy" className="block hover:text-white transition-colors">Privacy Policy</Link>
                  <Link href="/terms" className="block hover:text-white transition-colors">Terms of Service</Link>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-3">Compliance</p>
                <div className="space-y-2 text-xs">
                  <p className="flex items-center gap-1.5"><RiCheckLine className="text-emerald-500" /> NESREA EPR 2024</p>
                  <p className="flex items-center gap-1.5"><RiCheckLine className="text-emerald-500" /> 36 Nigerian States</p>
                  <p className="flex items-center gap-1.5"><RiCheckLine className="text-emerald-500" /> Battery Control Regs</p>
                  <p className="flex items-center gap-1.5"><RiCheckLine className="text-emerald-500" /> Cradle-to-Grave Cert.</p>
                </div>
              </div>
            </div>
            <div className="border-t border-white/10 pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
              <p className="text-xs">© {new Date().getFullYear()} SolNuv. Responsible solar infrastructure for Nigeria.</p>
              <p className="text-xs text-white/30">Powered by Fudo Greentech · Afrocarb</p>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
