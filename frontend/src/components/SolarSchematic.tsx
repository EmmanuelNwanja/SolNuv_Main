/**
 * SolarSchematic — SVG single-line / wiring schematic for Solar+BESS systems.
 * Renders topology-aware diagrams from simulation design data.
 * Elite+ feature; access gate is enforced by the parent page.
 */

import type { ReactNode, SVGProps } from "react";

type TextAnchor = NonNullable<SVGProps<SVGTextElement>["textAnchor"]>;

const PV_TECH_SHORT: Record<string, string> = {
  mono_perc: "Mono PERC",
  poly: "Poly",
  cdte: "CdTe TF",
  cigs: "CIGS TF",
  topcon: "TOPCon",
  hjt: "HJT",
  bifacial_perc: "Bifacial PERC",
  topcon_bi: "Bifacial TOPCon",
  hjt_bi: "Bifacial HJT",
  a_si: "a-Si",
  organic: "OPV",
};

const TOPOLOGY_LABEL: Record<string, string> = {
  grid_tied: "Grid-Tied (PV Only)",
  grid_tied_bess: "Grid-Tied + Battery",
  off_grid: "Off-Grid",
  hybrid: "Hybrid (Grid + Islanding)",
};

const INSTALLATION_META: Record<
  string,
  { label: string; mount: string; note: string; pvFill: string; pvStroke: string; tiltHint: string }
> = {
  rooftop_flat: {
    label: "Rooftop (Flat)",
    mount: "Ballasted/anchored roof frame",
    note: "Check roof loading, ballast, and wind uplift.",
    pvFill: "#FEFCE8",
    pvStroke: "#D97706",
    tiltHint: "Low-tilt rack (typically 5-15°)",
  },
  rooftop_tilted: {
    label: "Rooftop (Tilted Rack)",
    mount: "Tilted aluminium rack",
    note: "Improves airflow and module temperature.",
    pvFill: "#FEFCE8",
    pvStroke: "#B45309",
    tiltHint: "Tilt rack aligned to azimuth target",
  },
  ground_fixed: {
    label: "Ground Mount (Fixed)",
    mount: "Pile/concrete fixed-tilt structure",
    note: "Allow row spacing for shading clearance.",
    pvFill: "#ECFDF5",
    pvStroke: "#059669",
    tiltHint: "Fixed seasonal-optimized tilt",
  },
  ground_tracker: {
    label: "Ground (Single-Axis Tracker)",
    mount: "Single-axis tracker table",
    note: "Requires tracker motor/control and O&M access.",
    pvFill: "#E0F2FE",
    pvStroke: "#0284C7",
    tiltHint: "Tracking axis follows sun path",
  },
  carport: {
    label: "Carport / Canopy",
    mount: "Elevated canopy steel structure",
    note: "Include drainage and vehicle clearance.",
    pvFill: "#F3E8FF",
    pvStroke: "#9333EA",
    tiltHint: "Canopy pitch + drainage slope",
  },
  bipv: {
    label: "BIPV (Building-Integrated)",
    mount: "Façade/roof integrated modules",
    note: "Coordinate weatherproofing and fire detailing.",
    pvFill: "#FFF7ED",
    pvStroke: "#EA580C",
    tiltHint: "Architecture-constrained orientation",
  },
  floating: {
    label: "Floating Solar",
    mount: "HDPE float + mooring system",
    note: "Add marine cabling and anchoring checks.",
    pvFill: "#EFF6FF",
    pvStroke: "#2563EB",
    tiltHint: "Float tilt + mooring envelope",
  },
};

function installationMeta(installationType: unknown) {
  const key = typeof installationType === "string" ? installationType : "";
  return (
    INSTALLATION_META[key] ?? {
      label: String(installationType || "Unspecified"),
      mount: "Standard mounting structure",
      note: "Validate mounting and BOS assumptions.",
      pvFill: "#FEFCE8",
      pvStroke: "#D97706",
      tiltHint: "Tilt and azimuth per simulation inputs",
    }
  );
}

function fmt(n: unknown, d = 1) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return Number(n).toFixed(d);
}

// ─── Generic SVG building blocks ────────────────────────────────────────────

function Box({
  x,
  y,
  w,
  h,
  fill = "#fff",
  stroke = "#374151",
  rx = 8,
  children,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  fill?: string;
  stroke?: string;
  rx?: number;
  children?: ReactNode;
}) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={rx} fill={fill} stroke={stroke} strokeWidth={1.5} />
      {children}
    </g>
  );
}

function Label({
  x,
  y,
  text,
  bold = false,
  size = 11,
  fill = "#111827",
  anchor = "middle",
}: {
  x: number;
  y: number;
  text: string;
  bold?: boolean;
  size?: number;
  fill?: string;
  anchor?: TextAnchor;
}) {
  return (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      fontSize={size}
      fontWeight={bold ? "600" : "400"}
      fill={fill}
      fontFamily="system-ui, sans-serif"
    >
      {text}
    </text>
  );
}

function SubLabel({
  x,
  y,
  text,
  size = 9.5,
  fill = "#6B7280",
  anchor = "middle",
}: {
  x: number;
  y: number;
  text: string;
  size?: number;
  fill?: string;
  anchor?: TextAnchor;
}) {
  return (
    <text x={x} y={y} textAnchor={anchor} fontSize={size} fill={fill} fontFamily="system-ui, sans-serif">
      {text}
    </text>
  );
}

/** Horizontal arrow from (x1,y) to (x2,y) */
function HArrow({ x1, y, x2, color = "#374151", label = "" }: { x1: number; y: number; x2: number; color?: string; label?: string }) {
  const mid = (x1 + x2) / 2;
  return (
    <g>
      <line x1={x1} y1={y} x2={x2 - 6} y2={y} stroke={color} strokeWidth={2} />
      <polygon points={`${x2},${y} ${x2 - 8},${y - 5} ${x2 - 8},${y + 5}`} fill={color} />
      {label && (
        <text x={mid} y={y - 5} textAnchor="middle" fontSize={9} fill={color} fontFamily="system-ui, sans-serif">
          {label}
        </text>
      )}
    </g>
  );
}

/** Vertical arrow from (x,y1) to (x,y2) */
function VArrow({ x, y1, y2, color = "#374151", label = "" }: { x: number; y1: number; y2: number; color?: string; label?: string }) {
  const dir = y2 > y1 ? 1 : -1;
  const tip = y2;
  const mid = (y1 + y2) / 2;
  return (
    <g>
      <line x1={x} y1={y1} x2={x} y2={tip - 6 * dir} stroke={color} strokeWidth={2} />
      <polygon points={`${x},${tip} ${x - 5},${tip - 8 * dir} ${x + 5},${tip - 8 * dir}`} fill={color} />
      {label && (
        <text x={x + 6} y={mid} textAnchor="start" fontSize={9} fill={color} fontFamily="system-ui, sans-serif">
          {label}
        </text>
      )}
    </g>
  );
}

/** L-shaped connector: horizontal then vertical */
function LArrow({ x1, y1, x2, y2, color = "#374151" }: { x1: number; y1: number; x2: number; y2: number; color?: string }) {
  const dir = y2 > y1 ? 1 : -1;
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y1} stroke={color} strokeWidth={2} />
      <line x1={x2} y1={y1} x2={x2} y2={y2 - 6 * dir} stroke={color} strokeWidth={2} />
      <polygon points={`${x2},${y2} ${x2 - 5},${y2 - 8 * dir} ${x2 + 5},${y2 - 8 * dir}`} fill={color} />
    </g>
  );
}

// ─── Component blocks ────────────────────────────────────────────────────────

function PVArrayBlock({
  cx,
  cy,
  kwp,
  panelTech,
  numStrings,
  installationType,
}: {
  cx: number;
  cy: number;
  kwp: unknown;
  panelTech: unknown;
  numStrings: number;
  installationType?: unknown;
}) {
  const w = 120,
    h = 80;
  const x = cx - w / 2,
    y = cy - h / 2;
  const techKey = typeof panelTech === "string" ? panelTech : "";
  const installation = installationMeta(installationType);
  return (
    <Box x={x} y={y} w={w} h={h} fill={installation.pvFill} stroke={installation.pvStroke}>
      {[0, 1, 2].map((i) => (
        <rect
          key={i}
          x={x + 12 + i * 15}
          y={y + 10}
          width={11}
          height={16}
          rx={1}
          fill="#FCD34D"
          stroke={installation.pvStroke}
          strokeWidth={1}
        />
      ))}
      <Label x={cx} y={y + 36} text="PV Array" bold size={11} fill="#92400E" />
      <SubLabel x={cx} y={y + 50} text={`${fmt(kwp, 1)} kWp`} fill="#B45309" />
      <SubLabel
        x={cx}
        y={y + 62}
        text={`${PV_TECH_SHORT[techKey] || String(panelTech ?? "")} · ${numStrings} string${numStrings > 1 ? "s" : ""}`}
        fill="#78716C"
      />
    </Box>
  );
}

function MountingBlock({ cx, cy, installationType }: { cx: number; cy: number; installationType?: unknown }) {
  const w = 160;
  const h = 48;
  const x = cx - w / 2;
  const y = cy - h / 2;
  const installation = installationMeta(installationType);
  return (
    <Box x={x} y={y} w={w} h={h} fill="#F8FAFC" stroke="#64748B" rx={10}>
      <Label x={cx} y={y + 19} text="Mounting / Civil BOS" bold size={10} fill="#334155" />
      <SubLabel x={cx} y={y + 33} text={installation.mount} fill="#475569" />
    </Box>
  );
}

function DCCombinerBlock({ cx, cy }: { cx: number; cy: number }) {
  const w = 90,
    h = 68;
  const x = cx - w / 2,
    y = cy - h / 2;
  return (
    <Box x={x} y={y} w={w} h={h} fill="#F0FDF4" stroke="#16A34A">
      <Label x={cx} y={y + 24} text="DC Combiner" bold size={10} fill="#14532D" />
      <SubLabel x={cx} y={y + 38} text="+ String Fuses" fill="#166534" />
      <SubLabel x={cx} y={y + 51} text="+ Surge Arrester" fill="#166534" />
    </Box>
  );
}

function InverterBlock({
  cx,
  cy,
  topology,
  pvKwp,
  bessKw,
}: {
  cx: number;
  cy: number;
  topology: string;
  pvKwp: unknown;
  bessKw?: unknown;
}) {
  const w = 120,
    h = 80;
  const x = cx - w / 2,
    y = cy - h / 2;
  const isHybrid = topology === "grid_tied_bess" || topology === "hybrid";
  const isOffGrid = topology === "off_grid";
  const label = isOffGrid ? "Off-Grid Inverter" : isHybrid ? "Hybrid Inverter" : "String Inverter";
  const sublabel = isHybrid ? `${fmt(pvKwp, 1)} kWp / ${fmt(bessKw ?? pvKwp, 1)} kW` : `${fmt(pvKwp, 1)} kW`;
  const sub2 = isOffGrid ? "DC → AC" : isHybrid ? "MPPT + BMS + ATS" : "MPPT · Grid-Tied";
  return (
    <Box x={x} y={y} w={w} h={h} fill="#EFF6FF" stroke="#2563EB">
      <text x={cx} y={y + 20} textAnchor="middle" fontSize={13} fill="#1D4ED8" fontFamily="system-ui">
        ⚡
      </text>
      <Label x={cx} y={y + 36} text={label} bold size={10} fill="#1E3A8A" />
      <SubLabel x={cx} y={y + 50} text={sublabel} fill="#1D4ED8" />
      <SubLabel x={cx} y={y + 63} text={sub2} fill="#3B82F6" />
    </Box>
  );
}

function MPPTBlock({ cx, cy }: { cx: number; cy: number }) {
  const w = 100,
    h = 68;
  const x = cx - w / 2,
    y = cy - h / 2;
  return (
    <Box x={x} y={y} w={w} h={h} fill="#F0FDF4" stroke="#16A34A">
      <Label x={cx} y={y + 24} text="MPPT Charge" bold size={10} fill="#14532D" />
      <Label x={cx} y={y + 37} text="Controller" bold size={10} fill="#14532D" />
      <SubLabel x={cx} y={y + 52} text="DC-coupled" fill="#166534" />
    </Box>
  );
}

function BatteryBlock({
  cx,
  cy,
  kwh,
  kw,
  chemistry,
}: {
  cx: number;
  cy: number;
  kwh: unknown;
  kw: unknown;
  chemistry: string;
}) {
  const w = 120,
    h = 80;
  const x = cx - w / 2,
    y = cy - h / 2;
  return (
    <Box x={x} y={y} w={w} h={h} fill="#F0FDF4" stroke="#16A34A">
      <text x={cx} y={y + 20} textAnchor="middle" fontSize={13} fill="#15803D" fontFamily="system-ui">
        🔋
      </text>
      <Label x={cx} y={y + 36} text="Battery Bank" bold size={11} fill="#14532D" />
      <SubLabel x={cx} y={y + 50} text={`${fmt(kwh, 1)} kWh / ${fmt(kw, 1)} kW`} fill="#166534" />
      <SubLabel x={cx} y={y + 63} text={chemistry || "LFP"} fill="#15803D" />
    </Box>
  );
}

function ACPanelBlock({ cx, cy }: { cx: number; cy: number }) {
  const w = 100,
    h = 68;
  const x = cx - w / 2,
    y = cy - h / 2;
  return (
    <Box x={x} y={y} w={w} h={h} fill="#FAF5FF" stroke="#7C3AED">
      <Label x={cx} y={y + 24} text="AC Distribution" bold size={10} fill="#4C1D95" />
      <Label x={cx} y={y + 37} text="Board (DB)" bold size={10} fill="#4C1D95" />
      <SubLabel x={cx} y={y + 52} text="MCBs + RCDs" fill="#6D28D9" />
    </Box>
  );
}

function LoadBlock({ cx, cy, annualKwh }: { cx: number; cy: number; annualKwh?: unknown }) {
  const w = 100,
    h = 68;
  const x = cx - w / 2,
    y = cy - h / 2;
  return (
    <Box x={x} y={y} w={w} h={h} fill="#F8FAFC" stroke="#475569">
      <text x={cx} y={y + 20} textAnchor="middle" fontSize={13} fill="#334155" fontFamily="system-ui">
        🏭
      </text>
      <Label x={cx} y={y + 36} text="Site Loads" bold size={10} fill="#0F172A" />
      {annualKwh && (
        <SubLabel x={cx} y={y + 52} text={`~${Number(annualKwh).toLocaleString()} kWh/yr`} fill="#64748B" />
      )}
    </Box>
  );
}

function GridBlock({ cx, cy, topology }: { cx: number; cy: number; topology: string }) {
  const w = 100,
    h = 68;
  const x = cx - w / 2,
    y = cy - h / 2;
  const isHybrid = topology === "hybrid";
  return (
    <Box x={x} y={y} w={w} h={h} fill="#FEF2F2" stroke="#DC2626">
      <text x={cx} y={y + 20} textAnchor="middle" fontSize={13} fill="#DC2626" fontFamily="system-ui">
        ⚡
      </text>
      <Label x={cx} y={y + 36} text={isHybrid ? "Grid (Switchable)" : "Utility Grid"} bold size={10} fill="#7F1D1D" />
      <SubLabel x={cx} y={y + 50} text="Import / Export" fill="#B91C1C" />
      {isHybrid && <SubLabel x={cx} y={y + 63} text="ATS for Islanding" fill="#DC2626" />}
    </Box>
  );
}

function SectionTitle({ x, y, text }: { x: number; y: number; text: string }) {
  return (
    <text
      x={x}
      y={y}
      fontSize={10}
      fill="#9CA3AF"
      fontFamily="system-ui, sans-serif"
      fontWeight="500"
      letterSpacing="0.05em"
    >
      {text.toUpperCase()}
    </text>
  );
}

// ─── Topology schematic renderers ────────────────────────────────────────────

function GridTiedSchematic({ design, annualKwh, installationType }: { design?: Record<string, unknown>; annualKwh?: unknown; installationType?: unknown }) {
  const pvKwp = design?.pv_capacity_kwp as number | undefined;
  const numStrings = Math.max(1, Math.ceil(((pvKwp ?? 0) * 1000) / 4000));
  const panelTech = design?.pv_technology;

  const W = 860,
    H = 340;
  const midY = 155;
  const gridY = 280;

  const xPV = 75,
    xComb = 200,
    xInv = 360,
    xAC = 520,
    xLoad = 700;
  const xGrid = 520;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: W, display: "block" }}>
      <SectionTitle x={10} y={20} text="DC Side" />
      <line x1={0} y1={24} x2={xInv - 60} y2={24} stroke="#D1FAE5" strokeWidth={1.5} />
      <SectionTitle x={xInv - 50} y={20} text="AC Side" />
      <line x1={xInv + 60} y1={24} x2={W} y2={24} stroke="#DBEAFE" strokeWidth={1.5} />

      <MountingBlock cx={xPV} cy={64} installationType={installationType} />
      <VArrow x={xPV} y1={88} y2={midY - 42} color="#64748B" label="" />
      <PVArrayBlock cx={xPV} cy={midY} kwp={pvKwp} panelTech={panelTech} numStrings={numStrings} installationType={installationType} />
      <DCCombinerBlock cx={xComb} cy={midY} />
      <InverterBlock cx={xInv} cy={midY} topology="grid_tied" pvKwp={pvKwp} />
      <ACPanelBlock cx={xAC} cy={midY} />
      <LoadBlock cx={xLoad} cy={midY} annualKwh={annualKwh} />
      <GridBlock cx={xGrid} cy={gridY} topology="grid_tied" />

      <HArrow x1={xPV + 60} y={midY} x2={xComb - 45} color="#D97706" label="DC" />
      <HArrow x1={xComb + 45} y={midY} x2={xInv - 60} color="#D97706" label="DC" />
      <HArrow x1={xInv + 60} y={midY} x2={xAC - 50} color="#2563EB" label="AC" />
      <HArrow x1={xAC + 50} y={midY} x2={xLoad - 50} color="#374151" label="AC" />
      <VArrow x={xGrid} y1={midY + 34} y2={gridY - 34} color="#DC2626" label="" />

      <line x1={20} y1={H - 20} x2={50} y2={H - 20} stroke="#D97706" strokeWidth={2} />
      <SubLabel x={75} y={H - 17} text="DC wiring" anchor="start" fill="#92400E" />
      <line x1={145} y1={H - 20} x2={175} y2={H - 20} stroke="#2563EB" strokeWidth={2} />
      <SubLabel x={200} y={H - 17} text="AC wiring" anchor="start" fill="#1D4ED8" />
      <line x1={275} y1={H - 20} x2={305} y2={H - 20} stroke="#DC2626" strokeWidth={2} />
      <SubLabel x={330} y={H - 17} text="Grid connection" anchor="start" fill="#B91C1C" />
    </svg>
  );
}

function GridTiedBessSchematic({
  design,
  annualKwh,
  installationType,
}: {
  design?: Record<string, unknown>;
  annualKwh?: unknown;
  installationType?: unknown;
}) {
  const pvKwp = design?.pv_capacity_kwp as number | undefined;
  const bessKwh = design?.bess_capacity_kwh as number | undefined;
  const bessKw = design?.bess_power_kw as number | undefined;
  const chemistry = String(design?.bess_chemistry ?? "LFP").toUpperCase();
  const numStrings = Math.max(1, Math.ceil(((pvKwp ?? 0) * 1000) / 4000));
  const panelTech = design?.pv_technology;
  const topology = String(design?.grid_topology ?? "grid_tied_bess");

  const W = 860,
    H = 400;
  const midY = 160;
  const bottomY = 310;

  const xPV = 75,
    xComb = 210,
    xInv = 375,
    xAC = 545,
    xLoad = 720;
  const xBatt = 375,
    xGrid = 545;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: W, display: "block" }}>
      <SectionTitle x={10} y={20} text="DC Side" />
      <line x1={0} y1={24} x2={xInv - 65} y2={24} stroke="#D1FAE5" strokeWidth={1.5} />
      <SectionTitle x={xInv - 55} y={20} text="AC Side" />
      <line x1={xInv + 65} y1={24} x2={W} y2={24} stroke="#DBEAFE" strokeWidth={1.5} />

      <MountingBlock cx={xPV} cy={64} installationType={installationType} />
      <VArrow x={xPV} y1={88} y2={midY - 42} color="#64748B" label="" />
      <PVArrayBlock cx={xPV} cy={midY} kwp={pvKwp} panelTech={panelTech} numStrings={numStrings} installationType={installationType} />
      <DCCombinerBlock cx={xComb} cy={midY} />
      <InverterBlock cx={xInv} cy={midY} topology={topology} pvKwp={pvKwp} bessKw={bessKw} />
      <ACPanelBlock cx={xAC} cy={midY} />
      <LoadBlock cx={xLoad} cy={midY} annualKwh={annualKwh} />

      <BatteryBlock cx={xBatt} cy={bottomY} kwh={bessKwh} kw={bessKw} chemistry={chemistry} />
      <GridBlock cx={xGrid} cy={bottomY} topology={topology} />

      <HArrow x1={xPV + 60} y={midY} x2={xComb - 45} color="#D97706" label="DC" />
      <HArrow x1={xComb + 45} y={midY} x2={xInv - 60} color="#D97706" label="DC" />
      <HArrow x1={xInv + 60} y={midY} x2={xAC - 50} color="#2563EB" label="AC" />
      <HArrow x1={xAC + 50} y={midY} x2={xLoad - 50} color="#374151" label="AC" />

      <VArrow x={xBatt} y1={midY + 40} y2={bottomY - 40} color="#16A34A" label="DC Bus" />
      <VArrow x={xGrid} y1={midY + 34} y2={bottomY - 34} color="#DC2626" label="" />

      <line x1={20} y1={H - 18} x2={50} y2={H - 18} stroke="#D97706" strokeWidth={2} />
      <SubLabel x={75} y={H - 15} text="DC wiring" anchor="start" fill="#92400E" />
      <line x1={145} y1={H - 18} x2={175} y2={H - 18} stroke="#2563EB" strokeWidth={2} />
      <SubLabel x={200} y={H - 15} text="AC wiring" anchor="start" fill="#1D4ED8" />
      <line x1={275} y1={H - 18} x2={305} y2={H - 18} stroke="#16A34A" strokeWidth={2} />
      <SubLabel x={330} y={H - 15} text="DC Battery bus" anchor="start" fill="#15803D" />
      <line x1={435} y1={H - 18} x2={465} y2={H - 18} stroke="#DC2626" strokeWidth={2} />
      <SubLabel x={490} y={H - 15} text="Grid connection" anchor="start" fill="#B91C1C" />
    </svg>
  );
}

function OffGridSchematic({
  design,
  annualKwh,
  installationType,
}: {
  design?: Record<string, unknown>;
  annualKwh?: unknown;
  installationType?: unknown;
}) {
  const pvKwp = design?.pv_capacity_kwp as number | undefined;
  const bessKwh = design?.bess_capacity_kwh as number | undefined;
  const bessKw = design?.bess_power_kw as number | undefined;
  const chemistry = String(design?.bess_chemistry ?? "LFP").toUpperCase();
  const numStrings = Math.max(1, Math.ceil(((pvKwp ?? 0) * 1000) / 4000));
  const panelTech = design?.pv_technology;

  const W = 920,
    H = 320;
  const midY = 155;

  const xPV = 70,
    xComb = 200,
    xMPPT = 330,
    xBatt = 480,
    xInv = 640,
    xLoad = 800;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: W, display: "block" }}>
      <SectionTitle x={10} y={20} text="DC Side (All components)" />
      <line x1={0} y1={24} x2={xInv - 65} y2={24} stroke="#D1FAE5" strokeWidth={1.5} />
      <SectionTitle x={xInv - 55} y={20} text="AC Output" />
      <line x1={xInv + 65} y1={24} x2={W} y2={24} stroke="#DBEAFE" strokeWidth={1.5} />

      <MountingBlock cx={xPV} cy={64} installationType={installationType} />
      <VArrow x={xPV} y1={88} y2={midY - 42} color="#64748B" label="" />
      <PVArrayBlock cx={xPV} cy={midY} kwp={pvKwp} panelTech={panelTech} numStrings={numStrings} installationType={installationType} />
      <DCCombinerBlock cx={xComb} cy={midY} />
      <MPPTBlock cx={xMPPT} cy={midY} />
      <BatteryBlock cx={xBatt} cy={midY} kwh={bessKwh} kw={bessKw} chemistry={chemistry} />
      <InverterBlock cx={xInv} cy={midY} topology="off_grid" pvKwp={pvKwp} bessKw={bessKw} />
      <LoadBlock cx={xLoad} cy={midY} annualKwh={annualKwh} />

      <HArrow x1={xPV + 60} y={midY} x2={xComb - 45} color="#D97706" label="DC" />
      <HArrow x1={xComb + 45} y={midY} x2={xMPPT - 50} color="#D97706" label="DC" />
      <HArrow x1={xMPPT + 50} y={midY} x2={xBatt - 60} color="#16A34A" label="DC Bus" />
      <HArrow x1={xBatt + 60} y={midY} x2={xInv - 60} color="#16A34A" label="DC Bus" />
      <HArrow x1={xInv + 60} y={midY} x2={xLoad - 50} color="#2563EB" label="AC" />

      <line x1={20} y1={H - 18} x2={50} y2={H - 18} stroke="#D97706" strokeWidth={2} />
      <SubLabel x={75} y={H - 15} text="DC solar wiring" anchor="start" fill="#92400E" />
      <line x1={185} y1={H - 18} x2={215} y2={H - 18} stroke="#16A34A" strokeWidth={2} />
      <SubLabel x={240} y={H - 15} text="DC battery bus" anchor="start" fill="#15803D" />
      <line x1={360} y1={H - 18} x2={390} y2={H - 18} stroke="#2563EB" strokeWidth={2} />
      <SubLabel x={415} y={H - 15} text="AC output" anchor="start" fill="#1D4ED8" />
    </svg>
  );
}

// ─── Public component ─────────────────────────────────────────────────────────

export default function SolarSchematic({ design, result }: { design?: Record<string, unknown>; result?: Record<string, unknown> }) {
  const topology = String(design?.grid_topology ?? "grid_tied");
  const annualKwh = result?.annual_load_kwh;
  const hasBess = Number(design?.bess_capacity_kwh ?? 0) > 0;
  const installationType = String(design?.installation_type ?? "");
  const installation = installationMeta(installationType);

  const pvKwp = Number(design?.pv_capacity_kwp ?? 0);
  const estimatedPanels = Math.ceil((pvKwp * 1000) / 400);
  const panelsPerString = 10;
  const numStrings = Math.max(1, Math.ceil(estimatedPanels / panelsPerString));

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-4 bg-forest-900 text-white rounded-xl">
        <div>
          <h3 className="font-semibold">System Schematic</h3>
          <p className="text-xs text-green-300 mt-0.5">
            {TOPOLOGY_LABEL[topology] || topology} · {installation.label}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-green-200">
          <span className="bg-white/10 px-2 py-1 rounded">{fmt(pvKwp, 1)} kWp PV</span>
          {hasBess && (
            <span className="bg-white/10 px-2 py-1 rounded">{fmt(design?.bess_capacity_kwh, 1)} kWh BESS</span>
          )}
          <span className="bg-white/10 px-2 py-1 rounded">
            ~{numStrings} string{numStrings > 1 ? "s" : ""}
          </span>
          <span className="bg-white/10 px-2 py-1 rounded">{installation.tiltHint}</span>
          <span className="bg-white/10 px-2 py-1 rounded">~{estimatedPanels} panels est.</span>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4 overflow-x-auto">
        {topology === "off_grid" ? (
          <OffGridSchematic design={design} annualKwh={annualKwh} installationType={installationType} />
        ) : topology === "grid_tied" && !hasBess ? (
          <GridTiedSchematic design={design} annualKwh={annualKwh} installationType={installationType} />
        ) : (
          <GridTiedBessSchematic design={design} annualKwh={annualKwh} installationType={installationType} />
        )}
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800 text-left">
              <th className="px-4 py-2.5 font-medium text-gray-600 dark:text-gray-400">Component</th>
              <th className="px-4 py-2.5 font-medium text-gray-600 dark:text-gray-400">Specification</th>
              <th className="px-4 py-2.5 font-medium text-gray-600 dark:text-gray-400">Note</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            <tr className="bg-white dark:bg-gray-900">
              <td className="px-4 py-2.5 font-medium text-amber-700">PV Array</td>
              <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300">
                {fmt(pvKwp, 1)} kWp · {PV_TECH_SHORT[String(design?.pv_technology)] || String(design?.pv_technology ?? "—")}
              </td>
              <td className="px-4 py-2.5 text-gray-500 text-xs">
                ~{estimatedPanels} × 400 Wp panels est. · {numStrings} string{numStrings > 1 ? "s" : ""} · Tilt{" "}
                {String(design?.pv_tilt_deg ?? "—")}° · Az {String(design?.pv_azimuth_deg ?? "—")}°
              </td>
            </tr>
            <tr className="bg-gray-50/50 dark:bg-gray-800/50">
              <td className="px-4 py-2.5 font-medium text-green-700">DC Combiner</td>
              <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300">String fuse box + surge arrester</td>
              <td className="px-4 py-2.5 text-gray-500 text-xs">
                One fuse per string. 1000 V DC rated (NEC/IEC 62548)
              </td>
            </tr>
            <tr className="bg-white dark:bg-gray-900">
              <td className="px-4 py-2.5 font-medium text-slate-700">Mounting & Civil BOS</td>
              <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300">{installation.mount}</td>
              <td className="px-4 py-2.5 text-gray-500 text-xs">{installation.note}</td>
            </tr>
            {topology !== "off_grid" && (
              <tr className="bg-gray-50/50 dark:bg-gray-800/50">
                <td className="px-4 py-2.5 font-medium text-blue-700">{hasBess ? "Hybrid Inverter" : "String Inverter"}</td>
                <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300">
                  {fmt(pvKwp, 1)} kW AC output
                  {hasBess ? ` · ${fmt(design?.bess_power_kw, 1)} kW battery port` : ""}
                </td>
                <td className="px-4 py-2.5 text-gray-500 text-xs">
                  {hasBess
                    ? `MPPT + built-in BMS interface · ${topology === "hybrid" ? "ATS for grid islanding" : "Grid-tied with storage"}`
                    : "MPPT · Anti-islanding relay · Export limiting"}
                </td>
              </tr>
            )}
            {topology === "off_grid" && (
              <>
                <tr className="bg-white dark:bg-gray-900">
                  <td className="px-4 py-2.5 font-medium text-green-700">MPPT Charge Controller</td>
                  <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300">{fmt(pvKwp, 1)} kWp input</td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs">DC-coupled, regulates charge to battery bank</td>
                </tr>
                <tr className="bg-gray-50/50 dark:bg-gray-800/50">
                  <td className="px-4 py-2.5 font-medium text-blue-700">Off-Grid Inverter</td>
                  <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300">{fmt(design?.bess_power_kw, 1)} kW continuous</td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs">DC → pure sine AC · No grid dependency</td>
                </tr>
              </>
            )}
            {hasBess && (
              <tr className="bg-white dark:bg-gray-900">
                <td className="px-4 py-2.5 font-medium text-green-700">Battery Bank</td>
                <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300">
                  {fmt(design?.bess_capacity_kwh, 1)} kWh · {fmt(design?.bess_power_kw, 1)} kW ·{" "}
                  {String(design?.bess_chemistry ?? "LFP").toUpperCase()}
                </td>
                <td className="px-4 py-2.5 text-gray-500 text-xs">
                  Min SOC{" "}
                  {design?.bess_min_soc != null ? (Number(design.bess_min_soc) * 100).toFixed(0) : "—"}% · RTE{" "}
                  {design?.bess_round_trip_efficiency != null
                    ? (Number(design.bess_round_trip_efficiency) * 100).toFixed(0)
                    : "—"}
                  % · Strategy: {String(design?.bess_dispatch_strategy ?? "").replace(/_/g, " ")}
                </td>
              </tr>
            )}
            <tr className="bg-gray-50/50 dark:bg-gray-800/50">
              <td className="px-4 py-2.5 font-medium text-purple-700">AC Distribution Board</td>
              <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300">MCBs + RCDs + SPD</td>
              <td className="px-4 py-2.5 text-gray-500 text-xs">
                Per load circuit. Earth leakage protection. IEC 60364 compliant
              </td>
            </tr>
            {topology !== "off_grid" && (
              <tr className="bg-white dark:bg-gray-900">
                <td className="px-4 py-2.5 font-medium text-red-700">Grid Connection</td>
                <td className="px-4 py-2.5 text-gray-700 dark:text-gray-300">
                  {topology === "hybrid" ? "ATS + metered import/export" : "Bidirectional meter"}
                </td>
                <td className="px-4 py-2.5 text-gray-500 text-xs">
                  {topology === "hybrid"
                    ? "Automatic Transfer Switch for islanding. Synch relay for reconnect."
                    : "NERC net-metering compliant where available"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400 dark:text-gray-500 leading-relaxed px-1">
        ⚠ This schematic is a design-intent diagram generated from simulation parameters. Panel count (est. ~{estimatedPanels})
        assumes 400 Wp average and installation assumptions for "{installation.label}". Actual string configuration, cable sizing,
        mounting checks, and protection device ratings must be verified by a qualified electrical engineer before installation.
        Compliant with NEC 2023, IEC 62548, and NERC grid connection guidelines.
      </p>
    </div>
  );
}
