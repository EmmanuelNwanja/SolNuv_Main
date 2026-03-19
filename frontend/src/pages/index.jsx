import Head from 'next/head';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { RiSunLine, RiLeafLine, RiFileTextLine, RiTrophyLine, RiArrowRightLine, RiCheckLine, RiShieldCheckLine, RiMapPinLine, RiFlashlightLine } from 'react-icons/ri';
import { calculatorAPI } from '../services/api';
import toast from 'react-hot-toast';

const NIGERIAN_STATES = [
  'Lagos','Kano','Rivers','FCT','Oyo','Katsina','Ogun','Anambra','Imo','Kaduna',
  'Delta','Plateau','Enugu','Borno','Benue','Akwa Ibom','Edo','Ondo','Kwara','Niger',
  'Sokoto','Kogi','Osun','Zamfara','Jigawa','Adamawa','Gombe','Kebbi','Bauchi','Bayelsa',
  'Cross River','Taraba','Nasarawa','Ebonyi','Abia','Yobe'
];

export default function Home() {
  const [calcTab, setCalcTab] = useState('silver');
  const [silverForm, setSilverForm] = useState({ size_watts: 400, quantity: 10, brand: 'Jinko Solar' });
  const [degradForm, setDegradForm] = useState({ state: 'Lagos', installation_date: '2021-01-01' });
  const [silverResult, setSilverResult] = useState(null);
  const [degradResult, setDegradResult] = useState(null);
  const [calcLoading, setCalcLoading] = useState(false);
  const [brands, setBrands] = useState([]);

  useEffect(() => {
    calculatorAPI.getBrands().then(r => setBrands(r.data.data?.panels || [])).catch(() => {});
    // Auto-run demo calc on load
    runSilverCalc({ size_watts: 400, quantity: 10, brand: 'Jinko Solar' });
    runDegradCalc({ state: 'Lagos', installation_date: '2021-01-01' });
  }, []);

  async function runSilverCalc(form = silverForm) {
    setCalcLoading(true);
    try {
      const { data } = await calculatorAPI.silver(form);
      setSilverResult(data.data);
    } catch { toast.error('Calculation failed'); }
    finally { setCalcLoading(false); }
  }

  async function runDegradCalc(form = degradForm) {
    setCalcLoading(true);
    try {
      const { data } = await calculatorAPI.degradation(form);
      setDegradResult(data.data);
    } catch { toast.error('Calculation failed'); }
    finally { setCalcLoading(false); }
  }

  return (
    <>
      <Head>
        <title>SolNuv — Solar E-Waste Tracking, Recovery & Compliance Platform</title>
        <meta name="description" content="Track your solar installations, predict decommissioning in Nigerian conditions, recover silver value, and generate NESREA EPR compliance reports automatically." />
        <meta property="og:title" content="SolNuv — Solar E-Waste Tracking" />
        <meta property="og:description" content="The platform for responsible solar energy management in Nigeria." />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="min-h-screen bg-white font-body">
        {/* NAV */}
        <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-slate-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-forest-900 rounded-lg flex items-center justify-center">
                <RiSunLine className="text-amber-400 text-lg" />
              </div>
              <span className="font-display font-bold text-forest-900 text-lg">SolNuv</span>
            </Link>
            <div className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
              <Link href="#how-it-works" className="hover:text-forest-900 transition-colors">How It Works</Link>
              <Link href="#calculator" className="hover:text-forest-900 transition-colors">Calculator</Link>
              <Link href="#plans" className="hover:text-forest-900 transition-colors">Plans</Link>
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
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-28">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 mb-6">
                <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                <span className="text-sm font-medium text-white/90">NESREA EPR Compliance · Nigeria's Solar Lifecycle Platform</span>
              </div>
              <h1 className="font-display text-4xl md:text-6xl font-bold leading-tight mb-6">
                Every Solar Panel<br />
                <span className="text-amber-400">Deserves a Proper End</span>
              </h1>
              <p className="text-lg text-white/75 mb-8 leading-relaxed max-w-2xl">
                Track your solar installations from day one to decommissioning. Predict failure using West African climate data, recover silver value, and generate NESREA compliance reports automatically — all in one platform.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link href="/register" className="btn-amber inline-flex items-center gap-2">
                  Start Tracking Free <RiArrowRightLine />
                </Link>
                <Link href="#calculator" className="inline-flex items-center gap-2 border border-white/30 text-white px-6 py-3 rounded-xl text-sm font-semibold hover:bg-white/10 transition-all">
                  Try the Calculator
                </Link>
              </div>
              {/* Social proof */}
              <div className="mt-10 flex flex-wrap gap-6 text-sm text-white/60">
                <span className="flex items-center gap-2"><RiCheckLine className="text-emerald-400" /> NESREA EPR Compliant</span>
                <span className="flex items-center gap-2"><RiCheckLine className="text-emerald-400" /> All 36 Nigerian States</span>
                <span className="flex items-center gap-2"><RiCheckLine className="text-emerald-400" /> Free to Start</span>
                <span className="flex items-center gap-2"><RiCheckLine className="text-emerald-400" /> Paystack Payments</span>
              </div>
            </div>
          </div>
        </section>

        {/* STATS BAR */}
        <div className="bg-amber-500">
          <div className="max-w-7xl mx-auto px-4 py-4 flex flex-wrap justify-center gap-8">
            {[
              { label: 'Silver in a 300W Panel', value: '~0.1g' },
              { label: 'Of Silver\'s Economic Share', value: '47%' },
              { label: 'Panel Lifespan in Lagos', value: '7–9 yrs' },
              { label: 'Value Lost to Informal Sector', value: '~₦0' },
            ].map(s => (
              <div key={s.label} className="text-center">
                <p className="font-display font-bold text-2xl text-forest-900">{s.value}</p>
                <p className="text-xs text-forest-900/70 font-medium">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* HOW IT WORKS */}
        <section id="how-it-works" className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-14">
              <h2 className="section-title mb-4">From Installation to Recycling</h2>
              <p className="text-slate-500 max-w-xl mx-auto">Four steps to responsible solar lifecycle management — built specifically for Nigeria's energy sector.</p>
            </div>
            <div className="grid md:grid-cols-4 gap-6">
              {[
                { step: '01', icon: RiSunLine, title: 'Log Your Projects', desc: 'Register every installation with panels, batteries, brand, and GPS location. Takes under 2 minutes.' },
                { step: '02', icon: RiMapPinLine, title: 'Get Local Predictions', desc: 'Our algorithm adjusts for Lagos coastal humidity, Kano heat, and inverter surge damage across all 36 states.' },
                { step: '03', icon: RiFlashlightLine, title: 'See Your Silver Value', desc: 'Instantly see the grams of recoverable silver and expected naira returns from your entire fleet.' },
                { step: '04', icon: RiFileTextLine, title: 'Generate Compliance Reports', desc: 'One-click NESREA EPR reports and Cradle-to-Grave certificates for your Pro/Elite plan.' },
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

        {/* LIVE CALCULATOR */}
        <section id="calculator" className="py-20 bg-slate-50">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-10">
              <h2 className="section-title mb-4">Try the Live Calculator</h2>
              <p className="text-slate-500">No account needed. See what your panels are worth right now.</p>
            </div>
            <div className="bg-white rounded-3xl shadow-lg overflow-hidden">
              {/* Tabs */}
              <div className="flex border-b border-slate-100">
                {[
                  { id: 'silver', label: '💎 Silver Recovery' },
                  { id: 'degrade', label: '📅 Decommission Predictor' },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setCalcTab(tab.id)}
                    className={`flex-1 py-4 text-sm font-semibold transition-all ${calcTab === tab.id ? 'bg-forest-900 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="p-6 md:p-10">
                {calcTab === 'silver' ? (
                  <div className="grid md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <div>
                        <label className="label">Panel Wattage (W)</label>
                        <input type="number" className="input" value={silverForm.size_watts}
                          onChange={e => setSilverForm(f => ({ ...f, size_watts: e.target.value }))} min="50" max="700" />
                      </div>
                      <div>
                        <label className="label">Number of Panels</label>
                        <input type="number" className="input" value={silverForm.quantity}
                          onChange={e => setSilverForm(f => ({ ...f, quantity: e.target.value }))} min="1" max="50000" />
                      </div>
                      <div>
                        <label className="label">Panel Brand</label>
                        <select className="input" value={silverForm.brand}
                          onChange={e => setSilverForm(f => ({ ...f, brand: e.target.value }))}>
                          {brands.length > 0 ? brands.map(b => <option key={b.brand} value={b.brand}>{b.brand}</option>) : <option>Jinko Solar</option>}
                        </select>
                      </div>
                      <button onClick={() => runSilverCalc()} disabled={calcLoading} className="btn-primary w-full">
                        {calcLoading ? 'Calculating...' : 'Calculate Silver Value →'}
                      </button>
                    </div>
                    <div>
                      {silverResult ? (
                        <div className="space-y-4">
                          <div className="bg-forest-900 rounded-2xl p-6 text-white">
                            <p className="text-sm text-white/70 mb-1">Estimated Silver in Your Fleet</p>
                            <p className="font-display text-4xl font-bold text-amber-400">{silverResult.total_silver_grams?.toFixed(2)}g</p>
                            <p className="text-xs text-white/50 mt-1">at {silverResult.silver_mg_per_wp} mg/Wp</p>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="bg-emerald-50 rounded-xl p-4">
                              <p className="text-xs text-emerald-600 font-medium mb-1">Expected Recovery (35%)</p>
                              <p className="font-bold text-emerald-800">₦{silverResult.recovery_value_expected_ngn?.toLocaleString('en-NG')}</p>
                            </div>
                            <div className="bg-red-50 rounded-xl p-4">
                              <p className="text-xs text-red-600 font-medium mb-1">Lost to Informal Sector</p>
                              <p className="font-bold text-red-800">₦0</p>
                            </div>
                          </div>
                          <div className="bg-amber-50 rounded-xl p-4">
                            <p className="text-xs text-amber-700 font-medium">Silver Price: ₦{silverResult.silver_price_ngn_per_gram?.toFixed(0)}/gram (${silverResult.silver_price_usd_per_gram}/g)</p>
                            <p className="text-xs text-amber-600 mt-1">Formal recycling recovers 30–40% of total silver value. Informal scrappers recover 0% — they burn cables for copper.</p>
                          </div>
                        </div>
                      ) : (
                        <div className="h-full flex items-center justify-center text-slate-300">
                          <p className="text-center text-sm">Results will appear here</p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="grid md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <div>
                        <label className="label">Installation State</label>
                        <select className="input" value={degradForm.state}
                          onChange={e => setDegradForm(f => ({ ...f, state: e.target.value }))}>
                          {NIGERIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="label">Installation Date</label>
                        <input type="date" className="input" value={degradForm.installation_date}
                          onChange={e => setDegradForm(f => ({ ...f, installation_date: e.target.value }))} />
                      </div>
                      <button onClick={() => runDegradCalc()} disabled={calcLoading} className="btn-primary w-full">
                        {calcLoading ? 'Calculating...' : 'Predict Decommission Date →'}
                      </button>
                    </div>
                    <div>
                      {degradResult ? (
                        <div className="space-y-4">
                          <div className={`rounded-2xl p-6 text-white ${degradResult.urgency === 'overdue' ? 'bg-red-600' : degradResult.urgency === 'critical' ? 'bg-amber-600' : 'bg-forest-900'}`}>
                            <p className="text-sm text-white/70 mb-1">Est. Decommission Date</p>
                            <p className="font-display text-3xl font-bold">{new Date(degradResult.adjusted_failure_date).toLocaleDateString('en-NG', { year: 'numeric', month: 'long' })}</p>
                            <p className="text-sm mt-2 text-white/80">{degradResult.urgency === 'overdue' ? '⚠️ Already overdue!' : `${degradResult.days_until_decommission} days from today`}</p>
                          </div>
                          <div className="card">
                            <p className="text-sm text-slate-600 font-medium mb-1">Climate Zone: <span className="text-forest-900 font-semibold">{degradResult.climate_zone?.replace(/_/g, ' ')}</span></p>
                            <p className="text-sm text-slate-500 leading-relaxed">{degradResult.explanation}</p>
                          </div>
                          <div className="bg-blue-50 rounded-xl p-4">
                            <p className="text-xs text-blue-600 font-medium">vs OEM Warranty Expectation</p>
                            <p className="text-xs text-blue-500 mt-1">Standard panels are rated for 20–25 years. In West African conditions, expect 7–12 years. Our algorithm accounts for local climate, not the factory default.</p>
                          </div>
                        </div>
                      ) : (
                        <div className="h-full flex items-center justify-center text-slate-300">
                          <p className="text-center text-sm">Results will appear here</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-forest-900 px-8 py-4 flex items-center justify-between">
                <p className="text-white/70 text-sm">Want to track your full fleet?</p>
                <Link href="/register" className="btn-amber text-sm px-4 py-2 rounded-xl">Create Free Account →</Link>
              </div>
            </div>
          </div>
        </section>

        {/* FEATURES */}
        <section className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-14">
              <h2 className="section-title mb-4">Built for Nigeria's Solar Sector</h2>
            </div>
            <div className="grid md:grid-cols-3 gap-6">
              {[
                { icon: RiMapPinLine, color: 'bg-forest-900', title: 'West African Degradation Predictor', desc: 'Algorithm trained on all 36 Nigerian states. Lagos coastal humidity, Kano desert heat, and inverter surge damage — all factored in.' },
                { icon: RiLeafLine, color: 'bg-emerald-500', title: 'Silver Recovery Calculator', desc: 'Translate your panel fleet into grams of recoverable silver and real naira returns. See what the informal sector is stealing from you.' },
                { icon: RiShieldCheckLine, color: 'bg-amber-500', title: 'NESREA EPR Compliance', desc: 'Auto-generate Cradle-to-Grave certificates and EPR reports under the 2024 Battery Control Regulations. One click. PDF ready.' },
                { icon: RiTrophyLine, color: 'bg-forest-900', title: 'Live Leaderboard', desc: 'Compete with other installers. Rank by active projects, recycled equipment, and overall environmental impact.' },
                { icon: RiFileTextLine, color: 'bg-emerald-500', title: 'QR Code Per Project', desc: 'Every project gets a unique QR code. NESREA inspectors, clients, and recyclers can verify equipment origin on-site.' },
                { icon: RiFlashlightLine, color: 'bg-amber-500', title: 'Team Management', desc: 'Invite your team as Admins or Managers. Assign roles, track projects per member, and manage your org from one dashboard.' },
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

        {/* PLANS */}
        <section id="plans" className="py-20 bg-slate-50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-14">
              <h2 className="section-title mb-4">Simple, Naira-First Pricing</h2>
              <p className="text-slate-500">No foreign exchange surprises. All prices in ₦. Cancel anytime.</p>
            </div>
            <div className="grid md:grid-cols-4 gap-6 items-start">
              {[
                { name: 'Free', price: '₦0', period: '/mo', cta: 'Get Started', href: '/register', features: ['Unlimited project logging', 'West African decommission predictions', 'Silver value calculator', 'Email decommission alerts', '1 user / 1 device'] },
                { name: 'Pro', price: '₦10,000', period: '/mo', cta: 'Start Pro', href: '/register?plan=pro', popular: true, features: ['Everything in Free', 'NESREA EPR PDF Reports', 'Cradle-to-Grave Certificates', 'Excel export', 'QR code per project', 'Recovery requests', 'Team access (2 users)', 'Standard support'] },
                { name: 'Elite', price: '₦25,000', period: '/mo', cta: 'Go Elite', href: '/register?plan=elite', features: ['Everything in Pro', 'Auto-send to NESREA', 'Team access (5 users)', 'Priority support', 'Featured on leaderboard'] },
                { name: 'Enterprise', price: 'Custom', period: '', cta: 'Contact Us', href: 'mailto:sales@solnuv.com', features: ['Everything in Elite', 'Custom integrations', 'Team access (15+ users)', 'Dedicated account manager', 'Custom reporting', 'Top priority support'] },
              ].map((plan, i) => (
                <div key={i} className={`rounded-2xl overflow-hidden ${plan.popular ? 'ring-2 ring-forest-900 shadow-xl' : 'border border-slate-200'}`}>
                  {plan.popular && <div className="bg-forest-900 text-center py-1.5 text-xs font-bold text-amber-400">MOST POPULAR</div>}
                  <div className={`p-6 ${plan.popular ? 'bg-white' : 'bg-white'}`}>
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

        {/* CTA FOOTER */}
        <section className="bg-forest-900 py-16">
          <div className="max-w-3xl mx-auto px-4 text-center">
            <h2 className="font-display font-bold text-4xl text-white mb-4">Ready to Manage Your Solar Fleet Responsibly?</h2>
            <p className="text-white/70 mb-8">Join installers and EPC contractors tracking millions of naira in recoverable solar materials across Nigeria.</p>
            <Link href="/register" className="btn-amber inline-flex items-center gap-2 text-base px-8 py-4 rounded-2xl">
              Create Free Account <RiArrowRightLine />
            </Link>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="bg-forest-950 text-white/60 py-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-amber-400 rounded flex items-center justify-center">
                <RiSunLine className="text-forest-900 text-sm" />
              </div>
              <span className="font-display font-bold text-white text-sm">SolNuv</span>
            </div>
            <p className="text-xs">© {new Date().getFullYear()} SolNuv. Building responsible solar infrastructure in Nigeria.</p>
            <div className="flex gap-4 text-xs">
              <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
              <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
              <a href="mailto:hello@solnuv.com" className="hover:text-white transition-colors">Contact</a>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
