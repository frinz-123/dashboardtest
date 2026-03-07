"use client";

import { ShoppingCart } from "lucide-react";
import dynamic from "next/dynamic";
import { useSession } from "next-auth/react";
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import AppHeader from "@/components/AppHeader";
import CleyPhotoCapture, {
  type CleyPhotoPreview,
} from "@/components/CleyPhotoCapture";
import CleyOrderQuestion from "@/components/comp-166";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import LabelNumbers from "@/components/ui/labelnumbers";
import PendingOrdersBanner from "@/components/ui/PendingOrdersBanner";
import SearchInput from "@/components/ui/SearchInput";
import {
  ClientSearchSkeleton,
  MapSkeleton,
  ProductListSkeleton,
} from "@/components/ui/SkeletonLoader";
import Toast, { useToast } from "@/components/ui/Toast";
import { useOrderSubmitMutation } from "@/hooks/useOrderSubmitMutation";
import { useSubmissionQueue } from "@/hooks/useSubmissionQueue";
import { getCurrentPeriodInfo } from "@/utils/dateUtils";
import {
  FORM_OVERRIDE_EMAILS,
  isFormAdminEmail,
  isPhotoRequiredClientCode,
  PHOTO_MAX,
  PHOTO_MAX_DIMENSION,
  PHOTO_MIN_REQUIRED,
  PHOTO_QUALITY,
} from "@/utils/formSubmission";
import { haptics } from "@/utils/haptics";
import { compressImageFile } from "@/utils/photoCompression";
import { deletePhotos, savePhoto } from "@/utils/photoStore";

// Lazy load Map component to reduce initial bundle size
const ClientMap = dynamic(() => import("@/components/ui/Map"), {
  ssr: false,
  loading: () => <MapSkeleton />,
});

const googleApiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
const spreadsheetId = process.env.NEXT_PUBLIC_SPREADSHEET_ID;
const sheetName = process.env.NEXT_PUBLIC_SHEET_NAME;

// Email labels for vendor selection (matching dashboard labels)
const EMAIL_LABELS: Record<string, string> = {
  "ventas1productoselrey@gmail.com": "Christian",
  "ventas2productoselrey@gmail.com": "Roel",
  "ventas3productoselrey@gmail.com": "Lidia",
  "ventasmztproductoselrey.com@gmail.com": "Mazatlan",
  "ventasmochisproductoselrey@gmail.com": "Mochis",
  "franzcharbell@gmail.com": "Franz",
  "cesar.reyes.ochoa@gmail.com": "Cesar",
  "arturo.elreychiltepin@gmail.com": "Arturo Mty",
  "alopezelrey@gmail.com": "Arlyn",
  "promotoriaelrey@gmail.com": "Karla",
  "ventas4productoselrey@gmail.com": "Reyna",
  "bodegaelrey034@gmail.com": "Bodega",
  "ventas1elrey@gmail.com": "Ventas1",
};

const SPECIAL_SELLERS = [
  "ventasmztproductoselrey.com@gmail.com", // Mazatlan
  "ventasmochisproductoselrey@gmail.com", // Mochis
];

// Static list defined once to avoid re-allocating on every render
const PRODUCTS: string[] = [
  "Chiltepin Molido 50 g",
  "Chiltepin Molido 20 g",
  "Chiltepin Entero 30 g",
  "Salsa Chiltepin El rey 195 ml",
  "Salsa Especial El Rey 195 ml",
  "Salsa Reina El rey 195 ml",
  "Salsa Habanera El Rey 195 ml",
  "Paquete El Rey",
  "Molinillo El Rey 30 g",
  "Tira Entero",
  "Tira Molido",
  "Salsa chiltepin Litro",
  "Salsa Especial Litro",
  "Salsa Reina Litro",
  "Salsa Habanera Litro",
  "Michela Mix Tamarindo",
  "Michela Mix Mango",
  "Michela Mix Sandia",
  "Michela Mix Fuego",
  "Michela Mix Picafresa",
  "El Rey Mix Original",
  "El Rey Mix Especial",
  "Medio Kilo Chiltepin Entero",
  "Habanero Molido 50 g",
  "Habanero Molido 20 g",
  "Molinillo Habanero 20 g",
];

const MIN_MOVEMENT_THRESHOLD = 5; // Align with map for precise updates
const MAX_CLIENT_DISTANCE = 450; // Maximum allowed distance to client in meters
const ARCHIVE_MARKER = "archivado no usar";

type SearchableClient = {
  name: string;
  normalizedName: string;
};

const SEARCH_DEBOUNCE_MS = 220;
const MAX_SEARCH_RESULTS = 20;

function normalizeText(value: string): string {
  if (!value) return "";
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\u00ad/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

const NORMALIZED_ARCHIVE_MARKER = normalizeText(ARCHIVE_MARKER);

function getClientCode(clientName: string): string {
  if (!clientName) return "EFT";

  const codeMap: Record<string, string> = {
    "la mera": "lamera",
    kook: "bekook",
    oxxo: "oxx",
    ley: "cley",
    MM: "MM",
    mayorista: "MM",
    merka: "merkahorro",
    varela: "frutvarela",
    "2 box": "CRED",
    "2box": "CRED",
    valdez: "CRED",
    izagar: "izag",
    teresita: "tere",
    teka: "tere",
    teca: "tere",
    kiosko: "kiosk",
    carnencanto: "encanto",
    beltran: "beltr",
    facil: "sfacil",
    service: "foods",
    distribucentro: "dbcentro",
    servicom: "caseta",
    chata: "chata",
    memin: "memin",
    querida: "queri",
    merza: "merz",
    "Cedis Up": "CRED",
    "AND FINAL": "smart",
    WALMART: "wm",
  };

  for (const [key, code] of Object.entries(codeMap)) {
    if (clientName.toLowerCase().includes(key.toLowerCase())) {
      return code;
    }
  }

  return "EFT";
}

type ProductPrices = {
  [key: string]: {
    [product: string]: number;
  };
};

const PRICES: ProductPrices = {
  EFT: {
    "Chiltepin Molido 50 g": 48,
    "Chiltepin Molido 20 g": 24,
    "Chiltepin Entero 30 g": 45,
    "Salsa Chiltepin El rey 195 ml": 16,
    "Salsa Especial El Rey 195 ml": 16,
    "Salsa Reina El rey 195 ml": 16,
    "Salsa Habanera El Rey 195 ml": 16,
    "Paquete El Rey": 100,
    "Molinillo El Rey 30 g": 90,
    "Tira Entero": 60,
    "Tira Molido": 55,
    "Salsa chiltepin Litro": 50,
    "Salsa Especial Litro": 50,
    "Salsa Reina Litro": 50,
    "Salsa Habanera Litro": 50,
    "Michela Mix Tamarindo": 30,
    "Michela Mix Mango": 30,
    "Michela Mix Sandia": 30,
    "Michela Mix Fuego": 30,
    "Michela Mix Picafresa": 30,
    "El Rey Mix Original": 60,
    "El Rey Mix Especial": 60,
    "Habanero Molido 50 g": 40,
    "Habanero Molido 20 g": 20,
    "Medio Kilo Chiltepin Entero": 500,
    "Molinillo Habanero 20 g": 75,
  },
  CLEY: {
    "Chiltepin Molido 50 g": 44.16,
    "Chiltepin Molido 20 g": 22.08,
    "Chiltepin Entero 30 g": 46,
    "Salsa Chiltepin El rey 195 ml": 15,
    "Salsa Especial El Rey 195 ml": 15,
    "Salsa Reina El rey 195 ml": 15,
    "Salsa Habanera El Rey 195 ml": 15,
    "Paquete El Rey": 100,
    "Molinillo El Rey 30 g": 82.8,
    "Tira Entero": 60,
    "Tira Molido": 55,
    "Salsa chiltepin Litro": 46,
    "Salsa Especial Litro": 46,
    "Salsa Reina Litro": 46,
    "Salsa Habanera Litro": 46,
    "Michela Mix Tamarindo": 30,
    "Michela Mix Mango": 30,
    "Michela Mix Sandia": 30,
    "Michela Mix Fuego": 30,
    "Michela Mix Picafresa": 30,
    "El Rey Mix Original": 60,
    "El Rey Mix Especial": 60,
    "Habanero Molido 50 g": 40,
    "Habanero Molido 20 g": 20,
    "Medio Kilo Chiltepin Entero": 500,
    "Molinillo Habanero 20 g": 75,
  },
  TERE: {
    "Chiltepin Molido 50 g": 45,
    "Chiltepin Molido 20 g": 22.5,
    "Chiltepin Entero 30 g": 40,
    "Salsa Chiltepin El rey 195 ml": 16,
    "Salsa Especial El Rey 195 ml": 16,
    "Salsa Reina El rey 195 ml": 16,
    "Salsa Habanera El Rey 195 ml": 16,
    "Paquete El Rey": 100,
    "Molinillo El Rey 30 g": 90,
    "Tira Entero": 60,
    "Tira Molido": 55,
    "Salsa chiltepin Litro": 43,
    "Salsa Especial Litro": 43,
    "Salsa Reina Litro": 43,
    "Salsa Habanera Litro": 43,
    "Michela Mix Tamarindo": 30,
    "Michela Mix Mango": 30,
    "Michela Mix Sandia": 30,
    "Michela Mix Fuego": 30,
    "Michela Mix Picafresa": 30,
    "El Rey Mix Original": 60,
    "El Rey Mix Especial": 60,
    "Habanero Molido 50 g": 40,
    "Habanero Molido 20 g": 20,
    "Medio Kilo Chiltepin Entero": 500,
    "Molinillo Habanero 20 g": 75,
  },
  BEKOOK: {
    "Chiltepin Molido 50 g": 48,
    "Chiltepin Molido 20 g": 24,
    "Chiltepin Entero 30 g": 45,
    "Salsa Chiltepin El rey 195 ml": 16,
    "Salsa Especial El Rey 195 ml": 16,
    "Salsa Reina El rey 195 ml": 16,
    "Salsa Habanera El Rey 195 ml": 16,
    "Paquete El Rey": 100,
    "Molinillo El Rey 30 g": 90,
    "Tira Entero": 60,
    "Tira Molido": 55,
    "Salsa chiltepin Litro": 50,
    "Salsa Especial Litro": 50,
    "Salsa Reina Litro": 50,
    "Salsa Habanera Litro": 50,
    "Michela Mix Tamarindo": 30,
    "Michela Mix Mango": 30,
    "Michela Mix Sandia": 30,
    "Michela Mix Fuego": 30,
    "Michela Mix Picafresa": 30,
    "El Rey Mix Original": 60,
    "El Rey Mix Especial": 60,
    "Habanero Molido 50 g": 40,
    "Habanero Molido 20 g": 20,
    "Medio Kilo Chiltepin Entero": 500,
    "Molinillo Habanero 20 g": 75,
  },
  OXX: {
    "Chiltepin Molido 50 g": 44.1,
    "Chiltepin Molido 20 g": 22.5,
    "Chiltepin Entero 30 g": 45,
    "Salsa Chiltepin El rey 195 ml": 15.68,
    "Salsa Especial El Rey 195 ml": 15.68,
    "Salsa Reina El rey 195 ml": 15.68,
    "Salsa Habanera El Rey 195 ml": 15.68,
    "Paquete El Rey": 100,
    "Molinillo El Rey 30 g": 90,
    "Tira Entero": 58.8,
    "Tira Molido": 55,
    "Salsa chiltepin Litro": 40,
    "Salsa Especial Litro": 40,
    "Salsa Reina Litro": 40,
    "Salsa Habanera Litro": 40,
    "Michela Mix Tamarindo": 30,
    "Michela Mix Mango": 30,
    "Michela Mix Sandia": 30,
    "Michela Mix Fuego": 30,
    "Michela Mix Picafresa": 30,
    "El Rey Mix Original": 60,
    "El Rey Mix Especial": 60,
    "Habanero Molido 50 g": 40,
    "Habanero Molido 20 g": 20,
    "Medio Kilo Chiltepin Entero": 500,
    "Molinillo Habanero 20 g": 75,
  },
  LAMERA: {
    "Chiltepin Molido 50 g": 48,
    "Chiltepin Molido 20 g": 24,
    "Chiltepin Entero 30 g": 45,
    "Salsa Chiltepin El rey 195 ml": 16,
    "Salsa Especial El Rey 195 ml": 16,
    "Salsa Reina El rey 195 ml": 16,
    "Salsa Habanera El Rey 195 ml": 16,
    "Paquete El Rey": 100,
    "Molinillo El Rey 30 g": 90,
    "Tira Entero": 60,
    "Tira Molido": 55,
    "Salsa chiltepin Litro": 50,
    "Salsa Especial Litro": 50,
    "Salsa Reina Litro": 50,
    "Salsa Habanera Litro": 50,
    "Michela Mix Tamarindo": 30,
    "Michela Mix Mango": 30,
    "Michela Mix Sandia": 30,
    "Michela Mix Fuego": 30,
    "Michela Mix Picafresa": 30,
    "El Rey Mix Original": 60,
    "El Rey Mix Especial": 60,
    "Habanero Molido 50 g": 40,
    "Habanero Molido 20 g": 20,
    "Medio Kilo Chiltepin Entero": 500,
    "Molinillo Habanero 20 g": 75,
  },
  MM: {
    "Chiltepin Molido 50 g": 45,
    "Chiltepin Molido 20 g": 22.5,
    "Chiltepin Entero 30 g": 40,
    "Salsa Chiltepin El rey 195 ml": 14.5,
    "Salsa Especial El Rey 195 ml": 14.5,
    "Salsa Reina El rey 195 ml": 14.5,
    "Salsa Habanera El Rey 195 ml": 14.5,
    "Paquete El Rey": 100,
    "Molinillo El Rey 30 g": 85,
    "Tira Entero": 60,
    "Tira Molido": 55,
    "Salsa chiltepin Litro": 40,
    "Salsa Especial Litro": 40,
    "Salsa Reina Litro": 40,
    "Salsa Habanera Litro": 40,
    "Michela Mix Tamarindo": 30,
    "Michela Mix Mango": 30,
    "Michela Mix Sandia": 30,
    "Michela Mix Fuego": 30,
    "Michela Mix Picafresa": 30,
    "El Rey Mix Original": 60,
    "El Rey Mix Especial": 60,
    "Habanero Molido 50 g": 40,
    "Habanero Molido 20 g": 20,
    "Medio Kilo Chiltepin Entero": 500,
    "Molinillo Habanero 20 g": 75,
  },
  FRUTVARELA: {
    "Chiltepin Molido 50 g": 48,
    "Chiltepin Molido 20 g": 24,
    "Chiltepin Entero 30 g": 45,
    "Salsa Chiltepin El rey 195 ml": 16,
    "Salsa Especial El Rey 195 ml": 16,
    "Salsa Reina El rey 195 ml": 16,
    "Salsa Habanera El Rey 195 ml": 16,
    "Paquete El Rey": 100,
    "Molinillo El Rey 30 g": 90,
    "Tira Entero": 60,
    "Tira Molido": 55,
    "Salsa chiltepin Litro": 50,
    "Salsa Especial Litro": 50,
    "Salsa Reina Litro": 50,
    "Salsa Habanera Litro": 50,
    "Michela Mix Tamarindo": 30,
    "Michela Mix Mango": 30,
    "Michela Mix Sandia": 30,
    "Michela Mix Fuego": 30,
    "Michela Mix Picafresa": 30,
    "El Rey Mix Original": 60,
    "El Rey Mix Especial": 60,
    "Habanero Molido 50 g": 40,
    "Habanero Molido 20 g": 20,
    "Medio Kilo Chiltepin Entero": 500,
    "Molinillo Habanero 20 g": 75,
  },
  IZAG: {
    "Chiltepin Molido 50 g": 48,
    "Chiltepin Molido 20 g": 24,
    "Chiltepin Entero 30 g": 45,
    "Salsa Chiltepin El rey 195 ml": 16,
    "Salsa Especial El Rey 195 ml": 16,
    "Salsa Reina El rey 195 ml": 16,
    "Salsa Habanera El Rey 195 ml": 16,
    "Paquete El Rey": 100,
    "Molinillo El Rey 30 g": 90,
    "Tira Entero": 60,
    "Tira Molido": 55,
    "Salsa chiltepin Litro": 50,
    "Salsa Especial Litro": 50,
    "Salsa Reina Litro": 50,
    "Salsa Habanera Litro": 50,
    "Michela Mix Tamarindo": 30,
    "Michela Mix Mango": 30,
    "Michela Mix Sandia": 30,
    "Michela Mix Fuego": 30,
    "Michela Mix Picafresa": 30,
    "El Rey Mix Original": 60,
    "El Rey Mix Especial": 60,
    "Habanero Molido 50 g": 40,
    "Habanero Molido 20 g": 20,
    "Medio Kilo Chiltepin Entero": 500,
    "Molinillo Habanero 20 g": 75,
  },
  ENCANTO: {
    "Chiltepin Molido 50 g": 48,
    "Chiltepin Molido 20 g": 24,
    "Chiltepin Entero 30 g": 45,
    "Salsa Chiltepin El rey 195 ml": 16,
    "Salsa Especial El Rey 195 ml": 16,
    "Salsa Reina El rey 195 ml": 16,
    "Salsa Habanera El Rey 195 ml": 16,
    "Paquete El Rey": 100,
    "Molinillo El Rey 30 g": 90,
    "Tira Entero": 60,
    "Tira Molido": 55,
    "Salsa chiltepin Litro": 50,
    "Salsa Especial Litro": 50,
    "Salsa Reina Litro": 50,
    "Salsa Habanera Litro": 50,
    "Michela Mix Tamarindo": 30,
    "Michela Mix Mango": 30,
    "Michela Mix Sandia": 30,
    "Michela Mix Fuego": 30,
    "Michela Mix Picafresa": 30,
    "El Rey Mix Original": 60,
    "El Rey Mix Especial": 60,
    "Habanero Molido 50 g": 40,
    "Habanero Molido 20 g": 20,
    "Medio Kilo Chiltepin Entero": 500,
    "Molinillo Habanero 20 g": 75,
  },
  BELTR: {
    "Chiltepin Molido 50 g": 48,
    "Chiltepin Molido 20 g": 24,
    "Chiltepin Entero 30 g": 45,
    "Salsa Chiltepin El rey 195 ml": 16,
    "Salsa Especial El Rey 195 ml": 16,
    "Salsa Reina El rey 195 ml": 16,
    "Salsa Habanera El Rey 195 ml": 16,
    "Paquete El Rey": 100,
    "Molinillo El Rey 30 g": 90,
    "Tira Entero": 60,
    "Tira Molido": 55,
    "Salsa chiltepin Litro": 50,
    "Salsa Especial Litro": 50,
    "Salsa Reina Litro": 50,
    "Salsa Habanera Litro": 50,
    "Michela Mix Tamarindo": 30,
    "Michela Mix Mango": 30,
    "Michela Mix Sandia": 30,
    "Michela Mix Fuego": 30,
    "Michela Mix Picafresa": 30,
    "El Rey Mix Original": 60,
    "El Rey Mix Especial": 60,
    "Habanero Molido 50 g": 40,
    "Habanero Molido 20 g": 20,
    "Medio Kilo Chiltepin Entero": 500,
    "Molinillo Habanero 20 g": 75,
  },
  SFACIL: {
    "Chiltepin Molido 50 g": 48,
    "Chiltepin Molido 20 g": 24,
    "Chiltepin Entero 30 g": 45,
    "Salsa Chiltepin El rey 195 ml": 16,
    "Salsa Especial El Rey 195 ml": 16,
    "Salsa Reina El rey 195 ml": 16,
    "Salsa Habanera El Rey 195 ml": 16,
    "Paquete El Rey": 100,
    "Molinillo El Rey 30 g": 90,
    "Tira Entero": 60,
    "Tira Molido": 55,
    "Salsa chiltepin Litro": 50,
    "Salsa Especial Litro": 50,
    "Salsa Reina Litro": 50,
    "Salsa Habanera Litro": 50,
    "Michela Mix Tamarindo": 30,
    "Michela Mix Mango": 30,
    "Michela Mix Sandia": 30,
    "Michela Mix Fuego": 30,
    "Michela Mix Picafresa": 30,
    "El Rey Mix Original": 60,
    "El Rey Mix Especial": 60,
    "Habanero Molido 50 g": 40,
    "Habanero Molido 20 g": 20,
    "Medio Kilo Chiltepin Entero": 500,
    "Molinillo Habanero 20 g": 75,
  },
  FOODS: {
    "Chiltepin Molido 50 g": 48,
    "Chiltepin Molido 20 g": 24,
    "Chiltepin Entero 30 g": 45,
    "Salsa Chiltepin El rey 195 ml": 16,
    "Salsa Especial El Rey 195 ml": 16,
    "Salsa Reina El rey 195 ml": 16,
    "Salsa Habanera El Rey 195 ml": 16,
    "Paquete El Rey": 100,
    "Molinillo El Rey 30 g": 90,
    "Tira Entero": 60,
    "Tira Molido": 55,
    "Salsa chiltepin Litro": 50,
    "Salsa Especial Litro": 50,
    "Salsa Reina Litro": 50,
    "Salsa Habanera Litro": 50,
    "Michela Mix Tamarindo": 30,
    "Michela Mix Mango": 30,
    "Michela Mix Sandia": 30,
    "Michela Mix Fuego": 30,
    "Michela Mix Picafresa": 30,
    "El Rey Mix Original": 60,
    "El Rey Mix Especial": 60,
    "Habanero Molido 50 g": 40,
    "Habanero Molido 20 g": 20,
    "Medio Kilo Chiltepin Entero": 500,
    "Molinillo Habanero 20 g": 75,
  },
  DBCENTRO: {
    "Chiltepin Molido 50 g": 48,
    "Chiltepin Molido 20 g": 24,
    "Chiltepin Entero 30 g": 45,
    "Salsa Chiltepin El rey 195 ml": 15,
    "Salsa Especial El Rey 195 ml": 15,
    "Salsa Reina El rey 195 ml": 15,
    "Salsa Habanera El Rey 195 ml": 15,
    "Paquete El Rey": 100,
    "Molinillo El Rey 30 g": 90,
    "Tira Entero": 60,
    "Tira Molido": 55,
    "Salsa chiltepin Litro": 40,
    "Salsa Especial Litro": 40,
    "Salsa Reina Litro": 40,
    "Salsa Habanera Litro": 40,
    "Michela Mix Tamarindo": 30,
    "Michela Mix Mango": 30,
    "Michela Mix Sandia": 30,
    "Michela Mix Fuego": 30,
    "Michela Mix Picafresa": 30,
    "El Rey Mix Original": 60,
    "El Rey Mix Especial": 60,
    "Habanero Molido 50 g": 40,
    "Habanero Molido 20 g": 20,
    "Medio Kilo Chiltepin Entero": 500,
    "Molinillo Habanero 20 g": 75,
  },
  CASETA: {
    "Chiltepin Molido 50 g": 48,
    "Chiltepin Molido 20 g": 24,
    "Chiltepin Entero 30 g": 45,
    "Salsa Chiltepin El rey 195 ml": 16,
    "Salsa Especial El Rey 195 ml": 16,
    "Salsa Reina El rey 195 ml": 16,
    "Salsa Habanera El Rey 195 ml": 16,
    "Paquete El Rey": 100,
    "Molinillo El Rey 30 g": 90,
    "Tira Entero": 60,
    "Tira Molido": 55,
    "Salsa chiltepin Litro": 50,
    "Salsa Especial Litro": 50,
    "Salsa Reina Litro": 50,
    "Salsa Habanera Litro": 50,
    "Michela Mix Tamarindo": 30,
    "Michela Mix Mango": 30,
    "Michela Mix Sandia": 30,
    "Michela Mix Fuego": 30,
    "Michela Mix Picafresa": 30,
    "El Rey Mix Original": 60,
    "El Rey Mix Especial": 60,
    "Habanero Molido 50 g": 40,
    "Habanero Molido 20 g": 20,
    "Medio Kilo Chiltepin Entero": 500,
    "Molinillo Habanero 20 g": 75,
  },
  KIOSK: {
    "Chiltepin Molido 50 g": 48,
    "Chiltepin Molido 20 g": 24,
    "Chiltepin Entero 30 g": 45,
    "Salsa Chiltepin El rey 195 ml": 16,
    "Salsa Especial El Rey 195 ml": 16,
    "Salsa Reina El rey 195 ml": 16,
    "Salsa Habanera El Rey 195 ml": 16,
    "Paquete El Rey": 100,
    "Molinillo El Rey 30 g": 90,
    "Tira Entero": 60,
    "Tira Molido": 55,
    "Salsa chiltepin Litro": 50,
    "Salsa Especial Litro": 50,
    "Salsa Reina Litro": 50,
    "Salsa Habanera Litro": 50,
    "Michela Mix Tamarindo": 30,
    "Michela Mix Mango": 30,
    "Michela Mix Sandia": 30,
    "Michela Mix Fuego": 30,
    "Michela Mix Picafresa": 30,
    "El Rey Mix Original": 60,
    "El Rey Mix Especial": 60,
    "Habanero Molido 50 g": 40,
    "Habanero Molido 20 g": 20,
    "Medio Kilo Chiltepin Entero": 500,
    "Molinillo Habanero 20 g": 75,
  },
  MERKAHORRO: {
    "Chiltepin Molido 50 g": 45,
    "Chiltepin Molido 20 g": 22.5,
    "Chiltepin Entero 30 g": 40,
    "Salsa Chiltepin El rey 195 ml": 15,
    "Salsa Especial El Rey 195 ml": 15,
    "Salsa Reina El rey 195 ml": 15,
    "Salsa Habanera El Rey 195 ml": 15,
    "Paquete El Rey": 100,
    "Molinillo El Rey 30 g": 90,
    "Tira Entero": 60,
    "Tira Molido": 55,
    "Salsa chiltepin Litro": 45,
    "Salsa Especial Litro": 45,
    "Salsa Reina Litro": 45,
    "Salsa Habanera Litro": 45,
    "Michela Mix Tamarindo": 30,
    "Michela Mix Mango": 30,
    "Michela Mix Sandia": 30,
    "Michela Mix Fuego": 30,
    "Michela Mix Picafresa": 30,
    "El Rey Mix Original": 60,
    "El Rey Mix Especial": 60,
    "Habanero Molido 50 g": 40,
    "Habanero Molido 20 g": 20,
    "Medio Kilo Chiltepin Entero": 500,
    "Molinillo Habanero 20 g": 75,
  },
  CHATA: {
    "Chiltepin Molido 50 g": 50,
    "Chiltepin Molido 20 g": 25,
    "Chiltepin Entero 30 g": 45,
    "Salsa Chiltepin El rey 195 ml": 18,
    "Salsa Especial El Rey 195 ml": 18,
    "Salsa Reina El rey 195 ml": 18,
    "Salsa Habanera El Rey 195 ml": 18,
    "Paquete El Rey": 120,
    "Molinillo El Rey 30 g": 105,
    "Tira Entero": 90,
    "Tira Molido": 55,
    "Salsa chiltepin Litro": 50,
    "Salsa Especial Litro": 50,
    "Salsa Reina Litro": 50,
    "Salsa Habanera Litro": 50,
    "Michela Mix Tamarindo": 30,
    "Michela Mix Mango": 30,
    "Michela Mix Sandia": 30,
    "Michela Mix Fuego": 30,
    "Michela Mix Picafresa": 30,
    "El Rey Mix Original": 60,
    "El Rey Mix Especial": 60,
    "Habanero Molido 50 g": 40,
    "Habanero Molido 20 g": 20,
    "Medio Kilo Chiltepin Entero": 500,
    "Molinillo Habanero 20 g": 75,
  },
  MEMIN: {
    "Chiltepin Molido 50 g": 48,
    "Chiltepin Molido 20 g": 24,
    "Chiltepin Entero 30 g": 45,
    "Salsa Chiltepin El rey 195 ml": 13.6,
    "Salsa Especial El Rey 195 ml": 13.6,
    "Salsa Reina El rey 195 ml": 13.6,
    "Salsa Habanera El Rey 195 ml": 13.6,
    "Paquete El Rey": 100,
    "Molinillo El Rey 30 g": 90,
    "Tira Entero": 60,
    "Tira Molido": 55,
    "Salsa chiltepin Litro": 45,
    "Salsa Especial Litro": 45,
    "Salsa Reina Litro": 45,
    "Salsa Habanera Litro": 45,
    "Michela Mix Tamarindo": 30,
    "Michela Mix Mango": 30,
    "Michela Mix Sandia": 30,
    "Michela Mix Fuego": 30,
    "Michela Mix Picafresa": 30,
    "El Rey Mix Original": 60,
    "El Rey Mix Especial": 60,
    "Habanero Molido 50 g": 40,
    "Habanero Molido 20 g": 20,
    "Medio Kilo Chiltepin Entero": 500,
    "Molinillo Habanero 20 g": 75,
  },
  QUERI: {
    "Chiltepin Molido 50 g": 48,
    "Chiltepin Molido 20 g": 24,
    "Chiltepin Entero 30 g": 45,
    "Salsa Chiltepin El rey 195 ml": 16,
    "Salsa Especial El Rey 195 ml": 16,
    "Salsa Reina El rey 195 ml": 16,
    "Salsa Habanera El Rey 195 ml": 16,
    "Paquete El Rey": 100,
    "Molinillo El Rey 30 g": 90,
    "Tira Entero": 60,
    "Tira Molido": 55,
    "Salsa chiltepin Litro": 50,
    "Salsa Especial Litro": 50,
    "Salsa Reina Litro": 50,
    "Salsa Habanera Litro": 50,
    "Michela Mix Tamarindo": 30,
    "Michela Mix Mango": 30,
    "Michela Mix Sandia": 30,
    "Michela Mix Fuego": 30,
    "Michela Mix Picafresa": 30,
    "El Rey Mix Original": 60,
    "El Rey Mix Especial": 60,
    "Habanero Molido 50 g": 40,
    "Habanero Molido 20 g": 20,
    "Medio Kilo Chiltepin Entero": 500,
    "Molinillo Habanero 20 g": 75,
  },
  MERZ: {
    "Chiltepin Molido 50 g": 48,
    "Chiltepin Molido 20 g": 24,
    "Chiltepin Entero 30 g": 45,
    "Salsa Chiltepin El rey 195 ml": 16,
    "Salsa Especial El Rey 195 ml": 16,
    "Salsa Reina El rey 195 ml": 16,
    "Salsa Habanera El Rey 195 ml": 16,
    "Paquete El Rey": 100,
    "Molinillo El Rey 30 g": 90,
    "Tira Entero": 60,
    "Tira Molido": 55,
    "Salsa chiltepin Litro": 50,
    "Salsa Especial Litro": 50,
    "Salsa Reina Litro": 50,
    "Salsa Habanera Litro": 50,
    "Molinillo Habanero 20 g": 75,
  },
  CRED: {
    "Chiltepin Molido 50 g": 48,
    "Chiltepin Molido 20 g": 24,
    "Chiltepin Entero 30 g": 45,
    "Salsa Chiltepin El rey 195 ml": 16,
    "Salsa Especial El Rey 195 ml": 16,
    "Salsa Reina El rey 195 ml": 16,
    "Salsa Habanera El Rey 195 ml": 16,
    "Paquete El Rey": 100,
    "Molinillo El Rey 30 g": 90,
    "Tira Entero": 60,
    "Tira Molido": 55,
    "Salsa chiltepin Litro": 50,
    "Salsa Especial Litro": 50,
    "Salsa Reina Litro": 50,
    "Salsa Habanera Litro": 50,
    "Michela Mix Tamarindo": 30,
    "Michela Mix Mango": 30,
    "Michela Mix Sandia": 30,
    "Michela Mix Fuego": 30,
    "Michela Mix Picafresa": 30,
    "El Rey Mix Original": 60,
    "El Rey Mix Especial": 60,
    "Habanero Molido 50 g": 40,
    "Habanero Molido 20 g": 20,
    "Medio Kilo Chiltepin Entero": 500,
    "Molinillo Habanero 20 g": 75,
  },
  SMART: {
    "Chiltepin Molido 50 g": 52.2733333,
    "Chiltepin Molido 20 g": 26.14,
    "Chiltepin Entero 30 g": 49.955,
    "Salsa Chiltepin El rey 195 ml": 16,
    "Salsa Especial El Rey 195 ml": 16,
    "Salsa Reina El rey 195 ml": 16,
    "Salsa Habanera El Rey 195 ml": 16,
    "Paquete El Rey": 100,
    "Molinillo El Rey 30 g": 94.09,
    "Tira Entero": 60,
    "Tira Molido": 55,
    "Salsa chiltepin Litro": 50,
    "Salsa Especial Litro": 50,
    "Salsa Reina Litro": 50,
    "Salsa Habanera Litro": 50,
    "Michela Mix Tamarindo": 32,
    "Michela Mix Mango": 32,
    "Michela Mix Sandia": 32,
    "Michela Mix Fuego": 32,
    "Michela Mix Picafresa": 32,
    "El Rey Mix Original": 60,
    "El Rey Mix Especial": 60,
    "Habanero Molido 50 g": 40,
    "Habanero Molido 20 g": 20,
    "Medio Kilo Chiltepin Entero": 500,
    "Molinillo Habanero 20 g": 75,
  },
  WM: {
    "Chiltepin Molido 50 g": 48,
    "Chiltepin Molido 20 g": 24,
    "Chiltepin Entero 30 g": 50,
    "Salsa Chiltepin El rey 195 ml": 16,
    "Salsa Especial El Rey 195 ml": 16,
    "Salsa Reina El rey 195 ml": 16,
    "Salsa Habanera El Rey 195 ml": 16,
    "Paquete El Rey": 100,
    "Molinillo El Rey 30 g": 80,
    "Tira Entero": 60,
    "Tira Molido": 55,
    "Salsa chiltepin Litro": 50,
    "Salsa Especial Litro": 50,
    "Salsa Reina Litro": 50,
    "Salsa Habanera Litro": 50,
    "Michela Mix Tamarindo": 30,
    "Michela Mix Mango": 30,
    "Michela Mix Sandia": 30,
    "Michela Mix Fuego": 30,
    "Michela Mix Picafresa": 30,
    "El Rey Mix Original": 60,
    "El Rey Mix Especial": 60,
    "Habanero Molido 50 g": 42.5,
    "Habanero Molido 20 g": 20,
    "Medio Kilo Chiltepin Entero": 500,
    "Molinillo Habanero 20 g": 70,
  },
};

// Default to EFT prices if client code not found
// Default to EFT prices if client code not found
const getProductPrice = (
  clientCode: string,
  product: string,
  context?: { clientName?: string; sellerEmail?: string | null },
): number => {
  const normalizedCode = clientCode.toUpperCase();
  const priceList = PRICES[normalizedCode] || PRICES.EFT;

  // Logic Breaking Change: Special Pricing Rules for EFT
  if (normalizedCode === "EFT") {
    // 1. Special Price for "Karnemax Cedis" -> Michela Mix products @ $32
    if (
      context?.clientName &&
      normalizeText(context.clientName).includes("karnemax cedis")
    ) {
      if (product.startsWith("Michela Mix")) {
        return 32;
      }
    }

    // 2. Special Price for specific sellers (Mazatlan, Mochis) -> Tira Molido @ $60
    // Only applies if it's an EFT client (which we are already inside)
    if (context?.sellerEmail && SPECIAL_SELLERS.includes(context.sellerEmail)) {
      if (product === "Tira Molido") {
        return 60;
      }
    }
  }

  const price = priceList[product];

  // 🔍 LOG: Missing price detection
  if (price === undefined || price === 0) {
    console.warn("⚠️ PRICE ISSUE:", {
      clientCode: normalizedCode,
      product,
      price: price ?? "undefined",
      hasPriceList: !!PRICES[normalizedCode],
      availableProducts: priceList ? Object.keys(priceList).length : 0,
      timestamp: new Date().toISOString(),
    });
  }

  return price || 0;
};

// Update the calculateDistance function to be more precise
const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number => {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

function getClientDataCache(): {
  names: string[];
  locations: Record<string, { lat: number; lng: number }>;
} | null {
  try {
    const cached = localStorage.getItem("clientData");
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed?.names && parsed?.locations) return parsed;
    }
  } catch {}
  return null;
}

type ClientSearchFieldProps = {
  searchableClients: SearchableClient[];
  selectedClient: string;
  onSelectClient: (name: string) => void;
};

const ClientSearchField = memo(function ClientSearchField({
  searchableClients,
  selectedClient,
  onSelectClient,
}: ClientSearchFieldProps) {
  const [query, setQuery] = useState(selectedClient);
  const [debouncedQuery, setDebouncedQuery] = useState(selectedClient);

  useEffect(() => {
    setQuery(selectedClient);
    setDebouncedQuery(selectedClient);
  }, [selectedClient]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setDebouncedQuery(query);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [query]);

  const filteredClients = useMemo(() => {
    if (!debouncedQuery) return [];

    const normalizedSearch = normalizeText(debouncedQuery);
    const searchTerms = normalizedSearch
      .split(" ")
      .map((term) => term.trim())
      .filter(Boolean);
    if (searchTerms.length === 0) return [];

    return searchableClients
      .filter(({ normalizedName }) => {
        if (normalizedName.includes(NORMALIZED_ARCHIVE_MARKER)) return false;
        return searchTerms.every((term) => normalizedName.includes(term));
      })
      .map(({ name }) => name)
      .slice(0, MAX_SEARCH_RESULTS);
  }, [debouncedQuery, searchableClients]);

  const handleSearchChange = useCallback((value: string) => {
    setQuery(value);
  }, []);

  const handleClear = useCallback(() => {
    setQuery("");
    setDebouncedQuery("");
    onSelectClient("");
  }, [onSelectClient]);

  const handleSelect = useCallback(
    (name: string) => {
      haptics.light();
      setQuery(name);
      setDebouncedQuery("");
      onSelectClient(name);
    },
    [onSelectClient],
  );

  const shouldShowSuggestions = useMemo(() => {
    if (filteredClients.length === 0) return false;
    const normalizedQuery = normalizeText(query);
    const normalizedSelected = normalizeText(selectedClient);
    return normalizedQuery !== "" && normalizedQuery !== normalizedSelected;
  }, [filteredClients.length, query, selectedClient]);

  return (
    <div className="relative mb-3">
      <SearchInput
        value={query}
        onChange={handleSearchChange}
        onClear={handleClear}
        placeholder="Buscar cliente..."
      />
      {shouldShowSuggestions && (
        <div className="absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
          {filteredClients.map((name) => (
            <button
              key={name}
              type="button"
              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100"
              onClick={() => handleSelect(name)}
            >
              {name}
            </button>
          ))}
          {debouncedQuery && filteredClients.length === MAX_SEARCH_RESULTS && (
            <div className="px-4 py-2 text-xs text-gray-500 italic">
              Mostrando primeros {MAX_SEARCH_RESULTS} resultados. Continúa
              escribiendo para refinar la búsqueda.
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export default function FormPage() {
  const { data: session } = useSession();
  const { toast, success, error, hideToast } = useToast();
  const [clientNames, setClientNames] = useState<string[]>([]);
  const [selectedClient, setSelectedClient] = useState<string>("");
  const [total, setTotal] = useState("0.00");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [clientLocations, setClientLocations] = useState<
    Record<string, { lat: number; lng: number }>
  >({});
  const [currentLocation, setCurrentLocation] = useState<{
    lat: number;
    lng: number;
    accuracy?: number;
    timestamp?: number;
  } | null>(null);
  const [locationAlert, setLocationAlert] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [key, setKey] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [cleyOrderValue, setCleyOrderValue] = useState<string>("1");
  const [cleyPhotos, setCleyPhotos] = useState<CleyPhotoPreview[]>([]);
  const [cleyPhotoError, setCleyPhotoError] = useState<string | null>(null);
  const [isCompressingPhotos, setIsCompressingPhotos] = useState(false);
  const [cachedEmail, setCachedEmail] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<{
    client?: string;
    location?: string;
    submit?: string;
  }>({});
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Submission queue for offline-first reliability
  const {
    state: queueState,
    addToQueue,
    retryItem,
    removeItem,
    clearQueue,
  } = useSubmissionQueue();
  const submitOrder = useOrderSubmitMutation({ addToQueue });

  // 🔧 CRITICAL: Ref-based guard for immediate double-click prevention
  const isSubmittingRef = useRef(false);
  // Admin override states
  const [overrideEmail, setOverrideEmail] = useState<string>("");
  const [overrideDate, setOverrideDate] = useState<string>("");
  const [overridePeriod, setOverridePeriod] = useState<string>("");
  const [overrideMonthCode, setOverrideMonthCode] = useState<string>("");
  const [skipRequiredPhotos, setSkipRequiredPhotos] = useState(false);

  // Calculate period code and month code from the selected override date
  const calculatedOverrideValues = useMemo(() => {
    if (!overrideDate) {
      return { periodCode: "", monthCode: "" };
    }

    try {
      const selectedDate = new Date(overrideDate);
      if (Number.isNaN(selectedDate.getTime())) {
        return { periodCode: "", monthCode: "" };
      }

      // Calculate period code (e.g., P11S2)
      const { periodNumber, weekInPeriod } = getCurrentPeriodInfo(selectedDate);
      const periodCode = `P${periodNumber}S${weekInPeriod}`;

      // Calculate month code (e.g., NOV_25)
      const monthFormatter = new Intl.DateTimeFormat("en-US", {
        month: "short",
        year: "2-digit",
        timeZone: "America/Mazatlan",
      });
      const parts = monthFormatter.formatToParts(selectedDate);
      const monthPart = parts.find((p) => p.type === "month")?.value || "";
      const yearPart = parts.find((p) => p.type === "year")?.value || "";
      const monthCode = `${monthPart}_${yearPart}`
        .toUpperCase()
        .replace(".", "");

      return { periodCode, monthCode };
    } catch (e) {
      console.error("Error calculating override values:", e);
      return { periodCode: "", monthCode: "" };
    }
  }, [overrideDate]);

  // Auto-update period and month code when override date changes
  useEffect(() => {
    if (calculatedOverrideValues.periodCode) {
      setOverridePeriod(calculatedOverrideValues.periodCode);
    }
    if (calculatedOverrideValues.monthCode) {
      setOverrideMonthCode(calculatedOverrideValues.monthCode);
    }
  }, [calculatedOverrideValues]);

  const throttledLocationUpdate = useRef(
    throttle(
      (location: {
        lat: number;
        lng: number;
        accuracy?: number;
        timestamp?: number;
      }) => {
        setCurrentLocation(location);
      },
      1000,
    ),
  ).current;
  // Currency formatting (MXN)
  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat("es-MX", {
        style: "currency",
        currency: "MXN",
        maximumFractionDigits: 2,
      }),
    [],
  );
  const formatCurrency = (value: number) => currencyFormatter.format(value);

  const isCleyClient = useMemo(
    () =>
      selectedClient !== "" &&
      getClientCode(selectedClient).toUpperCase() === "CLEY",
    [selectedClient],
  );

  const isPhotoRequiredClient = useMemo(() => {
    if (!selectedClient) return false;
    const clientCode = getClientCode(selectedClient).toUpperCase();
    return isPhotoRequiredClientCode(clientCode);
  }, [selectedClient]);
  const isAdminCandidate = isFormAdminEmail(
    session?.user?.email || cachedEmail,
  );

  const cleyPhotosRef = useRef<CleyPhotoPreview[]>([]);
  const previousClientRef = useRef<string>("");

  useEffect(() => {
    cleyPhotosRef.current = cleyPhotos;
  }, [cleyPhotos]);

  const revokeCleyPhotoPreviews = useCallback((photos: CleyPhotoPreview[]) => {
    photos.forEach((photo) => {
      URL.revokeObjectURL(photo.previewUrl);
    });
  }, []);

  const resetCleyPhotoUi = useCallback(() => {
    if (cleyPhotos.length > 0) {
      revokeCleyPhotoPreviews(cleyPhotos);
    }
    setCleyPhotos([]);
    setCleyPhotoError(null);
  }, [cleyPhotos, revokeCleyPhotoPreviews]);

  const clearCleyPhotoSelection = useCallback(async () => {
    if (cleyPhotos.length === 0) {
      resetCleyPhotoUi();
      return;
    }
    const ids = cleyPhotos.map((photo) => photo.id);
    resetCleyPhotoUi();
    try {
      await deletePhotos(ids);
    } catch (error) {
      console.error("Error clearing CLEY photos:", error);
    }
  }, [cleyPhotos, resetCleyPhotoUi]);

  useEffect(() => {
    if (!selectedClient) {
      previousClientRef.current = "";
      return;
    }

    if (
      previousClientRef.current &&
      previousClientRef.current !== selectedClient &&
      cleyPhotos.length > 0
    ) {
      void clearCleyPhotoSelection();
    }

    previousClientRef.current = selectedClient;
  }, [clearCleyPhotoSelection, cleyPhotos.length, selectedClient]);

  useEffect(() => {
    if (!isPhotoRequiredClient && cleyPhotos.length > 0) {
      void clearCleyPhotoSelection();
    }
    if (!isPhotoRequiredClient) {
      setCleyPhotoError(null);
    }
  }, [cleyPhotos.length, clearCleyPhotoSelection, isPhotoRequiredClient]);

  useEffect(() => {
    if (!isPhotoRequiredClient && skipRequiredPhotos) {
      setSkipRequiredPhotos(false);
    }
  }, [isPhotoRequiredClient, skipRequiredPhotos]);

  useEffect(() => {
    return () => {
      const photos = cleyPhotosRef.current;
      if (photos.length === 0) return;
      revokeCleyPhotoPreviews(photos);
      deletePhotos(photos.map((photo) => photo.id)).catch((error) => {
        console.error("Error clearing CLEY photos on unmount:", error);
      });
    };
  }, [revokeCleyPhotoPreviews]);

  const handleAddCleyPhotos = useCallback(
    async (files: FileList) => {
      if (isCompressingPhotos) return;
      setCleyPhotoError(null);

      const currentCount = cleyPhotos.length;
      const remainingSlots = PHOTO_MAX - currentCount;

      if (remainingSlots <= 0) {
        setCleyPhotoError(`Maximo ${PHOTO_MAX} fotos.`);
        return;
      }

      const selectedFiles = Array.from(files);
      const filesToProcess = selectedFiles.slice(0, remainingSlots);
      let errorMessage: string | null = null;

      if (selectedFiles.length > filesToProcess.length) {
        errorMessage = `Maximo ${PHOTO_MAX} fotos.`;
      }

      setIsCompressingPhotos(true);

      try {
        const newPhotos: CleyPhotoPreview[] = [];

        for (const file of filesToProcess) {
          if (!file.type.startsWith("image/")) {
            errorMessage = "Solo se permiten imagenes.";
            continue;
          }

          const compressed = await compressImageFile(file, {
            maxDimension: PHOTO_MAX_DIMENSION,
            quality: PHOTO_QUALITY,
          });
          const photoId = `${Date.now()}-${Math.random()
            .toString(36)
            .slice(2, 9)}`;

          await savePhoto({
            id: photoId,
            blob: compressed,
            mimeType: "image/jpeg",
          });

          newPhotos.push({
            id: photoId,
            previewUrl: URL.createObjectURL(compressed),
            size: compressed.size,
          });
        }

        if (newPhotos.length > 0) {
          setCleyPhotos((prev) => [...prev, ...newPhotos]);
        } else if (!errorMessage) {
          errorMessage = "No se pudieron agregar fotos.";
        }

        if (errorMessage) {
          setCleyPhotoError(errorMessage);
        }
      } catch (error) {
        console.error("Error processing CLEY photos:", error);
        setCleyPhotoError("No se pudieron procesar las fotos.");
      } finally {
        setIsCompressingPhotos(false);
      }
    },
    [cleyPhotos.length, isCompressingPhotos],
  );

  const handleRemoveCleyPhoto = useCallback((photoId: string) => {
    setCleyPhotos((prev) => {
      const target = prev.find((photo) => photo.id === photoId);
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((photo) => photo.id !== photoId);
    });
    setCleyPhotoError(null);
    deletePhotos([photoId]).catch((error) => {
      console.error("Error removing CLEY photo:", error);
    });
  }, []);

  const calculateOrderDetails = useCallback(() => {
    if (!selectedClient) return [];

    const clientCode = getClientCode(selectedClient);
    // Use overrideEmail if set (admin mode), otherwise use session/cached email
    const currentEmail = overrideEmail || session?.user?.email || cachedEmail;
    const details: {
      product: string;
      quantity: number;
      price: number;
      subtotal: number;
    }[] = [];

    Object.entries(quantities).forEach(([product, quantity]) => {
      if (quantity > 0) {
        const price = getProductPrice(clientCode, product, {
          clientName: selectedClient,
          sellerEmail: currentEmail,
        });
        details.push({
          product,
          quantity,
          price,
          subtotal: price * quantity,
        });
      }
    });

    return details;
  }, [
    cachedEmail,
    overrideEmail,
    quantities,
    selectedClient,
    session?.user?.email,
  ]);

  const orderDetails = useMemo(
    () => calculateOrderDetails(),
    [calculateOrderDetails],
  );

  const searchableClients = useMemo<SearchableClient[]>(
    () =>
      clientNames.filter(Boolean).map((name) => ({
        name,
        normalizedName: normalizeText(name),
      })),
    [clientNames],
  );

  // Move hasSignificantMovement inside component
  const hasSignificantMovement = (
    oldLocation: { lat: number; lng: number } | null,
    newLocation: { lat: number; lng: number },
  ): boolean => {
    if (!oldLocation) return true;

    const distance = calculateDistance(
      oldLocation.lat,
      oldLocation.lng,
      newLocation.lat,
      newLocation.lng,
    );

    return distance > MIN_MOVEMENT_THRESHOLD;
  };

  // Update handleLocationUpdate to use the state
  const handleLocationUpdate = (location: {
    lat: number;
    lng: number;
    accuracy?: number;
    timestamp?: number;
  }) => {
    const limitedLocation = {
      lat: Number(location.lat.toFixed(5)),
      lng: Number(location.lng.toFixed(5)),
      accuracy: location.accuracy,
      timestamp: location.timestamp || Date.now(),
    };

    if (hasSignificantMovement(currentLocation, limitedLocation)) {
      throttledLocationUpdate(limitedLocation);
    } else if (currentLocation) {
      // Always update timestamp/accuracy even without movement,
      // so the latest GPS reading is preserved for submission diagnostics
      setCurrentLocation((prev) =>
        prev
          ? {
              ...prev,
              accuracy: limitedLocation.accuracy,
              timestamp: limitedLocation.timestamp,
            }
          : limitedLocation,
      );
    }
  };

  // Modify fetchClientNames to handle errors better
  const fetchClientNames = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}!A:C?key=${googleApiKey}`,
        { signal },
      );
      if (!response.ok) {
        throw new Error("Failed to fetch client data");
      }
      const data = await response.json();
      const clients: Record<string, { lat: number; lng: number }> = {};
      const rows = Array.isArray(data.values) ? data.values.slice(1) : [];
      const names = rows
        .map((row: unknown) => {
          if (!Array.isArray(row)) return null;
          const name = row[0];
          if (!name) return null;
          const normalizedName = normalizeText(String(name));
          if (normalizedName.includes(NORMALIZED_ARCHIVE_MARKER)) return null;
          const lat = row[1];
          const lng = row[2];
          if (lat != null && lng != null) {
            const parsedLat = parseFloat(String(lat));
            const parsedLng = parseFloat(String(lng));
            if (!Number.isNaN(parsedLat) && !Number.isNaN(parsedLng)) {
              clients[String(name)] = {
                lat: parsedLat,
                lng: parsedLng,
              };
            }
          }
          return String(name);
        })
        .filter((name: string | null): name is string => Boolean(name));

      const uniqueNames = Array.from(new Set(names));
      setClientNames(uniqueNames as string[]);
      setClientLocations(clients);

      try {
        localStorage.setItem(
          "clientData",
          JSON.stringify({ names: uniqueNames, locations: clients }),
        );
      } catch (_e) {
        // ignore cache write errors
      }
    } catch (error) {
      const isAbortError =
        typeof DOMException !== "undefined" &&
        error instanceof DOMException &&
        error.name === "AbortError";
      if (isAbortError) return;
      console.error("Error fetching client names:", error);
      setValidationErrors((prev) => ({
        ...prev,
        client: "Error loading clients. Please try again.",
      }));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const executeClearQueue = useCallback(async () => {
    setShowClearConfirm(false);
    try {
      await clearQueue();
      success(
        "Pendientes limpiados",
        "Se eliminaron los pedidos en cola.",
        3000,
      );
    } catch (err) {
      console.error("Error clearing queue:", err);
      error("No se pudo limpiar", "Intenta de nuevo.", 3000);
    }
  }, [clearQueue, success, error]);

  const handleClearQueue = useCallback(() => {
    if (queueState.pendingCount === 0) return;
    // Warn before clearing if any item is in-flight or the backend state is still uncertain.
    const hasRiskyItems = queueState.items.some(
      (item) =>
        item.status === "sending" ||
        item.retryCount > 0 ||
        item.lastServerState === "processing" ||
        item.lastServerState === "unknown",
    );
    if (hasRiskyItems) {
      setShowClearConfirm(true);
    } else {
      void executeClearQueue();
    }
  }, [queueState.pendingCount, queueState.items, executeClearQueue]);

  // Populate from localStorage cache before browser paints to avoid skeleton flash.
  // useLayoutEffect is not called on the server, so hydration stays stable.
  useLayoutEffect(() => {
    const cache = getClientDataCache();
    if (cache) {
      setClientNames(cache.names);
      setClientLocations(cache.locations);
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchClientNames(controller.signal);
    return () => controller.abort();
  }, [fetchClientNames]);

  // Initialize cached email on component mount
  useEffect(() => {
    const storedEmail = localStorage.getItem("userEmail");
    if (storedEmail) {
      setCachedEmail(storedEmail);
      console.log("📱 LOADED CACHED EMAIL:", storedEmail);
    }
  }, []);

  // ✅ VALIDATION: Monitor session changes and cache email when available
  useEffect(() => {
    const sessionEmail = session?.user?.email;

    // Cache the email when we have a valid session
    if (sessionEmail) {
      localStorage.setItem("userEmail", sessionEmail);
      setCachedEmail(sessionEmail);
      console.log("💾 CACHED EMAIL:", sessionEmail);
    }

    console.log("🔍 SESSION MONITOR:", {
      timestamp: new Date().toISOString(),
      sessionExists: !!session,
      sessionEmail: sessionEmail,
      cachedEmail: cachedEmail,
      sessionStatus: session ? "ACTIVE" : "NULL",
      pageUrl: window.location.href,
    });

    // Alert if session becomes null but we have cached email
    if (session === null && cachedEmail) {
      console.log("📱 SESSION NULL BUT USING CACHED EMAIL:", cachedEmail);
    }
  }, [session, cachedEmail]);

  useEffect(() => {
    if (selectedClient) {
      const clientCode = getClientCode(selectedClient);
      // Use overrideEmail if set (admin mode), otherwise use session/cached email
      const currentEmail = overrideEmail || session?.user?.email || cachedEmail;

      const calculatedTotal = Object.entries(quantities).reduce(
        (sum, [product, quantity]) => {
          const price = getProductPrice(clientCode, product, {
            clientName: selectedClient,
            sellerEmail: currentEmail,
          });
          return sum + price * quantity;
        },
        0,
      );

      // 🔍 LOG: Display total recalculation
      console.log("💰 DISPLAY TOTAL UPDATE:", {
        selectedClient,
        clientCode,
        quantities,
        calculatedTotal: calculatedTotal.toFixed(2),
        overrideEmail,
        currentEmail,
        timestamp: new Date().toISOString(),
      });

      setTotal(calculatedTotal.toFixed(2));
    }
  }, [
    selectedClient,
    quantities,
    session?.user?.email,
    cachedEmail,
    overrideEmail,
  ]);

  useEffect(() => {
    if (selectedClient && currentLocation && clientLocations[selectedClient]) {
      const distance = calculateDistance(
        currentLocation.lat,
        currentLocation.lng,
        clientLocations[selectedClient].lat,
        clientLocations[selectedClient].lng,
      );

      if (distance > MAX_CLIENT_DISTANCE) {
        setLocationAlert("Estas lejos del cliente");
      } else {
        setLocationAlert(null);
      }
    }
  }, [selectedClient, currentLocation, clientLocations]);

  const distanceToClient = useMemo(() => {
    if (!selectedClient || !currentLocation || !clientLocations[selectedClient])
      return null;
    return calculateDistance(
      currentLocation.lat,
      currentLocation.lng,
      clientLocations[selectedClient].lat,
      clientLocations[selectedClient].lng,
    );
  }, [selectedClient, currentLocation, clientLocations]);

  const formatDistance = (meters: number) => {
    if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`;
    return `${Math.round(meters)} m`;
  };

  // Products list moved to top-level constant PRODUCTS

  const handleQuantityChange = (product: string, value: number) => {
    // Haptic feedback for quantity changes
    if (value > (quantities[product] || 0)) {
      haptics.light();
    } else if (value < (quantities[product] || 0)) {
      haptics.light();
    }

    setQuantities((prev) => {
      const newQuantities = {
        ...prev,
        [product]: value >= 0 ? value : 0, // Allow zero values, just prevent negative
      };

      // Recalculate total immediately after quantity change
      if (selectedClient) {
        const clientCode = getClientCode(selectedClient);
        // Use overrideEmail if set (admin mode), otherwise use session/cached email
        const currentEmail =
          overrideEmail || session?.user?.email || cachedEmail;

        const newTotal = Object.entries(newQuantities).reduce(
          (sum, [prod, qty]) => {
            const price = getProductPrice(clientCode, prod, {
              clientName: selectedClient,
              sellerEmail: currentEmail,
            });
            return sum + price * qty;
          },
          0,
        );

        // Use setTimeout to avoid state update conflicts
        setTimeout(() => setTotal(newTotal.toFixed(2)), 0);
      }

      return newQuantities;
    });
  };

  const clearSubmittedForm = () => {
    setSelectedClient("");
    setQuantities({});
    setTotal("0.00");
    setCleyOrderValue("1");
    resetCleyPhotoUi();
    setOverrideEmail("");
    setOverrideDate("");
    setOverridePeriod("");
    setOverrideMonthCode("");
    setSkipRequiredPhotos(false);
    setKey((prev) => prev + 1);
  };

  // Hybrid submission: immediate submit with one retry, then queue fallback.
  const handleSubmit = async () => {
    // 🔒 CRITICAL: Immediate ref-based guard against double-clicks
    if (isSubmittingRef.current) {
      console.warn("⚠️ DOUBLE-CLICK PREVENTED: Submission already in progress");
      return;
    }
    isSubmittingRef.current = true;

    // Generate stable submissionId ONCE at the start
    const submissionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    console.log(`🆔 GENERATED SUBMISSION ID: ${submissionId}`);

    haptics.medium();
    setValidationErrors({});
    setCleyPhotoError(null);

    try {
      // Basic validation
      if (!selectedClient) {
        setValidationErrors((prev) => ({
          ...prev,
          client: "Selecciona un cliente",
        }));
        isSubmittingRef.current = false;
        return;
      }

      if (!currentLocation) {
        setValidationErrors((prev) => ({
          ...prev,
          location: "No se pudo obtener la ubicación",
        }));
        isSubmittingRef.current = false;
        return;
      }

      const clientCode = getClientCode(selectedClient);
      const normalizedClientCode = clientCode.toUpperCase();
      const isCley = normalizedClientCode === "CLEY";
      const isPhotoRequired = isPhotoRequiredClientCode(normalizedClientCode);

      if (isPhotoRequired && isCompressingPhotos) {
        setCleyPhotoError("Espera a que termine la compresion de fotos.");
        isSubmittingRef.current = false;
        return;
      }

      if (isPhotoRequired && cleyPhotos.length > PHOTO_MAX) {
        setCleyPhotoError(`Maximo ${PHOTO_MAX} fotos.`);
        isSubmittingRef.current = false;
        return;
      }

      // Email validation
      const sessionEmail = session?.user?.email;
      const fallbackEmail = FORM_OVERRIDE_EMAILS[0];
      const baseEmail = sessionEmail || cachedEmail || fallbackEmail;
      const isAdmin = Boolean(sessionEmail && isFormAdminEmail(sessionEmail));
      const actorEmail = sessionEmail || cachedEmail || null;
      const finalEmail = isAdmin && overrideEmail ? overrideEmail : baseEmail;
      const allowDuplicatePhotos = isAdmin && cleyPhotos.length > 0;
      const shouldSkipRequiredPhotos =
        isPhotoRequired && isAdmin && skipRequiredPhotos;
      const hasAdminOverrideIntent = Boolean(
        overrideEmail ||
          overrideDate ||
          overridePeriod ||
          overrideMonthCode ||
          skipRequiredPhotos ||
          allowDuplicatePhotos,
      );

      console.log("🔐 ADMIN OVERRIDE RESOLUTION:", {
        sessionEmail,
        cachedEmail,
        isAdminSession: isAdmin,
        hasAdminOverrideIntent,
        overrideEmail: overrideEmail || null,
        overrideDate: overrideDate || null,
        overridePeriod: overridePeriod || null,
        overrideMonthCode: overrideMonthCode || null,
        skipRequiredPhotos: shouldSkipRequiredPhotos,
        allowDuplicatePhotos,
        actorEmail,
        finalEmail,
      });

      if (!finalEmail) {
        setValidationErrors((prev) => ({
          ...prev,
          submit:
            "No se pudo determinar el usuario. Por favor, recarga la página e inicia sesión.",
        }));
        isSubmittingRef.current = false;
        return;
      }

      if (
        isPhotoRequired &&
        !shouldSkipRequiredPhotos &&
        cleyPhotos.length < PHOTO_MIN_REQUIRED
      ) {
        setCleyPhotoError(
          `Agrega al menos ${PHOTO_MIN_REQUIRED} fotos antes de enviar.`,
        );
        isSubmittingRef.current = false;
        return;
      }

      if (hasAdminOverrideIntent && !isAdmin) {
        setValidationErrors((prev) => ({
          ...prev,
          submit:
            "El modo admin requiere una sesion valida de administrador para aplicar overrides.",
        }));
        isSubmittingRef.current = false;
        return;
      }

      setIsSubmitting(true);

      // Calculate order details
      const cleyValue = isCley ? cleyOrderValue : null;

      const submittedAt =
        isAdmin && overrideDate ? new Date(overrideDate).toISOString() : null;

      const submissionTotal = Object.entries(quantities).reduce(
        (sum, [product, qty]) => {
          const price = getProductPrice(clientCode, product, {
            clientName: selectedClient,
            sellerEmail: finalEmail,
          });
          return sum + price * qty;
        },
        0,
      );

      const photoIds = isPhotoRequired
        ? cleyPhotos.map((photo) => photo.id)
        : [];
      const photoTotalBytes = isPhotoRequired
        ? cleyPhotos.reduce((sum, photo) => sum + photo.size, 0)
        : 0;
      const photoCount = isPhotoRequired ? cleyPhotos.length : 0;

      console.log("📦 PREPARING SUBMISSION:", {
        submissionId,
        clientName: selectedClient,
        clientCode,
        total: submissionTotal,
        isOnline: navigator.onLine,
        timestamp: new Date().toISOString(),
      });

      const submitResult = await submitOrder({
        id: submissionId,
        payload: {
          clientName: selectedClient,
          clientCode,
          products: { ...quantities },
          photoIds: isPhotoRequired ? photoIds : undefined,
          photoCount: isPhotoRequired ? photoCount : undefined,
          photoTotalBytes: isPhotoRequired ? photoTotalBytes : undefined,
          allowDuplicatePhotos,
          total: submissionTotal,
          queuedAt: Date.now(),
          location: {
            lat: currentLocation.lat,
            lng: currentLocation.lng,
            accuracy: currentLocation.accuracy,
            timestamp: currentLocation.timestamp || Date.now(),
          },
          userEmail: finalEmail,
          actorEmail,
          isAdminOverride:
            isAdmin &&
            (!!overrideEmail ||
              !!overrideDate ||
              !!overridePeriod ||
              skipRequiredPhotos),
          overrideTargetEmail: overrideEmail || null,
          date: submittedAt,
          cleyOrderValue: cleyValue,
          overridePeriod: isAdmin ? overridePeriod : null,
          overrideMonthCode: isAdmin ? overrideMonthCode : null,
          skipRequiredPhotos: shouldSkipRequiredPhotos,
        },
        isAdmin,
      });

      clearSubmittedForm();

      if (submitResult.outcome === "submitted") {
        haptics.success();
        success("Pedido enviado", "El pedido se envio correctamente.", 3000);
      } else if (submitResult.outcome === "queued") {
        haptics.success();
        if (navigator.onLine) {
          success(
            "Pedido en cola",
            "Tu pedido se esta enviando automaticamente.",
            3000,
          );
        } else {
          success(
            "Pedido guardado",
            "Se enviara automaticamente cuando tengas conexion.",
            4000,
          );
        }
      } else {
        haptics.light();
        success(
          "Pedido ya registrado",
          "Este pedido ya estaba en proceso o ya fue enviado.",
          3000,
        );
      }
    } catch (err) {
      const errMessage = err instanceof Error ? err.message : String(err);
      console.error("❌ SUBMISSION FAILURE:", err);
      haptics.error();
      error(
        "Error",
        errMessage ||
          "No se pudo guardar el pedido. Por favor, intenta de nuevo.",
        4000,
      );
    } finally {
      setIsSubmitting(false);
      isSubmittingRef.current = false;
      console.log("🔓 SUBMISSION GUARD RELEASED");
    }
  };

  // Add loading state UI with skeletons
  if (isLoading) {
    return (
      <div
        className="min-h-screen bg-white font-sans w-full text-[0.8rem]"
        style={{ fontFamily: "Inter, sans-serif" }}
      >
        <AppHeader title="Ventas" icon={ShoppingCart} />
        <main className="px-4 py-4 max-w-2xl mx-auto">
          <ClientSearchSkeleton />
          <MapSkeleton />
          <ProductListSkeleton />
        </main>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-white font-sans w-full text-[0.8rem]"
      style={{ fontFamily: "Inter, sans-serif" }}
    >
      {/* Pending Orders Banner - Shows queue status */}
      <PendingOrdersBanner
        state={queueState}
        onRetry={retryItem}
        onRemove={removeItem}
        onClearQueue={handleClearQueue}
      />

      {/* Confirmation dialog before clearing risky queue items */}
      <Dialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <DialogContent className="max-w-sm mx-4">
          <DialogHeader>
            <DialogTitle>Verificar antes de limpiar</DialogTitle>
            <DialogDescription>
              Limpiar quitara el seguimiento local de pedidos cuyo estado aun no
              esta confirmado por el servidor. Si alguno sigue procesandose,
              podria aparecer despues en el Dashboard.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowClearConfirm(false)}
              className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void executeClearQueue()}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
            >
              Limpiar de todas formas
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add top padding when banner is visible */}
      <div
        className={
          queueState.pendingCount > 0 || !queueState.isOnline ? "pt-24" : ""
        }
      ></div>

      <AppHeader title="Ventas" icon={ShoppingCart} />
      <main className="px-4 py-4 max-w-2xl mx-auto">
        <ClientSearchField
          searchableClients={searchableClients}
          selectedClient={selectedClient}
          onSelectClient={setSelectedClient}
        />
        {validationErrors.client && (
          <p role="alert" className="text-red-500 text-xs mt-1 mb-2">
            {validationErrors.client}
          </p>
        )}
        {selectedClient && (
          <div className="text-sm text-gray-600 mb-2 flex items-center justify-between">
            <p>
              Cliente seleccionado: {selectedClient} (
              {getClientCode(selectedClient)})
            </p>
            {distanceToClient !== null && (
              <span
                className={`ml-2 ${distanceToClient > MAX_CLIENT_DISTANCE ? "text-red-600" : "text-green-600"}`}
              >
                {formatDistance(distanceToClient)}
              </span>
            )}
          </div>
        )}
        {locationAlert && (
          <p role="alert" className="text-sm text-red-600 mb-3 font-medium">
            ⚠️ {locationAlert}
          </p>
        )}

        {/* Admin Override Section - Only visible for admin users */}
        {isAdminCandidate && (
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg mb-3 p-4 border-2 border-purple-200">
            <div className="flex items-center mb-3">
              <div className="w-2 h-2 bg-purple-600 rounded-full mr-2 animate-pulse"></div>
              <h2 className="text-purple-900 font-bold text-sm">
                MODO ADMIN - Override Controls
              </h2>
            </div>

            {/* Email Selector */}
            <div className="mb-3">
              <label
                htmlFor="override-email"
                className="block text-gray-700 font-semibold text-xs mb-2"
              >
                Seleccionar Vendedor
              </label>
              <select
                id="override-email"
                value={overrideEmail}
                onChange={(e) => {
                  haptics.light();
                  setOverrideEmail(e.target.value);
                }}
                className="w-full px-3 py-2 text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white"
              >
                <option value="">Usar email de sesión actual</option>
                {Object.entries(EMAIL_LABELS).map(([email, label]) => (
                  <option key={email} value={email}>
                    {label} ({email})
                  </option>
                ))}
              </select>
              {overrideEmail && (
                <p className="text-xs text-purple-600 mt-1">
                  ✓ Email override activo:{" "}
                  {EMAIL_LABELS[overrideEmail] || overrideEmail}
                </p>
              )}
            </div>

            {/* Date Picker */}
            <div className="mb-3">
              <label
                htmlFor="override-date"
                className="block text-gray-700 font-semibold text-xs mb-2"
              >
                Seleccionar Fecha
              </label>
              <input
                id="override-date"
                type="datetime-local"
                value={overrideDate}
                onChange={(e) => {
                  haptics.light();
                  setOverrideDate(e.target.value);
                }}
                className="w-full px-3 py-2 text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white"
              />
              {overrideDate && (
                <div className="mt-2 p-2 bg-purple-100 rounded-md">
                  <p className="text-xs text-purple-700 font-medium">
                    ✓ Fecha: {new Date(overrideDate).toLocaleString("es-MX")}
                  </p>
                  <p className="text-xs text-purple-600 mt-1">
                    📅 Periodo calculado:{" "}
                    <span className="font-bold">
                      {calculatedOverrideValues.periodCode}
                    </span>
                  </p>
                  <p className="text-xs text-purple-600">
                    📆 Código de mes:{" "}
                    <span className="font-bold">
                      {calculatedOverrideValues.monthCode}
                    </span>
                  </p>
                </div>
              )}
              {!overrideDate && (
                <p className="text-xs text-gray-500 mt-1">
                  Si no seleccionas una fecha, se usará la fecha y hora actual
                </p>
              )}
            </div>

            {/* Period Selector - Now shows calculated value and allows manual override */}
            <div className="mb-3">
              <label
                htmlFor="override-period"
                className="block text-gray-700 font-semibold text-xs mb-2"
              >
                Periodo (Columna AL){" "}
                {overrideDate && (
                  <span className="text-purple-500 font-normal">
                    - Auto-calculado desde fecha
                  </span>
                )}
              </label>
              <select
                id="override-period"
                value={overridePeriod}
                onChange={(e) => {
                  haptics.light();
                  setOverridePeriod(e.target.value);
                }}
                className="w-full px-3 py-2 text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white"
              >
                <option value="">
                  Calcular automáticamente desde la fecha
                </option>
                {/* Generate period options P11S1 to P15S4 */}
                {[11, 12, 13, 14, 15, 16, 17, 18, 19, 20].map((period) =>
                  [1, 2, 3, 4].map((week) => (
                    <option
                      key={`P${period}S${week}`}
                      value={`P${period}S${week}`}
                    >
                      P{period}S{week} - Periodo {period}, Semana {week}
                    </option>
                  )),
                )}
              </select>
              {overridePeriod && (
                <p className="text-xs text-purple-600 mt-1">
                  ✓ Periodo: <span className="font-bold">{overridePeriod}</span>
                </p>
              )}
            </div>

            {/* Month Code Display - Auto-calculated from date */}
            <div>
              <label
                htmlFor="override-month-code"
                className="block text-gray-700 font-semibold text-xs mb-2"
              >
                Código de Mes (Columna AO)
              </label>
              <input
                id="override-month-code"
                type="text"
                value={overrideMonthCode}
                onChange={(e) => {
                  haptics.light();
                  setOverrideMonthCode(e.target.value.toUpperCase());
                }}
                placeholder="Ej: NOV_25, DIC_25"
                className="w-full px-3 py-2 text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent bg-white"
              />
              {overrideMonthCode && (
                <p className="text-xs text-purple-600 mt-1">
                  ✓ Código de mes:{" "}
                  <span className="font-bold">{overrideMonthCode}</span>
                </p>
              )}
              {!overrideMonthCode && !overrideDate && (
                <p className="text-xs text-gray-500 mt-1">
                  Se calculará automáticamente desde la fecha seleccionada
                </p>
              )}
            </div>

            {isPhotoRequiredClient && (
              <div className="mt-4 rounded-md border border-purple-200 bg-white/80 p-3">
                <div className="flex items-start gap-3 text-sm text-purple-950">
                  <Checkbox
                    id="skip-required-photos"
                    checked={skipRequiredPhotos}
                    onCheckedChange={(checked) => {
                      haptics.light();
                      setSkipRequiredPhotos(checked === true);
                      setCleyPhotoError(null);
                    }}
                    className="mt-0.5 border-purple-400 data-[state=checked]:bg-purple-600"
                  />
                  <label
                    htmlFor="skip-required-photos"
                    className="cursor-pointer"
                  >
                    Omitir fotos requeridas para este envio
                    <span className="mt-1 block text-xs text-purple-700">
                      Permite enviar sin las {PHOTO_MIN_REQUIRED} fotos minimas.
                      Si adjuntas fotos como admin, las duplicadas tambien se
                      aceptan automaticamente.
                    </span>
                  </label>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="bg-white rounded-lg mb-3 p-3 border border-[#E2E4E9]">
          <h2 className="text-gray-700 font-semibold text-xs mb-3">
            Ubicación Actual
          </h2>
          <ClientMap
            onLocationUpdate={handleLocationUpdate}
            clientLocation={
              selectedClient ? clientLocations[selectedClient] : null
            }
          />
          {validationErrors.location && (
            <p role="alert" className="text-red-500 text-xs mt-2">
              {validationErrors.location}
            </p>
          )}
        </div>

        <div className="bg-white rounded-lg mb-3 p-3 border border-[#E2E4E9] space-y-4">
          {PRODUCTS.map((product) => (
            <div key={`${product}-${key}`}>
              <LabelNumbers
                label={product}
                value={quantities[product] || 0}
                onChange={(value) => handleQuantityChange(product, value)}
              />
            </div>
          ))}
        </div>

        {isPhotoRequiredClient && (
          <div className="bg-white rounded-lg mb-3 p-3 border border-[#E2E4E9]">
            <CleyPhotoCapture
              photos={cleyPhotos}
              maxPhotos={PHOTO_MAX}
              minPhotos={skipRequiredPhotos ? 0 : PHOTO_MIN_REQUIRED}
              isBusy={isCompressingPhotos}
              error={skipRequiredPhotos ? null : cleyPhotoError}
              helperText={
                skipRequiredPhotos
                  ? "Modo admin: las fotos son opcionales para este envio."
                  : isAdminCandidate
                    ? "Las fotos duplicadas se permiten automaticamente para admin."
                    : null
              }
              onAddFiles={handleAddCleyPhotos}
              onRemove={handleRemoveCleyPhoto}
            />
          </div>
        )}

        {isCleyClient && (
          <div className="bg-white rounded-lg mb-3 p-3 border border-[#E2E4E9]">
            <CleyOrderQuestion
              key={`cley-question-${key}`}
              onChange={(value) => {
                console.log("CLEY Radio changed to:", value);
                setCleyOrderValue(value);
              }}
              value={cleyOrderValue}
            />
          </div>
        )}

        {/* Sticky order details at bottom with animations */}
        {Object.values(quantities).some((q) => q > 0) && (
          <div
            className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] z-40 animate-in slide-in-from-bottom duration-300"
            style={{
              boxShadow:
                "0 -1px 2px rgba(0,0,0,0.03), 0 -2px 4px rgba(0,0,0,0.03), 0 -4px 8px rgba(0,0,0,0.03), 0 -8px 16px rgba(0,0,0,0.03), 0 -16px 32px rgba(0,0,0,0.02)",
            }}
          >
            <div className="max-w-md mx-auto">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4 text-gray-500" />
                  <h3 className="font-semibold text-gray-800 tracking-tight">
                    Detalle del pedido
                  </h3>
                </div>
                <span className="text-xs text-gray-500 tabular-nums">
                  {orderDetails.length}{" "}
                  {orderDetails.length === 1 ? "artículo" : "artículos"}
                </span>
              </div>
              <div className="max-h-40 overflow-y-auto mb-3">
                <ul className="divide-y divide-gray-100">
                  {orderDetails.map(
                    ({ product, quantity, price, subtotal }) => (
                      <li
                        key={product}
                        className="py-2 flex items-start justify-between"
                      >
                        <div className="pr-3">
                          <div className="text-gray-800 text-sm">{product}</div>
                          <div className="text-xs text-gray-500 tabular-nums">
                            Precio {formatCurrency(price)}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="inline-flex items-center rounded-full bg-gray-100 text-gray-700 text-xs px-2 py-1 font-medium tabular-nums">
                            x{quantity}
                          </span>
                          <div className="mt-1 text-gray-900 font-semibold tabular-nums">
                            {formatCurrency(subtotal)}
                          </div>
                        </div>
                      </li>
                    ),
                  )}
                </ul>
              </div>
              <div className="rounded-lg bg-gray-50 p-3 flex items-center justify-between">
                <span className="text-sm text-gray-600 font-medium">Total</span>
                <span className="text-base font-semibold tabular-nums text-gray-900">
                  {formatCurrency(parseFloat(total))}
                </span>
              </div>
            </div>
          </div>
        )}

        <div
          className={`${Object.values(quantities).some((q) => q > 0) ? "mb-80" : "mb-3"}`}
        >
          <button
            type="button"
            className={`w-full py-3 rounded-lg font-medium text-base transition-[transform,background-color,opacity] duration-200 disabled:cursor-not-allowed transform active:scale-[0.97] bg-blue-600 text-white [@media(hover:hover)]:hover:bg-blue-700 disabled:opacity-50`}
            onClick={handleSubmit}
            disabled={
              !selectedClient ||
              !currentLocation ||
              isSubmitting ||
              isCompressingPhotos ||
              (!session?.user?.email && !cachedEmail) ||
              (locationAlert !== null && !isAdminCandidate)
            }
          >
            {isSubmitting ? (
              <div className="flex items-center justify-center">
                <div className="w-5 h-5 border-t-2 border-white border-solid rounded-full animate-spin mr-2"></div>
                Guardando...
              </div>
            ) : !session?.user?.email && !cachedEmail ? (
              "Sesion Requerida"
            ) : !selectedClient ? (
              "Selecciona un cliente"
            ) : !currentLocation ? (
              "Esperando ubicacion..."
            ) : isCompressingPhotos ? (
              "Comprimiendo fotos..."
            ) : locationAlert !== null && !isAdminCandidate ? (
              "Estas lejos del cliente"
            ) : (
              "Enviar Pedido"
            )}
          </button>
        </div>

        {/* Submit-specific validation errors (client and location errors are colocated above) */}
        {validationErrors.submit && (
          <p role="alert" className="text-red-500 text-xs mt-1">
            {validationErrors.submit}
          </p>
        )}
      </main>

      {/* Toast notification */}
      {toast && (
        <Toast
          type={toast.type}
          title={toast.title}
          message={toast.message}
          isVisible={toast.isVisible}
          onClose={hideToast}
          duration={toast.duration}
        />
      )}
    </div>
  );
}

// Utility function for throttling
function throttle<Args extends unknown[]>(
  func: (...args: Args) => void,
  limit: number,
) {
  let inThrottle = false;
  return (...args: Args) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}
