/**
 * SolNuv System Visual Preview
 * SVG-based illustration showing how the solar system looks for each installation type.
 * Changes dynamically based on selected installation type and system parameters.
 */
import { useMemo } from 'react';

const COLORS = {
  panel: '#1e3a5f',
  panelGlass: '#2563eb',
  panelFrame: '#94a3b8',
  sky: '#dbeafe',
  skyGradTop: '#93c5fd',
  sun: '#fbbf24',
  sunRays: '#fcd34d',
  roof: '#8b5e3c',
  roofDark: '#6d4c2e',
  ground: '#86efac',
  groundDark: '#22c55e',
  concrete: '#d1d5db',
  water: '#60a5fa',
  waterDark: '#3b82f6',
  building: '#e5e7eb',
  buildingDark: '#9ca3af',
  metal: '#6b7280',
  shadow: 'rgba(0,0,0,0.08)',
  tree: '#166534',
  treeTrunk: '#92400e',
};

function SunIcon({ cx = 340, cy = 40 }) {
  return (
    <g>
      {/* Sun rays */}
      {[0, 45, 90, 135, 180, 225, 270, 315].map(angle => (
        <line key={angle}
          x1={cx} y1={cy}
          x2={cx + 22 * Math.cos(angle * Math.PI / 180)}
          y2={cy + 22 * Math.sin(angle * Math.PI / 180)}
          stroke={COLORS.sunRays} strokeWidth="2" strokeLinecap="round" opacity="0.6" />
      ))}
      <circle cx={cx} cy={cy} r="14" fill={COLORS.sun} />
    </g>
  );
}

function PanelRow({ x, y, width, height, tilt = 15, count = 4, gap = 4 }) {
  const panels = [];
  const pw = (width - gap * (count - 1)) / count;
  for (let i = 0; i < count; i++) {
    panels.push(
      <g key={i} transform={`translate(${x + i * (pw + gap)}, ${y})`}>
        <rect x="0" y="0" width={pw} height={height} rx="1"
          fill={COLORS.panelGlass} stroke={COLORS.panelFrame} strokeWidth="0.5" opacity="0.9" />
        {/* Grid lines */}
        <line x1={pw / 3} y1="0" x2={pw / 3} y2={height} stroke={COLORS.panelFrame} strokeWidth="0.3" opacity="0.5" />
        <line x1={2 * pw / 3} y1="0" x2={2 * pw / 3} y2={height} stroke={COLORS.panelFrame} strokeWidth="0.3" opacity="0.5" />
        <line x1="0" y1={height / 2} x2={pw} y2={height / 2} stroke={COLORS.panelFrame} strokeWidth="0.3" opacity="0.5" />
      </g>
    );
  }
  return <g>{panels}</g>;
}

function RooftopFlat() {
  return (
    <svg viewBox="0 0 400 220" className="w-full h-auto">
      {/* Sky */}
      <rect width="400" height="220" fill={COLORS.sky} />
      <SunIcon />
      {/* Building */}
      <rect x="40" y="80" width="320" height="140" fill={COLORS.building} stroke={COLORS.buildingDark} strokeWidth="1" />
      {/* Windows */}
      {[80, 150, 220, 290].map(wx => (
        <rect key={wx} x={wx} y="140" width="30" height="40" fill={COLORS.skyGradTop} opacity="0.4" rx="2" />
      ))}
      {/* Flat roof */}
      <rect x="35" y="75" width="330" height="12" fill={COLORS.concrete} stroke={COLORS.metal} strokeWidth="0.5" />
      {/* Panels on flat roof */}
      <PanelRow x={55} y={55} width={290} height={18} count={6} />
      {/* Shadow under panels */}
      <rect x="55" y="73" width="290" height="4" fill={COLORS.shadow} rx="1" />
    </svg>
  );
}

function RooftopTilted() {
  return (
    <svg viewBox="0 0 400 220" className="w-full h-auto">
      <rect width="400" height="220" fill={COLORS.sky} />
      <SunIcon />
      {/* Building walls */}
      <rect x="60" y="110" width="280" height="110" fill={COLORS.building} stroke={COLORS.buildingDark} strokeWidth="1" />
      {/* Windows */}
      {[100, 170, 240].map(wx => (
        <rect key={wx} x={wx} y="150" width="30" height="40" fill={COLORS.skyGradTop} opacity="0.4" rx="2" />
      ))}
      {/* Pitched roof */}
      <polygon points="55,112 200,42 345,112" fill={COLORS.roof} stroke={COLORS.roofDark} strokeWidth="1" />
      {/* Tilted panels on roof slope */}
      <g transform="translate(90, 62) skewY(-13)">
        <PanelRow x={0} y={0} width={180} height={20} count={5} />
      </g>
    </svg>
  );
}

function GroundFixed() {
  return (
    <svg viewBox="0 0 400 220" className="w-full h-auto">
      <rect width="400" height="220" fill={COLORS.sky} />
      <SunIcon />
      {/* Ground */}
      <rect x="0" y="150" width="400" height="70" fill={COLORS.ground} />
      {/* Mounting posts */}
      {[70, 130, 190, 250, 310].map(px => (
        <rect key={px} x={px} y="115" width="3" height="40" fill={COLORS.metal} />
      ))}
      {/* Panel array - tilted */}
      <g transform="translate(55, 90) rotate(-12, 0, 30)">
        <PanelRow x={0} y={0} width={280} height={28} count={5} />
      </g>
      {/* Shadow on ground */}
      <ellipse cx="200" cy="160" rx="140" ry="8" fill={COLORS.shadow} />
      {/* Trees */}
      <circle cx="30" cy="130" r="18" fill={COLORS.tree} opacity="0.6" />
      <rect x="28" y="143" width="4" height="15" fill={COLORS.treeTrunk} opacity="0.6" />
      <circle cx="380" cy="128" r="16" fill={COLORS.tree} opacity="0.5" />
      <rect x="378" y="140" width="4" height="15" fill={COLORS.treeTrunk} opacity="0.5" />
    </svg>
  );
}

function GroundTracker() {
  return (
    <svg viewBox="0 0 400 220" className="w-full h-auto">
      <rect width="400" height="220" fill={COLORS.sky} />
      <SunIcon cx={320} cy={35} />
      {/* Ground */}
      <rect x="0" y="155" width="400" height="65" fill={COLORS.ground} />
      {/* Tracker post */}
      <rect x="128" y="105" width="4" height="55" fill={COLORS.metal} />
      <rect x="268" y="105" width="4" height="55" fill={COLORS.metal} />
      {/* Tracker arms */}
      <line x1="60" y1="100" x2="200" y2="85" stroke={COLORS.metal} strokeWidth="2" />
      <line x1="200" y1="85" x2="200" y2="100" stroke={COLORS.metal} strokeWidth="2" />
      <line x1="200" y1="100" x2="340" y2="85" stroke={COLORS.metal} strokeWidth="2" />
      {/* Panels tracking sun */}
      <g transform="translate(55, 65) rotate(-8, 0, 20)">
        <PanelRow x={0} y={0} width={130} height={24} count={3} />
      </g>
      <g transform="translate(210, 62) rotate(-8, 0, 20)">
        <PanelRow x={0} y={0} width={130} height={24} count={3} />
      </g>
      {/* Rotation arc indicator */}
      <path d="M 125 130 A 30 30 0 0 1 140 100" fill="none" stroke={COLORS.sunRays} strokeWidth="1.5" strokeDasharray="3,2" />
      <polygon points="140,98 143,105 136,104" fill={COLORS.sunRays} />
    </svg>
  );
}

function Carport() {
  return (
    <svg viewBox="0 0 400 220" className="w-full h-auto">
      <rect width="400" height="220" fill={COLORS.sky} />
      <SunIcon />
      {/* Ground / parking */}
      <rect x="0" y="170" width="400" height="50" fill={COLORS.concrete} />
      {/* Parking lines */}
      {[80, 160, 240, 320].map(lx => (
        <rect key={lx} x={lx} y="172" width="2" height="48" fill="white" opacity="0.4" />
      ))}
      {/* Support columns */}
      {[70, 200, 330].map(cx => (
        <rect key={cx} x={cx} y="85" width="5" height="90" fill={COLORS.metal} />
      ))}
      {/* Canopy structure */}
      <rect x="55" y="78" width="295" height="8" fill={COLORS.metal} opacity="0.7" rx="1" />
      {/* Panels on canopy */}
      <PanelRow x={60} y={55} width={285} height={22} count={6} />
      {/* Cars underneath */}
      <g opacity="0.4">
        <rect x="95" y="180" width="50" height="25" rx="5" fill="#64748b" />
        <rect x="245" y="180" width="50" height="25" rx="5" fill="#475569" />
      </g>
    </svg>
  );
}

function BIPV() {
  return (
    <svg viewBox="0 0 400 220" className="w-full h-auto">
      <rect width="400" height="220" fill={COLORS.sky} />
      <SunIcon />
      {/* Modern building */}
      <rect x="100" y="50" width="200" height="170" fill={COLORS.building} stroke={COLORS.buildingDark} strokeWidth="1" />
      {/* BIPV facade panels (integrated into building) */}
      {[55, 80, 105, 130, 155].map(py => (
        <rect key={py} x="105" y={py} width="90" height={22} rx="1"
          fill={COLORS.panelGlass} stroke={COLORS.panelFrame} strokeWidth="0.3" opacity="0.85" />
      ))}
      {/* Glass windows on right side */}
      {[60, 100, 140, 180].map(wy => (
        <rect key={wy} x="210" y={wy} width="40" height="30" fill={COLORS.skyGradTop} opacity="0.3" rx="2" />
      ))}
      {/* Entrance */}
      <rect x="170" y="185" width="50" height="35" fill={COLORS.skyGradTop} opacity="0.3" rx="2" />
    </svg>
  );
}

function FloatingSolar() {
  return (
    <svg viewBox="0 0 400 220" className="w-full h-auto">
      <rect width="400" height="220" fill={COLORS.sky} />
      <SunIcon />
      {/* Water */}
      <ellipse cx="200" cy="170" rx="180" ry="50" fill={COLORS.water} />
      <ellipse cx="200" cy="170" rx="160" ry="40" fill={COLORS.waterDark} opacity="0.3" />
      {/* Water ripples */}
      {[140, 170, 200].map(ry => (
        <ellipse key={ry} cx="200" cy={ry} rx={120 - (ry - 140) * 0.5} ry="2"
          fill="none" stroke="white" strokeWidth="0.5" opacity="0.3" />
      ))}
      {/* Floating platforms with panels */}
      <g transform="translate(90, 120)">
        <rect x="0" y="22" width="100" height="8" rx="3" fill="#9ca3af" opacity="0.7" />
        <PanelRow x={5} y={2} width={90} height={18} count={3} />
      </g>
      <g transform="translate(210, 125)">
        <rect x="0" y="22" width="100" height="8" rx="3" fill="#9ca3af" opacity="0.7" />
        <PanelRow x={5} y={2} width={90} height={18} count={3} />
      </g>
      {/* Shore */}
      <path d="M 0 195 Q 50 175 100 190 Q 150 205 200 195 Q 250 185 300 198 Q 350 210 400 195 L 400 220 L 0 220 Z"
        fill={COLORS.ground} />
    </svg>
  );
}

const VISUAL_MAP = {
  rooftop_flat: RooftopFlat,
  rooftop_tilted: RooftopTilted,
  ground_fixed: GroundFixed,
  ground_tracker: GroundTracker,
  carport: Carport,
  bipv: BIPV,
  floating: FloatingSolar,
};

export default function SystemVisualPreview({ installationType = 'rooftop_tilted', capacityKwp, className = '' }) {
  const Component = useMemo(() => VISUAL_MAP[installationType] || RooftopTilted, [installationType]);

  return (
    <div className={`rounded-xl overflow-hidden border border-slate-200 dark:border-gray-700 bg-white dark:bg-gray-800/60 ${className}`}>
      <Component />
      <div className="px-3 py-2 text-center">
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
          {INSTALLATION_TYPES.find(t => t.value === installationType)?.label || 'System Layout'}
          {capacityKwp ? ` — ${capacityKwp} kWp` : ''}
        </span>
      </div>
    </div>
  );
}

const INSTALLATION_TYPES_MAP = [
  { value: 'rooftop_flat', label: 'Rooftop (Flat)' },
  { value: 'rooftop_tilted', label: 'Rooftop (Tilted Rack)' },
  { value: 'ground_fixed', label: 'Ground Mount (Fixed)' },
  { value: 'ground_tracker', label: 'Ground (Single-Axis Tracker)' },
  { value: 'carport', label: 'Carport / Canopy' },
  { value: 'bipv', label: 'BIPV (Building-Integrated)' },
  { value: 'floating', label: 'Floating Solar' },
];
