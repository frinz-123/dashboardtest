"use client";

import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect } from "react";

const FORM_PREFETCH_SESSION_KEY = "form-route-prefetched-v1";

type NetworkInfo = {
  effectiveType?: string;
  saveData?: boolean;
};

function getNetworkInfo(): NetworkInfo | null {
  const nav = navigator as Navigator & {
    connection?: NetworkInfo;
    mozConnection?: NetworkInfo;
    webkitConnection?: NetworkInfo;
  };

  return nav.connection ?? nav.mozConnection ?? nav.webkitConnection ?? null;
}

function isConstrainedNetwork(): boolean {
  const network = getNetworkInfo();
  if (!network) return true;

  const effectiveType = network.effectiveType?.toLowerCase();
  if (network.saveData) return true;
  if (!effectiveType) return true;

  return (
    effectiveType.includes("2g") ||
    effectiveType.includes("3g") ||
    effectiveType.includes("slow-2g")
  );
}

export default function FormRouteWarmup() {
  const router = useRouter();
  const pathname = usePathname();
  const { status } = useSession();

  useEffect(() => {
    if (status !== "authenticated") return;
    if (pathname !== "/") return;
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(FORM_PREFETCH_SESSION_KEY) === "1") return;

    let cancelled = false;
    let idleTaskId: number | null = null;

    const markPrefetched = () => {
      sessionStorage.setItem(FORM_PREFETCH_SESSION_KEY, "1");
    };

    const runPrefetch = () => {
      if (cancelled || !navigator.onLine) return;
      if (isConstrainedNetwork()) return;

      router.prefetch("/form", {
        onInvalidate: () => {
          if (!cancelled) {
            router.prefetch("/form");
          }
        },
      });
      markPrefetched();
    };

    const schedulePrefetch = () => {
      const win = window as Window & {
        requestIdleCallback?: (
          callback: () => void,
          options?: { timeout: number },
        ) => number;
        cancelIdleCallback?: (id: number) => void;
      };

      if (typeof win.requestIdleCallback === "function") {
        idleTaskId = win.requestIdleCallback(runPrefetch, { timeout: 2500 });
        return;
      }

      idleTaskId = window.setTimeout(runPrefetch, 1200);
    };

    const handleOnline = () => {
      if (cancelled) return;
      if (sessionStorage.getItem(FORM_PREFETCH_SESSION_KEY) === "1") return;
      schedulePrefetch();
    };

    schedulePrefetch();
    window.addEventListener("online", handleOnline);

    return () => {
      cancelled = true;
      window.removeEventListener("online", handleOnline);

      if (idleTaskId !== null) {
        const win = window as Window & {
          cancelIdleCallback?: (id: number) => void;
        };

        if (typeof win.cancelIdleCallback === "function") {
          win.cancelIdleCallback(idleTaskId);
        } else {
          window.clearTimeout(idleTaskId);
        }
      }
    };
  }, [pathname, router, status]);

  return null;
}
