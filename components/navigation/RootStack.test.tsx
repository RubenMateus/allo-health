import { Slot } from "expo-router";
import { act, renderRouter, screen } from "expo-router/testing-library";
import { Text } from "react-native";

import { RootStack } from "@/components/navigation/RootStack";
import { useSettingsStore } from "@/stores/settingsStore";

jest.mock("@/services/settings/storage", () => ({
  settingsStorage: {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
  },
}));

function Layout() {
  const onboarded = useSettingsStore(
    (state) => state.onboardingCompletedAt !== null,
  );
  return <RootStack onboarded={onboarded} canvas="#101319" />;
}

function page(label: string) {
  function Page() {
    return <Text>{label}</Text>;
  }
  return Page;
}

const routes = {
  _layout: {
    default: Layout,
    unstable_settings: { initialRouteName: "(tabs)" },
  },
  "(tabs)/_layout": () => <Slot />,
  "(tabs)/index": page("Home"),
  onboarding: page("Intro"),
  settings: page("Settings"),
  strain: page("Strain"),
  recovery: page("Recovery"),
  sleep: page("Sleep"),
  readiness: page("Readiness"),
  "biomarkers/[kind]": page("Biomarker"),
  "fitness/[metric]": page("Metric"),
  "workouts/index": page("Workouts"),
  "workouts/[id]": page("Workout"),
};

describe("root stack", () => {
  beforeEach(() => {
    useSettingsStore.setState({ onboardingCompletedAt: null });
  });

  it("opens the intro on first launch", async () => {
    const router = await renderRouter(routes, { initialUrl: "/" });
    expect(router.getPathname()).toBe("/onboarding");
    expect(screen.getByText("Intro")).toBeTruthy();
  });

  it("sends a first-launch deep link to the intro", async () => {
    const router = await renderRouter(routes, { initialUrl: "/strain" });
    expect(router.getPathname()).toBe("/onboarding");
  });

  it("shows Home once the intro is finished", async () => {
    const router = await renderRouter(routes, { initialUrl: "/" });
    await act(async () => {
      useSettingsStore.getState().completeOnboarding();
    });
    expect(router.getPathname()).toBe("/");
    expect(screen.getByText("Home")).toBeTruthy();
  });

  it("replays the intro and returns to a single Home", async () => {
    useSettingsStore.getState().completeOnboarding();
    const router = await renderRouter(routes, { initialUrl: "/settings" });
    await act(async () => {
      useSettingsStore.getState().resetOnboarding();
    });
    expect(router.getPathname()).toBe("/onboarding");
    await act(async () => {
      useSettingsStore.getState().completeOnboarding();
    });
    expect(router.getPathname()).toBe("/");
    expect(screen.getAllByText("Home")).toHaveLength(1);
  });
});
