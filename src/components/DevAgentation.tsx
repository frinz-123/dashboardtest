"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const FEEDBACK_STORAGE_PREFIX = "feedback-";
const FEEDBACK_TOOLBAR_KEYS = new Set([
  "feedback-toolbar-settings",
  "feedback-toolbar-theme",
  "feedback-toolbar-position",
]);

function isQuotaExceededError(error: unknown) {
  return (
    error instanceof DOMException &&
    (error.name === "QuotaExceededError" ||
      error.name === "NS_ERROR_DOM_QUOTA_REACHED")
  );
}

function installFeedbackStorageGuard() {
  if (typeof window === "undefined" || typeof Storage === "undefined") {
    return () => undefined;
  }

  const originalSetItem = Storage.prototype.setItem;

  const guardedSetItem: typeof Storage.prototype.setItem = function (key, value) {
    if (!key.startsWith(FEEDBACK_STORAGE_PREFIX)) {
      return originalSetItem.call(this, key, value);
    }

    try {
      return originalSetItem.call(this, key, value);
    } catch (error) {
      if (!isQuotaExceededError(error) || this !== window.localStorage) {
        throw error;
      }

      try {
        if (FEEDBACK_TOOLBAR_KEYS.has(key)) {
          window.localStorage.removeItem(key);
          return originalSetItem.call(this, key, value);
        }
      } catch {
        // Fall through and disable persistence for Agentation when storage is full.
      }

      return undefined;
    }
  };

  Storage.prototype.setItem = guardedSetItem;

  return () => {
    if (Storage.prototype.setItem === guardedSetItem) {
      Storage.prototype.setItem = originalSetItem;
    }
  };
}

const Agentation = dynamic(
  () => import("agentation").then(m => ({ default: m.Agentation })),
  { ssr: false },
);

export default function DevAgentation() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;

    const restoreStorageGuard = installFeedbackStorageGuard();

    try {
      const val = localStorage.getItem("feedback-toolbar-settings");
      if (val && val.length > 512_000) {
        localStorage.removeItem("feedback-toolbar-settings");
      }
    } catch {
      localStorage.removeItem("feedback-toolbar-settings");
    }

    setReady(true);

    return restoreStorageGuard;
  }, []);

  if (process.env.NODE_ENV !== "development" || !ready) return null;
  return <Agentation />;
}
