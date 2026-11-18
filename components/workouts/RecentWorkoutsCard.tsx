import { ChevronRight } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";

import { Card, Hairline } from "@/components/ui/primitives";
import {
  formatSessionDate,
  openWorkout,
  openWorkouts,
  StrainPill,
  WorkoutIcon,
  workoutStats,
} from "@/components/workouts/workoutUi";
import type { FitnessData } from "@/services/health/fitness";
import {
  workoutKind,
  workoutStrain,
  workoutTitle,
} from "@/services/metrics/workouts";
import { useTheme } from "@/theme/ThemeProvider";

/** The latest sessions on the Fitness tab, with a way into the full list. */
export function RecentWorkoutsCard({ data }: { data: FitnessData }) {
  const { colors } = useTheme();
  const profile = {
    restingHeartRate: data.restingHeartRate,
    maxHeartRate: data.maxHeartRate,
  };
  const recent = data.workouts.slice(0, 3);
  if (!recent.length) return null;
  return (
    <View className="gap-md">
      <View className="flex-row items-baseline justify-between">
        <Text className="type-subheading text-text">Workouts</Text>
        <Text className="type-mono text-text-subtle">
          {data.workoutCount} in 30 days
        </Text>
      </View>
      <Card className="p-0 overflow-hidden">
        {recent.map((workout, index) => {
          const kind = workoutKind(workout);
          const stats = workoutStats(workout, kind).slice(0, 2);
          return (
            <View key={workout.id}>
              {index > 0 ? <Hairline className="ml-[68px]" /> : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${workoutTitle(workout)}, ${formatSessionDate(workout.startedAt)}. Open details`}
                onPress={() => openWorkout(workout.id)}
                className="flex-row items-center gap-md px-lg py-md active:bg-surface"
              >
                <WorkoutIcon kind={kind} />
                <View className="flex-1 gap-2xs">
                  <Text className="type-subheading text-text" numberOfLines={1}>
                    {workoutTitle(workout)}
                  </Text>
                  <Text className="type-mono text-text-muted" numberOfLines={1}>
                    {formatSessionDate(workout.startedAt)} ·{" "}
                    {stats
                      .map((stat) =>
                        stat.unit ? `${stat.value} ${stat.unit}` : stat.value,
                      )
                      .join(" · ")}
                  </Text>
                </View>
                <StrainPill strain={workoutStrain(workout, profile)} />
              </Pressable>
            </View>
          );
        })}
        <Hairline />
        <Pressable
          accessibilityRole="button"
          onPress={openWorkouts}
          className="flex-row items-center justify-center gap-xs min-h-[48px] active:bg-surface"
        >
          <Text className="type-caption text-primary">See all workouts</Text>
          <ChevronRight color={colors.primary} size={14} />
        </Pressable>
      </Card>
    </View>
  );
}
