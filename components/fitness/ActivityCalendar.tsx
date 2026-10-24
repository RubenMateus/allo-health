import { StyleSheet, Text, View } from "react-native";

import { dayKey, type FitnessDay } from "@/services/metrics";
import { useTheme } from "@/theme/ThemeProvider";
import { spacing, type ColorTokens } from "@/theme/tokens";
import { cn } from "@/utils/cn";
import { formatMonth } from "@/utils/formatters";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const CELL_GAP = 4;
const MONTH_GAP = spacing.lg;

function activityTiers(colors: ColorTokens) {
  return [
    { label: "1 activity", color: colors.heat1 },
    { label: "2 activities", color: colors.primary },
    { label: "3+ activities", color: colors.primaryBright },
  ];
}

function cellColor(colors: ColorTokens, sessions: number) {
  if (sessions <= 0) return colors.surfaceElevatedProse;
  return activityTiers(colors)[Math.min(sessions, 3) - 1]!.color;
}

/** Month grids (weeks start Sunday) for every month the window touches. */
export function ActivityCalendar({
  days,
  width,
}: {
  days: FitnessDay[];
  width: number;
}) {
  const { colors, glow } = useTheme();
  const sessions = new Map(days.map((day) => [day.date, day.sessions]));
  const today = days.at(-1)?.date;
  const months: Date[] = [];
  for (const day of days) {
    const date = new Date(`${day.date}T12:00:00`);
    const month = new Date(date.getFullYear(), date.getMonth(), 1);
    if (!months.some((item) => item.getTime() === month.getTime()))
      months.push(month);
  }
  const monthWidth = (width - MONTH_GAP * (months.length - 1)) / months.length;
  const cellWidth = (monthWidth - CELL_GAP * 6) / 7;
  const activeDays = days.filter((day) => day.sessions > 0).length;

  return (
    <View
      accessible
      accessibilityLabel={`Active on ${activeDays} of the last ${days.length} days`}
    >
      <View className="flex-row" style={styles.months}>
        {months.map((month) => {
          const lead = month.getDay();
          const daysInMonth = new Date(
            month.getFullYear(),
            month.getMonth() + 1,
            0,
          ).getDate();
          const cells = Array.from(
            { length: Math.ceil((lead + daysInMonth) / 7) * 7 },
            (_, index) => {
              const dayNumber = index - lead + 1;
              if (dayNumber < 1 || dayNumber > daysInMonth) return null;
              return dayKey(
                new Date(month.getFullYear(), month.getMonth(), dayNumber),
              );
            },
          );
          return (
            <View key={month.getTime()} style={{ width: monthWidth }}>
              <Text className="type-subheading text-text mb-md text-[14px]">
                {formatMonth(month)}
              </Text>
              <View className="flex-row mb-xs" style={styles.row}>
                {WEEKDAYS.map((letter, index) => (
                  <Text
                    key={index}
                    className="type-mono-small text-text-subtle text-center"
                    style={{ width: cellWidth }}
                  >
                    {letter}
                  </Text>
                ))}
              </View>
              <View className="flex-row flex-wrap" style={styles.grid}>
                {cells.map((key, index) => {
                  const count = key ? sessions.get(key) : undefined;
                  return (
                    <View
                      key={key ?? `blank-${index}`}
                      className={cn(
                        "h-2.5 rounded-sm",
                        key === null
                          ? "bg-transparent"
                          : count === undefined &&
                              "bg-surface-elevated-prose opacity-[0.45]",
                        key === today && "border border-text-muted",
                      )}
                      style={[
                        { width: cellWidth },
                        count !== undefined && {
                          backgroundColor: cellColor(colors, count),
                        },
                        count !== undefined && count >= 3 && glow.recovery,
                      ]}
                    />
                  );
                })}
              </View>
            </View>
          );
        })}
      </View>
      <View className="flex-row justify-between mt-lg">
        {activityTiers(colors).map((tier) => (
          <View key={tier.label} className="flex-row items-center gap-xs">
            <View
              className="w-[7px] h-[7px] rounded-full"
              style={{ backgroundColor: tier.color }}
            />
            <Text className="type-caption text-text-muted">{tier.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  months: { gap: MONTH_GAP },
  row: { gap: CELL_GAP },
  grid: { gap: CELL_GAP },
});
