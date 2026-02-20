const DASHBOARD_SNAPSHOT_KEY_PREFIX = "dashboard:snapshot:v1:";
const DASHBOARD_SELLER_KEY_PREFIX = "dashboard:selected-seller:v1:";

export type CachedDashboardSnapshot<TSale = unknown> = {
  salesData: TSale[];
  liveSalesData: TSale[];
  cachedAt: number;
};

export type CachedSellerSelection = {
  selectedEmail: string;
  updatedAt: number;
};

const isBrowser = (): boolean =>
  typeof window !== "undefined" && typeof localStorage !== "undefined";

const buildSnapshotKey = (userEmail: string): string =>
  `${DASHBOARD_SNAPSHOT_KEY_PREFIX}${userEmail.toLowerCase()}`;

const buildSellerKey = (userEmail: string): string =>
  `${DASHBOARD_SELLER_KEY_PREFIX}${userEmail.toLowerCase()}`;

export const getDashboardSnapshot = <TSale = unknown>(
  userEmail: string,
): CachedDashboardSnapshot<TSale> | null => {
  if (!userEmail || !isBrowser()) {
    return null;
  }

  try {
    const raw = localStorage.getItem(buildSnapshotKey(userEmail));
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<CachedDashboardSnapshot<TSale>>;
    if (
      !parsed ||
      !Array.isArray(parsed.salesData) ||
      !Array.isArray(parsed.liveSalesData) ||
      typeof parsed.cachedAt !== "number"
    ) {
      return null;
    }

    return {
      salesData: parsed.salesData,
      liveSalesData: parsed.liveSalesData,
      cachedAt: parsed.cachedAt,
    };
  } catch {
    return null;
  }
};

export const setDashboardSnapshot = <TSale = unknown>(
  userEmail: string,
  snapshot: CachedDashboardSnapshot<TSale>,
): void => {
  if (!userEmail || !isBrowser()) {
    return;
  }

  try {
    localStorage.setItem(buildSnapshotKey(userEmail), JSON.stringify(snapshot));
  } catch {
    // Ignore storage write errors (quota/private mode).
  }
};

export const getSellerSelection = (
  userEmail: string,
): CachedSellerSelection | null => {
  if (!userEmail || !isBrowser()) {
    return null;
  }

  try {
    const raw = localStorage.getItem(buildSellerKey(userEmail));
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<CachedSellerSelection>;
    if (
      !parsed ||
      typeof parsed.selectedEmail !== "string" ||
      typeof parsed.updatedAt !== "number"
    ) {
      return null;
    }

    return {
      selectedEmail: parsed.selectedEmail,
      updatedAt: parsed.updatedAt,
    };
  } catch {
    return null;
  }
};

export const setSellerSelection = (
  userEmail: string,
  selectedEmail: string,
): void => {
  if (!userEmail || !selectedEmail || !isBrowser()) {
    return;
  }

  const payload: CachedSellerSelection = {
    selectedEmail,
    updatedAt: Date.now(),
  };

  try {
    localStorage.setItem(buildSellerKey(userEmail), JSON.stringify(payload));
  } catch {
    // Ignore storage write errors (quota/private mode).
  }
};
