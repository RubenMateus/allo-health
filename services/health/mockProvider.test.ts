import { MockHealthProvider } from "./mockProvider";

const NOW = new Date(2026, 10, 18, 12);
const daysAgo = (days: number) => new Date(2026, 10, 18 - days, 15);

beforeEach(() => jest.useFakeTimers({ now: NOW }));
afterEach(() => jest.useRealTimers());

describe("MockHealthProvider past days", () => {
  const provider = new MockHealthProvider();

  it("varies strain inputs from day to day, the same way each time", async () => {
    const a = await provider.getStrainInputs(daysAgo(3));
    const b = await provider.getStrainInputs(daysAgo(4));
    expect(a.activeEnergyKcal).not.toBe(b.activeEnergyKcal);
    expect(await provider.getStrainInputs(daysAgo(3))).toEqual(a);
    expect(
      a.heartRateSamples.every(
        (sample) =>
          new Date(sample.timestamp).getDate() === daysAgo(3).getDate(),
      ),
    ).toBe(true);
  });

  it("varies sleep by night and wakes on the asked-for morning", async () => {
    const a = await provider.getSleep(daysAgo(2));
    const b = await provider.getSleep(daysAgo(5));
    expect(a.durationMinutes).not.toBe(b.durationMinutes);
    expect(new Date(a.wakeTime).getDate()).toBe(daysAgo(2).getDate());
  });

  it("keeps today unchanged", async () => {
    expect((await provider.getStrainInputs()).activeEnergyKcal).toBe(468);
  });
});
