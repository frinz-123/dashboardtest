"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { Input } from "./input";

interface SearchableSelectProps {
  options: { value: string; label: string }[];
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
}

export function SearchableSelect({
  options,
  value,
  onValueChange,
  placeholder = "Seleccionar...",
}: SearchableSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");

  const filteredOptions = React.useMemo(() => {
    if (!searchQuery) return options;
    return options.filter((option) =>
      option.label.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [options, searchQuery]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between text-base"
        >
          {value
            ? options.find((option) => option.value === value)?.label
            : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-screen p-4 sm:w-[var(--radix-popover-trigger-width)] mt-16">
        <div className="relative mb-3">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 text-base min-h-[44px]"
            style={{ fontSize: "16px" }}
          />
        </div>
        <div className="max-h-[300px] overflow-y-auto">
          {filteredOptions.length === 0 ? (
            <div className="text-sm text-center py-2 text-muted-foreground">
              No se encontraron resultados
            </div>
          ) : (
            filteredOptions.map((option) => (
              <div
                key={option.value}
                className={cn(
                  "flex items-center gap-2 px-2 py-3 text-base cursor-pointer hover:bg-accent rounded-md min-h-[44px]",
                  value === option.value && "bg-accent",
                )}
                style={{ fontSize: "16px" }}
                onClick={() => {
                  onValueChange(option.value);
                  setOpen(false);
                  setSearchQuery("");
                }}
              >
                <Check
                  className={cn(
                    "h-4 w-4",
                    value === option.value ? "opacity-100" : "opacity-0",
                  )}
                />
                {option.label}
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
