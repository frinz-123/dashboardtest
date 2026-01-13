// Master account authentication utilities

export const MASTER_ACCOUNTS = [
  "alopezelrey@gmail.com",
  "franzcharbell@gmail.com",
  "cesar.reyes.ochoa@gmail.com",
];

export const isMasterAccount = (email: string | null | undefined): boolean => {
  if (!email) return false;
  return MASTER_ACCOUNTS.includes(email.toLowerCase().trim());
};

// Email to vendor label mapping for master account switching
export const EMAIL_TO_VENDOR_LABELS: Record<string, string> = {
  "ventas1productoselrey@gmail.com": "Ernesto",
  "ventas2productoselrey@gmail.com": "Roel",
  "ventas3productoselrey@gmail.com": "Lidia",
  "ventas4productoselrey@gmail.com": "Reyna",
  "ventasmztproductoselrey.com@gmail.com": "Mazatlan",
  "ventasmochisproductoselrey@gmail.com": "Mochis",
  "franzcharbell@gmail.com": "Franz",
  "cesar.reyes.ochoa@gmail.com": "Cesar",
  "arturo.elreychiltepin@gmail.com": "Arturo Mty",
  "alopezelrey@gmail.com": "Arlyn",
  "promotoriaelrey@gmail.com": "Karla",
  "bodegaelrey034@gmail.com": "Bodega",
};

// Legacy/alternate labels that may exist in sheets.
export const VENDOR_LABEL_ALIASES: Record<string, string[]> = {
  // Older data used "Brenda" for this email in some places.
  "promotoriaelrey@gmail.com": ["Brenda"],
};

export const normalizeVendorValue = (value: string): string => {
  return (value || "")
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
};

export const getVendorLabel = (email: string): string => {
  const normalizedEmail = (email || "").toLowerCase().trim();
  return EMAIL_TO_VENDOR_LABELS[normalizedEmail] || email;
};

export const getVendorEmails = (): string[] => {
  return Object.keys(EMAIL_TO_VENDOR_LABELS);
};

export const VENDOR_LABEL_TO_EMAIL: Record<string, string> = (() => {
  const labelToEmail: Record<string, string> = {};

  for (const [email, label] of Object.entries(EMAIL_TO_VENDOR_LABELS)) {
    labelToEmail[normalizeVendorValue(label)] = email;
  }

  for (const [email, aliases] of Object.entries(VENDOR_LABEL_ALIASES)) {
    for (const alias of aliases) {
      labelToEmail[normalizeVendorValue(alias)] = email;
    }
  }

  return labelToEmail;
})();

export const getVendorEmailFromLabel = (labelOrEmail: string): string => {
  const raw = (labelOrEmail || "").trim();
  if (!raw) return raw;

  // Already an email.
  if (raw.includes("@")) return raw.toLowerCase().trim();

  return VENDOR_LABEL_TO_EMAIL[normalizeVendorValue(raw)] || raw;
};

export const getVendorIdentifiers = (email: string): Set<string> => {
  const normalizedEmail = (email || "").toLowerCase().trim();
  const canonicalLabel = getVendorLabel(normalizedEmail);
  const aliases = VENDOR_LABEL_ALIASES[normalizedEmail] || [];

  return new Set(
    [normalizedEmail, canonicalLabel, ...aliases].map((v) =>
      normalizeVendorValue(v),
    ),
  );
};
