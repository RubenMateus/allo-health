import { loadBiomarkers } from "./biomarkers";
import { MockHealthProvider } from "./mockProvider";
import type { HealthProvider } from "./types";

describe("loadBiomarkers", () => {
  it("summarizes every biomarker and estimates fitness age", async () => {
    const data = await loadBiomarkers(new MockHealthProvider(), {
      birthDate: null,
      sex: null,
    });
    expect(data.biomarkers.weight.status?.basis).toBe("trend");
    expect(data.biomarkers.vo2Max.status?.basis).toBe("rating");
    expect(data.fitnessAge?.value).toBeGreaterThan(20);
    expect(data.fitnessAge?.chronologicalAge).toBe(data.age);
  });

  it("fills a missing source profile from the saved one", async () => {
    const provider = new MockHealthProvider();
    provider.getProfile = async () => ({ birthDate: null, sex: null });
    const data = await loadBiomarkers(provider, {
      birthDate: "1990-01-01",
      sex: "female",
    });
    expect(data.profile).toEqual({ birthDate: "1990-01-01", sex: "female" });
  });

  it("treats a failed read as no data", async () => {
    const provider: HealthProvider = new MockHealthProvider();
    provider.getBiomarkerHistory = async () => {
      throw new Error("not granted");
    };
    const data = await loadBiomarkers(provider, { birthDate: null, sex: null });
    expect(data.biomarkers.weight.latest).toBeNull();
    expect(data.fitnessAge).toBeNull();
  });
});
