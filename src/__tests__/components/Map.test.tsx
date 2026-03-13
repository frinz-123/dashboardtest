import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import mapboxgl from "mapbox-gl";
import { act } from "react";

import MapView from "@/components/ui/Map";

type MockPosition = {
  accuracy?: number;
  latitude: number;
  longitude: number;
  timestamp?: number;
};

type GeoMockOptions = {
  asyncError?: boolean;
  errorCode?: number;
  positions?: MockPosition[];
};

function mockNavigatorPermissions(state: PermissionState) {
  const permissionStatus = {
    state,
    onchange: null,
  };

  Object.defineProperty(global.navigator, "permissions", {
    configurable: true,
    value: {
      query: jest.fn().mockResolvedValue(permissionStatus),
    },
  });

  return permissionStatus;
}

function mockNavigatorGeolocation(options?: GeoMockOptions) {
  const defaultPosition: MockPosition = {
    accuracy: 10,
    latitude: 29.0729673,
    longitude: -110.9559192,
  };
  const queuedPositions =
    options?.positions && options.positions.length > 0
      ? [...options.positions]
      : [defaultPosition];
  const fallbackPosition = queuedPositions[queuedPositions.length - 1];

  const watchPosition = jest.fn((success, error) => {
    if (options?.errorCode) {
      const sendError = () =>
        error({
          code: options.errorCode,
          message: "mock-error",
        } as GeolocationPositionError);

      if (options.asyncError) {
        setTimeout(sendError, 0);
      } else {
        sendError();
      }
    } else {
      const nextPosition = queuedPositions.shift() ?? fallbackPosition;
      success({
        coords: {
          accuracy: nextPosition.accuracy ?? defaultPosition.accuracy,
          latitude: nextPosition.latitude,
          longitude: nextPosition.longitude,
        },
        timestamp: nextPosition.timestamp ?? Date.now(),
      } as GeolocationPosition);
    }

    return 1;
  });

  const clearWatch = jest.fn();

  Object.defineProperty(global.navigator, "geolocation", {
    configurable: true,
    value: {
      clearWatch,
      watchPosition,
    },
  });

  Object.defineProperty(global.navigator, "permissions", {
    configurable: true,
    value: undefined,
  });

  return { clearWatch, watchPosition };
}

function getMapboxMock() {
  return mapboxgl as unknown as {
    Map: jest.Mock;
    __mockData: {
      mapInstances: Array<{
        fitBounds: jest.Mock;
        setCenter: jest.Mock;
      }>;
      markerInstances: Array<{
        addTo: jest.Mock;
        options: { element?: HTMLElement };
        remove: jest.Mock;
        setLngLat: jest.Mock;
      }>;
      reset: () => void;
    };
  };
}

function getMarkersByLabel(label: string) {
  return getMapboxMock().__mockData.markerInstances.filter((marker) =>
    marker.options.element?.textContent?.includes(label),
  );
}

describe("MapView", () => {
  beforeEach(() => {
    getMapboxMock().__mockData.reset();
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.spyOn(console, "debug").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("initializes map with slow-network style options even without geolocation", () => {
    Object.defineProperty(global.navigator, "geolocation", {
      configurable: true,
      value: undefined,
    });

    render(<MapView />);

    const mapMock = mapboxgl.Map as unknown as jest.Mock;
    expect(mapMock).toHaveBeenCalledTimes(1);

    const mapOptions = mapMock.mock.calls[0][0];
    expect(mapOptions.style).toContain("optimize=true");
    expect(mapOptions.refreshExpiredTiles).toBe(false);
    expect(screen.getAllByText(/no soporta la ubicacion/i)).toHaveLength(2);
  });

  it("stops auto-retrying geolocation after the max retry count", () => {
    jest.useFakeTimers();
    const { watchPosition } = mockNavigatorGeolocation({
      asyncError: true,
      errorCode: 3,
    });

    render(<MapView />);

    act(() => {
      jest.advanceTimersByTime(7000);
    });

    expect(watchPosition).toHaveBeenCalledTimes(4);
    expect(screen.getAllByText(/No se pudo obtener ubicaci/i)).toHaveLength(2);
  });

  it("allows manual retry after a geolocation failure", () => {
    const { watchPosition } = mockNavigatorGeolocation({ errorCode: 1 });

    render(<MapView />);

    expect(screen.getByText("Reintentar")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Reintentar"));

    expect(watchPosition).toHaveBeenCalledTimes(2);
  });

  it("still attempts geolocation when the permissions api reports denied", async () => {
    const { watchPosition } = mockNavigatorGeolocation({ errorCode: 1 });
    const permissionStatus = mockNavigatorPermissions("denied");

    render(<MapView />);

    await waitFor(() => {
      expect(permissionStatus.onchange).toEqual(expect.any(Function));
    });
    expect(watchPosition).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Reintentar")).toBeInTheDocument();
  });

  it("centers the map on the client reference when gps is unavailable", () => {
    mockNavigatorGeolocation({ errorCode: 1 });

    render(<MapView clientLocation={{ lat: 24.8091, lng: -107.394 }} />);

    const mapMock = mapboxgl.Map as unknown as jest.Mock;
    expect(mapMock.mock.calls[0][0].center).toEqual([-107.394, 24.8091]);
    expect(screen.getByText("GPS no disponible")).toBeInTheDocument();
    expect(
      screen.getByText(/Mostrando la ubicacion del cliente como referencia\./i),
    ).toBeInTheDocument();
  });

  it("does not recreate the map during auto refreshes with the same location", () => {
    jest.useFakeTimers();
    const repeatedPosition = {
      latitude: 29.0729673,
      longitude: -110.9559192,
    };
    const { watchPosition } = mockNavigatorGeolocation({
      positions: [
        repeatedPosition,
        repeatedPosition,
        repeatedPosition,
        repeatedPosition,
      ],
    });

    render(<MapView />);

    act(() => {
      jest.advanceTimersByTime(16_000);
    });

    expect(watchPosition.mock.calls.length).toBeGreaterThan(1);
    expect(getMapboxMock().Map).toHaveBeenCalledTimes(1);
  });

  it("keeps the user marker attached across same-location refreshes", () => {
    jest.useFakeTimers();
    const repeatedPosition = {
      latitude: 29.0729673,
      longitude: -110.9559192,
    };
    mockNavigatorGeolocation({
      positions: [repeatedPosition, repeatedPosition, repeatedPosition],
    });

    render(<MapView />);

    const [userMarker] = getMarkersByLabel("TU");
    expect(userMarker).toBeDefined();
    expect(getMarkersByLabel("TU")).toHaveLength(1);
    expect(userMarker.addTo).toHaveBeenCalledTimes(1);

    act(() => {
      jest.advanceTimersByTime(6_000);
    });

    expect(getMarkersByLabel("TU")).toHaveLength(1);
    expect(userMarker.remove).not.toHaveBeenCalled();
    expect(userMarker.setLngLat.mock.calls.length).toBeGreaterThan(1);
  });

  it("ignores malformed client locations without crashing", () => {
    mockNavigatorGeolocation({ errorCode: 1 });

    const mapMock = getMapboxMock();

    expect(() => {
      render(<MapView clientLocation={{ lat: 24.8091 } as never} />);
    }).not.toThrow();

    expect(getMarkersByLabel("Cliente")).toHaveLength(0);
    expect(
      mapMock.__mockData.mapInstances[0]?.setCenter,
    ).not.toHaveBeenCalled();
  });

  it("reuses the same map instance when a client location is added later", () => {
    mockNavigatorGeolocation();

    const { rerender } = render(<MapView />);

    const mapboxMock = getMapboxMock();
    const [initialMapInstance] = mapboxMock.__mockData.mapInstances;

    rerender(<MapView clientLocation={{ lat: 24.8091, lng: -107.394 }} />);

    expect(mapboxMock.Map).toHaveBeenCalledTimes(1);
    expect(getMarkersByLabel("Cliente")).toHaveLength(1);
    expect(initialMapInstance.fitBounds).toHaveBeenCalledTimes(1);
  });
});
