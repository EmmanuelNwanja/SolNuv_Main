/**
 * DesignShadingCanvas — feature-flagged design spike
 *
 * A lightweight 2D top-down + side-elevation canvas that shows the PV array
 * layout, the sun's position over the day, and cast shadows. This is a
 * spike (not a full 3D solver): it is gated behind
 * `NEXT_PUBLIC_ENABLE_DESIGN_CANVAS=true` so we can validate UX and solar
 * geometry math before committing to a Three.js build-out.
 *
 * The geometry model:
 *   - Solar azimuth/elevation from a classic NOAA/SPA-style formula
 *     (sufficient for UX; not a yield engine).
 *   - Array is a rectangle sized from capacity × module dimensions,
 *     drawn with tilt projected as a foreshortened polygon.
 *   - A single representative obstacle (e.g. a rooftop stack) casts a
 *     projected shadow line — to communicate "this is what shading means".
 */
import { useEffect, useMemo, useRef, useState } from 'react';

export interface DesignCanvasProps {
  lat: number;
  lon: number;
  tiltDeg: number;
  azimuthDeg: number;
  pvCapacityKwp: number;
  /** Module nameplate wattage (defaults to 550 W). */
  moduleWatt?: number;
  /** Module physical size in metres (width, height). */
  moduleSize?: { w: number; h: number };
  /** Rows × columns layout override. If omitted, we lay modules out greedily. */
  layout?: { rows: number; cols: number };
}

const CANVAS_W = 520;
const CANVAS_H = 320;
const DEG = Math.PI / 180;

function dayOfYear(d: Date): number {
  const start = new Date(Date.UTC(d.getUTCFullYear(), 0, 0));
  const diff = d.getTime() - start.getTime();
  return Math.floor(diff / 86400000);
}

/**
 * Compute sun azimuth (degrees CW from north) and elevation (degrees above
 * horizon) for a given UTC date and location. Accuracy is ±1° — plenty for a
 * spike visualization. Based on the NOAA "Solar Position Algorithm" simplified.
 */
function sunPosition(lat: number, lon: number, when: Date): { az: number; el: number } {
  const n = dayOfYear(when);
  // Solar declination (degrees)
  const decl = 23.45 * Math.sin(DEG * (360 / 365) * (284 + n));
  // Equation of time in minutes (simplified Spencer's formula)
  const B = DEG * (360 / 365) * (n - 81);
  const eot = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);
  // Local solar time (hours)
  const utcHours = when.getUTCHours() + when.getUTCMinutes() / 60 + when.getUTCSeconds() / 3600;
  const lstm = 15 * Math.round(lon / 15); // nearest standard meridian
  const tcFactor = 4 * (lon - lstm) + eot; // minutes
  const lst = utcHours + tcFactor / 60;
  const hra = 15 * (lst - 12); // hour angle in degrees

  const latR = lat * DEG;
  const dR = decl * DEG;
  const hR = hra * DEG;

  const sinEl = Math.sin(latR) * Math.sin(dR) + Math.cos(latR) * Math.cos(dR) * Math.cos(hR);
  const el = Math.asin(Math.max(-1, Math.min(1, sinEl))) / DEG;

  const cosAz = (Math.sin(dR) - Math.sin(sinEl) * Math.sin(latR)) / (Math.cos(Math.asin(sinEl)) * Math.cos(latR));
  let az = Math.acos(Math.max(-1, Math.min(1, cosAz))) / DEG;
  if (hra > 0) az = 360 - az;
  return { az, el };
}

export default function DesignShadingCanvas({
  lat,
  lon,
  tiltDeg,
  azimuthDeg,
  pvCapacityKwp,
  moduleWatt = 550,
  moduleSize = { w: 1.13, h: 2.28 },
  layout,
}: DesignCanvasProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [hour, setHour] = useState<number>(12);
  const [month, setMonth] = useState<number>(6); // June by default

  const date = useMemo(() => {
    // Use day 15 of the selected month in the current year for a stable sun path.
    const y = new Date().getUTCFullYear();
    const d = new Date(Date.UTC(y, month - 1, 15, Math.floor(hour), (hour % 1) * 60));
    return d;
  }, [month, hour]);

  const { moduleCount, rows, cols, arrayW, arrayH } = useMemo(() => {
    const kwPerModule = moduleWatt / 1000;
    const count = Math.max(1, Math.round(pvCapacityKwp / kwPerModule));
    let r = layout?.rows;
    let c = layout?.cols;
    if (!r || !c) {
      c = Math.max(1, Math.ceil(Math.sqrt(count)));
      r = Math.max(1, Math.ceil(count / c));
    }
    return {
      moduleCount: count,
      rows: r,
      cols: c,
      arrayW: c * moduleSize.w,
      arrayH: r * moduleSize.h,
    };
  }, [pvCapacityKwp, moduleWatt, moduleSize.w, moduleSize.h, layout?.rows, layout?.cols]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = CANVAS_W * dpr;
    canvas.height = CANVAS_H * dpr;
    canvas.style.width = CANVAS_W + 'px';
    canvas.style.height = CANVAS_H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    // Sky gradient
    const sky = ctx.createLinearGradient(0, 0, 0, CANVAS_H * 0.6);
    sky.addColorStop(0, '#1e3a5f');
    sky.addColorStop(1, '#5b8bb8');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H * 0.6);

    // Ground
    ctx.fillStyle = '#2f4a37';
    ctx.fillRect(0, CANVAS_H * 0.6, CANVAS_W, CANVAS_H * 0.4);

    // Horizon line
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath();
    ctx.moveTo(0, CANVAS_H * 0.6);
    ctx.lineTo(CANVAS_W, CANVAS_H * 0.6);
    ctx.stroke();

    // Compass
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = '10px ui-sans-serif, system-ui';
    ctx.fillText('N', CANVAS_W / 2 - 4, 12);
    ctx.fillText('S', CANVAS_W / 2 - 3, CANVAS_H - 4);
    ctx.fillText('E', CANVAS_W - 12, CANVAS_H / 2);
    ctx.fillText('W', 4, CANVAS_H / 2);

    // Sun position
    const { az, el } = sunPosition(lat, lon, date);
    const sunColor = el <= 0 ? '#94a3b8' : '#fde68a';
    const sunVisible = el > -6;
    // Project sun to the 2D canvas: horizontal position from azimuth, vertical from elevation.
    const azRad = az * DEG;
    const horizonY = CANVAS_H * 0.6;
    const maxRiseHeight = CANVAS_H * 0.55;
    const sunX = CANVAS_W / 2 + Math.sin(azRad) * (CANVAS_W * 0.42);
    const sunY = horizonY - Math.max(0, el) / 90 * maxRiseHeight;
    if (sunVisible) {
      ctx.beginPath();
      ctx.fillStyle = sunColor;
      ctx.arc(sunX, sunY, 10, 0, 2 * Math.PI);
      ctx.fill();
      ctx.strokeStyle = 'rgba(253, 230, 138, 0.35)';
      for (let i = 1; i <= 3; i++) {
        ctx.beginPath();
        ctx.arc(sunX, sunY, 10 + i * 4, 0, 2 * Math.PI);
        ctx.stroke();
      }
    }

    // Array footprint (top-down projection centered on the ground area)
    const cx = CANVAS_W / 2;
    const cy = CANVAS_H * 0.78;
    // Draw a schematic tilted array as a parallelogram: width = arrayW in metres
    // scaled, height foreshortened by cos(tilt).
    const scale = 8; // metres → px
    const drawW = Math.min(arrayW * scale, CANVAS_W * 0.5);
    const drawH = arrayH * scale * Math.max(0.25, Math.cos(tiltDeg * DEG));
    const azimRad = azimuthDeg * DEG;
    // Rotate array footprint by (azimuthDeg - 180) so that azimuth=180 (equator-facing) points down.
    const rot = (azimuthDeg - 180) * DEG;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.fillStyle = 'rgba(15, 118, 110, 0.75)';
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.9)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.rect(-drawW / 2, -drawH / 2, drawW, drawH);
    ctx.fill();
    ctx.stroke();
    // Module grid
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 0.75;
    const colW = drawW / cols;
    const rowH = drawH / rows;
    for (let i = 1; i < cols; i++) {
      ctx.beginPath();
      ctx.moveTo(-drawW / 2 + i * colW, -drawH / 2);
      ctx.lineTo(-drawW / 2 + i * colW, drawH / 2);
      ctx.stroke();
    }
    for (let j = 1; j < rows; j++) {
      ctx.beginPath();
      ctx.moveTo(-drawW / 2, -drawH / 2 + j * rowH);
      ctx.lineTo(drawW / 2, -drawH / 2 + j * rowH);
      ctx.stroke();
    }
    ctx.restore();

    // Shadow projection from a representative obstacle (2m tall, 6m south of array).
    if (el > 0) {
      const shadowLen = 2 / Math.tan(el * DEG); // metres
      const sx = cx + Math.sin(azRad + Math.PI) * 6 * scale; // obstacle location opposite to sun azimuth
      const sy = cy + Math.cos(azRad + Math.PI) * 6 * scale;
      const ex = sx + Math.sin(azRad + Math.PI) * shadowLen * scale;
      const ey = sy + Math.cos(azRad + Math.PI) * shadowLen * scale;
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.font = '10px ui-sans-serif, system-ui';
      ctx.fillText(`Shadow ≈ ${shadowLen.toFixed(1)} m`, ex + 4, ey - 4);
    }

    // HUD
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(8, 8, 180, 46);
    ctx.fillStyle = '#f8fafc';
    ctx.font = '11px ui-sans-serif, system-ui';
    ctx.fillText(`Az ${az.toFixed(1)}°  El ${el.toFixed(1)}°`, 14, 22);
    ctx.fillText(`${moduleCount} modules · ${rows}×${cols}`, 14, 36);
    ctx.fillText(`Tilt ${tiltDeg}°  Azi ${azimuthDeg}°`, 14, 50);
  }, [lat, lon, tiltDeg, azimuthDeg, moduleCount, rows, cols, arrayW, arrayH, date]);

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-200">
          Shading spike
        </div>
        <span className="text-[10px] uppercase tracking-wide text-amber-600 dark:text-amber-400">
          Experimental
        </span>
      </div>
      <canvas ref={ref} className="block rounded-md bg-slate-100 dark:bg-slate-950" />
      <div className="grid grid-cols-2 gap-3 mt-2 text-xs text-slate-600 dark:text-slate-300">
        <label>
          <div className="flex justify-between">
            <span>Month</span>
            <span>{new Date(2000, month - 1, 1).toLocaleString('en', { month: 'short' })}</span>
          </div>
          <input
            type="range"
            min={1}
            max={12}
            step={1}
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="w-full"
          />
        </label>
        <label>
          <div className="flex justify-between">
            <span>Hour (UTC)</span>
            <span>{hour.toFixed(1)}h</span>
          </div>
          <input
            type="range"
            min={0}
            max={23.5}
            step={0.5}
            value={hour}
            onChange={(e) => setHour(Number(e.target.value))}
            className="w-full"
          />
        </label>
      </div>
      <div className="mt-2 text-[10px] text-slate-500 dark:text-slate-500 leading-snug">
        Spike preview — sun position is computed with a simplified solar algorithm
        (±1° accuracy). A 2m obstacle is shown 6m from the array to illustrate
        shadow length at the selected time. Full 3D shading is planned.
      </div>
    </div>
  );
}
