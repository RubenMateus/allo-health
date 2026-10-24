import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  CalendarDays,
  ChevronRight,
  RotateCw,
} from "lucide-react-native";
import { Pressable, Text, useWindowDimensions, View } from "react-native";

import {
  biomarkerMeta,
  chartValues,
  displayValue,
  toneColor,
} from "@/components/biomarkers/meta";
import { ProfileCard } from "@/components/biomarkers/ProfileCard";
import { AgeDial } from "@/components/charts/AgeDial";
import { Sparkline } from "@/components/charts/Sparkline";
import { SettingsButton } from "@/components/settings/SettingsButton";
import { Card, EmptyState, Pill, Screen } from "@/components/ui/primitives";
import { useBiomarkers } from "@/hooks/useBiomarkers";
import {
  biomarkerKinds,
  type Biomarker,
  type BiomarkersData,
  type FitnessAge,
} from "@/services/health/biomarkers";
import type { BiomarkerKind } from "@/services/health/types";
import { bucketAverages, dayKey } from "@/services/metrics";
import { useTheme } from "@/theme/ThemeProvider";
import { cn } from "@/utils/cn";
import { formatDay, formatNumber } from "@/utils/formatters";

const SPARK_DAYS = 90;

export function openBiomarker(kind: BiomarkerKind) {
  void Haptics.selectionAsync();
  router.push({ pathname: "/biomarkers/[kind]", params: { kind } });
}

export function BiomarkersScreen() {
  const { colors } = useTheme();
  const { data, isLoading, isFetching, isError, refetch } = useBiomarkers();

  return (
    <Screen
      refreshing={isFetching && !isLoading}
      onRefresh={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        void refetch();
      }}
    >
      <View className="flex-row items-center gap-md pb-md mb-xl border-b-hairline border-b-outline-soft">
        <CalendarDays color={colors.primary} size={20} />
        <Text className="type-subheading text-text flex-1">
          {formatTodayShort()}
        </Text>
        {data ? (
          data.source === "mock" ? (
            <Pill>SAMPLE</Pill>
          ) : (
            <View className="flex-row items-center gap-xs px-md py-xs rounded-full border border-outline-soft bg-surface">
              <View className="w-[7px] h-[7px] rounded-full bg-primary" />
              <Text className="type-caption text-text">Synced</Text>
            </View>
          )
        ) : null}
        <SettingsButton />
      </View>

      <View className="gap-2xs mb-2xl">
        <Text className="type-title text-text">Biomarkers</Text>
        <Text className="type-caption text-text-muted">Last 12 months</Text>
      </View>

      {isLoading || !data ? (
        isError ? (
          <Card>
            <EmptyState
              title="Biomarkers unavailable"
              detail="We couldn't read from your health source. Check that access is allowed, then try again."
            />
            <Pressable
              accessibilityRole="button"
              onPress={() => void refetch()}
              className="min-h-[48px] rounded-full bg-primary-bright flex-row items-center justify-center gap-sm"
            >
              <RotateCw color={colors.canvas} size={16} />
              <Text className="type-subheading text-canvas">Try again</Text>
            </Pressable>
          </Card>
        ) : null
      ) : (
        <BiomarkerSections data={data} />
      )}
    </Screen>
  );
}

function BiomarkerSections({ data }: { data: BiomarkersData }) {
  const available = biomarkerKinds
    .map((kind) => data.biomarkers[kind])
    .filter((biomarker) => biomarker.latest);
  const needsProfile = !data.profile.birthDate || !data.profile.sex;

  return (
    <View className="gap-2xl">
      {data.fitnessAge ? (
        <FitnessAgeCard fitnessAge={data.fitnessAge} />
      ) : (
        <Card>
          <EmptyState
            title="Fitness Age"
            detail={
              data.biomarkers.vo2Max.latest
                ? "Add your sex below to estimate your Fitness Age from VO₂ max."
                : "Fitness Age needs a VO₂ max reading. Many watches estimate it from outdoor walks and runs."
            }
          />
        </Card>
      )}

      {needsProfile ? <ProfileCard profile={data.profile} /> : null}

      <View className="gap-md">
        <Text className="type-subheading text-text">Other biomarkers</Text>
        {available.length ? (
          available.map((biomarker) => (
            <BiomarkerRow key={biomarker.kind} biomarker={biomarker} />
          ))
        ) : (
          <Card>
            <EmptyState
              title="No readings yet"
              detail="Weight, body composition, HRV, resting heart rate, VO₂ max, blood oxygen and respiratory rate will appear here once your health app has them."
            />
          </Card>
        )}
      </View>
    </View>
  );
}

function FitnessAgeCard({ fitnessAge }: { fitnessAge: FitnessAge }) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const dialSize = Math.min(width - 64, 300);
  const reference = fitnessAge.chronologicalAge;
  const centre = reference ?? fitnessAge.value;
  const min = Math.floor(Math.min(centre, fitnessAge.value) - 8);
  const max = Math.ceil(Math.max(centre, fitnessAge.value) + 8);
  const gap = reference === null ? null : fitnessAge.value - reference;
  const younger = gap !== null && gap <= 0;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Fitness Age ${formatNumber(fitnessAge.value, 1)} years. Opens VO2 max details.`}
      onPress={() => openBiomarker("vo2Max")}
      className="active:opacity-75"
    >
      <Card className="pb-md">
        <View className="flex-row items-center justify-between">
          <Text className="type-badge text-text text-[11px]">FITNESS AGE</Text>
          <ChevronRight color={colors.textSubtle} size={16} />
        </View>
        <View>
          <AgeDial
            value={fitnessAge.value}
            reference={reference}
            min={min}
            max={max}
            size={dialSize}
            color={younger || gap === null ? colors.primary : colors.stress}
          />
          <View
            className="items-center justify-center pt-lg absolute inset-0"
            pointerEvents="none"
          >
            <Text className="type-display text-text tabular-nums text-[48px] leading-[54px]">
              {formatNumber(fitnessAge.value, 1)}
            </Text>
            <Text className="type-caption text-text-muted">years</Text>
            {gap !== null ? (
              <View
                className={cn(
                  "mt-md px-md py-xs rounded-full border border-primary-border bg-primary-wash",
                  !younger && "border-stress-border bg-stress-wash",
                )}
              >
                <Text
                  className={cn(
                    "type-caption text-primary",
                    !younger && "text-stress",
                  )}
                >
                  {Math.abs(gap) < 0.5
                    ? "Matches your age"
                    : `${formatNumber(Math.abs(gap), 1)} yrs ${younger ? "younger" : "older"}`}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
        <View className="flex-row pt-md border-t-hairline border-t-outline-soft">
          <HeroStat
            label="Chronological"
            value={reference === null ? "—" : `${reference}`}
          />
          <HeroStat
            label="VO₂ max"
            value={formatNumber(fitnessAge.vo2Max, 1)}
          />
          <HeroStat
            label="For your age"
            value={
              fitnessAge.percentile === null
                ? "—"
                : fitnessAge.percentile >= 50
                  ? `Top ${Math.max(1, Math.round(100 - fitnessAge.percentile))}%`
                  : `Bottom ${Math.max(1, Math.round(fitnessAge.percentile))}%`
            }
          />
        </View>
        <Text className="type-mono-small text-text-subtle text-center mt-md">
          From VO₂ max on {formatDay(dayKey(new Date(fitnessAge.measuredAt)))}
        </Text>
      </Card>
    </Pressable>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-1 items-center gap-2xs">
      <Text className="type-caption text-text-subtle">{label}</Text>
      <Text className="type-subheading text-primary tabular-nums">{value}</Text>
    </View>
  );
}

function BiomarkerRow({ biomarker }: { biomarker: Biomarker }) {
  const { colors } = useTheme();
  const meta = biomarkerMeta[biomarker.kind];
  const latest = biomarker.latest!;
  const { value, unit } = displayValue(biomarker.kind, latest);
  const cutoff = new Date(latest.timestamp).getTime() - SPARK_DAYS * 86_400_000;
  const recent = biomarker.history.filter(
    (sample) => new Date(sample.timestamp).getTime() >= cutoff,
  );
  const status = biomarker.status;
  const statusColor = status
    ? toneColor(status.tone, colors)
    : colors.textMuted;
  const TrendIcon =
    status?.basis === "trend"
      ? biomarker.trend?.direction === "increasing"
        ? ArrowUp
        : biomarker.trend?.direction === "decreasing"
          ? ArrowDown
          : ArrowRight
      : null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${meta.title}: ${status ? `${status.label}, ` : ""}${value} ${unit}`}
      onPress={() => openBiomarker(biomarker.kind)}
      className="active:opacity-75"
    >
      <Card className="flex-row items-center gap-md py-md">
        <View className="flex-1 gap-xs">
          <Text className="type-subheading text-text">{meta.title}</Text>
          <View className="flex-row items-center gap-xs">
            {status ? (
              <>
                {TrendIcon ? <TrendIcon color={statusColor} size={13} /> : null}
                <Text className="type-caption" style={{ color: statusColor }}>
                  {status.label}
                </Text>
                <Text className="type-caption text-text-subtle">•</Text>
              </>
            ) : null}
            <Text className="type-mono text-text tabular-nums text-[13px]">
              {value} <Text className="text-text-subtle">{unit}</Text>
            </Text>
          </View>
        </View>
        {recent.length > 1 ? (
          <View className="w-24">
            <Sparkline
              values={chartValues(biomarker.kind, bucketAverages(recent, 7))}
              color={colors[meta.accent]}
              width={96}
              height={44}
              fill={false}
              accessibilityLabel={`${meta.title} over the last ${SPARK_DAYS} days`}
            />
          </View>
        ) : null}
      </Card>
    </Pressable>
  );
}

function formatTodayShort() {
  return `Today, ${new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date())}`;
}
