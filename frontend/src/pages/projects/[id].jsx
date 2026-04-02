import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { projectsAPI, reportsAPI, engineeringAPI, downloadBlob } from '../../services/api';
import { supabase } from '../../utils/supabase';
import { useAuth } from '../../context/AuthContext';
import { getDashboardLayout } from '../../components/Layout';
import { StatusBadge, UrgencyBadge, ConfirmModal, LoadingSpinner } from '../../components/ui/index';
import { MotionSection } from '../../components/PageMotion';
import {
  RiArrowLeftLine, RiEditLine, RiDeleteBinLine, RiDownloadLine,
  RiQrCodeLine, RiSunLine, RiBatteryLine, RiMapPinLine,
  RiCalendarLine, RiRecycleLine, RiShieldCheckLine, RiTruckLine, RiCameraLine
} from 'react-icons/ri';
import toast from 'react-hot-toast';

const STATUS_TRANSITIONS = {
  active: ['decommissioned'],
  decommissioned: ['recycled'],
  pending_recovery: ['decommissioned', 'recycled'],
};

const NIGERIAN_STATES = ['Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno','Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','FCT','Gombe','Imo','Jigawa','Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara','Lagos','Nasarawa','Niger','Ogun','Ondo','Osun','Oyo','Plateau','Rivers','Sokoto','Taraba','Yobe','Zamfara'];

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
            const s4 = [view.getUint8(offset + 4), view.getUint8(offset + 5), view.getUint8(offset + 6), view.getUint8(offset + 7)];
            if (s4[0] === 0x45 && s4[1] === 0x78 && s4[2] === 0x69 && s4[3] === 0x66) {
              const tiff = offset + 10;
              const le = view.getUint16(tiff, false) === 0x4949;
              const ifd0 = tiff + view.getUint32(tiff + 4, le);
              const n0 = view.getUint16(ifd0, le);
              let gpsIFD = null;
              for (let i = 0; i < n0; i++) {
                const eo = ifd0 + 2 + i * 12;
                if (eo + 12 > buf.byteLength) break;
                if (view.getUint16(eo, le) === 0x8825) { gpsIFD = tiff + view.getUint32(eo + 8, le); break; }
              }
              if (!gpsIFD) { resolve(null); return; }
              const gpsN = view.getUint16(gpsIFD, le);
              let latRef = 'N', lonRef = 'E', latDMS = null, lonDMS = null;
              const rat = (o) => { const d = view.getUint32(o, le), n = view.getUint32(o + 4, le); return n ? d / n : 0; };
              const dms = (o) => [rat(o), rat(o + 8), rat(o + 16)];
              for (let i = 0; i < gpsN; i++) {
                const eo = gpsIFD + 2 + i * 12;
                if (eo + 12 > buf.byteLength) break;
                const tag = view.getUint16(eo, le);
                if (tag === 1) latRef = String.fromCharCode(view.getUint8(eo + 8));
                else if (tag === 2) latDMS = dms(tiff + view.getUint32(eo + 8, le));
                else if (tag === 3) lonRef = String.fromCharCode(view.getUint8(eo + 8));
                else if (tag === 4) lonDMS = dms(tiff + view.getUint32(eo + 8, le));
              }
              if (!latDMS || !lonDMS) { resolve(null); return; }
              let lat = latDMS[0] + latDMS[1] / 60 + latDMS[2] / 3600;
              let lon = lonDMS[0] + lonDMS[1] / 60 + lonDMS[2] / 3600;
              if (latRef === 'S') lat = -lat;
              if (lonRef === 'W') lon = -lon;
              if (!isFinite(lat) || !isFinite(lon) || (lat === 0 && lon === 0)) { resolve(null); return; }
              resolve({ lat: parseFloat(lat.toFixed(6)), lng: parseFloat(lon.toFixed(6)) });
              return;
            }
          }
          offset += 2 + segLen;
        }
        resolve(null);
      } catch {
        resolve(null);
      }
    };
    reader.onerror = () => resolve(null);
    reader.readAsArrayBuffer(file);
  });
}

export default function ProjectDetail() {
  const router = useRouter();
  const { id } = router.query;
  const { isPro, plan } = useAuth();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deleteModal, setDeleteModal] = useState(false);
  const [recoveryModal, setRecoveryModal] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [certLoading, setCertLoading] = useState(false);
  const [recoveryForm, setRecoveryForm] = useState({ preferred_date: '', pickup_address: '', notes: '' });
  const [batteryAssets, setBatteryAssets] = useState([]);
  const [assetLoading, setAssetLoading] = useState(false);
  const [assetSubmitting, setAssetSubmitting] = useState(false);
  const [assetForm, setAssetForm] = useState({
    brand: '',
    chemistry: 'LiFePO4',
    capacity_kwh: '',
    quantity: 1,
    installation_date: '',
    warranty_years: 5,
  });
  const [editMode, setEditMode] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editPhotoFile, setEditPhotoFile] = useState(null);
  const [editPhotoPreview, setEditPhotoPreview] = useState(null);
  const [editForm, setEditForm] = useState({
    name: '',
    client_name: '',
    description: '',
    state: 'Lagos',
    city: '',
    address: '',
    latitude: '',
    longitude: '',
    geo_source: 'none',
    notes: '',
    project_photo_url: '',
  });

  useEffect(() => {
    if (!id) return;
    projectsAPI.get(id)
      .then((r) => {
        const payload = r.data.data;
        setProject(payload);
        setEditForm({
          name: payload.name || '',
          client_name: payload.client_name || '',
          description: payload.description || '',
          state: payload.state || 'Lagos',
          city: payload.city || '',
          address: payload.address || '',
          latitude: payload.latitude ?? '',
          longitude: payload.longitude ?? '',
          geo_source: payload.geo_source || 'none',
          notes: payload.notes || '',
          project_photo_url: payload.project_photo_url || '',
        });
      })
      .catch(() => toast.error('Project not found'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    setAssetLoading(true);
    engineeringAPI.listBatteryAssets(id)
      .then((r) => setBatteryAssets(r.data.data || []))
      .catch(() => setBatteryAssets([]))
      .finally(() => setAssetLoading(false));
  }, [id]);

  async function handleStatusUpdate(newStatus) {
    setStatusUpdating(true);
    try {
      const { data } = await projectsAPI.update(id, { status: newStatus });
      setProject(prev => ({ ...prev, ...data.data }));
      toast.success(`Project marked as ${newStatus}!`);
    } catch { toast.error('Failed to update status'); }
    finally { setStatusUpdating(false); }
  }

  async function handleDelete() {
    try {
      await projectsAPI.delete(id);
      toast.success('Project deleted');
      router.push('/projects');
    } catch { toast.error('Failed to delete project'); }
  }

  async function handleSaveProjectEdits(e) {
    e.preventDefault();
    if (!editForm.name.trim()) {
      toast.error('Project name is required');
      return;
    }
    if (!editForm.city.trim()) {
      toast.error('City is required');
      return;
    }

    setEditSubmitting(true);
    try {
      let projectPhotoUrl = editForm.project_photo_url || null;
      if (editPhotoFile) {
        const ext = editPhotoFile.name.split('.').pop() || 'jpg';
        const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from('project-photos')
          .upload(path, editPhotoFile, { contentType: editPhotoFile.type, upsert: false });
        if (!uploadErr && uploadData) {
          const { data: urlData } = supabase.storage.from('project-photos').getPublicUrl(path);
          projectPhotoUrl = urlData?.publicUrl || projectPhotoUrl;
        }
      }

      const updatePayload = {
        name: editForm.name,
        client_name: editForm.client_name || null,
        description: editForm.description || null,
        state: editForm.state,
        city: editForm.city,
        address: editForm.address || null,
        notes: editForm.notes || null,
        geo_source: editForm.geo_source || 'none',
        latitude: editForm.latitude === '' ? null : Number(editForm.latitude),
        longitude: editForm.longitude === '' ? null : Number(editForm.longitude),
        project_photo_url: projectPhotoUrl,
      };

      const { data } = await projectsAPI.update(id, updatePayload);
      setProject((prev) => ({ ...prev, ...data.data }));
      setEditMode(false);
      setEditPhotoFile(null);
      setEditPhotoPreview(null);
      toast.success('Project updated');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update project');
    } finally {
      setEditSubmitting(false);
    }
  }

  async function handleRequestRecovery() {
    if (!recoveryForm.preferred_date) {
      toast.error('Choose a preferred pickup date');
      return;
    }
    if (!recoveryForm.pickup_address?.trim()) {
      toast.error('Pickup address is required');
      return;
    }

    try {
      await projectsAPI.requestRecovery(id, recoveryForm);
      toast.success('Recovery request submitted! We\'ll contact you within 24 hours.');
      setRecoveryModal(false);
      setRecoveryForm({ preferred_date: '', pickup_address: '', notes: '' });
      setProject(prev => ({
        ...prev,
        status: 'pending_recovery',
        recovery_requests: [{
          id: `temp-${Date.now()}`,
          status: 'requested',
          preferred_date: recoveryForm.preferred_date,
        }, ...(prev?.recovery_requests || [])],
      }));
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to submit recovery'); }
  }

  async function handleDownloadCertificate() {
    if (!isPro) { toast.error('Upgrade to Pro to download certificates'); return; }
    setCertLoading(true);
    try {
      const { data } = await reportsAPI.getCertificate(id);
      downloadBlob(data, `SolNuv_Certificate_${project.name.replace(/\s/g, '_')}.pdf`);
      toast.success('Certificate downloaded!');
    } catch { toast.error('Failed to generate certificate'); }
    finally { setCertLoading(false); }
  }

  // Populate asset form defaults from loaded project — must be before any early returns
  useEffect(() => {
    if (!project) return;
    const firstBattery = project.equipment?.filter(e => e.equipment_type === 'battery')[0];
    setAssetForm((prev) => ({
      ...prev,
      brand: prev.brand || firstBattery?.brand || 'Felicity',
      capacity_kwh: prev.capacity_kwh || firstBattery?.capacity_kwh || '',
      installation_date: prev.installation_date || project.installation_date || new Date().toISOString().split('T')[0],
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id]);

  async function handleCreateBatteryAsset() {
    if (!assetForm.brand || !assetForm.chemistry || !assetForm.capacity_kwh || !assetForm.installation_date) {
      toast.error('Brand, chemistry, capacity, and installation date are required');
      return;
    }

    setAssetSubmitting(true);
    try {
      const { data } = await engineeringAPI.createBatteryAsset(id, {
        ...assetForm,
        capacity_kwh: Number(assetForm.capacity_kwh),
        quantity: Number(assetForm.quantity || 1),
        warranty_years: Number(assetForm.warranty_years || 5),
      });
      const created = data.data;
      setBatteryAssets((prev) => [created, ...prev]);
      toast.success('Battery field QR generated');
    } catch {
      toast.error('Failed to create battery ledger QR');
    } finally {
      setAssetSubmitting(false);
    }
  }

  if (loading) return <div className="flex justify-center py-16"><LoadingSpinner size="lg" /></div>;
  if (!project) return (
    <div className="text-center py-16">
      <p className="text-slate-500 mb-4">Project not found.</p>
      <Link href="/projects" className="btn-primary">← Back to Projects</Link>
    </div>
  );

  const panels = project.equipment?.filter(e => e.equipment_type === 'panel') || [];
  const batteries = project.equipment?.filter(e => e.equipment_type === 'battery') || [];
  const totalPanels = panels.reduce((s, e) => s + e.quantity, 0);
  const totalBatteries = batteries.reduce((s, e) => s + e.quantity, 0);
  const totalSilver = panels.reduce((s, e) => s + (e.estimated_silver_grams || 0), 0);
  const totalSilverValue = panels.reduce((s, e) => s + (e.estimated_silver_value_ngn || 0), 0);
  const recycleIncome = project.recycle_income || {};
  const daysUntil = project.estimated_decommission_date
    ? Math.ceil((new Date(project.estimated_decommission_date) - new Date()) / (1000 * 60 * 60 * 24))
    : null;
  const transitions = STATUS_TRANSITIONS[project.status] || [];

  return (
    <>
      <Head><title>{project.name} — SolNuv</title></Head>

      <MotionSection className="mb-6">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-forest-900 via-forest-800 to-emerald-700 px-6 py-7 text-white">
          <div className="absolute -right-20 -top-24 h-56 w-56 rounded-full bg-amber-300/20 blur-3xl" />
          <div className="absolute -left-20 -bottom-24 h-56 w-56 rounded-full bg-emerald-300/20 blur-3xl" />
          <div className="relative">
            <div className="flex items-center gap-3 mb-3">
              <Link href="/projects" className="rounded-lg border border-white/25 bg-white/10 px-3 py-1.5 text-sm font-medium inline-flex items-center gap-1.5 hover:bg-white/20 transition-colors">
                <RiArrowLeftLine /> Projects
              </Link>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="font-display font-bold text-3xl">{project.name}</h1>
                  <StatusBadge status={project.status} />
                  {project.is_verified && <span className="badge badge-green">✓ Verified</span>}
                </div>
                {project.client_name && <p className="text-white/75 text-sm mt-1">Client: {project.client_name}</p>}
                <p className="text-white/70 text-xs mt-2">{project.city}, {project.state}</p>
              </div>
              <div className="text-left sm:text-right">
                <p className="text-xs text-white/65">Recoverable Silver</p>
                <p className="font-display text-2xl font-bold text-amber-300">{totalSilver.toFixed(2)}g</p>
              </div>
            </div>
          </div>
        </div>
      </MotionSection>

      <MotionSection className="mb-6">
        <div className="flex items-center gap-3 mb-3">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Project Operations</p>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div />
          <div className="flex flex-wrap gap-2">
            {transitions.map(t => (
              <button key={t} onClick={() => handleStatusUpdate(t)} disabled={statusUpdating}
                className={`text-sm px-4 py-2 rounded-xl font-semibold transition-all ${t === 'recycled' ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-amber-100 text-amber-800 hover:bg-amber-200'}`}>
                {statusUpdating ? '...' : t === 'decommissioned' ? '🔧 Mark Decommissioned' : '♻️ Mark Recycled'}
              </button>
            ))}
            {project.status === 'active' && (
              <button onClick={() => setRecoveryModal(true)}
                className="text-sm px-4 py-2 rounded-xl font-semibold bg-forest-900 text-white hover:bg-forest-800 flex items-center gap-1.5">
                <RiTruckLine /> Request Recovery
              </button>
            )}
            <button onClick={() => setDeleteModal(true)} className="p-2.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors" title="Delete project">
              <RiDeleteBinLine />
            </button>
          </div>
        </div>
      </MotionSection>

      <MotionSection className="grid lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-5">
          {/* Dedicated Edit Form */}
          {editMode && (
            <form className="card" onSubmit={handleSaveProjectEdits}>
              <h2 className="font-semibold text-forest-900 mb-4">Edit Project</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="label">Project Name *</label>
                  <input className="input" value={editForm.name} onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))} required />
                </div>
                <div>
                  <label className="label">Client Name</label>
                  <input className="input" value={editForm.client_name} onChange={(e) => setEditForm((prev) => ({ ...prev, client_name: e.target.value }))} />
                </div>
                <div>
                  <label className="label">State *</label>
                  <select className="input" value={editForm.state} onChange={(e) => setEditForm((prev) => ({ ...prev, state: e.target.value }))} required>
                    {NIGERIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">City *</label>
                  <input className="input" value={editForm.city} onChange={(e) => setEditForm((prev) => ({ ...prev, city: e.target.value }))} required />
                </div>
                <div>
                  <label className="label">Geo Source</label>
                  <select className="input" value={editForm.geo_source} onChange={(e) => setEditForm((prev) => ({ ...prev, geo_source: e.target.value }))}>
                    <option value="none">none</option>
                    <option value="manual">manual</option>
                    <option value="image_exif">image_exif</option>
                  </select>
                </div>
                <div>
                  <label className="label">Latitude</label>
                  <input type="number" step="0.000001" className="input" value={editForm.latitude} onChange={(e) => setEditForm((prev) => ({ ...prev, latitude: e.target.value, geo_source: prev.geo_source === 'none' ? 'manual' : prev.geo_source }))} />
                </div>
                <div>
                  <label className="label">Longitude</label>
                  <input type="number" step="0.000001" className="input" value={editForm.longitude} onChange={(e) => setEditForm((prev) => ({ ...prev, longitude: e.target.value, geo_source: prev.geo_source === 'none' ? 'manual' : prev.geo_source }))} />
                </div>
                <div className="sm:col-span-2">
                  <label className="label">Address</label>
                  <input className="input" value={editForm.address} onChange={(e) => setEditForm((prev) => ({ ...prev, address: e.target.value }))} />
                </div>
                <div className="sm:col-span-2">
                  <label className="label">Description</label>
                  <textarea className="input min-h-[90px]" value={editForm.description} onChange={(e) => setEditForm((prev) => ({ ...prev, description: e.target.value }))} />
                </div>
                <div className="sm:col-span-2">
                  <label className="label">Notes</label>
                  <textarea className="input min-h-[90px]" value={editForm.notes} onChange={(e) => setEditForm((prev) => ({ ...prev, notes: e.target.value }))} />
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs text-slate-500 mb-2 font-medium">Project Photo</p>
                <div className="flex items-start gap-3">
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/webp"
                      capture="environment"
                      className="sr-only"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setEditPhotoFile(file);
                        setEditPhotoPreview(URL.createObjectURL(file));
                        const gps = await extractExifGPS(file);
                        if (gps) {
                          setEditForm((prev) => ({ ...prev, latitude: String(gps.lat), longitude: String(gps.lng), geo_source: 'image_exif' }));
                          toast.success('GPS extracted from image');
                        }
                      }}
                    />
                    <span className="btn-outline text-xs inline-flex items-center gap-1"><RiCameraLine /> Upload / Replace Photo</span>
                  </label>
                  {(editPhotoPreview || editForm.project_photo_url) && (
                    <img src={editPhotoPreview || editForm.project_photo_url} alt="Project" className="w-24 h-24 rounded-lg object-cover border border-slate-200" />
                  )}
                </div>
              </div>

              <div className="mt-4 flex gap-2">
                <button type="submit" disabled={editSubmitting} className="btn-primary">{editSubmitting ? 'Saving...' : 'Save Changes'}</button>
                <button type="button" onClick={() => setEditMode(false)} className="btn-ghost">Cancel</button>
              </div>
            </form>
          )}

          {/* Location & Timeline */}
          <div className="card">
            <h2 className="font-semibold text-forest-900 mb-4">Project Info</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <RiMapPinLine className="text-forest-900 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-slate-400 font-medium">LOCATION</p>
                  <p className="text-sm font-semibold text-slate-800">{project.city}, {project.state}</p>
                  {project.address && <p className="text-xs text-slate-500 mt-0.5">{project.address}</p>}
                  {project.degradation_info?.climate_zone && (
                    <p className="text-xs text-amber-600 mt-1">🌡 {project.degradation_info.climate_zone.replace(/_/g, ' ')}</p>
                  )}
                </div>
              </div>
              <div className="flex items-start gap-3">
                <RiCalendarLine className="text-forest-900 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-slate-400 font-medium">INSTALLATION DATE</p>
                  <p className="text-sm font-semibold text-slate-800">
                    {new Date(project.installation_date).toLocaleDateString('en-NG', { year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                </div>
              </div>
              {project.estimated_decommission_date && (
                <div className="flex items-start gap-3">
                  <RiCalendarLine className="text-amber-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-slate-400 font-medium">EST. DECOMMISSION (W. AFRICA ADJUSTED)</p>
                    <p className="text-sm font-semibold text-slate-800">
                      {new Date(project.estimated_decommission_date).toLocaleDateString('en-NG', { year: 'numeric', month: 'long' })}
                    </p>
                    {daysUntil !== null && <UrgencyBadge daysUntil={daysUntil} />}
                  </div>
                </div>
              )}
              {project.degradation_info?.explanation && (
                <div className="sm:col-span-2 bg-amber-50 rounded-xl p-3">
                  <p className="text-xs text-amber-700">{project.degradation_info.explanation}</p>
                </div>
              )}
            </div>
          </div>

          {/* Panels */}
          {panels.length > 0 && (
            <div className="card">
              <h2 className="font-semibold text-forest-900 mb-4 flex items-center gap-2">
                <RiSunLine className="text-amber-500" /> Solar Panels ({totalPanels} total)
              </h2>
              <div className="space-y-3">
                {panels.map(eq => (
                  <div key={eq.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                    <div>
                      <p className="font-semibold text-sm text-slate-800">{eq.brand} {eq.model && `— ${eq.model}`}</p>
                      <p className="text-xs text-slate-500">{eq.size_watts}W × {eq.quantity} panels = {(eq.size_watts * eq.quantity / 1000).toFixed(2)} kWp</p>
                      <p className="text-xs text-slate-400 capitalize">Condition: {eq.condition}</p>
                    </div>
                    <div className="text-right">
                      {eq.estimated_silver_grams > 0 && (
                        <p className="text-xs font-semibold text-amber-600">💎 {eq.estimated_silver_grams.toFixed(2)}g silver</p>
                      )}
                      <span className={`badge text-xs ${eq.condition === 'excellent' || eq.condition === 'good' ? 'badge-green' : 'badge-amber'}`}>
                        {eq.condition}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Batteries */}
          {batteries.length > 0 && (
            <div className="card">
              <h2 className="font-semibold text-forest-900 mb-4 flex items-center gap-2">
                <RiBatteryLine className="text-emerald-500" /> Batteries ({totalBatteries} total)
              </h2>
              <div className="space-y-3">
                {batteries.map(eq => (
                  <div key={eq.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                    <div>
                      <p className="font-semibold text-sm text-slate-800">{eq.brand} {eq.model && `— ${eq.model}`}</p>
                      <p className="text-xs text-slate-500">{eq.capacity_kwh ? `${eq.capacity_kwh}kWh` : ''} × {eq.quantity} unit{eq.quantity !== 1 ? 's' : ''}</p>
                    </div>
                    <span className={`badge text-xs ${eq.condition === 'excellent' || eq.condition === 'good' ? 'badge-green' : 'badge-amber'}`}>
                      {eq.condition}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recovery requests */}
          {project.recovery_requests?.length > 0 && (
            <div className="card">
              <h2 className="font-semibold text-forest-900 mb-3 flex items-center gap-2">
                <RiTruckLine /> Recovery Requests
              </h2>
              {project.recovery_requests.map(r => (
                <div key={r.id} className="p-3 bg-slate-50 rounded-xl">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-medium text-slate-700">Request #{r.id.substring(0, 8).toUpperCase()}</p>
                      {r.preferred_date && <p className="text-xs text-slate-500">Preferred: {new Date(r.preferred_date).toLocaleDateString('en-NG')}</p>}
                    </div>
                    <StatusBadge status={r.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-5">
          {/* Silver value card */}
          {totalSilver > 0 && (
            <div className="bg-forest-900 rounded-2xl p-5 text-white">
              <p className="text-white/70 text-xs font-medium mb-1">RECOVERABLE SILVER</p>
              <p className="font-display text-3xl font-bold text-amber-400">{totalSilver.toFixed(3)}g</p>
              <div className="mt-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-white/70">Formal recovery (35%)</span>
                  <span className="font-semibold text-emerald-400">₦{Math.round(totalSilverValue * 0.35).toLocaleString('en-NG')}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/70">Informal sector</span>
                  <span className="font-semibold text-red-400">₦0</span>
                </div>
              </div>
              <p className="text-xs text-white/40 mt-3">Silver is ~47% of total reclaimable economic value of solar panels</p>
            </div>
          )}

          {/* Recycle income card */}
          {(recycleIncome.total_recycle_ngn > 0 || recycleIncome.total_with_silver_ngn > 0) && (
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-700 to-forest-900 p-5 text-white">
              <div className="absolute -top-6 -right-6 h-24 w-24 rounded-full bg-white/10 blur-xl pointer-events-none" />
              <p className="text-white/70 text-xs font-medium mb-1">EST. RECYCLE INCOME</p>
              <p className="font-display text-3xl font-bold text-emerald-300">
                ₦{(recycleIncome.total_with_silver_ngn || 0).toLocaleString('en-NG')}
              </p>
              <p className="text-[10px] text-white/50 mt-0.5">Recycle + Silver · this project</p>
              <div className="mt-3 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-white/70">Panels (second-life/material)</span>
                  <span className="font-semibold text-amber-300">₦{(recycleIncome.panel_recycle_ngn || 0).toLocaleString('en-NG')}</span>
                </div>
                {(recycleIncome.battery_recycle_ngn || 0) > 0 && (
                  <div className="flex justify-between">
                    <span className="text-white/70">Batteries (second-life/material)</span>
                    <span className="font-semibold text-emerald-300">₦{recycleIncome.battery_recycle_ngn.toLocaleString('en-NG')}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-white/70">Silver recovery</span>
                  <span className="font-semibold text-white/80">₦{(recycleIncome.silver_ngn || 0).toLocaleString('en-NG')}</span>
                </div>
              </div>
              <p className="text-[10px] text-white/40 mt-3">Recycling for re-use is typically 40–74× more valuable than silver-only recovery.</p>
            </div>
          )}

          {/* Actions */}
          <div className="card space-y-3">
            <h2 className="font-semibold text-forest-900 mb-2">Actions</h2>

            {/* QR Code */}
            {project.qr_code_url && (
              <div className="text-center p-4 bg-slate-50 rounded-xl">
                <p className="text-xs text-slate-500 mb-2 font-medium">PROJECT QR CODE</p>
                <img src={project.qr_code_url} alt="QR Code" className="w-32 h-32 mx-auto rounded-xl" />
                <p className="text-xs text-slate-400 mt-2">Scan to verify on-site</p>
                <a href={project.qr_code_url} download={`${project.name}_QR.png`} className="text-xs text-forest-900 font-medium hover:underline mt-1 block">
                  Download QR Code
                </a>
              </div>
            )}

            {/* Cradle-to-Grave Certificate */}
            <button
              onClick={handleDownloadCertificate}
              disabled={certLoading || !isPro}
              className={`w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold transition-all ${isPro ? 'btn-primary' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
            >
              {certLoading ? <LoadingSpinner size="sm" /> : <RiShieldCheckLine />}
              {isPro ? 'Download Certificate' : 'Certificate (Pro+)'}
            </button>

            {!isPro && (
              <Link href="/plans" className="block text-center text-xs text-forest-900 font-medium hover:underline">
                Upgrade to Pro to unlock →
              </Link>
            )}

            <button onClick={() => setEditMode((v) => !v)} className="btn-outline flex items-center justify-center gap-2 w-full text-sm py-3" type="button">
              <RiEditLine /> {editMode ? 'Close Editor' : 'Edit Project'}
            </button>
          </div>

          <div className="card space-y-3">
            <h2 className="font-semibold text-forest-900 mb-1 flex items-center gap-2"><RiQrCodeLine /> Battery Field Ledger</h2>
            <p className="text-xs text-slate-500">Create battery QR cards for technicians to scan, view history, and submit health logs on-site.</p>

            <div className="grid grid-cols-2 gap-2">
              <input className="input text-sm col-span-2" placeholder="Battery brand" value={assetForm.brand}
                onChange={(e) => setAssetForm((prev) => ({ ...prev, brand: e.target.value }))} />
              <select className="input text-sm" value={assetForm.chemistry}
                onChange={(e) => setAssetForm((prev) => ({ ...prev, chemistry: e.target.value }))}>
                <option value="LiFePO4">LiFePO4</option>
                <option value="Lithium-ion">Lithium-ion</option>
                <option value="Lead-acid">Lead-acid</option>
              </select>
              <input type="number" min="0.1" step="0.1" className="input text-sm" placeholder="Capacity kWh" value={assetForm.capacity_kwh}
                onChange={(e) => setAssetForm((prev) => ({ ...prev, capacity_kwh: e.target.value }))} />
              <input type="number" min="1" className="input text-sm" placeholder="Units" value={assetForm.quantity}
                onChange={(e) => setAssetForm((prev) => ({ ...prev, quantity: e.target.value }))} />
              <input type="number" min="1" max="20" className="input text-sm" placeholder="Warranty years" value={assetForm.warranty_years}
                onChange={(e) => setAssetForm((prev) => ({ ...prev, warranty_years: e.target.value }))} />
              <input type="date" className="input text-sm col-span-2" value={assetForm.installation_date}
                onChange={(e) => setAssetForm((prev) => ({ ...prev, installation_date: e.target.value }))} />
            </div>

            <button onClick={handleCreateBatteryAsset} disabled={assetSubmitting} className="btn-primary w-full text-sm py-2.5">
              {assetSubmitting ? 'Generating QR...' : 'Generate Battery QR Ledger'}
            </button>

            <div className="space-y-3 pt-1">
              {assetLoading && <p className="text-xs text-slate-400">Loading battery assets...</p>}
              {!assetLoading && batteryAssets.length === 0 && <p className="text-xs text-slate-400">No battery assets generated yet.</p>}
              {batteryAssets.map((asset) => (
                <div key={asset.id} className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-700">{asset.brand} • {asset.capacity_kwh}kWh</p>
                      <p className="text-xs text-slate-500">{asset.chemistry} • {asset.quantity} unit{asset.quantity !== 1 ? 's' : ''}</p>
                    </div>
                    {asset.qr_image_data_url && <img src={asset.qr_image_data_url} alt="Battery QR" className="w-14 h-14 rounded-lg" />}
                  </div>
                  <div className="flex gap-2 mt-2">
                    <a href={asset.qr_link} target="_blank" rel="noreferrer" className="text-xs font-semibold text-forest-900 hover:underline">Open Field Page</a>
                    {asset.qr_image_data_url && (
                      <a href={asset.qr_image_data_url} download={`battery_qr_${asset.qr_code_data}.png`} className="text-xs font-semibold text-forest-900 hover:underline">Download QR</a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Project metadata */}
          <div className="card">
            <h2 className="font-semibold text-forest-900 mb-3 text-sm">Project Details</h2>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Project ID</span>
                <span className="font-mono text-slate-600">{project.id.substring(0, 12)}...</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">QR Code</span>
                <span className="font-mono text-slate-600">{project.qr_code_data?.substring(0, 10)}...</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Created</span>
                <span className="text-slate-600">{new Date(project.created_at).toLocaleDateString('en-NG')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Last updated</span>
                <span className="text-slate-600">{new Date(project.updated_at).toLocaleDateString('en-NG')}</span>
              </div>
            </div>
          </div>
        </div>
      </MotionSection>

      {/* Delete Confirm Modal */}
      <ConfirmModal
        isOpen={deleteModal}
        onClose={() => setDeleteModal(false)}
        onConfirm={handleDelete}
        title="Delete Project"
        message={`Are you sure you want to delete "${project.name}"? This will also delete all equipment records. This action cannot be undone.`}
        confirmText="Yes, Delete"
        danger
      />

      {/* Recovery Request Modal */}
      {recoveryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setRecoveryModal(false)} />
          <div className="relative bg-white rounded-2xl p-6 max-w-md w-full shadow-xl animate-slide-up">
            <h3 className="font-display font-bold text-forest-900 text-xl mb-1">Request Recovery</h3>
            <p className="text-sm text-slate-500 mb-5">Submit a formal recovery request for {project.name}. Our certified partners will contact you within 24 hours.</p>
            <div className="space-y-4">
              <div>
                <label className="label">Preferred Pickup Date</label>
                <input type="date" className="input" value={recoveryForm.preferred_date}
                  onChange={e => setRecoveryForm(f => ({ ...f, preferred_date: e.target.value }))}
                  min={new Date().toISOString().split('T')[0]} />
              </div>
              <div>
                <label className="label">Pickup Address</label>
                <input className="input" placeholder="Where should we collect from?" value={recoveryForm.pickup_address}
                  onChange={e => setRecoveryForm(f => ({ ...f, pickup_address: e.target.value }))} />
              </div>
              <div>
                <label className="label">Additional Notes</label>
                <input className="input" placeholder="Any special instructions..." value={recoveryForm.notes}
                  onChange={e => setRecoveryForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setRecoveryModal(false)} className="btn-ghost flex-1">Cancel</button>
              <button onClick={handleRequestRecovery} className="btn-primary flex-1">Submit Request</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

ProjectDetail.getLayout = getDashboardLayout;
