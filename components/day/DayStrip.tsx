import * as Haptics from "expo-haptics";
import { ChevronDown } from "lucide-react-native";
import { useMemo, useState } from "react";
import { PanResponder, Pressable, Text, View } from "react-native";

import { Pill } from "@/components/ui/primitives";
import { useDayScores } from "@/hooks/useDayScores";
import { fromDayKey, shiftDayKey, toDayKey } from "@/services/journal";
import { useDayStore, useSelectedDayKey } from "@/stores/dayStore";
import { useTheme } from "@/theme/ThemeProvider";
import { cn } from "@/utils/cn";
import { formatMonth } from "@/utils/formatters";

import { dayCellLabel } from "./dayLabels";
import { MonthCalendarSheet } from "./MonthCalendarSheet";
import { recoveryDotColor } from "./recoveryDot";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const SWIPE_DISTANCE = 40;

/** Monday of the week containing `key`. */
function weekStartOf(key: string): string {
  return shiftDayKey(key, -((fromDayKey(key).getDay() + 6) % 7));
}

/** Moves a week start by whole weeks, never past the current week. */
function shiftWeek(weekStart: string, weeks: number): string {
  const next = shiftDayKey(weekStart, weeks * 7);
  const limit = weekStartOf(toDayKey(new Date()));
  return next > limit ? limit : next;
}

/**
 * Week strip for browsing past days. Swiping (or the accessibility
 * increment/decrement actions) only moves the visible week; tapping a day
 * selects it.
 */
export function DayStrip() {
  const { colors } = useTheme();
  const selected = useSelectedDayKey();
  const selectedDay = useDayStore((s) => s.selectedDay);
  const selectDay = useDayStore((s) => s.selectDay);
  const goToToday = useDayStore((s) => s.goToToday);
  const today = toDayKey(new Date());
  const thisWeekStart = weekStartOf(today);

  const [weekStart, setWeekStart] = useState(() => weekStartOf(selected));
  const [calendarOpen, setCalendarOpen] = useState(false);

  // Follow the selection into its week (adjusting state during render).
  const [followed, setFollowed] = useState(selectedDay);
  if (followed !== selectedDay) {
    setFollowed(selectedDay);
    setWeekStart(weekStartOf(selected));
  }

  const move = (weeks: number) => setWeekStart((c) => shiftWeek(c, weeks));

  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) =>
          Math.abs(g.dx) > 16 && Math.abs(g.dx) > Math.abs(g.dy) * 2,
        onPanResponderRelease: (_, g) => {
          if (g.dx > SWIPE_DISTANCE) setWeekStart((c) => shiftWeek(c, -1));
          else if (g.dx < -SWIPE_DISTANCE) setWeekStart((c) => shiftWeek(c, 1));
        },
      }),
    [],
  );

  const days = Array.from({ length: 7 }, (_, i) => shiftDayKey(weekStart, i));
  const scores = useDayScores(days[0]!, days[6]!);
  const monthDate = fromDayKey(shiftDayKey(weekStart, 3));
  const monthLabel = formatMonth(monthDate);
  const showToday = selectedDay !== null || weekStart !== thisWeekStart;

  return (
    <View className="gap-md mb-lg">
      <View className="flex-row items-center justify-between">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Pick a day, ${monthLabel}`}
          onPress={() => {
            void Haptics.selectionAsync();
            setCalendarOpen(true);
          }}
          className="flex-row items-center gap-xs active:opacity-70"
        >
          <Text className="type-subheading text-text">{monthLabel}</Text>
          <ChevronDown color={colors.textMuted} size={16} />
        </Pressable>
        {showToday ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Go to today"
            onPress={() => {
              void Haptics.selectionAsync();
              goToToday();
              setWeekStart(thisWeekStart);
            }}
            className="active:opacity-70"
          >
            <Pill tone="positive">Today</Pill>
          </Pressable>
        ) : null}
      </View>

      <View
        testID="day-strip"
        accessibilityActions={[
          { name: "increment", label: "Next week" },
          { name: "decrement", label: "Previous week" },
        ]}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === "increment") move(1);
          if (event.nativeEvent.actionName === "decrement") move(-1);
        }}
      >
        <View className="flex-row gap-xs" {...pan.panHandlers}>
          {days.map((key, index) => {
            const future = key > today;
            const isSelected = key === selected;
            const recovery = scores[key]?.recovery ?? null;
            const dot = recoveryDotColor(recovery, colors);
            return (
              <Pressable
                key={key}
                accessibilityRole="button"
                accessibilityLabel={dayCellLabel(key, recovery)}
                accessibilityState={{ disabled: future, selected: isSelected }}
                disabled={future}
                onPress={() => {
                  void Haptics.selectionAsync();
                  selectDay(key);
                }}
                className={cn(
                  "flex-1 items-center gap-2xs py-sm rounded-card border border-outline-soft bg-surface-prose active:opacity-70",
                  isSelected && "bg-primary border-primary",
                  future && "opacity-40",
                )}
              >
                <Text
                  className={cn(
                    "type-caption",
                    isSelected ? "text-canvas" : "text-text-muted",
                  )}
                >
                  {WEEKDAYS[index]}
                </Text>
                <Text
                  className={cn(
                    "type-subheading",
                    isSelected ? "text-canvas" : "text-text",
                  )}
                >
                  {fromDayKey(key).getDate()}
                </Text>
                <View
                  className="w-[6px] h-[6px] rounded-full"
                  style={{
                    backgroundColor: dot
                      ? isSelected
                        ? colors.canvas
                        : dot
                      : colors.transparent,
                  }}
                />
              </Pressable>
            );
          })}
        </View>
      </View>

      <MonthCalendarSheet
        visible={calendarOpen}
        month={toDayKey(monthDate).slice(0, 7)}
        onClose={() => setCalendarOpen(false)}
        onPick={(key) => selectDay(key)}
      />
    </View>
  );
}
