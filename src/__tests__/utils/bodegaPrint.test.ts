import { BOX_UNITS_BY_PRODUCT, getBoxBreakdown } from "@/utils/bodegaPrint";

describe("bodegaPrint", () => {
  it("includes the pouch conversion", () => {
    expect(BOX_UNITS_BY_PRODUCT["Chiltepin Pouch 30g"]).toBe(12);
  });

  it("formats exact box conversions", () => {
    expect(getBoxBreakdown("Chiltepin Molido 50 g", 24)).toEqual({
      unitsPerBox: 12,
      fullBoxes: 2,
      remainderPieces: 0,
      display: "2 cajas",
    });
  });

  it("formats remainder pieces after full boxes", () => {
    expect(getBoxBreakdown("Chiltepin Molido 50 g", 18)).toEqual({
      unitsPerBox: 12,
      fullBoxes: 1,
      remainderPieces: 6,
      display: "1 caja + 6 pzas",
    });
  });

  it("formats below-one-box quantities with zero boxes", () => {
    expect(getBoxBreakdown("Chiltepin Molido 50 g", 6)).toEqual({
      unitsPerBox: 12,
      fullBoxes: 0,
      remainderPieces: 6,
      display: "0 cajas + 6 pzas",
    });
  });

  it("returns null for products without a box conversion", () => {
    expect(getBoxBreakdown("Tira Entero", 12)).toBeNull();
  });
});
