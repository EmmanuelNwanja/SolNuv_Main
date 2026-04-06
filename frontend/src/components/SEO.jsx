/**
 * SEO.jsx  — Shared document-head meta tag component for SolNuv
 *
 * Usage:
 *   import SEO from '../components/SEO';
 *   <SEO title="Calculator" description="..." path="/calculator" />
 *
 * All props are optional — sensible defaults are baked in.
 */
import Head from 'next/head';

const SITE_DEFAULTS = {
  siteName: 'SolNuv',
  titleTemplate: '%s | SolNuv',
  defaultTitle: "SolNuv — Africa's Solar Engineering & Lifecycle Intelligence Platform",
  description:
    "Design, model, monitor and report on solar+BESS projects across Africa. Professional tools for solar engineers, companies and asset managers.",
  keywords:
    'solar engineering Africa, BESS design, solar PV software, Nigeria solar, renewable energy, solar calculator, solar project management',
  ogImage: 'https://solnuv.com/og-image.png',
  twitterHandle: '@solnuv',
  canonicalBase: 'https://solnuv.com',
};

/**
 * @param {object} props
 * @param {string}  [props.title]        Page-specific title (appended with " | SolNuv")
 * @param {string}  [props.description]  Meta description (≤160 chars recommended)
 * @param {string}  [props.keywords]     Comma-separated keywords
 * @param {string}  [props.path]         Canonical path, e.g. "/calculator" (no trailing slash)
 * @param {string}  [props.image]        Absolute OG image URL
 * @param {string}  [props.type]         OG type — "website" (default) or "article"
 * @param {boolean} [props.noindex]      Set true on auth/private pages
 */
export default function SEO({
  title,
  description,
  keywords,
  path = '',
  image,
  type = 'website',
  noindex = false,
}) {
  const fullTitle = title
    ? SITE_DEFAULTS.titleTemplate.replace('%s', title)
    : SITE_DEFAULTS.defaultTitle;

  const metaDesc   = description || SITE_DEFAULTS.description;
  const metaKw     = keywords    || SITE_DEFAULTS.keywords;
  const canonical  = `${SITE_DEFAULTS.canonicalBase}${path}`;
  const ogImg      = image       || SITE_DEFAULTS.ogImage;

  return (
    <Head>
      <title>{fullTitle}</title>

      <meta name="description"  content={metaDesc} />
      <meta name="keywords"     content={metaKw} />
      {noindex && <meta name="robots" content="noindex,nofollow" />}
      <link rel="canonical"     href={canonical} />

      {/* Open Graph */}
      <meta property="og:site_name"   content={SITE_DEFAULTS.siteName} />
      <meta property="og:title"       content={fullTitle} />
      <meta property="og:description" content={metaDesc} />
      <meta property="og:type"        content={type} />
      <meta property="og:url"         content={canonical} />
      <meta property="og:image"       content={ogImg} />
      <meta property="og:image:alt"   content={`${SITE_DEFAULTS.siteName} — ${title || 'Solar Engineering'}`} />
      <meta property="og:locale"      content="en_NG" />

      {/* Twitter Card */}
      <meta name="twitter:card"        content="summary_large_image" />
      <meta name="twitter:site"        content={SITE_DEFAULTS.twitterHandle} />
      <meta name="twitter:creator"     content={SITE_DEFAULTS.twitterHandle} />
      <meta name="twitter:title"       content={fullTitle} />
      <meta name="twitter:description" content={metaDesc} />
      <meta name="twitter:image"       content={ogImg} />
    </Head>
  );
}
