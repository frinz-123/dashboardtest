export type LngLatTuple = [number, number];
export type PolygonCoordinates = LngLatTuple[][];
export type MultiPolygonCoordinates = PolygonCoordinates[];

export type PolygonFeatureGeometry = {
  type: "Polygon" | "MultiPolygon";
  coordinates: PolygonCoordinates | MultiPolygonCoordinates;
};

export type PolygonFeature = {
  type: "Feature";
  geometry: PolygonFeatureGeometry;
  properties?: Record<string, unknown> | null;
};

const EPSILON = 1e-10;
const MIN_LONGITUDE = -180;
const MAX_LONGITUDE = 180;
const MIN_LATITUDE = -90;
const MAX_LATITUDE = 90;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const isLongitude = (value: number) =>
  value >= MIN_LONGITUDE && value <= MAX_LONGITUDE;

const isLatitude = (value: number) =>
  value >= MIN_LATITUDE && value <= MAX_LATITUDE;

export const isLngLatTuple = (value: unknown): value is LngLatTuple =>
  Array.isArray(value) &&
  value.length >= 2 &&
  isFiniteNumber(value[0]) &&
  isFiniteNumber(value[1]) &&
  isLongitude(value[0]) &&
  isLatitude(value[1]);

export const isPolygonCoordinates = (
  value: unknown,
): value is PolygonCoordinates =>
  Array.isArray(value) &&
  value.every(
    (ring) =>
      Array.isArray(ring) && ring.length >= 3 && ring.every(isLngLatTuple),
  );

export const isMultiPolygonCoordinates = (
  value: unknown,
): value is MultiPolygonCoordinates =>
  Array.isArray(value) && value.every(isPolygonCoordinates);

const isPointOnSegment = (
  point: LngLatTuple,
  start: LngLatTuple,
  end: LngLatTuple,
): boolean => {
  const [px, py] = point;
  const [x1, y1] = start;
  const [x2, y2] = end;

  const cross = (px - x1) * (y2 - y1) - (py - y1) * (x2 - x1);
  if (Math.abs(cross) > EPSILON) return false;

  const dot = (px - x1) * (px - x2) + (py - y1) * (py - y2);
  return dot <= EPSILON;
};

const isPointInsideRing = (
  point: LngLatTuple,
  ring: LngLatTuple[],
): boolean => {
  if (ring.length < 3) return false;

  let isInside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const start = ring[j];
    const end = ring[i];

    if (isPointOnSegment(point, start, end)) {
      return true;
    }

    const [x1, y1] = start;
    const [x2, y2] = end;
    const [px, py] = point;

    const intersects =
      y1 > py !== y2 > py &&
      px < ((x2 - x1) * (py - y1)) / (y2 - y1 + EPSILON) + x1;

    if (intersects) {
      isInside = !isInside;
    }
  }

  return isInside;
};

export const isPointInsidePolygon = (
  point: LngLatTuple,
  polygon: PolygonCoordinates,
): boolean => {
  if (!polygon.length) return false;
  if (!isPointInsideRing(point, polygon[0])) return false;

  for (let i = 1; i < polygon.length; i++) {
    if (isPointInsideRing(point, polygon[i])) {
      return false;
    }
  }

  return true;
};

export const extractPolygonsFromFeature = (
  feature: unknown,
): PolygonCoordinates[] => {
  if (!feature || typeof feature !== "object") return [];
  const geometry = (
    feature as { geometry?: { type?: string; coordinates?: unknown } }
  ).geometry;
  if (!geometry || !geometry.type) return [];

  if (
    geometry.type === "Polygon" &&
    isPolygonCoordinates(geometry.coordinates)
  ) {
    return [geometry.coordinates];
  }

  if (
    geometry.type === "MultiPolygon" &&
    isMultiPolygonCoordinates(geometry.coordinates)
  ) {
    return geometry.coordinates;
  }

  return [];
};

export const hasPolygonGeometry = (feature: unknown): boolean => {
  if (!feature || typeof feature !== "object") return false;
  const geometryType = (feature as { geometry?: { type?: string } }).geometry
    ?.type;
  return geometryType === "Polygon" || geometryType === "MultiPolygon";
};

export const isPolygonFeature = (
  feature: unknown,
): feature is PolygonFeature => {
  if (!feature || typeof feature !== "object") return false;
  if ((feature as { type?: string }).type !== "Feature") return false;
  const geometry = (
    feature as { geometry?: { type?: unknown; coordinates?: unknown } }
  ).geometry;
  if (!geometry) return false;

  if (geometry.type === "Polygon") {
    return isPolygonCoordinates(geometry.coordinates);
  }

  if (geometry.type === "MultiPolygon") {
    return isMultiPolygonCoordinates(geometry.coordinates);
  }

  return false;
};

export const isPointInsideFeature = (
  point: LngLatTuple,
  feature: PolygonFeature,
): boolean => {
  const polygons = extractPolygonsFromFeature(feature);
  return polygons.some((polygon) => isPointInsidePolygon(point, polygon));
};
