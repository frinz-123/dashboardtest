import {
  buildLiveSaldoTotals,
  buildResetAdjustments,
} from "@/utils/inventarioCarroReset";

describe("inventarioCarroReset", () => {
  const productList = [
    "Chiltepin Molido 50 g",
    "Chiltepin Entero 30 g",
    "Salsa Reina El rey 195 ml",
  ];

  it("creates a negative adjustment for positive saldo", () => {
    const adjustments = buildResetAdjustments({
      productList,
      saldoTotals: {
        "Chiltepin Molido 50 g": 20,
        "Chiltepin Entero 30 g": 0,
        "Salsa Reina El rey 195 ml": 0,
      },
    });

    expect(adjustments).toEqual([
      {
        product: "Chiltepin Molido 50 g",
        currentSaldo: 20,
        quantity: -20,
      },
    ]);
  });

  it("creates a positive adjustment for negative saldo", () => {
    const adjustments = buildResetAdjustments({
      productList,
      saldoTotals: {
        "Chiltepin Molido 50 g": -54,
        "Chiltepin Entero 30 g": 0,
        "Salsa Reina El rey 195 ml": 0,
      },
    });

    expect(adjustments).toEqual([
      {
        product: "Chiltepin Molido 50 g",
        currentSaldo: -54,
        quantity: 54,
      },
    ]);
  });

  it("skips zero balances and preserves product order for mixed balances", () => {
    const adjustments = buildResetAdjustments({
      productList,
      saldoTotals: {
        "Chiltepin Molido 50 g": 12,
        "Chiltepin Entero 30 g": 0,
        "Salsa Reina El rey 195 ml": -7,
      },
    });

    expect(adjustments).toEqual([
      {
        product: "Chiltepin Molido 50 g",
        currentSaldo: 12,
        quantity: -12,
      },
      {
        product: "Salsa Reina El rey 195 ml",
        currentSaldo: -7,
        quantity: 7,
      },
    ]);
  });

  it("computes live saldo from all baseline-valid rows instead of a selected week snapshot", () => {
    const saldoTotals = buildLiveSaldoTotals({
      baselineWeekKey: 201,
      productList,
      ledgerRows: [
        {
          date: "2026-02-01",
          product: "Chiltepin Molido 50 g",
          quantity: 10,
          weekCode: "P20S1",
        },
        {
          date: "2026-02-08",
          product: "Chiltepin Molido 50 g",
          quantity: 5,
          weekCode: "P20S2",
        },
        {
          date: "2026-02-15",
          product: "Chiltepin Entero 30 g",
          quantity: 8,
          weekCode: "P20S3",
        },
      ],
      salesRows: [
        {
          date: "2026-02-09",
          weekCode: "P20S2",
          products: {
            "Chiltepin Molido 50 g": 4,
          },
        },
        {
          date: "2026-02-23",
          weekCode: "P20S4",
          products: {
            "Chiltepin Entero 30 g": 3,
          },
        },
      ],
    });

    expect(saldoTotals).toEqual({
      "Chiltepin Molido 50 g": 11,
      "Chiltepin Entero 30 g": 5,
      "Salsa Reina El rey 195 ml": 0,
    });

    expect(
      buildResetAdjustments({
        productList,
        saldoTotals,
      }),
    ).toEqual([
      {
        product: "Chiltepin Molido 50 g",
        currentSaldo: 11,
        quantity: -11,
      },
      {
        product: "Chiltepin Entero 30 g",
        currentSaldo: 5,
        quantity: -5,
      },
    ]);
  });

  it("limits saldo to rows on or before a historical nuke cutoff date", () => {
    const saldoTotals = buildLiveSaldoTotals({
      baselineWeekKey: 201,
      cutoffDate: "2026-02-17",
      cutoffWeekKey: 203,
      productList,
      ledgerRows: [
        {
          date: "2026-02-01",
          product: "Chiltepin Molido 50 g",
          quantity: 10,
          weekCode: "P20S1",
        },
        {
          date: "2026-02-16",
          product: "Chiltepin Entero 30 g",
          quantity: 8,
          weekCode: "P20S3",
        },
        {
          date: "2026-02-19",
          product: "Chiltepin Entero 30 g",
          quantity: 5,
          weekCode: "P20S3",
        },
      ],
      salesRows: [
        {
          date: "2026-02-17",
          weekCode: "P20S3",
          products: {
            "Chiltepin Entero 30 g": 3,
          },
        },
        {
          date: "2026-02-20",
          weekCode: "P20S3",
          products: {
            "Chiltepin Entero 30 g": 2,
          },
        },
      ],
    });

    expect(saldoTotals).toEqual({
      "Chiltepin Molido 50 g": 10,
      "Chiltepin Entero 30 g": 5,
      "Salsa Reina El rey 195 ml": 0,
    });
  });

  it("accepts M/D/YYYY sales dates when computing a past-week nuke cutoff", () => {
    const saldoTotals = buildLiveSaldoTotals({
      baselineWeekKey: 291,
      cutoffDate: "2026-03-06",
      cutoffWeekKey: 292,
      productList,
      ledgerRows: [
        {
          date: "2026-03-03",
          product: "Chiltepin Molido 50 g",
          quantity: 300,
          weekCode: "P29S2",
        },
      ],
      salesRows: [
        {
          date: "3/3/2026",
          weekCode: "P29S2",
          products: {
            "Chiltepin Molido 50 g": 15,
          },
        },
        {
          date: "3/6/2026",
          weekCode: "P29S2",
          products: {
            "Chiltepin Molido 50 g": 14,
          },
        },
      ],
    });

    expect(saldoTotals).toEqual({
      "Chiltepin Molido 50 g": 271,
      "Chiltepin Entero 30 g": 0,
      "Salsa Reina El rey 195 ml": 0,
    });
  });
});
