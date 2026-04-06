import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        {/* Polyfill performance.clearMarks and friends for browsers that expose
            performance but omit the User Timing Level 2 methods (older iOS Safari,
            some WebViews). Must run before any module code (framer-motion, Turbopack
            runtime) that calls these methods at init time. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  if (typeof performance !== 'undefined') {
                    if (typeof performance.mark !== 'function')         performance.mark = function(){};
                    if (typeof performance.measure !== 'function')      performance.measure = function(){};
                    if (typeof performance.clearMarks !== 'function')   performance.clearMarks = function(){};
                    if (typeof performance.clearMeasures !== 'function')performance.clearMeasures = function(){};
                    if (typeof performance.getEntriesByName !== 'function') performance.getEntriesByName = function(){ return []; };
                    if (typeof performance.getEntriesByType !== 'function') performance.getEntriesByType = function(){ return []; };
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
        {/* Prevent theme flash: Read localStorage and set data-theme BEFORE page renders */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const saved = localStorage.getItem('solnuv_theme');
                  const theme = (saved === 'light' || saved === 'dark') ? saved : 'light';
                  document.documentElement.setAttribute('data-theme', theme);
                  document.documentElement.style.colorScheme = theme;
                } catch (e) {}
              })();
            `,
          }}
        />
        {/* Preconnect to Google Fonts to cut DNS + TLS time off the critical path */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Load fonts via <link> instead of CSS @import — avoids render-blocking two-hop chain */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,400;0,600;0,700;0,900;1,400&family=DM+Sans:wght@300;400;500;600;700&display=swap"
        />
        {/* Warm up the TCP+TLS connection to the backend API before any fetch() fires */}
        <link rel="dns-prefetch" href="//solnuv-backend.onrender.com" />
        <link rel="preconnect" href="https://solnuv-backend.onrender.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="//api.solnuv.com" />
        <link rel="preconnect" href="https://api.solnuv.com" crossOrigin="anonymous" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="shortcut icon" href="/favicon.svg" />
        <meta name="theme-color" content="#F59E0B" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
