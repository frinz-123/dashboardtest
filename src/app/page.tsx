'use client'

import React from 'react'
import Dashboard from '@/components/dashboard'
import { useSession } from "next-auth/react"
import { redirect } from "next/navigation"

const googleApiKey = 'AIzaSyDFYvzbw3A1xUj8iFJCE6dnZBTKGCitYKo'
const spreadsheetId = '1a0jZVdKFNWTHDsM-68LT5_OLPMGejAKs9wfCxYqqe_g'
const sheetName = 'Form_Data'

async function getLatestRowNumber(): Promise<number> {
  try {
    const response = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}!A:A?key=${googleApiKey}`
    )
    const data = await response.json()
    
    if (!data.values) {
      return 2 // Start at row 2 if sheet is empty (row 1 is headers)
    }
    
    // Find the last non-empty row
    let lastRow = data.values.length
    while (lastRow > 0 && (!data.values[lastRow - 1] || !data.values[lastRow - 1][0])) {
      lastRow--
    }
    
    // Return the next available row number
    return lastRow + 1
  } catch (error) {
    console.error('Error getting latest row:', error)
    throw new Error('Failed to get latest row number')
  }
}

export { getLatestRowNumber }

export default function Home() {
  const { data: session, status } = useSession()

  if (status === "loading") {
    return <div>Loading...</div>
  }

  if (!session) {
    redirect("/api/auth/signin")
  }

  return (
    <main className="min-h-screen bg-white">
      <Dashboard />
    </main>
  )
}