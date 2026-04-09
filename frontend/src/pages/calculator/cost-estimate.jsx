import Head from 'next/head';
import { useState, useEffect } from 'react';
import { calculatorAPI, projectsAPI } from '../../services/api';
import { getDashboardLayout } from '../../components/Layout';
import { MotionSection } from '../../components/PageMotion';
import toast from 'react-hot-toast';
import { RiCalculatorLine, RiDownloadLine, RiSaveLine, RiRefreshLine, RiArrowRightLine, RiCloseLine } from 'react-icons/ri';

const SYSTEM_TYPES = [
  { value: 'grid-tied', label: 'Grid-Tied (No Battery)' },
  { value: 'hybrid', label: 'Hybrid (Grid + Battery)' },
  { value: 'off-grid', label: 'Off-Grid (Battery Only)' },
];

const MOUNT_TYPES = [
  { value: 'roof', label: 'Roof Mount' },
  { value: 'ground', label: 'Ground Mount' },
  { value: 'carport', label: 'Carport' },
];

const CABLE_TYPES = [
  { value: 'copper_4mm', label: '4mm² Copper' },
  { value: 'copper_6mm', label: '6mm² Copper' },
  { value: 'copper_10mm', label: '10mm² Copper' },
  { value: 'aluminum_16mm', label: '16mm² Aluminum' },
  { value: 'aluminum_25mm', label: '25mm² Aluminum' },
];

export default function CostEstimate() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [marketPrices, setMarketPrices] = useState(null);
  const [projects, setProjects] = useState([]);
  const [estimate, setEstimate] = useState(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [estimateName, setEstimateName] = useState('');
  const [selectedProject, setSelectedProject] = useState('');
  const [newProjectName, setNewProjectName] = useState('');

  const [form, setForm] = useState({
    system_type: 'hybrid',
    pv_capacity_kwp: 10,
    panel_watts: 550,
    panel_cost_per_unit: '',
    battery_included: true,
    battery_capacity_kwh: 10,
    battery_cost_per_kwh: '',
    battery_sets: 1,
    inverter_included: true,
    inverter_power_kw: '',
    inverter_cost_per_kw: '',
    cable_included: true,
    cable_length_m: 50,
    cable_type: 'copper_4mm',
    mount_type: 'roof',
    custom_items: [],
  });

  const [newCustomItem, setNewCustomItem] = useState({ name: '', quantity: 1, unit_cost: '' });

  useEffect(() => {
    loadMarketPrices();
    loadProjects();
  }, []);

  async function loadMarketPrices() {
    try {
      const res = await calculatorAPI.getMarketPrices();
      setMarketPrices(res.data.data);
      if (res.data.data) {
        setForm(f => ({
          ...f,
          panel_cost_per_unit: res.data.data.panels?.per_watt_ngn * f.panel_watts,
          battery_cost_per_kwh: res.data.data.batteries?.lfp_per_kwh,
          inverter_cost_per_kw: res.data.data.inverters?.hybrid_per_kw,
        }));
      }
    } catch (err) {
      console.error('Failed to load market prices:', err);
    }
  }

  async function loadProjects() {
    try {
      const res = await projectsAPI.list({ limit: 100 });
      setProjects(res.data.data || []);
    } catch { setProjects([]); }
  }

  async function handleCalculate() {
    setCalculating(true);
    try {
      const payload = {
        ...form,
        panel_cost_per_unit: form.panel_cost_per_unit ? Number(form.panel_cost_per_unit) : null,
        battery_cost_per_kwh: form.battery_cost_per_kwh ? Number(form.battery_cost_per_kwh) : null,
        inverter_cost_per_kw: form.inverter_cost_per_kw ? Number(form.inverter_cost_per_kw) : null,
      };
      const res = await calculatorAPI.calculateCostEstimate(payload);
      setEstimate(res.data.data);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to calculate estimate');
    } finally {
      setCalculating(false);
    }
  }

  function updateForm(field, value) {
    setForm(f => ({ ...f, [field]: value }));
    if (estimate) setEstimate(null);
  }

  function addCustomItem() {
    if (!newCustomItem.name || !newCustomItem.unit_cost) {
      toast.error('Enter item name and cost');
      return;
    }
    setForm(f => ({
      ...f,
      custom_items: [...f.custom_items, { ...newCustomItem, unit_cost: Number(newCustomItem.unit_cost), quantity: Number(newCustomItem.quantity) }]
    }));
    setNewCustomItem({ name: '', quantity: 1, unit_cost: '' });
  }

  function removeCustomItem(index) {
    setForm(f => ({ ...f, custom_items: f.custom_items.filter((_, i) => i !== index) }));
  }

  async function handleSave() {
    if (!estimate) return;
    setSaving(true);
    try {
      let projectId = selectedProject;
      if (newProjectName.trim()) {
        const { data: newProj } = await projectsAPI.create({ name: newProjectName.trim() });
        projectId = newProj?.data?.id;
        if (!projectId) throw new Error('Failed to create project');
      }

      await calculatorAPI.saveCostEstimate({
        project_id: projectId,
        estimate_name: estimateName || `Cost Estimate - ${new Date().toLocaleDateString()}`,
        inputs: estimate.inputs,
        ai_estimates: estimate.ai_estimates,
        outputs: estimate.outputs,
        total_cost_ngn: estimate.total_cost_ngn,
      });
      toast.success('Cost estimate saved!');
      setShowSaveModal(false);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to save estimate');
    } finally {
      setSaving(false);
    }
  }

  async function handleExportPdf() {
    if (!estimate) return;
    try {
      const { exportToPdf } = await import('../../utils/pdfExport');
      const container = document.getElementById('cost-estimate-preview');
      if (container) {
        await exportToPdf(container, `SolNuv_Cost_Estimate_${Date.now()}.pdf`);
        toast.success('PDF exported');
      }
    } catch (err) {
      toast.error('Failed to export PDF');
    }
  }

  function fmt(n) {
    return n ? '₦' + Math.round(n).toLocaleString('en-NG') : '—';
  }

  return (
    <>
      <Head><title>Project Cost Estimator — SolNuv</title></Head>

      <MotionSection className="mb-6">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-800 via-emerald-700 to-teal-800 text-white px-8 py-8">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(245,158,11,0.15),transparent_60%)]" />
          <div className="relative">
            <span className="text-xs font-semibold uppercase tracking-widest text-emerald-300 mb-3 block">AI-Powered Calculator</span>
            <h1 className="font-display font-bold text-3xl">Project Cost Estimator</h1>
            <p className="text-white/70 text-sm mt-2 max-w-xl">
              Estimate solar system costs with AI recommendations and dynamic market pricing.
            </p>
            {marketPrices && (
              <div className="mt-3 flex items-center gap-2 text-xs text-emerald-300">
                <RiRefreshLine className="w-4 h-4" />
                Prices updated: {marketPrices.panels?.last_updated}
              </div>
            )}
          </div>
        </div>
      </MotionSection>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Form */}
        <div className="space-y-6">
          {/* System Type */}
          <div className="card p-6">
            <h3 className="font-semibold text-forest-900 mb-4 flex items-center gap-2">
              <RiCalculatorLine className="text-emerald-600" /> System Configuration
            </h3>
            <div className="space-y-4">
              <div>
                <label className="label">System Type</label>
                <select className="input" value={form.system_type} onChange={e => updateForm('system_type', e.target.value)}>
                  {SYSTEM_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">PV Capacity (kWp)</label>
                  <input type="number" className="input" value={form.pv_capacity_kwp} onChange={e => updateForm('pv_capacity_kwp', Number(e.target.value))} min={1} />
                </div>
                <div>
                  <label className="label">Panel Size (W)</label>
                  <select className="input" value={form.panel_watts} onChange={e => updateForm('panel_watts', Number(e.target.value))}>
                    {[400, 450, 500, 530, 550, 580, 600].map(w => <option key={w} value={w}>{w}W</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Panel Cost per Unit (₦) <span className="text-gray-400 font-normal">AI estimate: ₦{(marketPrices?.panels?.per_watt_ngn * form.panel_watts || 0).toLocaleString()}</span></label>
                <input type="number" className="input" value={form.panel_cost_per_unit} onChange={e => updateForm('panel_cost_per_unit', e.target.value)} placeholder="Leave empty for AI estimate" />
              </div>
            </div>
          </div>

          {/* Battery */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-forest-900 flex items-center gap-2">
                🔋 Battery
              </h3>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.battery_included} onChange={e => updateForm('battery_included', e.target.checked)} className="checkbox" />
                <span className="text-sm">Include Battery</span>
              </label>
            </div>
            {form.battery_included && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Capacity (kWh)</label>
                    <input type="number" className="input" value={form.battery_capacity_kwh} onChange={e => updateForm('battery_capacity_kwh', Number(e.target.value))} min={1} />
                  </div>
                  <div>
                    <label className="label">Number of Sets</label>
                    <input type="number" className="input" value={form.battery_sets} onChange={e => updateForm('battery_sets', Number(e.target.value))} min={1} />
                  </div>
                </div>
                <div>
                  <label className="label">Cost per kWh (₦) <span className="text-gray-400 font-normal">AI: ₦{(marketPrices?.batteries?.lfp_per_kwh || 0).toLocaleString()}</span></label>
                  <input type="number" className="input" value={form.battery_cost_per_kwh} onChange={e => updateForm('battery_cost_per_kwh', e.target.value)} placeholder="Leave empty for AI estimate" />
                </div>
              </div>
            )}
          </div>

          {/* Inverter */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-forest-900 flex items-center gap-2">
                ⚡ Inverter
              </h3>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.inverter_included} onChange={e => updateForm('inverter_included', e.target.checked)} className="checkbox" />
                <span className="text-sm">Include Inverter</span>
              </label>
            </div>
            {form.inverter_included && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Power (kW) <span className="text-gray-400 font-normal">AI: {Math.ceil(form.pv_capacity_kwp * 1.1)}kW</span></label>
                    <input type="number" className="input" value={form.inverter_power_kw} onChange={e => updateForm('inverter_power_kw', e.target.value)} placeholder="Auto" />
                  </div>
                  <div>
                    <label className="label">Cost per kW (₦) <span className="text-gray-400 font-normal">AI: ₦{(marketPrices?.inverters?.hybrid_per_kw || 0).toLocaleString()}</span></label>
                    <input type="number" className="input" value={form.inverter_cost_per_kw} onChange={e => updateForm('inverter_cost_per_kw', e.target.value)} placeholder="Leave empty for AI estimate" />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Cables */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-forest-900 flex items-center gap-2">
                🧰 Cables
              </h3>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.cable_included} onChange={e => updateForm('cable_included', e.target.checked)} className="checkbox" />
                <span className="text-sm">Include Cables</span>
              </label>
            </div>
            {form.cable_included && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Length (m)</label>
                    <input type="number" className="input" value={form.cable_length_m} onChange={e => updateForm('cable_length_m', Number(e.target.value))} />
                  </div>
                  <div>
                    <label className="label">Cable Type</label>
                    <select className="input" value={form.cable_type} onChange={e => updateForm('cable_type', e.target.value)}>
                      {CABLE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Mounts */}
          <div className="card p-6">
            <h3 className="font-semibold text-forest-900 mb-4 flex items-center gap-2">
              🏠 Mounting System
            </h3>
            <div className="space-y-4">
              <div>
                <label className="label">Mount Type</label>
                <select className="input" value={form.mount_type} onChange={e => updateForm('mount_type', e.target.value)}>
                  {MOUNT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Custom Items */}
          <div className="card p-6">
            <h3 className="font-semibold text-forest-900 mb-4 flex items-center gap-2">
              📦 Custom Items
            </h3>
            {form.custom_items.length > 0 && (
              <div className="mb-4 space-y-2">
                {form.custom_items.map((item, i) => (
                  <div key={i} className="flex items-center justify-between bg-slate-50 p-2 rounded-lg">
                    <span className="text-sm">{item.name} × {item.quantity} = {fmt(item.quantity * item.unit_cost)}</span>
                    <button onClick={() => removeCustomItem(i)} className="text-red-500 hover:bg-red-50 p-1 rounded">
                      <RiCloseLine className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="grid grid-cols-3 gap-2">
              <input type="text" className="input" placeholder="Item name" value={newCustomItem.name} onChange={e => setNewCustomItem(p => ({ ...p, name: e.target.value }))} />
              <input type="number" className="input" placeholder="Qty" value={newCustomItem.quantity} onChange={e => setNewCustomItem(p => ({ ...p, quantity: e.target.value }))} />
              <input type="number" className="input" placeholder="Cost" value={newCustomItem.unit_cost} onChange={e => setNewCustomItem(p => ({ ...p, unit_cost: e.target.value }))} />
            </div>
            <button onClick={addCustomItem} className="btn-outline w-full mt-2 text-sm">+ Add Item</button>
          </div>

          <button onClick={handleCalculate} disabled={calculating} className="btn-primary w-full flex items-center justify-center gap-2">
            {calculating ? 'Calculating...' : <><RiCalculatorLine /> Calculate Estimate</>}
          </button>
        </div>

        {/* Results */}
        <div className="space-y-6">
          {estimate ? (
            <div id="cost-estimate-preview" className="space-y-6">
              {/* Summary */}
              <div className="card p-6 bg-gradient-to-br from-forest-900 to-emerald-800 text-white">
                <h3 className="text-sm font-semibold text-emerald-300 mb-2">Estimated Total Cost</h3>
                <p className="font-display text-4xl font-bold text-white">{fmt(estimate.total_cost_ngn)}</p>
                <p className="text-sm text-white/60 mt-1">
                  {estimate.outputs.panels_cost ? `${Math.ceil((estimate.inputs.pv_capacity_kwp * 1000) / estimate.inputs.panel_watts)} panels` : ''}
                  {estimate.outputs.battery_cost ? ` • ${estimate.inputs.battery_capacity_kwh}kWh battery` : ''}
                </p>
              </div>

              {/* Breakdown */}
              <div className="card p-6">
                <h3 className="font-semibold text-forest-900 mb-4">Cost Breakdown</h3>
                <div className="space-y-3">
                  {estimate.outputs.panels_cost > 0 && (
                    <div className="flex justify-between items-center py-2 border-b border-gray-100">
                      <div>
                        <p className="font-medium text-sm">Solar Panels</p>
                        <p className="text-xs text-gray-500">{estimate.ai_estimates.panels?.ai_recommendation?.split('.')[0]}</p>
                      </div>
                      <p className="font-semibold">{fmt(estimate.outputs.panels_cost)}</p>
                    </div>
                  )}
                  {estimate.outputs.battery_cost > 0 && (
                    <div className="flex justify-between items-center py-2 border-b border-gray-100">
                      <div>
                        <p className="font-medium text-sm">Battery System</p>
                        <p className="text-xs text-gray-500">{estimate.ai_estimates.battery?.ai_recommendation?.split('.')[0]}</p>
                      </div>
                      <p className="font-semibold">{fmt(estimate.outputs.battery_cost)}</p>
                    </div>
                  )}
                  {estimate.outputs.inverter_cost > 0 && (
                    <div className="flex justify-between items-center py-2 border-b border-gray-100">
                      <div>
                        <p className="font-medium text-sm">Inverter</p>
                        <p className="text-xs text-gray-500">{estimate.ai_estimates.inverter?.ai_recommendation?.split('.')[0]}</p>
                      </div>
                      <p className="font-semibold">{fmt(estimate.outputs.inverter_cost)}</p>
                    </div>
                  )}
                  {estimate.outputs.cable_cost > 0 && (
                    <div className="flex justify-between items-center py-2 border-b border-gray-100">
                      <div>
                        <p className="font-medium text-sm">Cables</p>
                        <p className="text-xs text-gray-500">{estimate.ai_estimates.cable?.ai_recommendation?.split('.')[0]}</p>
                      </div>
                      <p className="font-semibold">{fmt(estimate.outputs.cable_cost)}</p>
                    </div>
                  )}
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <div>
                      <p className="font-medium text-sm">Mounting System</p>
                      <p className="text-xs text-gray-500">{estimate.ai_estimates.mounts?.ai_recommendation?.split('.')[0]}</p>
                    </div>
                    <p className="font-semibold">{fmt(estimate.outputs.mount_cost)}</p>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <p className="font-medium text-sm">Labour</p>
                    <p className="font-semibold">{fmt(estimate.outputs.labour_cost)}</p>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-100">
                    <p className="font-medium text-sm">Miscellaneous ({estimate.outputs.miscellaneous_pct}%)</p>
                    <p className="font-semibold">{fmt(estimate.outputs.miscellaneous_cost)}</p>
                  </div>
                  {estimate.outputs.custom_items?.length > 0 && estimate.outputs.custom_items.map((item, i) => (
                    <div key={i} className="flex justify-between items-center py-2 border-b border-gray-100">
                      <p className="font-medium text-sm">{item.name}</p>
                      <p className="font-semibold">{fmt(item.total)}</p>
                    </div>
                  ))}
                  <div className="flex justify-between items-center py-3 bg-emerald-50 -mx-2 px-2 rounded-lg">
                    <p className="font-bold text-forest-900">Total</p>
                    <p className="font-bold text-forest-900 text-lg">{fmt(estimate.total_cost_ngn)}</p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button onClick={() => setShowSaveModal(true)} className="btn-primary flex-1 flex items-center justify-center gap-2">
                  <RiSaveLine /> Save to Project
                </button>
                <button onClick={handleExportPdf} className="btn-outline flex-1 flex items-center justify-center gap-2">
                  <RiDownloadLine /> Export PDF
                </button>
              </div>
            </div>
          ) : (
            <div className="card p-12 text-center">
              <RiCalculatorLine className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-700 mb-2">Enter System Details</h3>
              <p className="text-sm text-gray-500">Fill in the form and click Calculate to see your cost estimate with AI recommendations.</p>
            </div>
          )}
        </div>
      </div>

      {/* Save Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="font-semibold text-lg">Save Cost Estimate</h3>
              <button onClick={() => setShowSaveModal(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                <RiCloseLine className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="label">Estimate Name</label>
                <input type="text" className="input" value={estimateName} onChange={e => setEstimateName(e.target.value)} placeholder={`Cost Estimate - ${new Date().toLocaleDateString()}`} />
              </div>
              <div>
                <label className="label">Project</label>
                <select className="input" value={selectedProject} onChange={e => { setSelectedProject(e.target.value); setNewProjectName(''); }}>
                  <option value="">Select a project...</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 border-t border-gray-300" />
                <span className="text-xs text-gray-400">or</span>
                <div className="flex-1 border-t border-gray-300" />
              </div>
              <div>
                <label className="label">Create New Project</label>
                <input type="text" className="input" value={newProjectName} onChange={e => { setNewProjectName(e.target.value); setSelectedProject(''); }} placeholder="New project name" />
              </div>
            </div>
            <div className="flex gap-3 p-4 border-t bg-gray-50 rounded-b-2xl">
              <button onClick={() => setShowSaveModal(false)} className="btn-outline flex-1">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 flex items-center justify-center gap-2">
                {saving ? 'Saving...' : <><RiSaveLine /> Save</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

CostEstimate.getLayout = getDashboardLayout;
