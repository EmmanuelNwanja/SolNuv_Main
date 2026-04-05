import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import {
  RiArticleLine, RiTimeLine, RiArrowRightLine, RiSearchLine,
  RiPriceTag3Line, RiCalendarLine, RiEyeLine,
} from 'react-icons/ri';
import { blogAPI } from '../../services/api';
import { getPublicLayout } from '../../components/Layout';

const CATEGORIES = ['All', 'Solar Energy', 'Battery Storage', 'Engineering', 'Industry News', 'Case Studies', 'Regulations'];

function BlogAdBanner({ placement }) {
  const [ads, setAds] = useState([]);

  useEffect(() => {
    blogAPI.listAds({ placement }).then((r) => setAds(r.data.data || [])).catch(() => {});
  }, [placement]);

  if (!ads.length) return null;
  const ad = ads[0];

  function handleClick() {
    blogAPI.trackAdClick(ad.id, typeof window !== 'undefined' ? window.location.pathname : '').catch(() => {});
    if (ad.target_url) window.open(ad.target_url, '_blank', 'noopener,noreferrer');
  }

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => e.key === 'Enter' && handleClick()}
      className="cursor-pointer rounded-xl border border-amber-200 bg-amber-50 dark:bg-slate-800 dark:border-slate-700 overflow-hidden flex flex-col hover:shadow-md transition-shadow"
      aria-label={`Advertisement: ${ad.title}`}
    >
      {ad.image_url && (
        <img src={ad.image_url} alt={ad.title} className="w-full object-cover h-32" loading="lazy" />
      )}
      <div className="p-3">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-amber-600 dark:text-amber-400">Sponsored</span>
        <p className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100 line-clamp-2">{ad.title}</p>
        {ad.body_text && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{ad.body_text}</p>}
      </div>
    </div>
  );
}

function BlogAdInFeed({ placement = 'in-feed' }) {
  const [ads, setAds] = useState([]);

  useEffect(() => {
    blogAPI.listAds({ placement }).then((r) => setAds(r.data.data || [])).catch(() => {});
  }, [placement]);

  if (!ads.length) return null;
  const ad = ads[0];

  function handleClick() {
    blogAPI.trackAdClick(ad.id, typeof window !== 'undefined' ? window.location.pathname : '').catch(() => {});
    if (ad.target_url) window.open(ad.target_url, '_blank', 'noopener,noreferrer');
  }

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => e.key === 'Enter' && handleClick()}
      className="cursor-pointer rounded-xl border border-amber-200/70 bg-gradient-to-br from-amber-50 to-white dark:from-slate-800 dark:to-slate-900 dark:border-slate-700 p-4 flex items-center gap-4 hover:shadow-md transition-shadow"
      aria-label={`Advertisement: ${ad.title}`}
    >
      {ad.image_url && (
        <img src={ad.image_url} alt={ad.title} className="w-20 h-20 rounded-lg object-cover flex-shrink-0" loading="lazy" />
      )}
      <div className="min-w-0">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-amber-600 dark:text-amber-400">Sponsored</span>
        <p className="mt-0.5 text-sm font-semibold text-slate-800 dark:text-slate-100 line-clamp-1">{ad.title}</p>
        {ad.body_text && <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">{ad.body_text}</p>}
        <span className="mt-1 inline-flex items-center gap-1 text-xs text-amber-600 font-medium">Learn more <RiArrowRightLine /></span>
      </div>
    </div>
  );
}

function PostCard({ post }) {
  const date = post.published_at ? new Date(post.published_at).toLocaleDateString('en-NG', { year: 'numeric', month: 'short', day: 'numeric' }) : null;

  return (
    <Link href={`/blog/${post.slug}`} className="group flex flex-col rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden hover:shadow-lg transition-shadow">
      {post.cover_image_url ? (
        <div className="h-48 overflow-hidden">
          <img src={post.cover_image_url} alt={post.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
        </div>
      ) : (
        <div className="h-48 bg-gradient-to-br from-emerald-50 to-teal-100 dark:from-slate-800 dark:to-slate-700 flex items-center justify-center">
          <RiArticleLine className="text-5xl text-emerald-300 dark:text-slate-600" />
        </div>
      )}
      <div className="p-5 flex flex-col gap-2 flex-1">
        {post.category && (
          <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">{post.category}</span>
        )}
        <h2 className="font-semibold text-slate-900 dark:text-white line-clamp-2 group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">{post.title}</h2>
        {post.excerpt && (
          <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-3">{post.excerpt}</p>
        )}
        <div className="mt-auto flex items-center gap-3 text-xs text-slate-400 dark:text-slate-500 pt-2">
          {date && <span className="flex items-center gap-1"><RiCalendarLine />{date}</span>}
          {post.read_time_mins && <span className="flex items-center gap-1"><RiTimeLine />{post.read_time_mins} min read</span>}
        </div>
        {post.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {post.tags.slice(0, 3).map((t) => (
              <span key={t} className="inline-flex items-center gap-0.5 text-[11px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                <RiPriceTag3Line />{t}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}

export default function BlogIndex() {
  const router = useRouter();
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [category, setCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const fetchPosts = useCallback(async (pg = 1, cat = category, q = search) => {
    setLoading(true);
    try {
      const params = { page: pg, limit: 9 };
      if (cat && cat !== 'All') params.category = cat;
      const { data } = await blogAPI.listPosts(params);
      let results = data.data || [];
      if (q) {
        const lq = q.toLowerCase();
        results = results.filter((p) => p.title.toLowerCase().includes(lq) || p.excerpt?.toLowerCase().includes(lq));
      }
      setPosts(results);
      setTotalPages(data.pagination?.pages || 1);
    } catch {
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, [category, search]);

  useEffect(() => { fetchPosts(page, category, search); }, [page, category, search]);

  function handleCategoryChange(cat) {
    setCategory(cat);
    setPage(1);
  }

  function handleSearch(e) {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  }

  return (
    <>
      <Head>
        <title>Blog - SolNuv | Solar Engineering Insights</title>
        <meta name="description" content="Insights, guides and news on solar energy, battery storage, and engineering for Africa." />
      </Head>

      {/* Hero */}
      <section className="relative bg-gradient-to-br from-forest-900 via-emerald-900 to-teal-900 text-white py-16 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <span className="inline-block px-3 py-1 text-xs font-semibold uppercase tracking-widest bg-emerald-500/20 text-emerald-300 rounded-full mb-4">SolNuv Blog</span>
          <h1 className="text-4xl md:text-5xl font-display font-bold mb-4">Solar Engineering Insights</h1>
          <p className="text-lg text-emerald-100 max-w-2xl mx-auto">Expert articles, industry news, and practical guides for solar professionals across Africa.</p>
          {/* Search */}
          <form onSubmit={handleSearch} className="mt-8 flex max-w-lg mx-auto gap-2">
            <div className="relative flex-1">
              <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search articles..."
                className="w-full pl-9 pr-4 py-2.5 rounded-lg bg-white/10 backdrop-blur border border-white/20 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
            </div>
            <button type="submit" className="px-5 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 font-semibold transition-colors">Search</button>
          </form>
        </div>
      </section>

      {/* Top banner ad */}
      <div className="max-w-6xl mx-auto px-4 pt-4">
        <BlogAdInFeed placement="blog-top" />
      </div>

      {/* Main layout */}
      <div className="max-w-6xl mx-auto px-4 py-10">
        {/* Category filter */}
        <div className="flex flex-wrap gap-2 mb-8 overflow-x-auto pb-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => handleCategoryChange(cat)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors whitespace-nowrap ${
                category === cat
                  ? 'bg-forest-900 text-white border-forest-900'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-forest-900 hover:text-forest-900'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Posts grid */}
          <main className="flex-1 min-w-0">
            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 h-72 animate-pulse" />
                ))}
              </div>
            ) : posts.length === 0 ? (
              <div className="text-center py-20 text-slate-400">
                <RiArticleLine className="text-5xl mx-auto mb-3" />
                <p>No articles found.</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                  {posts.map((post, idx) => (
                    <>
                      <PostCard key={post.id} post={post} />
                      {/* In-feed ad after every 6th post */}
                      {(idx + 1) % 6 === 0 && (
                        <div key={`ad-${idx}`} className="sm:col-span-2 xl:col-span-3">
                          <BlogAdInFeed placement="in-feed" />
                        </div>
                      )}
                    </>
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="mt-10 flex items-center justify-center gap-2">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    >
                      Previous
                    </button>
                    <span className="text-sm text-slate-500">Page {page} of {totalPages}</span>
                    <button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    >
                      Next
                    </button>
                  </div>
                )}
              </>
            )}
          </main>

          {/* Sidebar */}
          <aside className="w-full lg:w-72 space-y-6 flex-shrink-0">
            <BlogAdBanner placement="sidebar" />

            {/* About box */}
            <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
              <h3 className="font-semibold text-slate-800 dark:text-white mb-2">About SolNuv Blog</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">Expert resources for solar engineers, installers, and energy professionals across Africa.</p>
              <Link href="/contact" className="mt-3 inline-flex items-center gap-1 text-sm text-emerald-700 dark:text-emerald-400 font-medium hover:underline">
                Get in touch <RiArrowRightLine />
              </Link>
            </div>

            <BlogAdBanner placement="footer" />
          </aside>
        </div>

        {/* Bottom ad */}
        <div className="mt-10">
          <BlogAdInFeed placement="blog-bottom" />
        </div>
      </div>
    </>
  );
}

BlogIndex.getLayout = getPublicLayout;
