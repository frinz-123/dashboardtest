import { createNavegarCsv, type ExportRow } from "@/utils/navegarExport";

describe("navegarExport", () => {
  it("adds a UTF-8 BOM and preserves the expected header order", () => {
    const csv = createNavegarCsv([]);

    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain(
      '"Cliente","Código","Vendedor","Última visita","Lat","Lng","Dibujo"',
    );
  });

  it("escapes commas, quotes, accents, and line breaks", () => {
    const rows: ExportRow[] = [
      {
        name: 'Cliente "Especial", Norte',
        code: "CLEY",
        vendedor: "José Pérez",
        lastVisit: "01/15/2026",
        lastVisitLabel: "15 Ene 2026\nTurno AM",
        lat: 24.123456,
        lng: -107.987654,
        dibujoLabel: "Zona Centro",
      },
    ];

    const csv = createNavegarCsv(rows);

    expect(csv).toContain('"Cliente ""Especial"", Norte"');
    expect(csv).toContain('"José Pérez"');
    expect(csv).toContain('"15 Ene 2026\nTurno AM"');
    expect(csv).toContain('"24.12346","-107.98765","Zona Centro"');
  });

  it("serializes empty values as quoted empty strings", () => {
    const rows: ExportRow[] = [
      {
        name: "Cliente Sin Datos",
        code: "",
        vendedor: "",
        lastVisit: null,
        lastVisitLabel: "",
        lat: 0,
        lng: 0,
        dibujoLabel: "",
      },
    ];

    const csv = createNavegarCsv(rows);
    const lines = csv.replace("\uFEFF", "").split("\n");

    expect(lines[1]).toBe(
      '"Cliente Sin Datos","","","","0.00000","0.00000",""',
    );
  });
});
