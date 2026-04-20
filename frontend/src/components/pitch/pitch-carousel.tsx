"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

import { SectionBook } from "./section-book";
import { SectionDemo } from "./section-demo";
import { SectionNext } from "./section-next";
import { SectionProblem } from "./section-problem";
import { SectionSolution } from "./section-solution";
import { SectionStart } from "./section-start";
import { SectionSubscription } from "./section-subscription";
import { SectionTeam } from "./section-team";
import { SectionTraction } from "./section-traction";
import { SectionVision } from "./section-vision";
import {
  Carousel,
  type CarouselApi,
  CarouselContent,
  CarouselItem,
} from "../ui/carousel";
import { CarouselToolbar } from "./carousel-toolbar";
import { pitchdeckAPI } from "../../services/api";

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

type ViewResponse = {
  count: number;
  source: string;
  updatedAt: string;
};

type PublicMetric = {
  metric_key: string;
  value: number | string | null;
  liveFetched?: boolean;
};

type CardMeta = {
  col_span?: 1 | 2;
  height_class?: "auto" | "compact" | "tall" | "hero";
  align?: "start" | "center" | "end";
  bg_style?: "default" | "glass" | "gradient-emerald" | "gradient-violet" | "solid-dark";
  animation?: "none" | "fade-in" | "slide-up" | "zoom-in";
  accent_color?: "none" | "emerald" | "violet" | "amber" | "sky";
  chart_type?: "bar" | "line" | "pie" | "donut";
  chart_labels?: string;
  chart_values?: string;
  chart_colors?: string;
  list_items?: string;
  stat_value?: string;
  stat_unit?: string;
  video_url?: string;
  image_caption?: string;
};

type SlideMeta = {
  card_layout?: "auto" | "1-col" | "2-col" | "3-col";
  bg_gradient?: "none" | "radial-emerald" | "top-violet" | "split";
  title_size?: "default" | "large" | "xl";
};

type PublicCard = {
  id: string;
  card_type?: string | null;
  title?: string | null;
  body?: string | null;
  image_url?: string | null;
  cta_label?: string | null;
  cta_url?: string | null;
  metadata?: Record<string, unknown>;
};

type PublicSlide = {
  id: string;
  title?: string | null;
  subtitle?: string | null;
  metadata?: Record<string, unknown>;
  cards?: PublicCard[];
};

type PublicDeckPayload = {
  slides: PublicSlide[];
  metrics: PublicMetric[];
};

// ──────────────────────────────────────────────────────────────────────────────
// Layout helpers
// ──────────────────────────────────────────────────────────────────────────────

function getSlideGridClass(slide: PublicSlide): string {
  const meta = (slide.metadata || {}) as SlideMeta;
  switch (meta.card_layout) {
    case "1-col": return "flex flex-col gap-4";
    case "3-col": return "grid md:grid-cols-3 gap-4";
    case "2-col": return "grid md:grid-cols-2 gap-4";
    default:      return "grid md:grid-cols-2 gap-4";
  }
}

function getSlideBgClass(slide: PublicSlide): string {
  const meta = (slide.metadata || {}) as SlideMeta;
  switch (meta.bg_gradient) {
    case "radial-emerald":
      return "bg-[radial-gradient(ellipse_at_60%_0%,rgba(16,185,129,0.12)_0%,transparent_70%)]";
    case "top-violet":
      return "bg-gradient-to-b from-violet-950/30 to-transparent";
    case "split":
      return "bg-gradient-to-r from-slate-950 via-emerald-950/20 to-slate-950";
    default:
      return "";
  }
}

function getCardWrapClass(card: PublicCard): string {
  const meta = (card.metadata || {}) as CardMeta;
  const classes: string[] = [];

  if (meta.col_span === 2) classes.push("md:col-span-2");

  switch (meta.height_class) {
    case "compact": classes.push("min-h-[100px]"); break;
    case "tall":    classes.push("min-h-[240px]"); break;
    case "hero":    classes.push("min-h-[380px]"); break;
    default:        break;
  }

  return classes.join(" ");
}

function getCardBgClass(card: PublicCard): string {
  const meta = (card.metadata || {}) as CardMeta;

  let base = "";
  switch (meta.bg_style) {
    case "glass":
      base = "border border-white/10 bg-white/5 backdrop-blur-md";
      break;
    case "gradient-emerald":
      base = "border border-emerald-700/30 bg-gradient-to-br from-emerald-950/50 to-slate-900";
      break;
    case "gradient-violet":
      base = "border border-violet-700/30 bg-gradient-to-br from-violet-950/50 to-slate-900";
      break;
    case "solid-dark":
      base = "border border-slate-800 bg-slate-950";
      break;
    default:
      base = "border border-slate-700 bg-slate-900/70";
  }

  // Accent top-border overlay
  const accent = meta.accent_color;
  if (accent && accent !== "none") {
    const accentMap: Record<string, string> = {
      emerald: "border-t-2 border-t-emerald-500",
      violet:  "border-t-2 border-t-violet-500",
      amber:   "border-t-2 border-t-amber-500",
      sky:     "border-t-2 border-t-sky-500",
    };
    if (accentMap[accent]) base += " " + accentMap[accent];
  }

  return base;
}

function getCardAlignClass(card: PublicCard): string {
  const meta = (card.metadata || {}) as CardMeta;
  switch (meta.align) {
    case "center": return "items-center text-center";
    case "end":    return "items-end text-right";
    default:       return "items-start";
  }
}

function getAnimationVariant(card: PublicCard) {
  const meta = (card.metadata || {}) as CardMeta;
  switch (meta.animation) {
    case "fade-in":
      return { hidden: { opacity: 0 }, visible: { opacity: 1 } };
    case "slide-up":
      return { hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0 } };
    case "zoom-in":
      return { hidden: { opacity: 0, scale: 0.94 }, visible: { opacity: 1, scale: 1 } };
    default:
      return { hidden: { opacity: 1 }, visible: { opacity: 1 } };
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Inline SVG chart renderers (zero extra bundle weight)
// ──────────────────────────────────────────────────────────────────────────────

function parseChartData(meta: CardMeta) {
  const labels = (meta.chart_labels || "").split(",").map((l) => l.trim()).filter(Boolean);
  const values = (meta.chart_values || "").split(",").map((v) => Number(v.trim())).filter((n) => !isNaN(n));
  const rawColors = (meta.chart_colors || "").split(",").map((c) => c.trim()).filter(Boolean);
  const defaultColors = ["#10b981", "#8b5cf6", "#f59e0b", "#38bdf8", "#f43f5e", "#a3e635"];
  const colors = rawColors.length ? rawColors : defaultColors;
  return { labels, values, colors };
}

function BarChart({ meta }: { meta: CardMeta }) {
  const { labels, values, colors } = parseChartData(meta);
  if (!values.length) return null;
  const max = Math.max(...values, 1);
  const W = 280, H = 120, padding = 8;
  const barW = Math.floor((W - padding * 2) / values.length) - 4;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" aria-label="Bar chart">
      {values.map((v, i) => {
        const barH = Math.max(4, ((v / max) * (H - 28)));
        const x = padding + i * (barW + 4);
        const y = H - 18 - barH;
        const color = colors[i % colors.length];
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={barH} fill={color} rx={3} opacity={0.85} />
            {labels[i] && (
              <text x={x + barW / 2} y={H - 4} textAnchor="middle" fontSize={9} fill="#94a3b8">
                {labels[i].slice(0, 5)}
              </text>
            )}
            <text x={x + barW / 2} y={y - 3} textAnchor="middle" fontSize={8} fill={color}>
              {v}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function LineChart({ meta }: { meta: CardMeta }) {
  const { labels, values, colors } = parseChartData(meta);
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const W = 280, H = 100, pad = 12;
  const step = (W - pad * 2) / (values.length - 1);
  const pts = values.map((v, i) => {
    const x = pad + i * step;
    const y = H - pad - ((v - min) / range) * (H - pad * 2);
    return `${x},${y}`;
  });
  const color = colors[0] || "#10b981";

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" aria-label="Line chart">
      <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth={2} opacity={0.9} />
      {values.map((v, i) => {
        const [x, y] = pts[i].split(",");
        return <circle key={i} cx={x} cy={y} r={3} fill={color} opacity={0.9} />;
      })}
      {labels.map((label, i) => {
        const [x] = pts[i]?.split(",") || [];
        if (!x) return null;
        return (
          <text key={i} x={x} y={H - 1} textAnchor="middle" fontSize={8} fill="#94a3b8">
            {label.slice(0, 5)}
          </text>
        );
      })}
    </svg>
  );
}

function PieChart({ meta, donut }: { meta: CardMeta; donut?: boolean }) {
  const { values, colors } = parseChartData(meta);
  if (!values.length) return null;
  const total = values.reduce((a, b) => a + b, 0) || 1;
  const cx = 70, cy = 70, r = 55, innerR = donut ? 28 : 0;
  let angle = -Math.PI / 2;
  const slices: JSX.Element[] = [];

  values.forEach((v, i) => {
    const sweep = (v / total) * Math.PI * 2;
    const x1 = cx + r * Math.cos(angle);
    const y1 = cy + r * Math.sin(angle);
    angle += sweep;
    const x2 = cx + r * Math.cos(angle);
    const y2 = cy + r * Math.sin(angle);
    const large = sweep > Math.PI ? 1 : 0;
    const color = colors[i % colors.length];
    if (donut) {
      const ix1 = cx + innerR * Math.cos(angle);
      const iy1 = cy + innerR * Math.sin(angle);
      const ix2 = cx + innerR * Math.cos(angle - sweep);
      const iy2 = cy + innerR * Math.sin(angle - sweep);
      slices.push(
        <path
          key={i}
          d={`M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${ix1} ${iy1} A ${innerR} ${innerR} 0 ${large} 0 ${ix2} ${iy2} Z`}
          fill={color}
          opacity={0.85}
        />
      );
    } else {
      slices.push(
        <path
          key={i}
          d={`M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`}
          fill={color}
          opacity={0.85}
        />
      );
    }
  });

  return (
    <svg viewBox="0 0 140 140" className="w-full max-w-[140px] mx-auto" aria-label={donut ? "Donut chart" : "Pie chart"}>
      {slices}
    </svg>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Card content renderers
// ──────────────────────────────────────────────────────────────────────────────

function renderCardContent(card: PublicCard, resolveText: (t: string | null | undefined) => string) {
  const meta = (card.metadata || {}) as CardMeta;
  const cardType = card.card_type || "generic";

  if (cardType === "stat") {
    const statVal = meta.stat_value ? resolveText(meta.stat_value) : null;
    return (
      <div className="flex flex-col gap-1 py-2">
        {card.title && <p className="text-xs font-medium text-slate-400 uppercase tracking-widest">{resolveText(card.title)}</p>}
        {statVal && (
          <p className="text-4xl md:text-5xl font-bold text-white leading-none tracking-tight">
            {statVal}
            {meta.stat_unit && <span className="text-xl text-slate-400 ml-1">{meta.stat_unit}</span>}
          </p>
        )}
        {card.body && <p className="text-sm text-slate-400 mt-1">{resolveText(card.body)}</p>}
      </div>
    );
  }

  if (cardType === "list") {
    const items = (meta.list_items || "").split("\n").map((l) => l.trim()).filter(Boolean);
    return (
      <div>
        {card.title && <h3 className="text-base font-semibold text-white mb-3">{resolveText(card.title)}</h3>}
        <ul className="space-y-2">
          {items.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
              <span className="mt-0.5 text-emerald-400 shrink-0">✓</span>
              <span>{resolveText(item)}</span>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (cardType === "chart") {
    const chartType = meta.chart_type || "bar";
    return (
      <div>
        {card.title && <h3 className="text-base font-semibold text-white mb-3">{resolveText(card.title)}</h3>}
        <div className="w-full h-[130px] flex items-center justify-center">
          {chartType === "bar"   && <BarChart meta={meta} />}
          {chartType === "line"  && <LineChart meta={meta} />}
          {chartType === "pie"   && <PieChart meta={meta} />}
          {chartType === "donut" && <PieChart meta={meta} donut />}
        </div>
        {card.body && <p className="text-xs text-slate-400 mt-2 text-center">{resolveText(card.body)}</p>}
      </div>
    );
  }

  if (cardType === "video") {
    const videoUrl = meta.video_url || "";
    return (
      <div>
        {card.title && <h3 className="text-base font-semibold text-white mb-3">{resolveText(card.title)}</h3>}
        {videoUrl ? (
          <iframe
            src={videoUrl}
            className="w-full rounded-md aspect-video"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title={card.title || "Video"}
          />
        ) : (
          <div className="w-full aspect-video rounded-md bg-slate-800 flex items-center justify-center text-slate-500 text-sm">
            No video URL set
          </div>
        )}
        {card.body && <p className="text-sm text-slate-300 mt-2">{resolveText(card.body)}</p>}
      </div>
    );
  }

  if (cardType === "image") {
    return (
      <div>
        {card.title && <h3 className="text-base font-semibold text-white mb-2">{resolveText(card.title)}</h3>}
        {card.image_url ? (
          <img
            src={card.image_url}
            alt={card.title || "slide visual"}
            className="w-full rounded-md object-cover"
          />
        ) : (
          <div className="w-full h-32 rounded-md bg-slate-800 flex items-center justify-center text-slate-500 text-sm">
            No image URL set
          </div>
        )}
        {meta.image_caption && (
          <p className="text-xs text-slate-500 mt-1 text-center italic">{meta.image_caption}</p>
        )}
        {card.body && <p className="text-sm text-slate-300 mt-2">{resolveText(card.body)}</p>}
      </div>
    );
  }

  if (cardType === "cta") {
    return (
      <div className="flex flex-col gap-3">
        {card.title && <h3 className="text-lg font-bold text-white">{resolveText(card.title)}</h3>}
        {card.body && <p className="text-sm text-slate-300">{resolveText(card.body)}</p>}
        {card.cta_url && card.cta_label && (
          <a
            href={card.cta_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex self-start mt-2 px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-colors"
          >
            {resolveText(card.cta_label)}
          </a>
        )}
      </div>
    );
  }

  // generic (default)
  return (
    <>
      {card.title && <h3 className="text-lg font-semibold text-white">{resolveText(card.title)}</h3>}
      {card.body && (
        <p className="text-sm text-slate-300 mt-2 whitespace-pre-line">{resolveText(card.body)}</p>
      )}
      {card.image_url && (
        <img src={card.image_url} alt={card.title || "card visual"} className="mt-3 w-full rounded-md object-cover" />
      )}
      {meta.image_caption && (
        <p className="text-xs text-slate-500 mt-1 italic">{meta.image_caption}</p>
      )}
      {card.cta_url && card.cta_label && (
        <a
          href={card.cta_url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex mt-4 text-sm text-emerald-300 hover:text-emerald-200 underline"
        >
          {resolveText(card.cta_label)}
        </a>
      )}
    </>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Main Carousel Component
// ──────────────────────────────────────────────────────────────────────────────

export function PitchCarusel() {
  const [views, setViews] = useState(0);
  const called = useRef(false);
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);
  const [loadingViews, setLoadingViews] = useState(true);
  const [managedDeck, setManagedDeck] = useState<PublicDeckPayload | null>(null);

  useEffect(() => {
    async function fetchViewsCount() {
      try {
        setLoadingViews(true);
        const response = await fetch("/api/pitch/views", { method: "POST" });
        const data = (await response.json()) as ViewResponse;
        setViews(Number(data?.count ?? 0));
      } catch {
        setViews(18000);
      } finally {
        setLoadingViews(false);
      }
    }

    if (!called.current) {
      void fetchViewsCount();
      called.current = true;
    }
  }, []);

  useEffect(() => {
    async function loadManagedDeck() {
      try {
        const response = await pitchdeckAPI.getPublicDeck("pitch");
        const data = response.data?.data;
        if (data && Array.isArray(data.slides) && data.slides.length > 0) {
          setManagedDeck({
            slides: data.slides as PublicSlide[],
            metrics: (data.metrics || []) as PublicMetric[],
          });
        }
      } catch {
        setManagedDeck(null);
      }
    }
    void loadManagedDeck();
  }, []);

  useEffect(() => {
    if (!api) return;
    setCurrent(api.selectedScrollSnap() + 1);
    api.on("select", () => setCurrent(api.selectedScrollSnap() + 1));
  }, [api]);

  function resolveText(template: string | null | undefined): string {
    if (!template) return "";
    if (!managedDeck?.metrics?.length) return template;
    return managedDeck.metrics.reduce((acc, metric) => {
      return acc.replaceAll(`{{${metric.metric_key}}}`, String(metric.value ?? ""));
    }, template);
  }

  return (
    <Carousel className="w-full min-h-full relative" setApi={setApi}>
      <CarouselContent>
        {managedDeck?.slides?.length ? (
          managedDeck.slides.map((slide) => {
            const slideBg = getSlideBgClass(slide);
            const slideGrid = getSlideGridClass(slide);

            return (
              <CarouselItem key={slide.id}>
                <div className={`container px-4 sm:px-8 py-14 md:py-16 max-w-6xl mx-auto ${slideBg}`}>
                  {/* Slide heading */}
                  <div className="mb-8">
                    <h2 className="text-3xl md:text-5xl font-semibold tracking-tight">
                      {resolveText(slide.title)}
                    </h2>
                    {slide.subtitle && (
                      <p className="mt-3 text-base md:text-lg text-slate-300">{resolveText(slide.subtitle)}</p>
                    )}
                  </div>

                  {/* Cards grid */}
                  <div className={slideGrid}>
                    {(slide.cards || []).map((card, cardIdx) => {
                      const wrapClass = getCardWrapClass(card);
                      const bgClass = getCardBgClass(card);
                      const alignClass = getCardAlignClass(card);
                      const variant = getAnimationVariant(card);
                      const meta = (card.metadata || {}) as CardMeta;
                      const hasAnimation = meta.animation && meta.animation !== "none";

                      return (
                        <motion.div
                          key={card.id}
                          className={`rounded-xl p-4 flex flex-col ${wrapClass} ${bgClass} ${alignClass}`}
                          variants={variant}
                          initial={hasAnimation ? "hidden" : false}
                          animate="visible"
                          transition={{ duration: 0.45, delay: cardIdx * 0.08, ease: "easeOut" }}
                        >
                          {renderCardContent(card, resolveText)}
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              </CarouselItem>
            );
          })
        ) : (
          <>
            <CarouselItem><SectionStart /></CarouselItem>
            <CarouselItem><SectionProblem /></CarouselItem>
            <CarouselItem><SectionSolution /></CarouselItem>
            <CarouselItem><SectionDemo playVideo={current === 4} /></CarouselItem>
            <CarouselItem><SectionTraction /></CarouselItem>
            <CarouselItem><SectionTeam /></CarouselItem>
            <CarouselItem><SectionSubscription /></CarouselItem>
            <CarouselItem><SectionVision /></CarouselItem>
            <CarouselItem><SectionNext /></CarouselItem>
            <CarouselItem><SectionBook /></CarouselItem>
          </>
        )}
      </CarouselContent>

      <CarouselToolbar views={views} loading={loadingViews} />
    </Carousel>
  );
}
