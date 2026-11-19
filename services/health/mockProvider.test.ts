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

describe("MockHealthProvider day-aware readings", () => {
  const provider = new MockHealthProvider();

  it("varies resting HR by past day, stable across calls, today unchanged", async () => {
    const a = await provider.getRestingHR(daysAgo(3));
    const b = await provider.getRestingHR(daysAgo(4));
    expect(a).not.toBe(b);
    expect(await provider.getRestingHR(daysAgo(3))).toBe(a);
    expect(a).toBeGreaterThanOrEqual(50);
    expect(a).toBeLessThanOrEqual(60);
    expect(await provider.getRestingHR()).toBe(54);
    expect(await provider.getRestingHR(NOW)).toBe(54);
  });

  it("puts samples for a past day on that day", async () => {
    const day = daysAgo(2);
    const sameDay = (iso: string) =>
      new Date(iso).toDateString() === day.toDateString();
    expect((await provider.getStressSamples(day)).every((s) => sameDay(s.timestamp))).toBe(true);
    expect((await provider.getGlucose(day)).samples.every((s) => sameDay(s.timestamp))).toBe(true);
    expect((await provider.getHeartRate(day)).every((s) => sameDay(s.timestamp))).toBe(true);
    expect((await provider.getHRV(day)).every((s) => sameDay(s.timestamp))).toBe(true);
  });

  it("scales other readings within range for past days", async () => {
    const rr = await provider.getRespiratoryRate(daysAgo(3));
    expect(rr).toBeGreaterThanOrEqual(13.5);
    expect(rr).toBeLessThanOrEqual(15.5);
    expect(await provider.getRespiratoryRate()).toBe(14.2);
    expect(await provider.getActiveEnergy()).toBe(468);
    expect((await provider.getNutrition(daysAgo(3))).calories).not.toBe(1840);
    expect((await provider.getNutrition()).calories).toBe(1840);
  });
});

describe("MockHealthProvider.getDayStressSamples", () => {
  it("getDayStressSamples covers the whole past day", async () => {
    const day = daysAgo(2);
    const samples = await new MockHealthProvider().getDayStressSamples(day);
    expect(samples.length).toBeGreaterThan(48);
    expect(
      samples.every((s) => new Date(s.timestamp).getDate() === day.getDate() ||
        // the last bucket ends at midnight
        new Date(s.timestamp).getHours() === 0),
    ).toBe(true);
    expect(new Date(samples[0].timestamp).getHours()).toBe(0);
  });
});

describe("MockHealthProvider.getWorkouts", () => {
  it("leaves out workouts that start after `until`", async () => {
    const since = new Date(Date.now() - 28 * 86_400_000);
    const until = new Date(Date.now() - 14 * 86_400_000);
    const workouts = await new MockHealthProvider().getWorkouts(since, until);
    expect(workouts.length).toBeGreaterThan(0);
    for (const w of workouts) expect(new Date(w.startedAt).getTime()).toBeLessThan(until.getTime());
  });
});
