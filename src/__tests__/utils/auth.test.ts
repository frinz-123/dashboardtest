import {
  getVendorEmailFromLabel,
  getVendorIdentifiers,
  getVendorLabel,
} from "@/utils/auth";
import { getSellerGoal, getSellersWithGoals } from "@/utils/sellerGoals";

describe("seller registry", () => {
  const hermosilloEmail = "chiltepinelreyhmo@gmail.com";
  const mochisEmail = "ventasmochisproductoselrey@gmail.com";

  it("maps the Hermosillo seller email and label in both directions", () => {
    expect(getVendorLabel(hermosilloEmail)).toBe("Hermosillo");
    expect(getVendorEmailFromLabel("Hermosillo")).toBe(hermosilloEmail);
  });

  it("includes Hermosillo identifiers for vendor matching", () => {
    expect(getVendorIdentifiers(hermosilloEmail)).toEqual(
      new Set([hermosilloEmail, "hermosillo"]),
    );
  });

  it("reuses Mochis goal values for Hermosillo", () => {
    expect(getSellerGoal(hermosilloEmail, 26)).toBe(
      getSellerGoal(mochisEmail, 26),
    );
    expect(getSellerGoal(hermosilloEmail, 37)).toBe(
      getSellerGoal(mochisEmail, 37),
    );
    expect(getSellersWithGoals()).toContain(hermosilloEmail);
  });
});
