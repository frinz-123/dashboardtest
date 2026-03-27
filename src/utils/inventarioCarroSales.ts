import { PRODUCT_COLUMN_INDEX, PRODUCT_NAMES } from "@/utils/productCatalog";

const SELLER_EMAIL_COLUMN_INDEX = 7;
const DATE_COLUMN_INDEX = 32;
const WEEK_CODE_COLUMN_INDEX = 37;

export type InventarioCarroSalesRow = {
  sellerEmail: string;
  weekCode: string;
  date: string;
  products: Record<string, number>;
};

export const parseInventarioCarroSalesRows = (
  rows: string[][],
): InventarioCarroSalesRow[] => {
  return rows.map((row) => {
    const products: Record<string, number> = {};

    PRODUCT_NAMES.forEach((product) => {
      const columnIndex = PRODUCT_COLUMN_INDEX[product];
      const value = row?.[columnIndex];
      const quantity = Number.parseInt(value || "0", 10) || 0;

      if (quantity > 0) {
        products[product] = quantity;
      }
    });

    return {
      sellerEmail: row?.[SELLER_EMAIL_COLUMN_INDEX] || "",
      weekCode: row?.[WEEK_CODE_COLUMN_INDEX] || "",
      date: row?.[DATE_COLUMN_INDEX] || "",
      products,
    };
  });
};
