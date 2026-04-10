/**
 * AdSlot — universal ad display component.
 *
 * Props:
 *   slot  — placement type: 'sidebar' | 'banner' | 'in-feed' | 'footer' | 'inline' | 'popup'
 *   page  — page context id: 'blog' | 'blog_post' | 'faq' | 'home' | 'contact' | etc.
 *           The backend will return ads that target this page OR target 'all'.
 *   limit — max ads to load (default 3 for sidebar, 1 for all others)
 *   className — extra classes on the wrapper
 *
 * Impressions are fired automatically on render. Clicks are tracked on interaction.
 * Works for both guest and authenticated users — no auth requirement.
 */
import { useEffect, useState } from 'react';
import { RiArrowRightLine } from 'react-icons/ri';
import { blogAPI } from '../../services/api';

function normalizeTargetUrl(rawUrl) {
  const value = String(rawUrl || '').trim();
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith('//')) return `https:${value}`;
  return `https://${value}`;
}

export default function AdSlot({ slot, page, limit, className = '' }) {
  const [ads, setAds] = useState([]);
  const effectiveLimit = limit ?? (slot === 'sidebar' ? 3 : 1);

  useEffect(() => {
    if (!slot) return;
    blogAPI
      .listAds({ placement: slot, page, limit: effectiveLimit })
      .then((r) => {
        const data = r.data.data || [];
        setAds(data);
        // Fire-and-forget impressions for all loaded ads
        const path = typeof window !== 'undefined' ? window.location.pathname : '';
        data.forEach((ad) => blogAPI.trackAdImpression(ad.id, path).catch(() => {}));
      })
      .catch(() => {});
  }, [slot, page, effectiveLimit]);

  if (!ads.length) return null;

  function handleClick(ad) {
    const path = typeof window !== 'undefined' ? window.location.pathname : '';
    blogAPI.trackAdClick(ad.id, path).catch(() => {});
    const targetUrl = normalizeTargetUrl(ad.target_url);
    if (targetUrl) window.open(targetUrl, '_blank', 'noopener,noreferrer');
  }

  // ── sidebar: vertical stack of ad cards ──────────────────────
  if (slot === 'sidebar') {
    return (
      <div className={`space-y-4 ${className}`}>
        {ads.map((ad) => (
          <div
            key={ad.id}
            role="link"
            tabIndex={0}
            onClick={() => handleClick(ad)}
            onKeyDown={(e) => e.key === 'Enter' && handleClick(ad)}
            className="cursor-pointer rounded-xl border border-amber-200 bg-amber-50 dark:bg-slate-800 dark:border-slate-700 overflow-hidden hover:shadow-md transition-shadow"
            aria-label={`Advertisement: ${ad.title}`}
          >
            {ad.image_url && (
              <img
                src={ad.image_url}
                alt={ad.title}
                className="w-full object-cover h-28"
                loading="lazy"
              />
            )}
            <div className="p-3">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-amber-600 dark:text-amber-400">
                Sponsored
              </span>
              <p className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100 line-clamp-2">
                {ad.title}
              </p>
              {ad.body_text && (
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
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
        ))}
      </div>
    );
  }

  const ad = ads[0];

  // ── banner: full-width leaderboard strip ──────────────────────
  if (slot === 'banner') {
    return (
      <div
        role="link"
        tabIndex={0}
        onClick={() => handleClick(ad)}
        onKeyDown={(e) => e.key === 'Enter' && handleClick(ad)}
        className={`cursor-pointer rounded-xl border border-amber-200/80 bg-gradient-to-r from-amber-50 via-white to-amber-50 dark:from-slate-800 dark:via-slate-900 dark:to-slate-800 dark:border-slate-700 flex items-center gap-4 px-5 py-4 hover:shadow-md transition-shadow ${className}`}
        aria-label={`Advertisement: ${ad.title}`}
      >
        {ad.image_url && (
          <img
            src={ad.image_url}
            alt={ad.title}
            className="w-14 h-14 rounded-lg object-cover flex-shrink-0"
            loading="lazy"
          />
        )}
        <div className="flex-1 min-w-0">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-amber-600 dark:text-amber-400">
            Sponsored
          </span>
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 line-clamp-1">
            {ad.title}
          </p>
          {ad.body_text && (
            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1">
              {ad.body_text}
            </p>
          )}
        </div>
        <span className="flex-shrink-0 text-xs font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1 whitespace-nowrap">
          Learn more <RiArrowRightLine />
        </span>
      </div>
    );
  }

  // ── in-feed: horizontal card between list items ───────────────
  if (slot === 'in-feed') {
    return (
      <div
        role="link"
        tabIndex={0}
        onClick={() => handleClick(ad)}
        onKeyDown={(e) => e.key === 'Enter' && handleClick(ad)}
        className={`cursor-pointer rounded-xl border border-amber-200/70 bg-gradient-to-br from-amber-50 to-white dark:from-slate-800 dark:to-slate-900 dark:border-slate-700 p-4 flex items-center gap-4 hover:shadow-md transition-shadow ${className}`}
        aria-label={`Advertisement: ${ad.title}`}
      >
        {ad.image_url && (
          <img
            src={ad.image_url}
            alt={ad.title}
            className="w-20 h-20 rounded-lg object-cover flex-shrink-0"
            loading="lazy"
          />
        )}
        <div className="min-w-0">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-amber-600 dark:text-amber-400">
            Sponsored
          </span>
          <p className="mt-0.5 text-sm font-semibold text-slate-800 dark:text-slate-100 line-clamp-1">
            {ad.title}
          </p>
          {ad.body_text && (
            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">
              {ad.body_text}
            </p>
          )}
          <span className="mt-1.5 inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 font-semibold">
            Learn more <RiArrowRightLine />
          </span>
        </div>
      </div>
    );
  }

  // ── footer: compact full-width strip ─────────────────────────
  if (slot === 'footer') {
    return (
      <div
        role="link"
        tabIndex={0}
        onClick={() => handleClick(ad)}
        onKeyDown={(e) => e.key === 'Enter' && handleClick(ad)}
        className={`cursor-pointer rounded-xl border border-amber-100 dark:border-slate-700/80 bg-amber-50/60 dark:bg-slate-800/50 flex items-center gap-4 px-4 py-3 hover:shadow-sm transition-shadow ${className}`}
        aria-label={`Advertisement: ${ad.title}`}
      >
        {ad.image_url && (
          <img
            src={ad.image_url}
            alt={ad.title}
            className="w-10 h-10 rounded-md object-cover flex-shrink-0"
            loading="lazy"
          />
        )}
        <div className="flex-1 min-w-0">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-amber-600 dark:text-amber-400">
            Sponsored
          </span>
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 line-clamp-1">
            {ad.title}
          </p>
        </div>
        {ad.target_url && (
          <span className="flex-shrink-0 text-xs text-amber-700 dark:text-amber-400 flex items-center gap-0.5 font-semibold">
            Visit <RiArrowRightLine />
          </span>
        )}
      </div>
    );
  }

  // ── inline: insert inside article content ─────────────────────
  if (slot === 'inline') {
    return (
      <div
        role="link"
        tabIndex={0}
        onClick={() => handleClick(ad)}
        onKeyDown={(e) => e.key === 'Enter' && handleClick(ad)}
        className={`cursor-pointer my-8 rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white dark:from-slate-800 dark:to-slate-900 dark:border-slate-700 overflow-hidden hover:shadow-md transition-shadow ${className}`}
        aria-label={`Advertisement: ${ad.title}`}
      >
        <div className="flex gap-4 p-4">
          {ad.image_url && (
            <img
              src={ad.image_url}
              alt={ad.title}
              className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
              loading="lazy"
            />
          )}
          <div className="min-w-0">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-amber-600 dark:text-amber-400">
              Sponsored
            </span>
            <p className="mt-0.5 text-sm font-semibold text-slate-800 dark:text-slate-100">
              {ad.title}
            </p>
            {ad.body_text && (
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                {ad.body_text}
              </p>
            )}
            <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-amber-700 dark:text-amber-400">
              Learn more <RiArrowRightLine />
            </span>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
