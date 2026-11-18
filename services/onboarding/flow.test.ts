import {
  afterConnect,
  connectPageState,
  mergeProfile,
  needsProfile,
  skipTarget,
} from "./flow";

const missing = { birthDate: null, sex: null };
const complete = { birthDate: "1990-07-01", sex: "male" as const };

describe("onboarding flow", () => {
  it("skips the intro pages straight to connect", () => {
    expect(skipTarget()).toBe("connect");
  });

  it("prefers the health source and fills gaps from the saved profile", () => {
    expect(
      mergeProfile(
        { birthDate: "1990-03-14", sex: null },
        { birthDate: null, sex: "female" },
      ),
    ).toEqual({ birthDate: "1990-03-14", sex: "female" });
  });

  it("uses the saved profile when the source shares nothing", () => {
    expect(mergeProfile(null, complete)).toEqual(complete);
  });

  it("needs the profile page when either value is missing", () => {
    expect(needsProfile({ birthDate: "1990-07-01", sex: null })).toBe(true);
    expect(needsProfile({ birthDate: null, sex: "male" })).toBe(true);
    expect(needsProfile(complete)).toBe(false);
  });

  it("describes the connect page from the permission state", () => {
    expect(connectPageState("unrequested", true, false)).toBe("connecting");
    expect(connectPageState("granted", false, false)).toBe("connected");
    expect(connectPageState("partial", false, false)).toBe("limited");
    expect(connectPageState("denied", false, false)).toBe("notGranted");
    expect(connectPageState("unrequested", false, false)).toBe("idle");
    expect(connectPageState("mock", false, false)).toBe("idle");
    expect(connectPageState("granted", false, true)).toBe("unavailable");
  });

  it("asks for age and sex only after a granted connection that lacks them", () => {
    expect(afterConnect("granted", missing)).toBe("profile");
    expect(afterConnect("partial", { birthDate: null, sex: "male" })).toBe(
      "profile",
    );
    expect(afterConnect("partial", complete)).toBe("done");
    expect(afterConnect("denied", missing)).toBe("done");
    expect(afterConnect("mock", missing)).toBe("done");
  });
});
