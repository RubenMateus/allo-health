import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { ChevronLeft, ChevronRight, X } from "lucide-react-native";
import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { useDayScores } from "@/hooks/useDayScores";
import { fromDayKey, toDayKey } from "@/services/journal";
import { useTheme } from "@/theme/ThemeProvider";
import { cn } from "@/utils/cn";
import { formatMonthName } from "@/utils/formatters";

import { dayCellLabel } from "./dayLabels";
import { recoveryDotColor } from "./recoveryDot";

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

function monthKey(date: Date): string {
  return toDayKey(date).slice(0, 7);
}

function shiftMonth(month: string, delta: number): string {
  const [year, m] = month.split("-").map(Number);
  return monthKey(new Date(year!, m! - 1 + delta, 1));
}

/** Month grid (Monday first) for picking a past day. */
export function MonthCalendarSheet({
  visible,
  month,
  onClose,
  onPick,
}: {
  visible: boolean;
  /** Month to show when opened, as `YYYY-MM`. */
  month: string;
  onClose: () => void;
  onPick: (key: string) => void;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      {/* Mounted only while open, so no scores are read for a hidden sheet. */}
      {visible ? (
        <CalendarContent month={month} onClose={onClose} onPick={onPick} />
      ) : null}
    </Modal>
  );
}

function CalendarContent({
  month,
  onClose,
  onPick,
}: {
  month: string;
  onClose: () => void;
  onPick: (key: string) => void;
}) {
  const { colors, scheme } = useTheme();
  const [shown, setShown] = useState(month);

  const first = fromDayKey(`${shown}-01`);
  const daysInMonth = new Date(
    first.getFullYear(),
    first.getMonth() + 1,
    0,
  ).getDate();
  const lead = (first.getDay() + 6) % 7;
  const keys = Array.from(
    { length: daysInMonth },
    (_, i) => `${shown}-${String(i + 1).padStart(2, "0")}`,
  );
  const cells: (string | null)[] = [...Array<null>(lead).fill(null), ...keys];
  while (cells.length % 7 !== 0) cells.push(null);

  const today = toDayKey(new Date());
  const isCurrentMonth = shown >= today.slice(0, 7);
  const scores = useDayScores(keys[0]!, keys[daysInMonth - 1]!);
  const rows = Array.from({ length: cells.length / 7 }, (_, r) =>
    cells.slice(r * 7, r * 7 + 7),
  );

  return (
    <View className="flex-1 justify-end bg-scrim">
      <Pressable
        accessibilityLabel="Close calendar"
        style={StyleSheet.absoluteFill}
        onPress={onClose}
      />
      <BlurView
        intensity={25}
        tint={scheme}
        className="px-2xl pt-md pb-3xl rounded-tl-xl rounded-tr-xl overflow-hidden bg-surface-elevated-prose border border-outline-glass"
      >
        <View className="self-center w-9 h-1 rounded-full bg-text-subtle mb-xl" />
        <View className="flex-row justify-between items-center mb-lg">
          <View className="flex-row items-center gap-sm">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Previous month"
              onPress={() => setShown((m) => shiftMonth(m, -1))}
              className="w-10 h-10 items-center justify-center rounded-full bg-surface-high active:opacity-70"
            >
              <ChevronLeft color={colors.textMuted} size={18} />
            </Pressable>
            <Text className="type-title text-text">
              {formatMonthName(first, true)}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Next month"
              accessibilityState={{ disabled: isCurrentMonth }}
              disabled={isCurrentMonth}
              onPress={() => setShown((m) => shiftMonth(m, 1))}
              className={cn(
                "w-10 h-10 items-center justify-center rounded-full bg-surface-high active:opacity-70",
                isCurrentMonth && "opacity-40",
              )}
            >
              <ChevronRight color={colors.textMuted} size={18} />
            </Pressable>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={onClose}
            className="w-10 h-10 items-center justify-center rounded-full bg-surface-high"
          >
            <X color={colors.textMuted} size={18} />
          </Pressable>
        </View>

        <View className="flex-row mb-xs">
          {WEEKDAYS.map((letter, i) => (
            <Text
              key={i}
              className="flex-1 type-caption text-text-subtle text-center"
            >
              {letter}
            </Text>
          ))}
        </View>
        <View className="gap-xs">
          {rows.map((row, r) => (
            <View key={r} className="flex-row gap-xs">
              {row.map((key, c) => {
                if (!key) {
                  return (
                    <View
                      key={c}
                      testID={`cal-cell-pad-${r * 7 + c}`}
                      className="flex-1 h-12"
                    />
                  );
                }
                const future = key > today;
                const recovery = scores[key]?.recovery ?? null;
                const dot = recoveryDotColor(recovery, colors);
                return (
                  <Pressable
                    key={c}
                    testID={`cal-cell-${key}`}
                    accessibilityRole="button"
                    accessibilityLabel={dayCellLabel(key, recovery)}
                    accessibilityState={{ disabled: future }}
                    disabled={future}
                    onPress={() => {
                      void Haptics.selectionAsync();
                      onPick(key);
                      onClose();
                    }}
                    className={cn(
                      "flex-1 h-12 items-center justify-center gap-2xs rounded-card border border-outline-soft bg-surface-prose active:opacity-70",
                      future && "opacity-40",
                    )}
                  >
                    <Text className="type-body-small text-text">
                      {Number(key.slice(8))}
                    </Text>
                    <View
                      className="w-[5px] h-[5px] rounded-full"
                      style={{ backgroundColor: dot ?? colors.transparent }}
                    />
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      </BlurView>
    </View>
  );
}
