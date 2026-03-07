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
          product: "Chiltepin Molido 50 g",
          quantity: 10,
          weekCode: "P20S1",
        },
        {
          product: "Chiltepin Molido 50 g",
          quantity: 5,
          weekCode: "P20S2",
        },
        {
          product: "Chiltepin Entero 30 g",
          quantity: 8,
          weekCode: "P20S3",
        },
      ],
      salesRows: [
        {
          weekCode: "P20S2",
          products: {
            "Chiltepin Molido 50 g": 4,
          },
        },
        {
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
});
