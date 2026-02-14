"use client";

import dynamic from "next/dynamic";
import { redirect } from "next/navigation";
import { useSession } from "next-auth/react";

const PanelDeInventarioComponent = dynamic(
  () =>
    import("@/components/panel-de-inventario").then((m) => ({
      default: m.PanelDeInventarioComponent,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    ),
  },
);

const AUTHORIZED_EMAILS = [
  "cesar.reyes.ochoa@gmail.com",
  "franzcharbell@gmail.com",
  "inventarioelrey@gmail.com",
  "ventasmochisproductoselrey@gmail.com",
  "alopezelrey@gmail.com",
  "promotoriaelrey@gmail.com",
];

export default function InventarioPage() {
  const { data: session, status } = useSession();

  // Protect the route - only allow access if logged in and authorized
  if (status === "unauthenticated") {
    redirect("/auth/signin");
  }

  // Check if user is authorized
  if (session?.user?.email && !AUTHORIZED_EMAILS.includes(session.user.email)) {
    redirect("/"); // Redirect unauthorized users to home page
  }

  // Show loading state
  if (status === "loading") {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return <PanelDeInventarioComponent />;
}
