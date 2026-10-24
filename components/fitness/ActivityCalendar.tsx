import { StyleSheet, Text, View } from "react-native";

import { dayKey, type FitnessDay } from "@/services/metrics";
import { colors, glow, radii, spacing, typography } from "@/theme/tokens";
import { formatMonth } from "@/utils/formatters";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const CELL_GAP = 4;
const MONTH_GAP = spacing.lg;

const tiers = [
  { label: "1 activity", color: colors.heat1 },
  { label: "2 activities", color: colors.primary },
  { label: "3+ activities", color: colors.primaryBright },
];

function cellColor(sessions: number) {
  if (sessions <= 0) return colors.surfaceElevatedProse;
  return tiers[Math.min(sessions, 3) - 1]!.color;
}

/** Month grids (weeks start Sunday) for every month the window touches. */
export function ActivityCalendar({
  days,
  width,
}: {
  days: FitnessDay[];
  width: number;
}) {
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
      <View style={styles.months}>
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
              <Text style={styles.monthName}>{formatMonth(month)}</Text>
              <View style={styles.row}>
                {WEEKDAYS.map((letter, index) => (
                  <Text
                    key={index}
                    style={[styles.weekday, { width: cellWidth }]}
                  >
                    {letter}
                  </Text>
                ))}
              </View>
              <View style={styles.grid}>
                {cells.map((key, index) => {
                  const count = key ? sessions.get(key) : undefined;
                  return (
                    <View
                      key={key ?? `blank-${index}`}
                      style={[
                        styles.cell,
                        { width: cellWidth },
                        key === null
                          ? styles.blank
                          : count === undefined
                            ? styles.outside
                            : { backgroundColor: cellColor(count) },
                        count !== undefined && count >= 3 && glow.recovery,
                        key === today && styles.today,
                      ]}
                    />
                  );
                })}
              </View>
            </View>
          );
        })}
      </View>
      <View style={styles.legend}>
        {tiers.map((tier) => (
          <View key={tier.label} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: tier.color }]} />
            <Text style={styles.legendText}>{tier.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  months: { flexDirection: "row", gap: MONTH_GAP },
  monthName: {
    ...typography.subheading,
    fontSize: 14,
    color: colors.text,
    marginBottom: spacing.md,
  },
  row: { flexDirection: "row", gap: CELL_GAP, marginBottom: spacing.xs },
  weekday: {
    ...typography.monoSmall,
    color: colors.textSubtle,
    textAlign: "center",
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: CELL_GAP },
  cell: { height: 10, borderRadius: radii.sm },
  blank: { backgroundColor: colors.transparent },
  outside: { backgroundColor: colors.surfaceElevatedProse, opacity: 0.45 },
  today: { borderWidth: 1, borderColor: colors.textMuted },
  legend: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.lg,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  legendDot: { width: 7, height: 7, borderRadius: radii.full },
  legendText: { ...typography.caption, color: colors.textMuted },
});
