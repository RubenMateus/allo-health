import {
  afterConnect,
  connectPageState,
  finishRoute,
  pageAfterSwipe,
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

describe("pageAfterSwipe", () => {
  const pages = ["welcome", "rings", "places", "connect", "profile"] as const;

  it("follows a swipe through the explainer pages", () => {
    expect(pageAfterSwipe(780, 390, [...pages], 0, true)).toBe(2);
  });

  it("never lets a swipe land past connect", () => {
    expect(pageAfterSwipe(1560, 390, [...pages], 2, true)).toBe(3);
  });

  it("ignores scrolls the app made itself", () => {
    // Android reports momentum for scrollTo; the page set by goTo stands.
    expect(pageAfterSwipe(1560, 390, [...pages], 4, false)).toBe(4);
  });
});

describe("finishRoute", () => {
  it("returns to the Home already underneath after a replay", () => {
    expect(finishRoute(true)).toBe("dismissTo");
  });

  it("replaces the intro with Home on first launch", () => {
    expect(finishRoute(false)).toBe("replace");
  });
});
