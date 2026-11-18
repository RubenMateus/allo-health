import {
  dayFit,
  lastDays,
  loadBalance,
  loadBalanceSummary,
  type LoadDay,
} from "./loadBalance";

const day = (
  strain: number | null,
  recovery: number | null,
  date = "2026-11-10",
): LoadDay => ({ date, strain, recovery });

describe("dayFit", () => {
  it("flags a hard day on low recovery as over", () => {
    expect(dayFit(day(14, 30))).toBe("over");
    expect(dayFit(day(12, 44))).toBe("over");
  });

  it("flags an easy day on high recovery as under", () => {
    expect(dayFit(day(8, 80))).toBe("under");
    expect(dayFit(day(11.9, 75))).toBe("under");
  });

  it("calls everything else matched", () => {
    expect(dayFit(day(14, 80))).toBe("matched");
    expect(dayFit(day(6, 30))).toBe("matched");
    expect(dayFit(day(12, 45))).toBe("matched");
  });

  it("is unknown when either score is missing", () => {
    expect(dayFit(day(null, 80))).toBe("unknown");
    expect(dayFit(day(10, null))).toBe("unknown");
  });
});

describe("loadBalance", () => {
  it("gives no verdict with fewer than 3 scored days", () => {
    const result = loadBalance([
      day(10, 60),
      day(null, 70),
      day(12, null),
      day(9, 55),
    ]);
    expect(result.verdict).toBeNull();
    expect(result.scoredDays).toBe(2);
    expect(loadBalanceSummary(result)).toContain("You have 2");
  });

  it("is over-reaching with 2 hard days on low recovery", () => {
    const result = loadBalance([
      day(14, 30),
      day(8, 60),
      day(15, 40),
      day(10, 70),
    ]);
    expect(result.verdict).toBe("over-reaching");
    expect(result.overDays).toBe(2);
  });

  it("over-reaching wins over room to push", () => {
    const result = loadBalance([
      day(14, 30),
      day(14, 30),
      day(5, 90),
      day(5, 90),
      day(5, 90),
    ]);
    expect(result.verdict).toBe("over-reaching");
  });

  it("has room to push with 3 easy days on high recovery", () => {
    const result = loadBalance([
      day(6, 80),
      day(14, 85),
      day(7, 90),
      day(5, 78),
    ]);
    expect(result.verdict).toBe("room-to-push");
    expect(result.underDays).toBe(3);
  });

  it("is balanced otherwise, and averages only scored days", () => {
    const result = loadBalance([
      day(10, 60),
      day(14, 80),
      day(null, 90),
      day(6, 40),
    ]);
    expect(result.verdict).toBe("balanced");
    expect(result.averageStrain).toBe(10);
    expect(result.averageRecovery).toBe(60);
  });

  it("only looks at the last 7 days", () => {
    const old = [day(15, 20), day(15, 20), day(15, 20)];
    const recent = Array.from({ length: 7 }, () => day(10, 60));
    expect(loadBalance([...old, ...recent]).verdict).toBe("balanced");
  });
});

describe("lastDays", () => {
  it("fills missing days, crossing a month end", () => {
    const result = lastDays(
      [day(10, 60, "2026-10-30"), day(8, 70, "2026-11-01")],
      4,
    );
    expect(result.map((entry) => entry.date)).toEqual([
      "2026-10-29",
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
    ]);
    expect(result[0]).toEqual(day(null, null, "2026-10-29"));
    expect(result[1]).toEqual(day(10, 60, "2026-10-30"));
  });

  it("is empty without days", () => {
    expect(lastDays([], 14)).toEqual([]);
  });
});
