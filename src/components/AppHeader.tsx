"use client";

import type { LucideIcon } from "lucide-react";
import { Menu } from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import type React from "react";
import { useCallback, useMemo, useState } from "react";
import { useBuzonNotifications } from "@/hooks/useBuzonNotifications";
import { isMasterAccount } from "@/utils/auth";

interface NavItem {
  href: string;
  label: string;
}

interface AppHeaderProps {
  title: string;
  icon?: LucideIcon;
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
  { href: "/inventario-bodega", label: "Inventario Bodega" },
  { href: "/inventario-carro", label: "Inventario Carro" },
  { href: "/admin", label: "Admin" },
  { href: "/navegar", label: "Navegar" },
  { href: "/transacciones", label: "Transacciones" },
  { href: "/buzon", label: "Buzon" },
  { href: "/inspector-periodos", label: "Inspector Periodos" },
];

// iOS-style ease for container entrance; standard cubic eases for items
const EASE_IOS = [0.32, 0.72, 0, 1] as const;
const EASE_OUT = [0, 0, 0.58, 1] as const;
const EASE_IN = [0.42, 0, 1, 1] as const;

const menuVariants = {
  hidden: {
    opacity: 0,
    scale: 0.95,
  },
  show: {
    opacity: 1,
    scale: 1,
    transition: {
      duration: 0.15,
      ease: EASE_IOS,
      staggerChildren: 0.02,
      delayChildren: 0.03,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: { duration: 0.1, ease: EASE_IN },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 4 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.12, ease: EASE_OUT },
  },
};

export default function AppHeader({
  title,
  subtitle,
  children,
  showSignOut = true,
  navItems = DEFAULT_NAV_ITEMS,
}: AppHeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const router = useRouter();
  const { data: session } = useSession();
  const { unseenCount } = useBuzonNotifications();
  const isMaster = useMemo(
    () => isMasterAccount(session?.user?.email),
    [session?.user?.email],
  );
  const visibleNavItems = useMemo(
    () =>
      navItems.filter(
        (item) => item.href !== "/transacciones" || Boolean(isMaster),
      ),
    [isMaster, navItems],
  );
  const buzonBadge = useMemo(() => {
    if (unseenCount <= 0) return "";
    return unseenCount > 99 ? "99+" : String(unseenCount);
  }, [unseenCount]);
  const showBuzonBadge = unseenCount > 0;
  const prefetchFormRoute = useCallback(() => {
    router.prefetch("/form");
  }, [router]);
  const handleMenuToggle = useCallback(() => {
    setIsMenuOpen((previous) => {
      if (!previous) {
        prefetchFormRoute();
      }
      return !previous;
    });
  }, [prefetchFormRoute]);

  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-white/80 border-b border-slate-200/50">
      <div className="px-4 py-3 flex justify-between items-center max-w-2xl mx-auto">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">
            {title}
          </h1>
          {subtitle && (
            <p className="text-xs text-blue-600 font-medium">{subtitle}</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {children}

          <div className="relative">
            <button
              type="button"
              onClick={handleMenuToggle}
              className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
            >
              <Menu className="h-5 w-5 text-slate-600" />
            </button>

            {isMenuOpen && (
              <button
                type="button"
                className="fixed inset-0 z-40 bg-transparent border-0 p-0 cursor-default"
                aria-label="Cerrar menu"
                onClick={() => setIsMenuOpen(false)}
              />
            )}

            <AnimatePresence>
              {isMenuOpen && (
                <m.div
                  key="nav-menu"
                  variants={menuVariants}
                  initial="hidden"
                  animate="show"
                  exit="exit"
                  style={{ transformOrigin: "top right" }}
                  className="absolute right-0 mt-2 w-52 rounded-xl bg-white shadow-lg shadow-slate-200/50 border border-slate-200/50 overflow-hidden z-50"
                >
                  <div className="py-2">
                    {visibleNavItems.map((item) => (
                      <m.div key={item.href} variants={itemVariants}>
                        <Link
                          href={item.href}
                          onClick={() => setIsMenuOpen(false)}
                          onMouseEnter={
                            item.href === "/form"
                              ? prefetchFormRoute
                              : undefined
                          }
                          onTouchStart={
                            item.href === "/form"
                              ? prefetchFormRoute
                              : undefined
                          }
                          onFocus={
                            item.href === "/form"
                              ? prefetchFormRoute
                              : undefined
                          }
                          className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                          <span>{item.label}</span>
                          {item.href === "/buzon" && showBuzonBadge ? (
                            <span className="min-w-[1.25rem] h-5 px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold flex items-center justify-center">
                              {buzonBadge}
                            </span>
                          ) : null}
                        </Link>
                      </m.div>
                    ))}
                    {showSignOut && (
                      <>
                        <m.div
                          variants={itemVariants}
                          className="border-t border-slate-100 my-1"
                        />
                        <m.div variants={itemVariants}>
                          <button
                            type="button"
                            onClick={() => signOut()}
                            className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
                          >
                            Cerrar sesión
                          </button>
                        </m.div>
                      </>
                    )}
                  </div>
                </m.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </header>
  );
}
