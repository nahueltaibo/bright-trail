import { localClock, type ChildProfile } from '@bright-trail/shared';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { loadBundle } from '../../../../content/loadBundle';
import { StateBadge } from '../../../../parent/components/StateBadge';
import { ParentScreen, Section, styles as ui } from '../../../../parent/components/ui';
import { gradeLabel } from '../../../../parent/grades';
import { placedSkills, type PlacedSkill } from '../../../../parent/skillTree';
import { useStorage } from '../../../../storage/StorageProvider';

/** The skills placement gave a state to, for the parent's spot-check of 10. */
export default function PlacementReviewScreen() {
  const { childId } = useLocalSearchParams<{ childId: string }>();
  const repo = useStorage();
  const [child, setChild] = useState<ChildProfile | null>(null);
  const [rows, setRows] = useState<PlacedSkill[] | null>(null);

  useEffect(() => {
    (async () => {
      const [profile, bundle, mastery, attempts] = await Promise.all([
        repo.children.get(childId),
        loadBundle(),
        repo.mastery.listForChild(childId),
        repo.attempts.listForChild(childId),
      ]);
      setChild(profile);
      setRows(placedSkills(bundle.skills, mastery, attempts, localClock().today));
    })();
  }, [repo, childId]);

  return (
    <ParentScreen title={child ? `${child.firstName}'s placement` : 'Placement'}>
      <Section>
        <Text style={ui.muted}>
          Pick 10 skills and check each against what you know of your child. The bar is agreeing on
          8 of 10.
        </Text>
      </Section>
      <Section title={rows ? `${rows.length} placed skills` : 'Placed skills'}>
        {rows?.length === 0 && <Text style={ui.muted}>Placement hasn’t run yet.</Text>}
        {rows?.map(({ skill, state, placementAnswered, placementCorrect }) => (
          <View key={skill.id} style={ui.row}>
            <View style={{ flex: 1 }}>
              <Text style={ui.text}>{skill.title}</Text>
              <Text style={ui.muted}>
                {gradeLabel(skill.grade)} ·{' '}
                {placementAnswered > 0
                  ? `${placementCorrect} of ${placementAnswered} right in placement`
                  : state === 'assumed'
                    ? 'Not asked, assumed from grade'
                    : 'No placement items'}
              </Text>
            </View>
            <StateBadge state={state} />
          </View>
        ))}
      </Section>
    </ParentScreen>
  );
}
