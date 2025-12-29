"use client";

import { useEffect, useState } from "react";
import { AlertCircle, X } from "lucide-react";

interface ErrorToastProps {
  message: string;
  onClose: () => void;
  duration?: number;
}

export default function ErrorToast({
  message,
  onClose,
  duration = 5000,
}: ErrorToastProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 300); // Wait for fade out animation
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  return (
    <div
      className={`fixed bottom-4 right-4 z-50 max-w-sm bg-red-50 border border-red-200 rounded-lg shadow-lg p-4 transition-all duration-300 ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
      }`}
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-medium text-red-900">Error</p>
          <p className="text-sm text-red-700 mt-1">{message}</p>
        </div>
        <button
          onClick={() => {
            setIsVisible(false);
            setTimeout(onClose, 300);
          }}
          className="text-red-600 hover:text-red-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
