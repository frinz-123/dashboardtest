import { isLngLatTuple, isPolygonFeature } from "@/utils/polygonGeometry";

describe("polygonGeometry", () => {
  it("accepts valid longitude and latitude tuples", () => {
    expect(isLngLatTuple([-107.394, 24.8091])).toBe(true);
    expect(isLngLatTuple([180, -90])).toBe(true);
  });

  it("rejects out-of-range coordinate tuples", () => {
    expect(isLngLatTuple([181, 24.8091])).toBe(false);
    expect(isLngLatTuple([-107.394, 91])).toBe(false);
  });

  it("rejects polygon features with impossible coordinates", () => {
    expect(
      isPolygonFeature({
        type: "Feature",
        geometry: {
          type: "Polygon",
          coordinates: [
            [
              [-107.394, 24.8091],
              [220, 24.81],
              [-107.39, 24.82],
            ],
          ],
        },
      }),
    ).toBe(false);
  });
});
