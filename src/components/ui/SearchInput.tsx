"use client";

import { Search, X } from "lucide-react";

type SearchInputProps = {
  value: string;
  onChange: (value: string) => void;
  onClear?: () => void;
  placeholder?: string;
};

export default function SearchInput({
  value,
  onChange,
  onClear,
  placeholder = "Buscar...",
}: SearchInputProps) {
  return (
    <div className="relative">
      <input
        className="w-full py-2 pl-9 pr-9 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        placeholder={placeholder}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ fontSize: "16px" }}
      />
      <div className="pointer-events-none absolute inset-y-0 start-0 flex items-center justify-center ps-3 text-gray-400">
        <Search size={16} strokeWidth={2} />
      </div>
      {value && (
        <button
          onClick={onClear}
          className="absolute inset-y-0 right-0 flex items-center pr-3"
          type="button"
        >
          <X size={16} className="text-gray-400 hover:text-gray-600" />
        </button>
      )}
    </div>
  );
}
