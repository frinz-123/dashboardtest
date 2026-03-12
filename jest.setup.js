import "@testing-library/jest-dom";

// Mock Next.js router
jest.mock("next/router", () => ({
  useRouter() {
    return {
      route: "/",
      pathname: "/",
      query: {},
      asPath: "/",
      push: jest.fn(),
      pop: jest.fn(),
      reload: jest.fn(),
      back: jest.fn(),
      prefetch: jest.fn().mockResolvedValue(undefined),
      beforePopState: jest.fn(),
      events: {
        on: jest.fn(),
        off: jest.fn(),
        emit: jest.fn(),
      },
    };
  },
}));

// Mock Next.js navigation
jest.mock("next/navigation", () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
      forward: jest.fn(),
      refresh: jest.fn(),
    };
  },
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

// Mock environment variables for tests
process.env.NEXTAUTH_URL = "http://localhost:3000";
process.env.NEXTAUTH_SECRET = "test-secret";
process.env.NEXT_PUBLIC_MAPBOX_TOKEN = "test-mapbox-token";

// Mock Mapbox GL
jest.mock("mapbox-gl", () => {
  const mapInstances = [];
  const markerInstances = [];
  const boundsInstances = [];

  const createMapInstance = () => {
    const mapInstance = {
      on: jest.fn((event, handler) => {
        if (event === "load" && typeof handler === "function") {
          handler();
        }
        return mapInstance;
      }),
      remove: jest.fn(),
      addSource: jest.fn(),
      addLayer: jest.fn(),
      setStyle: jest.fn(),
      flyTo: jest.fn(),
      setCenter: jest.fn(),
      fitBounds: jest.fn(),
      addControl: jest.fn(),
      getContainer: jest.fn(() => ({
        style: {},
      })),
    };

    mapInstances.push(mapInstance);
    return mapInstance;
  };

  const MapMock = jest.fn(() => createMapInstance());

  const Marker = jest.fn((options = {}) => {
    const markerInstance = {
      options,
      setLngLat: jest.fn().mockReturnThis(),
      addTo: jest.fn().mockReturnThis(),
      remove: jest.fn(),
    };

    markerInstances.push(markerInstance);
    return markerInstance;
  });

  const LngLatBounds = jest.fn(() => {
    const boundsInstance = {
      extend: jest.fn().mockReturnThis(),
    };

    boundsInstances.push(boundsInstance);
    return boundsInstance;
  });

  const NavigationControl = jest.fn();

  const reset = () => {
    mapInstances.length = 0;
    markerInstances.length = 0;
    boundsInstances.length = 0;
    MapMock.mockClear();
    Marker.mockClear();
    LngLatBounds.mockClear();
    NavigationControl.mockClear();
  };

  const mapbox = {
    Map: MapMock,
    Marker,
    LngLatBounds,
    NavigationControl,
    supported: jest.fn(() => true),
    accessToken: "",
    __mockData: {
      boundsInstances,
      mapInstances,
      markerInstances,
      reset,
    },
  };

  return {
    __esModule: true,
    default: mapbox,
    ...mapbox,
  };
});

// Mock Google APIs
global.google = {
  sheets: jest.fn(),
};

// Suppress console warnings in tests
const originalWarn = console.warn;
beforeAll(() => {
  console.warn = (...args) => {
    if (args[0]?.includes?.("Warning: ReactDOM.render is no longer supported"))
      return;
    originalWarn.call(console, ...args);
  };
});

afterAll(() => {
  console.warn = originalWarn;
});
