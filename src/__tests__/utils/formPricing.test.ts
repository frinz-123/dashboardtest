import { getProductPrice, TERRITORY_SELLER_EMAILS } from "@/utils/formPricing";

describe("formPricing", () => {
  it("assigns ventas2 to the Tijuana territory config", () => {
    expect(TERRITORY_SELLER_EMAILS.tijuana).toEqual([
      "ventas2productoselrey@gmail.com",
    ]);
  });

  it("applies Tijuana prices for EFT clients", () => {
    const price = getProductPrice("EFT", "Chiltepin Molido 50 g", {
      sellerEmail: "ventas2productoselrey@gmail.com",
    });

    expect(price).toBe(52);
  });

  it("applies Tijuana prices for CRED clients", () => {
    const price = getProductPrice("CRED", "Tira Entero", {
      sellerEmail: "ventas2productoselrey@gmail.com",
    });

    expect(price).toBe(65);
  });

  it("keeps base pricing for non-Tijuana sellers", () => {
    const price = getProductPrice("EFT", "Chiltepin Molido 50 g", {
      sellerEmail: "ventas3productoselrey@gmail.com",
    });

    expect(price).toBe(48);
  });

  it("keeps the Mazatlan and Mochis EFT Tira Molido override", () => {
    const mazatlanPrice = getProductPrice("EFT", "Tira Molido", {
      sellerEmail: "ventasmztproductoselrey.com@gmail.com",
    });
    const mochisPrice = getProductPrice("EFT", "Tira Molido", {
      sellerEmail: "ventasmochisproductoselrey@gmail.com",
    });

    expect(mazatlanPrice).toBe(60);
    expect(mochisPrice).toBe(60);
  });

  it("preserves Karnemax EFT Michela Mix pricing", () => {
    const price = getProductPrice("EFT", "Michela Mix Mango", {
      clientName: "Karnemax Cedis Norte",
      sellerEmail: "ventas1productoselrey@gmail.com",
    });

    expect(price).toBe(32);
  });

  it("falls back to non-overridden client-code pricing outside EFT and CRED", () => {
    const price = getProductPrice("WM", "Chiltepin Molido 50 g", {
      sellerEmail: "ventas2productoselrey@gmail.com",
    });

    expect(price).toBe(48);
  });
});
