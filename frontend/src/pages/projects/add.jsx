import Head from 'next/head';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { projectsAPI, calculatorAPI } from '../../services/api';
import { getDashboardLayout } from '../../components/Layout';
import { MotionSection } from '../../components/PageMotion';
import {
  RiAddLine, RiDeleteBinLine, RiSunLine, RiBatteryLine, RiMapPinLine,
  RiInformationLine, RiPlugLine, RiCameraLine, RiShieldCheckLine,
  RiAlertLine, RiArrowDownSLine, RiSearchLine, RiShipLine, RiStoreLine,
  RiFlashlightLine, RiFocus3Line, RiLoader4Line, RiCheckboxCircleLine,
} from 'react-icons/ri';
import toast from 'react-hot-toast';
import { supabase } from '../../utils/supabase';

const NIGERIAN_STATES = ['Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno','Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','FCT','Gombe','Imo','Jigawa','Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara','Lagos','Nasarawa','Niger','Ogun','Ondo','Osun','Oyo','Plateau','Rivers','Sokoto','Taraba','Yobe','Zamfara'];
const CONDITIONS = ['excellent', 'good', 'fair', 'poor', 'damaged'];
const DEFAULT_PANEL_BRANDS = ['Jinko Solar', 'JA Solar', 'Longi', 'Tongwei', 'Risen', 'Canadian Solar', 'Trina Solar'];
const DEFAULT_BATTERY_BRANDS = ['Felicity', 'BYD', 'Growatt', 'LG', 'Samsung', 'CATL', 'Victron'];
const DEFAULT_INVERTER_BRANDS = ['Growatt', 'Solis', 'Schneider Electric', 'Fronius', 'SMA', 'Victron', 'Huawei'];

// Project lifecycle stages available at creation
const PROJECT_STAGES = [
  { value: 'draft',       label: 'Draft',                    description: 'Planned / not yet installed' },
  { value: 'active',      label: 'Active',                   description: 'Currently operational' },
  { value: 'maintenance', label: 'Under Maintenance/Upgrade', description: 'Temporarily offline for servicing' },
];

// Capacity category derivation (mirrors backend logic)
function deriveCapacity(panels = [], batteries = []) {
  const panelKw = panels.reduce((sum, p) => sum + (Number(p.size_watts || 0) * Number(p.quantity || 0)) / 1000, 0);
  const batteryKw = batteries.reduce((sum, b) => sum + Number(b.capacity_kwh || 0) * Number(b.quantity || 0), 0);
  const kw = Math.round((panelKw + batteryKw) * 100) / 100;
  let category = null;
  if (kw > 0) {
    if (kw <= 30) category = { label: 'Home', icon: '🏠', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
    else if (kw <= 100) category = { label: 'Commercial', icon: '🏢', color: 'text-blue-700 bg-blue-50 border-blue-200' };
    else if (kw <= 1000) category = { label: 'Industrial / Minigrid', icon: '🏭', color: 'text-violet-700 bg-violet-50 border-violet-200' };
    else category = { label: 'Utility', icon: '⚡', color: 'text-amber-700 bg-amber-50 border-amber-200' };
  }
  return { kw, category };
}

// Equipment condition explanations
const CONDITION_HELP = {
  excellent: 'Like new. No visible defects, full functionality.',
  good: 'Minor wear. Works normally, may have small cosmetic marks.',
  fair: 'Moderate wear. Functional but shows signs of age/use.',
  poor: 'Significant wear. Still works but reduced efficiency (20-40%).',
  damaged: 'Non-functional. Requires repair or recycling.'
};

const defaultPanel = () => ({
  brand: 'Jinko Solar', custom_brand: '', model: '', size_watts: 400, quantity: 1,
  condition: 'good', sourcing_type: '', sourcing_info: {},
});
const defaultBattery = () => ({
  brand: 'Felicity', custom_brand: '', model: '', capacity_kwh: 2.4, quantity: 1,
  condition: 'good', sourcing_type: '', sourcing_info: {},
});
const defaultInverter = () => ({
  brand: 'Growatt', custom_brand: '', model: '', power_kw: 5, quantity: 1,
  condition: 'good', sourcing_type: '', sourcing_info: {},
});

// ---------------------------------------------------------------------------
// BrandSearchSelect — searchable OEM brand picker with "Other" option
// ---------------------------------------------------------------------------
function BrandSearchSelect({ brands = [], value, onChange }) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function onOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [open]);

  const filtered = brands.filter(b => !search || b.toLowerCase().includes(search.toLowerCase()));
  const displayLabel = value === 'Other' ? 'Other (Custom Brand)' : value || 'Select brand…';

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger button */}
      <button
        type="button"
        className="input text-sm text-left w-full flex items-center justify-between gap-1"
        onClick={() => setOpen(o => !o)}
      >
        <span className={value ? 'text-slate-800 truncate' : 'text-slate-400'}>{displayLabel}</span>
        <RiArrowDownSLine className={`flex-shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-white rounded-xl border border-slate-200 shadow-xl max-h-64 overflow-visible">
          {/* Search input */}
          <div className="p-2 border-b border-slate-100 flex items-center gap-2">
            <RiSearchLine className="text-slate-400 flex-shrink-0" />
            <input
              autoFocus
              type="text"
              className="flex-1 text-sm outline-none placeholder-slate-400"
              placeholder="Search OEM brand…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          {/* Brand list */}
          <div className="max-h-44 overflow-y-auto">
            {filtered.map(brand => (
              <button
                key={brand}
                type="button"
                className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                  value === brand
                    ? 'bg-forest-900/10 text-forest-900 font-semibold'
                    : 'text-slate-700 hover:bg-forest-900/5'
                }`}
                onClick={() => { onChange(brand); setOpen(false); setSearch(''); }}
              >
                {brand}
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="px-3 py-2 text-xs text-slate-400 italic">No brands match "{search}"</p>
            )}
            {/* Other option always at bottom */}
            <button
              type="button"
              className={`w-full text-left px-3 py-2 text-sm border-t border-slate-100 transition-colors ${
                value === 'Other'
                  ? 'bg-amber-50 text-amber-700 font-semibold'
                  : 'text-amber-600 hover:bg-amber-50'
              }`}
              onClick={() => { onChange('Other'); setOpen(false); setSearch(''); }}
            >
              + Other / Custom Brand
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// EquipmentSourceSection — supply chain info subsection per equipment row
// ---------------------------------------------------------------------------
function EquipmentSourceSection({ sourcing_type, sourcing_info, onTypeChange, onInfoChange }) {
  const types = [
    { value: '', label: 'Not Specified' },
    { value: 'direct_import', label: 'Direct Import', Icon: RiShipLine },
    { value: 'local_purchase', label: 'Local Purchase', Icon: RiStoreLine },
  ];

  return (
    <div className="mt-3 pt-3 border-t border-slate-200">
      <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">
        Equipment Source <span className="font-normal normal-case">(optional)</span>
      </p>
      {/* Toggle buttons */}
      <div className="flex flex-wrap gap-2 mb-3">
        {types.map(({ value, label, Icon }) => (
          <button
            key={value}
            type="button"
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${
              sourcing_type === value
                ? 'bg-forest-900 text-white border-forest-900'
                : 'bg-white text-slate-600 border-slate-200 hover:border-forest-900 hover:text-forest-900'
            }`}
            onClick={() => onTypeChange(value)}
          >
            {Icon && <Icon className="text-sm" />}
            {label}
          </button>
        ))}
      </div>

      {/* Direct Import fields */}
      {sourcing_type === 'direct_import' && (
        <div className="grid sm:grid-cols-2 gap-3 bg-blue-50/50 border border-blue-100 rounded-xl p-3">
          <div>
            <label className="label text-xs">Supply Contract Date</label>
            <input
              type="date"
              className="input text-sm"
              value={sourcing_info.supply_contract_date || ''}
              onChange={e => onInfoChange('supply_contract_date', e.target.value)}
            />
          </div>
          <div>
            <label className="label text-xs">Import ETA / Clearance Date</label>
            <input
              type="date"
              className="input text-sm"
              value={sourcing_info.import_eta_date || ''}
              onChange={e => onInfoChange('import_eta_date', e.target.value)}
            />
          </div>
          <div>
            <label className="label text-xs">OEM Name</label>
            <input
              type="text"
              className="input text-sm"
              placeholder="e.g. Jinko Solar Technology Co. Ltd"
              value={sourcing_info.oem_name || ''}
              onChange={e => onInfoChange('oem_name', e.target.value)}
            />
          </div>
          <div>
            <label className="label text-xs">Country of Supply From</label>
            <input
              type="text"
              className="input text-sm"
              placeholder="e.g. China"
              value={sourcing_info.country_of_supply || ''}
              onChange={e => onInfoChange('country_of_supply', e.target.value)}
            />
          </div>
        </div>
      )}

      {/* Local Purchase fields */}
      {sourcing_type === 'local_purchase' && (
        <div className="grid sm:grid-cols-2 gap-3 bg-emerald-50/50 border border-emerald-100 rounded-xl p-3">
          <div>
            <label className="label text-xs">Supply Contract Date</label>
            <input
              type="date"
              className="input text-sm"
              value={sourcing_info.supply_contract_date || ''}
              onChange={e => onInfoChange('supply_contract_date', e.target.value)}
            />
          </div>
          <div>
            <label className="label text-xs">Date of Delivery / Supply / Pickup</label>
            <input
              type="date"
              className="input text-sm"
              value={sourcing_info.delivery_date || ''}
              onChange={e => onInfoChange('delivery_date', e.target.value)}
            />
          </div>
          <div>
            <label className="label text-xs">Distributor Name</label>
            <input
              type="text"
              className="input text-sm"
              placeholder="e.g. Alpha Solar Distributors Ltd"
              value={sourcing_info.distributor_name || ''}
              onChange={e => onInfoChange('distributor_name', e.target.value)}
            />
          </div>
          <div>
            <label className="label text-xs">Distributor Location / State</label>
            <select
              className="input text-sm"
              value={sourcing_info.distributor_state || ''}
              onChange={e => onInfoChange('distributor_state', e.target.value)}
            >
              <option value="">Select State</option>
              {NIGERIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>
      )}
    </div>
  );
}

// Pure-JS JPEG EXIF GPS extractor — no external library needed
function extractExifGPS(file) {
  return new Promise((resolve) => {
    if (!file) { resolve(null); return; }
    const isJpeg = file.type === 'image/jpeg' || /\.(jpg|jpeg)$/i.test(file.name || '');
    if (!isJpeg) { resolve(null); return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buf = e.target.result;
        const view = new DataView(buf);
        if (view.getUint16(0, false) !== 0xFFD8) { resolve(null); return; }
        let offset = 2;
        while (offset < buf.byteLength - 1) {
          if (view.getUint8(offset) !== 0xFF) { resolve(null); return; }
          const mb = view.getUint8(offset + 1);
          if (mb === 0xD9 || mb === 0xDA) { resolve(null); return; }
          if (mb === 0xD8 || (mb >= 0xD0 && mb <= 0xD7)) { offset += 2; continue; }
          const segLen = view.getUint16(offset + 2, false);
          if (mb === 0xE1) {
            const s4 = [view.getUint8(offset+4),view.getUint8(offset+5),view.getUint8(offset+6),view.getUint8(offset+7)];
            if (s4[0]===0x45&&s4[1]===0x78&&s4[2]===0x69&&s4[3]===0x66) {
              const tiff = offset + 10;
              const le = view.getUint16(tiff,false) === 0x4949;
              const ifd0 = tiff + view.getUint32(tiff+4,le);
              const n0 = view.getUint16(ifd0,le);
              let gpsIFD = null;
              for (let i=0;i<n0;i++){const eo=ifd0+2+i*12;if(eo+12>buf.byteLength)break;if(view.getUint16(eo,le)===0x8825){gpsIFD=tiff+view.getUint32(eo+8,le);break;}}
              if (!gpsIFD) { resolve(null); return; }
              const gpsN = view.getUint16(gpsIFD,le);
              let latRef='N',lonRef='E',latDMS=null,lonDMS=null;
              const rat=(o)=>{const d=view.getUint32(o,le),n=view.getUint32(o+4,le);return n?d/n:0;};
              const dms=(o)=>[rat(o),rat(o+8),rat(o+16)];
              for(let i=0;i<gpsN;i++){const eo=gpsIFD+2+i*12;if(eo+12>buf.byteLength)break;const tag=view.getUint16(eo,le);if(tag===1)latRef=String.fromCharCode(view.getUint8(eo+8));else if(tag===2)latDMS=dms(tiff+view.getUint32(eo+8,le));else if(tag===3)lonRef=String.fromCharCode(view.getUint8(eo+8));else if(tag===4)lonDMS=dms(tiff+view.getUint32(eo+8,le));}
              if(!latDMS||!lonDMS){resolve(null);return;}
              let lat=latDMS[0]+latDMS[1]/60+latDMS[2]/3600;
              let lon=lonDMS[0]+lonDMS[1]/60+lonDMS[2]/3600;
              if(latRef==='S')lat=-lat;if(lonRef==='W')lon=-lon;
              if(!isFinite(lat)||!isFinite(lon)||(lat===0&&lon===0)){resolve(null);return;}
              resolve({lat:parseFloat(lat.toFixed(6)),lng:parseFloat(lon.toFixed(6))});
              return;
            }
          }
          offset += 2 + segLen;
        }
        resolve(null);
      } catch { resolve(null); }
    };
    reader.onerror = () => resolve(null);
    reader.readAsArrayBuffer(file);
  });
}

function mergeBrandOptions(apiRows = [], defaults = []) {
  const names = new Set(defaults.map((x) => x.toLowerCase()));
  const out = [...defaults];
  for (const row of apiRows || []) {
    const brand = typeof row === 'string' ? row : row?.brand;
    if (!brand) continue;
    if (!names.has(brand.toLowerCase())) {
      names.add(brand.toLowerCase());
      out.push(brand);
    }
  }
  return out;
}

export default function AddProject() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [geoSource, setGeoSource] = useState('none');
  const [geo, setGeo] = useState({ latitude: '', longitude: '' });
  const [geoVerifying, setGeoVerifying] = useState(false);
  const [geoVerification, setGeoVerification] = useState(null);
  const [gpsLocating, setGpsLocating] = useState(false);
  const [panelBrands, setPanelBrands] = useState([]);
  const [batteryBrands, setBatteryBrands] = useState([]);
  const [inverterBrands, setInverterBrands] = useState([]);
  const [degradPreview, setDegradPreview] = useState(null);
  const [silverPreview, setSilverPreview] = useState(null);

  const [form, setForm] = useState({
    name: '', client_name: '', description: '',
    state: 'Lagos', city: '', address: '',
    installation_date: new Date().toISOString().split('T')[0],
    notes: '',
    status: 'active',
  });
  const [panels, setPanels] = useState([defaultPanel()]);
  const [batteries, setBatteries] = useState([defaultBattery()]);
  const [inverters, setInverters] = useState([]);

  useEffect(() => {
    calculatorAPI.getBrands().then(r => {
      setPanelBrands(mergeBrandOptions(r.data.data?.panels || [], DEFAULT_PANEL_BRANDS));
      setBatteryBrands(mergeBrandOptions(r.data.data?.batteries || [], DEFAULT_BATTERY_BRANDS));
      setInverterBrands(mergeBrandOptions(r.data.data?.inverters || [], DEFAULT_INVERTER_BRANDS));
    }).catch(() => {
      setPanelBrands(DEFAULT_PANEL_BRANDS);
      setBatteryBrands(DEFAULT_BATTERY_BRANDS);
      setInverterBrands(DEFAULT_INVERTER_BRANDS);
    });
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
  function updateInverter(idx, field, val) {
    setInverters(prev => prev.map((inv, i) => i === idx ? { ...inv, [field]: val } : inv));
  }
  function updatePanelSourcing(idx, field, val) {
    setPanels(prev => prev.map((p, i) => i === idx ? { ...p, sourcing_info: { ...(p.sourcing_info || {}), [field]: val } } : p));
  }
  function updateBatterySourcing(idx, field, val) {
    setBatteries(prev => prev.map((b, i) => i === idx ? { ...b, sourcing_info: { ...(b.sourcing_info || {}), [field]: val } } : b));
  }
  function updateInverterSourcing(idx, field, val) {
    setInverters(prev => prev.map((inv, i) => i === idx ? { ...inv, sourcing_info: { ...(inv.sourcing_info || {}), [field]: val } } : inv));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Project name is required'); return; }
    if (!form.city.trim()) { toast.error('City is required'); return; }
    if (panels.length === 0 && batteries.length === 0) { toast.error('Add at least one panel or battery'); return; }

    // Validate that "Other" brand selections have a custom name filled in
    if (panels.some(p => p.brand === 'Other' && !p.custom_brand?.trim())) {
      toast.error('Enter a custom brand name for each panel marked as "Other"'); return;
    }
    if (batteries.some(b => b.brand === 'Other' && !b.custom_brand?.trim())) {
      toast.error('Enter a custom brand name for each battery marked as "Other"'); return;
    }
    if (inverters.some(inv => inv.brand === 'Other' && !inv.custom_brand?.trim())) {
      toast.error('Enter a custom brand name for each inverter marked as "Other"'); return;
    }

    setSubmitting(true);
    try {
      // Submit any custom brands to the DB (non-blocking on failure)
      const customSubmissions = [];
      for (const p of panels) {
        if (p.brand === 'Other' && p.custom_brand?.trim())
          customSubmissions.push(calculatorAPI.submitBrand({ brand: p.custom_brand.trim(), equipment_type: 'panel' }));
      }
      for (const b of batteries) {
        if (b.brand === 'Other' && b.custom_brand?.trim())
          customSubmissions.push(calculatorAPI.submitBrand({ brand: b.custom_brand.trim(), equipment_type: 'battery' }));
      }
      for (const inv of inverters) {
        if (inv.brand === 'Other' && inv.custom_brand?.trim())
          customSubmissions.push(calculatorAPI.submitBrand({ brand: inv.custom_brand.trim(), equipment_type: 'inverter' }));
      }
      if (customSubmissions.length > 0) {
        try {
          await Promise.all(customSubmissions);
          // Refresh brand lists so the new brand appears in subsequent selections
          calculatorAPI.getBrands().then(r => {
            setPanelBrands(mergeBrandOptions(r.data.data?.panels || [], DEFAULT_PANEL_BRANDS));
            setBatteryBrands(mergeBrandOptions(r.data.data?.batteries || [], DEFAULT_BATTERY_BRANDS));
            setInverterBrands(mergeBrandOptions(r.data.data?.inverters || [], DEFAULT_INVERTER_BRANDS));
          }).catch(() => {});
        } catch { /* non-critical — brand DB save failed, project creation continues */ }
      }

      // Resolve "Other" → custom_brand name, and attach sourcing_info
      function resolveEquipment(items) {
        return items.map(({ custom_brand, sourcing_type, sourcing_info, ...rest }) => ({
          ...rest,
          brand: rest.brand === 'Other' ? (custom_brand?.trim() || 'Other') : rest.brand,
          sourcing_info: sourcing_type
            ? { type: sourcing_type, ...sourcing_info }
            : null,
        }));
      }
      const resolvedPanels = resolveEquipment(panels);
      const resolvedBatteries = resolveEquipment(batteries);
      const resolvedInverters = resolveEquipment(inverters);

      // Upload photo to Supabase storage if provided
      let project_photo_url = null;
      if (photoFile) {
        setPhotoUploading(true);
        try {
          const ext = photoFile.name.split('.').pop() || 'jpg';
          const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
          const { data: uploadData, error: uploadErr } = await supabase.storage
            .from('project-photos')
            .upload(path, photoFile, { contentType: photoFile.type, upsert: false });
          if (!uploadErr && uploadData) {
            const { data: urlData } = supabase.storage.from('project-photos').getPublicUrl(path);
            project_photo_url = urlData?.publicUrl || null;
          }
        } catch { /* non-critical; proceed without photo */ }
        setPhotoUploading(false);
      }
      const latitude = geo.latitude ? parseFloat(geo.latitude) : null;
      const longitude = geo.longitude ? parseFloat(geo.longitude) : null;
      const { data } = await projectsAPI.create({
        ...form,
        panels: resolvedPanels,
        batteries: resolvedBatteries,
        inverters: resolvedInverters,
        latitude, longitude, geo_source: geoSource, project_photo_url,
      });
      toast.success('Project created! 🎉');
      router.push(`/projects/${data.data.project.id}`);
    } catch (err) {
      console.error('Project creation error:', err);
      const message = err.response?.data?.message || err.message || 'Failed to create project';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Head><title>Add Project — SolNuv</title></Head>

      <MotionSection className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-forest-900 via-emerald-900 to-slate-900 text-white px-8 py-10 mb-8">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(245,158,11,0.12),transparent_60%)]" />
        <div className="relative">
          <span className="text-xs font-semibold uppercase tracking-widest text-emerald-300 mb-3 block">Asset Registration</span>
          <h1 className="font-display font-bold text-3xl">Add New Project</h1>
          <p className="text-white/70 text-sm mt-2">Log a solar installation to start tracking decommissioning and silver recovery</p>
        </div>
      </MotionSection>

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
              {/* Stage */}
              <div className="sm:col-span-2">
                <label className="label">Project Stage</label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {PROJECT_STAGES.map(stage => (
                    <button
                      key={stage.value}
                      type="button"
                      title={stage.description}
                      onClick={() => setForm(f => ({ ...f, status: stage.value }))}
                      className={`flex flex-col items-start text-left px-4 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
                        form.status === stage.value
                          ? 'bg-forest-900 text-white border-forest-900'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-forest-900 hover:text-forest-900'
                      }`}
                    >
                      <span>{stage.label}</span>
                      <span className={`text-xs font-normal mt-0.5 ${form.status === stage.value ? 'text-white/70' : 'text-slate-400'}`}>
                        {stage.description}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="sm:col-span-2">
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

          {/* Project Photo & Geolocation */}
          <div className="card">
            <h2 className="font-semibold text-forest-900 mb-1 flex items-center gap-2"><RiCameraLine /> Project Photo &amp; Geolocation</h2>
            <p className="text-xs text-slate-500 mb-4">Upload a photo taken at the site. If the photo contains GPS data, coordinates are auto-populated and marked <span className="font-semibold text-blue-700">Authenticated</span>. Manual coordinates are <span className="font-semibold text-amber-700">Unverified</span> pending admin review.</p>

            <div className="mb-5">
              <label className="label">Site Photo (Camera / Gallery)</label>
              <div className="flex items-start gap-4 mt-1">
                <label className="cursor-pointer flex-shrink-0">
                  <input
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp"
                    capture="environment"
                    className="sr-only"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setPhotoFile(file);
                      setPhotoPreview(URL.createObjectURL(file));
                      const gps = await extractExifGPS(file);
                      if (gps) {
                        setGeo({ latitude: String(gps.lat), longitude: String(gps.lng) });
                        setGeoSource('image_exif');
                        toast.success('GPS location extracted from photo!');
                      } else if (geoSource !== 'manual') {
                        setGeoSource('none');
                      }
                    }}
                  />
                  <span className="inline-flex items-center gap-2 rounded-xl border-2 border-dashed border-slate-300 hover:border-forest-900 px-5 py-3 text-sm font-semibold text-slate-600 hover:text-forest-900 transition-all bg-slate-50 hover:bg-forest-900/5">
                    <RiCameraLine className="text-lg" /> {photoFile ? 'Change Photo' : 'Upload / Take Photo'}
                  </span>
                </label>
                {photoPreview && (
                  <div className="relative">
                    <img src={photoPreview} alt="Project preview" className="w-24 h-24 rounded-xl object-cover border border-slate-200" />
                    <button
                      type="button"
                      onClick={() => {
                        setPhotoFile(null);
                        setPhotoPreview(null);
                        if (geoSource === 'image_exif') {
                          setGeoSource('none');
                          setGeo({ latitude: '', longitude: '' });
                        }
                      }}
                      className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center hover:bg-red-700"
                    >
                      X
                    </button>
                  </div>
                )}
              </div>
            </div>

            {geoSource === 'image_exif' && (
              <div className="mb-4 flex items-center gap-2 rounded-xl bg-blue-50 border border-blue-200 px-4 py-2.5 text-sm text-blue-800">
                <RiShieldCheckLine className="text-blue-600 flex-shrink-0" />
                <span><span className="font-semibold">Authenticated</span> - GPS coordinates sourced from photo EXIF data. Pending platform verification.</span>
              </div>
            )}
            {geoSource === 'device_gps' && (
              <div className="mb-4 flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-2.5 text-sm text-emerald-800">
                <RiFocus3Line className="text-emerald-600 flex-shrink-0" />
                <span><span className="font-semibold">Device GPS</span> - Coordinates captured from your device. {geoVerification ? `${geoVerification.confidence_pct}% confidence.` : 'Submit to verify with AI.'}</span>
              </div>
            )}
            {geoSource === 'manual' && (
              <div className="mb-4 flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 px-4 py-2.5 text-sm text-amber-800">
                <RiAlertLine className="text-amber-600 flex-shrink-0" />
                <span><span className="font-semibold">Unverified</span> - Manually entered coordinates. Click &quot;Verify with AI&quot; below to auto-validate.</span>
              </div>
            )}

            {/* Use My Location button */}
            <div className="mb-4">
              <button
                type="button"
                disabled={gpsLocating}
                onClick={() => {
                  if (!navigator.geolocation) {
                    toast.error('Geolocation is not supported by your browser');
                    return;
                  }
                  setGpsLocating(true);
                  navigator.geolocation.getCurrentPosition(
                    (position) => {
                      const { latitude, longitude } = position.coords;
                      setGeo({ latitude: latitude.toFixed(6), longitude: longitude.toFixed(6) });
                      setGeoSource('device_gps');
                      setGeoVerification(null);
                      setGpsLocating(false);
                      toast.success('Device location captured!');
                    },
                    (err) => {
                      setGpsLocating(false);
                      const messages = {
                        1: 'Location access denied. Please enable location permissions.',
                        2: 'Location unavailable. Try again or enter manually.',
                        3: 'Location request timed out. Try again.',
                      };
                      toast.error(messages[err.code] || 'Failed to get location');
                    },
                    { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
                  );
                }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-emerald-300 hover:border-emerald-600 text-sm font-semibold text-emerald-700 hover:text-emerald-900 transition-all bg-emerald-50 hover:bg-emerald-100"
              >
                {gpsLocating ? <RiLoader4Line className="animate-spin" /> : <RiFocus3Line />}
                {gpsLocating ? 'Getting Location...' : 'Use My Device Location'}
              </button>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Latitude</label>
                <input
                  type="number"
                  step="0.000001"
                  min="-90"
                  max="90"
                  className="input"
                  placeholder="e.g. 6.524379"
                  value={geo.latitude}
                  onChange={(e) => {
                    setGeo((g) => ({ ...g, latitude: e.target.value }));
                    if (geoSource !== 'image_exif') setGeoSource(e.target.value ? 'manual' : 'none');
                    setGeoVerification(null);
                  }}
                />
              </div>
              <div>
                <label className="label">Longitude</label>
                <input
                  type="number"
                  step="0.000001"
                  min="-180"
                  max="180"
                  className="input"
                  placeholder="e.g. 3.379206"
                  value={geo.longitude}
                  onChange={(e) => {
                    setGeo((g) => ({ ...g, longitude: e.target.value }));
                    if (geoSource !== 'image_exif') setGeoSource(e.target.value ? 'manual' : 'none');
                    setGeoVerification(null);
                  }}
                />
              </div>
            </div>

            {/* AI Verification result */}
            {geoVerification && (
              <div className={`mt-3 flex items-start gap-2 rounded-xl px-4 py-3 text-sm border ${
                geoVerification.verified
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : geoVerification.confidence_pct >= 50
                    ? 'bg-amber-50 border-amber-200 text-amber-800'
                    : 'bg-red-50 border-red-200 text-red-800'
              }`}>
                {geoVerification.verified ? <RiCheckboxCircleLine className="text-emerald-600 mt-0.5 flex-shrink-0" /> : <RiAlertLine className="text-amber-600 mt-0.5 flex-shrink-0" />}
                <div>
                  <p className="font-semibold">{geoVerification.verified ? 'AI Verified' : 'Verification Incomplete'} — {geoVerification.confidence_pct}% Confidence</p>
                  {geoVerification.distance_m != null && <p className="text-xs mt-0.5">{geoVerification.distance_m}m from geocoded address</p>}
                  {geoVerification.details?.reverse_display && <p className="text-xs mt-0.5 opacity-75">Detected: {geoVerification.details.reverse_display}</p>}
                </div>
              </div>
            )}

            {geoSource === 'none' && !photoFile && (
              <p className="mt-3 text-xs text-slate-400 flex items-center gap-1"><RiAlertLine /> No geolocation provided - project will be marked <span className="font-semibold">Unverified</span>.</p>
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
            
            {/* Condition Guide */}
            <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs font-semibold text-blue-900 mb-2">Equipment Condition Guide:</p>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                {Object.entries(CONDITION_HELP).map(([cond, desc]) => (
                  <div key={cond} title={desc} className="cursor-help p-2 bg-white rounded border border-blue-100 hover:border-blue-300 hover:bg-blue-50 transition-colors">
                    <span className="font-semibold text-blue-900 capitalize">{cond}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              {panels.map((panel, idx) => (
                <div key={idx} className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="grid sm:grid-cols-5 gap-3">
                    <div className="sm:col-span-2">
                      <label className="label text-xs">Brand *</label>
                      <BrandSearchSelect
                        brands={panelBrands.length > 0 ? panelBrands : DEFAULT_PANEL_BRANDS}
                        value={panel.brand}
                        onChange={v => updatePanel(idx, 'brand', v)}
                      />
                      {panel.brand === 'Other' && (
                        <input
                          type="text"
                          className="input text-sm mt-2"
                          placeholder="Enter custom brand name"
                          value={panel.custom_brand}
                          onChange={e => updatePanel(idx, 'custom_brand', e.target.value)}
                        />
                      )}
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
                        <select className="input text-sm" value={panel.condition} onChange={e => updatePanel(idx, 'condition', e.target.value)} title={CONDITION_HELP[panel.condition]}>
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
                  <EquipmentSourceSection
                    sourcing_type={panel.sourcing_type}
                    sourcing_info={panel.sourcing_info}
                    onTypeChange={v => updatePanel(idx, 'sourcing_type', v)}
                    onInfoChange={(field, val) => updatePanelSourcing(idx, field, val)}
                  />
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

            {/* Capacity preview — updates live as panels change */}
            {(() => {
              const { kw, category } = deriveCapacity(panels, batteries);
              if (!category) return null;
              return (
                <div className={`mt-3 flex items-center gap-3 rounded-xl border px-4 py-2.5 ${category.color}`}>
                  <RiFlashlightLine className="text-lg flex-shrink-0" />
                  <div>
                    <p className="text-xs font-semibold">{category.icon} {category.label} System — {kw % 1 === 0 ? kw : kw.toFixed(2)} kW combined capacity</p>
                    <p className="text-xs font-normal opacity-75">Panel kWp + Battery kWh · auto-classified</p>
                  </div>
                </div>
              );
            })()}
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
                <div key={idx} className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="grid sm:grid-cols-5 gap-3">
                    <div className="sm:col-span-2">
                      <label className="label text-xs">Brand *</label>
                      <BrandSearchSelect
                        brands={batteryBrands.length > 0 ? batteryBrands : DEFAULT_BATTERY_BRANDS}
                        value={battery.brand}
                        onChange={v => updateBattery(idx, 'brand', v)}
                      />
                      {battery.brand === 'Other' && (
                        <input
                          type="text"
                          className="input text-sm mt-2"
                          placeholder="Enter custom brand name"
                          value={battery.custom_brand}
                          onChange={e => updateBattery(idx, 'custom_brand', e.target.value)}
                        />
                      )}
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
                        <select className="input text-sm" value={battery.condition} onChange={e => updateBattery(idx, 'condition', e.target.value)} title={CONDITION_HELP[battery.condition]}>
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
                  <EquipmentSourceSection
                    sourcing_type={battery.sourcing_type}
                    sourcing_info={battery.sourcing_info}
                    onTypeChange={v => updateBattery(idx, 'sourcing_type', v)}
                    onInfoChange={(field, val) => updateBatterySourcing(idx, field, val)}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Inverters */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-forest-900 flex items-center gap-2"><RiPlugLine /> Inverters (Optional)</h2>
              <button type="button" onClick={() => setInverters(i => [...i, defaultInverter()])} className="text-sm text-forest-900 font-semibold hover:underline flex items-center gap-1">
                <RiAddLine /> Add Inverter
              </button>
            </div>
            {inverters.length > 0 ? (
              <div className="space-y-4">
                {inverters.map((inverter, idx) => (
                  <div key={idx} className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="grid sm:grid-cols-5 gap-3">
                      <div className="sm:col-span-2">
                        <label className="label text-xs">Brand *</label>
                        <BrandSearchSelect
                          brands={inverterBrands.length > 0 ? inverterBrands : DEFAULT_INVERTER_BRANDS}
                          value={inverter.brand}
                          onChange={v => updateInverter(idx, 'brand', v)}
                        />
                        {inverter.brand === 'Other' && (
                          <input
                            type="text"
                            className="input text-sm mt-2"
                            placeholder="Enter custom brand name"
                            value={inverter.custom_brand}
                            onChange={e => updateInverter(idx, 'custom_brand', e.target.value)}
                          />
                        )}
                      </div>
                      <div>
                        <label className="label text-xs">Power (kW)</label>
                        <input type="number" className="input text-sm" value={inverter.power_kw} min="0.5" step="0.5" onChange={e => updateInverter(idx, 'power_kw', e.target.value)} />
                      </div>
                      <div>
                        <label className="label text-xs">Quantity *</label>
                        <input type="number" className="input text-sm" value={inverter.quantity} min="1" onChange={e => updateInverter(idx, 'quantity', e.target.value)} />
                      </div>
                      <div className="flex items-end gap-2">
                        <div className="flex-1">
                          <label className="label text-xs">Condition</label>
                          <select className="input text-sm" value={inverter.condition} onChange={e => updateInverter(idx, 'condition', e.target.value)} title={CONDITION_HELP[inverter.condition]}>
                            {CONDITIONS.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                          </select>
                        </div>
                        {inverters.length > 0 && (
                          <button type="button" onClick={() => setInverters(i => i.filter((_, ii) => ii !== idx))} className="mb-0.5 p-2.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                            <RiDeleteBinLine />
                          </button>
                        )}
                      </div>
                    </div>
                    <EquipmentSourceSection
                      sourcing_type={inverter.sourcing_type}
                      sourcing_info={inverter.sourcing_info}
                      onTypeChange={v => updateInverter(idx, 'sourcing_type', v)}
                      onInfoChange={(field, val) => updateInverterSourcing(idx, field, val)}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500 text-center py-4">No inverters added yet. Click "Add Inverter" if applicable.</p>
            )}
          </div>

          {/* Submit */}
          <div className="flex gap-3">
            <button type="button" onClick={() => router.back()} className="btn-ghost">Cancel</button>
            <button type="submit" disabled={submitting} className="btn-primary flex-1 sm:flex-none">
              {submitting ? (photoUploading ? 'Uploading photo...' : 'Saving...') : 'Create Project ->'}
            </button>
          </div>
        </div>
      </form>
    </>
  );
}

AddProject.getLayout = getDashboardLayout;
