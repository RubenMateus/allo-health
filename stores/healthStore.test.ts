import type { PermissionResult } from "@/services/health/types";

const mockGetConnectionStatus = jest.fn<Promise<PermissionResult | null>, []>();

jest.mock("@/services/health/appleHealthProvider", () => ({
  AppleHealthProvider: class {
    readonly kind = "apple";
    getConnectionStatus = mockGetConnectionStatus;
  },
}));
jest.mock("@/services/health/healthConnectProvider", () => ({
  HealthConnectProvider: class {
    readonly kind = "health-connect";
    getConnectionStatus = mockGetConnectionStatus;
  },
}));

function loadStore(env?: string) {
  process.env.EXPO_PUBLIC_HEALTH_PROVIDER = env;
  let store!: typeof import("./healthStore").useHealthStore;
  jest.isolateModules(() => {
    store = require("./healthStore").useHealthStore;
  });
  return store;
}

describe("restoreConnection", () => {
  afterEach(() => {
    delete process.env.EXPO_PUBLIC_HEALTH_PROVIDER;
    mockGetConnectionStatus.mockReset();
  });

  it("re-attaches to an existing grant without prompting", async () => {
    mockGetConnectionStatus.mockResolvedValue({
      state: "granted",
      grantedTypes: 12,
      requestedTypes: 12,
    });
    const store = loadStore("native");
    await store.getState().restoreConnection();
    expect(store.getState().provider.kind).not.toBe("mock");
    expect(store.getState().permissionState).toBe("granted");
  });

  it("keeps sample data when access was never requested", async () => {
    mockGetConnectionStatus.mockResolvedValue(null);
    const store = loadStore("native");
    await store.getState().restoreConnection();
    expect(store.getState().provider.kind).toBe("mock");
    expect(store.getState().permissionState).toBe("unrequested");
  });

  it("does nothing in sample-data mode", async () => {
    const store = loadStore();
    await store.getState().restoreConnection();
    expect(mockGetConnectionStatus).not.toHaveBeenCalled();
    expect(store.getState().permissionState).toBe("mock");
  });
});
