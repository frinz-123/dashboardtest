"use client";

import {
  Clock,
  DollarSign,
  Eye,
  EyeOff,
  ImageOff,
  MessageCircle,
  MessageSquare,
  User,
} from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";
import AppHeader from "@/components/AppHeader";
import { Badge } from "@/components/badge";
import FeedLightbox from "@/components/inspector/FeedLightbox";
import { triggerBuzonRefresh } from "@/hooks/useBuzonNotifications";
import { EMAIL_TO_VENDOR_LABELS, isMasterAccount } from "@/utils/auth";
import {
  FORM_DATA_LAST_COLUMN,
  PRODUCT_COLUMN_INDICES,
  PRODUCT_COLUMN_NAME_BY_INDEX,
} from "@/utils/productCatalog";

const googleApiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
const spreadsheetId = process.env.NEXT_PUBLIC_SPREADSHEET_ID;
const sheetName = process.env.NEXT_PUBLIC_SHEET_NAME;

const ITEMS_PER_PAGE = 15;

const BADGE_COLORS = [
  { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200/60" },
  {
    bg: "bg-violet-50",
    text: "text-violet-700",
    border: "border-violet-200/60",
  },
  { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200/60" },
  { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200/60" },
  { bg: "bg-teal-50", text: "text-teal-700", border: "border-teal-200/60" },
  {
    bg: "bg-orange-50",
    text: "text-orange-700",
    border: "border-orange-200/60",
  },
  { bg: "bg-cyan-50", text: "text-cyan-700", border: "border-cyan-200/60" },
  { bg: "bg-pink-50", text: "text-pink-700", border: "border-pink-200/60" },
] as const;

const getVendorColor = (name: string) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  return BADGE_COLORS[Math.abs(hash) % BADGE_COLORS.length];
};

const cardVariants = {
  hidden: { opacity: 0, y: 12, filter: "blur(4px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { type: "spring" as const, duration: 0.4, bounce: 0 },
  },
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.05 },
  },
};

function SkeletonCard() {
  return (
    <div className="bg-white border border-slate-100 rounded-xl p-4 flex gap-4">
      <div className="flex-1 min-w-0">
        <div className="skeleton-shimmer h-4 w-3/5 rounded-md mb-2.5" />
        <div className="skeleton-shimmer h-3 w-4/5 rounded-md mb-3" />
        <div className="flex gap-2 mb-3">
          <div className="skeleton-shimmer h-5 w-16 rounded-full" />
          <div className="skeleton-shimmer h-5 w-20 rounded-full" />
        </div>
        <div className="skeleton-shimmer h-3 w-2/3 rounded-md" />
      </div>
      <div className="skeleton-shimmer h-[72px] w-[72px] rounded-lg shrink-0" />
    </div>
  );
}

function BuzonSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2, 3, 4].map((i) => (
        <m.div
          key={i}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            type: "spring",
            duration: 0.35,
            bounce: 0,
            delay: i * 0.06,
          }}
        >
          <SkeletonCard />
        </m.div>
      ))}
    </div>
  );
}

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

const _getSaleId = (sale: Sale): string => {
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
          `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}!A:${FORM_DATA_LAST_COLUMN}?key=${googleApiKey}`,
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
          PRODUCT_COLUMN_INDICES.forEach((index) => {
            if (row[index] && row[index] !== "0") {
              const name =
                headers[index] ||
                PRODUCT_COLUMN_NAME_BY_INDEX[index] ||
                `Col-${index}`;
              products[name] = parseInt(row[index], 10);
            }
          });

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
      <div className="min-h-screen bg-white font-sans">
        <AppHeader title="Buzon" icon={MessageSquare} subtitle="Cargando..." />
        <main className="px-4 py-4 max-w-2xl mx-auto">
          <BuzonSkeleton />
        </main>
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
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2
              className="text-sm font-semibold text-slate-900"
              style={{ textWrap: "balance" }}
            >
              Comentarios recientes
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {isAdmin
                ? "Viendo comentarios de todos los vendedores"
                : "Viendo comentarios sobre tus ventas"}
            </p>
          </div>
          {!isLoading && (
            <m.span
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", duration: 0.3, bounce: 0 }}
              className="text-xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-full"
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {entries.length}
            </m.span>
          )}
        </div>

        <AnimatePresence mode="wait" initial={false}>
          {isLoading ? (
            <m.div
              key="skeleton"
              exit={{ opacity: 0, filter: "blur(4px)" }}
              transition={{ duration: 0.2 }}
            >
              <BuzonSkeleton />
            </m.div>
          ) : entries.length === 0 ? (
            <m.div
              key="empty"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", duration: 0.4, bounce: 0 }}
              className="bg-white border border-slate-200/70 rounded-xl p-8 text-center"
            >
              <MessageSquare
                className="mx-auto mb-2 text-slate-300"
                size={28}
              />
              <p className="text-sm text-slate-500">
                No hay comentarios para mostrar.
              </p>
            </m.div>
          ) : (
            <m.div
              key="entries"
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="space-y-3"
            >
              {visibleEntries.map((entry) => {
                const reviewerName = getVendorLabel(entry.review.reviewedBy);
                const sellerName = getVendorLabel(entry.sale.email);
                const saleDate = formatSaleDate(entry.sale);
                const seenBySet = parseSeenBy(entry.review.seenBy);
                const isSeen = sessionEmail
                  ? seenBySet.has(sessionEmail.toLowerCase())
                  : false;
                const reviewerColor = getVendorColor(reviewerName);
                const sellerColor = getVendorColor(sellerName);
                const firstPhoto = entry.sale.photoUrls?.[0];
                const thumbnailUrl = firstPhoto
                  ? getDisplayableImageUrl(firstPhoto)
                  : null;

                return (
                  <m.button
                    key={`${entry.review.saleId}-${entry.review.reviewedAt}`}
                    variants={cardVariants}
                    whileTap={{ scale: 0.98 }}
                    type="button"
                    onClick={() => setSelectedEntry(entry)}
                    className="w-full text-left bg-white border border-slate-200/70 rounded-xl p-4 hover:border-slate-300 transition-[border-color,box-shadow] duration-150 ease-out"
                    style={{
                      boxShadow:
                        "0 1px 3px rgba(0,0,0,0.04), 0 4px 12px rgba(0,0,0,0.02)",
                    }}
                  >
                    <div className="flex gap-3.5">
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <p
                            className="text-sm font-semibold text-slate-900 truncate"
                            style={{ textWrap: "balance" }}
                          >
                            {entry.sale.clientName}
                          </p>
                          <span
                            className={`shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              isSeen
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-amber-50 text-amber-700"
                            }`}
                          >
                            {isSeen ? <Eye size={10} /> : <EyeOff size={10} />}
                            {isSeen ? "Visto" : "Nuevo"}
                          </span>
                        </div>

                        <p className="text-[13px] text-slate-600 line-clamp-2 mb-2.5 leading-relaxed">
                          {entry.review.note}
                        </p>

                        {/* Badges row */}
                        <div className="flex flex-wrap items-center gap-1.5 mb-2">
                          <Badge
                            variant="outline"
                            className={`${reviewerColor.bg} ${reviewerColor.text} ${reviewerColor.border} text-[10px] px-1.5 py-0 h-[18px] gap-0.5`}
                          >
                            <MessageCircle size={9} />
                            {reviewerName}
                          </Badge>
                          {isAdmin && (
                            <Badge
                              variant="outline"
                              className={`${sellerColor.bg} ${sellerColor.text} ${sellerColor.border} text-[10px] px-1.5 py-0 h-[18px] gap-0.5`}
                            >
                              <User size={9} />
                              {sellerName}
                            </Badge>
                          )}
                        </div>

                        {/* Meta row */}
                        <div className="flex items-center gap-3 text-[11px] text-slate-400">
                          <span className="inline-flex items-center gap-1">
                            <Clock size={10} />
                            {saleDate}
                          </span>
                          <span
                            className="inline-flex items-center gap-1"
                            style={{ fontVariantNumeric: "tabular-nums" }}
                          >
                            <DollarSign size={10} />
                            {formatCurrency(entry.sale.venta)}
                          </span>
                          {entry.review.reviewedAt && (
                            <span className="text-slate-300 hidden sm:inline">
                              {formatReviewDate(entry.review.reviewedAt)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Thumbnail */}
                      <div className="shrink-0">
                        {thumbnailUrl ? (
                          <img
                            src={thumbnailUrl}
                            alt=""
                            className="h-[72px] w-[72px] rounded-lg object-cover"
                            style={{
                              outline: "1px solid rgba(0,0,0,0.06)",
                              outlineOffset: "-1px",
                            }}
                            loading="lazy"
                          />
                        ) : (
                          <div className="h-[72px] w-[72px] rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center">
                            <ImageOff size={20} className="text-slate-300" />
                          </div>
                        )}
                      </div>
                    </div>
                  </m.button>
                );
              })}

              {hasMoreEntries && (
                <m.div
                  variants={cardVariants}
                  className="flex justify-center pt-2"
                >
                  <button
                    type="button"
                    onClick={() =>
                      setVisibleCount((prev) => prev + ITEMS_PER_PAGE)
                    }
                    className="px-5 py-2.5 text-xs font-semibold rounded-full border border-slate-200 text-slate-700 hover:bg-slate-50 active:scale-[0.98] transition-[background-color,transform] duration-150 ease-out"
                  >
                    Cargar mas ({entries.length - visibleCount} restantes)
                  </button>
                </m.div>
              )}
            </m.div>
          )}
        </AnimatePresence>
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
