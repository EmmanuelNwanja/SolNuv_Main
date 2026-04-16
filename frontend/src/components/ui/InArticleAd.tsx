import { useEffect } from 'react';
import { RiArrowRightLine } from 'react-icons/ri';
import { blogAPI } from '../../services/api';

export type InArticleAdData = {
  id: string;
  title?: string;
  image_url?: string;
  body_text?: string;
  target_url?: string;
  priority?: number;
  in_article_after_paragraph?: number;
};

function normalizeTargetUrl(rawUrl: unknown) {
  const value = String(rawUrl || '').trim();
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith('//')) return `https:${value}`;
  return `https://${value}`;
}

export default function InArticleAd({ ad }: { ad: InArticleAdData }) {
  useEffect(() => {
    const path = typeof window !== 'undefined' ? window.location.pathname : '';
    blogAPI.trackAdImpression(ad.id, path).catch(() => {});
  }, [ad.id]);

  function handleClick() {
    const path = typeof window !== 'undefined' ? window.location.pathname : '';
    blogAPI.trackAdClick(ad.id, path).catch(() => {});
    const targetUrl = normalizeTargetUrl(ad.target_url);
    if (targetUrl) window.open(targetUrl, '_blank', 'noopener,noreferrer');
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="not-prose w-full text-left my-8 rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white dark:from-slate-800 dark:to-slate-900 dark:border-slate-700 overflow-hidden hover:shadow-md transition-shadow"
      aria-label={`Advertisement: ${ad.title}`}
    >
      <div className="flex gap-4 p-4">
        {ad.image_url && (
          <img
            src={ad.image_url}
            alt={ad.title || 'Sponsored'}
            className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
            loading="lazy"
          />
        )}
        <div className="min-w-0">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-amber-600 dark:text-amber-400">
            Sponsored
          </span>
          {ad.title && (
            <p className="mt-0.5 text-sm font-semibold text-slate-800 dark:text-slate-100">
              {ad.title}
            </p>
          )}
          {ad.body_text && (
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 line-clamp-3">
              {ad.body_text}
            </p>
          )}
          {ad.target_url && (
            <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-amber-700 dark:text-amber-400">
              Learn more <RiArrowRightLine />
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
