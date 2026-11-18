import { useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { ChevronLeft } from "lucide-react-native";
import { useEffect, useRef, useState, type ComponentRef } from "react";
import {
  ActivityIndicator,
  BackHandler,
  Platform,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  ConnectPage,
  PlacesPage,
  ProfilePage,
  RingsPage,
  WelcomePage,
} from "@/components/onboarding/pages";
import type { HealthProfile } from "@/services/health/types";
import {
  afterConnect,
  connectPageState,
  finishRoute,
  INTRO_PAGES,
  mergeProfile,
  pageAfterSwipe,
  skipTarget,
  type OnboardingPage,
} from "@/services/onboarding/flow";
import { useHealthStore } from "@/stores/healthStore";
import { useProfileStore } from "@/stores/profileStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useTheme } from "@/theme/ThemeProvider";
import { cn } from "@/utils/cn";

const sourceName =
  Platform.OS === "ios"
    ? "Apple Health"
    : Platform.OS === "android"
      ? "Health Connect"
      : "your health app";

export function OnboardingScreen() {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const queryClient = useQueryClient();
  const dragging = useRef(false);
  const scroller = useRef<ComponentRef<typeof ScrollView>>(null);
  const permissionState = useHealthStore((state) => state.permissionState);
  const permissionMessage = useHealthStore((state) => state.permissionMessage);
  const requestConnection = useHealthStore((state) => state.requestConnection);
  const completeOnboarding = useSettingsStore(
    (state) => state.completeOnboarding,
  );

  const [pages, setPages] = useState<OnboardingPage[]>(INTRO_PAGES);
  const [index, setIndex] = useState(0);
  const [connecting, setConnecting] = useState(false);
  const [checkingProfile, setCheckingProfile] = useState(false);
  const [profile, setProfile] = useState<HealthProfile | null>(null);

  const page = pages[index];
  const connectState = connectPageState(
    permissionState,
    connecting,
    Platform.OS === "web",
  );
  const connected = connectState === "connected" || connectState === "limited";

  const goTo = (next: number) => {
    setIndex(next);
    scroller.current?.scrollTo({ x: next * width, animated: true });
  };

  const finishing = useRef(false);
  const finish = () => {
    if (finishing.current) return;
    finishing.current = true;
    completeOnboarding();
    if (finishRoute(router.canGoBack()) === "dismissTo") router.dismissTo("/");
    else router.replace("/");
  };

  // Android's back button walks back through the pages and never skips the intro.
  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        if (index > 0) goTo(index - 1);
        return true;
      },
    );
    return () => subscription.remove();
  });

  const connect = async () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setConnecting(true);
    try {
      await requestConnection();
      await queryClient.invalidateQueries();
    } finally {
      setConnecting(false);
    }
  };

  // After connecting, ask for age and sex only if the health source left one out.
  const continueFromConnect = async () => {
    setCheckingProfile(true);
    try {
      const { provider, permissionState: permission } =
        useHealthStore.getState();
      const { birthDate, sex } = useProfileStore.getState();
      const source = await provider.getProfile().catch(() => null);
      const merged = mergeProfile(source, { birthDate, sex });
      if (afterConnect(permission, merged) === "done") {
        finish();
        return;
      }
      setProfile(merged);
      setPages([...INTRO_PAGES, "profile"]);
      // Wait a frame so the new page exists before scrolling to it.
      requestAnimationFrame(() => goTo(INTRO_PAGES.length));
    } finally {
      setCheckingProfile(false);
    }
  };

  type PrimaryAction = "next" | "connect" | "continue" | "sample";
  const primaryAction: PrimaryAction | null =
    page === "profile"
      ? null
      : page !== "connect"
        ? "next"
        : connected
          ? "continue"
          : connectState === "unavailable"
            ? "sample"
            : "connect";
  const primaryLabel: Record<PrimaryAction, string> = {
    next: "Next",
    connect:
      connectState === "notGranted" ? "Try again" : `Connect ${sourceName}`,
    continue: "Continue",
    sample: "Continue with sample data",
  };
  const primaryBusy =
    (primaryAction === "connect" && connecting) ||
    (primaryAction === "continue" && checkingProfile);

  const onPrimary = () => {
    if (primaryAction === "next") goTo(index + 1);
    else if (primaryAction === "connect") void connect();
    else if (primaryAction === "continue") void continueFromConnect();
    else if (primaryAction === "sample") finish();
  };

  return (
    <SafeAreaView className="flex-1 bg-canvas">
      <View className="flex-row items-center justify-between px-margin h-[44px]">
        {index > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            hitSlop={8}
            onPress={() => goTo(index - 1)}
            className="w-[36px] h-[36px] rounded-full border border-outline-soft items-center justify-center active:opacity-70"
          >
            <ChevronLeft color={colors.textMuted} size={18} />
          </Pressable>
        ) : (
          <View />
        )}
        {index < pages.indexOf(skipTarget()) ? (
          <Pressable
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => goTo(pages.indexOf(skipTarget()))}
          >
            <Text className="type-caption text-text-subtle">Skip</Text>
          </Pressable>
        ) : null}
      </View>

      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        // Swiping only moves through the explainer pages. Connect needs a choice.
        scrollEnabled={index < pages.indexOf("connect")}
        showsHorizontalScrollIndicator={false}
        onScrollBeginDrag={() => {
          dragging.current = true;
        }}
        onMomentumScrollEnd={(event) => {
          setIndex(
            pageAfterSwipe(
              event.nativeEvent.contentOffset.x,
              width,
              pages,
              index,
              dragging.current,
            ),
          );
          dragging.current = false;
        }}
        className="flex-1"
      >
        {pages.map((key) => (
          <ScrollView
            key={key}
            style={{ width }}
            contentContainerClassName="flex-grow px-margin py-xl"
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {key === "welcome" ? <WelcomePage sourceName={sourceName} /> : null}
            {key === "rings" ? <RingsPage /> : null}
            {key === "places" ? <PlacesPage /> : null}
            {key === "connect" ? (
              <ConnectPage
                sourceName={sourceName}
                state={connectState}
                message={permissionMessage}
              />
            ) : null}
            {key === "profile" && profile ? (
              <ProfilePage initial={profile} onSaved={finish} onSkip={finish} />
            ) : null}
          </ScrollView>
        ))}
      </ScrollView>

      <View className="px-margin pb-lg gap-lg">
        <View className="flex-row justify-center gap-xs">
          {pages.map((key, dot) => (
            <View
              key={key}
              className={cn(
                "h-[6px] rounded-full bg-surface-high",
                dot === index ? "w-[18px] bg-primary" : "w-[6px]",
              )}
            />
          ))}
        </View>
        {primaryAction ? (
          <Pressable
            accessibilityRole="button"
            disabled={primaryBusy}
            onPress={onPrimary}
            className={cn(
              "min-h-[50px] rounded-full bg-primary-bright items-center justify-center active:opacity-70",
              primaryBusy && "opacity-70",
            )}
          >
            {primaryBusy ? (
              <ActivityIndicator color={colors.canvas} size="small" />
            ) : (
              <Text className="type-subheading text-canvas">
                {primaryLabel[primaryAction]}
              </Text>
            )}
          </Pressable>
        ) : null}
        {page === "connect" && !connected && connectState !== "unavailable" ? (
          <Pressable
            accessibilityRole="button"
            hitSlop={8}
            onPress={finish}
            className="items-center"
          >
            <Text className="type-caption text-text-subtle">
              Look around with sample data (not your numbers)
            </Text>
          </Pressable>
        ) : null}
      </View>
    </SafeAreaView>
  );
}
