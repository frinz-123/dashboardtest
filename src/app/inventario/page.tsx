'use client'

import { PanelDeInventarioComponent } from '@/components/panel-de-inventario'
import { useSession } from "next-auth/react"
import { redirect } from "next/navigation"

const AUTHORIZED_EMAILS = [
  'cesar.reyes.ochoa@gmail.com',
  'franzcharbell@gmail.com',
  'inventarioelrey@gmail.com',
  'ventasmochisproductoselrey@gmail.com',
  'alopezelrey@gmail.com'
]

export default function InventarioPage() {
  const { data: session, status } = useSession()

  // Protect the route - only allow access if logged in and authorized
  if (status === "unauthenticated") {
    redirect("/api/auth/signin")
  }

  // Check if user is authorized
  if (session?.user?.email && !AUTHORIZED_EMAILS.includes(session.user.email)) {
    redirect("/") // Redirect unauthorized users to home page
  }

  // Show loading state
  if (status === "loading") {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return <PanelDeInventarioComponent />
} 