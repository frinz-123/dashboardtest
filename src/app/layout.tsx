import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import AuthProvider from '@/components/providers/AuthProvider'
import { ZoomPrevention } from '@/components/ZoomPrevention'

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Dashboard El rey",
  description: "Sales dashboard for El rey",
  manifest: "/manifest.json",
  themeColor: "#3b82f6",
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
        <link rel="icon" href="/icons/favicon.ico" sizes="any" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <link rel="apple-touch-icon" href="/icons/icon-512x512.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta 
          name="viewport" 
          content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0, viewport-fit=cover, interactive-widget=resizes-content" 
        />
        <meta name="HandheldFriendly" content="true" />
        <script dangerouslySetInnerHTML={{
          __html: `
            document.addEventListener('gesturestart', function(e) {
              e.preventDefault();
            });
            document.addEventListener('gesturechange', function(e) {
              e.preventDefault();
            });
            document.addEventListener('gestureend', function(e) {
              e.preventDefault();
            });
            document.addEventListener('touchmove', function(e) {
              if (e.scale !== 1) {
                e.preventDefault();
              }
            }, { passive: false });
          `
        }} />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased touch-none`}>
        <ZoomPrevention />
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
