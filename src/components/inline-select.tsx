"use client";

import * as React from "react";
import { Globe, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface InlineSelectOption {
  value: string;
  label: string;
}

interface InlineSelectInputProps {
  options: InlineSelectOption[];
  defaultValue?: string;
  placeholder?: string;
}

export function InlineSelectInput({
  options,
  defaultValue = options[0]?.value,
  placeholder = "Placeholder text...",
}: InlineSelectInputProps) {
  return (
    <div className="relative w-full max-w-[300px]">
      <div className="relative flex items-center">
        <User className="absolute left-2 h-4 w-4 text-gray-500" />
        <Input className="pl-8 pr-[100px]" placeholder={placeholder} />
        <div className="absolute right-0 h-full">
          <Select defaultValue={defaultValue}>
            <SelectTrigger className="h-full border-0 bg-transparent px-2 hover:bg-transparent focus:ring-0">
              <Globe className="mr-2 h-4 w-4 text-gray-500" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {options.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
