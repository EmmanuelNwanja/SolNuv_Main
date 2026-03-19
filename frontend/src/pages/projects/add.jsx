import Head from 'next/head';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { projectsAPI, calculatorAPI } from '../../services/api';
import { getDashboardLayout } from '../../components/Layout';
import { RiAddLine, RiDeleteBinLine, RiSunLine, RiBatteryLine, RiMapPinLine, RiInformationLine } from 'react-icons/ri';
import toast from 'react-hot-toast';

const NIGERIAN_STATES = ['Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno','Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','FCT','Gombe','Imo','Jigawa','Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara','Lagos','Nasarawa','Niger','Ogun','Ondo','Osun','Oyo','Plateau','Rivers','Sokoto','Taraba','Yobe','Zamfara'];
const CONDITIONS = ['excellent', 'good', 'fair', 'poor', 'damaged'];

const defaultPanel = () => ({ brand: 'Jinko Solar', model: '', size_watts: 400, quantity: 1, condition: 'good' });
const defaultBattery = () => ({ brand: 'Felicity', model: '', capacity_kwh: 2.4, quantity: 1, condition: 'good' });

export default function AddProject() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [panelBrands, setPanelBrands] = useState([]);
  const [batteryBrands, setBatteryBrands] = useState([]);
  const [degradPreview, setDegradPreview] = useState(null);
  const [silverPreview, setSilverPreview] = useState(null);

  const [form, setForm] = useState({
    name: '', client_name: '', description: '',
    state: 'Lagos', city: '', address: '',
    installation_date: new Date().toISOString().split('T')[0],
    notes: '',
  });
  const [panels, setPanels] = useState([defaultPanel()]);
  const [batteries, setBatteries] = useState([defaultBattery()]);

  useEffect(() => {
    calculatorAPI.getBrands().then(r => {
      setPanelBrands(r.data.data?.panels || []);
      setBatteryBrands(r.data.data?.batteries || []);
    }).catch(() => {});
  }, []);

  // Live preview: degradation
  useEffect(() => {
    if (!form.state || !form.installation_date) return;
    const timeout = setTimeout(() => {
      calculatorAPI.degradation({ state: form.state, installation_date: form.installation_date })
        .then(r => setDegradPreview(r.data.data)).catch(() => {});
    }, 600);
    return () => clearTimeout(timeout);
  }, [form.state, form.installation_date]);

  // Live preview: silver
  useEffect(() => {
    if (panels.length === 0) return;
    const p = panels[0];
    if (!p.size_watts || !p.quantity) return;
    const timeout = setTimeout(() => {
      calculatorAPI.silver({ size_watts: p.size_watts, quantity: panels.reduce((s, p) => s + Number(p.quantity), 0), brand: p.brand })
        .then(r => setSilverPreview(r.data.data)).catch(() => {});
    }, 800);
    return () => clearTimeout(timeout);
  }, [panels]);

  function updatePanel(idx, field, val) {
    setPanels(prev => prev.map((p, i) => i === idx ? { ...p, [field]: val } : p));
  }
  function updateBattery(idx, field, val) {
    setBatteries(prev => prev.map((b, i) => i === idx ? { ...b, [field]: val } : b));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Project name is required'); return; }
    if (!form.city.trim()) { toast.error('City is required'); return; }
    if (panels.length === 0 && batteries.length === 0) { toast.error('Add at least one panel or battery'); return; }
    setSubmitting(true);
    try {
      const { data } = await projectsAPI.create({ ...form, panels, batteries });
      toast.success('Project created! 🎉');
      router.push(`/projects/${data.data.project.id}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create project');
    } finally { setSubmitting(false); }
  }

  return (
    <>
      <Head><title>Add Project — SolNuv</title></Head>

      <div className="page-header">
        <h1 className="font-display font-bold text-2xl text-forest-900">Add New Project</h1>
        <p className="text-slate-500 text-sm mt-0.5">Log a solar installation to start tracking decommissioning and silver recovery</p>
      </div>

      <form onSubmit={handleSubmit} className="max-w-3xl">
        <div className="space-y-6">
          {/* Basic info */}
          <div className="card">
            <h2 className="font-semibold text-forest-900 mb-4 flex items-center gap-2"><RiSunLine /> Project Details</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="label">Project Name *</label>
                <input className="input" placeholder="e.g. Adeola Residence Solar Installation" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
              </div>
              <div>
                <label className="label">Client Name</label>
                <input className="input" placeholder="e.g. Mr. Adeola Johnson" value={form.client_name} onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))} />
              </div>
              <div>
                <label className="label">Installation Date *</label>
                <input type="date" className="input" value={form.installation_date} onChange={e => setForm(f => ({ ...f, installation_date: e.target.value }))} required />
              </div>
              <div>
                <label className="label">Notes</label>
                <input className="input" placeholder="Any additional notes" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
          </div>

          {/* Location */}
          <div className="card">
            <h2 className="font-semibold text-forest-900 mb-4 flex items-center gap-2"><RiMapPinLine /> Location</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="label">State *</label>
                <select className="input" value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))} required>
                  {NIGERIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="label">City *</label>
                <input className="input" placeholder="e.g. Ikeja" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} required />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Address</label>
                <input className="input" placeholder="Full street address (optional)" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
              </div>
            </div>

            {/* Degradation preview */}
            {degradPreview && (
              <div className="mt-4 bg-forest-900/5 border border-forest-900/10 rounded-xl p-4">
                <div className="flex items-start gap-2">
                  <RiInformationLine className="text-forest-900 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-forest-900">West African Climate Estimate</p>
                    <p className="text-sm text-slate-600 mt-0.5">{degradPreview.explanation}</p>
                    <p className="text-sm text-forest-900 font-semibold mt-1">
                      Estimated decommission: <span className="text-amber-600">{new Date(degradPreview.adjusted_failure_date).toLocaleDateString('en-NG', { year: 'numeric', month: 'long' })}</span>
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Panels */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-forest-900 flex items-center gap-2"><RiSunLine /> Solar Panels</h2>
              <button type="button" onClick={() => setPanels(p => [...p, defaultPanel()])} className="text-sm text-forest-900 font-semibold hover:underline flex items-center gap-1">
                <RiAddLine /> Add Panel Type
              </button>
            </div>
            <div className="space-y-4">
              {panels.map((panel, idx) => (
                <div key={idx} className="grid sm:grid-cols-5 gap-3 p-4 bg-slate-50 rounded-xl">
                  <div className="sm:col-span-2">
                    <label className="label text-xs">Brand *</label>
                    <select className="input text-sm" value={panel.brand} onChange={e => updatePanel(idx, 'brand', e.target.value)}>
                      {panelBrands.length > 0 ? panelBrands.map(b => <option key={b.brand} value={b.brand}>{b.brand}</option>) : <option value="Jinko Solar">Jinko Solar</option>}
                    </select>
                  </div>
                  <div>
                    <label className="label text-xs">Watts (W) *</label>
                    <input type="number" className="input text-sm" value={panel.size_watts} min="50" max="700" onChange={e => updatePanel(idx, 'size_watts', e.target.value)} />
                  </div>
                  <div>
                    <label className="label text-xs">Quantity *</label>
                    <input type="number" className="input text-sm" value={panel.quantity} min="1" onChange={e => updatePanel(idx, 'quantity', e.target.value)} />
                  </div>
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <label className="label text-xs">Condition</label>
                      <select className="input text-sm" value={panel.condition} onChange={e => updatePanel(idx, 'condition', e.target.value)}>
                        {CONDITIONS.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                      </select>
                    </div>
                    {panels.length > 1 && (
                      <button type="button" onClick={() => setPanels(p => p.filter((_, i) => i !== idx))} className="mb-0.5 p-2.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                        <RiDeleteBinLine />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {/* Silver preview */}
            {silverPreview && (
              <div className="mt-4 bg-amber-50 rounded-xl p-4">
                <p className="text-sm font-semibold text-amber-800">💎 Estimated silver in this panel fleet</p>
                <p className="text-lg font-bold text-amber-700">{silverPreview.total_silver_grams?.toFixed(2)}g</p>
                <p className="text-xs text-amber-600 mt-0.5">≈ ₦{silverPreview.recovery_value_expected_ngn?.toLocaleString('en-NG')} at formal recycling (35% recovery)</p>
              </div>
            )}
          </div>

          {/* Batteries */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-forest-900 flex items-center gap-2"><RiBatteryLine /> Batteries</h2>
              <button type="button" onClick={() => setBatteries(b => [...b, defaultBattery()])} className="text-sm text-forest-900 font-semibold hover:underline flex items-center gap-1">
                <RiAddLine /> Add Battery Type
              </button>
            </div>
            <div className="space-y-4">
              {batteries.map((battery, idx) => (
                <div key={idx} className="grid sm:grid-cols-5 gap-3 p-4 bg-slate-50 rounded-xl">
                  <div className="sm:col-span-2">
                    <label className="label text-xs">Brand *</label>
                    <select className="input text-sm" value={battery.brand} onChange={e => updateBattery(idx, 'brand', e.target.value)}>
                      {batteryBrands.length > 0 ? batteryBrands.map(b => <option key={b.brand} value={b.brand}>{b.brand}</option>) : <option value="Felicity">Felicity</option>}
                    </select>
                  </div>
                  <div>
                    <label className="label text-xs">Capacity (kWh)</label>
                    <input type="number" className="input text-sm" value={battery.capacity_kwh} min="0.5" step="0.1" onChange={e => updateBattery(idx, 'capacity_kwh', e.target.value)} />
                  </div>
                  <div>
                    <label className="label text-xs">Quantity *</label>
                    <input type="number" className="input text-sm" value={battery.quantity} min="1" onChange={e => updateBattery(idx, 'quantity', e.target.value)} />
                  </div>
                  <div className="flex items-end gap-2">
                    <div className="flex-1">
                      <label className="label text-xs">Condition</label>
                      <select className="input text-sm" value={battery.condition} onChange={e => updateBattery(idx, 'condition', e.target.value)}>
                        {CONDITIONS.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                      </select>
                    </div>
                    {batteries.length > 1 && (
                      <button type="button" onClick={() => setBatteries(b => b.filter((_, i) => i !== idx))} className="mb-0.5 p-2.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                        <RiDeleteBinLine />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Submit */}
          <div className="flex gap-3">
            <button type="button" onClick={() => router.back()} className="btn-ghost">Cancel</button>
            <button type="submit" disabled={submitting} className="btn-primary flex-1 sm:flex-none">
              {submitting ? 'Saving...' : 'Create Project →'}
            </button>
          </div>
        </div>
      </form>
    </>
  );
}

AddProject.getLayout = getDashboardLayout;
