import { useEffect, useState } from "react";
import Link from "next/link";
import { cmsAPI } from "../services/api";

type CmsLink = {
  id?: string;
  label: string;
  href: string;
  target?: "_self" | "_blank";
};

type CmsCard = {
  id: string;
  title?: string | null;
  body?: string | null;
  image_url?: string | null;
  links?: CmsLink[];
};

type CmsSection = {
  id: string;
  title?: string | null;
  subtitle?: string | null;
  body?: string | null;
  cards?: CmsCard[];
  links?: CmsLink[];
};

function CmsLinkButton({ link }: { link: CmsLink }) {
  const target = link.target === "_blank" ? "_blank" : "_self";
  if (link.href.startsWith("/")) {
    return (
      <Link href={link.href} className="btn-ghost text-xs px-3 py-1.5">
        {link.label}
      </Link>
    );
  }
  return (
    <a
      href={link.href}
      target={target}
      rel={target === "_blank" ? "noreferrer" : undefined}
      className="btn-ghost text-xs px-3 py-1.5"
    >
      {link.label}
    </a>
  );
}

export default function CmsRuntimeContent({ routePath }: { routePath: string }) {
  const [sections, setSections] = useState<CmsSection[]>([]);
  const [ready, setReady] = useState(false);
  const [isFallback, setIsFallback] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const response = await cmsAPI.resolvePage(routePath);
        if (!active) return;
        const data = response.data?.data || {};
        setSections((data.sections || []) as CmsSection[]);
        setIsFallback(Boolean(data.fallback));
      } catch {
        if (!active) return;
        setSections([]);
        setIsFallback(true);
      } finally {
        if (active) setReady(true);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [routePath]);

  if (!ready || isFallback || !sections.length) return null;

  return (
    <div className="space-y-6 mb-6">
      {sections.map((section) => (
        <section key={section.id} className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/40 p-5">
          {(section.title || section.subtitle || section.body) && (
            <div className="mb-4">
              {section.title && <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{section.title}</h2>}
              {section.subtitle && <p className="text-sm text-slate-500 mt-1">{section.subtitle}</p>}
              {section.body && <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 whitespace-pre-line">{section.body}</p>}
            </div>
          )}
          {!!section.cards?.length && (
            <div className="grid md:grid-cols-2 gap-3">
              {section.cards.map((card) => (
                <div key={card.id} className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 bg-slate-50/80 dark:bg-slate-950/40">
                  {card.title && <h3 className="font-semibold text-slate-900 dark:text-slate-100">{card.title}</h3>}
                  {card.body && <p className="text-sm text-slate-600 dark:text-slate-300 mt-1 whitespace-pre-line">{card.body}</p>}
                  {card.image_url && (
                    <img src={card.image_url} alt={card.title || "content image"} className="w-full rounded-md mt-2 object-cover" />
                  )}
                  {!!card.links?.length && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {card.links.map((link) => (
                        <CmsLinkButton key={link.id || `${card.id}-${link.href}`} link={link} />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          {!!section.links?.length && (
            <div className="flex flex-wrap gap-2 mt-3">
              {section.links.map((link) => (
                <CmsLinkButton key={link.id || `${section.id}-${link.href}`} link={link} />
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
