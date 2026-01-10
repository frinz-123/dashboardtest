"use client";

import { Search, X, Sparkles } from "lucide-react";
import { useState, useRef, useEffect } from "react";

type SearchInputProps = {
  value: string;
  onChange: (value: string) => void;
  onClear?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
  showSparkles?: boolean;
};

export default function SearchInput({
  value,
  onChange,
  onClear,
  placeholder = "Buscar cliente...",
  autoFocus = false,
  showSparkles = false,
}: SearchInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      if (value) {
        onChange("");
        onClear?.();
      } else {
        inputRef.current?.blur();
      }
    }
  };

  return (
    <div className="relative group">
      <div
        className={`
          absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none
          transition-all duration-200
          ${isFocused ? "text-blue-500" : "text-gray-400"}
        `}
      >
        {showSparkles && !value ? (
          <Sparkles size={16} className="animate-pulse" />
        ) : (
          <Search size={16} strokeWidth={2} />
        )}
      </div>
      <input
        ref={inputRef}
        className={`
          w-full min-h-[44px] py-3 pl-10 pr-10 text-base
          bg-white border rounded-xl
          transition-all duration-200 ease-out
          placeholder:text-gray-400
          hover:border-gray-300 hover:bg-gray-50/50
          focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500
          disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed
        `}
        placeholder={placeholder}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        onKeyDown={handleKeyDown}
        autoComplete="off"
        autoCorrect="off"
      />
      {value && (
        <button
          onClick={() => {
            onChange("");
            onClear?.();
          }}
          className="absolute inset-y-0 right-9 flex items-center pr-2 group/clear"
          type="button"
          aria-label="Limpiar búsqueda"
        >
          <span className="text-gray-300 group-hover/clear:text-gray-500 transition-colors">
            <X size={14} strokeWidth={2} />
          </span>
        </button>
      )}
      <div
        className={`
          absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none
          transition-all duration-200
          ${isFocused ? "text-blue-400" : "text-gray-300"}
        `}
      >
        <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-xs font-medium text-gray-400 bg-gray-100 rounded border border-gray-200">
          ⌘K
        </kbd>
      </div>
    </div>
  );
}
