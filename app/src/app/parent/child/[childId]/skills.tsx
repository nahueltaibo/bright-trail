import { localClock, type ChildProfile } from '@bright-trail/shared';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';
import { loadBundle } from '../../../../content/loadBundle';
import { SkillGraph } from '../../../../parent/components/SkillGraph';
import { StateBadge, StateLegend } from '../../../../parent/components/StateBadge';
import {
  colors,
  ParentRow,
  ParentScreen,
  Section,
  Segmented,
  styles,
  useWide,
} from '../../../../parent/components/ui';
import { gradeLabel } from '../../../../parent/grades';
import {
  groupSkillsByGrade,
  layoutSkillGraph,
  type GradeGroup,
} from '../../../../parent/skillTree';
import { useStorage } from '../../../../storage/StorageProvider';

type SkillView = 'list' | 'tree';
const VIEWS = [
  { value: 'list', label: 'List', icon: 'list' },
  { value: 'tree', label: 'Tree', icon: 'tree' },
] as const;

/** Every skill by grade, colored by the child's state on it. Tablets can also draw it as a graph. */
export default function SkillTreeScreen() {
  const { childId } = useLocalSearchParams<{ childId: string }>();
  const repo = useStorage();
  const wide = useWide();
  const [child, setChild] = useState<ChildProfile | null>(null);
  const [groups, setGroups] = useState<GradeGroup[] | null>(null);
  const [view, setView] = useState<SkillView>('list');
  const [selectedId, setSelectedId] = useState<string>();
  const layout = useMemo(() => groups && layoutSkillGraph(groups), [groups]);

  useEffect(() => {
    (async () => {
      const [profile, bundle, mastery] = await Promise.all([
        repo.children.get(childId),
        loadBundle(),
        repo.mastery.listForChild(childId),
      ]);
      setChild(profile);
      setGroups(groupSkillsByGrade(bundle.skills, mastery, localClock().today));
    })();
  }, [repo, childId]);

  // Phones keep the list: the graph needs room to read.
  const tree = wide && view === 'tree';
  const selected = layout?.nodes.find((n) => n.skill.id === selectedId);

  return (
    <ParentScreen title="Skill tree" backLabel={child?.firstName ?? 'Back'}>
      <Section
        title="What the badges mean"
        action={wide && <Segmented label="View" value={view} options={VIEWS} onChange={setView} />}
      >
        <StateLegend />
      </Section>
      {tree && layout && (
        <Section
          title="All skills"
          description="Arrows run from a skill to the skills it unlocks. Tap a skill for its curriculum codes."
          padded={false}
        >
          {selected ? (
            <ParentRow
              first
              title={selected.skill.title}
              meta={`${gradeLabel(selected.skill.grade)} · ${selected.skill.expectationCodes.join(', ')}`}
              trailing={<StateBadge state={selected.state} />}
            />
          ) : (
            <View style={[styles.row, styles.rowFirst]}>
              <Text style={styles.muted}>No skill picked yet.</Text>
            </View>
          )}
          <View style={{ borderTopWidth: 1, borderTopColor: colors.border }}>
            <SkillGraph layout={layout} selectedId={selectedId} onSelect={setSelectedId} />
          </View>
        </Section>
      )}
      {!tree &&
        groups?.map((group) => (
          <Section key={group.grade} title={gradeLabel(group.grade)} padded={false}>
            {group.rows.map(({ skill, state }, i) => (
              <ParentRow
                key={skill.id}
                first={i === 0}
                title={skill.title}
                meta={skill.expectationCodes.join(', ')}
                trailing={<StateBadge state={state} />}
              />
            ))}
          </Section>
        ))}
    </ParentScreen>
  );
}
