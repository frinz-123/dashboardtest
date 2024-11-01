'use client'

import React, { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Menu } from 'lucide-react'
import BlurIn from '@/components/ui/blur-in'
import LabelNumbers from '@/components/ui/labelnumbers'
import SearchInput from '@/components/ui/SearchInput'
import Map from '@/components/ui/Map'
import InputGray from '@/components/ui/InputGray'
import { useSession } from "next-auth/react"

const googleApiKey = 'AIzaSyDFYvzbw3A1xUj8iFJCE6dnZBTKGCitYKo'
const spreadsheetId = '1a0jZVdKFNWTHDsM-68LT5_OLPMGejAKs9wfCxYqqe_g'
const sheetName = 'Form_Data'
const OVERRIDE_EMAIL = 'franzcharbell@gmail.com' // Replace this with the actual email later

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
    'servicom': 'caseta'
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
    'Chiltepin Entero 30 g': 15,
    'Salsa Chiltepin El rey 195 ml': 15,
    'Salsa Especial El Rey 195 ml': 15,
    'Salsa Reina El rey 195 ml': 15,
    'Salsa Habanera El Rey 195 ml': 15,
    'Paquete El Rey': 100,
    'Molinillo El Rey 30 g': 82.8,
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
  }
}

// Default to EFT prices if client code not found
const getProductPrice = (clientCode: string, product: string): number => {
  const priceList = PRICES[clientCode.toUpperCase()] || PRICES['EFT']
  return priceList[product] || 0
}

type Client = {
  name: string;
  lat: number;
  lng: number;
}

// Function to calculate distance between two points in meters using the Haversine formula
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI/180;
  const φ2 = lat2 * Math.PI/180;
  const Δφ = (lat2-lat1) * Math.PI/180;
  const Δλ = (lon2-lon1) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c;

  return distance;
}

export default function FormPage() {
  const { data: session } = useSession()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
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

  const throttledLocationUpdate = useRef(
    throttle((location: { lat: number, lng: number }) => {
      setCurrentLocation(location);
    }, 1000) // Throttle to once every second
  ).current;

  useEffect(() => {
    fetchClientNames()
  }, [])

  useEffect(() => {
    if (searchTerm) {
      const filtered = clientNames.filter(name => 
        name && name.toLowerCase().includes(searchTerm.toLowerCase())
      )
      setFilteredClients(filtered)
    } else {
      setFilteredClients([])
    }
  }, [searchTerm, clientNames])

  useEffect(() => {
    if (selectedClient) {
      const clientCode = getClientCode(selectedClient)
      let total = 0
      
      Object.entries(quantities).forEach(([product, quantity]) => {
        const price = getProductPrice(clientCode, product)
        total += price * quantity
      })

      setTotal(total.toFixed(2))
    }
  }, [selectedClient, quantities])

  useEffect(() => {
    if (selectedClient && currentLocation && clientLocations[selectedClient]) {
      const clientLocation = clientLocations[selectedClient]
      const distance = calculateDistance(
        currentLocation.lat,
        currentLocation.lng,
        clientLocation.lat,
        clientLocation.lng
      )

      if (distance > 100) {  // 100 meters threshold
        setLocationAlert('Estas lejos del cliente')
      } else {
        setLocationAlert(null)
      }
    }
  }, [selectedClient, currentLocation, clientLocations])

  const fetchClientNames = async () => {
    try {
      const response = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}!A:C?key=${googleApiKey}`
      )
      const data = await response.json()
      const clients: Record<string, { lat: number, lng: number }> = {}
      const names = data.values.slice(1).map((row: any[]) => {
        const name = row[0]
        if (name && row[1] && row[2]) {
          clients[name] = {
            lat: parseFloat(row[1]),
            lng: parseFloat(row[2])
          }
        }
        return name
      }).filter(Boolean)
      
      const uniqueNames = Array.from(new Set(names))
      setClientNames(uniqueNames as string[])
      setClientLocations(clients)
    } catch (error) {
      console.error('Error fetching client names:', error)
    }
  }

  const products = [
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

  const handleQuantityChange = (product: string, value: number) => {
    setQuantities(prev => ({
      ...prev,
      [product]: value
    }))
  }

  const handleLocationUpdate = (location: { lat: number, lng: number }) => {
    throttledLocationUpdate(location)
  }

  const canSubmitDespiteAlert = session?.user?.email === OVERRIDE_EMAIL

  const handleSubmit = async () => {
    if (!selectedClient || !currentLocation) {
      alert('Por favor selecciona un cliente y permite el acceso a la ubicación')
      return
    }

    if (!session?.user?.email) {
      alert('No se encontró el email del usuario')
      return
    }

    setIsSubmitting(true)

    try {
      const clientCode = getClientCode(selectedClient)
      const response = await fetch('/api/submit-form', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clientName: selectedClient,
          products: quantities,
          total: parseFloat(total),
          location: currentLocation,
          clientCode: clientCode,
          userEmail: session.user.email,
        }),
      })

      const data = await response.json()

      if (data.success) {
        alert('Pedido enviado exitosamente')
        // Reset form
        setSelectedClient('')
        setSearchTerm('')
        setQuantities({})
        setTotal('0.00')
        setFilteredClients([])
        setKey(prev => prev + 1)
      } else {
        throw new Error(data.error || 'Failed to submit form')
      }
    } catch (error) {
      console.error('Error submitting form:', error)
      alert('Error al enviar el pedido: ' + (error as Error).message)
    } finally {
      setIsSubmitting(false)
    }
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
                <div className="py-1" role="menu" aria-orientation="vertical" aria-labelledby="options-menu">
                  <Link
                    href="/"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    role="menuitem"
                  >
                    Dashboard
                  </Link>
                  <Link
                    href="/admin"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    role="menuitem"
                  >
                    Admin
                  </Link>
                  <Link
                    href="/form"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    role="menuitem"
                  >
                    Form
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
            onChange={setSearchTerm}
            onClear={() => {
              setSearchTerm('')
              setSelectedClient('')
              setFilteredClients([])
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
                    setSelectedClient(name)
                    setSearchTerm(name)
                    setFilteredClients([])
                  }}
                >
                  {name}
                </div>
              ))}
            </div>
          )}
        </div>
        {selectedClient && (
          <p className="text-sm text-gray-600 mt-2">
            Cliente seleccionado: {selectedClient} ({getClientCode(selectedClient)})
          </p>
        )}
        {locationAlert && (
          <p className="text-sm text-red-600 mt-2 font-medium">
            ⚠️ {locationAlert}
          </p>
        )}
      </div>

      <div className="bg-white rounded-lg mb-3 p-3 border border-[#E2E4E9]">
        <h2 className="text-gray-700 font-semibold text-xs mb-3">Ubicación Actual</h2>
        <Map onLocationUpdate={handleLocationUpdate} />
      </div>

      <div className="bg-white rounded-lg mb-3 p-3 border border-[#E2E4E9] space-y-4">
        {products.map((product) => (
          <LabelNumbers 
            key={`${product}-${key}`}
            label={product} 
            value={quantities[product] || 0}
            onChange={(value) => handleQuantityChange(product, value)}
          />
        ))}
      </div>

      <div className="bg-white rounded-lg mb-3 p-3 border border-[#E2E4E9]">
        <InputGray
          label="Total"
          value={total}
          onChange={setTotal}
          type="number"
          placeholder="0.00"
        />
      </div>

      <button
        className="w-full bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors duration-200 mb-3 disabled:opacity-50 disabled:cursor-not-allowed"
        onClick={handleSubmit}
        disabled={
          !selectedClient || 
          !currentLocation || 
          isSubmitting || 
          (locationAlert !== null && !canSubmitDespiteAlert)
        }
      >
        {isSubmitting ? (
          <div className="flex items-center justify-center">
            <div className="w-5 h-5 border-t-2 border-white border-solid rounded-full animate-spin mr-2"></div>
            Enviando...
          </div>
        ) : (
          'Enviar Pedido'
        )}
      </button>
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