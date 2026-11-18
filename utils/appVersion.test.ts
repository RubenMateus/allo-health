import appConfig, { resolveCommit } from "../app.config";
import { formatVersionLabel } from "./appVersion";

describe("formatVersionLabel", () => {
  it("shows version and commit", () => {
    expect(formatVersionLabel("1.2.0", "abc1234")).toBe(
      "Allo Health 1.2.0 (abc1234)",
    );
  });

  it("drops a missing or non-string commit", () => {
    expect(formatVersionLabel("1.2.0", undefined)).toBe("Allo Health 1.2.0");
    expect(formatVersionLabel("1.2.0", 42)).toBe("Allo Health 1.2.0");
  });

  it("falls back to the name alone", () => {
    expect(formatVersionLabel(undefined, undefined)).toBe("Allo Health");
  });
});

describe("resolveCommit", () => {
  it("trims the git output", () => {
    expect(resolveCommit(() => "abc1234\n")).toBe("abc1234");
  });

  it("falls back to dev when git fails or prints nothing", () => {
    expect(
      resolveCommit(() => {
        throw new Error("not a git repository");
      }),
    ).toBe("dev");
    expect(resolveCommit(() => "")).toBe("dev");
  });
});

describe("app.config", () => {
  it("keeps existing extra keys and adds the commit", () => {
    const result = appConfig({
      config: { name: "x", slug: "x", extra: { keep: 1 } },
    } as unknown as Parameters<typeof appConfig>[0]);
    expect(result.extra?.keep).toBe(1);
    expect(typeof result.extra?.commit).toBe("string");
  });
});
