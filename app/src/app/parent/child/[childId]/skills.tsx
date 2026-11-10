import { localClock, type ChildProfile } from '@bright-trail/shared';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { loadBundle } from '../../../../content/loadBundle';
import { StateBadge, StateLegend } from '../../../../parent/components/StateBadge';
import { ParentRow, ParentScreen, Section } from '../../../../parent/components/ui';
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
    <ParentScreen title="Skill tree" backLabel={child?.firstName ?? 'Back'}>
      <Section title="What the badges mean">
        <StateLegend />
      </Section>
      {groups?.map((group) => (
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
