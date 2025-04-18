import type { Metadata } from "next";
import { Inter } from 'next/font/google'
import "./globals.css";
import AuthProvider from '@/components/providers/AuthProvider'
import { ZoomPrevention } from '@/components/ZoomPrevention'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
})

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
    <html lang="en" className={inter.variable}>
      <head>
        <link rel="icon" href="/icons/favicon.ico" sizes="any" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <link rel="apple-touch-icon" href="/icons/icon-512x512.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta 
          name="viewport" 
          content="width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content" 
        />
        <meta name="HandheldFriendly" content="true" />
        <script dangerouslySetInnerHTML={{
          __html: `
            document.addEventListener('touchstart', function() {}, {passive: true});
            document.addEventListener('touchmove', function() {}, {passive: true});
            document.addEventListener('wheel', function() {}, {passive: true});
          `
        }} />
      </head>
      <body className={`${inter.variable} antialiased scroll-container`}>
        <ZoomPrevention />
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
