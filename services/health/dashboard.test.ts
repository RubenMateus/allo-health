import { loadDashboardData } from "./dashboard";
import { MockHealthProvider } from "./mockProvider";

describe("loadDashboardData baselines", () => {
  it("scores today's recovery against the provider's 30-day history", async () => {
    const data = await loadDashboardData(new MockHealthProvider());
    expect(data.recoveryScore).toBe(data.today.recovery);
    expect(data.strainScore).toBe(data.today.strain);
    expect(data.sleepScore).toBe(data.today.sleepScore);
    expect(data.today.recoveryInputs.hrv.building).toBe(false);
    expect(data.today.recoveryInputs.hrv.baselineDays).toBeGreaterThanOrEqual(7);
    expect(data.strainInputs.activeEnergyKcal).toBe(468);
  });

  it("falls back to fixed baselines when history can't be read", async () => {
    const provider = new MockHealthProvider();
    provider.getBiomarkerHistory = () => Promise.reject(new Error("denied"));
    const data = await loadDashboardData(provider);
    expect(data.recoveryScore).not.toBeNull();
    expect(data.today.recoveryInputs.hrv).toMatchObject({
      baseline: 48,
      building: true,
    });
    expect(data.sectionErrors.recovery).toBe(false);
  });
});
