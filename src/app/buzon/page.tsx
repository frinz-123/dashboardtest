"use client";

import { MessageSquare } from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import React, { useEffect, useMemo, useState } from "react";
import AppHeader from "@/components/AppHeader";
import FeedLightbox from "@/components/inspector/FeedLightbox";
import { triggerBuzonRefresh } from "@/hooks/useBuzonNotifications";
import { EMAIL_TO_VENDOR_LABELS, isMasterAccount } from "@/utils/auth";

const googleApiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
const spreadsheetId = process.env.NEXT_PUBLIC_SPREADSHEET_ID;
const sheetName = process.env.NEXT_PUBLIC_SHEET_NAME;

const ITEMS_PER_PAGE = 15;

type Sale = {
  clientName: string;
  venta: number;
  codigo: string;
  fechaSinHora: string;
  email: string;
  submissionTime?: string;
  products: Record<string, number>;
  photoUrls: string[];
};

type FeedReview = {
  saleId: string;
  reviewedAt: string;
  reviewedBy: string;
  note: string;
  seenBy?: string;
};

type BuzonEntry = {
  sale: Sale;
  review: FeedReview;
};

const getSubmissionTimeKey = (submissionTime?: string): string => {
  if (!submissionTime) return "";
  const timePart = submissionTime.includes(" ")
    ? submissionTime.split(" ")[1]
    : submissionTime;
  return timePart?.slice(0, 8) || "";
};

const getLegacySaleId = (sale: Sale): string => {
  return `${sale.email}|${sale.fechaSinHora}|${sale.clientName}`;
};

const hashString = (value: string): string => {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
};

const getPhotoKey = (photoUrls: string[]): string => {
  const firstUrl = photoUrls.find((url) => url.trim()) || "";
  return firstUrl ? hashString(firstUrl) : "";
};

const getSaleIdVariants = (sale: Sale): string[] => {
  const baseId = getLegacySaleId(sale);
  const timeKey = getSubmissionTimeKey(sale.submissionTime);
  const photoKey = getPhotoKey(sale.photoUrls || []);
  const variants = [] as string[];

  if (photoKey) variants.push(`${baseId}|p:${photoKey}`);
  if (timeKey) variants.push(`${baseId}|t:${timeKey}`);
  variants.push(baseId);

  return variants;
};

const getSaleId = (sale: Sale): string => {
  return getSaleIdVariants(sale)[0];
};

const normalizePhotoUrls = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .map((url) => String(url))
      .filter((url) => url.trim() && url.includes("http"));
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .map((url) => String(url))
          .filter((url) => url.trim() && url.includes("http"));
      }
      if (typeof parsed === "string" && parsed.includes("http")) {
        return [parsed];
      }
    } catch {
      // Ignore invalid JSON and continue parsing fallback formats.
    }

    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      const inner = trimmed.slice(1, -1);
      const urls = inner
        .split(/[,;]/)
        .map((url) =>
          url
            .trim()
            .replace(/^["'""'']+|["'""'']+$/g, "")
            .trim(),
        )
        .filter((url) => url && url.includes("http"));
      if (urls.length > 0) return urls;
    }

    return trimmed
      .split(/[,;\n]+|\s+(?=https?:)/)
      .map((url) =>
        url
          .trim()
          .replace(/^["'""'']+|["'""'']+$/g, "")
          .trim(),
      )
      .filter((url) => url && url.includes("http"));
  }

  return [];
};

const getDisplayableImageUrl = (url: string): string => {
  if (!url) return "";

  if (!url.includes("drive.google.com")) {
    return url;
  }

  let fileId: string | null = null;
  const fileMatch = url.match(/\/file\/d\/([^/]+)/);
  if (fileMatch) {
    fileId = fileMatch[1];
  }

  if (!fileId) {
    const openMatch = url.match(/[?&]id=([^&]+)/);
    if (openMatch) {
      fileId = openMatch[1];
    }
  }

  if (!fileId) {
    const ucMatch = url.match(/\/uc\?.*id=([^&]+)/);
    if (ucMatch) {
      fileId = ucMatch[1];
    }
  }

  if (fileId) {
    return `https://lh3.googleusercontent.com/d/${fileId}`;
  }

  return url;
};

const getTimeFromSubmission = (submissionTime?: string): string => {
  if (!submissionTime) return "";
  return submissionTime.includes(" ")
    ? submissionTime.split(" ")[1] || ""
    : submissionTime;
};

const formatSaleDate = (sale: Sale): string => {
  const date = new Date(sale.fechaSinHora);
  const dateLabel = Number.isNaN(date.getTime())
    ? sale.fechaSinHora || "Sin fecha"
    : date.toLocaleDateString("es-ES", {
        day: "numeric",
        month: "short",
      });
  const timeLabel = getTimeFromSubmission(sale.submissionTime).slice(0, 5);
  return timeLabel ? `${dateLabel}, ${timeLabel}` : dateLabel;
};

const formatReviewDate = (reviewedAt: string): string => {
  if (!reviewedAt) return "";
  const date = new Date(reviewedAt);
  if (Number.isNaN(date.getTime())) return reviewedAt;
  return date.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatCurrency = (value: number) => {
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const parseSeenBy = (value?: string): Set<string> => {
  if (!value) return new Set();
  return new Set(
    value
      .split(",")
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean),
  );
};

const getVendorLabel = (email: string): string => {
  if (!email) return "";
  return EMAIL_TO_VENDOR_LABELS[email] || email.split("@")[0];
};

export default function BuzonPage() {
  const { data: session, status } = useSession();
  const sessionEmail = session?.user?.email || "";
  const [salesData, setSalesData] = useState<Sale[]>([]);
  const [reviews, setReviews] = useState<FeedReview[]>([]);
  const [isLoadingSales, setIsLoadingSales] = useState(false);
  const [isLoadingReviews, setIsLoadingReviews] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<BuzonEntry | null>(null);
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
  const [markingSaleId, setMarkingSaleId] = useState<string | null>(null);

  const isAdmin = useMemo(
    () => isMasterAccount(session?.user?.email),
    [session?.user?.email],
  );

  useEffect(() => {
    if (!sessionEmail) return;

    const fetchSalesData = async () => {
      setIsLoadingSales(true);
      try {
        const response = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}!A:AQ?key=${googleApiKey}`,
        );
        const data = await response.json();
        const headers: string[] = data.values?.[0] || [];
        const rows: string[][] = data.values?.slice(1) || [];

        const photoHeaderPatterns = [
          /foto/i,
          /photo/i,
          /imagen/i,
          /image/i,
          /picture/i,
        ];
        let photoColumnIndex = 41;
        for (let i = 0; i < headers.length; i++) {
          if (
            photoHeaderPatterns.some((pattern) =>
              pattern.test(headers[i] || ""),
            )
          ) {
            photoColumnIndex = i;
            break;
          }
        }

        const sales: Sale[] = rows.map((row: string[]) => {
          const products: Record<string, number> = {};
          for (let i = 8; i <= 30; i++) {
            if (row[i] && row[i] !== "0") {
              products[headers[i]] = parseInt(row[i], 10);
            }
          }
          for (let i = 34; i <= 36; i++) {
            if (row[i] && row[i] !== "0") {
              products[headers[i]] = parseInt(row[i], 10);
            }
          }

          let photoUrls: string[] = [];
          if (row[photoColumnIndex]) {
            photoUrls = normalizePhotoUrls(row[photoColumnIndex]);
          }

          if (photoUrls.length === 0) {
            for (let i = 39; i <= Math.min(42, row.length - 1); i++) {
              if (i === photoColumnIndex) continue;
              const cellValue = row[i];
              if (
                cellValue &&
                (cellValue.includes("drive.google.com") ||
                  cellValue.includes("googleusercontent.com") ||
                  cellValue.startsWith("["))
              ) {
                const parsed = normalizePhotoUrls(cellValue);
                if (parsed.length > 0) {
                  photoUrls = parsed;
                  break;
                }
              }
            }
          }

          return {
            clientName: row[0] || "Unknown",
            venta: parseFloat(row[33]) || 0,
            codigo: row[31] || "",
            fechaSinHora: row[32] || "",
            email: row[7] || "",
            submissionTime: row[4] && row[4].trim() !== "" ? row[4] : undefined,
            products,
            photoUrls,
          };
        });

        setSalesData(sales);
      } catch (error) {
        console.error("Error fetching sales data:", error);
      } finally {
        setIsLoadingSales(false);
      }
    };

    const fetchReviews = async () => {
      setIsLoadingReviews(true);
      try {
        const response = await fetch("/api/feed-reviews");
        if (response.ok) {
          const data = await response.json();
          setReviews(data.reviews || []);
        }
      } catch (error) {
        console.error("Error fetching reviews:", error);
      } finally {
        setIsLoadingReviews(false);
      }
    };

    fetchSalesData();
    fetchReviews();
  }, [sessionEmail]);

  const entries = useMemo(() => {
    if (!sessionEmail) return [];
    const saleMap = new Map<string, Sale>();
    salesData.forEach((sale) => {
      getSaleIdVariants(sale).forEach((variant) => {
        saleMap.set(variant, sale);
      });
    });

    const result: BuzonEntry[] = [];
    reviews.forEach((review) => {
      const note = (review.note || "").trim();
      if (!note) return;
      const sale = saleMap.get(review.saleId);
      if (!sale) return;
      if (!isAdmin && sale.email !== sessionEmail) return;
      result.push({ sale, review: { ...review, note } });
    });

    return result.sort((a, b) => {
      const dateA = new Date(a.review.reviewedAt).getTime();
      const dateB = new Date(b.review.reviewedAt).getTime();
      return dateB - dateA;
    });
  }, [reviews, salesData, sessionEmail, isAdmin]);

  useEffect(() => {
    setVisibleCount(ITEMS_PER_PAGE);
  }, [entries.length]);

  const handleMarkSeen = async (entry: BuzonEntry) => {
    if (!sessionEmail) return;
    setMarkingSaleId(entry.review.saleId);
    try {
      const response = await fetch("/api/feed-reviews", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          saleId: entry.review.saleId,
          reviewedAt: entry.review.reviewedAt,
          seenBy: sessionEmail,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setReviews((prev) =>
          prev.map((review) =>
            review.saleId === entry.review.saleId
              ? { ...review, seenBy: data.seenBy }
              : review,
          ),
        );
        setSelectedEntry((prev) =>
          prev && prev.review.saleId === entry.review.saleId
            ? { ...prev, review: { ...prev.review, seenBy: data.seenBy } }
            : prev,
        );
        triggerBuzonRefresh();
      }
    } catch (error) {
      console.error("Error updating seenBy:", error);
    } finally {
      setMarkingSaleId(null);
    }
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-gray-500">Cargando...</div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="bg-white rounded-xl p-6 text-center max-w-md">
          <h1 className="text-xl font-bold text-gray-800 mb-2">
            Acceso Restringido
          </h1>
          <p className="text-gray-600 mb-4">
            Debes iniciar sesion para acceder a esta pagina.
          </p>
          <Link href="/" className="text-blue-600 hover:underline">
            Volver al Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const isLoading = isLoadingSales || isLoadingReviews;
  const visibleEntries = entries.slice(0, visibleCount);
  const hasMoreEntries = visibleCount < entries.length;

  return (
    <div className="min-h-screen bg-white font-sans">
      <AppHeader
        title="Buzon"
        icon={MessageSquare}
        subtitle={isAdmin ? "Comentarios del equipo" : "Comentarios para ti"}
      />

      <main className="px-4 py-4 max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Comentarios recientes
            </h2>
            <p className="text-xs text-slate-500">
              {isAdmin
                ? "Viendo comentarios de todos los vendedores"
                : "Viendo comentarios sobre tus ventas"}
            </p>
          </div>
          <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-1 rounded-full">
            {entries.length}
          </span>
        </div>

        {isLoading ? (
          <div className="bg-white border border-slate-200/70 rounded-xl p-6 text-center text-sm text-slate-500">
            Cargando comentarios...
          </div>
        ) : entries.length === 0 ? (
          <div className="bg-white border border-slate-200/70 rounded-xl p-6 text-center text-sm text-slate-500">
            No hay comentarios para mostrar.
          </div>
        ) : (
          <div className="space-y-3">
            {visibleEntries.map((entry) => {
              const reviewerName = getVendorLabel(entry.review.reviewedBy);
              const sellerName = getVendorLabel(entry.sale.email);
              const saleDate = formatSaleDate(entry.sale);
              const seenBySet = parseSeenBy(entry.review.seenBy);
              const isSeen = sessionEmail
                ? seenBySet.has(sessionEmail.toLowerCase())
                : false;
              return (
                <button
                  key={`${entry.review.saleId}-${entry.review.reviewedAt}`}
                  type="button"
                  onClick={() => setSelectedEntry(entry)}
                  className="w-full text-left bg-white border border-slate-200/70 rounded-xl p-4 shadow-sm hover:shadow-md hover:border-slate-300 transition"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {entry.sale.clientName}
                      </p>
                      <p className="text-xs text-slate-500">
                        Comentario de {reviewerName}
                        {entry.review.reviewedAt
                          ? ` · ${formatReviewDate(entry.review.reviewedAt)}`
                          : ""}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="block text-xs font-semibold text-slate-600">
                        {formatCurrency(entry.sale.venta)}
                      </span>
                      <span
                        className={`mt-1 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          isSeen
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {isSeen ? "Visto" : "Nuevo"}
                      </span>
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-slate-700">
                    {entry.review.note}
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    {isAdmin
                      ? `Vendedor: ${sellerName} · Venta ${saleDate}`
                      : `Venta ${saleDate}`}
                  </p>
                </button>
              );
            })}
            {hasMoreEntries && (
              <div className="flex justify-center pt-2">
                <button
                  type="button"
                  onClick={() =>
                    setVisibleCount((prev) => prev + ITEMS_PER_PAGE)
                  }
                  className="px-5 py-2.5 text-xs font-semibold rounded-full border border-slate-200 text-slate-700 hover:bg-slate-50 transition"
                >
                  Cargar mas ({entries.length - visibleCount} restantes)
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {selectedEntry && (
        <FeedLightbox
          sale={selectedEntry.sale}
          onClose={() => setSelectedEntry(null)}
          getDisplayableImageUrl={getDisplayableImageUrl}
          formatCurrency={formatCurrency}
          review={selectedEntry.review}
          onMarkReviewed={async () => {}}
          isSubmittingReview={false}
          isReadOnly
          isSeen={parseSeenBy(selectedEntry.review.seenBy).has(
            sessionEmail.toLowerCase(),
          )}
          onMarkSeen={() => handleMarkSeen(selectedEntry)}
          isMarkingSeen={markingSaleId === selectedEntry.review.saleId}
        />
      )}
    </div>
  );
}
