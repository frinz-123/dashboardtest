import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import ClientDataPrefetcher from "@/components/ClientDataPrefetcher";
import DevAgentation from "@/components/DevAgentation";
import AuthProvider from "@/components/providers/AuthProvider";
import { MotionProvider } from "@/components/providers/MotionProvider";
import QueryProvider from "@/components/providers/QueryProvider";
import { ZoomPrevention } from "@/components/ZoomPrevention";

const inter = Inter({ subsets: ["latin"] });
const SHOULD_REGISTER_SW =
  process.env.NODE_ENV === "production" ||
  process.env.NEXT_PUBLIC_ENABLE_SW_DEV === "true";

export const metadata: Metadata = {
  title: "Dashboard El rey",
  description: "Sales dashboard for El rey",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Dashboard El rey",
  },
};

export const viewport: Viewport = {
  themeColor: "#FFFFFF",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.className}>
      <head>
        <link rel="icon" type="image/svg+xml" href="/icons/favicon.svg" />
        <link rel="icon" href="/icons/favicon.ico" sizes="any" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <link
          rel="apple-touch-icon"
          sizes="192x192"
          href="/icons/icon-192x192.png"
        />
        <link
          rel="apple-touch-icon"
          sizes="512x512"
          href="/icons/icon-512x512.png"
        />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content"
        />
        <meta name="HandheldFriendly" content="true" />
      </head>
      <body className="antialiased scroll-container">
        <Script id="sw-init" strategy="afterInteractive">{`
          var shouldRegisterSW = ${JSON.stringify(SHOULD_REGISTER_SW)};

          if ('serviceWorker' in navigator) {
            if (!shouldRegisterSW) {
              navigator.serviceWorker.getRegistrations().then(function(registrations) {
                return Promise.all(
                  registrations.map(function(registration) {
                    return registration.unregister();
                  })
                );
              }).catch(function(err) {
                console.log('[SW] Dev unregister failed:', err);
              });

              if ('caches' in window) {
                caches.keys().then(function(cacheNames) {
                  return Promise.all(
                    cacheNames
                      .filter(function(name) { return name.indexOf('elrey-') === 0; })
                      .map(function(name) { return caches.delete(name); })
                  );
                }).catch(function(err) {
                  console.log('[SW] Dev cache cleanup failed:', err);
                });
              }
            } else {
              var registerServiceWorker = function() {
                navigator.serviceWorker.register('/service-worker.js', {
                  scope: '/',
                  updateViaCache: 'none'
                }).then(function(reg) {
                  console.log('[SW] Registered:', reg.scope);
                }).catch(function(err) {
                  console.log('[SW] Registration failed:', err);
                });
              };

              if (document.readyState === 'complete') {
                registerServiceWorker();
              } else {
                window.addEventListener('load', registerServiceWorker, { once: true });
              }
            }
          }
        `}</Script>
        <ZoomPrevention />
        <ClientDataPrefetcher />
        <QueryProvider>
          <AuthProvider>
            <MotionProvider>{children}</MotionProvider>
          </AuthProvider>
        </QueryProvider>
        <DevAgentation />
      </body>
    </html>
  );
}
