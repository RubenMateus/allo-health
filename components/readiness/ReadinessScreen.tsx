import { Check, LockKeyhole } from "lucide-react-native";
import { Text, View } from "react-native";

import { DetailLayout, DetailSection } from "@/components/detail/DetailLayout";
import { Card, Hairline, Pill } from "@/components/ui/primitives";
import { useHealthDashboard } from "@/hooks/useHealthDashboard";
import {
  coachingEngine,
  coachingInputFrom,
  coachingRules,
  coachingThresholds,
  explainInputs,
  MAX_STRAIN,
  type InputEffect,
} from "@/services/coaching";
import type { DashboardData } from "@/services/health/dashboard";
import { useTheme } from "@/theme/ThemeProvider";
import { cn } from "@/utils/cn";

const modeLabels = {
  push: "Build",
  maintain: "Maintain",
  recover: "Recover",
} as const;

const effects: Record<
  InputEffect,
  { label: string; tone: "positive" | "warning" | "neutral" }
> = {
  "holds-back": { label: "Holding back", tone: "warning" },
  "allows-push": { label: "Room to build", tone: "positive" },
  neutral: { label: "On track", tone: "neutral" },
};

/** Explains the AI readiness card: what the target strain means and which signals produced it. */
export function ReadinessScreen() {
  const { colors } = useTheme();
  const { data } = useHealthDashboard();
  if (!data)
    return <DetailLayout title="Readiness" value={null} status="Loading" />;

  const input = coachingInputFrom(data);
  const coaching = coachingEngine.recommend(input);
  const waiting = data.recoveryScore === null || data.sleepScore === null;

  return (
    <DetailLayout
      title="Readiness"
      value={`${coaching.targetStrain[0]}–${coaching.targetStrain[1]}`}
      unit="TARGET STRAIN"
      status={waiting ? "Waiting for enough signals" : coaching.title}
      caption={`${modeLabels[coaching.mode].toUpperCase()} / ESTIMATE, NOT MEDICAL ADVICE`}
    >
      <DetailSection title="What the target means">
        <Card className="gap-md">
          <Text className="type-body-small text-text-muted">
            Strain is how hard your heart worked today, on a 0 to {MAX_STRAIN}{" "}
            scale built from time in heart rate zones and active energy. Aim to
            end the day inside the highlighted band.
          </Text>
          <StrainScale
            target={coaching.targetStrain}
            current={data.strainScore}
          />
        </Card>
      </DetailSection>

      <DetailSection title="What it's based on">
        <Card className="gap-md">
          <InputRows data={data} />
        </Card>
      </DetailSection>

      <DetailSection title="Behind recovery">
        <Card className="gap-md">
          <View className="flex-row">
            <Signal
              label="HRV"
              value={data.hrv === null ? null : `${Math.round(data.hrv)}`}
              unit="ms"
            />
            <Signal
              label="RESTING HR"
              value={
                data.restingHeartRate === null
                  ? null
                  : `${Math.round(data.restingHeartRate)}`
              }
              unit="bpm"
            />
            <Signal
              label="RESP. RATE"
              value={
                data.respiratoryRate === null
                  ? null
                  : data.respiratoryRate.toFixed(1)
              }
              unit="/min"
            />
          </View>
          <Text className="type-caption text-text-muted">
            Recovery compares last night to your baseline: HRV counts for 35%,
            resting heart rate 30%, sleep 25% and breathing rate 10%.
          </Text>
        </Card>
      </DetailSection>

      <DetailSection title="How it's decided">
        <Card className="gap-md">
          {coachingRules.map((rule, index) => {
            const active = rule.mode === coaching.mode;
            return (
              <View key={rule.mode} className="gap-md">
                {index > 0 ? <Hairline /> : null}
                <View className="flex-row items-center gap-md">
                  <View
                    className={cn(
                      "w-6 h-6 rounded-full items-center justify-center border border-outline-soft",
                      active && "bg-primary border-primary",
                    )}
                  >
                    {active ? (
                      <Check color={colors.canvas} size={14} strokeWidth={3} />
                    ) : null}
                  </View>
                  <View className="flex-1 gap-2xs">
                    <Text
                      className={cn(
                        "type-subheading text-text-muted",
                        active && "text-text",
                      )}
                    >
                      {modeLabels[rule.mode]}
                    </Text>
                    <Text className="type-caption text-text-subtle">
                      {rule.when}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })}
        </Card>
      </DetailSection>

      <View className="flex-row items-center gap-sm">
        <LockKeyhole color={colors.textSubtle} size={14} />
        <Text className="type-caption text-text-subtle flex-1">
          Worked out on this phone from your health data. Nothing is sent
          anywhere.
        </Text>
      </View>
    </DetailLayout>
  );
}

function StrainScale({
  target,
  current,
}: {
  target: readonly [number, number];
  current: number | null;
}) {
  const percent = (value: number) =>
    `${(Math.min(Math.max(value, 0), MAX_STRAIN) / MAX_STRAIN) * 100}%` as const;
  return (
    <View className="gap-xs">
      <View className="h-6 justify-center">
        <View className="h-2 rounded-full bg-track" />
        <View
          className="absolute h-2 rounded-full bg-primary"
          style={{
            left: percent(target[0]),
            width: percent(target[1] - target[0]),
          }}
        />
        {current === null ? null : (
          <View
            accessibilityLabel={`Strain so far ${current.toFixed(1)}`}
            className="absolute w-[3px] h-6 -ml-[1.5px] rounded-full bg-text"
            style={{ left: percent(current) }}
          />
        )}
      </View>
      <View className="flex-row justify-between">
        {[0, 7, 14, MAX_STRAIN].map((tick) => (
          <Text key={tick} className="type-mono-small text-text-subtle">
            {tick}
          </Text>
        ))}
      </View>
      <Text className="type-caption text-text-muted">
        {current === null
          ? "No strain recorded yet today."
          : `So far today: ${current.toFixed(1)}`}
      </Text>
    </View>
  );
}

function InputRows({ data }: { data: DashboardData }) {
  const effect = explainInputs(coachingInputFrom(data));
  const t = coachingThresholds;
  const rows = [
    {
      label: "Recovery",
      value: data.recoveryScore,
      unit: "/ 100",
      effect: effect.recovery,
      rule: `Under ${t.recoverBelowRecovery} means recover, ${t.pushFromRecovery}+ leaves room to build.`,
    },
    {
      label: "Sleep",
      value: data.sleepScore,
      unit: "/ 100",
      effect: effect.sleep,
      rule: `Under ${t.recoverBelowSleep} means recover.`,
    },
    {
      label: "Strain so far",
      value: data.strainScore,
      unit: `/ ${MAX_STRAIN}`,
      effect: effect.strain,
      rule: `At ${t.pushBelowStrain} or more, today's load is already high enough to stop building.`,
    },
  ];
  return rows.map((row, index) => (
    <View key={row.label} className="gap-md">
      {index > 0 ? <Hairline /> : null}
      <View className="gap-xs">
        <View className="flex-row items-center justify-between gap-sm">
          <Text className="type-subheading text-text">{row.label}</Text>
          {row.value === null ? (
            <Pill>NO DATA</Pill>
          ) : (
            <Pill tone={effects[row.effect].tone}>
              {effects[row.effect].label}
            </Pill>
          )}
        </View>
        <Text className="type-mono text-text tabular-nums">
          {row.value === null
            ? "--"
            : Number.isInteger(row.value)
              ? row.value
              : row.value.toFixed(1)}
          <Text className="type-mono-small text-text-subtle"> {row.unit}</Text>
        </Text>
        <Text className="type-caption text-text-subtle">
          {row.value === null
            ? "Missing, so a neutral value is used until it syncs."
            : row.rule}
        </Text>
      </View>
    </View>
  ));
}

function Signal({
  label,
  value,
  unit,
}: {
  label: string;
  value: string | null;
  unit: string;
}) {
  return (
    <View className="flex-1 gap-2xs">
      <Text className="type-caption text-text-muted">{label}</Text>
      <Text className="type-mono text-text tabular-nums">
        {value ?? "--"}
        {value ? (
          <Text className="type-mono-small text-text-subtle"> {unit}</Text>
        ) : null}
      </Text>
    </View>
  );
}
