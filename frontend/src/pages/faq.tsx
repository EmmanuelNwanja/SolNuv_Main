import Head from "next/head";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  RiQuestionLine,
  RiAddLine,
  RiSubtractLine,
  RiSearchLine,
  RiArrowRightLine,
  RiArticleLine,
} from "react-icons/ri";
import { faqAPI } from "../services/api";
import { getPublicLayout } from "../components/Layout";
import AdSlot from "../components/ui/AdSlot";
import { MotionItem, MotionSection, MotionStagger } from "../components/PageMotion";

interface FaqEntry {
  id: string;
  question: string;
  answer: string;
  category?: string | null;
  blog_post_slug?: string | null;
  blog_post_label?: string | null;
}

function groupByCategory(faqs: FaqEntry[]): Record<string, FaqEntry[]> {
  return faqs.reduce<Record<string, FaqEntry[]>>((acc, faq) => {
    const cat = faq.category || "General";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(faq);
    return acc;
  }, {});
}

function FaqItem({ faq }: { faq: FaqEntry }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-slate-100 dark:border-slate-800 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-start justify-between gap-4 px-5 py-4 text-left bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
        aria-expanded={open}
      >
        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 leading-snug">{faq.question}</span>
        <span className="flex-shrink-0 mt-0.5 w-6 h-6 rounded-full bg-forest-50 dark:bg-forest-900/30 text-forest-700 dark:text-forest-300 flex items-center justify-center">
          {open ? <RiSubtractLine className="text-base" /> : <RiAddLine className="text-base" />}
        </span>
      </button>
      {open && (
        <div className="px-5 py-4 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800">
          <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">{faq.answer}</p>
          {faq.blog_post_slug && (
            <Link
              href={`/blog/${faq.blog_post_slug}`}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-forest-600 dark:text-forest-400 hover:text-forest-700 dark:hover:text-forest-300 transition-colors"
            >
              <RiArticleLine />
              {faq.blog_post_label || "Read related article"}
              <RiArrowRightLine />
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

function FaqPage() {
  const [faqs, setFaqs] = useState<FaqEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");

  useEffect(() => {
    faqAPI
      .list()
      .then((r) => setFaqs((r?.data?.data || []) as FaqEntry[]))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const categories = ["All", ...Array.from(new Set(faqs.map((f) => f.category || "General")))];
  const filtered = faqs.filter((f) => {
    const matchesCategory = activeCategory === "All" || f.category === activeCategory;
    const q = search.toLowerCase();
    const matchesSearch = !q || f.question.toLowerCase().includes(q) || f.answer.toLowerCase().includes(q);
    return matchesCategory && matchesSearch;
  });
  const grouped = groupByCategory(filtered);

  return (
    <>
      <Head>
        <title>FAQ — SolNuv | Solar Design, Financial Modelling &amp; Compliance</title>
        <meta
          name="description"
          content="Frequently asked questions about SolNuv — solar+BESS system design, 25-year financial modelling, NESREA EPR compliance, AI agents, tariff analysis, and lifecycle tracking for Africa."
        />
      </Head>
      <MotionSection className="marketing-section marketing-section-animated">
        <MotionStagger className="max-w-2xl mx-auto text-center" delay={0.03}>
          <span className="inline-flex items-center gap-2 marketing-kicker mb-4">
            <RiQuestionLine /> Help Centre
          </span>
          <h1 className="marketing-headline !mt-0">Frequently asked questions</h1>
          <p className="marketing-subcopy mx-auto mb-8">
            Answers on implementation workflows, platform features, pricing, reporting, and account operations.
          </p>
          <div className="relative max-w-lg mx-auto">
            <RiSearchLine className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg" />
            <input
              type="search"
              placeholder="Search questions…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input w-full pl-11 pr-4 py-3"
            />
          </div>
        </MotionStagger>
      </MotionSection>
      <div className="max-w-6xl mx-auto w-full pt-4 px-[max(1rem,env(safe-area-inset-left,0px))] pr-[max(1rem,env(safe-area-inset-right,0px))]">
        <AdSlot slot="banner" page="faq" limit={1} />
      </div>
      <MotionSection className="marketing-section marketing-section-animated">
        <div className="flex flex-col lg:flex-row gap-8">
          <main className="flex-1 min-w-0">
            {categories.length > 2 && (
              <div className="flex flex-wrap gap-2 mb-8">
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setActiveCategory(cat)}
                    className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                      activeCategory === cat
                        ? "bg-forest-700 text-white border-forest-700"
                        : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-forest-400"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}
            {loading && (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-14 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
                ))}
              </div>
            )}
            {!loading && filtered.length === 0 && (
              <div className="text-center py-20">
                <RiQuestionLine className="text-5xl text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                <p className="text-slate-500 dark:text-slate-400">{search ? `No questions match "${search}"` : "No FAQs published yet."}</p>
              </div>
            )}
            {!loading && filtered.length > 0 && (
              <MotionStagger className="space-y-10" delay={0.07}>
                {Object.entries(grouped).map(([category, items]) => (
                  <MotionItem key={category}>
                    {Object.keys(grouped).length > 1 && (
                      <h2 className="text-xs font-bold uppercase tracking-widest text-forest-600 dark:text-forest-400 mb-4">{category}</h2>
                    )}
                    <div className="space-y-2">
                      {items.map((faq) => (
                        <FaqItem key={faq.id} faq={faq} />
                      ))}
                    </div>
                  </MotionItem>
                ))}
              </MotionStagger>
            )}
          </main>
          <aside className="w-full lg:w-64 flex-shrink-0 space-y-6">
            <AdSlot slot="sidebar" page="faq" limit={2} />
          </aside>
        </div>
      </MotionSection>
      <MotionSection className="marketing-section-dark marketing-section-animated text-center">
        <span className="text-xs font-semibold uppercase tracking-widest text-emerald-300">Need more support?</span>
        <h2 className="font-display font-bold text-3xl text-white mt-3">Move from questions to implementation</h2>
        <p className="text-white/75 max-w-2xl mx-auto mt-3">
          Start a workspace or talk to the team for partner and enterprise onboarding.
        </p>
        <div className="marketing-cta-row justify-center">
          <Link href="/register" className="btn-amber inline-flex items-center gap-2">
            Create account <RiArrowRightLine />
          </Link>
          <Link href="/contact" className="btn-on-dark">
            Contact team
          </Link>
        </div>
      </MotionSection>
    </>
  );
}

FaqPage.getLayout = getPublicLayout;
export default FaqPage;
