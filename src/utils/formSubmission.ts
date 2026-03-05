const TRUE_LIKE_VALUES = new Set(["1", "true", "yes", "si", "on"]);

export const FORM_OVERRIDE_EMAILS = (
  process.env.NEXT_PUBLIC_OVERRIDE_EMAIL ?? ""
)
  .split(",")
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

export const PHOTO_REQUIRED_CLIENT_CODES = [
  "CLEY",
  "TERE",
  "MERZ",
  "MERKAHORRO",
  "WM",
  "OXX",
  "KIOSK",
] as const;

export const PHOTO_REQUIRED_CODES = new Set<string>(
  PHOTO_REQUIRED_CLIENT_CODES,
);
export const PHOTO_MIN_REQUIRED = 2;
export const PHOTO_MAX = 4;
export const PHOTO_MAX_DIMENSION = 1280;
export const PHOTO_QUALITY = 0.75;

export function isFormAdminEmail(email: string | null | undefined): boolean {
  const normalizedEmail = (email ?? "").trim().toLowerCase();
  return (
    normalizedEmail.length > 0 && FORM_OVERRIDE_EMAILS.includes(normalizedEmail)
  );
}

export function isPhotoRequiredClientCode(
  clientCode: string | null | undefined,
): boolean {
  return PHOTO_REQUIRED_CODES.has((clientCode ?? "").trim().toUpperCase());
}

export function parseBooleanLike(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;

  if (typeof value === "string") {
    return TRUE_LIKE_VALUES.has(value.trim().toLowerCase());
  }

  return false;
}
