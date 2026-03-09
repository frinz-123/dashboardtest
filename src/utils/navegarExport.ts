export type ExportRow = {
  name: string;
  code: string;
  vendedor: string;
  lastVisit: string | null;
  lastVisitLabel: string;
  lat: number;
  lng: number;
  dibujoLabel: string;
};

const CSV_HEADERS = [
  "Cliente",
  "Código",
  "Vendedor",
  "Última visita",
  "Lat",
  "Lng",
  "Dibujo",
] as const;

const escapeCsvValue = (value: string | number | null): string =>
  `"${String(value ?? "").replace(/"/g, '""')}"`;

export function createNavegarCsv(rows: ExportRow[]): string {
  const lines = [
    CSV_HEADERS.map((header) => escapeCsvValue(header)).join(","),
    ...rows.map((row) =>
      [
        row.name,
        row.code,
        row.vendedor,
        row.lastVisitLabel,
        row.lat.toFixed(5),
        row.lng.toFixed(5),
        row.dibujoLabel,
      ]
        .map((value) => escapeCsvValue(value))
        .join(","),
    ),
  ];

  return `\uFEFF${lines.join("\n")}`;
}
