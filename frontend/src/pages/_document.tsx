import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="en">
      <Head>
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
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,400;0,600;0,700;0,900;1,400&family=DM+Sans:wght@300;400;500;600;700&display=swap"
        />
        <link rel="dns-prefetch" href="//solnuv-backend.onrender.com" />
        <link rel="preconnect" href="https://solnuv-backend.onrender.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="//api.solnuv.com" />
        <link rel="preconnect" href="https://api.solnuv.com" crossOrigin="anonymous" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="shortcut icon" href="/favicon.svg" />
        <meta name="theme-color" content="#10B981" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="SolNuv" />
        <link rel="apple-touch-icon" href="/icons/icon-192.svg" />
        <link rel="apple-touch-icon" sizes="72x72" href="/icons/icon-72.svg" />
        <link rel="apple-touch-icon" sizes="96x96" href="/icons/icon-96.svg" />
        <link rel="apple-touch-icon" sizes="128x128" href="/icons/icon-128.svg" />
        <link rel="apple-touch-icon" sizes="144x144" href="/icons/icon-144.svg" />
        <link rel="apple-touch-icon" sizes="152x152" href="/icons/icon-152.svg" />
        <link rel="apple-touch-icon" sizes="192x192" href="/icons/icon-192.svg" />
        <link rel="apple-touch-icon" sizes="384x384" href="/icons/icon-384.svg" />
        <link rel="apple-touch-icon" sizes="512x512" href="/icons/icon-512.svg" />
        <link
          rel="apple-touch-startup-image"
          href="/icons/icon-512.svg"
          media="(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3)"
        />
        <link
          rel="apple-touch-startup-image"
          href="/icons/icon-512.svg"
          media="(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3)"
        />
        <link
          rel="apple-touch-startup-image"
          href="/icons/icon-512.svg"
          media="(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)"
        />
        <link
          rel="apple-touch-startup-image"
          href="/icons/icon-512.svg"
          media="(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3)"
        />
        <meta name="msapplication-TileColor" content="#10B981" />
        <meta name="msapplication-TileImage" content="/icons/icon-144.svg" />
        <meta name="msapplication-config" content="/browserconfig.xml" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
