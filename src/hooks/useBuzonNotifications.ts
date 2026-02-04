"use client";

import { useSession } from "next-auth/react";
import { useCallback, useEffect, useState } from "react";

const REFRESH_EVENT = "buzon:refresh";
const REFRESH_INTERVAL_MS = 60000;

export const triggerBuzonRefresh = () => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(REFRESH_EVENT));
};

export const useBuzonNotifications = () => {
  const { data: session } = useSession();
  const [unseenCount, setUnseenCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!session?.user?.email) {
      setUnseenCount(0);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/buzon-unseen", {
        cache: "no-store",
      });
      if (response.ok) {
        const data = await response.json();
        setUnseenCount(Number(data.count) || 0);
      }
    } catch {
      // Ignore fetch errors.
    } finally {
      setIsLoading(false);
    }
  }, [session?.user?.email]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        refresh();
      }
    };

    const handleRefreshEvent = () => {
      refresh();
    };

    const interval = window.setInterval(refresh, REFRESH_INTERVAL_MS);
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener(REFRESH_EVENT, handleRefreshEvent);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener(REFRESH_EVENT, handleRefreshEvent);
    };
  }, [refresh]);

  return { unseenCount, isLoading, refresh };
};
