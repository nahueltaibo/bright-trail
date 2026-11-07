import { SCHOOL_GRADES, deriveGrade, type SchoolGrade } from '@bright-trail/shared';
import { useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { AVATARS } from '../../avatars';
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
        <Text style={styles.label}>First name</Text>
        <TextInput
          accessibilityLabel="First name"
          testID="child-first-name"
          value={draft.firstName}
          onChangeText={(firstName) => set({ firstName })}
          autoCapitalize="words"
          autoCorrect={false}
          style={styles.input}
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.label}>Avatar</Text>
        <View style={styles.wrap}>
          {AVATARS.map((a) => (
            <Pressable
              key={a.key}
              accessibilityRole="button"
              accessibilityLabel={a.label}
              accessibilityState={{ selected: draft.avatar === a.key }}
              onPress={() => set({ avatar: a.key })}
              style={[styles.avatar, draft.avatar === a.key && styles.selected]}
            >
              <Text style={styles.avatarEmoji}>{a.emoji}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <DateField
        label="Birthdate"
        value={draft.birthdate}
        onChange={(birthdate) => set({ birthdate })}
        minYear={thisYear - 16}
        maxYear={thisYear}
      />
      {draft.birthdate > today && <Text style={ui.error}>The birthdate is in the future.</Text>}

      <View style={styles.field}>
        <Text style={styles.label}>School grade</Text>
        <Text style={ui.muted}>
          From the birthdate: {gradeLabel(derived)}. Change it if your child is in a different
          grade.
        </Text>
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
      </View>

      <View style={[styles.field, styles.switchRow]}>
        <View style={styles.flex}>
          <Text style={styles.label}>Reading mode</Text>
          <Text style={ui.muted}>Narration starts off. For kids who read on their own.</Text>
        </View>
        <Switch
          accessibilityLabel="Reading mode"
          value={draft.readingMode}
          onValueChange={(readingMode) => set({ readingMode })}
        />
      </View>

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
      style={[styles.chip, selected && styles.selected]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  form: { gap: 20 },
  field: { gap: 8 },
  label: { fontSize: 16, fontWeight: '600', color: colors.text },
  input: {
    fontSize: 18,
    minHeight: 48,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#fff',
    color: colors.text,
  },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: '#FFF4D6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEmoji: { fontSize: 32 },
  selected: { borderColor: colors.primary, backgroundColor: '#DCE5FA' },
  chip: {
    minHeight: 40,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: '#fff',
    justifyContent: 'center',
  },
  chipText: { fontSize: 15, color: colors.text },
  chipTextSelected: { fontWeight: '600', color: colors.primary },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flex: { flex: 1, gap: 4 },
});
