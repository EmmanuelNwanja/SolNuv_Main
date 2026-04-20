import Head from "next/head";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { getAdminLayout } from "../../components/Layout";
import { pitchdeckAPI } from "../../services/api";

// ──────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────────────────────────────────────

type CardMeta = {
  // Layout
  col_span?: 1 | 2;
  height_class?: "auto" | "compact" | "tall" | "hero";
  align?: "start" | "center" | "end";
  bg_style?: "default" | "glass" | "gradient-emerald" | "gradient-violet" | "solid-dark";
  // Animation
  animation?: "none" | "fade-in" | "slide-up" | "zoom-in";
  // Accent
  accent_color?: "none" | "emerald" | "violet" | "amber" | "sky";
  // Chart fields
  chart_type?: "bar" | "line" | "pie" | "donut";
  chart_labels?: string; // comma-separated
  chart_values?: string; // comma-separated numbers
  chart_colors?: string; // comma-separated hex or named
  // List fields
  list_items?: string; // newline-separated
  // Stat fields
  stat_value?: string;
  stat_unit?: string;
  // Video
  video_url?: string;
  // Image
  image_caption?: string;
};

type SlideMeta = {
  card_layout?: "auto" | "1-col" | "2-col" | "3-col";
  bg_gradient?: "none" | "radial-emerald" | "top-violet" | "split";
  title_size?: "default" | "large" | "xl";
};

type Card = {
  id: string;
  slide_id: string;
  card_key: string;
  card_type?: string;
  title?: string | null;
  body?: string | null;
  image_url?: string | null;
  cta_label?: string | null;
  cta_url?: string | null;
  order_index: number;
  metadata?: Record<string, unknown>;
};

type Slide = {
  id: string;
  deck_id: string;
  slide_key: string;
  title?: string | null;
  subtitle?: string | null;
  order_index: number;
  metadata?: Record<string, unknown>;
  cards?: Card[];
};

type Deck = {
  id: string;
  slug: string;
  title: string;
  description?: string | null;
  is_published?: boolean;
  is_active?: boolean;
  slides?: Slide[];
  metrics?: Metric[];
};

type Metric = {
  id: string;
  deck_id: string;
  metric_key: string;
  label?: string | null;
  source_mode: "live" | "manual" | "empty_fallback_live";
  manual_value?: number | null;
};

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

const CARD_TYPES = [
  { value: "generic", label: "Text / Generic" },
  { value: "stat", label: "Stat / Number" },
  { value: "list", label: "Bullet List" },
  { value: "image", label: "Image" },
  { value: "chart", label: "Chart / Graph" },
  { value: "video", label: "Video Embed" },
  { value: "cta", label: "Call-to-Action" },
];

const CHART_TYPES = [
  { value: "bar", label: "Bar" },
  { value: "line", label: "Line / Sparkline" },
  { value: "pie", label: "Pie" },
  { value: "donut", label: "Donut" },
];

const BG_STYLES = [
  { value: "default", label: "Default" },
  { value: "glass", label: "Glass / Frosted" },
  { value: "gradient-emerald", label: "Gradient Emerald" },
  { value: "gradient-violet", label: "Gradient Violet" },
  { value: "solid-dark", label: "Solid Dark" },
];

const ANIMATIONS = [
  { value: "none", label: "None" },
  { value: "fade-in", label: "Fade In" },
  { value: "slide-up", label: "Slide Up" },
  { value: "zoom-in", label: "Zoom In" },
];

const ACCENT_COLORS = [
  { value: "none", label: "None" },
  { value: "emerald", label: "Emerald" },
  { value: "violet", label: "Violet" },
  { value: "amber", label: "Amber" },
  { value: "sky", label: "Sky Blue" },
];

const CARD_LAYOUTS = [
  { value: "auto", label: "Auto (2-col default)" },
  { value: "1-col", label: "1 Column" },
  { value: "2-col", label: "2 Columns" },
  { value: "3-col", label: "3 Columns" },
];

const BG_GRADIENTS = [
  { value: "none", label: "None" },
  { value: "radial-emerald", label: "Radial Emerald" },
  { value: "top-violet", label: "Top Violet" },
  { value: "split", label: "Split Dark/Emerald" },
];

function getCardMeta(card: Card): CardMeta {
  return (card.metadata || {}) as CardMeta;
}

function getSlideMeta(slide: Slide): SlideMeta {
  return (slide.metadata || {}) as SlideMeta;
}

function accentBadge(color?: string) {
  const map: Record<string, string> = {
    emerald: "bg-emerald-900/40 text-emerald-300 border-emerald-700/50",
    violet: "bg-violet-900/40 text-violet-300 border-violet-700/50",
    amber: "bg-amber-900/40 text-amber-300 border-amber-700/50",
    sky: "bg-sky-900/40 text-sky-300 border-sky-700/50",
  };
  return map[color || ""] || "bg-slate-800 text-slate-400 border-slate-700";
}

function typeBadgeClass(type?: string) {
  const map: Record<string, string> = {
    stat: "bg-violet-900/40 text-violet-300",
    chart: "bg-emerald-900/40 text-emerald-300",
    list: "bg-sky-900/40 text-sky-300",
    image: "bg-amber-900/40 text-amber-300",
    video: "bg-rose-900/40 text-rose-300",
    cta: "bg-pink-900/40 text-pink-300",
    generic: "bg-slate-800 text-slate-400",
  };
  return map[type || "generic"] || "bg-slate-800 text-slate-400";
}

// ──────────────────────────────────────────────────────────────────────────────
// Card Editor (expanded panel)
// ──────────────────────────────────────────────────────────────────────────────

type CardEditorProps = {
  card: Card;
  onUpdate: (card: Card) => void;
  onSave: (card: Card) => void;
  onDelete: (cardId: string) => void;
};

function CardEditor({ card, onUpdate, onSave, onDelete }: CardEditorProps) {
  const meta = getCardMeta(card);

  function patchMeta(patch: Partial<CardMeta>) {
    onUpdate({ ...card, metadata: { ...meta, ...patch } });
  }

  function patch(fields: Partial<Card>) {
    onUpdate({ ...card, ...fields });
  }

  const cardType = card.card_type || "generic";

  return (
    <div className="border border-slate-700 rounded-lg bg-slate-950/80 overflow-hidden">
      {/* Card header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-slate-900/60 border-b border-slate-800 flex-wrap">
        <code className="text-xs text-slate-400">{card.card_key}</code>
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${typeBadgeClass(cardType)}`}>
          {cardType}
        </span>
        {meta.col_span === 2 && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-900/30 text-violet-300">full-width</span>
        )}
        {meta.animation && meta.animation !== "none" && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">{meta.animation}</span>
        )}
        <div className="ml-auto flex gap-1.5">
          <button
            type="button"
            className="btn-ghost border border-slate-700 text-xs px-2 py-1 text-emerald-400 hover:text-emerald-300"
            onClick={() => onSave(card)}
          >
            Save
          </button>
          <button
            type="button"
            className="btn-ghost border border-rose-800/60 text-xs px-2 py-1 text-rose-400 hover:text-rose-300"
            onClick={() => onDelete(card.id)}
          >
            Delete
          </button>
        </div>
      </div>

      {/* Editor body */}
      <div className="grid lg:grid-cols-2 gap-0 divide-slate-800 lg:divide-x">
        {/* ── Content column ── */}
        <div className="p-4 space-y-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-1">Content</p>

          {/* Card type selector */}
          <div className="space-y-1">
            <label className="label text-xs">Card type</label>
            <select
              className="input bg-slate-900 border-slate-700 text-slate-100 text-sm"
              value={cardType}
              onChange={(e) => patch({ card_type: e.target.value })}
            >
              {CARD_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Title – all types */}
          <div className="space-y-1">
            <label className="label text-xs">Title</label>
            <input
              className="input bg-slate-900 border-slate-700 text-slate-100 text-sm"
              value={card.title || ""}
              onChange={(e) => patch({ title: e.target.value })}
              placeholder="Card title"
            />
          </div>

          {/* Body – generic / cta / video / image (optional) */}
          {["generic", "cta", "video", "image"].includes(cardType) && (
            <div className="space-y-1">
              <label className="label text-xs">Body / Description</label>
              <textarea
                className="input bg-slate-900 border-slate-700 text-slate-100 text-sm resize-y min-h-[80px]"
                value={card.body || ""}
                onChange={(e) => patch({ body: e.target.value })}
                placeholder="Supports {{metric_key}} template tokens"
              />
            </div>
          )}

          {/* Image URL (image + generic) */}
          {["image", "generic"].includes(cardType) && (
            <>
              <div className="space-y-1">
                <label className="label text-xs">Image URL</label>
                <input
                  className="input bg-slate-900 border-slate-700 text-slate-100 text-sm"
                  value={card.image_url || ""}
                  onChange={(e) => patch({ image_url: e.target.value })}
                  placeholder="https://..."
                />
              </div>
              <div className="space-y-1">
                <label className="label text-xs">Image Caption</label>
                <input
                  className="input bg-slate-900 border-slate-700 text-slate-100 text-sm"
                  value={meta.image_caption || ""}
                  onChange={(e) => patchMeta({ image_caption: e.target.value })}
                  placeholder="Optional caption"
                />
              </div>
            </>
          )}

          {/* Stat fields */}
          {cardType === "stat" && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="label text-xs">Stat value</label>
                  <input
                    className="input bg-slate-900 border-slate-700 text-slate-100 text-sm"
                    value={meta.stat_value || ""}
                    onChange={(e) => patchMeta({ stat_value: e.target.value })}
                    placeholder="e.g. 12,500 or {{metric_key}}"
                  />
                </div>
                <div className="space-y-1">
                  <label className="label text-xs">Unit / Suffix</label>
                  <input
                    className="input bg-slate-900 border-slate-700 text-slate-100 text-sm"
                    value={meta.stat_unit || ""}
                    onChange={(e) => patchMeta({ stat_unit: e.target.value })}
                    placeholder="kg CO₂, users…"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="label text-xs">Sub-label</label>
                <input
                  className="input bg-slate-900 border-slate-700 text-slate-100 text-sm"
                  value={card.body || ""}
                  onChange={(e) => patch({ body: e.target.value })}
                  placeholder="Context description under the number"
                />
              </div>
            </>
          )}

          {/* List items */}
          {cardType === "list" && (
            <div className="space-y-1">
              <label className="label text-xs">List items (one per line)</label>
              <textarea
                className="input bg-slate-900 border-slate-700 text-slate-100 text-sm resize-y min-h-[100px] font-mono"
                value={meta.list_items || ""}
                onChange={(e) => patchMeta({ list_items: e.target.value })}
                placeholder={"First item\nSecond item\nThird item"}
              />
            </div>
          )}

          {/* Chart fields */}
          {cardType === "chart" && (
            <>
              <div className="space-y-1">
                <label className="label text-xs">Chart type</label>
                <select
                  className="input bg-slate-900 border-slate-700 text-slate-100 text-sm"
                  value={meta.chart_type || "bar"}
                  onChange={(e) => patchMeta({ chart_type: e.target.value as CardMeta["chart_type"] })}
                >
                  {CHART_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="label text-xs">Labels (comma-separated)</label>
                <input
                  className="input bg-slate-900 border-slate-700 text-slate-100 text-sm font-mono"
                  value={meta.chart_labels || ""}
                  onChange={(e) => patchMeta({ chart_labels: e.target.value })}
                  placeholder="Jan, Feb, Mar, Apr"
                />
              </div>
              <div className="space-y-1">
                <label className="label text-xs">Values (comma-separated numbers)</label>
                <input
                  className="input bg-slate-900 border-slate-700 text-slate-100 text-sm font-mono"
                  value={meta.chart_values || ""}
                  onChange={(e) => patchMeta({ chart_values: e.target.value })}
                  placeholder="120, 340, 280, 500"
                />
              </div>
              <div className="space-y-1">
                <label className="label text-xs">Colors (comma-separated hex, optional)</label>
                <input
                  className="input bg-slate-900 border-slate-700 text-slate-100 text-sm font-mono"
                  value={meta.chart_colors || ""}
                  onChange={(e) => patchMeta({ chart_colors: e.target.value })}
                  placeholder="#10b981, #8b5cf6, #f59e0b"
                />
              </div>
            </>
          )}

          {/* Video embed URL */}
          {cardType === "video" && (
            <div className="space-y-1">
              <label className="label text-xs">Video embed URL</label>
              <input
                className="input bg-slate-900 border-slate-700 text-slate-100 text-sm"
                value={meta.video_url || ""}
                onChange={(e) => patchMeta({ video_url: e.target.value })}
                placeholder="https://youtube.com/embed/... or https://vimeo.com/..."
              />
              <p className="text-[10px] text-slate-500">Use the embed/iframe URL, not the watch URL.</p>
            </div>
          )}

          {/* CTA fields */}
          {["cta", "generic"].includes(cardType) && (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="label text-xs">CTA label</label>
                <input
                  className="input bg-slate-900 border-slate-700 text-slate-100 text-sm"
                  value={card.cta_label || ""}
                  onChange={(e) => patch({ cta_label: e.target.value })}
                  placeholder="Get started"
                />
              </div>
              <div className="space-y-1">
                <label className="label text-xs">CTA URL</label>
                <input
                  className="input bg-slate-900 border-slate-700 text-slate-100 text-sm"
                  value={card.cta_url || ""}
                  onChange={(e) => patch({ cta_url: e.target.value })}
                  placeholder="https://..."
                />
              </div>
            </div>
          )}
        </div>

        {/* ── Visual & Layout column ── */}
        <div className="p-4 space-y-3 border-t border-slate-800 lg:border-t-0">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-1">Visual &amp; Layout</p>

          {/* Column span */}
          <div className="space-y-1">
            <label className="label text-xs">Width on slide</label>
            <div className="flex gap-2">
              {[
                { val: 1, label: "Half width" },
                { val: 2, label: "Full width" },
              ].map((opt) => (
                <button
                  key={opt.val}
                  type="button"
                  onClick={() => patchMeta({ col_span: opt.val as 1 | 2 })}
                  className={`flex-1 py-1.5 text-xs rounded-lg border transition-colors ${
                    (meta.col_span ?? 1) === opt.val
                      ? "border-emerald-600 bg-emerald-900/30 text-emerald-300"
                      : "border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-600"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Height */}
          <div className="space-y-1">
            <label className="label text-xs">Card height</label>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { val: "auto", label: "Auto" },
                { val: "compact", label: "Compact" },
                { val: "tall", label: "Tall" },
                { val: "hero", label: "Hero" },
              ].map((opt) => (
                <button
                  key={opt.val}
                  type="button"
                  onClick={() => patchMeta({ height_class: opt.val as CardMeta["height_class"] })}
                  className={`py-1.5 text-xs rounded-lg border transition-colors ${
                    (meta.height_class ?? "auto") === opt.val
                      ? "border-violet-600 bg-violet-900/30 text-violet-300"
                      : "border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-600"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Content alignment */}
          <div className="space-y-1">
            <label className="label text-xs">Content alignment</label>
            <div className="flex gap-2">
              {[
                { val: "start", label: "Top" },
                { val: "center", label: "Center" },
                { val: "end", label: "Bottom" },
              ].map((opt) => (
                <button
                  key={opt.val}
                  type="button"
                  onClick={() => patchMeta({ align: opt.val as CardMeta["align"] })}
                  className={`flex-1 py-1.5 text-xs rounded-lg border transition-colors ${
                    (meta.align ?? "start") === opt.val
                      ? "border-sky-600 bg-sky-900/30 text-sky-300"
                      : "border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-600"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Background style */}
          <div className="space-y-1">
            <label className="label text-xs">Background style</label>
            <select
              className="input bg-slate-900 border-slate-700 text-slate-100 text-sm"
              value={meta.bg_style || "default"}
              onChange={(e) => patchMeta({ bg_style: e.target.value as CardMeta["bg_style"] })}
            >
              {BG_STYLES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          {/* Entry animation */}
          <div className="space-y-1">
            <label className="label text-xs">Entry animation</label>
            <select
              className="input bg-slate-900 border-slate-700 text-slate-100 text-sm"
              value={meta.animation || "none"}
              onChange={(e) => patchMeta({ animation: e.target.value as CardMeta["animation"] })}
            >
              {ANIMATIONS.map((a) => (
                <option key={a.value} value={a.value}>{a.label}</option>
              ))}
            </select>
          </div>

          {/* Accent color */}
          <div className="space-y-1">
            <label className="label text-xs">Accent color</label>
            <div className="flex flex-wrap gap-1.5">
              {ACCENT_COLORS.map((a) => (
                <button
                  key={a.value}
                  type="button"
                  onClick={() => patchMeta({ accent_color: a.value as CardMeta["accent_color"] })}
                  className={`px-2 py-1 text-xs rounded-lg border transition-colors ${
                    (meta.accent_color ?? "none") === a.value
                      ? accentBadge(a.value) + " ring-1 ring-offset-1 ring-offset-slate-950"
                      : "border-slate-700 bg-slate-900 text-slate-400"
                  }`}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Main Page
// ──────────────────────────────────────────────────────────────────────────────

export default function AdminPitchdeckPage() {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [selectedDeckId, setSelectedDeckId] = useState<string>("");
  const [selectedDeck, setSelectedDeck] = useState<Deck | null>(null);
  const [busy, setBusy] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [autoBootstrapAttempted, setAutoBootstrapAttempted] = useState(false);
  const [newSlideKey, setNewSlideKey] = useState("");
  const [newCardKeyBySlide, setNewCardKeyBySlide] = useState<Record<string, string>>({});
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [expandedSlides, setExpandedSlides] = useState<Set<string>>(new Set());

  async function loadDecks() {
    try {
      const response = await pitchdeckAPI.listAdminDecks();
      const rows = (response.data?.data?.decks || []) as Deck[];
      setDecks(rows);
      const selectedStillExists = rows.some((row) => row.id === selectedDeckId);
      if ((!selectedDeckId || !selectedStillExists) && rows[0]?.id) setSelectedDeckId(rows[0].id);
      if (!rows.length) {
        setSelectedDeck(null);
        setSelectedDeckId("");
        if (!autoBootstrapAttempted) {
          setAutoBootstrapAttempted(true);
          await bootstrapStarterDeck();
          return;
        }
      }
    } catch {
      toast.error("Could not load pitch decks");
    }
  }

  async function bootstrapStarterDeck() {
    setBootstrapping(true);
    try {
      const deckRes = await pitchdeckAPI.saveDeck({
        slug: "pitch",
        title: "SolNuv Pitch Deck",
        description: "Starter pitch deck for CMS editing",
        is_published: true,
        is_active: true,
        version: 1,
      });
      const deck = deckRes.data?.data as Deck | undefined;
      if (!deck?.id) throw new Error("Deck bootstrap failed");

      const slideKeys = ["start", "problem", "solution", "demo", "traction", "team", "subscription", "vision", "next", "book"];

      for (let index = 0; index < slideKeys.length; index++) {
        const key = slideKeys[index];
        const slideRes = await pitchdeckAPI.saveSlide({
          deck_id: deck.id,
          slide_key: key,
          title: key.charAt(0).toUpperCase() + key.slice(1),
          subtitle: "Edit this slide subtitle",
          order_index: index,
          is_visible: true,
        });
        const slide = slideRes.data?.data as Slide | undefined;
        if (slide?.id) {
          await pitchdeckAPI.saveCard({
            slide_id: slide.id,
            card_key: `${key}_card`,
            card_type: "generic",
            title: "Edit card title",
            body: "Edit card body copy from dashboard",
            order_index: 0,
          });
        }
      }

      const starterMetrics: Array<{
        metric_key: string;
        label: string;
        source_mode: Metric["source_mode"];
        manual_value: number | null;
      }> = [
        { metric_key: "github_stars", label: "GitHub stars", source_mode: "live", manual_value: null },
        { metric_key: "private_beta_users", label: "Private beta users", source_mode: "empty_fallback_live", manual_value: null },
        { metric_key: "transactions", label: "Transactions", source_mode: "empty_fallback_live", manual_value: null },
      ];

      for (const metric of starterMetrics) {
        await pitchdeckAPI.saveMetric({ deck_id: deck.id, ...metric });
      }

      toast.success("Starter deck created");
      await loadDecks();
      setSelectedDeckId(deck.id);
      await loadDeck(deck.id);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } };
      toast.error(err?.response?.data?.message || "Could not create starter deck");
    } finally {
      setBootstrapping(false);
    }
  }

  async function loadDeck(id: string) {
    if (!id) return;
    setBusy(true);
    try {
      const response = await pitchdeckAPI.getAdminDeck(id);
      const deck = response.data?.data as Deck;
      setSelectedDeck(deck);
      // Auto-expand all slides for easy editing
      const allSlideIds = new Set((deck?.slides || []).map((s) => s.id));
      setExpandedSlides(allSlideIds);
    } catch {
      toast.error("Could not load selected deck");
      setSelectedDeck(null);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { void loadDecks(); }, []);
  useEffect(() => { if (!selectedDeckId) return; void loadDeck(selectedDeckId); }, [selectedDeckId]);

  const slides = useMemo(() => selectedDeck?.slides || [], [selectedDeck]);
  const metrics = useMemo(() => selectedDeck?.metrics || [], [selectedDeck]);

  function toggleCard(cardId: string) {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(cardId)) next.delete(cardId);
      else next.add(cardId);
      return next;
    });
  }

  function toggleSlide(slideId: string) {
    setExpandedSlides((prev) => {
      const next = new Set(prev);
      if (next.has(slideId)) next.delete(slideId);
      else next.add(slideId);
      return next;
    });
  }

  async function saveDeckPatch(patch: Partial<Deck>) {
    if (!selectedDeck) return;
    try {
      await pitchdeckAPI.saveDeck({ ...selectedDeck, ...patch });
      toast.success("Deck updated");
      await loadDeck(selectedDeck.id);
      await loadDecks();
    } catch {
      toast.error("Could not save deck");
    }
  }

  async function createSlide() {
    if (!selectedDeck || !newSlideKey.trim()) return;
    try {
      await pitchdeckAPI.saveSlide({
        deck_id: selectedDeck.id,
        slide_key: newSlideKey.trim(),
        title: newSlideKey.trim(),
        order_index: slides.length,
      });
      setNewSlideKey("");
      toast.success("Slide created");
      await loadDeck(selectedDeck.id);
    } catch {
      toast.error("Could not create slide");
    }
  }

  function updateSlideLocal(slideId: string, patch: Partial<Slide>) {
    setSelectedDeck((prev) =>
      prev
        ? { ...prev, slides: (prev.slides || []).map((s) => (s.id === slideId ? { ...s, ...patch } : s)) }
        : prev
    );
  }

  async function saveSlide(slide: Slide) {
    try {
      await pitchdeckAPI.saveSlide(slide);
      toast.success("Slide saved");
      if (selectedDeck) await loadDeck(selectedDeck.id);
    } catch {
      toast.error("Could not save slide");
    }
  }

  async function deleteSlide(slideId: string) {
    if (!confirm("Delete this slide and all its cards?")) return;
    try {
      await pitchdeckAPI.deleteSlide(slideId);
      toast.success("Slide deleted");
      if (selectedDeck) await loadDeck(selectedDeck.id);
    } catch {
      toast.error("Could not delete slide");
    }
  }

  async function createCard(slide: Slide) {
    const cardKey = (newCardKeyBySlide[slide.id] || "").trim();
    if (!cardKey) return;
    try {
      await pitchdeckAPI.saveCard({
        slide_id: slide.id,
        card_key: cardKey,
        card_type: "generic",
        title: cardKey,
        order_index: (slide.cards || []).length,
      });
      setNewCardKeyBySlide((prev) => ({ ...prev, [slide.id]: "" }));
      toast.success("Card created");
      if (selectedDeck) await loadDeck(selectedDeck.id);
    } catch {
      toast.error("Could not create card");
    }
  }

  function updateCardLocal(slideId: string, updatedCard: Card) {
    setSelectedDeck((prev) =>
      prev
        ? {
            ...prev,
            slides: (prev.slides || []).map((s) =>
              s.id === slideId
                ? { ...s, cards: (s.cards || []).map((c) => (c.id === updatedCard.id ? updatedCard : c)) }
                : s
            ),
          }
        : prev
    );
  }

  async function saveCard(card: Card) {
    try {
      await pitchdeckAPI.saveCard(card);
      toast.success("Card saved");
      if (selectedDeck) await loadDeck(selectedDeck.id);
    } catch {
      toast.error("Could not save card");
    }
  }

  async function deleteCard(cardId: string) {
    if (!confirm("Delete this card?")) return;
    try {
      await pitchdeckAPI.deleteCard(cardId);
      toast.success("Card deleted");
      if (selectedDeck) await loadDeck(selectedDeck.id);
    } catch {
      toast.error("Could not delete card");
    }
  }

  async function saveMetric(metric: Metric) {
    try {
      await pitchdeckAPI.saveMetric(metric);
      toast.success("Metric saved");
      if (selectedDeck) await loadDeck(selectedDeck.id);
    } catch {
      toast.error("Could not save metric");
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
      <Head>
        <title>Admin Pitchdeck CMS — SolNuv</title>
      </Head>
      <div className="space-y-6">
        {/* Page header */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-white">Pitchdeck CMS</h1>
            <p className="text-sm text-slate-400">
              Full visual control — card types, images, charts, animations, positioning, and metric bindings.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              className="input min-w-[220px] bg-slate-900 border-slate-700 text-slate-100"
              value={selectedDeckId}
              onChange={(e) => setSelectedDeckId(e.target.value)}
            >
              {!decks.length && <option value="">No decks available yet</option>}
              {decks.map((deck) => (
                <option key={deck.id} value={deck.id}>
                  {deck.title} ({deck.slug})
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn-ghost border border-slate-700"
              onClick={() => void bootstrapStarterDeck()}
              disabled={bootstrapping}
            >
              {bootstrapping ? "Creating…" : "Create starter deck"}
            </button>
          </div>
        </div>

        {!decks.length && (
          <div className="rounded-xl border border-amber-700/40 bg-amber-900/10 p-4 text-sm text-amber-200">
            No editable pitch deck exists yet. Click{" "}
            <span className="font-semibold">Create starter deck</span> to generate one and start editing.
          </div>
        )}

        {/* ── Deck settings ── */}
        {selectedDeck && (
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
            <h2 className="font-semibold text-slate-100">Deck settings</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              <input
                className="input bg-slate-950 border-slate-700 text-slate-100"
                value={selectedDeck.title || ""}
                onChange={(e) => setSelectedDeck((prev) => (prev ? { ...prev, title: e.target.value } : prev))}
                placeholder="Deck title"
              />
              <input
                className="input bg-slate-950 border-slate-700 text-slate-100"
                value={selectedDeck.slug || ""}
                onChange={(e) => setSelectedDeck((prev) => (prev ? { ...prev, slug: e.target.value } : prev))}
                placeholder="slug"
              />
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={Boolean(selectedDeck.is_published)}
                  onChange={(e) => setSelectedDeck((prev) => (prev ? { ...prev, is_published: e.target.checked } : prev))}
                />
                Published
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={Boolean(selectedDeck.is_active)}
                  onChange={(e) => setSelectedDeck((prev) => (prev ? { ...prev, is_active: e.target.checked } : prev))}
                />
                Active (shown on pitchdeck page)
              </label>
            </div>
            <button type="button" className="btn-primary" onClick={() => void saveDeckPatch({})} disabled={busy}>
              Save deck settings
            </button>
          </div>
        )}

        {/* ── Metric bindings ── */}
        {selectedDeck && metrics.length > 0 && (
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <h2 className="font-semibold text-slate-100 mb-1">Metric bindings</h2>
            <p className="text-xs text-slate-500 mb-3">
              Use <code className="bg-slate-800 px-1 rounded">{"{{metric_key}}"}</code> in any title or body to inject live values.
            </p>
            <div className="space-y-3">
              {metrics.map((metric) => (
                <div key={metric.id} className="grid sm:grid-cols-4 gap-2 items-center">
                  <div className="space-y-0.5">
                    <label className="text-[10px] uppercase tracking-widest text-slate-500">Label</label>
                    <input
                      className="input bg-slate-950 border-slate-700 text-slate-100 text-sm"
                      value={metric.label || ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        setSelectedDeck((prev) =>
                          prev
                            ? { ...prev, metrics: (prev.metrics || []).map((m) => (m.id === metric.id ? { ...m, label: v } : m)) }
                            : prev
                        );
                      }}
                      placeholder="Display label"
                    />
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-[10px] uppercase tracking-widest text-slate-500">Source mode</label>
                    <select
                      className="input bg-slate-950 border-slate-700 text-slate-100 text-sm"
                      value={metric.source_mode}
                      onChange={(e) => {
                        const v = e.target.value as Metric["source_mode"];
                        setSelectedDeck((prev) =>
                          prev
                            ? { ...prev, metrics: (prev.metrics || []).map((m) => (m.id === metric.id ? { ...m, source_mode: v } : m)) }
                            : prev
                        );
                      }}
                    >
                      <option value="live">Live (API)</option>
                      <option value="manual">Manual value</option>
                      <option value="empty_fallback_live">Manual → fallback live</option>
                    </select>
                  </div>
                  <div className="space-y-0.5">
                    <label className="text-[10px] uppercase tracking-widest text-slate-500">Manual value</label>
                    <input
                      className="input bg-slate-950 border-slate-700 text-slate-100 text-sm"
                      value={metric.manual_value ?? ""}
                      placeholder="override number"
                      disabled={metric.source_mode === "live"}
                      onChange={(e) => {
                        const v = e.target.value;
                        setSelectedDeck((prev) =>
                          prev
                            ? {
                                ...prev,
                                metrics: (prev.metrics || []).map((m) =>
                                  m.id === metric.id ? { ...m, manual_value: v === "" ? null : Number(v) } : m
                                ),
                              }
                            : prev
                        );
                      }}
                    />
                  </div>
                  <button type="button" className="btn-ghost border border-slate-700 text-sm" onClick={() => void saveMetric(metric)}>
                    Save metric
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Slides & Cards ── */}
        {selectedDeck && (
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h2 className="font-semibold text-slate-100">Slides &amp; Cards</h2>
              <div className="flex gap-2">
                <input
                  className="input bg-slate-950 border-slate-700 text-slate-100 text-sm"
                  value={newSlideKey}
                  onChange={(e) => setNewSlideKey(e.target.value)}
                  placeholder="new slide key (e.g. traction)"
                />
                <button type="button" className="btn-primary text-sm" onClick={() => void createSlide()}>
                  Add slide
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {slides.map((slide) => {
                const slideMeta = getSlideMeta(slide);
                const isSlideExpanded = expandedSlides.has(slide.id);

                return (
                  <div key={slide.id} className="rounded-xl border border-slate-700 bg-slate-950/40 overflow-hidden">
                    {/* Slide header */}
                    <div className="flex items-center gap-2 px-4 py-3 bg-slate-900/80 border-b border-slate-800 flex-wrap">
                      <button
                        type="button"
                        className="text-slate-500 hover:text-slate-300 text-xs"
                        onClick={() => toggleSlide(slide.id)}
                      >
                        {isSlideExpanded ? "▼" : "▶"}
                      </button>
                      <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Slide</span>
                      <code className="text-sm text-emerald-300 font-medium">{slide.slide_key}</code>
                      <span className="text-slate-600">·</span>
                      <span className="text-xs text-slate-500">{(slide.cards || []).length} card(s)</span>

                      {/* Slide layout quick controls */}
                      <div className="flex items-center gap-1.5 ml-auto flex-wrap">
                        <span className="text-[10px] text-slate-500">Layout:</span>
                        <select
                          className="input py-0.5 px-2 text-xs bg-slate-900 border-slate-700 text-slate-300 h-auto"
                          value={slideMeta.card_layout || "auto"}
                          onChange={(e) =>
                            updateSlideLocal(slide.id, {
                              metadata: { ...slideMeta, card_layout: e.target.value as SlideMeta["card_layout"] },
                            })
                          }
                        >
                          {CARD_LAYOUTS.map((l) => (
                            <option key={l.value} value={l.value}>{l.label}</option>
                          ))}
                        </select>
                        <span className="text-[10px] text-slate-500">BG:</span>
                        <select
                          className="input py-0.5 px-2 text-xs bg-slate-900 border-slate-700 text-slate-300 h-auto"
                          value={slideMeta.bg_gradient || "none"}
                          onChange={(e) =>
                            updateSlideLocal(slide.id, {
                              metadata: { ...slideMeta, bg_gradient: e.target.value as SlideMeta["bg_gradient"] },
                            })
                          }
                        >
                          {BG_GRADIENTS.map((g) => (
                            <option key={g.value} value={g.value}>{g.label}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="btn-ghost border border-emerald-700/50 text-emerald-400 text-xs px-2 py-1"
                          onClick={() => void saveSlide(slide)}
                        >
                          Save slide
                        </button>
                        <button
                          type="button"
                          className="btn-ghost border border-rose-800/60 text-rose-400 text-xs px-2 py-1"
                          onClick={() => void deleteSlide(slide.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    {/* Slide title/subtitle row */}
                    {isSlideExpanded && (
                      <div className="px-4 py-3 grid sm:grid-cols-2 gap-2 border-b border-slate-800 bg-slate-900/30">
                        <input
                          className="input bg-slate-900 border-slate-700 text-slate-100 text-sm"
                          value={slide.title || ""}
                          onChange={(e) => updateSlideLocal(slide.id, { title: e.target.value })}
                          placeholder="Slide title (shown in large heading)"
                        />
                        <input
                          className="input bg-slate-900 border-slate-700 text-slate-100 text-sm"
                          value={(slide as Slide & { subtitle?: string }).subtitle || ""}
                          onChange={(e) => updateSlideLocal(slide.id, { subtitle: e.target.value })}
                          placeholder="Slide subtitle / tagline"
                        />
                      </div>
                    )}

                    {/* Cards */}
                    {isSlideExpanded && (
                      <div className="p-4 space-y-3">
                        {(slide.cards || []).map((card) => {
                          const isExpanded = expandedCards.has(card.id);
                          return (
                            <div key={card.id} className="space-y-2">
                              {/* Card mini-header (collapsed) */}
                              {!isExpanded && (
                                <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-800 bg-slate-900/50 flex-wrap">
                                  <code className="text-xs text-slate-400">{card.card_key}</code>
                                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${typeBadgeClass(card.card_type)}`}>
                                    {card.card_type || "generic"}
                                  </span>
                                  {card.title && (
                                    <span className="text-xs text-slate-300 truncate max-w-[180px]">{card.title}</span>
                                  )}
                                  <button
                                    type="button"
                                    className="ml-auto text-xs text-slate-400 hover:text-slate-200 border border-slate-700 rounded px-2 py-0.5"
                                    onClick={() => toggleCard(card.id)}
                                  >
                                    Edit ▼
                                  </button>
                                </div>
                              )}
                              {/* Card full editor (expanded) */}
                              {isExpanded && (
                                <div className="space-y-2">
                                  <button
                                    type="button"
                                    className="text-xs text-slate-500 hover:text-slate-300"
                                    onClick={() => toggleCard(card.id)}
                                  >
                                    ▲ Collapse editor
                                  </button>
                                  <CardEditor
                                    card={card}
                                    onUpdate={(updated) => updateCardLocal(slide.id, updated)}
                                    onSave={(c) => void saveCard(c)}
                                    onDelete={(id) => void deleteCard(id)}
                                  />
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {/* Add card row */}
                        <div className="flex gap-2 pt-1">
                          <input
                            className="input bg-slate-900 border-slate-700 text-slate-100 text-sm"
                            value={newCardKeyBySlide[slide.id] || ""}
                            placeholder="new card key"
                            onChange={(e) => setNewCardKeyBySlide((prev) => ({ ...prev, [slide.id]: e.target.value }))}
                          />
                          <button type="button" className="btn-primary text-sm whitespace-nowrap" onClick={() => void createCard(slide)}>
                            Add card
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

AdminPitchdeckPage.getLayout = getAdminLayout;
