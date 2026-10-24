import * as Haptics from "expo-haptics";
import { BookOpen, Check, Flame, Lock, Trash2 } from "lucide-react-native";
import { useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { SettingsButton } from "@/components/settings/SettingsButton";
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
import { makeStyles, useTheme } from "@/theme/ThemeProvider";
import { radii, spacing, typography, type ColorTokens } from "@/theme/tokens";
import { formatDayLabel, formatToday } from "@/utils/formatters";

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
  const styles = useStyles();
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

  return (
    <Screen>
      <View style={styles.topBar}>
        <View style={styles.brandMark}>
          <BookOpen color={colors.primary} size={17} strokeWidth={2.3} />
        </View>
        <View style={styles.topBarCopy}>
          <Text style={styles.topOverline}>ALLO / JOURNAL</Text>
          <Text
            style={styles.date}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
          >
            {formatToday()}
          </Text>
        </View>
        <View style={styles.privacyBadge}>
          <Lock color={colors.primary} size={12} strokeWidth={2.4} />
          <Text style={styles.privacyText}>ON-DEVICE</Text>
        </View>
        <SettingsButton />
      </View>

      <View style={styles.hero}>
        <Text style={styles.title}>Journal</Text>
        <Text style={styles.subtitle}>
          Daily check-ins, stored only on this phone
        </Text>
      </View>

      <WeekCard week={week} today={today} />

      <View style={styles.sectionBlock}>
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
            <View style={styles.skeleton} />
          </Card>
        )}
      </View>

      <View style={styles.sectionBlock}>
        <SectionHeader
          title="Past entries"
          trailing={
            pastEntries.length ? (
              <Text style={styles.sectionMeta}>
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
  const styles = useStyles();
  return (
    <Card style={styles.weekCard}>
      <View style={styles.weekHeader}>
        <View style={styles.weekHeading}>
          <Text style={styles.eyebrow}>LAST 7 DAYS</Text>
          <Text style={styles.weekTitle}>
            {week.loggedDays} of 7 days logged
          </Text>
        </View>
        <View style={styles.streakBadge}>
          <Flame color={colors.primary} size={14} strokeWidth={2.4} />
          <Text style={styles.streakText}>{week.streak}-day streak</Text>
        </View>
      </View>

      <View style={styles.weekGrid}>
        {week.days.map((day) => {
          const date = fromDayKey(day.date);
          const isToday = day.date === today;
          return (
            <View
              key={day.date}
              style={styles.weekColumn}
              accessible
              accessibilityLabel={`${formatDayLabel(date)}: ${
                day.entry
                  ? `mood ${moodLabels[day.entry.mood]}, energy ${energyLabels[day.entry.energy]}`
                  : "no entry"
              }`}
            >
              <Text
                style={[styles.dayLetter, isToday && styles.dayLetterActive]}
              >
                {new Intl.DateTimeFormat(undefined, {
                  weekday: "narrow",
                }).format(date)}
              </Text>
              <View
                style={[
                  styles.dayCell,
                  isToday && styles.dayCellToday,
                  day.entry && {
                    backgroundColor: moodColor(colors, day.entry.mood),
                    borderColor: moodColor(colors, day.entry.mood),
                  },
                  day.entry && isToday && glow.recovery,
                ]}
              >
                {day.entry ? <View style={styles.dayDot} /> : null}
              </View>
              <Text style={styles.dayValue}>
                {day.entry ? day.entry.mood : "-"}
              </Text>
            </View>
          );
        })}
      </View>

      <Hairline />

      <View style={styles.weekStats}>
        <WeekStat label="Avg mood" value={week.averageMood} />
        <View style={styles.statDivider} />
        <WeekStat label="Avg energy" value={week.averageEnergy} />
        <View style={styles.statDivider} />
        <View style={styles.weekStat}>
          <Text style={styles.weekStatValue}>{week.loggedDays}</Text>
          <MetricLabel>Check-ins</MetricLabel>
        </View>
      </View>
    </Card>
  );
}

function WeekStat({ label, value }: { label: string; value: number | null }) {
  const styles = useStyles();
  return (
    <View style={styles.weekStat}>
      <Text style={styles.weekStatValue}>
        {value === null ? "-" : value.toFixed(1)}
        <Text style={styles.weekStatUnit}>/5</Text>
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
  const styles = useStyles();
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
    <Card style={styles.checkInCard}>
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

      <View style={styles.field}>
        <MetricLabel style={styles.fieldLabel}>FACTORS</MetricLabel>
        <View style={styles.tagWrap}>
          {JOURNAL_TAGS.map((tag) => {
            const selected = tags.includes(tag);
            return (
              <Pressable
                key={tag}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected }}
                onPress={() => toggleTag(tag)}
                style={[styles.tagChip, selected && styles.tagChipSelected]}
              >
                {selected ? (
                  <Check color={colors.primary} size={12} strokeWidth={3} />
                ) : null}
                <Text
                  style={[styles.tagText, selected && styles.tagTextSelected]}
                >
                  {tagLabels[tag]}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.field}>
        <View style={styles.noteHeader}>
          <MetricLabel style={styles.fieldLabel}>NOTE</MetricLabel>
          <Text style={styles.noteCount}>
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
          style={styles.noteInput}
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
        style={({ pressed }) => [
          styles.saveButton,
          !canSave && styles.saveButtonDisabled,
          pressed && styles.pressed,
        ]}
      >
        <Text style={[styles.saveText, !canSave && styles.saveTextDisabled]}>
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
  const styles = useStyles();
  return (
    <View style={styles.field}>
      <View style={styles.noteHeader}>
        <MetricLabel style={styles.fieldLabel}>
          {label.toUpperCase()}
        </MetricLabel>
        <Text style={styles.ratingValue}>
          {value === null ? "Not set" : labels[value]}
        </Text>
      </View>
      <View style={styles.segmented} accessibilityRole="radiogroup">
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
              style={[styles.segment, selected && styles.segmentSelected]}
            >
              <Text
                style={[
                  styles.segmentText,
                  selected && styles.segmentTextSelected,
                ]}
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
  const styles = useStyles();
  return (
    <Card style={styles.entryCard}>
      <View style={styles.entryHeader}>
        <View
          style={[
            styles.moodMark,
            { borderColor: moodColor(colors, entry.mood) },
          ]}
        >
          <Text
            style={[
              styles.moodMarkText,
              { color: moodColor(colors, entry.mood) },
            ]}
          >
            {entry.mood}
          </Text>
        </View>
        <View style={styles.entryHeading}>
          <Text style={styles.entryTitle}>
            {moodLabels[entry.mood]} mood · {energyLabels[entry.energy]}
          </Text>
          <Text style={styles.entryDate}>
            {formatDayLabel(fromDayKey(entry.date))}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Delete entry for ${formatDayLabel(fromDayKey(entry.date))}`}
          hitSlop={8}
          onPress={onDelete}
          style={({ pressed }) => [
            styles.deleteButton,
            pressed && styles.pressed,
          ]}
        >
          <Trash2 color={colors.textSubtle} size={16} />
        </Pressable>
      </View>
      {entry.note ? (
        <Text style={styles.entryNote} numberOfLines={3}>
          {entry.note}
        </Text>
      ) : null}
      {entry.tags.length ? (
        <View style={styles.entryTags}>
          {entry.tags.map((tag) => (
            <Pill key={tag}>{tagLabels[tag]}</Pill>
          ))}
        </View>
      ) : null}
      <Hairline />
      <View style={styles.entryMeta}>
        <Text style={styles.entryMetaText}>MOOD {entry.mood}/5</Text>
        <Text style={styles.entryMetaDot}>•</Text>
        <Text style={styles.entryMetaText}>ENERGY {entry.energy}/5</Text>
      </View>
    </Card>
  );
}

const useStyles = makeStyles(({ colors }) =>
  StyleSheet.create({
    topBar: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      marginBottom: spacing["2xl"],
    },
    brandMark: {
      width: 38,
      height: 38,
      borderRadius: radii.md,
      backgroundColor: colors.surfaceHigh,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.outlineSoft,
    },
    topBarCopy: { flex: 1, gap: spacing["2xs"] },
    topOverline: {
      ...typography.badge,
      color: colors.primary,
      textTransform: "uppercase",
    },
    date: { ...typography.heading, color: colors.text },
    privacyBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing["2xs"],
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: radii.full,
      borderWidth: 1,
      borderColor: colors.primaryBorder,
      backgroundColor: colors.primaryWash,
    },
    privacyText: { ...typography.badge, color: colors.primary },
    hero: { gap: spacing["2xs"], marginBottom: spacing.xl },
    title: { ...typography.display, color: colors.text, letterSpacing: -1 },
    subtitle: { ...typography.bodySmall, color: colors.textMuted },
    sectionBlock: { gap: spacing.md, marginTop: spacing.section },
    sectionMeta: { ...typography.mono, color: colors.textSubtle },
    eyebrow: {
      ...typography.badge,
      color: colors.textSubtle,
      textTransform: "uppercase",
    },
    weekCard: { gap: spacing.lg },
    weekHeader: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: spacing.md,
    },
    weekHeading: { flex: 1, gap: spacing["2xs"] },
    weekTitle: { ...typography.heading, color: colors.text },
    streakBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: radii.full,
      borderWidth: 1,
      borderColor: colors.outlineSoft,
      backgroundColor: colors.surfaceElevatedProse,
    },
    streakText: { ...typography.mono, color: colors.primary },
    weekGrid: { flexDirection: "row", justifyContent: "space-between" },
    weekColumn: { alignItems: "center", gap: spacing.sm, flex: 1 },
    dayLetter: { ...typography.caption, color: colors.textSubtle },
    dayLetterActive: { color: colors.text },
    dayCell: {
      width: 34,
      height: 34,
      borderRadius: radii.md,
      backgroundColor: colors.surfaceElevatedProse,
      borderWidth: 1,
      borderColor: colors.outlineSoft,
      alignItems: "center",
      justifyContent: "center",
    },
    dayCellToday: { borderColor: colors.primaryBorder },
    dayDot: {
      width: 6,
      height: 6,
      borderRadius: radii.full,
      backgroundColor: colors.canvas,
    },
    dayValue: { ...typography.mono, color: colors.textMuted },
    weekStats: { flexDirection: "row", alignItems: "center" },
    weekStat: { flex: 1, gap: spacing["2xs"] },
    weekStatValue: {
      ...typography.metricLG,
      color: colors.text,
      fontVariant: ["tabular-nums"],
    },
    weekStatUnit: { ...typography.mono, color: colors.textSubtle },
    statDivider: {
      width: StyleSheet.hairlineWidth,
      alignSelf: "stretch",
      backgroundColor: colors.outlineSoft,
      marginHorizontal: spacing.md,
    },
    checkInCard: { gap: spacing.xl },
    skeleton: {
      height: 220,
      borderRadius: radii.md,
      backgroundColor: colors.surfaceElevatedProse,
    },
    field: { gap: spacing.sm },
    fieldLabel: { ...typography.badge, color: colors.textSubtle },
    noteHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    ratingValue: { ...typography.mono, color: colors.primary },
    segmented: {
      flexDirection: "row",
      gap: spacing["2xs"],
      padding: spacing["2xs"],
      borderRadius: radii.full,
      borderWidth: 1,
      borderColor: colors.outlineSoft,
      backgroundColor: colors.surfaceProse,
    },
    segment: {
      flex: 1,
      minHeight: 40,
      borderRadius: radii.full,
      alignItems: "center",
      justifyContent: "center",
    },
    segmentSelected: {
      backgroundColor: colors.surfaceElevatedProse,
      borderWidth: 1,
      borderColor: colors.primaryBorder,
    },
    segmentText: { ...typography.subheading, color: colors.textSubtle },
    segmentTextSelected: { color: colors.text },
    tagWrap: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
    tagChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing["2xs"],
      minHeight: 34,
      paddingHorizontal: spacing.md,
      borderRadius: radii.full,
      borderWidth: 1,
      borderColor: colors.outlineSoft,
      backgroundColor: colors.surfaceElevatedProse,
    },
    tagChipSelected: {
      borderColor: colors.primaryBorder,
      backgroundColor: colors.primaryWash,
    },
    tagText: { ...typography.bodySmall, color: colors.textMuted },
    tagTextSelected: { color: colors.primary },
    noteCount: { ...typography.monoSmall, color: colors.textSubtle },
    noteInput: {
      ...typography.body,
      minHeight: 96,
      color: colors.text,
      padding: spacing.md,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.outlineSoft,
      backgroundColor: colors.canvasDeep,
    },
    saveButton: {
      minHeight: 48,
      borderRadius: radii.full,
      backgroundColor: colors.primaryBright,
      alignItems: "center",
      justifyContent: "center",
    },
    saveButtonDisabled: { backgroundColor: colors.surfaceHigh },
    saveText: { ...typography.subheading, color: colors.canvas },
    saveTextDisabled: { color: colors.textSubtle },
    pressed: { opacity: 0.7 },
    entryCard: { gap: spacing.md },
    entryHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
    },
    moodMark: {
      width: 38,
      height: 38,
      borderRadius: radii.md,
      borderWidth: 1,
      backgroundColor: colors.surfaceElevatedProse,
      alignItems: "center",
      justifyContent: "center",
    },
    moodMarkText: { ...typography.subheading },
    entryHeading: { flex: 1, gap: spacing["2xs"] },
    entryTitle: { ...typography.subheading, color: colors.text },
    entryDate: { ...typography.mono, color: colors.textSubtle },
    deleteButton: {
      width: 32,
      height: 32,
      borderRadius: radii.full,
      alignItems: "center",
      justifyContent: "center",
    },
    entryNote: { ...typography.body, color: colors.textMuted },
    entryTags: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
    entryMeta: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    entryMetaText: { ...typography.monoSmall, color: colors.textSubtle },
    entryMetaDot: { ...typography.monoSmall, color: colors.outline },
  }),
);
