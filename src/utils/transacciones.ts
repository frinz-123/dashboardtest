export type ProductEntry = {
  name: string;
  quantity: number;
};

export type TransactionRecord = {
  sheetRowNumber: number;
  saleId: string;
  saleIdVariants: string[];
  clientName: string;
  clientLat: string;
  clientLng: string;
  reservedD: string;
  submissionTime: string;
  currentLat: string;
  currentLng: string;
  email: string;
  products: Record<string, number>;
  productEntries: ProductEntry[];
  productCount: number;
  productUnits: number;
  submissionId: string;
  codigo: string;
  fechaSinHora: string;
  venta: number;
  periodWeekCode: string;
  cleyOrderValue: string;
  reservedAN: string;
  monthYearCode: string;
  photoUrls: string[];
  hasPhotos: boolean;
  dateKey: string;
  sortTimestamp: number;
};

export type TransactionFilters = {
  from?: string;
  to?: string;
  code?: string;
  client?: string;
  email?: string;
  saleId?: string;
  minTotal?: number;
  maxTotal?: number;
  period?: string;
  monthCode?: string;
  product?: string;
  hasPhotos?: boolean | null;
};

export type TransactionsApiResponse = {
  items: TransactionRecord[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  filterOptions: {
    codigos: string[];
    vendedores: string[];
    periodos: string[];
  };
};

const DEFAULT_PHOTO_COLUMN_INDEX = 41;
const PHOTO_SCAN_START_INDEX = 39;
const PHOTO_SCAN_END_INDEX = 42;
const PRODUCT_COLUMN_INDICES = [
  8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27,
  28, 29, 34, 35, 36,
] as const;

const PRODUCT_COLUMN_FALLBACKS: Record<number, string> = {
  8: "Chiltepin Molido 50 g",
  9: "Chiltepin Molido 20 g",
  10: "Chiltepin Entero 30 g",
  11: "Salsa Chiltepin El rey 195 ml",
  12: "Salsa Especial El Rey 195 ml",
  13: "Salsa Reina El rey 195 ml",
  14: "Salsa Habanera El Rey 195 ml",
  15: "Paquete El Rey",
  16: "Molinillo El Rey 30 g",
  17: "Tira Entero",
  18: "Tira Molido",
  19: "Salsa chiltepin Litro",
  20: "Salsa Especial Litro",
  21: "Salsa Reina Litro",
  22: "Salsa Habanera Litro",
  23: "Michela Mix Tamarindo",
  24: "Michela Mix Mango",
  25: "Michela Mix Sandia",
  26: "Michela Mix Fuego",
  27: "El Rey Mix Original",
  28: "El Rey Mix Especial",
  29: "Medio Kilo Chiltepin Entero",
  34: "Michela Mix Picafresa",
  35: "Habanero Molido 50 g",
  36: "Habanero Molido 20 g",
};

const PHOTO_HEADER_PATTERNS = [
  /foto/i,
  /photo/i,
  /imagen/i,
  /image/i,
  /picture/i,
];

const SLASH_DATE_PATTERN = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /(\d{1,2}):(\d{2})(?::(\d{2}))?/;

const normalizeText = (value: string): string => {
  return (value || "")
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
};

const parseNormalizedCsv = (value: string): string[] => {
  if (!value) return [];

  return value
    .split(",")
    .map((entry) => normalizeText(entry))
    .filter(Boolean);
};

const hashString = (value: string): string => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
};

const toNumber = (value: string | undefined): number => {
  if (!value) return 0;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toInteger = (value: string | undefined): number => {
  if (!value) return 0;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getSubmissionTimeKey = (submissionTime?: string): string => {
  if (!submissionTime) return "";
  const timePart = submissionTime.includes(" ")
    ? submissionTime.split(" ")[1]
    : submissionTime;
  return timePart?.slice(0, 8) || "";
};

const getPhotoKey = (photoUrls: string[]): string => {
  const firstUrl = photoUrls.find((url) => url.trim()) || "";
  return firstUrl ? hashString(firstUrl) : "";
};

const getSaleIdVariants = (
  email: string,
  fechaSinHora: string,
  clientName: string,
  submissionTime: string,
  photoUrls: string[],
): string[] => {
  const baseId = `${email}|${fechaSinHora}|${clientName}`;
  const timeKey = getSubmissionTimeKey(submissionTime);
  const photoKey = getPhotoKey(photoUrls);
  const variants: string[] = [];

  if (photoKey) {
    variants.push(`${baseId}|p:${photoKey}`);
  }

  if (timeKey) {
    variants.push(`${baseId}|t:${timeKey}`);
  }

  variants.push(baseId);
  return variants;
};

export const normalizePhotoUrls = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value
      .map((url) => String(url))
      .filter((url) => url.trim() && url.includes("http"));
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) {
      return [];
    }

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
      // Ignore parsing errors and continue with fallback parsers.
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
        .filter((url) => url?.includes("http"));

      if (urls.length > 0) {
        return urls;
      }
    }

    return trimmed
      .split(/[,;\n]+|\s+(?=https?:)/)
      .map((url) =>
        url
          .trim()
          .replace(/^["'""'']+|["'""'']+$/g, "")
          .trim(),
      )
      .filter((url) => url?.includes("http"));
  }

  return [];
};

export const detectPhotoColumnIndex = (headers: string[]): number => {
  for (let i = 0; i < headers.length; i += 1) {
    const header = headers[i] || "";
    if (PHOTO_HEADER_PATTERNS.some((pattern) => pattern.test(header))) {
      return i;
    }
  }

  return DEFAULT_PHOTO_COLUMN_INDEX;
};

const getDateKeyFromValue = (rawDate: string): string => {
  const value = (rawDate || "").trim();
  if (!value) return "";

  const slashMatch = value.match(SLASH_DATE_PATTERN);
  if (slashMatch) {
    const month = slashMatch[1].padStart(2, "0");
    const day = slashMatch[2].padStart(2, "0");
    const year = slashMatch[3];
    return `${year}-${month}-${day}`;
  }

  const isoMatch = value.match(ISO_DATE_PATTERN);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  const year = String(parsed.getFullYear());
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getTimeParts = (
  submissionTime: string,
): {
  hour: string;
  minute: string;
  second: string;
} | null => {
  if (!submissionTime) return null;

  const rawTime = submissionTime.includes(" ")
    ? submissionTime.split(" ")[1] || ""
    : submissionTime;

  const match = rawTime.match(TIME_PATTERN);
  if (!match) return null;

  const hourNumber = Number.parseInt(match[1], 10);
  const minuteNumber = Number.parseInt(match[2], 10);
  const secondNumber = Number.parseInt(match[3] || "0", 10);

  if (
    !Number.isFinite(hourNumber) ||
    !Number.isFinite(minuteNumber) ||
    !Number.isFinite(secondNumber)
  ) {
    return null;
  }

  return {
    hour: String(hourNumber).padStart(2, "0"),
    minute: String(minuteNumber).padStart(2, "0"),
    second: String(secondNumber).padStart(2, "0"),
  };
};

const getSortTimestamp = (
  fechaSinHora: string,
  submissionTime: string,
): number => {
  const dateKey = getDateKeyFromValue(fechaSinHora);
  const timeParts = getTimeParts(submissionTime);

  if (dateKey && timeParts) {
    const composed = `${dateKey}T${timeParts.hour}:${timeParts.minute}:${timeParts.second}`;
    const parsed = Date.parse(composed);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  if (dateKey) {
    const parsed = Date.parse(`${dateKey}T00:00:00`);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  if (submissionTime) {
    const parsedSubmissionTime = Date.parse(submissionTime);
    if (Number.isFinite(parsedSubmissionTime)) {
      return parsedSubmissionTime;
    }
  }

  return 0;
};

const getProductsFromRow = (
  row: string[],
  headers: string[],
): {
  products: Record<string, number>;
  productEntries: ProductEntry[];
  productCount: number;
  productUnits: number;
} => {
  const products: Record<string, number> = {};
  const productEntries: ProductEntry[] = [];
  let productUnits = 0;

  for (const index of PRODUCT_COLUMN_INDICES) {
    const rawValue = row[index];
    const quantity = toInteger(rawValue);
    if (quantity <= 0) continue;

    const header =
      headers[index] || PRODUCT_COLUMN_FALLBACKS[index] || `Col-${index}`;
    products[header] = quantity;
    productEntries.push({ name: header, quantity });
    productUnits += quantity;
  }

  productEntries.sort((a, b) => b.quantity - a.quantity);

  return {
    products,
    productEntries,
    productCount: productEntries.length,
    productUnits,
  };
};

const getPhotoUrlsFromRow = (
  row: string[],
  photoColumnIndex: number,
): string[] => {
  const primaryValue = row[photoColumnIndex];
  const fromPrimary = normalizePhotoUrls(primaryValue);
  if (fromPrimary.length > 0) {
    return fromPrimary;
  }

  for (
    let index = PHOTO_SCAN_START_INDEX;
    index <= Math.min(PHOTO_SCAN_END_INDEX, row.length - 1);
    index += 1
  ) {
    if (index === photoColumnIndex) continue;
    const fromFallback = normalizePhotoUrls(row[index]);
    if (fromFallback.length > 0) {
      return fromFallback;
    }
  }

  return [];
};

export const parseTransactionRow = (
  row: string[],
  headers: string[],
  photoColumnIndex: number,
  sheetRowNumber: number,
): TransactionRecord => {
  const clientName = (row[0] || "").trim();
  const clientLat = (row[1] || "").trim();
  const clientLng = (row[2] || "").trim();
  const reservedD = row[3] || "";
  const submissionTime = (row[4] || "").trim();
  const currentLat = (row[5] || "").trim();
  const currentLng = (row[6] || "").trim();
  const email = (row[7] || "").trim().toLowerCase();

  const { products, productEntries, productCount, productUnits } =
    getProductsFromRow(row, headers);

  const submissionId = (row[30] || "").trim();
  const codigo = (row[31] || "").trim().toUpperCase();
  const fechaSinHora = (row[32] || "").trim();
  const venta = toNumber(row[33]);
  const periodWeekCode = (row[37] || "").trim().toUpperCase();
  const cleyOrderValue = (row[38] || "").trim();
  const reservedAN = row[39] || "";
  const monthYearCode = (row[40] || "").trim().toUpperCase();
  const photoUrls = getPhotoUrlsFromRow(row, photoColumnIndex);

  const saleIdVariants = getSaleIdVariants(
    email,
    fechaSinHora,
    clientName,
    submissionTime,
    photoUrls,
  );

  return {
    sheetRowNumber,
    saleId: saleIdVariants[0],
    saleIdVariants,
    clientName,
    clientLat,
    clientLng,
    reservedD,
    submissionTime,
    currentLat,
    currentLng,
    email,
    products,
    productEntries,
    productCount,
    productUnits,
    submissionId,
    codigo,
    fechaSinHora,
    venta,
    periodWeekCode,
    cleyOrderValue,
    reservedAN,
    monthYearCode,
    photoUrls,
    hasPhotos: photoUrls.length > 0,
    dateKey: getDateKeyFromValue(fechaSinHora),
    sortTimestamp: getSortTimestamp(fechaSinHora, submissionTime),
  };
};

const getNormalizedSet = (record: TransactionRecord) => {
  return {
    code: normalizeText(record.codigo),
    client: normalizeText(record.clientName),
    email: normalizeText(record.email),
    saleIdVariants: record.saleIdVariants.map((variant) =>
      normalizeText(variant),
    ),
    period: normalizeText(record.periodWeekCode),
    monthCode: normalizeText(record.monthYearCode),
  };
};

export const applyTransactionFilters = (
  records: TransactionRecord[],
  filters: TransactionFilters,
): TransactionRecord[] => {
  const from = (filters.from || "").trim();
  const to = (filters.to || "").trim();
  const codeTerms = parseNormalizedCsv(filters.code || "");
  const client = normalizeText(filters.client || "");
  const emailTerms = parseNormalizedCsv(filters.email || "");
  const saleId = normalizeText(filters.saleId || "");
  const periodTerms = parseNormalizedCsv(filters.period || "");
  const monthCode = normalizeText(filters.monthCode || "");
  const product = normalizeText(filters.product || "");

  const filtered: TransactionRecord[] = [];

  for (const record of records) {
    if (from && (!record.dateKey || record.dateKey < from)) {
      continue;
    }

    if (to && (!record.dateKey || record.dateKey > to)) {
      continue;
    }

    if (filters.hasPhotos !== undefined && filters.hasPhotos !== null) {
      if (record.hasPhotos !== filters.hasPhotos) {
        continue;
      }
    }

    if (filters.minTotal !== undefined && record.venta < filters.minTotal) {
      continue;
    }

    if (filters.maxTotal !== undefined && record.venta > filters.maxTotal) {
      continue;
    }

    const normalized = getNormalizedSet(record);

    if (
      codeTerms.length > 0 &&
      !codeTerms.some((term) => normalized.code.includes(term))
    ) {
      continue;
    }

    if (client && !normalized.client.includes(client)) {
      continue;
    }

    if (
      emailTerms.length > 0 &&
      !emailTerms.some((term) => normalized.email.includes(term))
    ) {
      continue;
    }

    if (
      saleId &&
      !normalized.saleIdVariants.some((variant) => variant.includes(saleId))
    ) {
      continue;
    }

    if (
      periodTerms.length > 0 &&
      !periodTerms.some((term) => normalized.period.includes(term))
    ) {
      continue;
    }

    if (monthCode && !normalized.monthCode.includes(monthCode)) {
      continue;
    }

    if (product) {
      const matchesProduct = record.productEntries.some((entry) =>
        normalizeText(entry.name).includes(product),
      );
      if (!matchesProduct) {
        continue;
      }
    }

    filtered.push(record);
  }

  return filtered;
};

export const sortTransactionsDescending = (
  records: TransactionRecord[],
): TransactionRecord[] => {
  return [...records].sort((a, b) => {
    if (a.sortTimestamp !== b.sortTimestamp) {
      return b.sortTimestamp - a.sortTimestamp;
    }

    return b.sheetRowNumber - a.sheetRowNumber;
  });
};

export const parseLimit = (
  value: string | null,
  defaultValue: number,
): number => {
  if (!value) return defaultValue;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return defaultValue;
  }
  return parsed;
};

export const parseOffset = (value: string | null): number => {
  if (!value) return 0;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  return parsed;
};
