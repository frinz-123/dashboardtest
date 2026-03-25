"use client";

import { Calendar, User, X } from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import { useEffect, useRef } from "react";

const EMAIL_TO_SELLER: Record<string, string> = {
  "ventas1productoselrey@gmail.com": "Christian",
  "ventas2productoselrey@gmail.com": "Roel",
  "ventas3productoselrey@gmail.com": "Lidia",
  "ventasmztproductoselrey.com@gmail.com": "Mazatlan",
  "chiltepinelreyhmo@gmail.com": "Hermosillo",
  "ventasmochisproductoselrey@gmail.com": "Mochis",
  "franzcharbell@gmail.com": "Franz",
  "cesar.reyes.ochoa@gmail.com": "Cesar",
  "arturo.elreychiltepin@gmail.com": "Arturo Mty",
  "alopezelrey@gmail.com": "Arlyn",
  "promotoriaelrey@gmail.com": "Brenda",
};

type Sale = {
  clientName: string;
  fechaSinHora: string;
  venta: number;
  products: Record<string, number>;
  email: string;
};

type SaleDetailsPopupProps = {
  sale: Sale;
  onClose: () => void;
};

const EASE_OUT_CUBIC = [0.215, 0.61, 0.355, 1] as const;

export default function SaleDetailsPopup({
  sale,
  onClose,
}: SaleDetailsPopupProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const sellerName = EMAIL_TO_SELLER[sale.email] ?? "Desconocido";
  const productCount = Object.keys(sale.products).length;

  // Close on Escape
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  // Focus close button on open
  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <m.div
        className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2, ease: EASE_OUT_CUBIC }}
        style={{
          backgroundColor: "rgba(0,0,0,0.55)",
          backdropFilter: "blur(6px)",
        }}
        onClick={onClose}
        aria-hidden="true"
      >
        {/* Panel */}
        <m.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="sale-details-title"
          className="relative w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl flex flex-col overflow-hidden bg-white"
          style={{
            maxHeight: "88dvh",
            boxShadow:
              "0 0 0 1px rgba(0,0,0,0.07), 0 32px 64px -16px rgba(0,0,0,0.35), 0 8px 24px -8px rgba(0,0,0,0.15)",
          }}
          initial={{ opacity: 0, y: 20, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.97 }}
          transition={{ duration: 0.22, ease: EASE_OUT_CUBIC }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* ── Dark header — client is the hero ── */}
          <div
            className="relative px-5 pt-4 pb-5 shrink-0"
            style={{
              background: "linear-gradient(145deg, #0f172a 0%, #1e293b 100%)",
            }}
          >
            {/* Mobile drag handle */}
            <div className="sm:hidden absolute top-2.5 left-1/2 -translate-x-1/2 w-8 h-1 rounded-full bg-white/15 pointer-events-none" />

            {/* Close button */}
            <div className="flex justify-end -mr-1 mb-3">
              <button
                ref={closeRef}
                type="button"
                onClick={onClose}
                aria-label="Cerrar detalles"
                className="flex items-center justify-center rounded-lg text-white/40 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/30 [@media(hover:hover)]:hover:text-white [@media(hover:hover)]:hover:bg-white/10"
                style={{
                  minWidth: 44,
                  minHeight: 44,
                  touchAction: "manipulation",
                }}
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>

            {/* Client name — the hero */}
            <h2
              id="sale-details-title"
              className="text-white font-semibold text-[17px] leading-snug mb-1"
              style={{ textWrap: "balance" } as React.CSSProperties}
            >
              {sale.clientName}
            </h2>

            {/* Email — secondary, de-emphasized */}
            <p className="text-slate-400 text-xs mb-4 truncate">{sale.email}</p>

            {/* Meta pills */}
            <div className="flex items-center gap-2 flex-wrap">
              <MetaPill icon={<User size={10} aria-hidden="true" />}>
                {sellerName}
              </MetaPill>
              <MetaPill icon={<Calendar size={10} aria-hidden="true" />}>
                {sale.fechaSinHora}
              </MetaPill>
            </div>
          </div>

          {/* ── Total — its own callout strip ── */}
          <div
            className="px-5 py-3.5 flex items-center justify-between shrink-0"
            style={{
              background: "#f8fafc",
              borderBottom: "1px solid #f1f5f9",
            }}
          >
            <span className="text-sm text-slate-500 font-medium">
              Total Venta
            </span>
            <span
              className="text-[22px] font-bold text-slate-900 tracking-tight"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              ${sale.venta.toFixed(2)}
            </span>
          </div>

          {/* ── Products list ── */}
          {productCount > 0 && (
            <div className="overflow-y-auto">
              {/* Section label */}
              <div className="px-5 pt-4 pb-2 flex items-center justify-between">
                <h3 className="text-[10.5px] font-semibold text-slate-400 uppercase tracking-[0.08em]">
                  Productos
                </h3>
                <span className="text-[10.5px] text-slate-400">
                  {productCount} {productCount === 1 ? "artículo" : "artículos"}
                </span>
              </div>

              {/* Product rows */}
              <ul className="px-3 pb-4">
                {Object.entries(sale.products).map(([product, quantity]) => (
                  <li
                    key={product}
                    className="flex items-center justify-between gap-3 px-2 py-2.5 rounded-lg transition-colors duration-100 [@media(hover:hover)]:hover:bg-slate-50"
                  >
                    <span className="text-sm text-slate-700 leading-snug">
                      {product}
                    </span>
                    <QuantityBadge value={quantity} />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </m.div>
      </m.div>
    </AnimatePresence>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MetaPill({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1"
      style={{ background: "rgba(255,255,255,0.10)" }}
    >
      <span className="text-slate-400">{icon}</span>
      <span className="text-xs text-slate-300 font-medium leading-none">
        {children}
      </span>
    </div>
  );
}

function QuantityBadge({ value }: { value: number }) {
  return (
    <span
      className="inline-flex items-center justify-center min-w-[2rem] h-6 rounded-md bg-slate-100 text-slate-600 text-xs font-semibold px-2 shrink-0"
      style={{ fontVariantNumeric: "tabular-nums" }}
    >
      {value}
    </span>
  );
}
