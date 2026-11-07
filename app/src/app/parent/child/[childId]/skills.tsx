import { localClock, type ChildProfile } from '@bright-trail/shared';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { loadBundle } from '../../../../content/loadBundle';
import { StateBadge, StateLegend } from '../../../../parent/components/StateBadge';
import { ParentScreen, Section, styles as ui } from '../../../../parent/components/ui';
import { gradeLabel } from '../../../../parent/grades';
import { groupSkillsByGrade, type GradeGroup } from '../../../../parent/skillTree';
import { useStorage } from '../../../../storage/StorageProvider';

/** Every skill by grade, colored by the child's state on it. */
export default function SkillTreeScreen() {
  const { childId } = useLocalSearchParams<{ childId: string }>();
  const repo = useStorage();
  const [child, setChild] = useState<ChildProfile | null>(null);
  const [groups, setGroups] = useState<GradeGroup[] | null>(null);

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

  return (
    <ParentScreen title={child ? `${child.firstName}'s skills` : 'Skills'}>
      <Section>
        <StateLegend />
      </Section>
      {groups?.map((group) => (
        <Section key={group.grade} title={gradeLabel(group.grade)}>
          {group.rows.map(({ skill, state }) => (
            <View key={skill.id} style={ui.row}>
              <View style={{ flex: 1 }}>
                <Text style={ui.text}>{skill.title}</Text>
                <Text style={ui.muted}>{skill.expectationCodes.join(', ')}</Text>
              </View>
              <StateBadge state={state} />
            </View>
          ))}
        </Section>
      ))}
    </ParentScreen>
  );
}
