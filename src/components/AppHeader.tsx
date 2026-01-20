"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Menu, LucideIcon } from "lucide-react";
import { signOut } from "next-auth/react";

interface NavItem {
  href: string;
  label: string;
}

interface AppHeaderProps {
  title: string;
  icon: LucideIcon;
  subtitle?: string;
  children?: React.ReactNode;
  showSignOut?: boolean;
  navItems?: NavItem[];
}

const DEFAULT_NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard" },
  { href: "/form", label: "Ventas" },
  { href: "/clientes", label: "Clientes" },
  { href: "/recorridos", label: "Recorridos" },
  { href: "/inventario", label: "Inventario" },
  { href: "/admin", label: "Admin" },
  { href: "/navegar", label: "Navegar" },
  { href: "/buzon", label: "Buzon" },
  { href: "/inspector-periodos", label: "Inspector Periodos" },
];

export default function AppHeader({
  title,
  icon: Icon,
  subtitle,
  children,
  showSignOut = true,
  navItems = DEFAULT_NAV_ITEMS,
}: AppHeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <>
      <style jsx>{`
        @keyframes headerScaleIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        .header-menu-animate {
          animation: headerScaleIn 0.2s ease-out forwards;
        }
      `}</style>

      <header className="sticky top-0 z-40 backdrop-blur-xl bg-white/80 border-b border-slate-200/50">
        <div className="px-4 py-3 flex justify-between items-center max-w-2xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Icon className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-slate-900 tracking-tight">{title}</h1>
              {subtitle && <p className="text-xs text-blue-600 font-medium">{subtitle}</p>}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {children}

            <div className="relative">
              <button
                type="button"
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
              >
                <Menu className="h-5 w-5 text-slate-600" />
              </button>

              {isMenuOpen && (
                <>
                  <button
                    type="button"
                    className="fixed inset-0 z-40 bg-transparent border-0 p-0 cursor-default"
                    aria-label="Cerrar menu"
                    onClick={() => setIsMenuOpen(false)}
                  />
                  <div className="absolute right-0 mt-2 w-52 rounded-xl bg-white shadow-lg shadow-slate-200/50 border border-slate-200/50 overflow-hidden header-menu-animate origin-top-right z-50">
                    <div className="py-2">
                      {navItems.map(item => (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setIsMenuOpen(false)}
                          className="block px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                          {item.label}
                        </Link>
                      ))}
                      {showSignOut && (
                        <>
                          <div className="border-t border-slate-100 my-1" />
                          <button
                            type="button"
                            onClick={() => signOut()}
                            className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                          >
                            Cerrar sesión
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>
    </>
  );
}
