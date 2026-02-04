"use client";

import { ChevronDown, Eye, Users } from "lucide-react";
import React from "react";
import { getVendorLabel } from "@/utils/auth";

interface VendorOption {
  email: string;
  label: string;
  clientCount?: number;
}

interface VendorSelectorProps {
  currentVendor: string | null;
  vendors: VendorOption[];
  onVendorChange: (vendorEmail: string | null) => void;
  isVisible: boolean;
}

export default function VendorSelector({
  currentVendor,
  vendors,
  onVendorChange,
  isVisible,
}: VendorSelectorProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  if (!isVisible) return null;

  const currentVendorLabel = currentVendor
    ? getVendorLabel(currentVendor)
    : "Todas las Rutas";
  const currentVendorData = vendors.find((v) => v.email === currentVendor);

  return (
    <div className="bg-blue-50 rounded-lg p-3 mb-4 border border-blue-200">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center">
          <Eye className="h-4 w-4 text-blue-600 mr-2" />
          <span className="text-sm font-medium text-blue-800">
            Cuenta Maestra
          </span>
        </div>
        <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded-full">
          Acceso Total
        </span>
      </div>

      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between bg-white border border-blue-200 rounded-lg px-3 py-2 text-sm hover:bg-blue-50 transition-colors"
        >
          <div className="flex items-center">
            <Users className="h-4 w-4 text-blue-600 mr-2" />
            <div className="text-left">
              <div className="font-medium text-gray-900">
                Viendo: {currentVendorLabel}
              </div>
              {currentVendorData?.clientCount !== undefined && (
                <div className="text-xs text-gray-500">
                  {currentVendorData.clientCount} clientes
                </div>
              )}
            </div>
          </div>
          <ChevronDown
            className={`h-4 w-4 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
          />
        </button>

        {isOpen && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
            <div className="py-1">
              <button
                onClick={() => {
                  onVendorChange(null);
                  setIsOpen(false);
                }}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 transition-colors ${
                  !currentVendor
                    ? "bg-blue-50 text-blue-700 font-medium"
                    : "text-gray-700"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">Todas las Rutas</div>
                    <div className="text-xs text-gray-500">Vista global</div>
                  </div>
                  {!currentVendor && (
                    <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                  )}
                </div>
              </button>

              <div className="border-t border-gray-100 my-1"></div>

              {vendors.map((vendor) => (
                <button
                  key={vendor.email}
                  onClick={() => {
                    onVendorChange(vendor.email);
                    setIsOpen(false);
                  }}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 transition-colors ${
                    currentVendor === vendor.email
                      ? "bg-blue-50 text-blue-700 font-medium"
                      : "text-gray-700"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{vendor.label}</div>
                      <div className="text-xs text-gray-500">
                        {vendor.email}
                      </div>
                      {vendor.clientCount !== undefined && (
                        <div className="text-xs text-gray-400">
                          {vendor.clientCount} clientes
                        </div>
                      )}
                    </div>
                    {currentVendor === vendor.email && (
                      <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="text-xs text-blue-600 mt-2 text-center">
        Puedes ver y gestionar todas las rutas como cuenta maestra
      </div>
    </div>
  );
}
