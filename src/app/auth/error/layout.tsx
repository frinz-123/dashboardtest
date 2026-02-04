import type React from "react";

export const metadata = {
  title: "El Rey Chiltepin - Autenticación",
  description: "Portal de autenticación de El Rey Chiltepin",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function ErrorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
