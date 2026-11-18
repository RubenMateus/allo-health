import {
  Activity,
  BookOpen,
  CirclePlus,
  Ellipsis,
  House,
  ScanHeart,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react-native";
import type { PropsWithChildren } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { AlloMark } from "@/components/brand/AlloMark";
import { GlowRing, type RingMetric } from "@/components/charts/GlowRing";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { Card } from "@/components/ui/primitives";
import type { HealthProfile } from "@/services/health/types";
import type { ConnectPageState } from "@/services/onboarding/flow";
import { useTheme } from "@/theme/ThemeProvider";
import { cn } from "@/utils/cn";

function PageTitle({
  eyebrow,
  title,
  children,
}: PropsWithChildren<{ eyebrow: string; title: string }>) {
  return (
    <View className="gap-sm">
      <Text className="type-badge text-primary uppercase">{eyebrow}</Text>
      <Text className="type-title text-text">{title}</Text>
      {children ? (
        <Text className="type-body text-text-muted">{children}</Text>
      ) : null}
    </View>
  );
}

export function WelcomePage({ sourceName }: { sourceName: string }) {
  const { colors } = useTheme();
  return (
    <View className="flex-1 justify-center gap-3xl">
      <AlloMark size={72} />
      <PageTitle eyebrow="Welcome to Allo" title="Your health, on your phone">
        Allo turns what {sourceName} records into a daily picture of how
        you&apos;re doing: how recovered you are, how hard you&apos;ve pushed,
        and how you slept.
      </PageTitle>
      <Card className="flex-row items-center gap-md">
        <ShieldCheck color={colors.primary} size={22} />
        <Text className="type-body-small text-text-muted flex-1">
          Everything stays on this device. No accounts, no analytics, nothing
          sent anywhere.
        </Text>
      </Card>
    </View>
  );
}

const ringExplainers = [
  {
    title: "Recovery",
    detail:
      "How ready your body is today, from heart rate variability, resting heart rate and last night's sleep.",
  },
  {
    title: "Strain",
    detail:
      "How much load you've put on your body today, from your heart rate, on a 0 to 21 scale.",
  },
  {
    title: "Sleep",
    detail: "How last night compared with the sleep you need.",
  },
];

export function RingsPage() {
  const { gradients } = useTheme();
  const rings: RingMetric[] = [
    {
      label: "STRAIN",
      value: 9.6,
      max: 21,
      colors: gradients.strain,
      status: "Example",
      glowStyle: "strain",
    },
    {
      label: "RECOVERY",
      value: 72,
      max: 100,
      colors: gradients.recovery,
      status: "Example",
      glowStyle: "recovery",
    },
    {
      label: "SLEEP",
      value: 86,
      max: 100,
      colors: gradients.sleep,
      status: "Example",
      glowStyle: "sleep",
    },
  ];
  return (
    <View className="flex-1 justify-center gap-2xl">
      <PageTitle eyebrow="Your day at a glance" title="Three rings" />
      <Card className="px-md py-xl">
        <View className="flex-row justify-between items-start gap-md">
          {rings.map((metric) => (
            <GlowRing key={metric.label} metric={metric} size={88} />
          ))}
        </View>
      </Card>
      <View className="gap-lg">
        {ringExplainers.map(({ title, detail }) => (
          <View key={title} className="gap-2xs">
            <Text className="type-subheading text-text">{title}</Text>
            <Text className="type-body-small text-text-muted">{detail}</Text>
          </View>
        ))}
        <Text className="type-caption text-text-subtle">
          Tap a ring on Home for the full breakdown and the last two weeks.
        </Text>
      </View>
    </View>
  );
}

const places: { Icon: LucideIcon; title: string; detail: string }[] = [
  {
    Icon: House,
    title: "Home",
    detail: "Today's rings, readiness and your target strain.",
  },
  {
    Icon: BookOpen,
    title: "Journal",
    detail: "A quick daily check-in on mood, energy and habits.",
  },
  {
    Icon: Activity,
    title: "Fitness",
    detail: "Workouts, training load, VO₂ max and heart rate zones.",
  },
  {
    Icon: ScanHeart,
    title: "Biomarkers",
    detail: "Long-term trends: HRV, resting heart rate, weight and more.",
  },
  {
    Icon: CirclePlus,
    title: "The + button",
    detail: "Log a check-in, see readiness or sync from anywhere.",
  },
  {
    Icon: Ellipsis,
    title: "Settings",
    detail: "Theme, your age and sex, and health data sync.",
  },
];

export function PlacesPage() {
  const { colors } = useTheme();
  return (
    <View className="flex-1 justify-center gap-2xl">
      <PageTitle eyebrow="Finding your way" title="Where things are" />
      <View className="gap-lg">
        {places.map(({ Icon, title, detail }) => (
          <View key={title} className="flex-row items-center gap-md">
            <View className="w-[38px] h-[38px] rounded-md bg-surface-high items-center justify-center border border-outline-soft">
              <Icon color={colors.primary} size={18} />
            </View>
            <View className="flex-1 gap-2xs">
              <Text className="type-subheading text-text">{title}</Text>
              <Text className="type-body-small text-text-muted">{detail}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const connectCopy: Record<ConnectPageState, string> = {
  idle: "",
  connecting: "Waiting for your answer…",
  connected: "Connected. Your own numbers will show on Home.",
  limited:
    "Connected with limited access. Some cards may stay empty; you can allow more in your phone's health settings.",
  notGranted:
    "Access wasn't granted. You can try again, or look around with sample data for now.",
  unavailable:
    "Health data is only available on iOS and Android. This preview runs on sample data.",
};

export function ConnectPage({
  sourceName,
  state,
  message,
}: {
  sourceName: string;
  state: ConnectPageState;
  message: string | null;
}) {
  const { colors } = useTheme();
  const tone =
    state === "connected"
      ? "text-primary"
      : state === "limited" || state === "notGranted"
        ? "text-stress"
        : "text-text-muted";
  return (
    <View className="flex-1 justify-center gap-2xl">
      <PageTitle eyebrow="Your data" title={`Connect ${sourceName}`}>
        Allo only reads. It never writes to {sourceName}, and nothing leaves
        this phone. You&apos;ll see a list of what Allo asks to read.
      </PageTitle>
      {state === "idle" ? null : (
        <Card className="flex-row items-center gap-md">
          {state === "connecting" ? (
            <ActivityIndicator color={colors.primary} size="small" />
          ) : null}
          <Text className={cn("type-body-small flex-1", tone)}>
            {state === "notGranted" && message ? message : connectCopy[state]}
          </Text>
        </Card>
      )}
    </View>
  );
}

export function ProfilePage({
  initial,
  onSaved,
  onSkip,
}: {
  initial: HealthProfile;
  onSaved: () => void;
  onSkip: () => void;
}) {
  return (
    <View className="flex-1 justify-center gap-2xl">
      <PageTitle eyebrow="One last thing" title="Your age and sex">
        Used to rate VO₂ max, body fat and Fitness Age against people like you.
        Your health app doesn&apos;t share them.
      </PageTitle>
      <ProfileForm initial={initial} submitLabel="Finish" onSaved={onSaved} />
      <Pressable
        accessibilityRole="button"
        onPress={onSkip}
        hitSlop={8}
        className="items-center -mt-lg"
      >
        <Text className="type-caption text-text-subtle">Skip for now</Text>
      </Pressable>
    </View>
  );
}
