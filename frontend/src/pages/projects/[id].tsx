import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState, type Dispatch, type FormEvent, type SetStateAction } from 'react';
import { queryParamToString } from '../../utils/nextRouter';
import { projectsAPI, reportsAPI, engineeringAPI, calculatorAPI, nercAPI, downloadBlob } from '../../services/api';
import type { JsonRecord } from '../../services/api';
import { supabase } from '../../utils/supabase';
import { useAuth } from '../../context/AuthContext';
import { getDashboardLayout } from '../../components/Layout';
import { StatusBadge, UrgencyBadge, CapacityBadge, ConfirmModal, LoadingSpinner } from '../../components/ui/index';
import { MotionSection } from '../../components/PageMotion';
import {
  RiArrowLeftLine, RiEditLine, RiDeleteBinLine, RiDownloadLine,
  RiQrCodeLine, RiSunLine, RiBatteryLine, RiMapPinLine, RiBarChartLine,
  RiCalendarLine, RiRecycleLine, RiShieldCheckLine, RiTruckLine, RiCameraLine,
  RiAddLine, RiCloseLine,
} from 'react-icons/ri';
import toast from 'react-hot-toast';

const STATUS_TRANSITIONS = {
  draft:            ['active'],
  active:           ['maintenance', 'decommissioned'],
  maintenance:      ['active', 'decommissioned'],
  decommissioned:   ['recycled'],
  pending_recovery: ['decommissioned', 'recycled'],
};

const STAGE_LABELS = {
  draft: 'Move to Active',
  active: null,
  maintenance: 'Back to Active',
  decommissioned: 'Mark Recycled',
  recycled: null,
  pending_recovery: 'Mark Decommissioned',
};

const NIGERIAN_STATES = ['Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno','Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','FCT','Gombe','Imo','Jigawa','Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara','Lagos','Nasarawa','Niger','Ogun','Ondo','Osun','Oyo','Plateau','Rivers','Sokoto','Taraba','Yobe','Zamfara'];

function triageLabel(pathway?: string) {
  if (pathway === 'permit_required') return 'Permit mode';
  return 'Registration mode';
}

type EditEquipFormState = {
  brand: string;
  model: string;
  size_watts: string | number;
  capacity_kwh: string | number;
  quantity: number;
  condition: string;
  sourcing_info: string;
  panel_technology: string | null;
  battery_chemistry: string | null;
  serial_numbers_text: string;
};

function parseSerialNumbers(text: string): string[] {
  if (!text) return [];
  const serials = text
    .split(/\r?\n|,/)
    .map((v) => v.trim())
    .filter(Boolean)
    .map((v) => v.toUpperCase());
  return [...new Set(serials)];
}

// ── EquipmentForm must live at MODULE scope (not inside the render function)
// so React never unmounts it mid-keystroke when parent state updates.
function EquipmentForm({
  equipType,
  form,
  setForm,
  onSubmit,
  onCancel,
  submitLabel,
  submitting,
}: {
  equipType: string;
  form: EditEquipFormState;
  setForm: Dispatch<SetStateAction<EditEquipFormState>>;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void | Promise<void>;
  onCancel: () => void;
  submitLabel: string;
  submitting: boolean;
}) {
  return (
    <form onSubmit={onSubmit} className="mt-3 p-3 bg-white border border-forest-900/20 rounded-xl space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2">
          <label className="label text-xs">Brand *</label>
          <input className="input text-sm" value={form.brand} onChange={e => setForm(p => ({ ...p, brand: e.target.value }))} placeholder="e.g. JA Solar" required />
        </div>
        <div>
          <label className="label text-xs">Model</label>
          <input className="input text-sm" value={form.model} onChange={e => setForm(p => ({ ...p, model: e.target.value }))} placeholder="Optional" />
        </div>
        <div>
          <label className="label text-xs">Quantity *</label>
          <input type="number" min="1" className="input text-sm" value={form.quantity} onChange={e => setForm(p => ({ ...p, quantity: Number(e.target.value) || 1 }))} required />
        </div>
        {equipType === 'panel' && (
          <>
            <div>
              <label className="label text-xs">Size (watts) *</label>
              <input type="number" min="1" className="input text-sm" value={form.size_watts} onChange={e => setForm(p => ({ ...p, size_watts: e.target.value }))} placeholder="e.g. 550" required />
            </div>
            <div className="col-span-2">
              <label className="label text-xs">Panel Technology</label>
              <select className="input text-sm" value={form.panel_technology || ''} onChange={e => setForm(p => ({ ...p, panel_technology: e.target.value || null }))}>
                <option value="">— Unknown —</option>
                <optgroup label="p-type Silicon">
                  <option value="poly_bsf">Polycrystalline BSF (Legacy)</option>
                  <option value="mono_perc">Mono PERC (Monofacial)</option>
                  <option value="mono_perc_bi">Mono PERC Bifacial</option>
                </optgroup>
                <optgroup label="n-type Silicon">
                  <option value="topcon_mono">n-type TOPCon (Monofacial)</option>
                  <option value="topcon_bi">n-type TOPCon Bifacial</option>
                  <option value="hpbc_mono">HPBC Mono (Rear Contact)</option>
                  <option value="hpbc_bi">HPBC Bifacial (Rear Contact)</option>
                  <option value="hjt">HJT (Heterojunction)</option>
                  <option value="ibc">IBC (All-Back Contact)</option>
                </optgroup>
                <optgroup label="Thin Film">
                  <option value="thin_film_cdte">Thin Film CdTe (First Solar)</option>
                  <option value="thin_film_cigs">Thin Film CIGS</option>
                </optgroup>
              </select>
            </div>
          </>
        )}
        {equipType === 'battery' && (
          <>
            <div>
              <label className="label text-xs">Capacity (kWh)</label>
              <input type="number" min="0.1" step="0.1" className="input text-sm" value={form.capacity_kwh} onChange={e => setForm(p => ({ ...p, capacity_kwh: e.target.value }))} placeholder="e.g. 5.12" />
            </div>
            <div>
              <label className="label text-xs">Chemistry</label>
              <select className="input text-sm" value={form.battery_chemistry || ''} onChange={e => setForm(p => ({ ...p, battery_chemistry: e.target.value || null }))}>
                <option value="">— Unknown —</option>
                <optgroup label="Lithium">
                  <option value="lfp">LiFePO4</option>
                  <option value="nmc">NMC</option>
                  <option value="nca">NCA (Tesla)</option>
                  <option value="lto">LTO</option>
                </optgroup>
                <optgroup label="Lead Acid">
                  <option value="lead_acid_agm">AGM (Sealed)</option>
                  <option value="lead_acid_gel">Gel (Sealed)</option>
                  <option value="lead_acid_flooded">Flooded (VRLA-FLA)</option>
                </optgroup>
                <optgroup label="Other">
                  <option value="nicd">NiCd (Legacy)</option>
                </optgroup>
              </select>
            </div>
          </>
        )}
        <div>
          <label className="label text-xs">Condition</label>
          <select className="input text-sm" value={form.condition} onChange={e => setForm(p => ({ ...p, condition: e.target.value }))}>
            <option value="excellent">Excellent</option>
            <option value="good">Good</option>
            <option value="fair">Fair</option>
            <option value="poor">Poor</option>
          </select>
        </div>
        <div className="col-span-2">
          <label className="label text-xs">Serial Numbers (optional, one per line)</label>
          <textarea
            className="input text-sm min-h-[72px]"
            value={form.serial_numbers_text}
            onChange={e => setForm(p => ({ ...p, serial_numbers_text: e.target.value }))}
            placeholder="SN-001&#10;SN-002"
          />
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <button type="submit" disabled={submitting} className="btn-primary text-xs py-1.5 px-3">{submitting ? 'Saving...' : submitLabel}</button>
        <button type="button" onClick={onCancel} className="btn-ghost text-xs py-1.5 px-3">Cancel</button>
      </div>
    </form>
  );
}

function extractExifGPS(file: File): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (!file) { resolve(null); return; }
    const isJpeg = file.type === 'image/jpeg' || /\.(jpg|jpeg)$/i.test(file.name || '');
    if (!isJpeg) { resolve(null); return; }
    const reader = new FileReader();
    reader.onload = (e: ProgressEvent<FileReader>) => {
      try {
        const buf = e.target?.result;
        if (!(buf instanceof ArrayBuffer)) { resolve(null); return; }
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
  const id = queryParamToString(router.query.id);
  const { isPro, plan, profile, company } = useAuth();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [calculations, setCalculations] = useState([]);
  const [loadingCalculations, setLoadingCalculations] = useState(false);
  const [calcModalData, setCalcModalData] = useState(null);
  const [deleteModal, setDeleteModal] = useState(false);
  const [recoveryModal, setRecoveryModal] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [certLoading, setCertLoading] = useState(false);
  const [recoveryForm, setRecoveryForm] = useState({
    preferred_date: '',
    pickup_address: '',
    notes: '',
    preferred_recycler: '',
    contact_name: '',
    contact_phone: '',
    contact_email: '',
    requester_company_name: '',
    project_summary: '',
  });
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
  // Equipment editing (draft / maintenance only)
  const [editEquipmentId, setEditEquipmentId] = useState(null);
  const [addingEquipType, setAddingEquipType] = useState(null);
  const [editEquipForm, setEditEquipForm] = useState({ brand: '', model: '', size_watts: '', capacity_kwh: '', quantity: 1, condition: 'good', sourcing_info: '', panel_technology: null, battery_chemistry: null, serial_numbers_text: '' });
  const [equipmentSubmitting, setEquipmentSubmitting] = useState(false);
  const [triage, setTriage] = useState<any>(null);
  const [nercRegistrationStatus, setNercRegistrationStatus] = useState<'unregistered' | 'self_confirmed' | 'assisted_pending' | 'in_review' | 'registered' | 'changes_requested' | 'rejected'>('unregistered');
  const [deleteEquipConfirm, setDeleteEquipConfirm] = useState(null);
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
    gps_accuracy_m: '' as number | '',
    notes: '',
    project_photo_url: '',
    status: 'active',
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
          gps_accuracy_m: payload.gps_accuracy_m ?? '',
          notes: payload.notes || '',
          project_photo_url: payload.project_photo_url || '',
          status: payload.status || 'active',
        });
      })
      .catch((err) => {
        if (err?.response?.status === 404) {
          toast.error('Project not found - it may have been deleted');
          router.replace('/projects');
        } else {
          toast.error('Failed to load project');
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    nercAPI.getProjectTriage(id)
      .then((r) => setTriage(r.data.data || null))
      .catch(() => setTriage(null));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    nercAPI.listProjectApplications(id)
      .then((r) => {
        const apps = r.data?.data || [];
        if (!apps.length) return setNercRegistrationStatus('unregistered');
        const statuses = apps.map((a) => a.status);
        const hasSelfConfirmedSubmitted = apps.some((a) => a.status === 'submitted' && a.application_payload?.request_mode === 'user_portal_confirmation');
        const hasAssistedSubmitted = apps.some((a) => a.status === 'submitted' && a.application_payload?.request_mode === 'solnuv_assisted');
        if (statuses.includes('approved')) return setNercRegistrationStatus('registered');
        if (statuses.includes('in_review')) return setNercRegistrationStatus('in_review');
        if (hasAssistedSubmitted) return setNercRegistrationStatus('assisted_pending');
        if (hasSelfConfirmedSubmitted) return setNercRegistrationStatus('self_confirmed');
        if (statuses.includes('changes_requested')) return setNercRegistrationStatus('changes_requested');
        if (statuses.includes('rejected')) return setNercRegistrationStatus('rejected');
        return setNercRegistrationStatus('unregistered');
      })
      .catch(() => setNercRegistrationStatus('unregistered'));
  }, [id]);

  function nercBadgeClass(status: 'unregistered' | 'self_confirmed' | 'assisted_pending' | 'in_review' | 'registered' | 'changes_requested' | 'rejected') {
    if (status === 'registered') return 'text-emerald-700 border-emerald-200 bg-emerald-50';
    if (status === 'in_review') return 'text-blue-700 border-blue-200 bg-blue-50';
    if (status === 'assisted_pending') return 'text-indigo-700 border-indigo-200 bg-indigo-50';
    if (status === 'self_confirmed') return 'text-cyan-700 border-cyan-200 bg-cyan-50';
    if (status === 'changes_requested') return 'text-amber-700 border-amber-200 bg-amber-50';
    if (status === 'rejected') return 'text-red-700 border-red-200 bg-red-50';
    return 'text-slate-700 border-slate-200 bg-slate-50';
  }

  function nercBadgeText(status: 'unregistered' | 'self_confirmed' | 'assisted_pending' | 'in_review' | 'registered' | 'changes_requested' | 'rejected') {
    if (status === 'registered') return 'NERC Registered';
    if (status === 'in_review') return 'NERC In Review';
    if (status === 'assisted_pending') return 'NERC Assisted Pending';
    if (status === 'self_confirmed') return 'NERC Self-Submitted';
    if (status === 'changes_requested') return 'NERC Changes Needed';
    if (status === 'rejected') return 'NERC Rejected';
    return 'NERC Unregistered';
  }

  useEffect(() => {
    if (!id) return;
    setAssetLoading(true);
    engineeringAPI.listBatteryAssets(id)
      .then((r) => setBatteryAssets(r.data.data || []))
      .catch(() => setBatteryAssets([]))
      .finally(() => setAssetLoading(false));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    setLoadingCalculations(true);
    calculatorAPI.getProjectCalculations(id)
      .then((r) => setCalculations(r.data.data?.active || []))
      .catch(() => setCalculations([]))
      .finally(() => setLoadingCalculations(false));
  }, [id]);

  // Cleanup blob URL to prevent memory leaks
  useEffect(() => {
    return () => {
      if (editPhotoPreview) {
        URL.revokeObjectURL(editPhotoPreview);
      }
    };
  }, [editPhotoPreview]);

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
    } catch (err) {
      if (err?.response?.status === 404) {
        toast.error('Project not found');
        router.push('/projects');
      } else {
        toast.error('Failed to delete project');
      }
    }
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
        status: editForm.status,
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
      toast.success('Pickup request submitted! Our team will contact you within 24 hours.');
      setRecoveryModal(false);
      setRecoveryForm({
        preferred_date: '',
        pickup_address: '',
        notes: '',
        preferred_recycler: '',
        contact_name: '',
        contact_phone: '',
        contact_email: '',
        requester_company_name: '',
        project_summary: '',
      });
      setProject(prev => ({
        ...prev,
        status: 'pending_recovery',
        recovery_requests: [{
          id: `temp-${Date.now()}`,
          status: 'requested',
          decommission_approved: false,
          preferred_date: recoveryForm.preferred_date,
        }, ...(prev?.recovery_requests || [])],
      }));
    } catch (err) { toast.error(err.response?.data?.message || 'Failed to submit pickup request'); }
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

  function startEditEquipment(item) {
    setEditEquipmentId(item.id);
    setAddingEquipType(null);
    setEditEquipForm({
      brand: item.brand || '',
      model: item.model || '',
      size_watts: item.size_watts || '',
      capacity_kwh: item.capacity_kwh || '',
      quantity: item.quantity || 1,
      condition: item.condition || 'good',
      sourcing_info: item.sourcing_info || '',
      panel_technology: item.panel_technology || null,
      battery_chemistry: item.battery_chemistry || null,
      serial_numbers_text: Array.isArray(item.serial_numbers) ? item.serial_numbers.join('\n') : '',
    });
  }

  async function handleSaveEquipment(e, equipmentId) {
    e.preventDefault();
    setEquipmentSubmitting(true);
    try {
      const payload: JsonRecord = {
        brand: editEquipForm.brand,
        model: editEquipForm.model || null,
        quantity: Number(editEquipForm.quantity || 1),
        condition: editEquipForm.condition,
        sourcing_info: editEquipForm.sourcing_info || null,
      };
      if (editEquipForm.size_watts !== '') payload.size_watts = Number(editEquipForm.size_watts);
      if (editEquipForm.capacity_kwh !== '') payload.capacity_kwh = Number(editEquipForm.capacity_kwh);
      if (editEquipForm.panel_technology) payload.panel_technology = editEquipForm.panel_technology;
      if (editEquipForm.battery_chemistry) payload.battery_chemistry = editEquipForm.battery_chemistry;
      payload.serial_numbers = parseSerialNumbers(editEquipForm.serial_numbers_text);
      const { data } = await projectsAPI.updateEquipment(id, equipmentId, payload as JsonRecord);
      const updated = data.data;
      setProject(prev => ({ ...prev, equipment: prev.equipment.map(eq => eq.id === equipmentId ? updated : eq) }));
      setEditEquipmentId(null);
      toast.success('Equipment updated');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update equipment');
    } finally {
      setEquipmentSubmitting(false);
    }
  }

  async function handleAddEquipment(e) {
    e.preventDefault();
    if (!addingEquipType) return;
    if (!editEquipForm.brand.trim()) { toast.error('Brand is required'); return; }
    setEquipmentSubmitting(true);
    try {
      const payload: JsonRecord = {
        equipment_type: addingEquipType,
        brand: editEquipForm.brand,
        model: editEquipForm.model || null,
        quantity: Number(editEquipForm.quantity || 1),
        condition: editEquipForm.condition || 'good',
        sourcing_info: editEquipForm.sourcing_info || null,
      };
      if (addingEquipType === 'panel') {
        if (!editEquipForm.size_watts) { toast.error('Panel wattage required'); setEquipmentSubmitting(false); return; }
        payload.size_watts = Number(editEquipForm.size_watts);
        if (editEquipForm.panel_technology) payload.panel_technology = editEquipForm.panel_technology;
      } else if (addingEquipType === 'battery') {
        if (editEquipForm.capacity_kwh) payload.capacity_kwh = Number(editEquipForm.capacity_kwh);
        if (editEquipForm.battery_chemistry) payload.battery_chemistry = editEquipForm.battery_chemistry;
      }
      payload.serial_numbers = parseSerialNumbers(editEquipForm.serial_numbers_text);
      const { data } = await projectsAPI.addEquipment(id, payload);
      setProject(prev => ({ ...prev, equipment: [...(prev.equipment || []), data.data] }));
      setAddingEquipType(null);
      setEditEquipForm({ brand: '', model: '', size_watts: '', capacity_kwh: '', quantity: 1, condition: 'good', sourcing_info: '', panel_technology: null, battery_chemistry: null, serial_numbers_text: '' });
      toast.success('Equipment added');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add equipment');
    } finally {
      setEquipmentSubmitting(false);
    }
  }

  async function handleDeleteEquipment(equipmentId) {
    try {
      await projectsAPI.deleteEquipment(id, equipmentId);
      setProject(prev => ({ ...prev, equipment: (prev.equipment || []).filter(eq => eq.id !== equipmentId) }));
      setDeleteEquipConfirm(null);
      toast.success('Equipment removed');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove equipment');
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
    ? Math.ceil(
        (new Date(project.estimated_decommission_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      )
    : null;
  const transitions = STATUS_TRANSITIONS[project.status] || [];
  const canEditEquipment = project.status === 'draft' || project.status === 'maintenance';

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
                  <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${nercBadgeClass(nercRegistrationStatus)}`}>
                    {nercBadgeText(nercRegistrationStatus)}
                  </span>
                </div>
                {project.client_name && <p className="text-white/75 text-sm mt-1">Client: {project.client_name}</p>}
                <p className="text-white/70 text-xs mt-2">{project.city}, {project.state}</p>
                {(project.capacity_category || project.capacity_kw) && (
                  <div className="mt-2">
                    <CapacityBadge category={project.capacity_category} kw={project.capacity_kw} />
                  </div>
                )}
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
            {transitions.map(t => {
              if (t === 'decommissioned') {
                const isApproved = project.recovery_requests?.some(r => r.decommission_approved);
                return (
                  <button key={t} onClick={() => {
                    if (!isApproved) {
                      toast.error('A pickup request must be approved by SolNuv before marking decommissioned.');
                      return;
                    }
                    handleStatusUpdate(t);
                  }} disabled={statusUpdating}
                    className={`text-sm px-4 py-2 rounded-xl font-semibold transition-all ${
                      isApproved ? 'bg-amber-100 text-amber-800 hover:bg-amber-200' : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    }`}>
                    {statusUpdating ? '...' : isApproved ? '🔧 Mark Decommissioned' : '🔒 Decommission (Pickup Required)'}
                  </button>
                );
              }
              return (
                <button key={t} onClick={() => handleStatusUpdate(t)} disabled={statusUpdating}
                  className={`text-sm px-4 py-2 rounded-xl font-semibold transition-all ${
                    t === 'recycled' ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                    : t === 'maintenance' ? 'bg-slate-600 text-white hover:bg-slate-700'
                    : t === 'active' ? 'bg-forest-900 text-white hover:bg-forest-800'
                    : 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                  }`}>
                  {statusUpdating ? '...' :
                    t === 'recycled' ? '♻️ Mark Recycled' :
                    t === 'maintenance' ? '🔩 Mark Maintenance' :
                    t === 'active' ? '✅ Mark Active' :
                    `Move to ${t}`
                  }
                </button>
              );
            })}
            {(project.status === 'active' || project.status === 'maintenance') && !project.recovery_requests?.some(r => ['requested', 'scheduled', 'approved'].includes(r.status)) && (
              <button onClick={() => {
                setRecoveryForm(f => ({
                  ...f,
                  pickup_address: project.address || `${project.city || ''}, ${project.state || ''}`.trim(),
                  contact_name: `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim(),
                  contact_phone: profile?.phone || '',
                  contact_email: profile?.email || '',
                  requester_company_name: company?.name || '',
                  project_summary: `${project.equipment?.filter(e=>e.equipment_type==='panel').reduce((s,e)=>s+e.quantity,0)||0} panels, ${project.equipment?.filter(e=>e.equipment_type==='battery').reduce((s,e)=>s+e.quantity,0)||0} batteries — ${project.capacity_kw ? project.capacity_kw+'kW' : ''}`.trim().replace(/,\s*$/, ''),
                }));
                setRecoveryModal(true);
              }}
                className="text-sm px-4 py-2 rounded-xl font-semibold bg-forest-900 text-white hover:bg-forest-800 flex items-center gap-1.5">
                <RiTruckLine /> Request Pickup & Testing
              </button>
            )}
            {project.recovery_requests?.some(r => r.status === 'requested' && !r.decommission_approved) && (
              <span className="text-sm px-3 py-2 rounded-xl bg-amber-50 text-amber-700 font-medium flex items-center gap-1">
                ⏳ Awaiting Admin Approval
              </span>
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
                    <option value="device_gps">device_gps</option>
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
                <div className="sm:col-span-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (!navigator.geolocation) { toast.error('Geolocation not supported'); return; }
                      navigator.geolocation.getCurrentPosition(
                        (pos) => {
                          setEditForm((prev) => ({
                            ...prev,
                            latitude: pos.coords.latitude.toFixed(6),
                            longitude: pos.coords.longitude.toFixed(6),
                            geo_source: 'device_gps',
                            gps_accuracy_m: Math.round(pos.coords.accuracy || 0),
                          }));
                          toast.success('Device location captured!');
                        },
                        () => toast.error('Failed to get device location'),
                        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
                      );
                    }}
                    className="text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg hover:bg-emerald-100 transition-colors"
                  >
                    📍 Use My Location
                  </button>
                  {editForm.latitude && editForm.longitude && (
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const { data } = await projectsAPI.geoVerify(id, {
                            latitude: editForm.latitude,
                            longitude: editForm.longitude,
                            source: editForm.geo_source,
                            accuracy_m:
                              editForm.gps_accuracy_m === '' ? undefined : Number(editForm.gps_accuracy_m) || undefined,
                          });
                          const v = data.data;
                          if (v.verified) {
                            toast.success(`Location verified! ${v.confidence_pct}% confidence`);
                          } else {
                            toast(`Verification: ${v.confidence_pct}% confidence — ${v.distance_m}m from address`, { icon: '⚠️' });
                          }
                        } catch (err) {
                          toast.error(err.response?.data?.message || 'Verification failed');
                        }
                      }}
                      className="text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors"
                    >
                      📍 Verify Location
                    </button>
                  )}
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
                <div className="sm:col-span-2">
                  <label className="label">Project Stage</label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {[
                      { value: 'draft', label: 'Draft' },
                      { value: 'active', label: 'Active' },
                      { value: 'maintenance', label: 'Under Maintenance/Upgrade' },
                      { value: 'decommissioned', label: 'Decommissioned' },
                    ].map(stage => (
                      <button
                        key={stage.value}
                        type="button"
                        onClick={() => setEditForm(prev => ({ ...prev, status: stage.value }))}
                        className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${
                          editForm.status === stage.value
                            ? 'bg-forest-900 text-white border-forest-900'
                            : 'bg-white text-slate-600 border-slate-200 hover:border-forest-900'
                        }`}
                      >
                        {stage.label}
                      </button>
                    ))}
                  </div>
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
              {/* Capacity */}
              {project.capacity_kw > 0 && (
                <div className="flex items-start gap-3">
                  <span className="text-forest-900 mt-0.5 flex-shrink-0 text-base">⚡</span>
                  <div>
                    <p className="text-xs text-slate-400 font-medium">SYSTEM CAPACITY</p>
                    <p className="text-sm font-semibold text-slate-800">
                      {project.capacity_kw % 1 === 0 ? project.capacity_kw : project.capacity_kw?.toFixed(2)} kW combined
                    </p>
                    {project.capacity_category && (
                      <CapacityBadge category={project.capacity_category} />
                    )}
                  </div>
                </div>
              )}
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
          {(panels.length > 0 || (canEditEquipment && addingEquipType === 'panel')) && (
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-forest-900 flex items-center gap-2">
                  <RiSunLine className="text-amber-500" /> Solar Panels ({totalPanels} total)
                </h2>
                {canEditEquipment && addingEquipType !== 'panel' && (
                  <button type="button" onClick={() => { setAddingEquipType('panel'); setEditEquipmentId(null); setEditEquipForm({ brand: '', model: '', size_watts: '', capacity_kwh: '', quantity: 1, condition: 'good', sourcing_info: '', panel_technology: null, battery_chemistry: null, serial_numbers_text: '' }); }}
                    className="flex items-center gap-1 text-xs font-semibold text-forest-900 border border-forest-900/30 rounded-lg px-2 py-1 hover:bg-forest-900/5 transition-colors">
                    <RiAddLine /> Add Panel
                  </button>
                )}
              </div>
              <div className="space-y-3">
                {panels.map(eq => (
                  <div key={eq.id}>
                    {editEquipmentId === eq.id ? (
                      <EquipmentForm equipType="panel" form={editEquipForm} setForm={setEditEquipForm} submitting={equipmentSubmitting} onSubmit={e => handleSaveEquipment(e, eq.id)} onCancel={() => setEditEquipmentId(null)} submitLabel="Save Panel" />
                    ) : (
                      <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                        <div>
                          <p className="font-semibold text-sm text-slate-800">{eq.brand} {eq.model && `— ${eq.model}`}</p>
                          <p className="text-xs text-slate-500">{eq.size_watts}W × {eq.quantity} panels = {(eq.size_watts * eq.quantity / 1000).toFixed(2)} kWp</p>
                          {Array.isArray(eq.serial_numbers) && eq.serial_numbers.length > 0 && (
                            <p className="text-xs text-slate-500">Serials: {eq.serial_numbers.length}</p>
                          )}
                          <p className="text-xs text-slate-400 capitalize">Condition: {eq.condition}</p>
                        </div>
                        <div className="text-right flex flex-col items-end gap-1.5">
                          {eq.estimated_silver_grams > 0 && (
                            <p className="text-xs font-semibold text-amber-600">💎 {eq.estimated_silver_grams.toFixed(2)}g silver</p>
                          )}
                          <span className={`badge text-xs ${eq.condition === 'excellent' || eq.condition === 'good' ? 'badge-green' : 'badge-amber'}`}>
                            {eq.condition}
                          </span>
                          {canEditEquipment && (
                            <div className="flex gap-1 mt-0.5">
                              <button type="button" onClick={() => startEditEquipment(eq)} className="text-xs text-forest-900 hover:underline flex items-center gap-0.5"><RiEditLine className="text-xs" /> Edit</button>
                              <span className="text-slate-300">·</span>
                              <button type="button" onClick={() => setDeleteEquipConfirm(eq.id)} className="text-xs text-red-500 hover:underline flex items-center gap-0.5"><RiDeleteBinLine className="text-xs" /> Remove</button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    {deleteEquipConfirm === eq.id && (
                      <div className="mt-1 p-2 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between gap-2">
                        <p className="text-xs text-red-700">Remove this panel? This cannot be undone.</p>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => handleDeleteEquipment(eq.id)} className="text-xs font-semibold text-red-600 hover:underline">Yes, Remove</button>
                          <button type="button" onClick={() => setDeleteEquipConfirm(null)} className="text-xs text-slate-500 hover:underline">Cancel</button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {canEditEquipment && addingEquipType === 'panel' && (
                  <EquipmentForm equipType="panel" form={editEquipForm} setForm={setEditEquipForm} submitting={equipmentSubmitting} onSubmit={handleAddEquipment} onCancel={() => setAddingEquipType(null)} submitLabel="Add Panel" />
                )}
              </div>
            </div>
          )}

          {/* Batteries */}
          {(batteries.length > 0 || (canEditEquipment && addingEquipType === 'battery')) && (
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-forest-900 flex items-center gap-2">
                  <RiBatteryLine className="text-emerald-500" /> Batteries ({totalBatteries} total)
                </h2>
                {canEditEquipment && addingEquipType !== 'battery' && (
                  <button type="button" onClick={() => { setAddingEquipType('battery'); setEditEquipmentId(null); setEditEquipForm({ brand: '', model: '', size_watts: '', capacity_kwh: '', quantity: 1, condition: 'good', sourcing_info: '', panel_technology: null, battery_chemistry: null, serial_numbers_text: '' }); }}
                    className="flex items-center gap-1 text-xs font-semibold text-forest-900 border border-forest-900/30 rounded-lg px-2 py-1 hover:bg-forest-900/5 transition-colors">
                    <RiAddLine /> Add Battery
                  </button>
                )}
              </div>
              <div className="space-y-3">
                {batteries.map(eq => (
                  <div key={eq.id}>
                    {editEquipmentId === eq.id ? (
                      <EquipmentForm equipType="battery" form={editEquipForm} setForm={setEditEquipForm} submitting={equipmentSubmitting} onSubmit={e => handleSaveEquipment(e, eq.id)} onCancel={() => setEditEquipmentId(null)} submitLabel="Save Battery" />
                    ) : (
                      <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                        <div>
                          <p className="font-semibold text-sm text-slate-800">{eq.brand} {eq.model && `— ${eq.model}`}</p>
                          <p className="text-xs text-slate-500">{eq.capacity_kwh ? `${eq.capacity_kwh}kWh` : ''} × {eq.quantity} unit{eq.quantity !== 1 ? 's' : ''}</p>
                          {Array.isArray(eq.serial_numbers) && eq.serial_numbers.length > 0 && (
                            <p className="text-xs text-slate-500">Serials: {eq.serial_numbers.length}</p>
                          )}
                          <p className="text-xs text-slate-400 capitalize">Condition: {eq.condition}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1.5">
                          <span className={`badge text-xs ${eq.condition === 'excellent' || eq.condition === 'good' ? 'badge-green' : 'badge-amber'}`}>
                            {eq.condition}
                          </span>
                          {canEditEquipment && (
                            <div className="flex gap-1">
                              <button type="button" onClick={() => startEditEquipment(eq)} className="text-xs text-forest-900 hover:underline flex items-center gap-0.5"><RiEditLine className="text-xs" /> Edit</button>
                              <span className="text-slate-300">·</span>
                              <button type="button" onClick={() => setDeleteEquipConfirm(eq.id)} className="text-xs text-red-500 hover:underline flex items-center gap-0.5"><RiDeleteBinLine className="text-xs" /> Remove</button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    {deleteEquipConfirm === eq.id && (
                      <div className="mt-1 p-2 bg-red-50 border border-red-200 rounded-lg flex items-center justify-between gap-2">
                        <p className="text-xs text-red-700">Remove this battery? This cannot be undone.</p>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => handleDeleteEquipment(eq.id)} className="text-xs font-semibold text-red-600 hover:underline">Yes, Remove</button>
                          <button type="button" onClick={() => setDeleteEquipConfirm(null)} className="text-xs text-slate-500 hover:underline">Cancel</button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {canEditEquipment && addingEquipType === 'battery' && (
                  <EquipmentForm equipType="battery" form={editEquipForm} setForm={setEditEquipForm} submitting={equipmentSubmitting} onSubmit={handleAddEquipment} onCancel={() => setAddingEquipType(null)} submitLabel="Add Battery" />
                )}
              </div>
            </div>
          )}
          {/* Add-equipment prompt cards when project is editable but has no items yet */}
          {canEditEquipment && panels.length === 0 && addingEquipType !== 'panel' && (
            <button type="button" onClick={() => { setAddingEquipType('panel'); setEditEquipmentId(null); setEditEquipForm({ brand: '', model: '', size_watts: '', capacity_kwh: '', quantity: 1, condition: 'good', sourcing_info: '', panel_technology: null, battery_chemistry: null, serial_numbers_text: '' }); }}
              className="w-full border-2 border-dashed border-amber-300 rounded-2xl p-4 text-sm text-amber-700 font-medium hover:bg-amber-50 transition-colors flex items-center justify-center gap-2">
              <RiAddLine /> Add Solar Panels
            </button>
          )}
          {canEditEquipment && batteries.length === 0 && addingEquipType !== 'battery' && (
            <>
              {addingEquipType === 'panel' && (
                <div className="card">
                  <h2 className="font-semibold text-forest-900 mb-3 flex items-center gap-2"><RiSunLine className="text-amber-500" /> Add Panel</h2>
                  <EquipmentForm equipType="panel" form={editEquipForm} setForm={setEditEquipForm} submitting={equipmentSubmitting} onSubmit={handleAddEquipment} onCancel={() => setAddingEquipType(null)} submitLabel="Add Panel" />
                </div>
              )}
              <button type="button" onClick={() => { setAddingEquipType('battery'); setEditEquipmentId(null); setEditEquipForm({ brand: '', model: '', size_watts: '', capacity_kwh: '', quantity: 1, condition: 'good', sourcing_info: '', panel_technology: null, battery_chemistry: null, serial_numbers_text: '' }); }}
                className="w-full border-2 border-dashed border-emerald-300 rounded-2xl p-4 text-sm text-emerald-700 font-medium hover:bg-emerald-50 transition-colors flex items-center justify-center gap-2">
                <RiAddLine /> Add Batteries
              </button>
            </>
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

          {/* Calculations */}
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-forest-900 flex items-center gap-2">
                <RiBarChartLine className="text-emerald-600" /> Calculations
              </h2>
              <Link href={`/projects/${id}/calculations`} className="text-xs text-forest-900 hover:underline font-medium">
                View All →
              </Link>
            </div>
            {loadingCalculations ? (
              <div className="py-4 text-center text-sm text-slate-500">Loading...</div>
            ) : calculations.length > 0 ? (
              <div className="space-y-2">
                <p className="text-2xl font-display font-bold text-forest-900">{calculations.length}</p>
                <p className="text-xs text-slate-500">{calculations.length === 1 ? 'Saved calculation' : 'Saved calculations'}</p>
                <div className="pt-2 border-t border-slate-100">
                  {calculations.slice(0, 3).map(calc => (
                    <button
                      key={calc.id}
                      onClick={() => {
                        const calcData = typeof calc.calculation_data === 'string' ? JSON.parse(calc.calculation_data) : calc.calculation_data;
                        setCalcModalData({ ...calc, calculation_data: calcData });
                      }}
                      className="w-full text-left p-2 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-700 capitalize">{calc.calculator_type?.replace('_', ' ')}</span>
                        <span className="text-xs text-slate-400">{new Date(calc.created_at).toLocaleDateString()}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-sm text-slate-500 mb-3">No calculations saved yet</p>
                <Link href="/calculator" className="text-xs font-medium text-forest-900 hover:underline">
                  Go to Calculator →
                </Link>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="card space-y-3">
            <h2 className="font-semibold text-forest-900 mb-2">Actions</h2>

            {/* QR Code */}
            {project.qr_code_url && (
              isPro ? (
                <div className="text-center p-4 bg-slate-50 rounded-xl">
                  <p className="text-xs text-slate-500 mb-2 font-medium">PROJECT QR CODE</p>
                  <img src={project.qr_code_url} alt="QR Code" className="w-32 h-32 mx-auto rounded-xl" />
                  <p className="text-xs text-slate-400 mt-2">Scan to verify on-site</p>
                  <a href={project.qr_code_url} download={`${project.name}_QR.png`} className="text-xs text-forest-900 font-medium hover:underline mt-1 block">
                    Download QR Code
                  </a>
                </div>
              ) : (
                <div className="text-center p-4 bg-amber-50 border border-amber-200 rounded-xl">
                  <p className="text-xs font-semibold text-amber-700 mb-1">🔒 QR Code — Pro Feature</p>
                  <p className="text-xs text-amber-600 mb-2">Unlock project QR codes for on-site scanning and field traceability.</p>
                  <Link href="/plans" className="text-xs font-semibold text-forest-900 hover:underline">Upgrade to Pro →</Link>
                </div>
              )
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

            <Link href={`/projects/${project.id}/design`}
              className="btn-primary flex items-center justify-center gap-2 w-full text-sm py-3 bg-gradient-to-r from-forest-900 to-green-700 hover:from-green-800 hover:to-green-600">
              <RiSunLine /> Design Solar + BESS System
            </Link>

            {triage && (
              <div className="rounded-xl border border-forest-900/20 bg-forest-900/5 p-3">
                <p className="text-xs uppercase tracking-wide text-slate-500">Compliance Next Step</p>
                <p className="text-sm font-semibold text-forest-900 mt-1">
                  {triageLabel(triage.regulatory_pathway)}
                  {triage.net_metering_eligible ? ' · Net metering eligible' : ''}
                </p>
                <p className="text-xs text-slate-600 mt-1">
                  {Number(triage.capacity_kw || 0).toFixed(2)} kW · Reporting {triage.reporting_cadence}
                </p>
                <Link
                  href={`/projects/${project.id}/regulatory`}
                  className="mt-2 inline-flex items-center justify-center rounded-lg bg-forest-900 text-white text-xs font-semibold px-3 py-1.5 hover:bg-forest-800 transition-colors"
                >
                  Continue Compliance Flow
                </Link>
              </div>
            )}

            <Link
              href={`/projects/${project.id}/regulatory`}
              className="btn-outline flex items-center justify-center gap-2 w-full text-sm py-3 border-forest-900/40 text-forest-900 hover:bg-forest-50"
            >
              <RiShieldCheckLine /> NERC Regulatory Workspace
            </Link>

            {project.design_completed_at && (
              <Link href={`/projects/${project.id}/results`}
                className="btn-outline flex items-center justify-center gap-2 w-full text-sm py-3 border-green-600 text-green-700 hover:bg-green-50">
                <RiBarChartLine /> View Design Results
              </Link>
            )}

            <button onClick={() => setEditMode((v) => !v)} className="btn-outline flex items-center justify-center gap-2 w-full text-sm py-3" type="button">
              <RiEditLine /> {editMode ? 'Close Editor' : 'Edit Project'}
            </button>
          </div>

          <div className="card space-y-3">
            <h2 className="font-semibold text-forest-900 mb-1 flex items-center gap-2"><RiQrCodeLine /> Battery Field Ledger</h2>
            <p className="text-xs text-slate-500">Create battery QR cards for technicians to scan, view history, and submit health logs on-site.</p>

            {!isPro && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-center">
                <p className="text-xs font-semibold text-amber-700 mb-1">🔒 Battery QR Ledger — Pro Feature</p>
                <p className="text-xs text-amber-600 mb-2">Generate field QR codes for battery health logs and technician tracking.</p>
                <Link href="/plans" className="text-xs font-semibold text-forest-900 hover:underline">Upgrade to Pro →</Link>
              </div>
            )}

            {isPro && (
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
                  onChange={(e) => setAssetForm((prev) => ({ ...prev, quantity: Number(e.target.value) || 1 }))} />
                <input type="number" min="1" max="20" className="input text-sm" placeholder="Warranty years" value={assetForm.warranty_years}
                  onChange={(e) => setAssetForm((prev) => ({ ...prev, warranty_years: Number(e.target.value) || 5 }))} />
                <input type="date" className="input text-sm col-span-2" value={assetForm.installation_date}
                  onChange={(e) => setAssetForm((prev) => ({ ...prev, installation_date: e.target.value }))} />
              </div>
            )}

            {isPro && (
              <>
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
              </>
            )}
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

      {/* Calculation Detail Modal */}
      {calcModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setCalcModalData(null)} />
          <div className="relative bg-white rounded-2xl p-6 max-w-lg w-full shadow-xl animate-slide-up overflow-y-auto max-h-[90vh]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-bold text-forest-900 text-lg capitalize">
                {calcModalData.calculator_type?.replace('_', ' ')} Calculation
              </h3>
              <button onClick={() => setCalcModalData(null)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
                <RiCloseLine className="text-slate-500" />
              </button>
            </div>
            <div className="text-xs text-slate-400 mb-4">
              Saved {new Date(calcModalData.created_at).toLocaleDateString('en-NG', { year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
            {calcModalData.calculation_data && (
              <div className="bg-slate-50 rounded-xl p-4 space-y-2">
                {Object.entries(calcModalData.calculation_data).map(([key, value]) => (
                  <div key={key} className="flex justify-between text-sm">
                    <span className="text-slate-500 capitalize">{key.replace(/_/g, ' ')}</span>
                    <span className="font-medium text-slate-700">
                      {typeof value === 'number' ? value.toLocaleString() : String(value ?? '')}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-3 mt-4">
              <Link href={`/calculator/${calcModalData.calculator_type}`} className="flex-1 btn-primary text-center">
                Open in Calculator
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Pickup & Testing Request Modal */}
      {recoveryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setRecoveryModal(false)} />
          <div className="relative bg-white rounded-2xl p-6 max-w-xl w-full shadow-xl animate-slide-up overflow-y-auto max-h-[90vh]">
            <h3 className="font-display font-bold text-forest-900 text-xl mb-1">Request Pickup & Testing</h3>
            <p className="text-sm text-slate-500 mb-5">Submit a formal pickup request for <strong>{project.name}</strong>. Once approved, you can mark the project as decommissioned.</p>

            {/* Auto-populated project info */}
            <div className="bg-slate-50 rounded-xl p-4 mb-5 space-y-1">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Project Details (Auto-filled)</p>
              <p className="text-sm text-slate-700"><span className="font-medium">Project:</span> {project.name} — {project.city}, {project.state}</p>
              <p className="text-sm text-slate-700"><span className="font-medium">System:</span> {recoveryForm.project_summary || 'N/A'}</p>
              <p className="text-sm text-slate-700"><span className="font-medium">Company:</span> {recoveryForm.requester_company_name || '—'}</p>
            </div>

            <div className="space-y-4">
              {/* Contact details (auto-populated, editable) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Your Name</label>
                  <input className="input" value={recoveryForm.contact_name}
                    onChange={e => setRecoveryForm(f => ({ ...f, contact_name: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Your Phone</label>
                  <input className="input" value={recoveryForm.contact_phone}
                    onChange={e => setRecoveryForm(f => ({ ...f, contact_phone: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="label">Your Email</label>
                <input className="input" type="email" value={recoveryForm.contact_email}
                  onChange={e => setRecoveryForm(f => ({ ...f, contact_email: e.target.value }))} />
              </div>

              {/* Pickup details */}
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

              {/* Recycler preference */}
              <div>
                <label className="label">Preferred Recycling Partner</label>
                <select className="input" value={recoveryForm.preferred_recycler}
                  onChange={e => setRecoveryForm(f => ({ ...f, preferred_recycler: e.target.value }))}>
                  <option value="">Leave decision to SolNuv (recommended)</option>
                  <option value="ocel">OCEL — Oando Clean Energy Ltd (Solar & Battery)</option>
                  <option value="e-terra">E-Terra Nigeria</option>
                  <option value="tara_tinafiri">Tara Tinafiri Recycling</option>
                  <option value="rabtex">Rabtex Industries</option>
                </select>
              </div>

              <div>
                <label className="label">Additional Notes</label>
                <textarea className="input min-h-[72px]" placeholder="Access instructions, safety concerns, or any special notes..."
                  value={recoveryForm.notes}
                  onChange={e => setRecoveryForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </div>

            <p className="text-xs text-slate-400 mt-4">SolNuv will review your request and notify you within 1–2 business days. Decommissioning will be unlocked after admin approval.</p>

            <div className="flex gap-3 mt-5">
              <button onClick={() => setRecoveryModal(false)} className="btn-ghost flex-1">Cancel</button>
              <button onClick={handleRequestRecovery} className="btn-primary flex-1">Submit Pickup Request</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

ProjectDetail.getLayout = getDashboardLayout;
