import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import ClientDataPrefetcher from "@/components/ClientDataPrefetcher";
import AuthProvider from "@/components/providers/AuthProvider";
import { MotionProvider } from "@/components/providers/MotionProvider";
import { ZoomPrevention } from "@/components/ZoomPrevention";
import DevAgentation from "@/components/DevAgentation";

const inter = Inter({ subsets: ["latin"] });

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
          if ('serviceWorker' in navigator) {
            var registerServiceWorker = function() {
              navigator.serviceWorker.register('/service-worker.js').then(function(reg) {
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
        `}</Script>
        <ZoomPrevention />
        <ClientDataPrefetcher />
        <AuthProvider>
          <MotionProvider>{children}</MotionProvider>
        </AuthProvider>
        <DevAgentation />
      </body>
    </html>
  );
}
