import { QueryClient } from "@tanstack/react-query";

const mockRestoreConnection = jest.fn(async () => {});
const mockMarkSynced = jest.fn();

jest.mock("@/stores/healthStore", () => ({
  useHealthStore: {
    getState: () => ({ restoreConnection: mockRestoreConnection }),
  },
}));
jest.mock("@/stores/settingsStore", () => ({
  useSettingsStore: { getState: () => ({ markSynced: mockMarkSynced }) },
}));

import { syncHealthData } from "./useHealthSync";

function seededClient() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  return client;
}

describe("syncHealthData", () => {
  beforeEach(() => {
    mockRestoreConnection.mockClear();
    mockMarkSynced.mockClear();
  });

  it("re-attaches to health access and re-reads every health query", async () => {
    const client = seededClient();
    const home = jest.fn(async () => "home");
    const fitness = jest.fn(async () => "fitness");
    const journal = jest.fn(async () => "journal");
    await client.fetchQuery({
      queryKey: ["health-dashboard", "mock"],
      queryFn: home,
    });
    await client.fetchQuery({
      queryKey: ["fitness-dashboard", "mock"],
      queryFn: fitness,
    });
    await client.fetchQuery({ queryKey: ["journal"], queryFn: journal });

    const result = await syncHealthData(client);

    expect(result).toEqual({ ok: true });
    expect(mockRestoreConnection).toHaveBeenCalledTimes(1);
    expect(home).toHaveBeenCalledTimes(2);
    expect(fitness).toHaveBeenCalledTimes(2);
    expect(journal).toHaveBeenCalledTimes(1);
    expect(mockMarkSynced).toHaveBeenCalledTimes(1);
  });

  it("does not record a sync when a read fails", async () => {
    const client = seededClient();
    let fail = false;
    await client.fetchQuery({
      queryKey: ["fitness-dashboard", "apple"],
      queryFn: async () => {
        if (fail) throw new Error("no access");
        return "ok";
      },
    });
    fail = true;

    const result = await syncHealthData(client);

    expect(result).toEqual({ ok: false });
    expect(mockMarkSynced).not.toHaveBeenCalled();
  });
});
