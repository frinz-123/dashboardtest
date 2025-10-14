'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'
import Link from 'next/link'
import { Menu, ShoppingCart, CheckCircle2 } from 'lucide-react'
import BlurIn from '@/components/ui/blur-in'
import LabelNumbers from '@/components/ui/labelnumbers'
import SearchInput from '@/components/ui/SearchInput'
import Map from '@/components/ui/Map'
import InputGray from '@/components/ui/InputGray'
import { useSession } from "next-auth/react"
import CleyOrderQuestion from '@/components/comp-166'
import Toast, { useToast } from '@/components/ui/Toast'
import { haptics } from '@/utils/haptics'
import { ClientSearchSkeleton, ProductListSkeleton, MapSkeleton } from '@/components/ui/SkeletonLoader'

const googleApiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY
const spreadsheetId = process.env.NEXT_PUBLIC_SPREADSHEET_ID
const sheetName = process.env.NEXT_PUBLIC_SHEET_NAME
const OVERRIDE_EMAILS = process.env.NEXT_PUBLIC_OVERRIDE_EMAIL?.split(',').map(email => email.trim()) || [];

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
  "Habanero Molido 20 g"
]

const MIN_MOVEMENT_THRESHOLD = 5; // Align with map for precise updates
const MAX_LOCATION_AGE = 30000; // 30 seconds in milliseconds
const MAX_CLIENT_DISTANCE = 450; // Maximum allowed distance to client in meters
const ARCHIVE_MARKER = 'archivado no usar';

function normalizeText(value: string): string {
  if (!value) return '';
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u00ad/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

const NORMALIZED_ARCHIVE_MARKER = normalizeText(ARCHIVE_MARKER);

function getClientCode(clientName: string): string {
  if (!clientName) return 'EFT'

  const codeMap: Record<string, string> = {
    'la mera': 'lamera',
    'kook': 'bekook',
    'oxxo': 'oxx',
    'ley': 'cley',
    'MM': 'MM',
    'mayorista': 'MM',
    'merka': 'merkahorro',
    'varela': 'frutvarela',
    'rika': 'vaka',
    'izagar': 'izag',
    'teresita': 'tere',
    'teca': 'tere',
    'kiosko': 'kiosk',
    'carnencanto': 'encanto',
    'beltran': 'beltr',
    'facil': 'sfacil',
    'service': 'foods',
    'distribucentro': 'dbcentro',
    'servicom': 'caseta',
    'chata': 'chata',
    'memin': 'memin'
  }

  for (const [key, code] of Object.entries(codeMap)) {
    if (clientName.toLowerCase().includes(key.toLowerCase())) {
      return code
    }
  }

  return 'EFT'
}

type ProductPrices = {
  [key: string]: {
    [product: string]: number
  }
}

const PRICES: ProductPrices = {
  'EFT': {
    'Chiltepin Molido 50 g': 48,
    'Chiltepin Molido 20 g': 24,
    'Chiltepin Entero 30 g': 45,
    'Salsa Chiltepin El rey 195 ml': 16,
    'Salsa Especial El Rey 195 ml': 16,
    'Salsa Reina El rey 195 ml': 16,
    'Salsa Habanera El Rey 195 ml': 16,
    'Paquete El Rey': 100,
    'Molinillo El Rey 30 g': 90,
    'Tira Entero': 60,
    'Tira Molido': 55,
    'Salsa chiltepin Litro': 50,
    'Salsa Especial Litro': 50,
    'Salsa Reina Litro': 50,
    'Salsa Habanera Litro': 50,
    'Michela Mix Tamarindo': 30,
    'Michela Mix Mango': 30,
    'Michela Mix Sandia': 30,
    'Michela Mix Fuego': 30,
    'Michela Mix Picafresa': 30,
    'El Rey Mix Original': 60,
    'El Rey Mix Especial': 60,
    'Habanero Molido 50 g': 40,
    'Habanero Molido 20 g': 20,
    'Medio Kilo Chiltepin Entero': 500
  },
  'CLEY': {
    'Chiltepin Molido 50 g': 44.16,
    'Chiltepin Molido 20 g': 22.08,
    'Chiltepin Entero 30 g': 46,
    'Salsa Chiltepin El rey 195 ml': 15,
    'Salsa Especial El Rey 195 ml': 15,
    'Salsa Reina El rey 195 ml': 15,
    'Salsa Habanera El Rey 195 ml': 15,
    'Paquete El Rey': 100,
    'Molinillo El Rey 30 g': 82.8,
    'Tira Entero': 60,
    'Tira Molido': 55,
    'Salsa chiltepin Litro': 46,
    'Salsa Especial Litro': 46,
    'Salsa Reina Litro': 46,
    'Salsa Habanera Litro': 46,
    'Michela Mix Tamarindo': 30,
    'Michela Mix Mango': 30,
    'Michela Mix Sandia': 30,
    'Michela Mix Fuego': 30,
    'Michela Mix Picafresa': 30,
    'El Rey Mix Original': 60,
    'El Rey Mix Especial': 60,
    'Habanero Molido 50 g': 40,
    'Habanero Molido 20 g': 20,
    'Medio Kilo Chiltepin Entero': 500
  },
  'TERE': {
    'Chiltepin Molido 50 g': 45,
    'Chiltepin Molido 20 g': 22.5,
    'Chiltepin Entero 30 g': 14,
    'Salsa Chiltepin El rey 195 ml': 14,
    'Salsa Especial El Rey 195 ml': 14,
    'Salsa Reina El rey 195 ml': 14,
    'Salsa Habanera El Rey 195 ml': 14,
    'Paquete El Rey': 100,
    'Molinillo El Rey 30 g': 90,
    'Tira Entero': 60,
    'Tira Molido': 55,
    'Salsa chiltepin Litro': 40,
    'Salsa Especial Litro': 40,
    'Salsa Reina Litro': 40,
    'Salsa Habanera Litro': 40,
    'Michela Mix Tamarindo': 30,
    'Michela Mix Mango': 30,
    'Michela Mix Sandia': 30,
    'Michela Mix Fuego': 30,
    'Michela Mix Picafresa': 30,
    'El Rey Mix Original': 60,
    'El Rey Mix Especial': 60,
    'Habanero Molido 50 g': 40,
    'Habanero Molido 20 g': 20,
    'Medio Kilo Chiltepin Entero': 500
  },
  'BEKOOK': {
    'Chiltepin Molido 50 g': 48,
    'Chiltepin Molido 20 g': 24,
    'Chiltepin Entero 30 g': 45,
    'Salsa Chiltepin El rey 195 ml': 16,
    'Salsa Especial El Rey 195 ml': 16,
    'Salsa Reina El rey 195 ml': 16,
    'Salsa Habanera El Rey 195 ml': 16,
    'Paquete El Rey': 100,
    'Molinillo El Rey 30 g': 90,
    'Tira Entero': 60,
    'Tira Molido': 55,
    'Salsa chiltepin Litro': 50,
    'Salsa Especial Litro': 50,
    'Salsa Reina Litro': 50,
    'Salsa Habanera Litro': 50,
    'Michela Mix Tamarindo': 30,
    'Michela Mix Mango': 30,
    'Michela Mix Sandia': 30,
    'Michela Mix Fuego': 30,
    'Michela Mix Picafresa': 30,
    'El Rey Mix Original': 60,
    'El Rey Mix Especial': 60,
    'Habanero Molido 50 g': 40,
    'Habanero Molido 20 g': 20,
    'Medio Kilo Chiltepin Entero': 500
  },
  'OXX': {
    'Chiltepin Molido 50 g': 44.1,
    'Chiltepin Molido 20 g': 22.5,
    'Chiltepin Entero 30 g': 45,
    'Salsa Chiltepin El rey 195 ml': 15.68,
    'Salsa Especial El Rey 195 ml': 15.68,
    'Salsa Reina El rey 195 ml': 15.68,
    'Salsa Habanera El Rey 195 ml': 15.68,
    'Paquete El Rey': 100,
    'Molinillo El Rey 30 g': 90,
    'Tira Entero': 58.8,
    'Tira Molido': 55,
    'Salsa chiltepin Litro': 40,
    'Salsa Especial Litro': 40,
    'Salsa Reina Litro': 40,
    'Salsa Habanera Litro': 40,
    'Michela Mix Tamarindo': 30,
    'Michela Mix Mango': 30,
    'Michela Mix Sandia': 30,
    'Michela Mix Fuego': 30,
    'Michela Mix Picafresa': 30,
    'El Rey Mix Original': 60,
    'El Rey Mix Especial': 60,
    'Habanero Molido 50 g': 40,
    'Habanero Molido 20 g': 20,
    'Medio Kilo Chiltepin Entero': 500
  },
  'LAMERA': {
    'Chiltepin Molido 50 g': 48,
    'Chiltepin Molido 20 g': 24,
    'Chiltepin Entero 30 g': 45,
    'Salsa Chiltepin El rey 195 ml': 16,
    'Salsa Especial El Rey 195 ml': 16,
    'Salsa Reina El rey 195 ml': 16,
    'Salsa Habanera El Rey 195 ml': 16,
    'Paquete El Rey': 100,
    'Molinillo El Rey 30 g': 90,
    'Tira Entero': 60,
    'Tira Molido': 55,
    'Salsa chiltepin Litro': 50,
    'Salsa Especial Litro': 50,
    'Salsa Reina Litro': 50,
    'Salsa Habanera Litro': 50,
    'Michela Mix Tamarindo': 30,
    'Michela Mix Mango': 30,
    'Michela Mix Sandia': 30,
    'Michela Mix Fuego': 30,
    'Michela Mix Picafresa': 30,
    'El Rey Mix Original': 60,
    'El Rey Mix Especial': 60,
    'Habanero Molido 50 g': 40,
    'Habanero Molido 20 g': 20,
    'Medio Kilo Chiltepin Entero': 500
  },
  'MM': {
    'Chiltepin Molido 50 g': 45,
    'Chiltepin Molido 20 g': 22.5,
    'Chiltepin Entero 30 g': 45,
    'Salsa Chiltepin El rey 195 ml': 14.5,
    'Salsa Especial El Rey 195 ml': 14.5,
    'Salsa Reina El rey 195 ml': 14.5,
    'Salsa Habanera El Rey 195 ml': 14.5,
    'Paquete El Rey': 100,
    'Molinillo El Rey 30 g': 85,
    'Tira Entero': 60,
    'Tira Molido': 55,
    'Salsa chiltepin Litro': 40,
    'Salsa Especial Litro': 40,
    'Salsa Reina Litro': 40,
    'Salsa Habanera Litro': 40,
    'Michela Mix Tamarindo': 30,
    'Michela Mix Mango': 30,
    'Michela Mix Sandia': 30,
    'Michela Mix Fuego': 30,
    'Michela Mix Picafresa': 30,
    'El Rey Mix Original': 60,
    'El Rey Mix Especial': 60,
    'Habanero Molido 50 g': 40,
    'Habanero Molido 20 g': 20,
    'Medio Kilo Chiltepin Entero': 500
  },
  'FRUTVARELA': {
    'Chiltepin Molido 50 g': 48,
    'Chiltepin Molido 20 g': 24,
    'Chiltepin Entero 30 g': 45,
    'Salsa Chiltepin El rey 195 ml': 16,
    'Salsa Especial El Rey 195 ml': 16,
    'Salsa Reina El rey 195 ml': 16,
    'Salsa Habanera El Rey 195 ml': 16,
    'Paquete El Rey': 100,
    'Molinillo El Rey 30 g': 90,
    'Tira Entero': 60,
    'Tira Molido': 55,
    'Salsa chiltepin Litro': 50,
    'Salsa Especial Litro': 50,
    'Salsa Reina Litro': 50,
    'Salsa Habanera Litro': 50,
    'Michela Mix Tamarindo': 30,
    'Michela Mix Mango': 30,
    'Michela Mix Sandia': 30,
    'Michela Mix Fuego': 30,
    'Michela Mix Picafresa': 30,
    'El Rey Mix Original': 60,
    'El Rey Mix Especial': 60,
    'Habanero Molido 50 g': 40,
    'Habanero Molido 20 g': 20,
    'Medio Kilo Chiltepin Entero': 500
  },
  'IZAG': {
    'Chiltepin Molido 50 g': 48,
    'Chiltepin Molido 20 g': 24,
    'Chiltepin Entero 30 g': 45,
    'Salsa Chiltepin El rey 195 ml': 16,
    'Salsa Especial El Rey 195 ml': 16,
    'Salsa Reina El rey 195 ml': 16,
    'Salsa Habanera El Rey 195 ml': 16,
    'Paquete El Rey': 100,
    'Molinillo El Rey 30 g': 90,
    'Tira Entero': 60,
    'Tira Molido': 55,
    'Salsa chiltepin Litro': 50,
    'Salsa Especial Litro': 50,
    'Salsa Reina Litro': 50,
    'Salsa Habanera Litro': 50,
    'Michela Mix Tamarindo': 30,
    'Michela Mix Mango': 30,
    'Michela Mix Sandia': 30,
    'Michela Mix Fuego': 30,
    'Michela Mix Picafresa': 30,
    'El Rey Mix Original': 60,
    'El Rey Mix Especial': 60,
    'Habanero Molido 50 g': 40,
    'Habanero Molido 20 g': 20,
    'Medio Kilo Chiltepin Entero': 500
  },
  'ENCANTO': {
    'Chiltepin Molido 50 g': 48,
    'Chiltepin Molido 20 g': 24,
    'Chiltepin Entero 30 g': 45,
    'Salsa Chiltepin El rey 195 ml': 16,
    'Salsa Especial El Rey 195 ml': 16,
    'Salsa Reina El rey 195 ml': 16,
    'Salsa Habanera El Rey 195 ml': 16,
    'Paquete El Rey': 100,
    'Molinillo El Rey 30 g': 90,
    'Tira Entero': 60,
    'Tira Molido': 55,
    'Salsa chiltepin Litro': 50,
    'Salsa Especial Litro': 50,
    'Salsa Reina Litro': 50,
    'Salsa Habanera Litro': 50,
    'Michela Mix Tamarindo': 30,
    'Michela Mix Mango': 30,
    'Michela Mix Sandia': 30,
    'Michela Mix Fuego': 30,
    'Michela Mix Picafresa': 30,
    'El Rey Mix Original': 60,
    'El Rey Mix Especial': 60,
    'Habanero Molido 50 g': 40,
    'Habanero Molido 20 g': 20,
    'Medio Kilo Chiltepin Entero': 500
  },
  'BELTR': {
    'Chiltepin Molido 50 g': 48,
    'Chiltepin Molido 20 g': 24,
    'Chiltepin Entero 30 g': 45,
    'Salsa Chiltepin El rey 195 ml': 16,
    'Salsa Especial El Rey 195 ml': 16,
    'Salsa Reina El rey 195 ml': 16,
    'Salsa Habanera El Rey 195 ml': 16,
    'Paquete El Rey': 100,
    'Molinillo El Rey 30 g': 90,
    'Tira Entero': 60,
    'Tira Molido': 55,
    'Salsa chiltepin Litro': 50,
    'Salsa Especial Litro': 50,
    'Salsa Reina Litro': 50,
    'Salsa Habanera Litro': 50,
    'Michela Mix Tamarindo': 30,
    'Michela Mix Mango': 30,
    'Michela Mix Sandia': 30,
    'Michela Mix Fuego': 30,
    'Michela Mix Picafresa': 30,
    'El Rey Mix Original': 60,
    'El Rey Mix Especial': 60,
    'Habanero Molido 50 g': 40,
    'Habanero Molido 20 g': 20,
    'Medio Kilo Chiltepin Entero': 500
  },
  'SFACIL': {
    'Chiltepin Molido 50 g': 48,
    'Chiltepin Molido 20 g': 24,
    'Chiltepin Entero 30 g': 45,
    'Salsa Chiltepin El rey 195 ml': 16,
    'Salsa Especial El Rey 195 ml': 16,
    'Salsa Reina El rey 195 ml': 16,
    'Salsa Habanera El Rey 195 ml': 16,
    'Paquete El Rey': 100,
    'Molinillo El Rey 30 g': 90,
    'Tira Entero': 60,
    'Tira Molido': 55,
    'Salsa chiltepin Litro': 50,
    'Salsa Especial Litro': 50,
    'Salsa Reina Litro': 50,
    'Salsa Habanera Litro': 50,
    'Michela Mix Tamarindo': 30,
    'Michela Mix Mango': 30,
    'Michela Mix Sandia': 30,
    'Michela Mix Fuego': 30,
    'Michela Mix Picafresa': 30,
    'El Rey Mix Original': 60,
    'El Rey Mix Especial': 60,
    'Habanero Molido 50 g': 40,
    'Habanero Molido 20 g': 20,
    'Medio Kilo Chiltepin Entero': 500
  },
  'FOODS': {
    'Chiltepin Molido 50 g': 48,
    'Chiltepin Molido 20 g': 24,
    'Chiltepin Entero 30 g': 45,
    'Salsa Chiltepin El rey 195 ml': 16,
    'Salsa Especial El Rey 195 ml': 16,
    'Salsa Reina El rey 195 ml': 16,
    'Salsa Habanera El Rey 195 ml': 16,
    'Paquete El Rey': 100,
    'Molinillo El Rey 30 g': 90,
    'Tira Entero': 60,
    'Tira Molido': 55,
    'Salsa chiltepin Litro': 50,
    'Salsa Especial Litro': 50,
    'Salsa Reina Litro': 50,
    'Salsa Habanera Litro': 50,
    'Michela Mix Tamarindo': 30,
    'Michela Mix Mango': 30,
    'Michela Mix Sandia': 30,
    'Michela Mix Fuego': 30,
    'Michela Mix Picafresa': 30,
    'El Rey Mix Original': 60,
    'El Rey Mix Especial': 60,
    'Habanero Molido 50 g': 40,
    'Habanero Molido 20 g': 20,
    'Medio Kilo Chiltepin Entero': 500
  },
  'DBCENTRO': {
    'Chiltepin Molido 50 g': 48,
    'Chiltepin Molido 20 g': 24,
    'Chiltepin Entero 30 g': 45,
    'Salsa Chiltepin El rey 195 ml': 16,
    'Salsa Especial El Rey 195 ml': 16,
    'Salsa Reina El rey 195 ml': 16,
    'Salsa Habanera El Rey 195 ml': 16,
    'Paquete El Rey': 100,
    'Molinillo El Rey 30 g': 90,
    'Tira Entero': 60,
    'Tira Molido': 55,
    'Salsa chiltepin Litro': 50,
    'Salsa Especial Litro': 50,
    'Salsa Reina Litro': 50,
    'Salsa Habanera Litro': 50,
    'Michela Mix Tamarindo': 30,
    'Michela Mix Mango': 30,
    'Michela Mix Sandia': 30,
    'Michela Mix Fuego': 30,
    'Michela Mix Picafresa': 30,
    'El Rey Mix Original': 60,
    'El Rey Mix Especial': 60,
    'Habanero Molido 50 g': 40,
    'Habanero Molido 20 g': 20,
    'Medio Kilo Chiltepin Entero': 500
  },
  'CASETA': {
    'Chiltepin Molido 50 g': 48,
    'Chiltepin Molido 20 g': 24,
    'Chiltepin Entero 30 g': 45,
    'Salsa Chiltepin El rey 195 ml': 16,
    'Salsa Especial El Rey 195 ml': 16,
    'Salsa Reina El rey 195 ml': 16,
    'Salsa Habanera El Rey 195 ml': 16,
    'Paquete El Rey': 100,
    'Molinillo El Rey 30 g': 90,
    'Tira Entero': 60,
    'Tira Molido': 55,
    'Salsa chiltepin Litro': 50,
    'Salsa Especial Litro': 50,
    'Salsa Reina Litro': 50,
    'Salsa Habanera Litro': 50,
    'Michela Mix Tamarindo': 30,
    'Michela Mix Mango': 30,
    'Michela Mix Sandia': 30,
    'Michela Mix Fuego': 30,
    'Michela Mix Picafresa': 30,
    'El Rey Mix Original': 60,
    'El Rey Mix Especial': 60,
    'Habanero Molido 50 g': 40,
    'Habanero Molido 20 g': 20,
    'Medio Kilo Chiltepin Entero': 500
  },
  'KIOSK': {
    'Chiltepin Molido 50 g': 48,
    'Chiltepin Molido 20 g': 24,
    'Chiltepin Entero 30 g': 45,
    'Salsa Chiltepin El rey 195 ml': 16,
    'Salsa Especial El Rey 195 ml': 16,
    'Salsa Reina El rey 195 ml': 16,
    'Salsa Habanera El Rey 195 ml': 16,
    'Paquete El Rey': 100,
    'Molinillo El Rey 30 g': 90,
    'Tira Entero': 60,
    'Tira Molido': 55,
    'Salsa chiltepin Litro': 50,
    'Salsa Especial Litro': 50,
    'Salsa Reina Litro': 50,
    'Salsa Habanera Litro': 50,
    'Michela Mix Tamarindo': 30,
    'Michela Mix Mango': 30,
    'Michela Mix Sandia': 30,
    'Michela Mix Fuego': 30,
    'Michela Mix Picafresa': 30,
    'El Rey Mix Original': 60,
    'El Rey Mix Especial': 60,
    'Habanero Molido 50 g': 40,
    'Habanero Molido 20 g': 20,
    'Medio Kilo Chiltepin Entero': 500
  },
  'MERKAHORRO': {
    'Chiltepin Molido 50 g': 45,
    'Chiltepin Molido 20 g': 22.5,
    'Chiltepin Entero 30 g': 40,
    'Salsa Chiltepin El rey 195 ml': 15,
    'Salsa Especial El Rey 195 ml': 15,
    'Salsa Reina El rey 195 ml': 15,
    'Salsa Habanera El Rey 195 ml': 15,
    'Paquete El Rey': 100,
    'Molinillo El Rey 30 g': 90,
    'Tira Entero': 60,
    'Tira Molido': 55,
    'Salsa chiltepin Litro': 40,
    'Salsa Especial Litro': 40,
    'Salsa Reina Litro': 40,
    'Salsa Habanera Litro': 40,
    'Michela Mix Tamarindo': 30,
    'Michela Mix Mango': 30,
    'Michela Mix Sandia': 30,
    'Michela Mix Fuego': 30,
    'Michela Mix Picafresa': 30,
    'El Rey Mix Original': 60,
    'El Rey Mix Especial': 60,
    'Habanero Molido 50 g': 40,
    'Habanero Molido 20 g': 20,
    'Medio Kilo Chiltepin Entero': 500
  },
  'CHATA': {
    'Chiltepin Molido 50 g': 50,
    'Chiltepin Molido 20 g': 25,
    'Chiltepin Entero 30 g': 45,
    'Salsa Chiltepin El rey 195 ml': 18,
    'Salsa Especial El Rey 195 ml': 18,
    'Salsa Reina El rey 195 ml': 18,
    'Salsa Habanera El Rey 195 ml': 18,
    'Paquete El Rey': 120,
    'Molinillo El Rey 30 g': 105,
    'Tira Entero': 90,
    'Tira Molido': 55,
    'Salsa chiltepin Litro': 50,
    'Salsa Especial Litro': 50,
    'Salsa Reina Litro': 50,
    'Salsa Habanera Litro': 50,
    'Michela Mix Tamarindo': 30,
    'Michela Mix Mango': 30,
    'Michela Mix Sandia': 30,
    'Michela Mix Fuego': 30,
    'Michela Mix Picafresa': 30,
    'El Rey Mix Original': 60,
    'El Rey Mix Especial': 60,
    'Habanero Molido 50 g': 40,
    'Habanero Molido 20 g': 20,
    'Medio Kilo Chiltepin Entero': 500
  },
  'MEMIN': {
    'Chiltepin Molido 50 g': 48,
    'Chiltepin Molido 20 g': 24,
    'Chiltepin Entero 30 g': 45,
    'Salsa Chiltepin El rey 195 ml': 13.60,
    'Salsa Especial El Rey 195 ml': 13.6,
    'Salsa Reina El rey 195 ml': 13.6,
    'Salsa Habanera El Rey 195 ml': 13.6,
    'Paquete El Rey': 100,
    'Molinillo El Rey 30 g': 90,
    'Tira Entero': 60,
    'Tira Molido': 55,
    'Salsa chiltepin Litro': 45,
    'Salsa Especial Litro': 45,
    'Salsa Reina Litro': 45,
    'Salsa Habanera Litro': 45,
    'Michela Mix Tamarindo': 30,
    'Michela Mix Mango': 30,
    'Michela Mix Sandia': 30,
    'Michela Mix Fuego': 30,
    'Michela Mix Picafresa': 30,
    'El Rey Mix Original': 60,
    'El Rey Mix Especial': 60,
    'Habanero Molido 50 g': 40,
    'Habanero Molido 20 g': 20,
    'Medio Kilo Chiltepin Entero': 500
  }
}

// Default to EFT prices if client code not found
const getProductPrice = (clientCode: string, product: string): number => {
  const normalizedCode = clientCode.toUpperCase()
  const priceList = PRICES[normalizedCode] || PRICES['EFT']
  const price = priceList[product]
  
  // 🔍 LOG: Missing price detection
  if (price === undefined || price === 0) {
    console.warn('⚠️ PRICE ISSUE:', {
      clientCode: normalizedCode,
      product,
      price: price ?? 'undefined',
      hasPriceList: !!PRICES[normalizedCode],
      availableProducts: priceList ? Object.keys(priceList).length : 0,
      timestamp: new Date().toISOString()
    })
  }
  
  return price || 0
}

type Client = {
  name: string;
  lat: number;
  lng: number;
}

// Update the calculateDistance function to be more precise
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c;
};

// Add a debounce utility function near the throttle function at the bottom
function debounce(func: Function, wait: number) {
  let timeout: NodeJS.Timeout;
  return function(this: any, ...args: any[]) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

export default function FormPage() {
  const { data: session } = useSession()
  const { toast, success, error, hideToast } = useToast()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')
  const [clientNames, setClientNames] = useState<string[]>([])
  const [filteredClients, setFilteredClients] = useState<string[]>([])
  const [selectedClient, setSelectedClient] = useState<string>('')
  const [total, setTotal] = useState('0.00')
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [clientLocations, setClientLocations] = useState<Record<string, { lat: number, lng: number }>>({})
  const [currentLocation, setCurrentLocation] = useState<{ lat: number, lng: number } | null>(null)
  const [locationAlert, setLocationAlert] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [key, setKey] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [cleyOrderValue, setCleyOrderValue] = useState<string>("1")
  const [cachedEmail, setCachedEmail] = useState<string | null>(null)
  const [validationErrors, setValidationErrors] = useState<{
    client?: string;
    location?: string;
    submit?: string;
  }>({});
  const [isOptimisticSubmit, setIsOptimisticSubmit] = useState(false)
  
  const throttledLocationUpdate = useRef(
    throttle((location: { lat: number, lng: number }) => {
      setCurrentLocation(location);
    }, 1000)
  ).current;
  // Currency formatting (MXN)
  const currencyFormatter = useMemo(() => new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 2
  }), [])
  const formatCurrency = (value: number) => currencyFormatter.format(value)

  const orderDetails = useMemo(() => calculateOrderDetails(), [selectedClient, quantities])


  // Add a debounced search handler
  const debouncedSearch = useRef(
    debounce((value: string) => {
      setDebouncedSearchTerm(value);
    }, 300)
  ).current;

  // Update the search term handler
  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    debouncedSearch(value);
  };

  // Move hasSignificantMovement inside component
  const hasSignificantMovement = (
    oldLocation: { lat: number; lng: number } | null,
    newLocation: { lat: number; lng: number }
  ): boolean => {
    if (!oldLocation) return true;

    const distance = calculateDistance(
      oldLocation.lat,
      oldLocation.lng,
      newLocation.lat,
      newLocation.lng
    );

    return distance > MIN_MOVEMENT_THRESHOLD;
  };

  // Update handleLocationUpdate to use the state
  const handleLocationUpdate = (location: { lat: number, lng: number }) => {
    const limitedLocation = {
      lat: Number(location.lat.toFixed(5)),
      lng: Number(location.lng.toFixed(5))
    };

    if (hasSignificantMovement(currentLocation, limitedLocation)) {
      throttledLocationUpdate(limitedLocation);
    }
  };

  useEffect(() => {
    try {
      const cached = localStorage.getItem('clientData');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed?.names && parsed?.locations) {
          setClientNames(parsed.names);
          setClientLocations(parsed.locations);
          setIsLoading(false);
        }
      }
    } catch (e) {
      // ignore cache errors
    }

    const controller = new AbortController();
    fetchClientNames(controller.signal);
    return () => controller.abort();
  }, [])

  // Initialize cached email on component mount
  useEffect(() => {
    const storedEmail = localStorage.getItem('userEmail');
    if (storedEmail) {
      setCachedEmail(storedEmail);
      console.log("📱 LOADED CACHED EMAIL:", storedEmail);
    }
  }, [])

  // ✅ VALIDATION: Monitor session changes and cache email when available
  useEffect(() => {
    const sessionEmail = session?.user?.email;
    
    // Cache the email when we have a valid session
    if (sessionEmail) {
      localStorage.setItem('userEmail', sessionEmail);
      setCachedEmail(sessionEmail);
      console.log("💾 CACHED EMAIL:", sessionEmail);
    }
    
    console.log("🔍 SESSION MONITOR:", {
      timestamp: new Date().toISOString(),
      sessionExists: !!session,
      sessionEmail: sessionEmail,
      cachedEmail: cachedEmail,
      sessionStatus: session ? 'ACTIVE' : 'NULL',
      pageUrl: window.location.href
    });

    // Alert if session becomes null but we have cached email
    if (session === null && cachedEmail) {
      console.log("📱 SESSION NULL BUT USING CACHED EMAIL:", cachedEmail);
    }
  }, [session, cachedEmail])

  // Update the search effect to use the debounced search term
  useEffect(() => {
    if (debouncedSearchTerm) {
      const normalizedSearch = normalizeText(debouncedSearchTerm);
      const MAX_RESULTS = 20; // Limit to 20 results for better performance

      console.log('🔎 Buscando clientes normalizados:', {
        originalTerm: debouncedSearchTerm,
        normalizedTerm: normalizedSearch,
        timestamp: new Date().toISOString()
      });

      const filtered = clientNames
        .filter(name => {
          if (!name) return false;
          const normalizedName = normalizeText(name);
          if (normalizedName.includes(NORMALIZED_ARCHIVE_MARKER)) return false;
          return normalizedName.includes(normalizedSearch);
        })
        .slice(0, MAX_RESULTS);

      setFilteredClients(filtered);
    } else {
      setFilteredClients([]);
    }
  }, [debouncedSearchTerm, clientNames]);

  useEffect(() => {
    if (selectedClient) {
      const clientCode = getClientCode(selectedClient)
      const calculatedTotal = Object.entries(quantities).reduce((sum, [product, quantity]) => {
        const price = getProductPrice(clientCode, product)
        return sum + (price * quantity)
      }, 0)
      
      // 🔍 LOG: Display total recalculation
      console.log('💰 DISPLAY TOTAL UPDATE:', {
        selectedClient,
        clientCode,
        quantities,
        calculatedTotal: calculatedTotal.toFixed(2),
        timestamp: new Date().toISOString()
      })
      
      setTotal(calculatedTotal.toFixed(2))
    }
  }, [selectedClient, quantities])

  useEffect(() => {
    if (selectedClient && currentLocation && clientLocations[selectedClient]) {
      const distance = calculateDistance(
        currentLocation.lat,
        currentLocation.lng,
        clientLocations[selectedClient].lat,
        clientLocations[selectedClient].lng
      );

      if (distance > MAX_CLIENT_DISTANCE) {
        setLocationAlert('Estas lejos del cliente');
      } else {
        setLocationAlert(null);
      }
    }
  }, [selectedClient, currentLocation, clientLocations]);

  // Modify fetchClientNames to handle errors better
  const fetchClientNames = async (signal?: AbortSignal) => {
    setIsLoading(true)
    try {
      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}!A:C?key=${googleApiKey}`,
        { signal }
      )
      if (!response.ok) {
        throw new Error('Failed to fetch client data')
      }
      const data = await response.json()
      const clients: Record<string, { lat: number, lng: number }> = {}
      const names = (data.values?.slice(1) || [])
        .map((row: any[]) => {
          const name = row[0]
          if (!name) return null
          const normalizedName = normalizeText(String(name))
          if (normalizedName.includes(NORMALIZED_ARCHIVE_MARKER)) return null
          if (row[1] && row[2]) {
            clients[name] = {
              lat: parseFloat(row[1]),
              lng: parseFloat(row[2])
            }
          }
          return name
        })
        .filter(Boolean)
      
      const uniqueNames = Array.from(new Set(names))
      setClientNames(uniqueNames as string[])
      setClientLocations(clients)

      try {
        localStorage.setItem(
          'clientData', 
          JSON.stringify({ names: uniqueNames, locations: clients })
        )
      } catch (e) {
        // ignore cache write errors
      }
    } catch (error) {
      if ((error as any)?.name === 'AbortError') return
      console.error('Error fetching client names:', error)
      setValidationErrors(prev => ({
        ...prev,
        client: 'Error loading clients. Please try again.'
      }))
    } finally {
      setIsLoading(false)
    }
  }

  const distanceToClient = useMemo(() => {
    if (!selectedClient || !currentLocation || !clientLocations[selectedClient]) return null
    return calculateDistance(
      currentLocation.lat,
      currentLocation.lng,
      clientLocations[selectedClient].lat,
      clientLocations[selectedClient].lng
    )
  }, [selectedClient, currentLocation, clientLocations])

  const formatDistance = (meters: number) => {
    if (meters >= 1000) return `${(meters / 1000).toFixed(1)} km`
    return `${Math.round(meters)} m`
  }

  // Products list moved to top-level constant PRODUCTS

  const handleQuantityChange = (product: string, value: number) => {
    // Haptic feedback for quantity changes
    if (value > (quantities[product] || 0)) {
      haptics.light();
    } else if (value < (quantities[product] || 0)) {
      haptics.light();
    }
    
    setQuantities(prev => {
      const newQuantities = {
        ...prev,
        [product]: value >= 0 ? value : 0  // Allow zero values, just prevent negative
      };
      
      // Recalculate total immediately after quantity change
      if (selectedClient) {
        const clientCode = getClientCode(selectedClient);
        const newTotal = Object.entries(newQuantities).reduce((sum, [prod, qty]) => {
          const price = getProductPrice(clientCode, prod);
          return sum + (price * qty);
        }, 0);
        
        // Use setTimeout to avoid state update conflicts
        setTimeout(() => setTotal(newTotal.toFixed(2)), 0);
      }
      
      return newQuantities;
    });
  };

  const isOverrideEmail = (email: string | null | undefined) => {
    console.log('Override Emails:', OVERRIDE_EMAILS); // Debug log
    console.log('Current user email:', email); // Debug log
    return email ? OVERRIDE_EMAILS.includes(email) : false;
  };

  // Add form validation
  const validateForm = (): boolean => {
    const errors: typeof validationErrors = {}

    if (!selectedClient) {
      errors.client = 'Por favor selecciona un cliente'
    }

    if (!currentLocation) {
      errors.location = 'Se requiere acceso a la ubicación'
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  // Modify handleSubmit with better error handling
  const handleSubmit = async () => {
    haptics.medium(); // Haptic feedback on submit
    setValidationErrors({});

    const stateSnapshot = {
      selectedClient,
      searchTerm,
      debouncedSearchTerm,
      quantities: { ...quantities },
      total,
      filteredClients: [...filteredClients],
      cleyOrderValue,
    };

    try {
      if (!selectedClient) {
        setValidationErrors(prev => ({ ...prev, client: 'Selecciona un cliente' }));
        return;
      }

      if (!currentLocation) {
        setValidationErrors(prev => ({ ...prev, location: 'No se pudo obtener la ubicación' }));
        return;
      }

      // ✅ VALIDATION: Use cached email if session email is not available
      const sessionEmail = session?.user?.email;
      const fallbackEmail = OVERRIDE_EMAILS[0];
      const finalEmail = sessionEmail || cachedEmail || fallbackEmail;

      console.log("🔍 EMAIL VALIDATION:", {
        sessionStatus: session ? 'EXISTS' : 'NULL',
        sessionEmail,
        cachedEmail,
        fallbackEmail,
        finalEmail,
        usingCachedEmail: !sessionEmail && !!cachedEmail,
        overrideEmailsArray: OVERRIDE_EMAILS,
        timestamp: new Date().toISOString()
      });

      // ✅ VALIDATION: Only block if we have no email at all (neither session nor cached)
      if (!finalEmail) {
        console.error("⚠️ CRITICAL: No email available (session, cached, or override)");
        setValidationErrors(prev => ({ 
          ...prev, 
          submit: 'No se pudo determinar el usuario. Por favor, recarga la página e inicia sesión.' 
        }));
        setIsSubmitting(false);
        return;
      }

      setIsSubmitting(true);
      setIsOptimisticSubmit(true);

      // Log if we're using cached email due to offline/session issues
      if (!sessionEmail && cachedEmail) {
        console.log("📱 OFFLINE MODE: Using cached email for submission:", cachedEmail);
      }

      // 🔧 FIX: Use snapshot client for consistent calculation
      const clientCode = getClientCode(stateSnapshot.selectedClient);
      const isCley = clientCode.toUpperCase() === 'CLEY';
      const cleyValue = isCley ? stateSnapshot.cleyOrderValue : null;
      const submittedAt = new Date().toISOString();

      const submissionTotal = Object.entries(stateSnapshot.quantities).reduce((sum, [product, qty]) => {
        const price = getProductPrice(clientCode, product);
        return sum + (price * qty);
      }, 0);

      // 🔍 LOG: Order calculation validation
      console.log('📊 ORDER CALCULATION:', {
        snapshotClient: stateSnapshot.selectedClient,
        currentClient: selectedClient,
        clientCode,
        products: stateSnapshot.quantities,
        calculatedTotal: submissionTotal,
        displayTotal: total,
        totalMismatch: Math.abs(submissionTotal - parseFloat(total)) > 0.01,
        timestamp: submittedAt
      });

      const submissionPayload = {
        clientName: stateSnapshot.selectedClient, // 🔧 FIX: Use snapshot client
        clientCode,
        products: stateSnapshot.quantities,
        total: submissionTotal,
        location: currentLocation,
        userEmail: finalEmail,
        date: submittedAt,
        cleyOrderValue: cleyValue
      };

      const responsePromise = fetch('/api/submit-form', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submissionPayload),
      });

      setSelectedClient('');
      setSearchTerm('');
      setDebouncedSearchTerm('');
      setQuantities({});
      setFilteredClients([]);
      setTotal('0.00');
      setCleyOrderValue("1");
      setKey(prev => prev + 1);
      setTimeout(() => setIsSubmitting(false), 150);

      // Show success toast immediately (optimistically)
      setTimeout(() => {
        haptics.success();
        success(
          'Pedido enviado',
          'Tu pedido ha sido registrado exitosamente y será procesado pronto.',
          2000  // Toast disappears after 2 seconds
        );
      }, 500);

      const response = await responsePromise;
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Error al enviar el pedido');
      }

    } catch (error) {
      console.error('Error submitting form:', error);
      haptics.error(); // Error haptic
      setValidationErrors(prev => ({ ...prev, submit: 'Error al enviar el pedido' }));
      setSelectedClient(stateSnapshot.selectedClient);
      setSearchTerm(stateSnapshot.searchTerm);
      setDebouncedSearchTerm(stateSnapshot.debouncedSearchTerm);
      setQuantities(stateSnapshot.quantities);
      setTotal(stateSnapshot.total);
      setFilteredClients(stateSnapshot.filteredClients);
      setCleyOrderValue(stateSnapshot.cleyOrderValue);
      setKey(prev => prev + 1);
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setIsOptimisticSubmit(false), 300);
    }
  };

  function calculateOrderDetails() {
    if (!selectedClient) return []
    
    const clientCode = getClientCode(selectedClient)
    const details: { product: string; quantity: number; price: number; subtotal: number }[] = []
    
    Object.entries(quantities).forEach(([product, quantity]) => {
      if (quantity > 0) {
        const price = getProductPrice(clientCode, product)
        details.push({
          product,
          quantity,
          price,
          subtotal: price * quantity
        })
      }
    })
    
    return details
  }

  // Add loading state UI with skeletons
  if (isLoading) {
    return (
      <div className="min-h-screen bg-white px-4 py-3 font-sans w-full" style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.8rem' }}>
        <header className="flex justify-between items-center mb-4">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-blue-600 rounded-full mr-2 flex items-center justify-center">
              <div className="w-5 h-0.5 bg-white rounded-full transform -rotate-45"></div>
            </div>
            <BlurIn
              word="Form"
              className="text-2xl font-medium tracking-tight"
              duration={0.5}
              variant={{
                hidden: { filter: 'blur(4px)', opacity: 0 },
                visible: { filter: 'blur(0px)', opacity: 1 }
              }}
            />
          </div>
        </header>
        <ClientSearchSkeleton />
        <MapSkeleton />
        <ProductListSkeleton />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white px-4 py-3 font-sans w-full" style={{ fontFamily: 'Inter, sans-serif', fontSize: '0.8rem' }}>
      <header className="flex justify-between items-center mb-4">
        <div className="flex items-center">
          <div className="w-8 h-8 bg-blue-600 rounded-full mr-2 flex items-center justify-center">
            <div className="w-5 h-0.5 bg-white rounded-full transform -rotate-45"></div>
          </div>
          <BlurIn
            word="Form"
            className="text-2xl font-medium tracking-tight"
            duration={0.5}
            variant={{
              hidden: { filter: 'blur(4px)', opacity: 0 },
              visible: { filter: 'blur(0px)', opacity: 1 }
            }}
          />
        </div>
        <div className="flex items-center relative">
          <div className="relative">
            <button
              className="p-1 rounded-full hover:bg-gray-200 transition-colors duration-200"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              <Menu className="h-5 w-5 text-gray-600" />
            </button>
            {isMenuOpen && (
              <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-50">
                <div className="py-1">
                  <Link
                    href="/"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    role="menuitem"
                  >
                    Dashboard
                  </Link>
                  <Link
                    href="/form"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    role="menuitem"
                  >
                    Ventas
                  </Link>
                  <Link
                    href="/recorridos"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    role="menuitem"
                  >
                    Recorridos
                  </Link>
                  <Link
                    href="/inventario"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    role="menuitem"
                  >
                    Inventario
                  </Link>
                  <Link
                    href="/clientes"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    role="menuitem"
                  >
                    Clientes
                  </Link>
                  <Link
                    href="/navegar"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    role="menuitem"
                  >
                    Navegar
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="bg-white rounded-lg mb-3 p-3 border border-[#E2E4E9]">
        <div className="relative">
          <SearchInput 
            value={searchTerm}
            onChange={handleSearchChange}
            onClear={() => {
              setSearchTerm('');
              setDebouncedSearchTerm('');
              setSelectedClient('');
              setFilteredClients([]);
            }}
            placeholder="Buscar cliente..."
          />
          {filteredClients.length > 0 && (
            <div className="absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
              {filteredClients.map((name) => (
                <div
                  key={name}
                  className="px-4 py-2 text-sm hover:bg-gray-100 cursor-pointer"
                  onClick={() => {
                    haptics.light(); // Haptic feedback for client selection
                    setSelectedClient(name);
                    setSearchTerm(name);
                    setFilteredClients([]);
                  }}
                >
                  {name}
                </div>
              ))}
              {debouncedSearchTerm && filteredClients.length === 20 && (
                <div className="px-4 py-2 text-xs text-gray-500 italic">
                  Mostrando primeros 20 resultados. Continúa escribiendo para refinar la búsqueda.
                </div>
              )}
            </div>
          )}
        </div>
        {selectedClient && (
          <div className="text-sm text-gray-600 mt-2 flex items-center justify-between">
            <p>
              Cliente seleccionado: {selectedClient} ({getClientCode(selectedClient)})
            </p>
            {distanceToClient !== null && (
              <span className={`ml-2 ${distanceToClient > MAX_CLIENT_DISTANCE ? 'text-red-600' : 'text-green-600'}`}>
                {formatDistance(distanceToClient)}
              </span>
            )}
          </div>
        )}
        {locationAlert && (
          <p className="text-sm text-red-600 mt-2 font-medium">
            ⚠️ {locationAlert}
          </p>
        )}
      </div>

      <div className="bg-white rounded-lg mb-3 p-3 border border-[#E2E4E9]">
        <h2 className="text-gray-700 font-semibold text-xs mb-3">Ubicación Actual</h2>
        <Map 
          onLocationUpdate={handleLocationUpdate}
          clientLocation={selectedClient ? clientLocations[selectedClient] : null}
        />
      </div>

      <div className="bg-white rounded-lg mb-3 p-3 border border-[#E2E4E9] space-y-4">
        {PRODUCTS.map((product, index) => (
          <div 
            key={`${product}-${key}`}
            className="transform transition-all duration-200 ease-out hover:scale-[1.01]"
            style={{ 
              animationDelay: `${index * 50}ms`,
              animation: 'fadeInUp 0.4s ease-out forwards'
            }}
          >
            <LabelNumbers 
              label={product} 
              value={quantities[product] || 0}
              onChange={(value) => handleQuantityChange(product, value)}
            />
          </div>
        ))}
      </div>

      {/* Add CLEY order question component */}
      {selectedClient && getClientCode(selectedClient).toUpperCase() === 'CLEY' && (
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
      {Object.values(quantities).some(q => q > 0) && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg z-40 animate-in slide-in-from-bottom duration-300">
          <div className="max-w-md mx-auto">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className={`transition-all duration-300 ${isOptimisticSubmit ? 'animate-pulse' : ''}`}>
                  <ShoppingCart className="h-4 w-4 text-gray-500" />
                </div>
                <h3 className="font-semibold text-gray-800 tracking-tight">Detalle del pedido</h3>
              </div>
              <span className="text-xs text-gray-500 transition-all duration-200">
                {orderDetails.length} {orderDetails.length === 1 ? 'artículo' : 'artículos'}
              </span>
            </div>
            <div className="max-h-40 overflow-y-auto mb-3">
              <ul className="divide-y divide-gray-100">
                {orderDetails.map(({ product, quantity, price, subtotal }, index) => (
                  <li 
                    key={product} 
                    className="py-2 flex items-start justify-between transform transition-all duration-200 ease-out"
                    style={{ 
                      animationDelay: `${index * 100}ms`,
                      animation: 'fadeInLeft 0.3s ease-out forwards'
                    }}
                  >
                    <div className="pr-3">
                      <div className="text-gray-800 text-sm">{product}</div>
                      <div className="text-xs text-gray-500">Precio {formatCurrency(price)}</div>
                    </div>
                    <div className="text-right">
                      <span className="inline-flex items-center rounded-full bg-gray-100 text-gray-700 text-xs px-2 py-1 font-medium transition-all duration-200 hover:bg-gray-200">
                        x{quantity}
                      </span>
                      <div className="mt-1 text-gray-900 font-semibold transition-all duration-200">
                        {formatCurrency(subtotal)}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <div className={`rounded-lg bg-gray-50 p-3 flex items-center justify-between transition-all duration-300 ${isOptimisticSubmit ? 'bg-green-50 border border-green-200' : ''}`}>
              <span className="text-sm text-gray-600 font-medium">Total</span>
              <span className={`text-base font-semibold transition-all duration-300 ${isOptimisticSubmit ? 'text-green-700' : 'text-gray-900'}`}>
                {formatCurrency(parseFloat(total))}
              </span>
            </div>
          </div>
        </div>
      )}

      <div className={`${Object.values(quantities).some(q => q > 0) ? 'mb-80' : 'mb-3'}`}>
        <button
          className={`w-full py-3 rounded-lg font-medium transition-all duration-300 disabled:cursor-not-allowed transform hover:scale-[1.02] active:scale-[0.98] ${
            isOptimisticSubmit 
              ? 'bg-green-500 text-white shadow-lg' 
              : 'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50'
          }`}
        onClick={handleSubmit}
        disabled={
          !selectedClient || 
          !currentLocation || 
          isSubmitting || 
          isOptimisticSubmit ||
          (!session?.user?.email && !cachedEmail) ||  // ✅ UPDATED: Allow if we have cached email
          (locationAlert !== null && !isOverrideEmail(session?.user?.email || cachedEmail))
        }
      >
        {isSubmitting ? (
          <div className="flex items-center justify-center">
            <div className="w-5 h-5 border-t-2 border-white border-solid rounded-full animate-spin mr-2"></div>
            {isOptimisticSubmit ? 'Procesando...' : 'Enviando...'}
          </div>
        ) : (!session?.user?.email && !cachedEmail) ? (
          '🔒 Sesión Requerida'
        ) : isOptimisticSubmit ? (
          '✓ Enviado'
        ) : (
          'Enviar Pedido'
        )}
        </button>
      </div>



      {/* Add validation error messages */}
      {Object.entries(validationErrors).map(([key, error]) => (
        error && (
          <div key={key} className="text-red-500 text-xs mt-1">
            {error}
          </div>
        )
      ))}

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
  )
} 

// Utility function for throttling
function throttle(func: Function, limit: number) {
  let inThrottle: boolean;
  return function(this: any, ...args: any[]) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  }
}