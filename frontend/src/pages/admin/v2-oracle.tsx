import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import AdminRoute from "../../components/AdminRoute";
import { getAdminLayout } from "../../components/Layout";
import { v2API } from "../../services/api";

type AnyRecord = Record<string, any>;

function prettyJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function V2OraclePageInner() {
  const [organizationId, setOrganizationId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [policyName, setPolicyName] = useState("Default escrow policy");
  const [serialInput, setSerialInput] = useState("");
  const [decisionId, setDecisionId] = useState("");
  const [assetUnitId, setAssetUnitId] = useState("");
  const [eventType, setEventType] = useState("commissioning_confirmed");
  const [eventPayload, setEventPayload] = useState('{"source":"admin_console","notes":"V2 lifecycle check"}');
  const [result, setResult] = useState<AnyRecord | null>(null);
  const [busy, setBusy] = useState(false);

  const serials = useMemo(
    () =>
      serialInput
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .filter(Boolean),
    [serialInput]
  );

  async function runAction<T>(fn: () => Promise<T>, successMessage: string) {
    setBusy(true);
    try {
      const response: AnyRecord = await fn();
      setResult(response?.data || response);
      toast.success(successMessage);
    } catch (err: unknown) {
      const typed = err as AnyRecord;
      toast.error(typed?.response?.data?.message || "Action failed");
      setResult(typed?.response?.data || { error: typed?.message || "Unknown error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <h1 className="text-xl font-bold text-slate-900">V2 Oracle Console</h1>
        <p className="text-sm text-slate-500 mt-1">
          Operate V2 onboarding, serial registry, escrow policy, and release execution flows.
        </p>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
          <h2 className="font-semibold text-slate-800">Core IDs</h2>
          <input
            className="input w-full"
            placeholder="Organization ID"
            value={organizationId}
            onChange={(e) => setOrganizationId(e.target.value)}
          />
          <input
            className="input w-full"
            placeholder="Project ID"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
          />
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
          <h2 className="font-semibold text-slate-800">Health</h2>
          <button
            className="btn-primary"
            disabled={busy}
            onClick={() => runAction(() => v2API.health(), "V2 health fetched")}
          >
            {busy ? "Running..." : "Check V2 Health"}
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
        <h2 className="font-semibold text-slate-800">Lifecycle Events</h2>
        <div className="grid lg:grid-cols-3 gap-2">
          <input
            className="input"
            placeholder="Asset Unit ID (optional)"
            value={assetUnitId}
            onChange={(e) => setAssetUnitId(e.target.value)}
          />
          <input
            className="input"
            placeholder="Event type"
            value={eventType}
            onChange={(e) => setEventType(e.target.value)}
          />
          <button
            className="btn-ghost"
            disabled={busy || !organizationId}
            onClick={() =>
              runAction(
                () => v2API.listLifecycleEvents(organizationId, projectId ? { project_id: projectId } : {}),
                "Lifecycle events loaded"
              )
            }
          >
            List Events
          </button>
        </div>
        <textarea
          className="input w-full min-h-[110px]"
          placeholder='{"key":"value"}'
          value={eventPayload}
          onChange={(e) => setEventPayload(e.target.value)}
        />
        <button
          className="btn-primary"
          disabled={busy || !organizationId || !projectId || !eventType}
          onClick={() => {
            let parsedPayload: AnyRecord = {};
            try {
              parsedPayload = JSON.parse(eventPayload || "{}");
            } catch {
              toast.error("Invalid JSON in event payload");
              return;
            }
            void runAction(
              () =>
                v2API.createLifecycleEvent({
                  organization_id: organizationId,
                  project_id: projectId,
                  asset_unit_id: assetUnitId || null,
                  event_type: eventType,
                  event_payload: parsedPayload,
                }),
              "Lifecycle event recorded"
            );
          }}
        >
          {busy ? "Running..." : "Record Event"}
        </button>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
          <h2 className="font-semibold text-slate-800">Create Escrow Policy</h2>
          <input
            className="input w-full"
            placeholder="Template name"
            value={policyName}
            onChange={(e) => setPolicyName(e.target.value)}
          />
          <button
            className="btn-primary"
            disabled={busy || !organizationId}
            onClick={() =>
              runAction(
                () =>
                  v2API.createEscrowPolicy({
                    organization_id: organizationId,
                    template_name: policyName,
                    policy_version: "v2.0.0",
                    required_conditions: [
                      "serials_validated",
                      "decommission_request_present",
                      "recycler_certificate_present",
                      "custody_chain_complete",
                      "evidence_bundle_attested",
                    ],
                    penalty_mode: "hold",
                  }),
                "Escrow policy created"
              )
            }
          >
            {busy ? "Running..." : "Create Policy"}
          </button>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
          <h2 className="font-semibold text-slate-800">List Escrow Policies</h2>
          <button
            className="btn-primary"
            disabled={busy || !organizationId}
            onClick={() =>
              runAction(
                () => v2API.listEscrowPolicies(organizationId),
                "Escrow policies loaded"
              )
            }
          >
            {busy ? "Running..." : "List Policies"}
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
          <h2 className="font-semibold text-slate-800">Serial Registration</h2>
          <textarea
            className="input w-full min-h-[140px]"
            placeholder="Paste serials (comma or newline separated)"
            value={serialInput}
            onChange={(e) => setSerialInput(e.target.value)}
          />
          <p className="text-xs text-slate-500">{serials.length} serial(s) prepared</p>
          <button
            className="btn-primary"
            disabled={busy || !organizationId || !projectId || serials.length === 0}
            onClick={() =>
              runAction(
                () =>
                  v2API.registerSerials({
                    organization_id: organizationId,
                    project_id: projectId,
                    equipment_type: "panel",
                    serial_numbers: serials,
                    financed: true,
                  }),
                "Serials registered"
              )
            }
          >
            {busy ? "Running..." : "Register Serials"}
          </button>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
          <h2 className="font-semibold text-slate-800">Evaluate Escrow Decision</h2>
          <button
            className="btn-primary"
            disabled={busy || !organizationId || !projectId}
            onClick={() =>
              runAction(
                () =>
                  v2API.evaluateEscrowDecision({
                    organization_id: organizationId,
                    project_id: projectId,
                    condition_flags: {
                      serials_validated: true,
                      decommission_request_present: true,
                      recycler_certificate_present: true,
                      custody_chain_complete: true,
                      evidence_bundle_attested: true,
                    },
                    release_amount_ngn: 1000000,
                    hold_amount_ngn: 0,
                  }),
                "Escrow decision evaluated"
              )
            }
          >
            {busy ? "Running..." : "Evaluate Decision"}
          </button>
          <div className="flex gap-2">
            <input
              className="input flex-1"
              placeholder="Decision ID for custodian execution"
              value={decisionId}
              onChange={(e) => setDecisionId(e.target.value)}
            />
            <button
              className="btn-ghost"
              disabled={busy || !decisionId || !organizationId}
              onClick={() =>
                runAction(
                  () => v2API.executeEscrowDecision(decisionId, organizationId),
                  "Custodian execution submitted"
                )
              }
            >
              Execute
            </button>
          </div>
        </div>
      </div>

      <div className="bg-slate-950 text-slate-100 rounded-2xl p-4 overflow-auto">
        <p className="text-xs uppercase tracking-wider text-slate-400 mb-2">Result</p>
        <pre className="text-xs whitespace-pre-wrap">{prettyJson(result || {})}</pre>
      </div>
    </div>
  );
}

export default function V2OraclePage() {
  return (
    <AdminRoute requiredRoles={["super_admin", "operations", "finance"]}>
      <V2OraclePageInner />
    </AdminRoute>
  );
}

V2OraclePage.getLayout = getAdminLayout;

