import { parseInventarioCarroSalesRows } from "@/utils/inventarioCarroSales";
import {
  FORM_DATA_LAST_COLUMN_INDEX,
  PRODUCT_COLUMN_INDEX,
} from "@/utils/productCatalog";

describe("inventarioCarroSales", () => {
  it("parses AQ and AR products from form data rows", () => {
    const row = new Array(FORM_DATA_LAST_COLUMN_INDEX + 1).fill("");
    row[7] = "ventas@example.com";
    row[32] = "2026-03-10";
    row[37] = "P31S2";
    row[PRODUCT_COLUMN_INDEX["Molinillo Habanero 20 g"]] = "3";
    row[PRODUCT_COLUMN_INDEX["Chiltepin Pouch 30g"]] = "2";

    const [parsedRow] = parseInventarioCarroSalesRows([row]);

    expect(parsedRow).toEqual({
      sellerEmail: "ventas@example.com",
      weekCode: "P31S2",
      date: "2026-03-10",
      products: {
        "Molinillo Habanero 20 g": 3,
        "Chiltepin Pouch 30g": 2,
      },
    });
  });

  it("ignores empty product cells when parsing", () => {
    const row = new Array(FORM_DATA_LAST_COLUMN_INDEX + 1).fill("");
    row[7] = "ventas@example.com";
    row[32] = "2026-03-10";
    row[37] = "P31S2";
    row[PRODUCT_COLUMN_INDEX["Molinillo Habanero 20 g"]] = "0";

    const [parsedRow] = parseInventarioCarroSalesRows([row]);

    expect(parsedRow.products).toEqual({});
  });
});
