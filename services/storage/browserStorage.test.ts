import { createBrowserStorage } from "./browserStorage";

describe("createBrowserStorage", () => {
  const backing = new Map<string, string>();
  beforeAll(() => {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => backing.get(key) ?? null,
        setItem: (key: string, value: string) => void backing.set(key, value),
        removeItem: (key: string) => void backing.delete(key),
      },
    });
  });
  afterAll(() => {
    delete (globalThis as { localStorage?: unknown }).localStorage;
  });
  beforeEach(() => backing.clear());

  it("keeps each store under its own prefix", () => {
    const settings = createBrowserStorage("settings");
    settings.setItem("allo-settings", "{}");
    expect(backing.get("allo-health/settings/allo-settings")).toBe("{}");
    expect(settings.getItem("allo-settings")).toBe("{}");
    settings.removeItem("allo-settings");
    expect(settings.getItem("allo-settings")).toBeNull();
  });

  it("returns a promise when asyncReads is set", async () => {
    const journal = createBrowserStorage("journal", { asyncReads: true });
    journal.setItem("allo-journal", "[]");
    const read = journal.getItem("allo-journal");
    expect(read).toBeInstanceOf(Promise);
    await expect(read).resolves.toBe("[]");
  });

  it("reads nothing when localStorage is unavailable", () => {
    delete (globalThis as { localStorage?: unknown }).localStorage;
    expect(createBrowserStorage("profile").getItem("x")).toBeNull();
  });
});
