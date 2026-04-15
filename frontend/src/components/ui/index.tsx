import { ChangeEvent, ReactNode } from "react";
import type { IconType } from "react-icons";

type ThemeColor = "forest" | "amber" | "emerald" | "slate" | "white";

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon?: IconType;
  color?: ThemeColor;
  trend?: number;
}

export function StatCard({ label, value, sub, icon: Icon, color = "forest", trend }: StatCardProps) {
  const colors: Record<ThemeColor, string> = {
    forest: "bg-forest-900 text-white",
    amber: "bg-amber-500 text-forest-900",
    emerald: "bg-emerald-500 text-white",
    slate: "bg-slate-100 text-slate-700",
    white: "bg-white border border-slate-100 text-slate-800",
  };
  const iconBgs: Record<ThemeColor, string> = {
    forest: "bg-white/20",
    amber: "bg-forest-900/10",
    emerald: "bg-white/20",
    slate: "bg-white",
    white: "bg-forest-900/5",
  };

  return (
    <div className={`rounded-2xl p-6 ${colors[color]} shadow-sm`}>
      <div className="flex items-start justify-between mb-4">
        <p className="text-sm font-medium opacity-80">{label}</p>
        {Icon && (
          <div className={`w-9 h-9 rounded-xl ${iconBgs[color]} flex items-center justify-center`}>
            <Icon className="text-lg" />
          </div>
        )}
      </div>
      <p className="text-3xl font-display font-bold">{value}</p>
      {sub && <p className="text-sm mt-1 opacity-70">{sub}</p>}
      {typeof trend === "number" && (
        <div className="mt-3 flex items-center gap-1">
          <span className={`text-xs font-medium ${trend > 0 ? "text-emerald-300" : "text-red-300"}`}>
            {trend > 0 ? "↑" : "↓"} {Math.abs(trend)}%
          </span>
          <span className="text-xs opacity-60">vs last month</span>
        </div>
      )}
    </div>
  );
}

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function LoadingSpinner({ size = "md", className = "" }: LoadingSpinnerProps) {
  const sizes: Record<NonNullable<LoadingSpinnerProps["size"]>, string> = {
    sm: "w-4 h-4 border-2",
    md: "w-8 h-8 border-3",
    lg: "w-12 h-12 border-4",
  };
  return (
    <div className={`${sizes[size]} border-forest-900 border-t-transparent rounded-full animate-spin ${className}`} />
  );
}

export function FullPageLoader({ message = "Loading..." }: { message?: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <LoadingSpinner size="lg" className="mx-auto mb-4" />
        <p className="text-slate-500 text-sm">{message}</p>
      </div>
    </div>
  );
}

interface EmptyStateProps {
  icon?: IconType;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="text-center py-16">
      {Icon && <Icon className="text-5xl text-slate-300 mx-auto mb-4" />}
      <h3 className="text-lg font-semibold text-slate-700 mb-2">{title}</h3>
      <p className="text-slate-400 text-sm max-w-xs mx-auto mb-6">{description}</p>
      {action}
    </div>
  );
}

interface PlanGateProps {
  requiredPlan?: "free" | "basic" | "pro" | "elite" | "enterprise";
  currentPlan?: string | null;
  children: ReactNode;
}

export function PlanGate({ requiredPlan = "pro", currentPlan, children }: PlanGateProps) {
  const hierarchy = { free: 0, basic: 1, pro: 2, elite: 3, enterprise: 4 };
  const hasAccess = (hierarchy[(currentPlan || "free") as keyof typeof hierarchy] ?? 0) >= (hierarchy[requiredPlan] ?? 2);
  if (hasAccess) return <>{children}</>;

  return (
    <div className="relative">
      <div className="absolute inset-0 bg-white/80 backdrop-blur-sm rounded-2xl z-10 flex flex-col items-center justify-center p-8 text-center">
        <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mb-3">
          <span className="text-2xl">🔒</span>
        </div>
        <p className="font-semibold text-forest-900 mb-1">
          {requiredPlan.charAt(0).toUpperCase() + requiredPlan.slice(1)} Feature
        </p>
        <p className="text-slate-500 text-sm mb-4">Upgrade your plan to unlock this feature</p>
        <a href="/plans" className="btn-amber text-sm px-5 py-2 rounded-xl font-semibold inline-block">
          Upgrade Now →
        </a>
      </div>
      <div className="blur-sm pointer-events-none select-none">{children}</div>
    </div>
  );
}

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  danger?: boolean;
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = "Confirm",
  danger = false,
}: ConfirmModalProps) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl p-6 max-w-md w-full shadow-xl animate-slide-up">
        <h3 className="font-display font-bold text-forest-900 text-xl mb-2">{title}</h3>
        <p className="text-slate-600 text-sm mb-6">{message}</p>
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`px-5 py-2 rounded-xl font-semibold text-sm transition-colors ${danger ? "bg-red-600 text-white hover:bg-red-700" : "btn-primary"}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

interface SelectOption {
  value: string;
  label: string;
}

interface SelectInputProps {
  label?: string;
  options: SelectOption[];
  value: string;
  onChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  name?: string;
  required?: boolean;
}

export function SelectInput({ label, options, value, onChange, name, required }: SelectInputProps) {
  return (
    <div>
      {label && (
        <label className="label">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <select name={name} value={value} onChange={onChange} required={required} className="input bg-white">
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function StatusBadge({ status }: { status?: string | null }) {
  const map = {
    draft: { label: "Draft", className: "badge-slate" },
    active: { label: "Active", className: "badge-green" },
    maintenance: { label: "Maintenance", className: "badge-amber" },
    decommissioned: { label: "Decommissioned", className: "badge-amber" },
    recycled: { label: "Recycled ♻️", className: "badge-forest" },
    pending_recovery: { label: "Recovery Pending", className: "badge-amber" },
  };
  const key = (status || "draft") as keyof typeof map;
  const config = map[key] || { label: status, className: "badge-slate" };
  return <span className={`badge ${config.className}`}>{config.label}</span>;
}

export function CapacityBadge({ category, kw }: { category?: string | null; kw?: number | null }) {
  const map = {
    home: { label: "Home", icon: "🏠", className: "text-emerald-700 border-emerald-200 bg-emerald-50" },
    commercial: { label: "Commercial", icon: "🏢", className: "text-blue-700 border-blue-200 bg-blue-50" },
    industrial_minigrid: {
      label: "Industrial / Minigrid",
      icon: "🏭",
      className: "text-violet-700 border-violet-200 bg-violet-50",
    },
    utility: { label: "Utility", icon: "⚡", className: "text-amber-700 border-amber-200 bg-amber-50" },
  };
  if (!category) return null;
  const config = map[category as keyof typeof map] || {
    label: category,
    icon: "⚡",
    className: "text-slate-600 border-slate-200 bg-slate-50",
  };
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${config.className}`}>
      {config.icon} {config.label}
      {kw != null ? ` · ${kw % 1 === 0 ? kw : kw.toFixed(1)} kW` : ""}
    </span>
  );
}

export function UrgencyBadge({ daysUntil }: { daysUntil: number }) {
  if (daysUntil < 0) return <span className="badge badge-red">Overdue by {Math.abs(daysUntil)}d</span>;
  if (daysUntil < 30) return <span className="badge badge-red">{daysUntil}d left</span>;
  if (daysUntil < 180) return <span className="badge badge-amber">{Math.round(daysUntil / 30)}mo left</span>;
  if (daysUntil < 365) return <span className="badge badge-amber">&lt;1yr</span>;
  return <span className="badge badge-green">{Math.round(daysUntil / 365)}yr+</span>;
}
