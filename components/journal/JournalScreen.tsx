import * as Haptics from "expo-haptics";
import { Check, Flame, Lock, Trash2 } from "lucide-react-native";
import { useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";

import { TabHeader } from "@/components/navigation/TabHeader";
import { useHealthConnectSheet } from "@/components/permissions/useHealthConnectSheet";
import {
  Card,
  EmptyState,
  Hairline,
  MetricLabel,
  Pill,
  Screen,
  SectionHeader,
} from "@/components/ui/primitives";
import {
  energyLabels,
  fromDayKey,
  JOURNAL_TAGS,
  moodLabels,
  NOTE_MAX_LENGTH,
  summarizeWeek,
  tagLabels,
  toDayKey,
  type JournalEntry,
  type JournalTag,
  type JournalWeekSummary,
  type Rating,
} from "@/services/journal";
import { useJournalStore } from "@/stores/journalStore";
import { useTheme } from "@/theme/ThemeProvider";
import { type ColorTokens } from "@/theme/tokens";
import { cn } from "@/utils/cn";
import { formatDayLabel } from "@/utils/formatters";

const ratings: Rating[] = [1, 2, 3, 4, 5];

function moodColor(colors: ColorTokens, mood: Rating) {
  return {
    1: colors.strainEnd,
    2: colors.stress,
    3: colors.vo2,
    4: colors.moodGood,
    5: colors.primary,
  }[mood];
}

export function JournalScreen() {
  const { colors } = useTheme();
  const entries = useJournalStore((state) => state.entries);
  const hydrated = useJournalStore((state) => state.hydrated);
  const loadFailed = useJournalStore((state) => state.loadFailed);
  const saveEntry = useJournalStore((state) => state.saveEntry);
  const deleteEntry = useJournalStore((state) => state.deleteEntry);

  const today = toDayKey(new Date());
  const todayEntry = entries.find((entry) => entry.date === today) ?? null;
  const pastEntries = entries.filter((entry) => entry.date !== today);
  const week = summarizeWeek(entries, today);

  const confirmDelete = (entry: JournalEntry) => {
    const remove = () => deleteEntry(entry.date);
    Alert.alert(
      "Delete entry?",
      `${formatDayLabel(fromDayKey(entry.date))} will be removed from this device.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: remove },
      ],
    );
  };

  const healthSheet = useHealthConnectSheet();

  return (
    <>
      <Screen>
        <TabHeader section="Journal" onConnectPress={healthSheet.open} />

        <View className="flex-row items-end gap-md mb-xl">
          <View className="flex-1 gap-2xs">
            <Text className="type-display text-text tracking-[-1px]">
              Journal
            </Text>
            <Text className="type-body-small text-text-muted">
              Daily check-ins, stored only on this phone
            </Text>
          </View>
          <View className="flex-row items-center gap-2xs px-md py-xs rounded-full border border-primary-border bg-primary-wash">
            <Lock color={colors.primary} size={12} strokeWidth={2.4} />
            <Text className="type-badge text-primary">ON-DEVICE</Text>
          </View>
        </View>

        <WeekCard week={week} today={today} />

        <View className="gap-md mt-section">
          <SectionHeader
            title="Today's check-in"
            trailing={
              todayEntry ? <Pill tone="positive">Logged</Pill> : undefined
            }
          />
          {loadFailed ? (
            <Card>
              <EmptyState
                title="Journal unavailable"
                detail="Your saved entries couldn't be read from this device. Restart the app to try again."
              />
            </Card>
          ) : hydrated ? (
            <CheckInCard
              // Remount when the stored entry changes so the form shows it.
              key={`${today}:${todayEntry?.updatedAt ?? "new"}`}
              date={today}
              entry={todayEntry}
              onSave={(draft) => {
                saveEntry(draft);
                void Haptics.notificationAsync(
                  Haptics.NotificationFeedbackType.Success,
                );
              }}
            />
          ) : (
            <Card>
              <View className="h-[220px] rounded-md bg-surface-elevated-prose" />
            </Card>
          )}
        </View>

        <View className="gap-md mt-section">
          <SectionHeader
            title="Past entries"
            trailing={
              pastEntries.length ? (
                <Text className="type-mono text-text-subtle">
                  {pastEntries.length}{" "}
                  {pastEntries.length === 1 ? "entry" : "entries"}
                </Text>
              ) : undefined
            }
          />
          {pastEntries.length ? (
            pastEntries.map((entry) => (
              <EntryCard
                key={entry.date}
                entry={entry}
                onDelete={() => confirmDelete(entry)}
              />
            ))
          ) : (
            <Card>
              <EmptyState
                title="No past entries yet"
                detail="Check in each day to see how mood and energy track with your recovery."
              />
            </Card>
          )}
        </View>
      </Screen>
      {healthSheet.sheet}
    </>
  );
}

function WeekCard({
  week,
  today,
}: {
  week: JournalWeekSummary;
  today: string;
}) {
  const { colors, glow } = useTheme();
  return (
    <Card className="gap-lg">
      <View className="flex-row items-start justify-between gap-md">
        <View className="flex-1 gap-2xs">
          <Text className="type-badge text-text-subtle uppercase">
            LAST 7 DAYS
          </Text>
          <Text className="type-heading text-text">
            {week.loggedDays} of 7 days logged
          </Text>
        </View>
        <View className="flex-row items-center gap-xs px-md py-xs rounded-full border border-outline-soft bg-surface-elevated-prose">
          <Flame color={colors.primary} size={14} strokeWidth={2.4} />
          <Text className="type-mono text-primary">
            {week.streak}-day streak
          </Text>
        </View>
      </View>

      <View className="flex-row justify-between">
        {week.days.map((day) => {
          const date = fromDayKey(day.date);
          const isToday = day.date === today;
          return (
            <View
              key={day.date}
              className="items-center gap-sm flex-1"
              accessible
              accessibilityLabel={`${formatDayLabel(date)}: ${
                day.entry
                  ? `mood ${moodLabels[day.entry.mood]}, energy ${energyLabels[day.entry.energy]}`
                  : "no entry"
              }`}
            >
              <Text
                className={cn(
                  "type-caption text-text-subtle",
                  isToday && "text-text",
                )}
              >
                {new Intl.DateTimeFormat(undefined, {
                  weekday: "narrow",
                }).format(date)}
              </Text>
              <View
                className={cn(
                  "w-[34px] h-[34px] rounded-md bg-surface-elevated-prose border border-outline-soft items-center justify-center",
                  isToday && "border-primary-border",
                )}
                style={[
                  day.entry && {
                    backgroundColor: moodColor(colors, day.entry.mood),
                    borderColor: moodColor(colors, day.entry.mood),
                  },
                  day.entry && isToday && glow.recovery,
                ]}
              >
                {day.entry ? (
                  <View className="w-1.5 h-1.5 rounded-full bg-canvas" />
                ) : null}
              </View>
              <Text className="type-mono text-text-muted">
                {day.entry ? day.entry.mood : "-"}
              </Text>
            </View>
          );
        })}
      </View>

      <Hairline />

      <View className="flex-row items-center">
        <WeekStat label="Avg mood" value={week.averageMood} />
        <View className="w-hairline self-stretch bg-outline-soft mx-md" />
        <WeekStat label="Avg energy" value={week.averageEnergy} />
        <View className="w-hairline self-stretch bg-outline-soft mx-md" />
        <View className="flex-1 gap-2xs">
          <Text className="type-metric-lg text-text tabular-nums">
            {week.loggedDays}
          </Text>
          <MetricLabel>Check-ins</MetricLabel>
        </View>
      </View>
    </Card>
  );
}

function WeekStat({ label, value }: { label: string; value: number | null }) {
  return (
    <View className="flex-1 gap-2xs">
      <Text className="type-metric-lg text-text tabular-nums">
        {value === null ? "-" : value.toFixed(1)}
        <Text className="type-mono text-text-subtle">/5</Text>
      </Text>
      <MetricLabel>{label}</MetricLabel>
    </View>
  );
}

function CheckInCard({
  date,
  entry,
  onSave,
}: {
  date: string;
  entry: JournalEntry | null;
  onSave: (draft: {
    date: string;
    mood: Rating;
    energy: Rating;
    tags: JournalTag[];
    note: string;
  }) => void;
}) {
  const { colors } = useTheme();
  const [mood, setMood] = useState<Rating | null>(entry?.mood ?? null);
  const [energy, setEnergy] = useState<Rating | null>(entry?.energy ?? null);
  const [tags, setTags] = useState<JournalTag[]>(entry?.tags ?? []);
  const [note, setNote] = useState(entry?.note ?? "");
  const canSave = mood !== null && energy !== null;

  const toggleTag = (tag: JournalTag) => {
    void Haptics.selectionAsync();
    setTags((current) =>
      current.includes(tag)
        ? current.filter((item) => item !== tag)
        : [...current, tag],
    );
  };

  return (
    <Card className="gap-xl">
      <RatingScale
        label="Mood"
        value={mood}
        labels={moodLabels}
        onChange={setMood}
      />
      <RatingScale
        label="Energy"
        value={energy}
        labels={energyLabels}
        onChange={setEnergy}
      />

      <View className="gap-sm">
        <MetricLabel className="type-badge text-text-subtle">
          FACTORS
        </MetricLabel>
        <View className="flex-row flex-wrap gap-sm">
          {JOURNAL_TAGS.map((tag) => {
            const selected = tags.includes(tag);
            return (
              <Pressable
                key={tag}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected }}
                onPress={() => toggleTag(tag)}
                className={cn(
                  "flex-row items-center gap-2xs min-h-[34px] px-md rounded-full border border-outline-soft bg-surface-elevated-prose",
                  selected && "border-primary-border bg-primary-wash",
                )}
              >
                {selected ? (
                  <Check color={colors.primary} size={12} strokeWidth={3} />
                ) : null}
                <Text
                  className={cn(
                    "type-body-small text-text-muted",
                    selected && "text-primary",
                  )}
                >
                  {tagLabels[tag]}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View className="gap-sm">
        <View className="flex-row items-center justify-between">
          <MetricLabel className="type-badge text-text-subtle">
            NOTE
          </MetricLabel>
          <Text className="type-mono-small text-text-subtle">
            {note.length}/{NOTE_MAX_LENGTH}
          </Text>
        </View>
        <TextInput
          accessibilityLabel="Journal note"
          value={note}
          onChangeText={setNote}
          maxLength={NOTE_MAX_LENGTH}
          multiline
          placeholder="How did you sleep, train and feel today?"
          placeholderTextColor={colors.textSubtle}
          selectionColor={colors.primary}
          className="type-body min-h-[96px] text-text p-md rounded-md border border-outline-soft bg-canvas-deep"
          textAlignVertical="top"
        />
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: !canSave }}
        disabled={!canSave}
        onPress={() => {
          if (mood === null || energy === null) return;
          onSave({ date, mood, energy, tags, note });
        }}
        className={cn(
          "min-h-[48px] rounded-full bg-primary-bright items-center justify-center",
          !canSave && "bg-surface-high",
          "active:opacity-70",
        )}
      >
        <Text
          className={cn(
            "type-subheading text-canvas",
            !canSave && "text-text-subtle",
          )}
        >
          {entry ? "Update check-in" : "Save check-in"}
        </Text>
      </Pressable>
    </Card>
  );
}

function RatingScale({
  label,
  value,
  labels,
  onChange,
}: {
  label: string;
  value: Rating | null;
  labels: Record<Rating, string>;
  onChange: (value: Rating) => void;
}) {
  return (
    <View className="gap-sm">
      <View className="flex-row items-center justify-between">
        <MetricLabel className="type-badge text-text-subtle">
          {label.toUpperCase()}
        </MetricLabel>
        <Text className="type-mono text-primary">
          {value === null ? "Not set" : labels[value]}
        </Text>
      </View>
      <View
        className="flex-row gap-2xs p-2xs rounded-full border border-outline-soft bg-surface-prose"
        accessibilityRole="radiogroup"
      >
        {ratings.map((rating) => {
          const selected = rating === value;
          return (
            <Pressable
              key={rating}
              accessibilityRole="radio"
              accessibilityLabel={`${label} ${labels[rating]}`}
              accessibilityState={{ selected }}
              onPress={() => {
                void Haptics.selectionAsync();
                onChange(rating);
              }}
              className={cn(
                "flex-1 min-h-[40px] rounded-full items-center justify-center",
                selected &&
                  "bg-surface-elevated-prose border border-primary-border",
              )}
            >
              <Text
                className={cn(
                  "type-subheading text-text-subtle",
                  selected && "text-text",
                )}
              >
                {rating}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function EntryCard({
  entry,
  onDelete,
}: {
  entry: JournalEntry;
  onDelete: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Card className="gap-md">
      <View className="flex-row items-center gap-md">
        <View
          className="w-[38px] h-[38px] rounded-md border bg-surface-elevated-prose items-center justify-center"
          style={{ borderColor: moodColor(colors, entry.mood) }}
        >
          <Text
            className="type-subheading"
            style={{ color: moodColor(colors, entry.mood) }}
          >
            {entry.mood}
          </Text>
        </View>
        <View className="flex-1 gap-2xs">
          <Text className="type-subheading text-text">
            {moodLabels[entry.mood]} mood · {energyLabels[entry.energy]}
          </Text>
          <Text className="type-mono text-text-subtle">
            {formatDayLabel(fromDayKey(entry.date))}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Delete entry for ${formatDayLabel(fromDayKey(entry.date))}`}
          hitSlop={8}
          onPress={onDelete}
          className="w-8 h-8 rounded-full items-center justify-center active:opacity-70"
        >
          <Trash2 color={colors.textSubtle} size={16} />
        </Pressable>
      </View>
      {entry.note ? (
        <Text className="type-body text-text-muted" numberOfLines={3}>
          {entry.note}
        </Text>
      ) : null}
      {entry.tags.length ? (
        <View className="flex-row flex-wrap gap-xs">
          {entry.tags.map((tag) => (
            <Pill key={tag}>{tagLabels[tag]}</Pill>
          ))}
        </View>
      ) : null}
      <Hairline />
      <View className="flex-row items-center gap-sm">
        <Text className="type-mono-small text-text-subtle">
          MOOD {entry.mood}/5
        </Text>
        <Text className="type-mono-small text-outline">•</Text>
        <Text className="type-mono-small text-text-subtle">
          ENERGY {entry.energy}/5
        </Text>
      </View>
    </Card>
  );
}
