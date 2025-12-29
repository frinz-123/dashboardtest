"use client";

import { useEffect } from "react";

const googleApiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
const spreadsheetId = process.env.NEXT_PUBLIC_SPREADSHEET_ID;
const sheetName = process.env.NEXT_PUBLIC_SHEET_NAME;

export default function ClientDataPrefetcher() {
  useEffect(() => {
    const controller = new AbortController();
    const signal = controller.signal;
    const run = async () => {
      try {
        const res = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${sheetName}!A:C?key=${googleApiKey}`,
          { signal },
        );
        if (!res.ok) return;
        const data = await res.json();
        const clients: Record<string, { lat: number; lng: number }> = {};
        const names = (data.values?.slice(1) || [])
          .map((row: any[]) => {
            const name = row[0];
            if (!name) return null;
            if (row[1] && row[2]) {
              clients[name] = {
                lat: parseFloat(row[1]),
                lng: parseFloat(row[2]),
              };
            }
            return name;
          })
          .filter(Boolean);

        const uniqueNames = Array.from(new Set(names));
        try {
          localStorage.setItem(
            "clientData",
            JSON.stringify({ names: uniqueNames, locations: clients }),
          );
        } catch {}
      } catch {}
    };
    run();
    return () => controller.abort();
  }, []);

  return null;
}
