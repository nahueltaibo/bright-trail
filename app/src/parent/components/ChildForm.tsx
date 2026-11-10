import { SCHOOL_GRADES, deriveGrade, type SchoolGrade } from '@bright-trail/shared';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { AVATARS } from '../../avatars';
import { Icon } from '../../design/Icon';
import { AvatarDisc } from '../../design/kid';
import { color, font, radius, TAP_PARENT } from '../../design/tokens';
import type { ChildDraft } from '../children';
import { gradeLabel } from '../grades';
import { DateField } from './DateField';
import { Button, colors, styles as ui } from './ui';

/** Add and edit form for a child profile. Shows the derived grade next to the override. */
export function ChildForm({
  initial,
  today,
  submitLabel,
  onSubmit,
}: {
  initial: ChildDraft;
  today: string;
  submitLabel: string;
  onSubmit: (draft: ChildDraft) => Promise<void>;
}) {
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<ChildDraft>) => setDraft((d) => ({ ...d, ...patch }));

  const thisYear = Number(today.slice(0, 4));
  const derived = deriveGrade(draft.birthdate, today);
  const canSave = draft.firstName.trim().length > 0 && draft.birthdate <= today && !busy;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await onSubmit(draft);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.form}>
      <View style={styles.field}>
        <Text style={ui.label}>First name</Text>
        <TextInput
          accessibilityLabel="First name"
          testID="child-first-name"
          value={draft.firstName}
          onChangeText={(firstName) => set({ firstName })}
          autoCapitalize="words"
          autoCorrect={false}
          placeholder="e.g. Maya"
          placeholderTextColor={colors.muted}
          style={styles.input}
        />
      </View>

      <View style={styles.field}>
        <Text style={ui.label}>Avatar</Text>
        <View style={styles.avatars}>
          {AVATARS.map((a) => {
            const selected = draft.avatar === a.key;
            return (
              <Pressable
                key={a.key}
                accessibilityRole="button"
                accessibilityLabel={a.label}
                accessibilityState={{ selected }}
                onPress={() => set({ avatar: a.key })}
                style={[styles.avatar, selected && styles.selected]}
              >
                <AvatarDisc animal={a.key} size={44} />
                <Text style={[styles.avatarName, selected && styles.avatarNameOn]}>{a.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <DateField
        label="Birthdate"
        value={draft.birthdate}
        onChange={(birthdate) => set({ birthdate })}
        minYear={thisYear - 16}
        maxYear={thisYear}
      />
      {draft.birthdate > today && (
        <View style={styles.errorRow}>
          <Icon name="alert" size={16} tint={colors.danger} />
          <Text style={ui.error}>The birthdate is in the future.</Text>
        </View>
      )}

      <View style={styles.field}>
        <Text style={ui.label}>School grade</Text>
        <View style={styles.wrap}>
          <GradeChip
            label={`Auto (${gradeLabel(derived)})`}
            selected={draft.gradeOverride === null}
            onPress={() => set({ gradeOverride: null })}
          />
          {SCHOOL_GRADES.map((g: SchoolGrade) => (
            <GradeChip
              key={g}
              label={gradeLabel(g)}
              selected={draft.gradeOverride === g}
              onPress={() => set({ gradeOverride: g })}
            />
          ))}
        </View>
        <Text style={ui.hint}>
          From the birthdate: {gradeLabel(derived)}. Change it if your child is in a different
          grade.
        </Text>
      </View>

      <Pressable
        accessibilityRole="switch"
        accessibilityLabel="Reading mode"
        accessibilityState={{ checked: draft.readingMode }}
        onPress={() => set({ readingMode: !draft.readingMode })}
        style={styles.toggle}
      >
        <View style={styles.flex}>
          <Text style={ui.label}>Reading mode</Text>
          <Text style={ui.hint}>Narration starts off. For kids who read on their own.</Text>
        </View>
        <Text style={styles.toggleState}>{draft.readingMode ? 'On' : 'Off'}</Text>
        <View style={[styles.track, draft.readingMode && styles.trackOn]}>
          <View style={[styles.thumb, draft.readingMode && styles.thumbOn]} />
        </View>
      </Pressable>

      {error && <Text style={ui.error}>{error}</Text>}
      <Button label={submitLabel} onPress={submit} disabled={!canSave} />
    </View>
  );
}

function GradeChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      {selected && <Icon name="check" size={16} tint={colors.primary} stroke={3} />}
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  form: { gap: 20 },
  field: { gap: 6 },
  input: {
    ...font.body(),
    fontSize: 16,
    minHeight: TAP_PARENT,
    paddingHorizontal: 14,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    backgroundColor: colors.card,
    color: colors.text,
  },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  avatars: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  avatar: {
    width: '18%',
    minWidth: 56,
    flexGrow: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: radius.md,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  avatarName: { ...font.body(), fontSize: 13, lineHeight: 18, color: colors.muted },
  avatarNameOn: { ...font.body(700), color: colors.text },
  selected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: -14 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: TAP_PARENT,
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    backgroundColor: colors.card,
  },
  chipSelected: {
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
  },
  chipText: { ...font.body(700), fontSize: 14, lineHeight: 20, color: colors.text },
  chipTextSelected: { color: colors.primary },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56 },
  toggleState: {
    ...font.body(700),
    fontSize: 13,
    color: colors.muted,
    minWidth: 26,
    textAlign: 'right',
  },
  track: {
    width: 52,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    backgroundColor: colors.sunken,
    justifyContent: 'center',
    paddingHorizontal: 2.5,
  },
  trackOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  thumb: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.muted },
  thumbOn: { backgroundColor: color.onPPrimary, transform: [{ translateX: 20 }] },
  flex: { flex: 1, gap: 2 },
});
