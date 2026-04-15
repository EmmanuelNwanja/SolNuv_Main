import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useRef, useState } from 'react';
import {
  RiArrowLeftLine, RiCalendarLine, RiTimeLine, RiPriceTag3Line,
  RiArrowRightLine, RiShareLine, RiExternalLinkLine,
} from 'react-icons/ri';
import { blogAPI } from '../../services/api';
import { getPublicLayout } from '../../components/Layout';
import AdSlot from '../../components/ui/AdSlot';

// Intercepts outbound link clicks within rendered content
function useOutboundLinkTracking(slug, containerRef) {
  useEffect(() => {
    if (!containerRef.current || !slug) return;
    const container = containerRef.current;

    function handleClick(e) {
      const a = e.target.closest('a');
      if (!a) return;
      const href = a.getAttribute('href') || '';
      if (href.startsWith('http') || href.startsWith('//')) {
        blogAPI.trackLinkClick(slug, href).catch(() => {});
      }
    }

    container.addEventListener('click', handleClick);
    return () => container.removeEventListener('click', handleClick);
  }, [slug, containerRef]);
}

export default function BlogPostPage() {
  const router = useRouter();
  const slugRaw = router.query.slug;
  const slug = typeof slugRaw === "string" ? slugRaw : Array.isArray(slugRaw) ? slugRaw[0] : "";
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const contentRef = useRef(null);

  useOutboundLinkTracking(slug, contentRef);

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    blogAPI.getPost(slug)
      .then((r) => setPost(r.data.data))
      .catch((e) => {
        if (e.response?.status === 404) setNotFound(true);
      })
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) return (
    <div className="max-w-3xl mx-auto px-4 py-20 text-center text-slate-400 animate-pulse">Loading article...</div>
  );

  if (notFound || !post) return (
    <div className="max-w-3xl mx-auto px-4 py-20 text-center">
      <p className="text-slate-400 mb-4">Article not found.</p>
      <Link href="/blog" className="text-emerald-700 dark:text-emerald-400 hover:underline">Back to Blog</Link>
    </div>
  );

  const date = post.published_at
    ? new Date(post.published_at).toLocaleDateString('en-NG', { year: 'numeric', month: 'long', day: 'numeric' })
    : null;

  function handleShare() {
    if (navigator.share) {
      navigator.share({ title: post.title, url: window.location.href });
    } else {
      navigator.clipboard.writeText(window.location.href);
    }
  }

  return (
    <>
      <Head>
        <title>{post.title} - SolNuv Blog</title>
        <meta name="description" content={post.excerpt || post.title} />
        {post.cover_image_url && <meta property="og:image" content={post.cover_image_url} />}
      </Head>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Back */}
        <Link href="/blog" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-forest-900 dark:hover:text-emerald-400 mb-6 transition-colors">
          <RiArrowLeftLine /> All Articles
        </Link>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Article */}
          <article className="flex-1 min-w-0">
            {/* Cover image */}
            {post.cover_image_url && (
              <div className="rounded-2xl overflow-hidden mb-8 shadow-sm">
                <img src={post.cover_image_url} alt={post.title} className="w-full object-cover max-h-[420px]" />
              </div>
            )}

            {/* Meta */}
            {post.category && (
              <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">{post.category}</span>
            )}
            <h1 className="mt-2 text-3xl md:text-4xl font-display font-bold text-slate-900 dark:text-white leading-tight">{post.title}</h1>
            {post.excerpt && (
              <p className="mt-3 text-lg text-slate-500 dark:text-slate-400">{post.excerpt}</p>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-slate-400 dark:text-slate-500 border-b border-slate-100 dark:border-slate-800 pb-4">
              {date && <span className="flex items-center gap-1.5"><RiCalendarLine />{date}</span>}
              {post.read_time_mins && <span className="flex items-center gap-1.5"><RiTimeLine />{post.read_time_mins} min read</span>}
              <button onClick={handleShare} className="ml-auto flex items-center gap-1 text-slate-400 hover:text-forest-900 dark:hover:text-emerald-400 transition-colors">
                <RiShareLine /> Share
              </button>
            </div>

            {/* Content */}
            <div
              ref={contentRef}
              className="mt-8 prose prose-slate dark:prose-invert max-w-none prose-a:text-emerald-700 dark:prose-a:text-emerald-400 prose-headings:font-display"
              dangerouslySetInnerHTML={{ __html: post.content }}
            />

            {/* Inline ad — shown between content and tags */}
            <AdSlot slot="inline" page="blog_post" />

            {/* Tags */}
            {post.tags?.length > 0 && (
              <div className="mt-8 pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-2">
                {post.tags.map((t) => (
                  <span key={t} className="inline-flex items-center gap-1 text-xs px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    <RiPriceTag3Line />{t}
                  </span>
                ))}
              </div>
            )}

            {/* CTA */}
            <div className="mt-10 p-6 rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-slate-800 dark:to-slate-900 border border-emerald-100 dark:border-slate-700">
              <p className="font-semibold text-forest-900 dark:text-white">Want to engineer smarter solar projects?</p>
              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Join SolNuv — Africa's premier solar engineering platform.</p>
              <div className="mt-4 flex gap-3">
                <Link href="/register" className="px-4 py-2 rounded-lg bg-forest-900 text-white text-sm font-semibold hover:bg-forest-800 transition-colors">
                  Get Started
                </Link>
                <Link href="/blog" className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                  More Articles
                </Link>
              </div>
            </div>
          </article>

          {/* Sidebar */}
          <aside className="w-full lg:w-64 flex-shrink-0 space-y-6">
            <AdSlot slot="sidebar" page="blog_post" limit={2} />
            <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
              <h3 className="font-semibold text-sm text-slate-800 dark:text-white mb-2">Need support?</h3>
              <Link href="/contact" className="flex items-center gap-1 text-sm text-emerald-700 dark:text-emerald-400 hover:underline">
                Contact us <RiArrowRightLine />
              </Link>
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}

BlogPostPage.getLayout = getPublicLayout;
