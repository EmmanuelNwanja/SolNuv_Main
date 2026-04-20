import Head from "next/head";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { getAdminLayout } from "../../components/Layout";
import { cmsAPI } from "../../services/api";

type CmsLink = {
  id?: string;
  page_id?: string | null;
  section_id?: string | null;
  card_id?: string | null;
  link_key: string;
  label: string;
  href: string;
  target?: "_self" | "_blank";
  order_index?: number;
};

type CmsCard = {
  id?: string;
  section_id: string;
  card_key: string;
  card_type?: string;
  title?: string | null;
  body?: string | null;
  image_url?: string | null;
  order_index?: number;
  links?: CmsLink[];
};

type CmsSection = {
  id?: string;
  page_id: string;
  section_key: string;
  section_type?: string;
  title?: string | null;
  subtitle?: string | null;
  body?: string | null;
  order_index?: number;
  cards?: CmsCard[];
  links?: CmsLink[];
};

type CmsRevision = {
  id: string;
  revision_number: number;
  change_note?: string | null;
};

type CmsPage = {
  id: string;
  page_key: string;
  title: string;
  route_path: string;
  scope: "public" | "partner" | "app" | "admin";
  is_published?: boolean;
  is_enabled?: boolean;
  sections?: CmsSection[];
  links?: CmsLink[];
  revisions?: CmsRevision[];
};

const SECTION_TYPE_OPTIONS = ["generic", "hero", "stats", "faq", "cta", "feature_grid"] as const;
const CARD_TYPE_OPTIONS = ["generic", "feature", "metric", "testimonial", "cta"] as const;

export default function AdminContentStudioPage() {
  const [pages, setPages] = useState<CmsPage[]>([]);
  const [selectedPageId, setSelectedPageId] = useState("");
  const [selectedPage, setSelectedPage] = useState<CmsPage | null>(null);
  const [newPage, setNewPage] = useState({
    page_key: "",
    title: "",
    route_path: "",
    scope: "public" as CmsPage["scope"],
  });
  const [newSectionKey, setNewSectionKey] = useState("");
  const [newCardKeyBySection, setNewCardKeyBySection] = useState<Record<string, string>>({});
  const [newLinkByOwner, setNewLinkByOwner] = useState<Record<string, string>>({});
  const [draggingSectionId, setDraggingSectionId] = useState<string | null>(null);
  const [draggingCardKey, setDraggingCardKey] = useState<string | null>(null);

  async function loadPages() {
    try {
      const response = await cmsAPI.listAdminPages();
      const rows = (response.data?.data?.pages || []) as CmsPage[];
      setPages(rows);
      if (!selectedPageId && rows[0]?.id) setSelectedPageId(rows[0].id);
    } catch {
      toast.error("Could not load CMS pages");
    }
  }

  async function loadPage(id: string) {
    if (!id) return;
    try {
      const response = await cmsAPI.getAdminPage(id);
      setSelectedPage(response.data?.data as CmsPage);
    } catch {
      toast.error("Could not load page content");
      setSelectedPage(null);
    }
  }

  useEffect(() => {
    void loadPages();
  }, []);

  useEffect(() => {
    if (selectedPageId) void loadPage(selectedPageId);
  }, [selectedPageId]);

  const sections = useMemo(() => selectedPage?.sections || [], [selectedPage]);

  function arrayMove<T>(arr: T[], from: number, to: number) {
    const clone = [...arr];
    const [item] = clone.splice(from, 1);
    clone.splice(to, 0, item);
    return clone;
  }

  async function persistSectionOrder(nextSections: CmsSection[]) {
    const payload = nextSections
      .filter((section) => section.id)
      .map((section, index) => ({ id: String(section.id), order_index: index }));
    if (!payload.length) return;
    await cmsAPI.reorder("sections", payload);
  }

  async function persistCardOrder(sectionId: string, nextCards: CmsCard[]) {
    const payload = nextCards
      .filter((card) => card.id)
      .map((card, index) => ({ id: String(card.id), order_index: index }));
    if (!payload.length) return;
    await cmsAPI.reorder("cards", payload);
    setSelectedPage((prev) =>
      prev
        ? {
            ...prev,
            sections: (prev.sections || []).map((section) =>
              section.id === sectionId ? { ...section, cards: nextCards } : section
            ),
          }
        : prev
    );
  }

  async function createPage() {
    if (!newPage.page_key || !newPage.title || !newPage.route_path) {
      toast.error("page_key, title and route_path are required");
      return;
    }
    try {
      await cmsAPI.savePage(newPage);
      toast.success("Page created");
      setNewPage({ page_key: "", title: "", route_path: "", scope: "public" });
      await loadPages();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Could not create page");
    }
  }

  async function bootstrapMajorPages() {
    try {
      const response = await cmsAPI.bootstrapSeeds();
      const createdCount = Number(response.data?.data?.created_count || 0);
      toast.success(`Bootstrap complete (${createdCount} created)`);
      await loadPages();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Could not bootstrap seed pages");
    }
  }

  async function savePage(page: CmsPage) {
    try {
      await cmsAPI.savePage(page as unknown as Record<string, unknown>);
      toast.success("Page saved");
      await loadPages();
      await loadPage(page.id);
    } catch {
      toast.error("Could not save page");
    }
  }

  async function createSection() {
    if (!selectedPage?.id || !newSectionKey.trim()) return;
    try {
      await cmsAPI.saveSection({
        page_id: selectedPage.id,
        section_key: newSectionKey.trim(),
        section_type: "generic",
        title: newSectionKey.trim(),
        order_index: sections.length,
      });
      setNewSectionKey("");
      toast.success("Section created");
      await loadPage(selectedPage.id);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Could not create section");
    }
  }

  async function saveSection(section: CmsSection) {
    try {
      await cmsAPI.saveSection(section as unknown as Record<string, unknown>);
      toast.success("Section saved");
      if (selectedPage?.id) await loadPage(selectedPage.id);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Could not save section");
    }
  }

  async function createCard(section: CmsSection) {
    const value = (newCardKeyBySection[section.id || ""] || "").trim();
    if (!section.id || !value) return;
    try {
      await cmsAPI.saveCard({
        section_id: section.id,
        card_key: value,
        card_type: "generic",
        title: value,
        order_index: (section.cards || []).length,
      });
      setNewCardKeyBySection((prev) => ({ ...prev, [section.id || ""]: "" }));
      toast.success("Card created");
      if (selectedPage?.id) await loadPage(selectedPage.id);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Could not create card");
    }
  }

  async function saveCard(card: CmsCard) {
    try {
      await cmsAPI.saveCard(card as unknown as Record<string, unknown>);
      toast.success("Card saved");
      if (selectedPage?.id) await loadPage(selectedPage.id);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Could not save card");
    }
  }

  async function createPageLink(pageId: string) {
    const value = (newLinkByOwner[pageId] || "").trim();
    if (!value) return;
    try {
      await cmsAPI.saveLink({
        page_id: pageId,
        link_key: `link_${Date.now()}`,
        label: value,
        href: value.startsWith("http") || value.startsWith("/") ? value : `/${value}`,
        target: "_self",
      });
      setNewLinkByOwner((prev) => ({ ...prev, [pageId]: "" }));
      toast.success("Page link created");
      if (selectedPage?.id) await loadPage(selectedPage.id);
    } catch {
      toast.error("Could not create page link");
    }
  }

  async function saveLink(link: CmsLink) {
    try {
      await cmsAPI.saveLink(link as unknown as Record<string, unknown>);
      toast.success("Link saved");
      if (selectedPage?.id) await loadPage(selectedPage.id);
    } catch {
      toast.error("Could not save link");
    }
  }

  async function publishCurrent() {
    if (!selectedPage?.id) return;
    try {
      await cmsAPI.publishPage(selectedPage.id);
      toast.success("Page published");
      await loadPages();
      await loadPage(selectedPage.id);
    } catch {
      toast.error("Could not publish page");
    }
  }

  async function unpublishCurrent() {
    if (!selectedPage?.id) return;
    try {
      await cmsAPI.unpublishPage(selectedPage.id);
      toast.success("Page unpublished");
      await loadPages();
      await loadPage(selectedPage.id);
    } catch {
      toast.error("Could not unpublish page");
    }
  }

  async function rollbackCurrent(revisionNumber: number) {
    if (!selectedPage?.id) return;
    try {
      await cmsAPI.rollbackPage(selectedPage.id, revisionNumber);
      toast.success(`Rolled back to revision ${revisionNumber}`);
      await loadPages();
      await loadPage(selectedPage.id);
    } catch {
      toast.error("Could not rollback page");
    }
  }

  return (
    <>
      <Head>
        <title>Admin Content Studio — SolNuv</title>
      </Head>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Content Studio</h1>
          <p className="text-sm text-slate-400">
            Manage platform page sections, cards, and links across public, partner, and app surfaces.
          </p>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h2 className="font-semibold text-slate-100">Create page</h2>
            <button type="button" className="btn-ghost border border-slate-700 text-xs" onClick={() => void bootstrapMajorPages()}>
              Bootstrap major routes
            </button>
          </div>
          <div className="grid sm:grid-cols-4 gap-2">
            <input className="input bg-slate-950 border-slate-700 text-slate-100" placeholder="page_key" value={newPage.page_key} onChange={(e) => setNewPage((p) => ({ ...p, page_key: e.target.value }))} />
            <input className="input bg-slate-950 border-slate-700 text-slate-100" placeholder="title" value={newPage.title} onChange={(e) => setNewPage((p) => ({ ...p, title: e.target.value }))} />
            <input className="input bg-slate-950 border-slate-700 text-slate-100" placeholder="route_path" value={newPage.route_path} onChange={(e) => setNewPage((p) => ({ ...p, route_path: e.target.value }))} />
            <select className="input bg-slate-950 border-slate-700 text-slate-100" value={newPage.scope} onChange={(e) => setNewPage((p) => ({ ...p, scope: e.target.value as CmsPage["scope"] }))}>
              <option value="public">public</option>
              <option value="partner">partner</option>
              <option value="app">app</option>
              <option value="admin">admin</option>
            </select>
          </div>
          <button type="button" className="btn-primary mt-3" onClick={() => void createPage()}>
            Create page
          </button>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <select className="input min-w-[260px] bg-slate-950 border-slate-700 text-slate-100" value={selectedPageId} onChange={(e) => setSelectedPageId(e.target.value)}>
              {pages.map((p) => (
                <option key={p.id} value={p.id}>
                  [{p.scope}] {p.title} ({p.route_path})
                </option>
              ))}
            </select>
            {!!selectedPage && (
              <>
                <button type="button" className="btn-primary" onClick={() => void savePage(selectedPage)}>
                  Save page
                </button>
                <button type="button" className="btn-ghost border border-slate-700" onClick={() => void publishCurrent()}>
                  Publish
                </button>
                <button type="button" className="btn-ghost border border-slate-700" onClick={() => void unpublishCurrent()}>
                  Unpublish
                </button>
              </>
            )}
          </div>

          {selectedPage && (
            <div className="grid sm:grid-cols-2 gap-2">
              <input className="input bg-slate-950 border-slate-700 text-slate-100" value={selectedPage.title || ""} onChange={(e) => setSelectedPage((p) => (p ? { ...p, title: e.target.value } : p))} />
              <input className="input bg-slate-950 border-slate-700 text-slate-100" value={selectedPage.route_path || ""} onChange={(e) => setSelectedPage((p) => (p ? { ...p, route_path: e.target.value } : p))} />
              <input className="input bg-slate-950 border-slate-700 text-slate-100" value={selectedPage.page_key || ""} onChange={(e) => setSelectedPage((p) => (p ? { ...p, page_key: e.target.value } : p))} />
              <select className="input bg-slate-950 border-slate-700 text-slate-100" value={selectedPage.scope} onChange={(e) => setSelectedPage((p) => (p ? { ...p, scope: e.target.value as CmsPage["scope"] } : p))}>
                <option value="public">public</option>
                <option value="partner">partner</option>
                <option value="app">app</option>
                <option value="admin">admin</option>
              </select>
            </div>
          )}

          {!!selectedPage && (
            <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3">
              <p className="text-xs text-slate-400 mb-2">Page links</p>
              <div className="flex gap-2 mb-2">
                <input
                  className="input bg-slate-950 border-slate-700 text-slate-100"
                  placeholder="new page link (href or path)"
                  value={newLinkByOwner[selectedPage.id] || ""}
                  onChange={(e) => setNewLinkByOwner((prev) => ({ ...prev, [selectedPage.id]: e.target.value }))}
                />
                <button type="button" className="btn-ghost border border-slate-700" onClick={() => void createPageLink(selectedPage.id)}>
                  Add link
                </button>
              </div>
              <div className="space-y-2">
                {(selectedPage.links || []).map((link) => (
                  <div key={link.id} className="grid sm:grid-cols-4 gap-2">
                    <input className="input bg-slate-950 border-slate-700 text-slate-100" value={link.label} onChange={(e) => setSelectedPage((prev) => prev ? { ...prev, links: (prev.links || []).map((l) => l.id === link.id ? { ...l, label: e.target.value } : l) } : prev)} />
                    <input className="input bg-slate-950 border-slate-700 text-slate-100" value={link.href} onChange={(e) => setSelectedPage((prev) => prev ? { ...prev, links: (prev.links || []).map((l) => l.id === link.id ? { ...l, href: e.target.value } : l) } : prev)} />
                    <select className="input bg-slate-950 border-slate-700 text-slate-100" value={link.target || "_self"} onChange={(e) => setSelectedPage((prev) => prev ? { ...prev, links: (prev.links || []).map((l) => l.id === link.id ? { ...l, target: e.target.value as "_self" | "_blank" } : l) } : prev)}>
                      <option value="_self">_self</option>
                      <option value="_blank">_blank</option>
                    </select>
                    <button type="button" className="btn-ghost border border-slate-700" onClick={() => void saveLink(link)}>
                      Save link
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <input
              className="input bg-slate-950 border-slate-700 text-slate-100"
              value={newSectionKey}
              placeholder="new section key"
              onChange={(e) => setNewSectionKey(e.target.value)}
            />
            <button type="button" className="btn-primary" onClick={() => void createSection()} disabled={!selectedPage}>
              Add section
            </button>
          </div>

          <div className="space-y-3">
            {sections.map((section) => (
              <div
                key={section.id}
                draggable={Boolean(section.id)}
                onDragStart={() => setDraggingSectionId(section.id || null)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={async () => {
                  try {
                    if (!draggingSectionId || !section.id || draggingSectionId === section.id) return;
                    const fromIndex = sections.findIndex((s) => s.id === draggingSectionId);
                    const toIndex = sections.findIndex((s) => s.id === section.id);
                    if (fromIndex < 0 || toIndex < 0) return;
                    const nextSections = arrayMove(sections, fromIndex, toIndex).map((item, idx) => ({ ...item, order_index: idx }));
                    setSelectedPage((prev) => (prev ? { ...prev, sections: nextSections } : prev));
                    await persistSectionOrder(nextSections);
                    if (selectedPage?.id) await loadPage(selectedPage.id);
                    toast.success("Section order updated");
                  } catch {
                    toast.error("Could not reorder sections");
                  } finally {
                    setDraggingSectionId(null);
                  }
                }}
                onDragEnd={() => setDraggingSectionId(null)}
                className={`rounded-lg border bg-slate-950/50 p-3 ${
                  draggingSectionId === section.id ? "border-emerald-500/70" : "border-slate-800"
                }`}
              >
                <div className="grid sm:grid-cols-4 gap-2">
                  <input className="input bg-slate-900 border-slate-700 text-slate-100" value={section.section_key || ""} onChange={(e) => setSelectedPage((p) => p ? { ...p, sections: (p.sections || []).map((s) => s.id === section.id ? { ...s, section_key: e.target.value } : s) } : p)} />
                  <input className="input bg-slate-900 border-slate-700 text-slate-100" value={section.title || ""} onChange={(e) => setSelectedPage((p) => p ? { ...p, sections: (p.sections || []).map((s) => s.id === section.id ? { ...s, title: e.target.value } : s) } : p)} />
                  <input className="input bg-slate-900 border-slate-700 text-slate-100" value={section.subtitle || ""} onChange={(e) => setSelectedPage((p) => p ? { ...p, sections: (p.sections || []).map((s) => s.id === section.id ? { ...s, subtitle: e.target.value } : s) } : p)} />
                  <button type="button" className="btn-ghost border border-slate-700" onClick={() => void saveSection(section)}>
                    Save section
                  </button>
                </div>
                <div className="grid sm:grid-cols-4 gap-2 mt-2">
                  <select
                    className="input bg-slate-900 border-slate-700 text-slate-100"
                    value={section.section_type || "generic"}
                    onChange={(e) =>
                      setSelectedPage((p) =>
                        p
                          ? {
                              ...p,
                              sections: (p.sections || []).map((s) =>
                                s.id === section.id ? { ...s, section_type: e.target.value } : s
                              ),
                            }
                          : p
                      )
                    }
                  >
                    {SECTION_TYPE_OPTIONS.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                  <input
                    className="input bg-slate-900 border-slate-700 text-slate-100"
                    value={section.order_index ?? 0}
                    onChange={(e) =>
                      setSelectedPage((p) =>
                        p
                          ? {
                              ...p,
                              sections: (p.sections || []).map((s) =>
                                s.id === section.id ? { ...s, order_index: Number(e.target.value || 0) } : s
                              ),
                            }
                          : p
                      )
                    }
                    type="number"
                  />
                  <div className="text-xs text-slate-400 sm:col-span-2 flex items-center">
                    Drag and drop section cards to reorder.
                  </div>
                </div>
                <textarea className="input mt-2 bg-slate-900 border-slate-700 text-slate-100 min-h-[80px]" value={section.body || ""} onChange={(e) => setSelectedPage((p) => p ? { ...p, sections: (p.sections || []).map((s) => s.id === section.id ? { ...s, body: e.target.value } : s) } : p)} />
                {section.section_type === "hero" && (
                  <div className="mt-2 text-xs text-amber-300 border border-amber-700/40 rounded p-2">
                    Hero schema: `title` and `body` are required.
                  </div>
                )}
                {section.section_type === "stats" && (
                  <div className="mt-2 text-xs text-sky-300 border border-sky-700/40 rounded p-2">
                    Stats schema: section should include metric-type cards with numeric body values.
                  </div>
                )}
                {section.section_type === "cta" && (
                  <div className="mt-2 text-xs text-emerald-300 border border-emerald-700/40 rounded p-2">
                    CTA schema: add at least one page or card link for action buttons.
                  </div>
                )}
                <div className="space-y-2 mt-2">
                  {(section.cards || []).map((card) => (
                    <div
                      key={card.id}
                      draggable={Boolean(card.id)}
                      onDragStart={() => setDraggingCardKey(`${section.id}:${card.id || ""}`)}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={async () => {
                        try {
                          if (!section.id || !card.id || !draggingCardKey) return;
                          const [sourceSectionId, sourceCardId] = draggingCardKey.split(":");
                          if (sourceSectionId !== section.id || !sourceCardId || sourceCardId === card.id) return;
                          const cards = section.cards || [];
                          const fromIndex = cards.findIndex((c) => c.id === sourceCardId);
                          const toIndex = cards.findIndex((c) => c.id === card.id);
                          if (fromIndex < 0 || toIndex < 0) return;
                          const nextCards = arrayMove(cards, fromIndex, toIndex).map((item, idx) => ({ ...item, order_index: idx }));
                          await persistCardOrder(section.id, nextCards);
                          if (selectedPage?.id) await loadPage(selectedPage.id);
                          toast.success("Card order updated");
                        } catch {
                          toast.error("Could not reorder cards");
                        } finally {
                          setDraggingCardKey(null);
                        }
                      }}
                      onDragEnd={() => setDraggingCardKey(null)}
                      className={`grid sm:grid-cols-4 gap-2 border rounded p-2 ${
                        draggingCardKey === `${section.id}:${card.id || ""}`
                          ? "border-emerald-500/70"
                          : "border-slate-800"
                      }`}
                    >
                      <input className="input bg-slate-900 border-slate-700 text-slate-100" value={card.card_key || ""} onChange={(e) => setSelectedPage((p) => p ? { ...p, sections: (p.sections || []).map((s) => s.id === section.id ? { ...s, cards: (s.cards || []).map((c) => c.id === card.id ? { ...c, card_key: e.target.value } : c) } : s) } : p)} />
                      <input className="input bg-slate-900 border-slate-700 text-slate-100" value={card.title || ""} onChange={(e) => setSelectedPage((p) => p ? { ...p, sections: (p.sections || []).map((s) => s.id === section.id ? { ...s, cards: (s.cards || []).map((c) => c.id === card.id ? { ...c, title: e.target.value } : c) } : s) } : p)} />
                      <input className="input bg-slate-900 border-slate-700 text-slate-100" value={card.image_url || ""} placeholder="image_url" onChange={(e) => setSelectedPage((p) => p ? { ...p, sections: (p.sections || []).map((s) => s.id === section.id ? { ...s, cards: (s.cards || []).map((c) => c.id === card.id ? { ...c, image_url: e.target.value } : c) } : s) } : p)} />
                      <button type="button" className="btn-ghost border border-slate-700" onClick={() => void saveCard(card)}>
                        Save card
                      </button>
                      <select
                        className="input sm:col-span-2 bg-slate-900 border-slate-700 text-slate-100"
                        value={card.card_type || "generic"}
                        onChange={(e) =>
                          setSelectedPage((p) =>
                            p
                              ? {
                                  ...p,
                                  sections: (p.sections || []).map((s) =>
                                    s.id === section.id
                                      ? {
                                          ...s,
                                          cards: (s.cards || []).map((c) =>
                                            c.id === card.id ? { ...c, card_type: e.target.value } : c
                                          ),
                                        }
                                      : s
                                  ),
                                }
                              : p
                          )
                        }
                      >
                        {CARD_TYPE_OPTIONS.map((type) => (
                          <option key={type} value={type}>
                            {type}
                          </option>
                        ))}
                      </select>
                      <input
                        className="input sm:col-span-2 bg-slate-900 border-slate-700 text-slate-100"
                        type="number"
                        value={card.order_index ?? 0}
                        onChange={(e) =>
                          setSelectedPage((p) =>
                            p
                              ? {
                                  ...p,
                                  sections: (p.sections || []).map((s) =>
                                    s.id === section.id
                                      ? {
                                          ...s,
                                          cards: (s.cards || []).map((c) =>
                                            c.id === card.id ? { ...c, order_index: Number(e.target.value || 0) } : c
                                          ),
                                        }
                                      : s
                                  ),
                                }
                              : p
                          )
                        }
                      />
                      <textarea className="input sm:col-span-4 bg-slate-900 border-slate-700 text-slate-100 min-h-[72px]" value={card.body || ""} onChange={(e) => setSelectedPage((p) => p ? { ...p, sections: (p.sections || []).map((s) => s.id === section.id ? { ...s, cards: (s.cards || []).map((c) => c.id === card.id ? { ...c, body: e.target.value } : c) } : s) } : p)} />
                      {card.card_type === "metric" && (
                        <div className="sm:col-span-4 text-xs text-sky-300 border border-sky-700/40 rounded p-2">
                          Metric schema: use `title` as metric label and `body` as numeric/stat string.
                        </div>
                      )}
                      {card.card_type === "testimonial" && (
                        <div className="sm:col-span-4 text-xs text-amber-300 border border-amber-700/40 rounded p-2">
                          Testimonial schema: use `title` as person/company and `body` as quote.
                        </div>
                      )}
                      {card.card_type === "cta" && (
                        <div className="sm:col-span-4 text-xs text-emerald-300 border border-emerald-700/40 rounded p-2">
                          CTA schema: ensure this card includes at least one link.
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 mt-2">
                  <input
                    className="input bg-slate-900 border-slate-700 text-slate-100"
                    value={newCardKeyBySection[section.id || ""] || ""}
                    placeholder="new card key"
                    onChange={(e) => setNewCardKeyBySection((prev) => ({ ...prev, [section.id || ""]: e.target.value }))}
                  />
                  <button type="button" className="btn-ghost border border-slate-700" onClick={() => void createCard(section)}>
                    Add card
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {!!selectedPage?.revisions?.length && (
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
            <h2 className="font-semibold text-slate-100 mb-2">Revisions</h2>
            <div className="space-y-2">
              {selectedPage.revisions.map((revision) => (
                <div key={revision.id} className="flex items-center justify-between rounded border border-slate-800 p-2">
                  <div className="text-xs text-slate-300">
                    Revision {revision.revision_number}
                    {revision.change_note ? ` - ${revision.change_note}` : ""}
                  </div>
                  <button
                    type="button"
                    className="btn-ghost border border-slate-700 text-xs px-2 py-1"
                    onClick={() => void rollbackCurrent(revision.revision_number)}
                  >
                    Restore
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

AdminContentStudioPage.getLayout = getAdminLayout;
