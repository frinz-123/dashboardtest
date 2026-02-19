import {
  applyTransactionFilters,
  detectPhotoColumnIndex,
  parseLimit,
  parseOffset,
  parseTransactionRow,
  sortTransactionsDescending,
  type TransactionRecord,
} from "@/utils/transacciones";

const createHeaders = (): string[] => {
  const headers = new Array(43).fill("");
  headers[8] = "Chiltepin Molido 50 g";
  headers[9] = "Chiltepin Molido 20 g";
  headers[29] = "Medio Kilo Chiltepin Entero";
  headers[34] = "Michela Mix Picafresa";
  headers[41] = "photo_urls";
  return headers;
};

const buildRecord = (
  overrides: Partial<TransactionRecord>,
): TransactionRecord => {
  return {
    sheetRowNumber: 2,
    saleId: "ventas1productoselrey@gmail.com|2025-12-01|Cliente Uno",
    saleIdVariants: [
      "ventas1productoselrey@gmail.com|2025-12-01|Cliente Uno",
      "ventas1productoselrey@gmail.com|2025-12-01|Cliente Uno|t:10:20:30",
    ],
    clientName: "Cliente Uno",
    clientLat: "24.1",
    clientLng: "-110.1",
    reservedD: "",
    submissionTime: "10:20:30",
    currentLat: "24.2",
    currentLng: "-110.2",
    email: "ventas1productoselrey@gmail.com",
    products: { "Chiltepin Molido 50 g": 2 },
    productEntries: [{ name: "Chiltepin Molido 50 g", quantity: 2 }],
    productCount: 1,
    productUnits: 2,
    submissionId: "sub-1",
    codigo: "EFT",
    fechaSinHora: "12/01/2025",
    venta: 150,
    periodWeekCode: "P20S1",
    cleyOrderValue: "",
    reservedAN: "",
    monthYearCode: "DEC_25",
    photoUrls: ["https://example.com/photo.jpg"],
    hasPhotos: true,
    dateKey: "2025-12-01",
    sortTimestamp: Date.parse("2025-12-01T10:20:30"),
    ...overrides,
  };
};

describe("transacciones utils", () => {
  it("detects photo column index from header name", () => {
    const headers = createHeaders();
    expect(detectPhotoColumnIndex(headers)).toBe(41);
  });

  it("parses sheet row into transaction record", () => {
    const headers = createHeaders();
    const row = new Array(43).fill("");

    row[0] = "Cliente Uno";
    row[1] = "24.1";
    row[2] = "-110.1";
    row[4] = "13:20:10";
    row[5] = "24.2";
    row[6] = "-110.2";
    row[7] = "ventas1productoselrey@gmail.com";
    row[8] = "2";
    row[29] = "1";
    row[30] = "submission-1";
    row[31] = "eft";
    row[32] = "12/01/2025";
    row[33] = "150.5";
    row[37] = "p20s1";
    row[38] = "Si";
    row[40] = "dec_25";
    row[41] = '["https://example.com/one.jpg"]';

    const parsed = parseTransactionRow(row, headers, 41, 12);

    expect(parsed.sheetRowNumber).toBe(12);
    expect(parsed.clientName).toBe("Cliente Uno");
    expect(parsed.codigo).toBe("EFT");
    expect(parsed.venta).toBe(150.5);
    expect(parsed.submissionId).toBe("submission-1");
    expect(parsed.periodWeekCode).toBe("P20S1");
    expect(parsed.monthYearCode).toBe("DEC_25");
    expect(parsed.productCount).toBe(2);
    expect(parsed.productUnits).toBe(3);
    expect(parsed.products["Chiltepin Molido 50 g"]).toBe(2);
    expect(parsed.products["Medio Kilo Chiltepin Entero"]).toBe(1);
    expect(parsed.hasPhotos).toBe(true);
    expect(parsed.dateKey).toBe("2025-12-01");
    expect(parsed.saleIdVariants).toEqual(
      expect.arrayContaining([
        "ventas1productoselrey@gmail.com|12/01/2025|Cliente Uno",
      ]),
    );
  });

  it("applies compound filters correctly", () => {
    const records = [
      buildRecord({
        clientName: "Cliente Uno",
        codigo: "EFT",
        venta: 200,
        dateKey: "2025-12-01",
      }),
      buildRecord({
        sheetRowNumber: 3,
        clientName: "Cliente Dos",
        codigo: "CLEY",
        venta: 90,
        email: "ventas2productoselrey@gmail.com",
        hasPhotos: false,
        photoUrls: [],
        productEntries: [{ name: "Michela Mix Picafresa", quantity: 3 }],
        products: { "Michela Mix Picafresa": 3 },
        dateKey: "2025-11-15",
        periodWeekCode: "P19S4",
        monthYearCode: "NOV_25",
        saleId: "ventas2productoselrey@gmail.com|11/15/2025|Cliente Dos",
        saleIdVariants: [
          "ventas2productoselrey@gmail.com|11/15/2025|Cliente Dos",
        ],
      }),
    ];

    const filtered = applyTransactionFilters(records, {
      from: "2025-11-01",
      to: "2025-12-31",
      code: "cle",
      client: "dos",
      email: "ventas2",
      minTotal: 50,
      maxTotal: 120,
      period: "p19",
      monthCode: "nov",
      product: "picafresa",
      hasPhotos: false,
      saleId: "cliente dos",
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0].clientName).toBe("Cliente Dos");
  });

  it("supports comma-separated values for option filters", () => {
    const records = [
      buildRecord({
        sheetRowNumber: 2,
        codigo: "EFT",
        email: "ventas1productoselrey@gmail.com",
        periodWeekCode: "P20S1",
      }),
      buildRecord({
        sheetRowNumber: 3,
        codigo: "CLEY",
        email: "ventas2productoselrey@gmail.com",
        periodWeekCode: "P19S4",
      }),
      buildRecord({
        sheetRowNumber: 4,
        codigo: "MAY",
        email: "ventas3productoselrey@gmail.com",
        periodWeekCode: "P18S2",
      }),
    ];

    const filtered = applyTransactionFilters(records, {
      code: "eft, cley",
      email: "ventas1productoselrey@gmail.com,ventas2productoselrey@gmail.com",
      period: "p20s1,p19s4",
    });

    expect(filtered).toHaveLength(2);
    expect(filtered.map((record) => record.codigo)).toEqual(
      expect.arrayContaining(["EFT", "CLEY"]),
    );
  });

  it("sorts by timestamp desc and then sheet row desc", () => {
    const sameTime = Date.parse("2025-12-01T10:00:00");

    const first = buildRecord({
      sheetRowNumber: 2,
      sortTimestamp: sameTime,
      saleId: "A",
      saleIdVariants: ["A"],
    });
    const second = buildRecord({
      sheetRowNumber: 5,
      sortTimestamp: sameTime,
      saleId: "B",
      saleIdVariants: ["B"],
    });
    const third = buildRecord({
      sheetRowNumber: 4,
      sortTimestamp: Date.parse("2025-12-02T10:00:00"),
      saleId: "C",
      saleIdVariants: ["C"],
    });

    const sorted = sortTransactionsDescending([first, second, third]);

    expect(sorted.map((entry) => entry.saleId)).toEqual(["C", "B", "A"]);
  });

  it("parses limit and offset values safely", () => {
    expect(parseLimit("25", 30)).toBe(25);
    expect(parseLimit("-1", 30)).toBe(30);
    expect(parseLimit("abc", 30)).toBe(30);

    expect(parseOffset("0")).toBe(0);
    expect(parseOffset("18")).toBe(18);
    expect(parseOffset("-5")).toBe(0);
    expect(parseOffset("abc")).toBe(0);
  });
});
