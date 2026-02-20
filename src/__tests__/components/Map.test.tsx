import { fireEvent, render, screen } from "@testing-library/react";
import mapboxgl from "mapbox-gl";
import { act } from "react";

import MapView from "@/components/ui/Map";

type GeoMockOptions = {
  errorCode?: number;
  asyncError?: boolean;
};

function mockNavigatorGeolocation(options?: GeoMockOptions) {
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
      success({
        coords: {
          latitude: 29.0729673,
          longitude: -110.9559192,
          accuracy: 10,
        },
        timestamp: Date.now(),
      } as GeolocationPosition);
    }

    return 1;
  });

  const clearWatch = jest.fn();

  Object.defineProperty(global.navigator, "geolocation", {
    configurable: true,
    value: {
      watchPosition,
      clearWatch,
    },
  });

  Object.defineProperty(global.navigator, "permissions", {
    configurable: true,
    value: undefined,
  });

  return { watchPosition, clearWatch };
}

describe("MapView", () => {
  beforeEach(() => {
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.spyOn(console, "debug").mockImplementation(() => {});
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
    expect(
      screen.getByText(/Geolocation is not supported/i),
    ).toBeInTheDocument();
  });

  it("stops auto-retrying geolocation after the max retry count", () => {
    jest.useFakeTimers();
    const { watchPosition } = mockNavigatorGeolocation({
      errorCode: 3,
      asyncError: true,
    });

    render(<MapView />);

    act(() => {
      jest.advanceTimersByTime(7000);
    });

    expect(watchPosition).toHaveBeenCalledTimes(4);
    expect(
      screen.getByText(/No se pudo obtener ubicación\. Revisa GPS/i),
    ).toBeInTheDocument();
  });

  it("allows manual retry after a geolocation failure", () => {
    const { watchPosition } = mockNavigatorGeolocation({ errorCode: 1 });

    render(<MapView />);

    expect(screen.getByText("Reintentar")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Reintentar"));

    expect(watchPosition).toHaveBeenCalledTimes(2);
  });
});
