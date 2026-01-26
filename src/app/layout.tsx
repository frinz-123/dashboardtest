import type { Metadata } from "next";
import "./globals.css";
import AuthProvider from "@/components/providers/AuthProvider";
import { ZoomPrevention } from "@/components/ZoomPrevention";
import ClientDataPrefetcher from "@/components/ClientDataPrefetcher";
import { Agentation } from "agentation";

export const metadata: Metadata = {
  title: "Dashboard El rey",
  description: "Sales dashboard for El rey",
  manifest: "/manifest.json",
  themeColor: "#14b8a6",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Dashboard El rey",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://rsms.me/" />
        <link rel="stylesheet" href="https://rsms.me/inter/inter.css" />
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
        <script
          dangerouslySetInnerHTML={{
            __html: `
            document.addEventListener('touchstart', function() {}, {passive: true});
            document.addEventListener('touchmove', function() {}, {passive: true});
            document.addEventListener('wheel', function() {}, {passive: true});
          `,
          }}
        />
      </head>
      <body className="antialiased scroll-container">
        <ZoomPrevention />
        <ClientDataPrefetcher />
        <AuthProvider>{children}</AuthProvider>
        {process.env.NODE_ENV === "development" && <Agentation />}
      </body>
    </html>
  );
}
