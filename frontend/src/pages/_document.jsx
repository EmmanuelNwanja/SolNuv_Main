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
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
