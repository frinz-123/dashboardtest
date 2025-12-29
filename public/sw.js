if (!self.define) {
  let e,
    s = {};
  const i = (i, n) => (
    (i = new URL(i + ".js", n).href),
    s[i] ||
      new Promise((s) => {
        if ("document" in self) {
          const e = document.createElement("script");
          (e.src = i), (e.onload = s), document.head.appendChild(e);
        } else (e = i), importScripts(i), s();
      }).then(() => {
        let e = s[i];
        if (!e) throw new Error(`Module ${i} didn’t register its module`);
        return e;
      })
  );
  self.define = (n, c) => {
    const t =
      e ||
      ("document" in self ? document.currentScript.src : "") ||
      location.href;
    if (s[t]) return;
    let a = {};
    const r = (e) => i(e, t),
      u = { module: { uri: t }, exports: a, require: r };
    s[t] = Promise.all(n.map((e) => u[e] || r(e))).then((e) => (c(...e), a));
  };
}
define(["./workbox-4754cb34"], function (e) {
  "use strict";
  importScripts(),
    self.skipWaiting(),
    e.clientsClaim(),
    e.precacheAndRoute(
      [
        {
          url: "/_next/app-build-manifest.json",
          revision: "df6bd14e2d654fae2cfea41c55e82c74",
        },
        {
          url: "/_next/static/DRxVW5Q6upxiWgTr09G8_/_buildManifest.js",
          revision: "172e769da91baa11de9b258fb2d92f86",
        },
        {
          url: "/_next/static/DRxVW5Q6upxiWgTr09G8_/_ssgManifest.js",
          revision: "b6652df95db52feb4daf4eca35380933",
        },
        {
          url: "/_next/static/chunks/0e5ce63c-522204b0d47404fe.js",
          revision: "DRxVW5Q6upxiWgTr09G8_",
        },
        {
          url: "/_next/static/chunks/117-37bd5f04113965d0.js",
          revision: "DRxVW5Q6upxiWgTr09G8_",
        },
        {
          url: "/_next/static/chunks/119-f70359db9def37d5.js",
          revision: "DRxVW5Q6upxiWgTr09G8_",
        },
        {
          url: "/_next/static/chunks/145-be6cc9ab55b25289.js",
          revision: "DRxVW5Q6upxiWgTr09G8_",
        },
        {
          url: "/_next/static/chunks/147-938dc50b09d3992a.js",
          revision: "DRxVW5Q6upxiWgTr09G8_",
        },
        {
          url: "/_next/static/chunks/157-e66efcafcfe259c8.js",
          revision: "DRxVW5Q6upxiWgTr09G8_",
        },
        {
          url: "/_next/static/chunks/302-2c99ee9850d1b8e6.js",
          revision: "DRxVW5Q6upxiWgTr09G8_",
        },
        {
          url: "/_next/static/chunks/346-5b021b821ce25ce8.js",
          revision: "DRxVW5Q6upxiWgTr09G8_",
        },
        {
          url: "/_next/static/chunks/559-db5e400168d0d866.js",
          revision: "DRxVW5Q6upxiWgTr09G8_",
        },
        {
          url: "/_next/static/chunks/57-c98d55c9cc12c925.js",
          revision: "DRxVW5Q6upxiWgTr09G8_",
        },
        {
          url: "/_next/static/chunks/605-fa9420cf138e2f37.js",
          revision: "DRxVW5Q6upxiWgTr09G8_",
        },
        {
          url: "/_next/static/chunks/67-543f28f9cf8a03c4.js",
          revision: "DRxVW5Q6upxiWgTr09G8_",
        },
        {
          url: "/_next/static/chunks/747-55f95068d817555f.js",
          revision: "DRxVW5Q6upxiWgTr09G8_",
        },
        {
          url: "/_next/static/chunks/755-760b3f436724a658.js",
          revision: "DRxVW5Q6upxiWgTr09G8_",
        },
        {
          url: "/_next/static/chunks/766-69a26d602996c639.js",
          revision: "DRxVW5Q6upxiWgTr09G8_",
        },
        {
          url: "/_next/static/chunks/793.0813fac469d35978.js",
          revision: "0813fac469d35978",
        },
        {
          url: "/_next/static/chunks/87-2f559fedcf092511.js",
          revision: "DRxVW5Q6upxiWgTr09G8_",
        },
        {
          url: "/_next/static/chunks/876-bb690f37ab7b39ee.js",
          revision: "DRxVW5Q6upxiWgTr09G8_",
        },
        {
          url: "/_next/static/chunks/99-dd395892e31d5b5c.js",
          revision: "DRxVW5Q6upxiWgTr09G8_",
        },
        {
          url: "/_next/static/chunks/app/_not-found/page-d9d81b7d733c73a4.js",
          revision: "DRxVW5Q6upxiWgTr09G8_",
        },
        {
          url: "/_next/static/chunks/app/admin/page-c87f2e1707f21116.js",
          revision: "DRxVW5Q6upxiWgTr09G8_",
        },
        {
          url: "/_next/static/chunks/app/auth/error/layout-b97e423a871c4631.js",
          revision: "DRxVW5Q6upxiWgTr09G8_",
        },
        {
          url: "/_next/static/chunks/app/auth/error/page-432072bf13350440.js",
          revision: "DRxVW5Q6upxiWgTr09G8_",
        },
        {
          url: "/_next/static/chunks/app/auth/signin/page-a3d753a83ef22282.js",
          revision: "DRxVW5Q6upxiWgTr09G8_",
        },
        {
          url: "/_next/static/chunks/app/clientes/page-5a2dade56a544553.js",
          revision: "DRxVW5Q6upxiWgTr09G8_",
        },
        {
          url: "/_next/static/chunks/app/form/page-0b4d9894e1c545ce.js",
          revision: "DRxVW5Q6upxiWgTr09G8_",
        },
        {
          url: "/_next/static/chunks/app/inspector-periodos/page-beee8ff0464a1fac.js",
          revision: "DRxVW5Q6upxiWgTr09G8_",
        },
        {
          url: "/_next/static/chunks/app/inventario/page-60c2c5523f0652b6.js",
          revision: "DRxVW5Q6upxiWgTr09G8_",
        },
        {
          url: "/_next/static/chunks/app/layout-e556b1dc82296bfc.js",
          revision: "DRxVW5Q6upxiWgTr09G8_",
        },
        {
          url: "/_next/static/chunks/app/login/page-3f66dbca83c7bf52.js",
          revision: "DRxVW5Q6upxiWgTr09G8_",
        },
        {
          url: "/_next/static/chunks/app/navegar/page-58a9d7c35ad6494e.js",
          revision: "DRxVW5Q6upxiWgTr09G8_",
        },
        {
          url: "/_next/static/chunks/app/page-b5701484238dea9a.js",
          revision: "DRxVW5Q6upxiWgTr09G8_",
        },
        {
          url: "/_next/static/chunks/app/recorridos/page-f6dff284007b2770.js",
          revision: "DRxVW5Q6upxiWgTr09G8_",
        },
        {
          url: "/_next/static/chunks/app/rutas/page-7bdf9a46cc66ebb7.js",
          revision: "DRxVW5Q6upxiWgTr09G8_",
        },
        {
          url: "/_next/static/chunks/c36f3faa-e0a629e02504eba4.js",
          revision: "DRxVW5Q6upxiWgTr09G8_",
        },
        {
          url: "/_next/static/chunks/fd9d1056-fcd5835c92cdf54d.js",
          revision: "DRxVW5Q6upxiWgTr09G8_",
        },
        {
          url: "/_next/static/chunks/framework-efd1de7268b3b563.js",
          revision: "DRxVW5Q6upxiWgTr09G8_",
        },
        {
          url: "/_next/static/chunks/main-app-17e76e9da58beb23.js",
          revision: "DRxVW5Q6upxiWgTr09G8_",
        },
        {
          url: "/_next/static/chunks/main-f4ccadfbe47e8c01.js",
          revision: "DRxVW5Q6upxiWgTr09G8_",
        },
        {
          url: "/_next/static/chunks/pages/_app-7c7dabbf0973f78c.js",
          revision: "DRxVW5Q6upxiWgTr09G8_",
        },
        {
          url: "/_next/static/chunks/pages/_error-28b803cb2479b966.js",
          revision: "DRxVW5Q6upxiWgTr09G8_",
        },
        {
          url: "/_next/static/chunks/polyfills-42372ed130431b0a.js",
          revision: "846118c33b2c0e922d7b3a7676f81f6f",
        },
        {
          url: "/_next/static/chunks/webpack-edf2b2b958535df3.js",
          revision: "DRxVW5Q6upxiWgTr09G8_",
        },
        {
          url: "/_next/static/css/9230b7ef0b660671.css",
          revision: "9230b7ef0b660671",
        },
        {
          url: "/_next/static/css/a57c13815d99e21c.css",
          revision: "a57c13815d99e21c",
        },
        {
          url: "/_next/static/css/d0320de32467736e.css",
          revision: "d0320de32467736e",
        },
        {
          url: "/_next/static/media/19cfc7226ec3afaa-s.woff2",
          revision: "9dda5cfc9a46f256d0e131bb535e46f8",
        },
        {
          url: "/_next/static/media/21350d82a1f187e9-s.woff2",
          revision: "4e2553027f1d60eff32898367dd4d541",
        },
        {
          url: "/_next/static/media/8e9860b6e62d6359-s.woff2",
          revision: "01ba6c2a184b8cba08b0d57167664d75",
        },
        {
          url: "/_next/static/media/ba9851c3c22cd980-s.woff2",
          revision: "9e494903d6b0ffec1a1e14d34427d44d",
        },
        {
          url: "/_next/static/media/c5fe6dc8356a8c31-s.woff2",
          revision: "027a89e9ab733a145db70f09b8a18b42",
        },
        {
          url: "/_next/static/media/df0a9ae256c0569c-s.woff2",
          revision: "d54db44de5ccb18886ece2fda72bdfe0",
        },
        {
          url: "/_next/static/media/e4af272ccee01ff0-s.p.woff2",
          revision: "65850a373e258f1c897a2b3d75eb74de",
        },
        { url: "/_redirects", revision: "6a02faf7ea2a9584134ffe15779a0e44" },
        { url: "/google.svg", revision: "54ef37b3e38018711db323b7f44c936e" },
        {
          url: "/icons/apple-touch-icon.png",
          revision: "c0b36d7d13a37261e5bb2c8fb3ec74fa",
        },
        {
          url: "/icons/favicon.ico",
          revision: "b73db77f9feece87de4d2f70b8bddfd1",
        },
        {
          url: "/icons/favicon.svg",
          revision: "aad3b4a9df9fc9fc43583e2c83ed63d9",
        },
        {
          url: "/icons/icon-192x192.png",
          revision: "c0b36d7d13a37261e5bb2c8fb3ec74fa",
        },
        {
          url: "/icons/icon-512x512.png",
          revision: "4d0d42d8a224d8144b89c75430ce22ba",
        },
        { url: "/manifest.json", revision: "c3cf0cc5e48f38a5838bdcf178ad29be" },
        {
          url: "/service-worker.js",
          revision: "e43142bcb9d0d648195e1db982006a0b",
        },
      ],
      { ignoreURLParametersMatching: [] },
    ),
    e.cleanupOutdatedCaches(),
    e.registerRoute(
      "/",
      new e.NetworkFirst({
        cacheName: "start-url",
        plugins: [
          {
            cacheWillUpdate: async ({
              request: e,
              response: s,
              event: i,
              state: n,
            }) =>
              s && "opaqueredirect" === s.type
                ? new Response(s.body, {
                    status: 200,
                    statusText: "OK",
                    headers: s.headers,
                  })
                : s,
          },
        ],
      }),
      "GET",
    ),
    e.registerRoute(
      /^https:\/\/fonts\.(?:gstatic)\.com\/.*/i,
      new e.CacheFirst({
        cacheName: "google-fonts-webfonts",
        plugins: [
          new e.ExpirationPlugin({ maxEntries: 4, maxAgeSeconds: 31536e3 }),
        ],
      }),
      "GET",
    ),
    e.registerRoute(
      /^https:\/\/fonts\.(?:googleapis)\.com\/.*/i,
      new e.StaleWhileRevalidate({
        cacheName: "google-fonts-stylesheets",
        plugins: [
          new e.ExpirationPlugin({ maxEntries: 4, maxAgeSeconds: 604800 }),
        ],
      }),
      "GET",
    ),
    e.registerRoute(
      /\.(?:eot|otf|ttc|ttf|woff|woff2|font.css)$/i,
      new e.StaleWhileRevalidate({
        cacheName: "static-font-assets",
        plugins: [
          new e.ExpirationPlugin({ maxEntries: 4, maxAgeSeconds: 604800 }),
        ],
      }),
      "GET",
    ),
    e.registerRoute(
      /\.(?:jpg|jpeg|gif|png|svg|ico|webp)$/i,
      new e.StaleWhileRevalidate({
        cacheName: "static-image-assets",
        plugins: [
          new e.ExpirationPlugin({ maxEntries: 64, maxAgeSeconds: 86400 }),
        ],
      }),
      "GET",
    ),
    e.registerRoute(
      /\/_next\/image\?url=.+$/i,
      new e.StaleWhileRevalidate({
        cacheName: "next-image",
        plugins: [
          new e.ExpirationPlugin({ maxEntries: 64, maxAgeSeconds: 86400 }),
        ],
      }),
      "GET",
    ),
    e.registerRoute(
      /\.(?:mp3|wav|ogg)$/i,
      new e.CacheFirst({
        cacheName: "static-audio-assets",
        plugins: [
          new e.RangeRequestsPlugin(),
          new e.ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 86400 }),
        ],
      }),
      "GET",
    ),
    e.registerRoute(
      /\.(?:mp4)$/i,
      new e.CacheFirst({
        cacheName: "static-video-assets",
        plugins: [
          new e.RangeRequestsPlugin(),
          new e.ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 86400 }),
        ],
      }),
      "GET",
    ),
    e.registerRoute(
      /\.(?:js)$/i,
      new e.StaleWhileRevalidate({
        cacheName: "static-js-assets",
        plugins: [
          new e.ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 86400 }),
        ],
      }),
      "GET",
    ),
    e.registerRoute(
      /\.(?:css|less)$/i,
      new e.StaleWhileRevalidate({
        cacheName: "static-style-assets",
        plugins: [
          new e.ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 86400 }),
        ],
      }),
      "GET",
    ),
    e.registerRoute(
      /\/_next\/data\/.+\/.+\.json$/i,
      new e.StaleWhileRevalidate({
        cacheName: "next-data",
        plugins: [
          new e.ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 86400 }),
        ],
      }),
      "GET",
    ),
    e.registerRoute(
      /\.(?:json|xml|csv)$/i,
      new e.NetworkFirst({
        cacheName: "static-data-assets",
        plugins: [
          new e.ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 86400 }),
        ],
      }),
      "GET",
    ),
    e.registerRoute(
      ({ url: e }) => {
        if (!(self.origin === e.origin)) return !1;
        const s = e.pathname;
        return !s.startsWith("/api/auth/") && !!s.startsWith("/api/");
      },
      new e.NetworkFirst({
        cacheName: "apis",
        networkTimeoutSeconds: 10,
        plugins: [
          new e.ExpirationPlugin({ maxEntries: 16, maxAgeSeconds: 86400 }),
        ],
      }),
      "GET",
    ),
    e.registerRoute(
      ({ url: e }) => {
        if (!(self.origin === e.origin)) return !1;
        return !e.pathname.startsWith("/api/");
      },
      new e.NetworkFirst({
        cacheName: "others",
        networkTimeoutSeconds: 10,
        plugins: [
          new e.ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 86400 }),
        ],
      }),
      "GET",
    ),
    e.registerRoute(
      ({ url: e }) => !(self.origin === e.origin),
      new e.NetworkFirst({
        cacheName: "cross-origin",
        networkTimeoutSeconds: 10,
        plugins: [
          new e.ExpirationPlugin({ maxEntries: 32, maxAgeSeconds: 3600 }),
        ],
      }),
      "GET",
    );
});
