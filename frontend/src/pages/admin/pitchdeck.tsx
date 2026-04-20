import Head from "next/head";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { getAdminLayout } from "../../components/Layout";
import { pitchdeckAPI } from "../../services/api";

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

type Slide = {
  id: string;
  deck_id: string;
  slide_key: string;
  title?: string | null;
  subtitle?: string | null;
  order_index: number;
  cards?: Card[];
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
};

type Metric = {
  id: string;
  deck_id: string;
  metric_key: string;
  label?: string | null;
  source_mode: "live" | "manual" | "empty_fallback_live";
  manual_value?: number | null;
};

export default function AdminPitchdeckPage() {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [selectedDeckId, setSelectedDeckId] = useState<string>("");
  const [selectedDeck, setSelectedDeck] = useState<Deck | null>(null);
  const [busy, setBusy] = useState(false);
  const [newSlideKey, setNewSlideKey] = useState("");
  const [newCardKeyBySlide, setNewCardKeyBySlide] = useState<Record<string, string>>({});

  async function loadDecks() {
    try {
      const response = await pitchdeckAPI.listAdminDecks();
      const rows = (response.data?.data?.decks || []) as Deck[];
      setDecks(rows);
      if (!selectedDeckId && rows[0]?.id) setSelectedDeckId(rows[0].id);
    } catch {
      toast.error("Could not load pitch decks");
    }
  }

  async function loadDeck(id: string) {
    if (!id) return;
    setBusy(true);
    try {
      const response = await pitchdeckAPI.getAdminDeck(id);
      setSelectedDeck(response.data?.data as Deck);
    } catch {
      toast.error("Could not load selected deck");
      setSelectedDeck(null);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    void loadDecks();
  }, []);

  useEffect(() => {
    if (!selectedDeckId) return;
    void loadDeck(selectedDeckId);
  }, [selectedDeckId]);

  const slides = useMemo(() => selectedDeck?.slides || [], [selectedDeck]);
  const metrics = useMemo(() => selectedDeck?.metrics || [], [selectedDeck]);

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

  async function saveSlide(slide: Slide) {
    try {
      await pitchdeckAPI.saveSlide(slide);
      toast.success("Slide saved");
      if (selectedDeck) await loadDeck(selectedDeck.id);
    } catch {
      toast.error("Could not save slide");
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

  async function saveCard(card: Card) {
    try {
      await pitchdeckAPI.saveCard(card);
      toast.success("Card saved");
      if (selectedDeck) await loadDeck(selectedDeck.id);
    } catch {
      toast.error("Could not save card");
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

  return (
    <>
      <Head>
        <title>Admin Pitchdeck CMS — SolNuv</title>
      </Head>
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-white">Pitchdeck CMS</h1>
            <p className="text-sm text-slate-400">
              Manage slide/card fields and control metric source mode (live/manual/fallback-live).
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              className="input min-w-[220px] bg-slate-900 border-slate-700 text-slate-100"
              value={selectedDeckId}
              onChange={(event) => setSelectedDeckId(event.target.value)}
            >
              {decks.map((deck) => (
                <option key={deck.id} value={deck.id}>
                  {deck.title} ({deck.slug})
                </option>
              ))}
            </select>
          </div>
        </div>

        {selectedDeck && (
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
            <h2 className="font-semibold text-slate-100">Deck settings</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              <input
                className="input bg-slate-950 border-slate-700 text-slate-100"
                value={selectedDeck.title || ""}
                onChange={(event) => setSelectedDeck((prev) => (prev ? { ...prev, title: event.target.value } : prev))}
                placeholder="Deck title"
              />
              <input
                className="input bg-slate-950 border-slate-700 text-slate-100"
                value={selectedDeck.slug || ""}
                onChange={(event) => setSelectedDeck((prev) => (prev ? { ...prev, slug: event.target.value } : prev))}
                placeholder="slug"
              />
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={Boolean(selectedDeck.is_published)}
                  onChange={(event) =>
                    setSelectedDeck((prev) => (prev ? { ...prev, is_published: event.target.checked } : prev))
                  }
                />
                Published
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={Boolean(selectedDeck.is_active)}
                  onChange={(event) =>
                    setSelectedDeck((prev) => (prev ? { ...prev, is_active: event.target.checked } : prev))
                  }
                />
                Active
              </label>
            </div>
            <button type="button" className="btn-primary" onClick={() => void saveDeckPatch({})} disabled={busy}>
              Save deck
            </button>
          </div>
        )}

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <h2 className="font-semibold text-slate-100 mb-3">Metric bindings</h2>
          <div className="space-y-3">
            {metrics.map((metric) => (
              <div key={metric.id} className="grid sm:grid-cols-4 gap-2">
                <input
                  className="input bg-slate-950 border-slate-700 text-slate-100"
                  value={metric.label || ""}
                  onChange={(event) => {
                    const value = event.target.value;
                    setSelectedDeck((prev) =>
                      prev
                        ? {
                            ...prev,
                            metrics: (prev.metrics || []).map((m) => (m.id === metric.id ? { ...m, label: value } : m)),
                          }
                        : prev
                    );
                  }}
                />
                <select
                  className="input bg-slate-950 border-slate-700 text-slate-100"
                  value={metric.source_mode}
                  onChange={(event) => {
                    const value = event.target.value as Metric["source_mode"];
                    setSelectedDeck((prev) =>
                      prev
                        ? {
                            ...prev,
                            metrics: (prev.metrics || []).map((m) => (m.id === metric.id ? { ...m, source_mode: value } : m)),
                          }
                        : prev
                    );
                  }}
                >
                  <option value="live">live</option>
                  <option value="manual">manual</option>
                  <option value="empty_fallback_live">empty_fallback_live</option>
                </select>
                <input
                  className="input bg-slate-950 border-slate-700 text-slate-100"
                  value={metric.manual_value ?? ""}
                  placeholder="manual value"
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    setSelectedDeck((prev) =>
                      prev
                        ? {
                            ...prev,
                            metrics: (prev.metrics || []).map((m) =>
                              m.id === metric.id ? { ...m, manual_value: nextValue === "" ? null : Number(nextValue) } : m
                            ),
                          }
                        : prev
                    );
                  }}
                />
                <button type="button" className="btn-ghost border border-slate-700" onClick={() => void saveMetric(metric)}>
                  Save metric
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-4">
          <h2 className="font-semibold text-slate-100">Slides and cards</h2>
          <div className="flex gap-2">
            <input
              className="input bg-slate-950 border-slate-700 text-slate-100"
              value={newSlideKey}
              onChange={(event) => setNewSlideKey(event.target.value)}
              placeholder="new slide key"
            />
            <button type="button" className="btn-primary" onClick={() => void createSlide()}>
              Add slide
            </button>
          </div>
          <div className="space-y-4">
            {slides.map((slide) => (
              <div key={slide.id} className="rounded-lg border border-slate-800 bg-slate-950/60 p-4 space-y-3">
                <div className="grid sm:grid-cols-3 gap-2">
                  <input
                    className="input bg-slate-900 border-slate-700 text-slate-100"
                    value={slide.slide_key}
                    onChange={(event) =>
                      setSelectedDeck((prev) =>
                        prev
                          ? {
                              ...prev,
                              slides: (prev.slides || []).map((s) =>
                                s.id === slide.id ? { ...s, slide_key: event.target.value } : s
                              ),
                            }
                          : prev
                      )
                    }
                  />
                  <input
                    className="input bg-slate-900 border-slate-700 text-slate-100"
                    value={slide.title || ""}
                    onChange={(event) =>
                      setSelectedDeck((prev) =>
                        prev
                          ? {
                              ...prev,
                              slides: (prev.slides || []).map((s) =>
                                s.id === slide.id ? { ...s, title: event.target.value } : s
                              ),
                            }
                          : prev
                      )
                    }
                  />
                  <button type="button" className="btn-ghost border border-slate-700" onClick={() => void saveSlide(slide)}>
                    Save slide
                  </button>
                </div>
                <div className="space-y-2">
                  {(slide.cards || []).map((card) => (
                    <div key={card.id} className="grid sm:grid-cols-4 gap-2">
                      <input
                        className="input bg-slate-900 border-slate-700 text-slate-100"
                        value={card.card_key}
                        onChange={(event) =>
                          setSelectedDeck((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  slides: (prev.slides || []).map((s) =>
                                    s.id === slide.id
                                      ? {
                                          ...s,
                                          cards: (s.cards || []).map((c) =>
                                            c.id === card.id ? { ...c, card_key: event.target.value } : c
                                          ),
                                        }
                                      : s
                                  ),
                                }
                              : prev
                          )
                        }
                      />
                      <input
                        className="input bg-slate-900 border-slate-700 text-slate-100"
                        value={card.title || ""}
                        onChange={(event) =>
                          setSelectedDeck((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  slides: (prev.slides || []).map((s) =>
                                    s.id === slide.id
                                      ? {
                                          ...s,
                                          cards: (s.cards || []).map((c) =>
                                            c.id === card.id ? { ...c, title: event.target.value } : c
                                          ),
                                        }
                                      : s
                                  ),
                                }
                              : prev
                          )
                        }
                      />
                      <input
                        className="input bg-slate-900 border-slate-700 text-slate-100"
                        value={card.body || ""}
                        onChange={(event) =>
                          setSelectedDeck((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  slides: (prev.slides || []).map((s) =>
                                    s.id === slide.id
                                      ? {
                                          ...s,
                                          cards: (s.cards || []).map((c) =>
                                            c.id === card.id ? { ...c, body: event.target.value } : c
                                          ),
                                        }
                                      : s
                                  ),
                                }
                              : prev
                          )
                        }
                      />
                      <button type="button" className="btn-ghost border border-slate-700" onClick={() => void saveCard(card)}>
                        Save card
                      </button>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <input
                      className="input bg-slate-900 border-slate-700 text-slate-100"
                      value={newCardKeyBySlide[slide.id] || ""}
                      placeholder="new card key"
                      onChange={(event) =>
                        setNewCardKeyBySlide((prev) => ({ ...prev, [slide.id]: event.target.value }))
                      }
                    />
                    <button type="button" className="btn-primary" onClick={() => void createCard(slide)}>
                      Add card
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

AdminPitchdeckPage.getLayout = getAdminLayout;
